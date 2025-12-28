/**
 * Orchestrator - Agent principal qui coordonne les sous-agents
 * Analyse les demandes, décompose les tâches, délègue et agrège les résultats
 */

import { BaseAgent } from '../core/base-agent';
import type { ToolHandler } from '../core/tool-registry';
import { AgentRegistry } from '../core/agent-registry';
import { ORCHESTRATOR_SYSTEM_PROMPT, AGENT_CAPABILITIES } from '../prompts/orchestrator-prompt';
import type {
  Task,
  TaskResult,
  TaskStatus,
  AgentType,
  ToolDefinition,
  OrchestrationDecision,
  ExecutionPlan,
  ExecutionStep,
  Artifact,
  ToolExecutionResult,
} from '../types';
import { createScopedLogger } from '~/utils/logger';
import {
  ParallelExecutor,
  createParallelExecutor,
  type SubtaskDefinition,
  type SubtaskResult,
} from '../execution/parallel-executor';

const logger = createScopedLogger('Orchestrator');

// ============================================================================
// OUTILS DE L'ORCHESTRATEUR
// ============================================================================

/**
 * Outil pour déléguer une tâche à un agent
 */
const DelegateToAgentTool: ToolDefinition = {
  name: 'delegate_to_agent',
  description:
    'Déléguer une tâche à un agent spécialisé. ' +
    'Utilise cet outil quand une tâche correspond aux capacités d\'un agent.',
  inputSchema: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        description: 'Nom de l\'agent cible (explore, coder, builder, tester, deployer)',
        enum: ['explore', 'coder', 'builder', 'tester', 'deployer'],
      },
      task: {
        type: 'string',
        description: 'Description précise de la tâche pour l\'agent',
      },
      context: {
        type: 'object',
        description: 'Contexte additionnel pour l\'agent (fichiers, infos, etc.)',
      },
    },
    required: ['agent', 'task'],
  },
};

/**
 * Outil pour créer des sous-tâches
 */
const CreateSubtasksTool: ToolDefinition = {
  name: 'create_subtasks',
  description:
    'Décomposer une tâche complexe en sous-tâches. ' +
    'Utilise quand la tâche nécessite plusieurs agents ou étapes.',
  inputSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: 'Liste des sous-tâches à créer',
        items: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'Agent assigné' },
            description: { type: 'string', description: 'Description de la tâche' },
            dependsOn: {
              type: 'array',
              description: 'Indices des tâches dont celle-ci dépend',
              items: { type: 'number' },
            },
          },
        },
      },
      reasoning: {
        type: 'string',
        description: 'Explication de la décomposition',
      },
    },
    required: ['tasks', 'reasoning'],
  },
};

/**
 * Outil pour obtenir le statut des agents
 */
const GetAgentStatusTool: ToolDefinition = {
  name: 'get_agent_status',
  description: 'Obtenir le statut et les capacités des agents disponibles.',
  inputSchema: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        description: 'Nom de l\'agent (optionnel, tous si omis)',
      },
    },
    required: [],
  },
};

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Agent orchestrateur principal
 */
export class Orchestrator extends BaseAgent {
  private registry: AgentRegistry;
  private currentPlan: ExecutionPlan | null = null;
  private apiKey: string = '';

  constructor() {
    super({
      name: 'orchestrator',
      description:
        'Agent principal qui coordonne les autres agents. ' +
        'Analyse les demandes, décompose les tâches complexes, et délègue aux agents spécialisés.',
      model: 'claude-sonnet-4-5-20250929',
      tools: [DelegateToAgentTool, CreateSubtasksTool, GetAgentStatusTool],
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.3, // Un peu de créativité pour la planification
      timeout: 300000, // 5 minutes
      maxRetries: 3,
    });

    this.registry = AgentRegistry.getInstance();

    // Enregistrer les outils d'orchestration dans le ToolRegistry
    this.registerOrchestratorTools();
  }

  /**
   * Enregistrer les outils d'orchestration dans le ToolRegistry
   */
  private registerOrchestratorTools(): void {
    const orchestratorHandlers: Record<string, ToolHandler> = {
      delegate_to_agent: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
        const result = await this.handleDelegateToAgent(input as {
          agent: AgentType;
          task: string;
          context?: Record<string, unknown>;
        });
        return { success: true, output: result };
      },

      create_subtasks: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
        const result = await this.handleCreateSubtasks(input as {
          tasks: Array<{
            agent: AgentType;
            description: string;
            dependsOn?: number[];
          }>;
          reasoning: string;
        });
        return { success: true, output: result };
      },

