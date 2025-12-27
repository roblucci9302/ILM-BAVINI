/**
 * ChatModeAgent - Agent d'analyse en mode lecture seule
 *
 * Cet agent analyse le code et conseille l'utilisateur SANS modifier
 * le projet. Il peut lire les fichiers, analyser le code, expliquer
 * les erreurs et proposer des solutions.
 */

import { BaseAgent, type CodeAnalysis } from './BaseAgent';
import {
  IntentClassifier,
  classifyIntent,
} from './intent-classifier';
import type {
  ChatModeResponse,
  ChatResponseSections,
  ProposedAction,
  AgentContext,
  IntentClassification,
  IntentType,
  CreateFileDetails,
  ModifyFileDetails,
} from './types';
import { CHAT_MODE_CONFIG } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatModeAgent');

/**
 * Agent en mode Chat - Analyse sans modification
 *
 * Capacités:
 * - Lire et analyser le code existant
 * - Expliquer le fonctionnement du code
 * - Identifier les problèmes et erreurs
 * - Proposer des solutions (sans les implémenter)
 * - Planifier des fonctionnalités
 *
 * Restrictions:
 * - Ne peut PAS créer de fichiers
 * - Ne peut PAS modifier de fichiers
 * - Ne peut PAS exécuter de commandes
 * - Ne peut PAS installer de packages
 */
export class ChatModeAgent extends BaseAgent<ChatModeResponse> {
  private intentClassifier: IntentClassifier;

  constructor() {
    super(CHAT_MODE_CONFIG);
    this.intentClassifier = new IntentClassifier();
    logger.debug('ChatModeAgent initialized');
  }

  /**
   * Traite un message utilisateur et retourne une analyse
   */
  async process(userMessage: string): Promise<ChatModeResponse> {
    logger.debug('Processing message', { messageLength: userMessage.length });

    // 1. Classifier l'intention
    const intent = this.intentClassifier.classify(userMessage);
    logger.debug('Intent classified', { type: intent.type, confidence: intent.confidence });

    // 2. Collecter le contexte nécessaire
    const relevantContext = await this.gatherRelevantContext(intent);

    // 3. Analyser selon l'intention
    const analysis = await this.analyzeByIntent(intent, userMessage, relevantContext);

    // 4. Générer les actions proposées si applicable
    const proposedActions = this.generateProposedActions(intent, relevantContext);

    // 5. Construire la réponse
    const response: ChatModeResponse = {
      type: 'analysis',
      content: this.formatAnalysisContent(analysis),
      sections: analysis,
      suggestions: this.generateSuggestions(intent, analysis),
      canProceedToAgentMode: this.canProceedToAgentMode(intent),
      proposedActions,
    };

    logger.debug('Response generated', {
      suggestionsCount: response.suggestions.length,
      actionsCount: response.proposedActions.length,
    });

    return response;
  }

  /**
   * Retourne le prompt système pour le mode Chat
   */
  getSystemPrompt(): string {
    return CHAT_MODE_SYSTEM_PROMPT;
  }

  // ===========================================================================
  // Context Gathering
  // ===========================================================================

  /**
   * Collecte le contexte pertinent basé sur l'intention
   */
  private async gatherRelevantContext(
    intent: IntentClassification
  ): Promise<RelevantContext> {
    const context: RelevantContext = {
      files: [],
      techStack: [],
      errors: [],
      codeAnalysis: null,
    };

    if (!this.context) {
      logger.warn('No context available');
      return context;
    }

    // Récupérer les fichiers mentionnés
    for (const filePath of intent.entities.files) {
      const file = this.readFile(filePath);
      if (file) {
        context.files.push(file);
      }
    }

    // Si aucun fichier spécifique, chercher par composants mentionnés
    if (context.files.length === 0 && intent.entities.components.length > 0) {
      for (const component of intent.entities.components) {
        const pattern = new RegExp(`${component}`, 'i');
        const files = this.findFiles(pattern);
        context.files.push(...files.slice(0, 3)); // Limiter à 3 fichiers
      }
    }

    // Détecter la stack technique
    context.techStack = this.detectTechStack();

    // Récupérer les erreurs récentes si c'est du debug
    if (intent.type === 'debug') {
      context.errors = this.getRecentErrors();
    }

    // Analyser le code si nécessaire
    if (context.files.length > 0 && ['debug', 'review', 'explain'].includes(intent.type)) {
      const mainFile = context.files[0];
      context.codeAnalysis = await this.analyzeCode(mainFile.content);
    }

    return context;
  }

