import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  connectorsStore,
  connectConnector,
  disconnectConnector,
  getConnectorState,
  getConnectorConfig,
  getConnectorsByCategory,
  hasConnectedConnectors,
  settingsModalOpen,
  activeSettingsTab,
  openSettingsModal,
  closeSettingsModal,
  CONNECTORS,

  // OAuth functions
  isOAuthConnector,
  getAuthMethod,
  getOAuthConnectors,
  getApiKeyConnectors,
  type AuthMethod,
} from './connectors';
import { setGitToken, gitSettingsStore, kGitToken } from './git-settings';

describe('connectors store', () => {
  beforeEach(() => {
    // reset store to initial state
    const defaultState: Record<string, { isConnected: boolean; credentials: Record<string, string> }> = {};

    for (const connector of CONNECTORS) {
      defaultState[connector.id] = { isConnected: false, credentials: {} };
    }

    connectorsStore.set(defaultState as any);
    settingsModalOpen.set(false);
    activeSettingsTab.set('connectors');

    // reset git settings
    setGitToken(null);
    localStorage.removeItem(kGitToken);
  });

  describe('CONNECTORS configuration', () => {
    it('should have all required connectors defined', () => {
      const connectorIds = CONNECTORS.map((c) => c.id);

      expect(connectorIds).toContain('supabase');
      expect(connectorIds).toContain('stripe');
      expect(connectorIds).toContain('github');
      expect(connectorIds).toContain('notion');
    });

    it('should have valid fields for each connector', () => {
      for (const connector of CONNECTORS) {
        expect(connector.name).toBeTruthy();
        expect(connector.description).toBeTruthy();
        expect(connector.category).toMatch(/^(shared|personal)$/);
        expect(connector.fields.length).toBeGreaterThan(0);
      }
    });

    it('should have required fields marked correctly', () => {
      const supabase = CONNECTORS.find((c) => c.id === 'supabase');

      expect(supabase?.fields.some((f) => f.required)).toBe(true);
    });
  });

  describe('connectConnector', () => {
    it('should connect a connector with credentials', () => {
      connectConnector('supabase', { url: 'https://test.supabase.co', anonKey: 'test-key' });

      const state = getConnectorState('supabase');

      expect(state.isConnected).toBe(true);
      expect(state.credentials.url).toBe('https://test.supabase.co');
      expect(state.credentials.anonKey).toBe('test-key');
      expect(state.lastConnected).toBeDefined();
    });

    it('should preserve other connectors state', () => {
      connectConnector('supabase', { url: 'https://test.supabase.co' });
      connectConnector('stripe', { publishableKey: 'pk_test' });

      expect(getConnectorState('supabase').isConnected).toBe(true);
      expect(getConnectorState('stripe').isConnected).toBe(true);
    });
  });

  describe('disconnectConnector', () => {
    it('should disconnect a connector and clear credentials', () => {
      connectConnector('github', { token: 'ghp_test' });

      expect(getConnectorState('github').isConnected).toBe(true);

      disconnectConnector('github');

      const state = getConnectorState('github');

      expect(state.isConnected).toBe(false);
      expect(state.credentials).toEqual({});
    });
  });

  describe('getConnectorConfig', () => {
    it('should return connector configuration by id', () => {
      const config = getConnectorConfig('supabase');

      expect(config?.name).toBe('Supabase');
      expect(config?.category).toBe('shared');
    });

    it('should return undefined for unknown connector', () => {
      const config = getConnectorConfig('unknown' as any);

      expect(config).toBeUndefined();
    });
  });

  describe('getConnectorsByCategory', () => {
    it('should return shared connectors', () => {
      const shared = getConnectorsByCategory('shared');

      expect(shared.length).toBeGreaterThan(0);
      expect(shared.every((c) => c.category === 'shared')).toBe(true);
    });

    it('should return personal connectors', () => {
      const personal = getConnectorsByCategory('personal');

      expect(personal.length).toBeGreaterThan(0);
      expect(personal.every((c) => c.category === 'personal')).toBe(true);
    });
  });

  describe('hasConnectedConnectors', () => {
    it('should return false when no connectors are connected', () => {
      expect(hasConnectedConnectors()).toBe(false);
    });

    it('should return true when at least one connector is connected', () => {
      connectConnector('github', { token: 'test' });

      expect(hasConnectedConnectors()).toBe(true);
    });
  });

  describe('settings modal state', () => {
    it('should open settings modal with default tab', () => {
      openSettingsModal();

      expect(settingsModalOpen.get()).toBe(true);
      expect(activeSettingsTab.get()).toBe('connectors');
    });

    it('should open settings modal with specific tab', () => {
      openSettingsModal('account');

      expect(settingsModalOpen.get()).toBe(true);
      expect(activeSettingsTab.get()).toBe('account');
    });

    it('should close settings modal', () => {
      openSettingsModal();
      closeSettingsModal();

      expect(settingsModalOpen.get()).toBe(false);
    });
  });

  describe('OAuth Authentication Functions (Phase 2 - Extended)', () => {
    describe('isOAuthConnector', () => {
      it('should return true for all OAuth connectors', () => {
        expect(isOAuthConnector('github')).toBe(true);
        expect(isOAuthConnector('figma')).toBe(true);
        expect(isOAuthConnector('notion')).toBe(true);
        expect(isOAuthConnector('linear')).toBe(true);
        expect(isOAuthConnector('netlify')).toBe(true);
        expect(isOAuthConnector('miro')).toBe(true);
        expect(isOAuthConnector('supabase')).toBe(true);
        expect(isOAuthConnector('atlassian')).toBe(true);
        expect(isOAuthConnector('shopify')).toBe(true);
      });

      it('should return false for API key connectors', () => {
        expect(isOAuthConnector('stripe')).toBe(false);
        expect(isOAuthConnector('elevenlabs')).toBe(false);
        expect(isOAuthConnector('perplexity')).toBe(false);
        expect(isOAuthConnector('firecrawl')).toBe(false);
        expect(isOAuthConnector('n8n')).toBe(false);
      });
    });

    describe('getAuthMethod', () => {
      it('should return oauth for OAuth connectors', () => {
        expect(getAuthMethod('github')).toBe('oauth');
        expect(getAuthMethod('figma')).toBe('oauth');
        expect(getAuthMethod('notion')).toBe('oauth');
        expect(getAuthMethod('linear')).toBe('oauth');
        expect(getAuthMethod('supabase')).toBe('oauth');
        expect(getAuthMethod('netlify')).toBe('oauth');
        expect(getAuthMethod('miro')).toBe('oauth');
        expect(getAuthMethod('atlassian')).toBe('oauth');
        expect(getAuthMethod('shopify')).toBe('oauth');
      });

      it('should return api_key for connectors without explicit authMethod', () => {
        expect(getAuthMethod('stripe')).toBe('api_key');
        expect(getAuthMethod('elevenlabs')).toBe('api_key');
        expect(getAuthMethod('n8n')).toBe('api_key');
      });
    });

    describe('getOAuthConnectors', () => {
      it('should return only OAuth connectors', () => {
        const oauthConnectors = getOAuthConnectors();

        expect(oauthConnectors.length).toBe(9);
        expect(oauthConnectors.every((c) => c.authMethod === 'oauth')).toBe(true);
      });

      it('should include all OAuth connectors', () => {
        const oauthIds = getOAuthConnectors().map((c) => c.id);

        expect(oauthIds).toContain('github');
        expect(oauthIds).toContain('figma');
        expect(oauthIds).toContain('notion');
        expect(oauthIds).toContain('linear');
        expect(oauthIds).toContain('netlify');
        expect(oauthIds).toContain('miro');
        expect(oauthIds).toContain('supabase');
        expect(oauthIds).toContain('atlassian');
        expect(oauthIds).toContain('shopify');
      });

      it('should not include API key connectors', () => {
        const oauthIds = getOAuthConnectors().map((c) => c.id);

        expect(oauthIds).not.toContain('stripe');
        expect(oauthIds).not.toContain('elevenlabs');
      });
    });

    describe('getApiKeyConnectors', () => {
      it('should return only API key connectors', () => {
        const apiKeyConnectors = getApiKeyConnectors();

        // Should not include OAuth connectors
        expect(apiKeyConnectors.every((c) => c.authMethod !== 'oauth')).toBe(true);
      });

      it('should include Stripe and ElevenLabs', () => {
        const apiKeyIds = getApiKeyConnectors().map((c) => c.id);

        expect(apiKeyIds).toContain('stripe');
        expect(apiKeyIds).toContain('elevenlabs');
      });

      it('should not include OAuth connectors', () => {
        const apiKeyIds = getApiKeyConnectors().map((c) => c.id);

        expect(apiKeyIds).not.toContain('github');
        expect(apiKeyIds).not.toContain('figma');
        expect(apiKeyIds).not.toContain('notion');
      });

      it('should have correct count', () => {
        const apiKeyConnectors = getApiKeyConnectors();
        const totalConnectors = CONNECTORS.length;
        const oauthConnectors = getOAuthConnectors();

        expect(apiKeyConnectors.length).toBe(totalConnectors - oauthConnectors.length);
      });
    });

    describe('AuthMethod type', () => {
      it('should accept valid auth methods', () => {
        const oauth: AuthMethod = 'oauth';
        const apiKey: AuthMethod = 'api_key';

        expect(oauth).toBe('oauth');
        expect(apiKey).toBe('api_key');
      });
    });

    describe('ConnectorConfig authMethod field', () => {
      it('should have authMethod defined for OAuth connectors', () => {
        const github = CONNECTORS.find((c) => c.id === 'github');
        const figma = CONNECTORS.find((c) => c.id === 'figma');
        const notion = CONNECTORS.find((c) => c.id === 'notion');
        const linear = CONNECTORS.find((c) => c.id === 'linear');
        const supabase = CONNECTORS.find((c) => c.id === 'supabase');
        const netlify = CONNECTORS.find((c) => c.id === 'netlify');
        const miro = CONNECTORS.find((c) => c.id === 'miro');
        const atlassian = CONNECTORS.find((c) => c.id === 'atlassian');
        const shopify = CONNECTORS.find((c) => c.id === 'shopify');

        expect(github?.authMethod).toBe('oauth');
        expect(figma?.authMethod).toBe('oauth');
        expect(notion?.authMethod).toBe('oauth');
        expect(linear?.authMethod).toBe('oauth');
        expect(supabase?.authMethod).toBe('oauth');
        expect(netlify?.authMethod).toBe('oauth');
        expect(miro?.authMethod).toBe('oauth');
        expect(atlassian?.authMethod).toBe('oauth');
        expect(shopify?.authMethod).toBe('oauth');
      });

      it('should have authMethod undefined or api_key for non-OAuth connectors', () => {
        const stripe = CONNECTORS.find((c) => c.id === 'stripe');
        const elevenlabs = CONNECTORS.find((c) => c.id === 'elevenlabs');
        const perplexity = CONNECTORS.find((c) => c.id === 'perplexity');
        const firecrawl = CONNECTORS.find((c) => c.id === 'firecrawl');
        const n8n = CONNECTORS.find((c) => c.id === 'n8n');

        expect(stripe?.authMethod).toBeUndefined();
        expect(elevenlabs?.authMethod).toBeUndefined();
        expect(perplexity?.authMethod).toBeUndefined();
        expect(firecrawl?.authMethod).toBeUndefined();
        expect(n8n?.authMethod).toBeUndefined();
      });
    });
  });

  describe('GitHub-gitSettings sync (Phase 3A)', () => {
    it('should sync GitHub token to git-settings when connecting', () => {
      connectConnector('github', { token: 'ghp_test_token_123' });

      // verify connector state
      expect(getConnectorState('github').isConnected).toBe(true);

      // verify git-settings was synced
      expect(gitSettingsStore.get().token).toBe('ghp_test_token_123');
    });

    it('should clear git-settings token when disconnecting GitHub', () => {
      // first connect
      connectConnector('github', { token: 'ghp_test_token_456' });

      expect(gitSettingsStore.get().token).toBe('ghp_test_token_456');

      // then disconnect
      disconnectConnector('github');

      // verify git-settings was cleared
      expect(gitSettingsStore.get().token).toBe(null);
      expect(getConnectorState('github').isConnected).toBe(false);
    });

    it('should not sync non-GitHub connectors to git-settings', () => {
      connectConnector('supabase', { url: 'https://test.supabase.co', anonKey: 'key' });

      expect(gitSettingsStore.get().token).toBe(null);
    });

    it('should update GitHub connector when git-settings token changes externally', async () => {
      // simulate external token set (e.g., from action-runner)
      setGitToken('ghp_external_token');

      // give subscription time to propagate
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = getConnectorState('github');

      expect(state.isConnected).toBe(true);
      expect(state.credentials.token).toBe('ghp_external_token');
    });

    it('should disconnect GitHub connector when git-settings token is cleared externally', async () => {
      // first connect
      connectConnector('github', { token: 'ghp_connected_token' });

      expect(getConnectorState('github').isConnected).toBe(true);

      // simulate external token clear
      setGitToken(null);

      // give subscription time to propagate
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(getConnectorState('github').isConnected).toBe(false);
    });

    it('should preserve GitHub lastConnected timestamp on reconnect', async () => {
      connectConnector('github', { token: 'ghp_first_token' });

      const firstLastConnected = getConnectorState('github').lastConnected;

      // wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 20));

      // reconnect via external token
      setGitToken('ghp_new_token');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newLastConnected = getConnectorState('github').lastConnected;

      // lastConnected should be updated
      expect(newLastConnected).toBeGreaterThanOrEqual(firstLastConnected!);
    });
  });
});
