/**
 * AgentModeAgent - Agent d'exécution des actions
 *
 * Cet agent exécute les actions approuvées par l'utilisateur.
 * Il peut créer, modifier, supprimer des fichiers, exécuter des
 * commandes, installer des packages, etc.
 */

import { BaseAgent } from './BaseAgent';
import { ActionExecutor, type ExecutionResult, type ExecutionOptions } from './ActionExecutor';
import type {
  AgentModeResponse,
  ProposedAction,
  ExecutionPlan,
  ActionResult,
  AgentContext,
  PlanEstimates,
} from './types';
import { AGENT_MODE_CONFIG } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AgentModeAgent');

/**
 * État de l'exécution
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';

/**
 * Réponse du mode Agent
 */
export interface AgentExecutionResponse {
  status: ExecutionStatus;
  plan: ExecutionPlan;
  results: ExecutionResult[];
  summary: ExecutionSummary;
}

/**
 * Résumé de l'exécution
 */
export interface ExecutionSummary {
  totalActions: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  commandsExecuted: string[];
}

/**
 * Agent en mode Action - Exécution avec validation
 *
 * Capacités:
 * - Créer des fichiers
 * - Modifier des fichiers
 * - Supprimer des fichiers
 * - Exécuter des commandes shell
 * - Installer des packages
 * - Opérations Git
 *
 * Workflow:
 * 1. Recevoir les actions approuvées
 * 2. Valider le plan d'exécution
 * 3. Exécuter les actions dans l'ordre
 * 4. Gérer les erreurs et rollback si nécessaire
 * 5. Retourner le résumé d'exécution
 */
export class AgentModeAgent extends BaseAgent<AgentModeResponse> {
  private executor: ActionExecutor;
  private currentPlan: ExecutionPlan | null = null;
  private executionStatus: ExecutionStatus = 'pending';

  constructor(executorOptions?: ExecutionOptions) {
    super(AGENT_MODE_CONFIG);
    this.executor = new ActionExecutor(executorOptions);
    logger.debug('AgentModeAgent initialized');
  }

  /**
   * Traite un message utilisateur - en mode Agent, prêt à exécuter
   */
  async process(userMessage: string): Promise<AgentModeResponse> {
    logger.debug('Processing message in Agent mode', { messageLength: userMessage.length });

    // En mode Agent, on est prêt à exécuter des actions
    // Le streaming LLM génère les artifacts directement
    return {
      type: 'response',
      status: 'ready',
      message: 'Mode Agent actif. Je peux créer et modifier du code.',
      suggestions: [],
    };
  }

  /**
   * Exécute le plan approuvé
   */
  async executePlan(actions?: ProposedAction[]): Promise<AgentExecutionResponse> {
    const actionsToExecute = actions || this.currentPlan?.actions || [];

    if (actionsToExecute.length === 0) {
      return {
        status: 'completed',
        plan: this.currentPlan || { actions: [], estimates: this.createEmptyEstimates() },
        results: [],
        summary: this.createEmptySummary(),
      };
    }

    logger.info(`Executing plan with ${actionsToExecute.length} actions`);
    this.executionStatus = 'running';

    try {
      // Exécuter les actions
      const results = await this.executor.executeAll(actionsToExecute);

      // Déterminer le statut final
      const hasFailures = results.some(r => !r.success);
      this.executionStatus = hasFailures ? 'failed' : 'completed';

      // Créer le résumé
      const summary = this.createSummary(results);

      logger.info('Execution completed', {
        status: this.executionStatus,
        success: summary.successCount,
        failures: summary.failureCount,
      });

      return {
        status: this.executionStatus,
        plan: this.currentPlan || { actions: actionsToExecute, estimates: this.createEmptyEstimates() },
        results,
        summary,
      };
    } catch (error) {
      logger.error('Execution failed', error);
      this.executionStatus = 'failed';

      return {
        status: 'failed',
        plan: this.currentPlan || { actions: actionsToExecute, estimates: this.createEmptyEstimates() },
        results: this.executor.getExecutedActions(),
        summary: this.createSummary(this.executor.getExecutedActions()),
      };
    }
  }

  /**
   * Annule les actions exécutées
   */
  async rollback(): Promise<AgentExecutionResponse> {
    logger.info('Rolling back executed actions');

    const rollbackResults = await this.executor.rollback();
    this.executionStatus = 'rolled_back';

    return {
      status: 'rolled_back',
      plan: this.currentPlan || { actions: [], estimates: this.createEmptyEstimates() },
      results: rollbackResults,
      summary: this.createSummary(rollbackResults),
    };
  }

  /**
   * Retourne le prompt système pour le mode Agent
   */
  getSystemPrompt(): string {
    return AGENT_MODE_SYSTEM_PROMPT;
  }

  /**
   * Retourne le statut actuel de l'exécution
   */
  getExecutionStatus(): ExecutionStatus {
    return this.executionStatus;
  }

  /**
   * Retourne le plan actuel
   */
  getCurrentPlan(): ExecutionPlan | null {
    return this.currentPlan;
  }

  // ===========================================================================
  // Estimation & Analysis
  // ===========================================================================