  // ===========================================================================
  // Analysis by Intent
  // ===========================================================================

  /**
   * Analyse selon le type d'intention
   */
  private async analyzeByIntent(
    intent: IntentClassification,
    userMessage: string,
    context: RelevantContext
  ): Promise<ChatResponseSections> {
    switch (intent.type) {
      case 'debug':
        return this.analyzeDebug(userMessage, context);
      case 'explain':
        return this.analyzeExplain(userMessage, context);
      case 'plan':
        return this.analyzePlan(userMessage, context);
      case 'review':
        return this.analyzeReview(userMessage, context);
      case 'question':
        return this.analyzeQuestion(userMessage, context);
      default:
        return this.analyzeGeneric(userMessage, context);
    }
  }

  /**
   * Analyse pour le débogage
   */
  private analyzeDebug(
    userMessage: string,
    context: RelevantContext
  ): ChatResponseSections {
    const sections: ChatResponseSections = {};

    // Analyse
    if (context.errors.length > 0) {
      const errorMessages = context.errors.map(e => `- ${e.type}: ${e.message}`).join('\n');
      sections.analysis = `J'ai détecté ${context.errors.length} erreur(s) récente(s):\n${errorMessages}`;
    } else if (context.files.length > 0) {
      sections.analysis = `J'analyse le fichier ${context.files[0].path}...`;
    } else {
      sections.analysis = `Je n'ai pas trouvé de fichiers ou d'erreurs spécifiques à analyser.`;
    }

    // Diagnostic
    if (context.codeAnalysis) {
      const issues: string[] = [];
      if (context.codeAnalysis.complexity === 'high') {
        issues.push('- Complexité élevée détectée');
      }
      if (context.codeAnalysis.hasErrors) {
        issues.push('- Présence de TODO/FIXME dans le code');
      }
      if (issues.length > 0) {
        sections.diagnostic = `Points d'attention:\n${issues.join('\n')}`;
      }
    }

    // Suggestions
    sections.suggestions = this.generateDebugSuggestions(context);

    // Prochaines étapes
    sections.nextSteps = 'Voulez-vous que je passe en mode Agent pour corriger ces problèmes ?';

    return sections;
  }

  /**
   * Analyse pour l'explication
   */
  private analyzeExplain(
    userMessage: string,
    context: RelevantContext
  ): ChatResponseSections {
    const sections: ChatResponseSections = {};

    if (context.files.length > 0) {
      const file = context.files[0];
      sections.analysis = `Le fichier \`${file.path}\` contient ${context.codeAnalysis?.lineCount || 'N/A'} lignes de code ${file.language}.`;

      if (context.codeAnalysis) {
        const details: string[] = [];
        if (context.codeAnalysis.hasTypeScript) {
          details.push('utilise TypeScript avec typage');
        }
        if (context.codeAnalysis.hasTests) {
          details.push('contient des tests');
        }
        details.push(`complexité ${context.codeAnalysis.complexity}`);

        sections.diagnostic = `Caractéristiques: ${details.join(', ')}.`;
      }
    } else {
      sections.analysis = 'Aucun fichier spécifique mentionné. Pouvez-vous préciser quel code vous souhaitez que j\'explique ?';
    }

    // Stack technique
    if (context.techStack.length > 0) {
      sections.suggestions = `Technologies détectées: ${context.techStack.join(', ')}`;
    }

    return sections;
  }

  /**
   * Analyse pour la planification
   */
  private analyzePlan(
    userMessage: string,
    context: RelevantContext
  ): ChatResponseSections {
    return {
      analysis: `Je comprends que vous souhaitez planifier une nouvelle fonctionnalité.`,
      suggestions: `Basé sur la stack technique (${context.techStack.join(', ') || 'non détectée'}), voici mes recommandations...`,
      nextSteps: 'Une fois le plan validé, je pourrai passer en mode Agent pour implémenter.',
    };
  }

