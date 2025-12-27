/**
 * Tests d'intégration Sprint 2 - ChatModeAgent
 *
 * Vérifie l'intégration complète du mode Chat incluant:
 * - ChatModeAgent avec BaseAgent et IntentClassifier
 * - Store chat.ts avec gestion du mode
 * - Prompts.ts avec CHAT_MODE_SYSTEM_PROMPT
 * - Flow complet de bout en bout
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
} from './index';

import {
  chatStore,
  setChatMode,
  getChatMode,
  setPendingActions,
  clearPendingActions,
  approveAgentMode,
  rejectAgentMode,
  type ChatMode,
} from '~/lib/stores/chat';

import {
  getSystemPromptForMode,
  type AgentModeType,
} from '~/lib/.server/llm/prompts';

describe('Sprint 2 Integration Tests', () => {
  // ===========================================================================
  // ChatModeAgent + BaseAgent Integration
  // ===========================================================================

  describe('ChatModeAgent extends BaseAgent', () => {
    let agent: ChatModeAgent;

    beforeEach(() => {
      agent = new ChatModeAgent();
    });

    it('should inherit BaseAgent capabilities', () => {
      // ChatModeAgent devrait hériter les capacités du CHAT_MODE_CONFIG
      expect(agent.hasCapability('read_files')).toBe(true);
      expect(agent.hasCapability('analyze_code')).toBe(true);
      expect(agent.hasCapability('explain_errors')).toBe(true);
    });

    it('should inherit BaseAgent restrictions', () => {
      expect(agent.isRestricted('create_files')).toBe(true);
      expect(agent.isRestricted('modify_files')).toBe(true);
      expect(agent.isRestricted('execute_shell')).toBe(true);
    });

    it('should use context like BaseAgent', () => {
      const context = createTestContext();
      agent.setContext(context);
      expect(agent.getContext()).toEqual(context);
    });

    it('should process messages and return ChatModeResponse', async () => {
      const context = createTestContext();
      agent.setContext(context);

      const response = await agent.process('Explique ce code');

      expect(response.type).toBe('analysis');
      expect(response.content).toBeTruthy();
      expect(response.sections).toBeDefined();
      expect(Array.isArray(response.suggestions)).toBe(true);
      expect(Array.isArray(response.proposedActions)).toBe(true);
    });
  });

  // ===========================================================================
  // ChatModeAgent + IntentClassifier Integration
  // ===========================================================================

  describe('ChatModeAgent uses IntentClassifier', () => {
    let agent: ChatModeAgent;

    beforeEach(() => {
      agent = new ChatModeAgent();
    });

    it('should classify messages internally', () => {
      const intent = agent.classifyMessage('Pourquoi ce bug ?');
      expect(intent.type).toBe('debug');
      expect(intent.recommendedMode).toBe('chat');
    });

    it('should detect when agent mode is required', () => {
      expect(agent.requiresAgentMode('Ajoute un bouton')).toBe(true);
      expect(agent.requiresAgentMode('Explique le code')).toBe(false);
    });

    it('should analyze based on classified intent', async () => {
      const context = createTestContext();
      agent.setContext(context);

      // Debug intent
      const debugResponse = await agent.process('Pourquoi cette erreur ?');
      expect(debugResponse.sections).toBeDefined();

      // Explain intent
      const explainResponse = await agent.process('Explique-moi ce fichier');
      expect(explainResponse.sections).toBeDefined();

      // Plan intent
      const planResponse = await agent.process('Comment implémenter cette feature');
      expect(planResponse.sections.analysis).toBeTruthy();
    });
  });

  // ===========================================================================
  // Chat Store Integration
  // ===========================================================================

  describe('Chat Store Mode Management', () => {
    beforeEach(() => {
      // Reset store
      chatStore.set({
        started: false,
        aborted: false,
        showChat: true,
        mode: 'auto',
        pendingActions: [],
        awaitingAgentApproval: false,
      });
    });

    it('should manage mode state', () => {
      expect(getChatMode()).toBe('auto');

      setChatMode('chat');
      expect(getChatMode()).toBe('chat');

      setChatMode('agent');
      expect(getChatMode()).toBe('agent');
    });

    it('should manage pending actions', () => {
      const actions = [
        {
          id: 'action-1',
          type: 'create_file' as const,
          description: 'Créer test.ts',
          details: { type: 'create_file' as const, path: 'test.ts', content: '', language: 'typescript' },
          risk: 'low' as const,
          reversible: true,
        },
      ];

      setPendingActions(actions);

      const state = chatStore.get();
      expect(state.pendingActions).toEqual(actions);
      expect(state.awaitingAgentApproval).toBe(true);
    });

    it('should handle agent mode approval flow', () => {
      const actions = [
        {
          id: 'action-1',
          type: 'modify_file' as const,
          description: 'Modifier App.tsx',
          details: { type: 'modify_file' as const, path: 'App.tsx', changes: [] },
          risk: 'low' as const,
          reversible: true,
        },
      ];

      // Set pending actions
      setPendingActions(actions);
      expect(chatStore.get().awaitingAgentApproval).toBe(true);

      // Approve
      const approved = approveAgentMode();
      expect(approved).toEqual(actions);
      expect(getChatMode()).toBe('agent');
      expect(chatStore.get().awaitingAgentApproval).toBe(false);
    });

    it('should handle agent mode rejection', () => {
      const actions = [
        {
          id: 'action-1',
          type: 'delete_file' as const,
          description: 'Supprimer old.ts',
          details: { type: 'delete_file' as const, path: 'old.ts' },
          risk: 'medium' as const,
          reversible: false,
        },
      ];

      setPendingActions(actions);
      rejectAgentMode();

      const state = chatStore.get();
      expect(state.pendingActions).toHaveLength(0);
      expect(state.awaitingAgentApproval).toBe(false);
    });

    it('should clear pending actions', () => {
      setPendingActions([
        {
          id: 'action-1',
          type: 'create_file' as const,
          description: 'Test',
          details: { type: 'create_file' as const, path: 'test.ts', content: '', language: 'typescript' },
          risk: 'low' as const,
          reversible: true,
        },
      ]);

      clearPendingActions();

      const state = chatStore.get();
      expect(state.pendingActions).toHaveLength(0);
      expect(state.awaitingAgentApproval).toBe(false);
    });
  });

  // ===========================================================================
  // System Prompt Integration
  // ===========================================================================

  describe('System Prompt for Mode', () => {
    it('should return chat mode prompt', () => {
      const prompt = getSystemPromptForMode('chat');
      expect(prompt).toBe(CHAT_MODE_SYSTEM_PROMPT);
      expect(prompt).toContain('MODE CHAT');
    });

    it('should return agent mode prompt for agent', () => {
      const prompt = getSystemPromptForMode('agent');
      // Agent mode should return the regular system prompt
      expect(prompt).toContain('BAVINI');
      expect(prompt).not.toBe(CHAT_MODE_SYSTEM_PROMPT);
    });

    it('should return agent mode prompt for auto', () => {
      const prompt = getSystemPromptForMode('auto');
      expect(prompt).toContain('BAVINI');
      expect(prompt).not.toBe(CHAT_MODE_SYSTEM_PROMPT);
    });
  });

  // ===========================================================================
  // End-to-End Flow
  // ===========================================================================

  describe('End-to-End Chat Mode Flow', () => {
    let agent: ChatModeAgent;

    beforeEach(() => {
      agent = new ChatModeAgent();
      chatStore.set({
        started: false,
        aborted: false,
        showChat: true,
        mode: 'auto',
        pendingActions: [],
        awaitingAgentApproval: false,
      });
    });

    it('should complete full analysis flow', async () => {
      // 1. User sends message
      const userMessage = 'Explique-moi le fichier App.tsx';

      // 2. Classify intent
      const intent = classifyIntent(userMessage);
      expect(intent.type).toBe('explain');
      expect(intent.recommendedMode).toBe('chat');

      // 3. Set mode based on intent
      setChatMode(intent.recommendedMode as ChatMode);
      expect(getChatMode()).toBe('chat');

      // 4. Process with ChatModeAgent
      const context = createTestContext();
      agent.setContext(context);
      const response = await agent.process(userMessage);

      // 5. Verify response
      expect(response.type).toBe('analysis');
      expect(response.canProceedToAgentMode).toBeDefined();
    });

    it('should handle transition to agent mode', async () => {
      // 1. User requests action
      const userMessage = 'Ajoute un composant Button';

      // 2. Classify intent
      const intent = classifyIntent(userMessage);
      expect(intent.recommendedMode).toBe('agent');

      // 3. In chat mode, generate proposed actions
      const context = createTestContext();
      agent.setContext(context);
      const response = await agent.process(userMessage);

      // 4. Set pending actions if any
      if (response.proposedActions.length > 0) {
        setPendingActions(response.proposedActions);
        expect(chatStore.get().awaitingAgentApproval).toBe(true);
      }

      // 5. User approves
      if (response.canProceedToAgentMode) {
        approveAgentMode();
        expect(getChatMode()).toBe('agent');
      }
    });

    it('should handle French messages correctly', async () => {
      const context = createTestContext();
      agent.setContext(context);

      // Test various French messages
      const messages = [
        'Pourquoi ce bug apparaît-il ?',
        'Explique-moi cette fonction',
        'Fais une revue de ce code',
        'Comment planifier cette feature ?',
      ];

      for (const msg of messages) {
        const response = await agent.process(msg);
        expect(response.type).toBe('analysis');
        expect(response.content).toBeTruthy();
      }
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle missing context gracefully', async () => {
      const agent = new ChatModeAgent();
      // No context set

      const response = await agent.process('Analyse ce code');
      expect(response).toBeDefined();
      expect(response.type).toBe('analysis');
    });

    it('should handle empty messages', async () => {
      const agent = new ChatModeAgent();
      const response = await agent.process('');
      expect(response).toBeDefined();
    });

    it('should handle store operations safely', () => {
      // Set invalid actions (empty array)
      setPendingActions([]);
      expect(chatStore.get().awaitingAgentApproval).toBe(false);

      // Clear when already empty
      clearPendingActions();
      expect(chatStore.get().pendingActions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Consistency Checks
  // ===========================================================================

  describe('Consistency Checks', () => {
    it('should have consistent mode types across modules', () => {
      // ChatMode in store matches AgentModeType in prompts
      const storeModes: ChatMode[] = ['chat', 'agent', 'auto'];
      const promptModes: AgentModeType[] = ['chat', 'agent', 'auto'];

      expect(storeModes).toEqual(promptModes);
    });

    it('should have CHAT_MODE_SYSTEM_PROMPT consistent', () => {
      // The prompt should be the same whether imported from ChatModeAgent or prompts
      const agentPrompt = CHAT_MODE_SYSTEM_PROMPT;
      const fromPromptsModule = getSystemPromptForMode('chat');

      expect(agentPrompt).toBe(fromPromptsModule);
    });

    it('should have matching capabilities between config and agent', () => {
      const agent = new ChatModeAgent();

      // All capabilities from config should be available
      for (const cap of CHAT_MODE_CONFIG.capabilities) {
        expect(agent.hasCapability(cap)).toBe(true);
      }

      // All restrictions from config should be active
      for (const restriction of CHAT_MODE_CONFIG.restrictions) {
        expect(agent.isRestricted(restriction)).toBe(true);
      }
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