      get_agent_status: async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
        const result = await this.handleGetAgentStatus(input as { agent?: AgentType });
        return { success: true, output: result };
      },
    };

    this.registerTools(
      [DelegateToAgentTool, CreateSubtasksTool, GetAgentStatusTool],
      orchestratorHandlers,
      'orchestration'
    );

    this.log('info', 'Orchestrator tools registered in ToolRegistry');
  }

  /**
   * Implémentation du system prompt
   */
  getSystemPrompt(): string {
    // Enrichir le prompt avec les agents disponibles
    const availableAgents = this.registry
      .getAgentsInfo()
      .filter((a) => a.name !== 'orchestrator')
      .map((a) => `- ${a.name}: ${a.description} (status: ${a.status})`)
      .join('\n');

    return (
      ORCHESTRATOR_SYSTEM_PROMPT +
      `\n\n## Agents Actuellement Disponibles\n${availableAgents || 'Aucun agent disponible'}`
    );
  }

  /**
   * Exécution principale - Point d'entrée pour les demandes utilisateur
   */
  async execute(task: Task): Promise<TaskResult> {
    this.log('info', 'Orchestrator received task', {
      taskId: task.id,
      prompt: task.prompt.substring(0, 100) + '...',
    });

    try {
      // Analyser la demande et décider de l'action
      const decision = await this.analyzeAndDecide(task);

      this.log('info', 'Orchestration decision', {
        action: decision.action,
        targetAgent: decision.targetAgent,
        reasoning: decision.reasoning,
      });

      // Exécuter selon la décision
      switch (decision.action) {
        case 'delegate':
          return await this.executeDelegation(decision, task);

        case 'decompose':
          return await this.executeDecomposition(decision, task);

        case 'execute_directly':
          return {
            success: true,
            output: decision.response || 'Tâche complétée',
          };

        case 'ask_user':
          return {
            success: true,
            output: decision.question || 'Pouvez-vous préciser votre demande?',
            data: { needsClarification: true },
          };

        case 'complete':
          return {
            success: true,
            output: decision.response || 'Tâche terminée',
          };

        default:
          throw new Error(`Unknown decision action: ${decision.action}`);
      }
    } catch (error) {
      this.log('error', 'Orchestration failed', { error });
      throw error;
    }
  }

  /**
   * Définir la clé API pour les sous-agents
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  // executeToolHandler est hérité de BaseAgent et utilise le ToolRegistry

  // ============================================================================
  // MÉTHODES PRIVÉES
  // ============================================================================

  /**
   * Analyser la demande et décider de l'action
   */
  private async analyzeAndDecide(task: Task): Promise<OrchestrationDecision> {
    // Construire le prompt d'analyse
    const analysisPrompt = this.buildAnalysisPrompt(task);

    // Appeler le LLM pour la décision
    this.messageHistory = [{ role: 'user', content: analysisPrompt }];

    const response = await this.callLLM(this.messageHistory);

    // Parser la réponse pour extraire la décision
    return this.parseDecision(response);
  }

  /**
   * Construire le prompt d'analyse
   */
  private buildAnalysisPrompt(task: Task): string {
    const agentsInfo = Object.values(AGENT_CAPABILITIES)
      .map(
        (a) =>
          `### ${a.name}\n` +
          `Description: ${a.description}\n` +
          `Capacités: ${a.capabilities.join(', ')}\n` +
          `Limites: ${a.limitations.join(', ')}\n` +
          `Cas d'usage: ${a.useCases.join(', ')}`
      )
      .join('\n\n');

    return `Analyse cette demande et décide comment la traiter.

## Demande de l'utilisateur
${task.prompt}

## Contexte
${task.context ? JSON.stringify(task.context, null, 2) : 'Aucun contexte fourni'}

## Agents disponibles
${agentsInfo}

## Instructions
1. Analyse la demande
2. Détermine si elle nécessite un ou plusieurs agents
3. Utilise l'outil approprié:
   - delegate_to_agent: pour une tâche simple assignable à un agent
   - create_subtasks: pour une tâche complexe nécessitant plusieurs étapes
   - Réponds directement si c'est une question simple

Choisis la meilleure approche.`;
  }

  /**
   * Parser la décision du LLM
   */
  private parseDecision(response: Anthropic.Message): OrchestrationDecision {
    // Chercher les appels d'outils
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const input = block.input as Record<string, unknown>;

        if (block.name === 'delegate_to_agent') {
          return {
            action: 'delegate',
            targetAgent: input.agent as AgentType,
            reasoning: `Délégation à ${input.agent}: ${input.task}`,
          };
        }

        if (block.name === 'create_subtasks') {
          const tasks = input.tasks as Array<{
            agent: AgentType;
            description: string;
            dependsOn?: number[];
          }>;

          return {
            action: 'decompose',
            subTasks: tasks.map((t, idx) => ({
              type: t.agent,
              prompt: t.description,
              dependencies: t.dependsOn?.map((i) => `subtask-${i}`) || [],
              priority: tasks.length - idx,
            })),
            reasoning: input.reasoning as string,
          };
        }
      }
    }

    // Si pas d'outil appelé, c'est une réponse directe
    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      }
    }

    return {
      action: 'execute_directly',
      response: textContent,
      reasoning: 'Réponse directe sans délégation',
    };
  }

  /**
   * Exécuter une délégation à un agent
   */
  private async executeDelegation(
    decision: OrchestrationDecision,
    originalTask: Task
  ): Promise<TaskResult> {
    if (!decision.targetAgent) {
      throw new Error('No target agent specified for delegation');
    }

    const agent = this.registry.get(decision.targetAgent);

    if (!agent) {
      return {
        success: false,
        output: `Agent '${decision.targetAgent}' non disponible`,
        errors: [
          {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${decision.targetAgent} not found in registry`,
            recoverable: false,
          },
        ],
      };
    }

    if (!agent.isAvailable()) {
      return {
        success: false,
        output: `Agent '${decision.targetAgent}' est occupé`,
        errors: [
          {
            code: 'AGENT_BUSY',
            message: `Agent ${decision.targetAgent} is busy`,
            recoverable: true,
            suggestion: 'Attendre que l\'agent soit disponible',
          },
        ],
      };
    }

    // Créer la sous-tâche
    const subTask: Task = {
      id: `${originalTask.id}-${decision.targetAgent}-${Date.now()}`,
      type: decision.targetAgent,
      prompt: decision.reasoning,
      context: originalTask.context,
      status: 'pending',
      metadata: {
        parentTaskId: originalTask.id,
        source: 'orchestrator',
      },
      createdAt: new Date(),
    };

    this.log('info', `Delegating to ${decision.targetAgent}`, {
      subTaskId: subTask.id,
    });

    // Exécuter l'agent
    const result = await agent.run(subTask, this.apiKey);

    // Enrichir le résultat
    return {
      ...result,
      output: `[${decision.targetAgent}] ${result.output}`,
      data: {
        ...result.data,
        delegatedTo: decision.targetAgent,
        subTaskId: subTask.id,
      },
    };
  }

  /**
   * Exécuter une décomposition en sous-tâches avec exécution parallèle
   */
  private async executeDecomposition(
    decision: OrchestrationDecision,
    originalTask: Task
  ): Promise<TaskResult> {
    if (!decision.subTasks || decision.subTasks.length === 0) {
      return {
        success: false,
        output: 'Aucune sous-tâche définie',
        errors: [
          {
            code: 'NO_SUBTASKS',
            message: 'Decomposition produced no subtasks',
            recoverable: false,
          },
        ],
      };
    }

    this.log('info', `Decomposing into ${decision.subTasks.length} subtasks`, {
      subtasks: decision.subTasks.map((t) => t.type),
    });

    // Convertir les sous-tâches en format pour l'exécuteur parallèle
    const subtaskDefinitions: SubtaskDefinition[] = decision.subTasks.map((subTaskDef, i) => ({
      id: `${originalTask.id}-step-${i}`,
      agent: (subTaskDef.type || 'explore') as AgentType,
      task: {
        id: `${originalTask.id}-step-${i}`,
        type: subTaskDef.type || 'explore',
        prompt: subTaskDef.prompt,
        context: {
          ...originalTask.context,
        },
        status: 'pending' as const,
        metadata: {
          parentTaskId: originalTask.id,
          source: 'orchestrator' as const,
        },
        createdAt: new Date(),
      },
      // Convertir les indices en IDs de dépendances
      dependencies: subTaskDef.dependencies?.map((idx) => `${originalTask.id}-step-${idx}`),
    }));

    // Créer l'exécuteur parallèle
    const executor = createParallelExecutor({
      maxConcurrency: 3, // Limite de 3 agents en parallèle
      continueOnError: true, // Continuer même si une tâche échoue
      taskTimeout: 120000, // 2 minutes par tâche
      onProgress: (completed, total, current) => {
        this.log('debug', `Progress: ${completed}/${total}`, {
          subtaskId: current.id,
          success: current.success,
        });
        this.emitEvent('task:progress' as keyof import('../types').AgentEventMap, {
          completed,
          total,
          current: current.id,
        });
      },
      onLevelStart: (level, taskCount) => {
        this.log('info', `Starting level ${level} with ${taskCount} task(s)`);
      },
      onLevelComplete: (level, results) => {
        const successful = results.filter((r) => r.success).length;
        this.log('info', `Level ${level} complete: ${successful}/${results.length} successful`);
      },
    });

    // Exécuter avec le callback qui utilise le registry d'agents
    const results = await executor.execute(subtaskDefinitions, async (task, agentType) => {
      const agent = this.registry.get(agentType);

      if (!agent) {
        return {
          success: false,
          output: `Agent ${agentType} non disponible`,
          errors: [
            {
              code: 'AGENT_NOT_FOUND',
              message: `Agent ${agentType} not found in registry`,
              recoverable: false,
            },
          ],
        };
      }

      return agent.run(task, this.apiKey);
    });

    // Agréger les artefacts
    const artifacts: Artifact[] = [];

    for (const r of results) {
      if (r.result.artifacts) {
        artifacts.push(...r.result.artifacts);
      }
    }

    // Calculer les statistiques
    const stats = ParallelExecutor.calculateStats(results);

    // Grouper par niveau pour un meilleur affichage
    const byLevel = new Map<number, SubtaskResult[]>();

    for (const r of results) {
      const level = byLevel.get(r.level) || [];
      level.push(r);
      byLevel.set(r.level, level);
    }

    const combinedOutput = Array.from(byLevel.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, levelResults]) => {
        const levelOutput = levelResults.map((r) => `#### ${r.id}\n${r.result.output}`).join('\n\n');
        return `### Niveau ${level} (${levelResults.length} tâche(s), parallèle)\n${levelOutput}`;
      })
      .join('\n\n---\n\n');

    return {
      success: stats.failed === 0,
      output:
        `## Résultat de l'exécution parallèle (${stats.successful}/${stats.total} réussies)\n\n` +
        `**Niveaux d'exécution:** ${stats.levels}\n` +
        `**Efficacité parallèle:** ${stats.parallelEfficiency}x\n` +
        `**Temps total:** ${stats.totalTime}ms\n\n` +
        combinedOutput,
      artifacts,
      data: {
        subtaskResults: results,
        reasoning: decision.reasoning,
        executionStats: stats,
      },
    };
  }

  /**
   * Handler: Déléguer à un agent
   */
  private async handleDelegateToAgent(input: {
    agent: AgentType;
    task: string;
    context?: Record<string, unknown>;
  }): Promise<{ delegated: boolean; agent: string; task: string }> {
    // Ce handler est utilisé par le LLM pour signaler sa décision
    // L'exécution réelle se fait dans executeDelegation
    return {
      delegated: true,
      agent: input.agent,
      task: input.task,
    };
  }

  /**
   * Handler: Créer des sous-tâches
   */
  private async handleCreateSubtasks(input: {
    tasks: Array<{
      agent: AgentType;
      description: string;
      dependsOn?: number[];
    }>;
    reasoning: string;
  }): Promise<{ created: boolean; count: number; reasoning: string }> {
    return {
      created: true,
      count: input.tasks.length,
      reasoning: input.reasoning,
    };
  }

  /**
   * Handler: Obtenir le statut des agents
   */
  private async handleGetAgentStatus(input: {
    agent?: AgentType;
  }): Promise<unknown> {
    if (input.agent) {
      const agent = this.registry.get(input.agent);
      if (!agent) {
        return { error: `Agent ${input.agent} not found` };
      }
      return {
        name: input.agent,
        status: agent.getStatus(),
        description: agent.getDescription(),
        available: agent.isAvailable(),
      };
    }

    return this.registry.getAgentsInfo();
  }
}

// Type import pour parseDecision
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Factory pour créer l'orchestrateur
 */
export function createOrchestrator(): Orchestrator {
  return new Orchestrator();
}