  /**
   * Analyse pour la revue de code
   */
  private analyzeReview(
    userMessage: string,
    context: RelevantContext
  ): ChatResponseSections {
    const sections: ChatResponseSections = {};

    if (context.files.length > 0 && context.codeAnalysis) {
      sections.analysis = `Revue du fichier \`${context.files[0].path}\`:`;

      const issues: string[] = [];
      const positives: string[] = [];

      // Points positifs
      if (context.codeAnalysis.hasTypeScript) {
        positives.push('✅ TypeScript utilisé');
      }
      if (context.codeAnalysis.hasTests) {
        positives.push('✅ Tests présents');
      }
      if (context.codeAnalysis.complexity === 'low') {
        positives.push('✅ Complexité maîtrisée');
      }

      // Points à améliorer
      if (!context.codeAnalysis.hasTypeScript) {
        issues.push('⚠️ Pas de TypeScript détecté');
      }
      if (!context.codeAnalysis.hasTests) {
        issues.push('⚠️ Pas de tests détectés');
      }
      if (context.codeAnalysis.complexity === 'high') {
        issues.push('⚠️ Complexité élevée - envisager un refactoring');
      }
      if (context.codeAnalysis.lineCount > 100) {
        issues.push('⚠️ Fichier long - envisager de découper');
      }

      if (positives.length > 0) {
        sections.diagnostic = `Points positifs:\n${positives.join('\n')}`;
      }
      if (issues.length > 0) {
        sections.suggestions = `Points à améliorer:\n${issues.join('\n')}`;
      }
    } else {
      sections.analysis = 'Précisez quel fichier ou composant vous souhaitez que je review.';
    }

    return sections;
  }

  /**
   * Analyse pour les questions techniques
   */
  private analyzeQuestion(
    userMessage: string,
    context: RelevantContext
  ): ChatResponseSections {
    return {
      analysis: `Votre question concerne: ${context.techStack.length > 0 ? context.techStack.join(', ') : 'développement web'}`,
      nextSteps: 'N\'hésitez pas à me poser des questions plus spécifiques.',
    };
  }

  /**
   * Analyse générique
   */
  private analyzeGeneric(
    userMessage: string,
    context: RelevantContext
  ): ChatResponseSections {
    return {
      analysis: `J'ai analysé votre demande. ${context.files.length > 0 ? `${context.files.length} fichier(s) identifié(s).` : 'Aucun fichier spécifique identifié.'}`,
      nextSteps: 'Précisez votre demande ou passez en mode Agent pour des modifications.',
    };
  }

  // ===========================================================================
  // Suggestions & Actions
  // ===========================================================================

  /**
   * Génère des suggestions de débogage
   */
  private generateDebugSuggestions(context: RelevantContext): string {
    const suggestions: string[] = [];

    if (context.errors.length > 0) {
      suggestions.push('1. Vérifier les erreurs listées ci-dessus');
      suggestions.push('2. Ajouter des logs pour tracer le problème');
    }

    if (context.codeAnalysis?.complexity === 'high') {
      suggestions.push('3. Simplifier les fonctions complexes');
    }

    return suggestions.length > 0
      ? `Suggestions:\n${suggestions.join('\n')}`
      : 'Partagez plus de détails pour des suggestions ciblées.';
  }

  /**
   * Génère des suggestions basées sur l'intention
   */
  private generateSuggestions(
    intent: IntentClassification,
    analysis: ChatResponseSections
  ): string[] {
    const suggestions: string[] = [];

    switch (intent.type) {
      case 'debug':
        suggestions.push('Ajouter des logs de débogage');
        suggestions.push('Vérifier les types de données');
        suggestions.push('Tester avec des données simplifiées');
        break;
      case 'review':
        suggestions.push('Ajouter des tests unitaires');
        suggestions.push('Documenter les fonctions publiques');
        suggestions.push('Extraire les constantes magiques');
        break;
      case 'explain':
        suggestions.push('Ajouter des commentaires explicatifs');
        break;
      case 'plan':
        suggestions.push('Créer un plan d\'implémentation détaillé');
        suggestions.push('Identifier les dépendances');
        break;
    }

    return suggestions.slice(0, 5); // Maximum 5 suggestions
  }

