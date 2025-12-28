/**
 * Classificateur d'intentions pour les agents BAVINI
 *
 * Analyse les messages utilisateur pour déterminer l'intention et
 * recommander le mode approprié (Chat ou Agent).
 */

import type {
  IntentType,
  IntentClassification,
  ExtractedEntities,
  AgentMode,
} from './types';

// =============================================================================
// Intent Patterns
// =============================================================================

/**
 * Patterns de mots-clés pour chaque type d'intention
 * Note: Les patterns utilisent des caractères sans accents car le message
 * est normalisé (accents supprimés) avant le matching
 */
const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  debug: [
    /pourquoi\s+(ca\s+)?ne\s+(marche|fonctionne)\s+pas/i,
    /erreur|error|bug|probleme|problem/i,
    /ne\s+(marche|fonctionne)\s+(pas|plus)/i,
    /crash|plantage|plante/i,
    /debug|debogu/i,
    /ca\s+casse|casse/i,
    /echec|failed|failing/i,
  ],

  explain: [
    /comment\s+(ca\s+)?fonctionne/i,
    /explique(-moi)?|explain/i,
    /c'est\s+quoi|qu'est[- ]ce\s+que/i,
    /peux-tu\s+m'expliquer/i,
    /comprendre\s+comment/i,
    /decris|describe|fonctionnement/i,
    /quel\s+est\s+le\s+role/i,
  ],

  plan: [
    /je\s+(veux|voudrais|souhaite)\s+ajouter/i,
    /planifier|planifie|planning/i,
    /comment\s+(je\s+)?pourrais/i,
    /quelle\s+serait\s+la\s+meilleure\s+(facon|approche)/i,
    /strategie\s+pour/i,
    /architecture\s+pour/i,
    /roadmap|feuille\s+de\s+route/i,
  ],

  review: [
    /review|revue|revoir/i,
    /est[- ]ce\s+(que\s+)?(mon|le)\s+code\s+est\s+(bien|bon|correct)/i,
    /qualite\s+du\s+code/i,
    /ameliorer\s+(mon|le)\s+code/i,
    /bonnes\s+pratiques/i,
    /audit|evaluer|evalue/i,
    /optimiser|optimization/i,
  ],

  question: [
    /quelle\s+(est\s+la\s+)?meilleure\s+(lib|library|bibliotheque)/i,
    /quel\s+(est\s+le\s+)?meilleur\s+(outil|framework)/i,
    /recommandes?[- ]tu/i,
    /conseilles?[- ]tu/i,
    /difference\s+entre/i,
    /avantages?\s+(et\s+)?inconvenients?/i,
    /^\s*(qu'est[- ]ce|c'est\s+quoi|what\s+is)/i,
  ],

  create: [
    /cree|creer|create|genere|generer|generate/i,
    /ajoute|ajouter|add/i,
    /fais(-moi)?|faire|make/i,
    /construis|construire|build/i,
    /implemente|implementer|implement/i,
    /developpe|developper|develop/i,
    /nouveau|nouvelle|new/i,
    /code[rz]?|coding/i,
    /programme[rz]?|programming/i,
    /ecri[st]?|ecrire|write/i,
  ],

  modify: [
    /modifie|modifier|modify|change/i,
    /mets?\s+a\s+jour|update/i,
    /remplace|remplacer|replace/i,
    /edite|editer|edit/i,
    /transforme|transformer|transform/i,
    /adapte|adapter|adapt/i,
  ],

  fix: [
    /\b(corrige|corriger)\s+(le|la|les|ce|cette|l')/i,
    /\bfix\s+(le|la|les|the|this)/i,
    /repare|reparer/i,
    /resou[ds]|resoudre|solve|resolve/i,
    /\bpatch\b/i,
    /\bhotfix\b/i,
  ],

  refactor: [
    /refactor|refactoriser|refactorise/i,
    /restructure|restructurer/i,
    /reorganise|reorganiser|reorganize/i,
    /nettoie|nettoyer|clean\s*up/i,
    /simplifie|simplifier|simplify/i,
    /decoupe|decouper|split/i,
  ],

  unknown: [],
};

/**
 * Intents qui nécessitent le mode Agent
 */
const AGENT_MODE_INTENTS: IntentType[] = [
  'create',
  'modify',
  'fix',
  'refactor',
];

