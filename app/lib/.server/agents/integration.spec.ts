/**
 * Tests d'intégration pour le système d'agents Sprint 1
 *
 * Vérifie que toutes les fonctionnalités sont 100% fonctionnelles
 * et correctement intégrées.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Types
  type AgentCapability,
  type AgentMode,
  type IntentType,
  type AgentConfig,
  type AgentContext,
  type ProjectFile,

  // Configurations
  CHAT_MODE_CONFIG,
  AGENT_MODE_CONFIG,

  // Classes
  BaseAgent,
  AgentRestrictionError,
  AgentCapabilityError,
  IntentClassifier,

  // Fonctions
  classifyIntent,
  extractEntities,
  getIntentClassifier,
} from './index';

describe('Sprint 1 Integration Tests', () => {
  // ===========================================================================
  // Configuration Tests
  // ===========================================================================

  describe('Agent Configurations', () => {
    it('CHAT_MODE_CONFIG should have correct structure', () => {
      expect(CHAT_MODE_CONFIG.mode).toBe('chat');
      expect(CHAT_MODE_CONFIG.capabilities).toContain('read_files');
      expect(CHAT_MODE_CONFIG.capabilities).toContain('analyze_code');
      expect(CHAT_MODE_CONFIG.restrictions).toContain('create_files');
      expect(CHAT_MODE_CONFIG.restrictions).toContain('modify_files');
      expect(CHAT_MODE_CONFIG.language).toBe('fr');
    });

    it('AGENT_MODE_CONFIG should have all capabilities', () => {
      expect(AGENT_MODE_CONFIG.mode).toBe('agent');
      expect(AGENT_MODE_CONFIG.capabilities).toContain('create_files');
      expect(AGENT_MODE_CONFIG.capabilities).toContain('modify_files');
      expect(AGENT_MODE_CONFIG.capabilities).toContain('execute_shell');
      expect(AGENT_MODE_CONFIG.restrictions).toHaveLength(0);
    });

    it('Chat mode should restrict actions that Agent mode allows', () => {
      const chatRestrictions = CHAT_MODE_CONFIG.restrictions;
      const agentCapabilities = AGENT_MODE_CONFIG.capabilities;

      // Toutes les restrictions du chat mode doivent être des capacités du agent mode
      for (const restriction of chatRestrictions) {
        expect(agentCapabilities).toContain(restriction);
      }
    });
  });

  // ===========================================================================
  // BaseAgent Tests
  // ===========================================================================

  describe('BaseAgent', () => {
    // Créer une implémentation concrète pour les tests
    class TestAgent extends BaseAgent<string> {
      async process(userMessage: string): Promise<string> {
        return `Processed: ${userMessage}`;
      }

      getSystemPrompt(): string {
        return 'Test system prompt';
      }

      // Exposer les méthodes protégées pour les tests
      public testReadFile(path: string) {
        return this.readFile(path);
      }

      public testFindFiles(pattern: RegExp) {
        return this.findFiles(pattern);
      }

      public testAnalyzeCode(content: string) {
        return this.analyzeCode(content);
      }

      public testDetectTechStack() {
        return this.detectTechStack();
      }
    }

    let chatAgent: TestAgent;
    let agentModeAgent: TestAgent;

    beforeEach(() => {
      chatAgent = new TestAgent(CHAT_MODE_CONFIG);
      agentModeAgent = new TestAgent(AGENT_MODE_CONFIG);
    });

    it('should respect capabilities', () => {
      expect(chatAgent.hasCapability('read_files')).toBe(true);
      expect(chatAgent.hasCapability('create_files')).toBe(false);
      expect(agentModeAgent.hasCapability('create_files')).toBe(true);
    });

    it('should respect restrictions', () => {
      expect(chatAgent.isRestricted('create_files')).toBe(true);
      expect(chatAgent.isRestricted('read_files')).toBe(false);
      expect(agentModeAgent.isRestricted('create_files')).toBe(false);
    });

    it('should process messages', async () => {
      const result = await chatAgent.process('Test message');
      expect(result).toBe('Processed: Test message');
    });

    it('should set and get context', () => {
      const context: AgentContext = {
        files: [{ path: 'test.ts', content: 'code', language: 'typescript' }],
        messageHistory: [],
        projectState: {
          isBuilding: false,
          hasErrors: false,
          fileCount: 1,
          techStack: ['TypeScript'],
        },
        recentErrors: [],
        recentLogs: [],
      };

      chatAgent.setContext(context);
      expect(chatAgent.getContext()).toEqual(context);
    });

    it('should read files from context', () => {
      const context: AgentContext = {
        files: [
          { path: 'src/App.tsx', content: 'React code', language: 'tsx' },
          { path: 'src/utils.ts', content: 'Utils', language: 'ts' },
        ],
        messageHistory: [],
        projectState: {
          isBuilding: false,
          hasErrors: false,
          fileCount: 2,
          techStack: [],
        },
        recentErrors: [],
        recentLogs: [],
      };

      chatAgent.setContext(context);

      const file = chatAgent.testReadFile('src/App.tsx');
      expect(file).toBeDefined();
      expect(file?.content).toBe('React code');
    });

    it('should find files by pattern', () => {
      const context: AgentContext = {
        files: [
          { path: 'src/App.tsx', content: '', language: 'tsx' },
          { path: 'src/Header.tsx', content: '', language: 'tsx' },
          { path: 'src/utils.ts', content: '', language: 'ts' },
        ],
        messageHistory: [],
        projectState: {
          isBuilding: false,
          hasErrors: false,
          fileCount: 3,
          techStack: [],
        },
        recentErrors: [],
        recentLogs: [],
      };

      chatAgent.setContext(context);

      const tsxFiles = chatAgent.testFindFiles(/\.tsx$/);
      expect(tsxFiles).toHaveLength(2);
    });

    it('should analyze code correctly', async () => {
      chatAgent.setContext({
        files: [],
        messageHistory: [],
        projectState: {
          isBuilding: false,
          hasErrors: false,
          fileCount: 0,
          techStack: [],
        },
        recentErrors: [],
        recentLogs: [],
      });

      const code = `
        interface User {
          name: string;
        }

        function getUser(): User {
          if (condition) {
            return { name: 'test' };
          }
          return { name: 'default' };
        }
      `;

      const analysis = await chatAgent.testAnalyzeCode(code);
      expect(analysis.hasTypeScript).toBe(true);
      expect(analysis.lineCount).toBeGreaterThan(0);
      expect(analysis.complexity).toBe('low');
    });

    it('should detect tech stack from package.json', () => {
      const context: AgentContext = {
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              dependencies: {
                react: '^18.0.0',
                tailwindcss: '^3.0.0',
              },
              devDependencies: {
                typescript: '^5.0.0',
              },
            }),
            language: 'json',
          },
        ],
        messageHistory: [],
        projectState: {
          isBuilding: false,
          hasErrors: false,
          fileCount: 1,
          techStack: [],
        },
        recentErrors: [],
        recentLogs: [],
      };

      chatAgent.setContext(context);

      const stack = chatAgent.testDetectTechStack();
      expect(stack).toContain('React');
      expect(stack).toContain('Tailwind CSS');
    });
  });

  // ===========================================================================
  // Intent Classifier Integration
  // ===========================================================================

  describe('Intent Classification Flow', () => {
    let classifier: IntentClassifier;

    beforeEach(() => {
      classifier = new IntentClassifier();
    });

    it('should provide complete classification', () => {
      const result = classifier.classify('Ajoute un composant React dans Header.tsx');

      // Vérifier la structure complète
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('recommendedMode');
      expect(result).toHaveProperty('reasoning');

      // Vérifier les valeurs
      expect(result.type).toBe('create');
      expect(result.recommendedMode).toBe('agent');
      expect(result.entities.files).toContain('Header.tsx');
      expect(result.entities.technologies).toContain('react');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should maintain singleton pattern', () => {
      const instance1 = getIntentClassifier();
      const instance2 = getIntentClassifier();
      expect(instance1).toBe(instance2);
    });

    it('should handle French accents correctly', () => {
      const messages = [
        { msg: 'Génère une page', expected: 'create' },
        { msg: 'Réorganise les fichiers', expected: 'refactor' },
        { msg: 'Ajoute un élément', expected: 'create' },
      ];

      messages.forEach(({ msg, expected }) => {
        const result = classifier.classify(msg);
        expect(result.type).toBe(expected);
      });
    });
  });

  // ===========================================================================
  // Entity Extraction
  // ===========================================================================

  describe('Entity Extraction', () => {
    it('should extract all entity types', () => {
      const message =
        'Modifie le composant UserCard dans Header.tsx avec React et TypeScript pour corriger le bug';

      const entities = extractEntities(message);

      expect(entities.files.length).toBeGreaterThan(0);
      expect(entities.technologies).toContain('react');
      expect(entities.technologies).toContain('typescript');
      // Note: le pattern extrait la forme conjuguée 'modifie' pas l'infinitif
      expect(entities.actions).toContain('modifie');
      expect(entities.actions).toContain('corriger');
    });

    it('should handle empty message', () => {
      const entities = extractEntities('');
      expect(entities.files).toHaveLength(0);
      expect(entities.technologies).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('AgentRestrictionError should be properly typed', () => {
      const error = new AgentRestrictionError('Test restriction');
      expect(error.name).toBe('AgentRestrictionError');
      expect(error.message).toBe('Test restriction');
      expect(error instanceof Error).toBe(true);
    });

    it('AgentCapabilityError should be properly typed', () => {
      const error = new AgentCapabilityError('Test capability');
      expect(error.name).toBe('AgentCapabilityError');
      expect(error.message).toBe('Test capability');
      expect(error instanceof Error).toBe(true);
    });
  });

  // ===========================================================================
  // Mode Recommendation Logic
  // ===========================================================================

  describe('Mode Recommendation', () => {
    const classifier = new IntentClassifier();

    it('should recommend chat mode for analysis intents', () => {
      const analysisMessages = [
        'Pourquoi ce bug apparaît ?',
        'Explique-moi ce code',
        'Review mon travail',
        'Quelle est la meilleure approche ?',
      ];

      analysisMessages.forEach((msg) => {
        const result = classifier.classify(msg);
        expect(result.recommendedMode).toBe('chat');
      });
    });

    it('should recommend agent mode for action intents', () => {
      const actionMessages = [
        'Ajoute un composant',
        'Modifie le fichier',
        'Corrige le bug du formulaire',
        'Refactorise cette fonction',
      ];

      actionMessages.forEach((msg) => {
        const result = classifier.classify(msg);
        expect(result.recommendedMode).toBe('agent');
      });
    });
  });
});