  /**
   * Génère les actions proposées pour le mode Agent
   */
  private generateProposedActions(
    intent: IntentClassification,
    context: RelevantContext
  ): ProposedAction[] {
    const actions: ProposedAction[] = [];

    // Si c'est une intention d'action, proposer les modifications
    if (['create', 'modify', 'fix', 'refactor'].includes(intent.type)) {
      for (const file of intent.entities.files) {
        actions.push({
          id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: intent.type === 'create' ? 'create_file' : 'modify_file',
          description: `${intent.type === 'create' ? 'Créer' : 'Modifier'} ${file}`,
          details: {
            type: intent.type === 'create' ? 'create_file' : 'modify_file',
            path: file,
            ...(intent.type === 'create'
              ? { content: '', language: this.detectLanguage(file) }
              : { changes: [] }),
          } as CreateFileDetails | ModifyFileDetails,
          risk: 'low',
          reversible: true,
        });
      }
    }

    // Si des tests manquent, proposer de les créer
    if (context.codeAnalysis && !context.codeAnalysis.hasTests) {
      for (const file of context.files) {
        if (!file.path.includes('.spec.') && !file.path.includes('.test.')) {
          const testPath = file.path.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1');
          actions.push({
            id: `action-test-${Date.now()}`,
            type: 'create_file',
            description: `Créer les tests pour ${file.path}`,
            details: {
              type: 'create_file',
              path: testPath,
              content: '',
              language: 'typescript',
            },
            risk: 'low',
            reversible: true,
          });
        }
      }
    }

    return actions;
  }

  /**
   * Détecte le langage d'un fichier par son extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      css: 'css',
      scss: 'scss',
      html: 'html',
      md: 'markdown',
    };
    return langMap[ext] || 'text';
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Vérifie si on peut passer en mode Agent
   */
  private canProceedToAgentMode(intent: IntentClassification): boolean {
    // On peut passer en Agent mode si l'intention suggère des modifications
    return ['create', 'modify', 'fix', 'refactor'].includes(intent.type) ||
           intent.entities.actions.length > 0;
  }

  /**
   * Formate le contenu de l'analyse en texte
   */
  private formatAnalysisContent(sections: ChatResponseSections): string {
    const parts: string[] = [];

    if (sections.analysis) {
      parts.push(`## Analyse\n${sections.analysis}`);
    }
    if (sections.diagnostic) {
      parts.push(`## Diagnostic\n${sections.diagnostic}`);
    }
    if (sections.suggestions) {
      parts.push(`## Suggestions\n${sections.suggestions}`);
    }
    if (sections.nextSteps) {
      parts.push(`## Prochaines étapes\n${sections.nextSteps}`);
    }

    return parts.join('\n\n');
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Classifie l'intention d'un message
   */
  classifyMessage(message: string): IntentClassification {
    return this.intentClassifier.classify(message);
  }

  /**
   * Vérifie si un message nécessite le mode Agent
   */
  requiresAgentMode(message: string): boolean {
    return this.intentClassifier.requiresAction(message);
  }
}

// =============================================================================
// Types locaux
// =============================================================================

interface RelevantContext {
  files: Array<{ path: string; content: string; language: string }>;
  techStack: string[];
  errors: Array<{ type: string; message: string }>;
  codeAnalysis: CodeAnalysis | null;
}

// =============================================================================
// Chat Mode System Prompt
// =============================================================================

export const CHAT_MODE_SYSTEM_PROMPT = `
Tu es BAVINI en MODE CHAT. Dans ce mode, tu analyses et conseilles SANS modifier le projet.

## Ce que tu PEUX faire:
- Lire et analyser le code existant
- Expliquer le fonctionnement d'une partie du code
- Identifier les problèmes et erreurs potentielles
- Proposer des solutions (sans les implémenter)
- Planifier des fonctionnalités futures
- Répondre aux questions techniques
- Faire des revues de code

## Ce que tu ne PEUX PAS faire:
- Créer ou modifier des fichiers
- Exécuter des commandes shell
- Installer des packages
- Faire des changements au projet

## Format de réponse:

### 1. Analyse
Décris ce que tu observes dans le code ou la situation.

### 2. Diagnostic (si applicable)
Explique ce qui cause le problème ou ce qui pourrait être amélioré.

### 3. Suggestions
Liste les actions possibles pour résoudre ou améliorer.

### 4. Prochaine étape
Propose de passer en mode Agent si des modifications sont nécessaires:
"Voulez-vous que je passe en mode Agent pour implémenter ces changements ?"

## Règles importantes:
- Réponds TOUJOURS en français
- Sois concis mais complet
- Utilise des exemples de code pour illustrer (sans les appliquer)
- Ne fais JAMAIS de modifications, même si l'utilisateur insiste
- Si l'utilisateur demande une modification, explique et propose le mode Agent
`;