  /**
   * Estime le plan d'exécution
   */
  private estimatePlan(actions: ProposedAction[]): PlanEstimates {
    const fileActions = actions.filter(a =>
      ['create_file', 'modify_file', 'delete_file'].includes(a.type)
    );
    const commandActions = actions.filter(a => a.type === 'run_command');

    // Calculer le risque global
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    if (actions.some(a => a.risk === 'high')) {
      overallRisk = 'high';
    } else if (actions.some(a => a.risk === 'medium')) {
      overallRisk = 'medium';
    }

    return {
      duration: `${actions.length * 2}s environ`,
      filesAffected: fileActions.length,
      linesChanged: 0, // Sera calculé après génération du contenu
      risk: overallRisk,
    };
  }

  /**
   * Détecte les dépendances entre actions
   */
  private detectDependencies(actions: ProposedAction[]): Array<{ from: string; to: string }> {
    const dependencies: Array<{ from: string; to: string }> = [];

    // Simple: les actions sur le même fichier doivent être séquentielles
    const fileActions = new Map<string, string[]>();

    for (const action of actions) {
      if ('path' in action.details) {
        const path = action.details.path as string;
        if (!fileActions.has(path)) {
          fileActions.set(path, []);
        }
        fileActions.get(path)!.push(action.id);
      }
    }

    // Créer les dépendances séquentielles
    for (const actionIds of fileActions.values()) {
      for (let i = 1; i < actionIds.length; i++) {
        dependencies.push({ from: actionIds[i - 1], to: actionIds[i] });
      }
    }

    return dependencies;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Génère un ID d'action unique
   */
  private generateActionId(): string {
    return `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Formate le message du plan
   */
  private formatPlanMessage(plan: ExecutionPlan): string {
    const lines: string[] = [
      '## Plan d\'exécution',
      '',
      `**${plan.actions.length} action(s)** prévue(s)`,
      `**Risque**: ${plan.estimates.risk}`,
      `**Durée estimée**: ${plan.estimates.duration}`,
      '',
      '### Actions:',
    ];

    for (const action of plan.actions) {
      const riskEmoji = action.risk === 'high' ? '🔴' : action.risk === 'medium' ? '🟡' : '🟢';
      lines.push(`${riskEmoji} ${action.description}`);
    }

    lines.push('');
    lines.push('Voulez-vous exécuter ce plan ?');

    return lines.join('\n');
  }

  /**
   * Crée un résumé d'exécution
   */
  private createSummary(results: ExecutionResult[]): ExecutionSummary {
    return {
      totalActions: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      filesCreated: results
        .filter(r => r.actionType === 'create_file' && r.success)
        .map(r => r.message.replace('Fichier créé: ', '')),
      filesModified: results
        .filter(r => r.actionType === 'modify_file' && r.success)
        .map(r => r.message.replace(/Fichier modifié: (.+) \(.+\)/, '$1')),
      filesDeleted: results
        .filter(r => r.actionType === 'delete_file' && r.success)
        .map(r => r.message.replace('Fichier supprimé: ', '')),
      commandsExecuted: results
        .filter(r => r.actionType === 'run_command' && r.success)
        .map(r => r.message.replace('Commande exécutée: ', '')),
    };
  }

  /**
   * Crée un résumé vide
   */
  private createEmptySummary(): ExecutionSummary {
    return {
      totalActions: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      commandsExecuted: [],
    };
  }

  /**
   * Crée des estimations vides
   */
  private createEmptyEstimates(): PlanEstimates {
    return {
      duration: '0s',
      filesAffected: 0,
      linesChanged: 0,
      risk: 'low',
    };
  }
}

// =============================================================================
// Agent Mode System Prompt
// =============================================================================

export const AGENT_MODE_SYSTEM_PROMPT = `
Tu es BAVINI en MODE AGENT. Dans ce mode, tu exécutes les actions approuvées.

## Ce que tu PEUX faire:
- Créer de nouveaux fichiers
- Modifier des fichiers existants
- Supprimer des fichiers
- Exécuter des commandes shell
- Installer des packages npm/pnpm
- Effectuer des opérations Git

## Workflow d'exécution:

### 1. Validation du plan
Avant chaque action, vérifie:
- Le fichier/chemin est correct
- L'action est réversible si possible
- Le risque est acceptable

### 2. Exécution séquentielle
- Exécute les actions dans l'ordre du plan
- Arrête en cas d'erreur critique
- Log chaque étape

### 3. Vérification post-exécution
- Vérifie que les fichiers sont créés/modifiés
- Exécute les tests si applicable
- Reporte le résultat

## Format de réponse:

### Avant exécution:
\`\`\`
📋 Plan d'exécution:
1. [Action 1] - Risque: faible
2. [Action 2] - Risque: moyen
...

Confirmer l'exécution ? (oui/non)
\`\`\`

### Pendant exécution:
\`\`\`
⏳ Exécution en cours...
✅ Action 1: [description] - OK
✅ Action 2: [description] - OK
❌ Action 3: [description] - Erreur: [message]
\`\`\`

### Après exécution:
\`\`\`
📊 Résumé:
- Actions réussies: X/Y
- Fichiers créés: [liste]
- Fichiers modifiés: [liste]
- Durée totale: Xs

[En cas d'erreur]
🔄 Rollback disponible. Voulez-vous annuler les changements ?
\`\`\`

## Règles importantes:
- TOUJOURS demander confirmation avant d'exécuter
- TOUJOURS prévoir un rollback pour les actions réversibles
- JAMAIS supprimer sans confirmation explicite
- Réponds en français
`;
