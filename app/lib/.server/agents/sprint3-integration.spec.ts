/**
 * Tests d'intégration Sprint 3 - AgentModeAgent & ActionExecutor
 *
 * Vérifie l'intégration complète du mode Agent incluant:
 * - AgentModeAgent avec BaseAgent et IntentClassifier
 * - ActionExecutor avec tous les types d'actions
 * - Système de rollback
 * - Intégration avec le store et les prompts
 * - Flow complet d'exécution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Sprint 1 exports
  BaseAgent,
  IntentClassifier,
  classifyIntent,
  CHAT_MODE_CONFIG,
  AGENT_MODE_CONFIG,
  type AgentContext,
  type IntentClassification,

  // Sprint 2 exports
  ChatModeAgent,
  CHAT_MODE_SYSTEM_PROMPT,

  // Sprint 3 exports
  AgentModeAgent,
  AGENT_MODE_SYSTEM_PROMPT,
  ActionExecutor,
  createActionExecutor,
  type ProposedAction,
  type ExecutionPlan,
  type PlanEstimates,
  type RollbackData,
} from './index';

import {
  chatStore,
  setChatMode,
  getChatMode,
  setPendingActions,
  clearPendingActions,
  approveAgentMode,
  rejectAgentMode,
} from '~/lib/stores/chat';

import {
  getSystemPromptForMode,
} from '~/lib/.server/llm/prompts';

describe('Sprint 3 Integration Tests', () => {
  // ===========================================================================
  // AgentModeAgent + BaseAgent Integration
  // ===========================================================================

  describe('AgentModeAgent extends BaseAgent', () => {
    let agent: AgentModeAgent;

    beforeEach(() => {
      agent = new AgentModeAgent({ dryRun: true });
    });

    it('should inherit all BaseAgent capabilities', () => {
      // AgentModeAgent devrait avoir toutes les capacités
      expect(agent.hasCapability('read_files')).toBe(true);
      expect(agent.hasCapability('analyze_code')).toBe(true);
      expect(agent.hasCapability('create_files')).toBe(true);
      expect(agent.hasCapability('modify_files')).toBe(true);
      expect(agent.hasCapability('execute_shell')).toBe(true);
      expect(agent.hasCapability('install_packages')).toBe(true);
    });

    it('should have no restrictions', () => {
      expect(agent.isRestricted('create_files')).toBe(false);
      expect(agent.isRestricted('modify_files')).toBe(false);
      expect(agent.isRestricted('execute_shell')).toBe(false);
    });

    it('should use context like BaseAgent', () => {
      const context = createTestContext();
      agent.setContext(context);
      expect(agent.getContext()).toEqual(context);
    });

    it('should return AgentModeResponse from process', async () => {
      const context = createTestContext();
      agent.setContext(context);

      const response = await agent.process('Crée un composant Button');

      expect(response.type).toBe('plan');
      expect(response.status).toBe('awaiting_approval');
      expect(response.plan).toBeDefined();
    });
  });

  // ===========================================================================
  // AgentModeAgent + IntentClassifier Integration
  // ===========================================================================

  describe('AgentModeAgent uses IntentClassifier', () => {
    let agent: AgentModeAgent;

    beforeEach(() => {
      agent = new AgentModeAgent({ dryRun: true });
    });

    it('should classify action intents correctly', () => {
      expect(agent.classifyMessage('Crée un fichier').type).toBe('create');
      expect(agent.classifyMessage('Modifie App.tsx').type).toBe('modify');
      expect(agent.classifyMessage('Corrige ce bug').type).toBe('fix');
      expect(agent.classifyMessage('Refactoriser le code').type).toBe('refactor');
    });

    it('should detect agent mode requirement', () => {
      expect(agent.requiresAgentMode('Crée un composant')).toBe(true);
      expect(agent.requiresAgentMode('Modifie ce fichier')).toBe(true);
      expect(agent.requiresAgentMode('Explique le code')).toBe(false);
    });

    it('should reject non-action intents', async () => {
      const response = await agent.process('Explique-moi ce code');

      expect(response.type).toBe('response');
      expect(response.status).toBe('no_action');
    });
  });

  // ===========================================================================
  // ActionExecutor Integration
  // ===========================================================================

  describe('ActionExecutor', () => {
    let executor: ActionExecutor;

    beforeEach(() => {
      executor = new ActionExecutor({ dryRun: true });
    });

    it('should execute all action types', async () => {
      const actions: ProposedAction[] = [
        {
          id: 'create-1',
          type: 'create_file',
          description: 'Créer test.ts',
          details: {
            type: 'create_file',
            path: 'test.ts',
            content: 'export const x = 1;',
            language: 'typescript',
          },
          risk: 'low',
          reversible: true,
        },
        {
          id: 'modify-1',
          type: 'modify_file',
          description: 'Modifier App.tsx',
          details: {
            type: 'modify_file',
            path: 'App.tsx',
            changes: [],
          },
          risk: 'medium',
          reversible: true,
        },
        {
          id: 'cmd-1',
          type: 'run_command',
          description: 'Exécuter test',
          details: {
            type: 'run_command',
            command: 'pnpm test',
          },
          risk: 'low',
          reversible: false,
        },
      ];

      const results = await executor.executeAll(actions);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].message).toContain('DRY-RUN');
    });

    it('should track executed actions', async () => {
      const actions: ProposedAction[] = [
        {
          id: 'test-1',
          type: 'create_file',
          description: 'Test',
          details: {
            type: 'create_file',
            path: 'test.ts',
            content: '',
            language: 'typescript',
          },
          risk: 'low',
          reversible: true,
        },
      ];

      // executeAll tracks actions, not execute
      await executor.executeAll(actions);

      const executed = executor.getExecutedActions();
      expect(executed).toHaveLength(1);
      expect(executed[0].actionId).toBe('test-1');
    });

    it('should support progress callback', async () => {
      const progressEvents: Array<{ id: string; status: string }> = [];

      const exec = new ActionExecutor({
        dryRun: true,
        onProgress: (id, status) => progressEvents.push({ id, status }),
      });

      await exec.execute({
        id: 'progress-test',
        type: 'run_command',
        description: 'Test',
        details: { type: 'run_command', command: 'echo test' },
        risk: 'low',
        reversible: false,
      });

      expect(progressEvents.some(p => p.status === 'started')).toBe(true);
      expect(progressEvents.some(p => p.status === 'completed')).toBe(true);
    });
  });

  // ===========================================================================
  // AgentModeAgent + ActionExecutor Integration
  // ===========================================================================

  describe('AgentModeAgent + ActionExecutor', () => {
    let agent: AgentModeAgent;

    beforeEach(() => {
      agent = new AgentModeAgent({ dryRun: true });
    });

    it('should generate and execute plan', async () => {
      // 1. Générer un plan
      const response = await agent.process('Crée Button.tsx');

      expect(response.type).toBe('plan');
      expect(response.plan).toBeDefined();
      expect(response.plan!.actions.length).toBeGreaterThan(0);

      // 2. Exécuter le plan
      const execution = await agent.executePlan();

      expect(execution.status).toBe('completed');
      expect(execution.summary.totalActions).toBeGreaterThan(0);
    });

    it('should track execution status', async () => {
      expect(agent.getExecutionStatus()).toBe('pending');

      // Need to process first to generate a plan with actions
      const response = await agent.process('Crée Button.tsx');
      expect(response.plan).toBeDefined();
      expect(response.plan!.actions.length).toBeGreaterThan(0);

      // Then execute the plan
      await agent.executePlan();

      expect(agent.getExecutionStatus()).toBe('completed');
    });

    it('should handle rollback', async () => {
      await agent.process('Crée test.ts');
      await agent.executePlan();

      const rollbackResult = await agent.rollback();

      expect(rollbackResult.status).toBe('rolled_back');
      expect(agent.getExecutionStatus()).toBe('rolled_back');
    });
  });

  // ===========================================================================
  // Plan Generation & Estimates
  // ===========================================================================

  describe('Plan Generation', () => {
    let agent: AgentModeAgent;

    beforeEach(() => {
      agent = new AgentModeAgent({ dryRun: true });
    });

    it('should generate correct action types for create intent', async () => {
      const response = await agent.process('Crée Header.tsx et Footer.tsx');

      expect(response.plan).toBeDefined();
      const actions = response.plan!.actions;
      expect(actions.every(a => a.type === 'create_file')).toBe(true);
    });

    it('should generate correct action types for modify intent', async () => {
      const response = await agent.process('Modifie App.tsx');

      expect(response.plan).toBeDefined();
      const actions = response.plan!.actions;
      expect(actions.every(a => a.type === 'modify_file')).toBe(true);
    });

    it('should include estimates in plan', async () => {
      const response = await agent.process('Crée un composant');

      expect(response.plan).toBeDefined();
      const estimates = response.plan!.estimates;
      expect(estimates.duration).toBeDefined();
      expect(estimates.filesAffected).toBeDefined();
      expect(estimates.risk).toBeDefined();
    });

    it('should detect dependencies between actions', async () => {
      // Les actions sur le même fichier devraient être séquentielles
      const plan = agent.getCurrentPlan();
      // Dependencies are only set after processing
      await agent.process('Modifie et met à jour App.tsx');
      const currentPlan = agent.getCurrentPlan();
      expect(currentPlan?.dependencies).toBeDefined();
    });
  });

  // ===========================================================================
  // System Prompt Integration
  // ===========================================================================

  describe('System Prompt for Agent Mode', () => {
    it('should return AGENT_MODE_SYSTEM_PROMPT for agent mode', () => {
      const prompt = getSystemPromptForMode('agent');
      expect(prompt).toBe(AGENT_MODE_SYSTEM_PROMPT);
      expect(prompt).toContain('MODE AGENT');
    });

    it('should contain execution workflow', () => {
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Validation');
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Exécution');
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Rollback');
    });

    it('should define capabilities', () => {
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Créer');
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Modifier');
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Supprimer');
      expect(AGENT_MODE_SYSTEM_PROMPT).toContain('Exécuter');
    });
  });

  // ===========================================================================
  // Store Integration
  // ===========================================================================

  describe('Chat Store with Agent Mode', () => {
    beforeEach(() => {
      chatStore.set({
        started: false,
        aborted: false,
        showChat: true,
        mode: 'auto',
        pendingActions: [],
        awaitingAgentApproval: false,
      });
    });

    it('should transition to agent mode on approval', () => {
      const actions: ProposedAction[] = [
        {
          id: 'action-1',
          type: 'create_file',
          description: 'Test',
          details: { type: 'create_file', path: 'test.ts', content: '', language: 'typescript' },
          risk: 'low',
          reversible: true,
        },
      ];

      setPendingActions(actions);
      expect(chatStore.get().awaitingAgentApproval).toBe(true);

      const approved = approveAgentMode();
      expect(approved).toEqual(actions);
      expect(getChatMode()).toBe('agent');
    });

    it('should clear actions on rejection', () => {
      setPendingActions([
        {
          id: 'action-1',
          type: 'delete_file',
          description: 'Test',
          details: { type: 'delete_file', path: 'test.ts' },
          risk: 'high',
          reversible: false,
        },
      ]);

      rejectAgentMode();

      expect(chatStore.get().pendingActions).toHaveLength(0);
      expect(chatStore.get().awaitingAgentApproval).toBe(false);
    });
  });

  // ===========================================================================
  // End-to-End Flow
  // ===========================================================================

  describe('End-to-End Agent Mode Flow', () => {
    let chatAgent: ChatModeAgent;
    let agentModeAgent: AgentModeAgent;

    beforeEach(() => {
      chatAgent = new ChatModeAgent();
      agentModeAgent = new AgentModeAgent({ dryRun: true });
      chatStore.set({
        started: false,
        aborted: false,
        showChat: true,
        mode: 'auto',
        pendingActions: [],
        awaitingAgentApproval: false,
      });
    });

    it('should complete full Chat -> Agent flow', async () => {
      // 1. User sends action request in chat mode
      const userMessage = 'Ajoute un composant Button';
      const context = createTestContext();
      chatAgent.setContext(context);

      // 2. Chat mode classifies and proposes actions
      const chatResponse = await chatAgent.process(userMessage);
      expect(chatResponse.canProceedToAgentMode).toBe(true);

      // 3. Set pending actions if any
      if (chatResponse.proposedActions.length > 0) {
        setPendingActions(chatResponse.proposedActions);
      }

      // 4. User approves -> switch to agent mode
      const intent = classifyIntent(userMessage);
      if (intent.recommendedMode === 'agent') {
        setChatMode('agent');
      }

      // 5. Process with AgentModeAgent
      agentModeAgent.setContext(context);
      const agentResponse = await agentModeAgent.process(userMessage);

      expect(agentResponse.type).toBe('plan');
      expect(agentResponse.plan).toBeDefined();

      // 6. Execute the plan
      const execution = await agentModeAgent.executePlan();

      expect(execution.status).toBe('completed');
      expect(execution.summary.totalActions).toBeGreaterThan(0);
    });

    it('should handle French action requests', async () => {
      const messages = [
        'Crée un nouveau fichier utils.ts',
        'Modifie le composant App',
        'Ajoute une fonction de validation',
        'Corrige l\'erreur dans le code',
      ];

      for (const msg of messages) {
        const response = await agentModeAgent.process(msg);
        expect(response.type).toBe('plan');
        expect(response.plan).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle stopOnError option', async () => {
      const executor = new ActionExecutor({
        dryRun: false,
        stopOnError: true,
      });

      // Avec dryRun: false, les actions de fichier échoueront car les fichiers n'existent pas
      const actions: ProposedAction[] = [
        {
          id: 'fail-1',
          type: 'modify_file',
          description: 'Modifier fichier inexistant',
          details: { type: 'modify_file', path: 'nonexistent.ts', changes: [] },
          risk: 'low',
          reversible: true,
        },
        {
          id: 'action-2',
          type: 'create_file',
          description: 'Ne devrait pas s\'exécuter',
          details: { type: 'create_file', path: 'test.ts', content: '', language: 'typescript' },
          risk: 'low',
          reversible: true,
        },
      ];

      const results = await executor.executeAll(actions);

      // Devrait s'arrêter après la première erreur
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('should handle missing context', async () => {
      const agent = new AgentModeAgent({ dryRun: true });
      // Pas de contexte défini

      const response = await agent.process('Crée un fichier');
      expect(response).toBeDefined();
    });

    it('should handle empty plan execution', async () => {
      const agent = new AgentModeAgent({ dryRun: true });
      const result = await agent.executePlan([]);

      expect(result.status).toBe('completed');
      expect(result.results).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Consistency Checks
  // ===========================================================================

  describe('Consistency Checks', () => {
    it('should have matching configs', () => {
      // Agent mode should have all chat mode capabilities plus more
      for (const cap of CHAT_MODE_CONFIG.capabilities) {
        expect(AGENT_MODE_CONFIG.capabilities).toContain(cap);
      }

      // Chat mode restrictions should be agent mode capabilities
      for (const restriction of CHAT_MODE_CONFIG.restrictions) {
        expect(AGENT_MODE_CONFIG.capabilities).toContain(restriction);
      }

      // Agent mode should have no restrictions
      expect(AGENT_MODE_CONFIG.restrictions).toHaveLength(0);
    });

    it('should have consistent system prompts', () => {
      const chatPrompt = getSystemPromptForMode('chat');
      const agentPrompt = getSystemPromptForMode('agent');

      expect(chatPrompt).toBe(CHAT_MODE_SYSTEM_PROMPT);
      expect(agentPrompt).toBe(AGENT_MODE_SYSTEM_PROMPT);

      // Both should be in French
      expect(chatPrompt).toContain('Tu es');
      expect(agentPrompt).toContain('Tu es');
    });

    it('should have factory function for ActionExecutor', () => {
      const executor = createActionExecutor({ dryRun: true });
      expect(executor).toBeInstanceOf(ActionExecutor);
    });
  });
});

// =============================================================================
// Helpers
// =============================================================================

function createTestContext(): AgentContext {
  return {
    files: [
      {
        path: 'src/App.tsx',
        content: `
import React from 'react';

export default function App() {
  return <div>Hello World</div>;
}
        `.trim(),
        language: 'tsx',
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          dependencies: {
            react: '^18.0.0',
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
      fileCount: 2,
      techStack: ['React', 'TypeScript'],
    },
    recentErrors: [],
    recentLogs: [],
  };
}
