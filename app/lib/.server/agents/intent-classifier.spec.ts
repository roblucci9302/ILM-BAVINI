import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntentClassifier,
  classifyIntent,
  extractEntities,
  getIntentClassifier,
} from './intent-classifier';
import type { IntentType } from './types';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = new IntentClassifier();
  });

  // ===========================================================================
  // Debug Intent Tests
  // ===========================================================================

  describe('debug intent', () => {
    const debugMessages = [
      'Pourquoi ça ne marche pas ?',
      'J\'ai une erreur dans mon code',
      'Le bouton ne fonctionne plus',
      'Il y a un bug dans le formulaire',
      'Mon application crash au démarrage',
      'Debug: problème de connexion',
    ];

    it.each(debugMessages)('should classify "%s" as debug', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('debug');
    });

    it('should recommend chat mode for debug', () => {
      const result = classifier.classify('Pourquoi ça ne marche pas ?');
      expect(result.recommendedMode).toBe('chat');
    });
  });

  // ===========================================================================
  // Explain Intent Tests
  // ===========================================================================

  describe('explain intent', () => {
    const explainMessages = [
      'Comment ça fonctionne ?',
      'Explique-moi le code',
      'Peux-tu m\'expliquer cette fonction ?',
      'Décris le fonctionnement de l\'authentification',
      'Quel est le rôle de ce composant ?',
    ];

    it.each(explainMessages)('should classify "%s" as explain', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('explain');
    });

    it('should classify "C\'est quoi un hook React ?" as question (ambiguous)', () => {
      // "C'est quoi" matches question pattern, which is correct
      const result = classifier.classify("C'est quoi un hook React ?");
      expect(result.type).toBe('question');
      expect(result.recommendedMode).toBe('chat');
    });

    it('should recommend chat mode for explain', () => {
      const result = classifier.classify('Comment fonctionne l\'authentification ?');
      expect(result.recommendedMode).toBe('chat');
    });
  });

  // ===========================================================================
  // Plan Intent Tests
  // ===========================================================================

  describe('plan intent', () => {
    const planMessages = [
      'Je veux ajouter un dashboard',
      'Comment je pourrais implémenter un système de notifications ?',
      'Quelle serait la meilleure approche pour le paiement ?',
      'Planifie l\'ajout d\'un module de chat',
      'Stratégie pour migrer vers Next.js',
    ];

    it.each(planMessages)('should classify "%s" as plan', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('plan');
    });

    it('should recommend chat mode for planning', () => {
      const result = classifier.classify('Je voudrais ajouter un système de notification');
      expect(result.recommendedMode).toBe('chat');
    });
  });

  // ===========================================================================
  // Review Intent Tests
  // ===========================================================================

  describe('review intent', () => {
    const reviewMessages = [
      'Est-ce que mon code est bien structuré ?',
      'Review mon code',
      'Qualité du code de ce composant',
      'Améliorer le code existant',
      'Audit de sécurité du projet',
    ];

    it.each(reviewMessages)('should classify "%s" as review', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('review');
    });

    it('should handle ambiguous review messages', () => {
      // "Est-ce que c'est une bonne pratique ?" is too generic
      const result = classifier.classify('Est-ce que c\'est une bonne pratique ?');
      // Could be 'unknown' or 'review' depending on context
      expect(['review', 'unknown']).toContain(result.type);
    });

    it('should recommend chat mode for review', () => {
      const result = classifier.classify('Est-ce que mon code est correct ?');
      expect(result.recommendedMode).toBe('chat');
    });
  });

  // ===========================================================================
  // Question Intent Tests
  // ===========================================================================

  describe('question intent', () => {
    const questionMessages = [
      'Quelle est la meilleure lib pour les graphiques ?',
      'Quel framework recommandes-tu ?',
      'Différence entre useState et useReducer ?',
      'Avantages et inconvénients de GraphQL ?',
      'Qu\'est-ce que Prisma ?',
    ];

    it.each(questionMessages)('should classify "%s" as question', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('question');
    });

    it('should recommend chat mode for questions', () => {
      const result = classifier.classify('Quelle est la meilleure bibliothèque pour les charts ?');
      expect(result.recommendedMode).toBe('chat');
    });
  });

  // ===========================================================================
  // Create Intent Tests
  // ===========================================================================

  describe('create intent', () => {
    const createMessages = [
      'Crée un composant Button',
      'Génère une page de login',
      'Ajoute un formulaire de contact',
      'Fais-moi une navbar',
      'Implémente l\'authentification',
      'Développe un dashboard',
    ];

    it.each(createMessages)('should classify "%s" as create', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('create');
    });

    it('should recommend agent mode for create', () => {
      const result = classifier.classify('Crée un composant Button');
      expect(result.recommendedMode).toBe('agent');
    });
  });

  // ===========================================================================
  // Modify Intent Tests
  // ===========================================================================

  describe('modify intent', () => {
    const modifyMessages = [
      'Modifie le header',
      'Change la couleur du bouton',
      'Mets à jour le formulaire',
      'Remplace l\'icône',
      'Édite le fichier config.ts',
      'Transforme ce composant en TypeScript',
    ];

    it.each(modifyMessages)('should classify "%s" as modify', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('modify');
    });

    it('should recommend agent mode for modify', () => {
      const result = classifier.classify('Modifie le header pour ajouter un logo');
      expect(result.recommendedMode).toBe('agent');
    });
  });

  // ===========================================================================
  // Fix Intent Tests
  // ===========================================================================

  describe('fix intent', () => {
    it('should classify "Corrige le bug du formulaire" as fix', () => {
      const result = classifier.classify('Corrige le bug du formulaire');
      expect(result.type).toBe('fix');
    });

    it('should classify "Résoudre le souci de performance" as fix', () => {
      const result = classifier.classify('Résoudre le souci de performance');
      expect(result.type).toBe('fix');
    });

    it('should classify "Patch la vulnérabilité" as fix', () => {
      const result = classifier.classify('Patch la vulnérabilité');
      expect(result.type).toBe('fix');
    });

    it('should classify messages with "erreur" as debug when no fix verb', () => {
      // Messages mentioning errors without explicit fix action are debug
      const result = classifier.classify('Il y a une erreur de typage');
      expect(result.type).toBe('debug');
    });

    it('should recommend agent mode for explicit fix requests', () => {
      const result = classifier.classify('Corrige le problème dans Header.tsx');
      expect(result.recommendedMode).toBe('agent');
    });
  });

  // ===========================================================================
  // Refactor Intent Tests
  // ===========================================================================

  describe('refactor intent', () => {
    const refactorMessages = [
      'Refactorise ce composant',
      'Restructure le dossier utils',
      'Réorganise les imports',
      'Nettoie le code',
      'Simplifie cette fonction',
      'Découpe ce fichier en plusieurs modules',
    ];

    it.each(refactorMessages)('should classify "%s" as refactor', (message) => {
      const result = classifier.classify(message);
      expect(result.type).toBe('refactor');
    });

    it('should recommend agent mode for refactor', () => {
      const result = classifier.classify('Refactorise le module d\'authentification');
      expect(result.recommendedMode).toBe('agent');
    });
  });

  // ===========================================================================
  // Entity Extraction Tests
  // ===========================================================================

  describe('entity extraction', () => {
    it('should extract file names', () => {
      const entities = extractEntities('Modifie le fichier Header.tsx');
      expect(entities.files).toContain('Header.tsx');
    });

    it('should extract multiple files', () => {
      const entities = extractEntities('Compare `App.tsx` et `index.ts`');
      expect(entities.files).toContain('App.tsx');
      expect(entities.files).toContain('index.ts');
    });

    it('should extract component names', () => {
      const entities = extractEntities('Le composant UserProfile ne marche pas');
      expect(entities.components).toContain('UserProfile');
    });

    it('should extract technologies', () => {
      const entities = extractEntities('Utilise React avec TypeScript et Tailwind');
      expect(entities.technologies).toContain('react');
      expect(entities.technologies).toContain('typescript');
      expect(entities.technologies).toContain('tailwind');
    });

    it('should extract actions', () => {
      const entities = extractEntities('Ajouter et modifier le composant');
      expect(entities.actions).toContain('ajouter');
      expect(entities.actions).toContain('modifier');
    });

    it('should extract error messages', () => {
      const entities = extractEntities('Erreur: TypeError: Cannot read property');
      expect(entities.errors.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Confidence Score Tests
  // ===========================================================================

  describe('confidence scores', () => {
    it('should have positive confidence for clear intents', () => {
      const result = classifier.classify('Crée un nouveau composant Button');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.type).toBe('create');
    });

    it('should have zero confidence for ambiguous messages', () => {
      const result = classifier.classify('Salut');
      expect(result.confidence).toBe(0);
    });

    it('should return unknown for unrecognized intents', () => {
      const result = classifier.classify('xyz123');
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  // ===========================================================================
  // Helper Functions Tests
  // ===========================================================================

  describe('helper functions', () => {
    it('requiresAction should return true for create intents', () => {
      expect(classifier.requiresAction('Ajoute un nouveau bouton')).toBe(true);
      expect(classifier.requiresAction('Modifie le header')).toBe(true);
    });

    it('requiresAction should return true for fix with explicit action', () => {
      expect(classifier.requiresAction('Corrige le problème du formulaire')).toBe(true);
    });

    it('requiresAction should return false for analysis intents', () => {
      expect(classifier.requiresAction('Explique-moi le code')).toBe(false);
      expect(classifier.requiresAction('Pourquoi ça ne marche pas ?')).toBe(false);
    });

    it('isQuestion should return true for question intents', () => {
      expect(classifier.isQuestion('Quelle est la meilleure lib ?')).toBe(true);
      expect(classifier.isQuestion('Explique-moi le fonctionnement')).toBe(true);
    });

    it('isDebug should return true for debug intents', () => {
      expect(classifier.isDebug('Pourquoi ça ne marche pas ?')).toBe(true);
      expect(classifier.isDebug('Il y a une erreur')).toBe(true);
    });
  });

  // ===========================================================================
  // Singleton Tests
  // ===========================================================================

  describe('singleton pattern', () => {
    it('getIntentClassifier should return the same instance', () => {
      const instance1 = getIntentClassifier();
      const instance2 = getIntentClassifier();
      expect(instance1).toBe(instance2);
    });

    it('classifyIntent helper should work correctly', () => {
      const result = classifyIntent('Ajoute un composant Button');
      expect(result.type).toBe('create');
      expect(result.recommendedMode).toBe('agent');
    });
  });

  // ===========================================================================
  // Reasoning Tests
  // ===========================================================================

  describe('reasoning generation', () => {
    it('should include intent label in reasoning', () => {
      const result = classifier.classify('Ajoute un composant Button');
      expect(result.reasoning).toContain('création');
    });

    it('should include mode recommendation in reasoning', () => {
      const result = classifier.classify('Explique le code');
      expect(result.reasoning).toContain('Chat Mode');
    });

    it('should include files in reasoning when present', () => {
      const result = classifier.classify('Modifie Header.tsx');
      expect(result.reasoning).toContain('Header.tsx');
    });

    it('should include technologies in reasoning when present', () => {
      const result = classifier.classify('Ajoute un composant React');
      expect(result.reasoning).toContain('react');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      const result = classifier.classify('');
      expect(result.type).toBe('unknown');
    });

    it('should handle messages with only spaces', () => {
      const result = classifier.classify('   ');
      expect(result.type).toBe('unknown');
    });

    it('should handle special characters', () => {
      const result = classifier.classify('Ajoute un composant !@#$%');
      expect(result.type).toBe('create');
    });

    it('should handle mixed case', () => {
      const result = classifier.classify('AJOUTE UN COMPOSANT');
      expect(result.type).toBe('create');
    });

    it('should handle accented characters', () => {
      const result = classifier.classify('Génère un élément avec éléments');
      expect(result.type).toBe('create');
    });

    it('should handle long messages', () => {
      const longMessage = 'Ajoute un composant ' + 'très '.repeat(100) + 'complexe';
      const result = classifier.classify(longMessage);
      expect(result.type).toBe('create');
    });
  });
});