/**
 * Intents qui restent en mode Chat
 */
const CHAT_MODE_INTENTS: IntentType[] = [
  'debug',
  'explain',
  'plan',
  'review',
  'question',
];

// =============================================================================
// Entity Extraction Patterns
// =============================================================================

/**
 * Patterns pour extraire les entités du message
 */
const ENTITY_PATTERNS = {
  files: [
    /(?:fichier|file|dans)\s+[`"']?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)[`"']?/gi,
    /[`"']([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)[`"']/gi,
    /(\w+\.(tsx?|jsx?|json|css|scss|md|html|vue|svelte))/gi,
  ],

  components: [
    /(?:composant|component)\s+[`"']?(\w+)[`"']?/gi,
    /<(\w+)\s*\/?>|<\/(\w+)>/gi,
    /(?:le|la|un|une)\s+(\w+(?:Component|Button|Modal|Form|Card|List|Table|Input))/gi,
  ],

  technologies: [
    /\b(react|vue|angular|next\.?js|remix|express|node\.?js|typescript|javascript|tailwind|css|html|supabase|prisma|postgres|mongodb|graphql|rest|api)\b/gi,
  ],

  actions: [
    /\b(creer?|ajouter?|modifier?|supprimer?|corriger?|implementer?|developper?|construire?|deployer?|tester?|refactoriser?|optimiser?)\b/gi,
    /\b(create|add|modify|delete|fix|implement|develop|build|deploy|test|refactor|optimize)\b/gi,
  ],

  errors: [
    /erreur[:\s]+[`"']?([^`"'\n]+)[`"']?/gi,
    /error[:\s]+[`"']?([^`"'\n]+)[`"']?/gi,
    /TypeError|ReferenceError|SyntaxError|RangeError/gi,
    /cannot\s+read|undefined|null/gi,
  ],
};

// =============================================================================
// Intent Classifier
// =============================================================================

/**
 * Classe principale pour la classification des intentions
 */
export class IntentClassifier {
  /**
   * Classifie l'intention d'un message utilisateur
   */
  classify(message: string): IntentClassification {
    const normalizedMessage = this.normalizeMessage(message);
    const intentScores = this.calculateIntentScores(normalizedMessage);
    const topIntent = this.getTopIntent(intentScores);
    const entities = this.extractEntities(message);
    const recommendedMode = this.determineMode(topIntent.type, entities);

    return {
      type: topIntent.type,
      confidence: topIntent.confidence,
      entities,
      recommendedMode,
      reasoning: this.generateReasoning(topIntent.type, recommendedMode, entities),
    };
  }

  /**
   * Normalise le message pour l'analyse
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents for matching
      .trim();
  }

  /**
   * Calcule les scores pour chaque type d'intention
   */
  private calculateIntentScores(message: string): Map<IntentType, number> {
    const scores = new Map<IntentType, number>();

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (intent === 'unknown') continue;

      let score = 0;
      for (const pattern of patterns) {
        const matches = message.match(pattern);
        if (matches) {
          // Plus le pattern est spécifique (long), plus le score est élevé
          score += matches.length * (pattern.source.length / 20);
        }
      }

      scores.set(intent as IntentType, score);
    }

    return scores;
  }

  /**
   * Retourne l'intention avec le score le plus élevé
   */
  private getTopIntent(scores: Map<IntentType, number>): {
    type: IntentType;
    confidence: number;
  } {
    let maxScore = 0;
    let topIntent: IntentType = 'unknown';

    for (const [intent, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        topIntent = intent;
      }
    }

    // Calculer la confiance (0-1)
    // Score de 5+ = haute confiance
    const confidence = Math.min(maxScore / 5, 1);

    // Si aucun pattern n'a matché, retourner unknown
    if (maxScore === 0) {
      return { type: 'unknown', confidence: 0 };
    }

    return { type: topIntent, confidence };
  }

  /**
   * Extrait les entités du message
   */
  extractEntities(message: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      files: [],
      components: [],
      technologies: [],
      actions: [],
      errors: [],
    };

    // Extraire les fichiers
    for (const pattern of ENTITY_PATTERNS.files) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        const file = match[1] || match[0];
        if (file && !entities.files.includes(file)) {
          entities.files.push(file);
        }
      }
    }

    // Extraire les composants
    for (const pattern of ENTITY_PATTERNS.components) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        const component = match[1] || match[2] || match[0];
        if (component && !entities.components.includes(component)) {
          entities.components.push(component);
        }
      }
    }

    // Extraire les technologies
    for (const pattern of ENTITY_PATTERNS.technologies) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        const tech = match[1] || match[0];
        if (tech && !entities.technologies.includes(tech.toLowerCase())) {
          entities.technologies.push(tech.toLowerCase());
        }
      }
    }

    // Extraire les actions
    for (const pattern of ENTITY_PATTERNS.actions) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        const action = match[1] || match[0];
        if (action && !entities.actions.includes(action.toLowerCase())) {
          entities.actions.push(action.toLowerCase());
        }
      }
    }

    // Extraire les erreurs
    for (const pattern of ENTITY_PATTERNS.errors) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        const error = match[1] || match[0];
        if (error && !entities.errors.includes(error)) {
          entities.errors.push(error);
        }
      }
    }

    return entities;
  }

  /**
   * Détermine le mode recommandé basé sur l'intention
   */
  private determineMode(intent: IntentType, entities: ExtractedEntities): AgentMode {
    // Si l'intention est explicitement de type action
    if (AGENT_MODE_INTENTS.includes(intent)) {
      return 'agent';
    }

    // Si l'intention est de type analyse
    if (CHAT_MODE_INTENTS.includes(intent)) {
      return 'chat';
    }

    // Mode auto si l'intention est inconnue mais contient des actions
    if (entities.actions.length > 0) {
      return 'auto';
    }

    // Par défaut, mode chat pour analyser d'abord
    return 'chat';
  }

  /**
   * Génère une explication de la classification
   */
  private generateReasoning(
    intent: IntentType,
    mode: AgentMode,
    entities: ExtractedEntities
  ): string {
    const parts: string[] = [];

    // Intention détectée
    const intentLabels: Record<IntentType, string> = {
      debug: 'débogage',
      explain: 'explication',
      plan: 'planification',
      review: 'revue de code',
      question: 'question technique',
      create: 'création',
      modify: 'modification',
      fix: 'correction',
      refactor: 'refactorisation',
      unknown: 'indéterminée',
    };

    parts.push(`Intention détectée: ${intentLabels[intent]}`);

    // Entités trouvées
    if (entities.files.length > 0) {
      parts.push(`Fichiers: ${entities.files.join(', ')}`);
    }
    if (entities.components.length > 0) {
      parts.push(`Composants: ${entities.components.join(', ')}`);
    }
    if (entities.technologies.length > 0) {
      parts.push(`Technologies: ${entities.technologies.join(', ')}`);
    }

    // Mode recommandé
    const modeLabels: Record<AgentMode, string> = {
      chat: 'Chat Mode (analyse sans modification)',
      agent: 'Agent Mode (exécution avec validation)',
      auto: 'Auto (détection automatique)',
    };
    parts.push(`Mode recommandé: ${modeLabels[mode]}`);

    return parts.join('. ');
  }

  /**
   * Vérifie si un message nécessite une action (vs simple analyse)
   */
  requiresAction(message: string): boolean {
    const classification = this.classify(message);
    return AGENT_MODE_INTENTS.includes(classification.type);
  }

  /**
   * Vérifie si un message est une question ou demande d'explication
   */
  isQuestion(message: string): boolean {
    const classification = this.classify(message);
    return ['explain', 'question', 'review'].includes(classification.type);
  }

  /**
   * Vérifie si un message concerne du débogage
   */
  isDebug(message: string): boolean {
    const classification = this.classify(message);
    return classification.type === 'debug';
  }
}

// =============================================================================
// Factory & Singleton
// =============================================================================

let classifierInstance: IntentClassifier | null = null;

/**
 * Retourne une instance singleton du classifier
 */
export function getIntentClassifier(): IntentClassifier {
  if (!classifierInstance) {
    classifierInstance = new IntentClassifier();
  }
  return classifierInstance;
}

/**
 * Classifie directement un message (helper function)
 */
export function classifyIntent(message: string): IntentClassification {
  return getIntentClassifier().classify(message);
}

/**
 * Extrait les entités d'un message (helper function)
 */
export function extractEntities(message: string): ExtractedEntities {
  return getIntentClassifier().extractEntities(message);
}
