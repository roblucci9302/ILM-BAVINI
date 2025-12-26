/**
 * Connectors store for managing third-party service integrations.
 * Uses localStorage for persistence across sessions.
 * Syncs with git-settings for GitHub token management.
 * Supports both OAuth and API key authentication.
 */

import { atom, map } from 'nanostores';
import { gitSettingsStore, setGitToken, getGitToken, kGitToken } from './git-settings';
import {
  supportsOAuth,
  initializeOAuthTokens,
  oauthTokensStore,
  storeToken,
  removeToken,
  getAccessToken,
  isProviderConnected,
  isTokenExpired,
  type OAuthProviderId,
} from '~/lib/auth';

// Connector types - Simplified to core services only
export type ConnectorId = 'github' | 'supabase' | 'netlify';

export type ConnectorCategory = 'shared' | 'personal';

/**
 * Authentication method for connectors
 * - 'oauth': Uses OAuth 2.0 flow (redirect to provider)
 * - 'api_key': Uses manual API key/token entry
 */
export type AuthMethod = 'oauth' | 'api_key';

export interface ConnectorConfig {
  id: ConnectorId;
  name: string;
  description: string;
  category: ConnectorCategory;
  icon: string;
  docsUrl?: string;

  /** Authentication method - defaults to 'api_key' if not specified */
  authMethod?: AuthMethod;

  /** Fields for API key authentication (ignored for OAuth) */
  fields: ConnectorField[];
}

export interface ConnectorField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  required?: boolean;
}

export interface ConnectorState {
  isConnected: boolean;
  credentials: Record<string, string>;
  lastConnected?: number;

  /** OAuth-specific: indicates if this connector uses OAuth */
  isOAuth?: boolean;

  /** OAuth-specific: access token expiration timestamp */
  expiresAt?: number;

  /** OAuth-specific: indicates if the token needs refresh */
  needsRefresh?: boolean;
}

export type ConnectorsState = Record<ConnectorId, ConnectorState>;

const kConnectorsStorage = 'bavini_connectors';

// Connector configurations - Core services only
export const CONNECTORS: ConnectorConfig[] = [
  // Shared connectors
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Base de données PostgreSQL et authentification',
    category: 'shared',
    icon: 'supabase',
    docsUrl: 'https://supabase.com/docs',
    authMethod: 'oauth',
    fields: [
      { key: 'url', label: 'URL du projet', type: 'url', placeholder: 'https://xxx.supabase.co', required: true },
      { key: 'anonKey', label: 'Clé Anon', type: 'password', placeholder: 'eyJhbGciOiJIUzI1NiIs...', required: true },
    ],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Déploiement et hébergement',
    category: 'shared',
    icon: 'netlify',
    docsUrl: 'https://docs.netlify.com',
    authMethod: 'oauth',
    fields: [
      { key: 'accessToken', label: "Token d'accès", type: 'password', required: true },
      { key: 'siteId', label: 'ID du site', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    ],
  },

  // Personal connectors
  {
    id: 'github',
    name: 'GitHub',
    description: 'Gestion de code et repositories',
    category: 'personal',
    icon: 'github',
    docsUrl: 'https://docs.github.com',
    authMethod: 'oauth',
    fields: [
      { key: 'token', label: "Token d'accès personnel", type: 'password', placeholder: 'ghp_...', required: true },
    ],
  },
];

// Default state for all connectors
function getDefaultState(): ConnectorsState {
  const state: Partial<ConnectorsState> = {};

  for (const connector of CONNECTORS) {
    state[connector.id] = {
      isConnected: false,
      credentials: {},
    };
  }

  return state as ConnectorsState;
}

// Initialize store from localStorage and sync with git-settings
function initStore(): ConnectorsState {
  const defaultState = getDefaultState();

  if (!import.meta.env.SSR) {
    try {
      const persisted = localStorage.getItem(kConnectorsStorage);
      let state = defaultState;

      if (persisted) {
        const parsed = JSON.parse(persisted) as Partial<ConnectorsState>;

        // merge with default to handle new connectors, only keep valid connector IDs
        const validIds = CONNECTORS.map((c) => c.id);

        for (const id of validIds) {
          if (parsed[id]) {
            state[id] = parsed[id];
          }
        }
      }

      // sync with existing git token from git-settings
      const existingGitToken = localStorage.getItem(kGitToken);

      if (existingGitToken && !state.github.isConnected) {
        // git token exists but connector shows disconnected - sync it
        state.github = {
          isConnected: true,
          credentials: { token: existingGitToken },
          lastConnected: Date.now(),
        };
      } else if (!existingGitToken && state.github.isConnected) {
        // connector shows connected but no git token - sync it
        state.github = {
          isConnected: false,
          credentials: {},
        };
      }

      return state;
    } catch {
      // ignore parse errors
    }
  }

  return defaultState;
}

export const connectorsStore = atom<ConnectorsState>(initStore());

/*
 * Subscribe to git-settings changes to keep GitHub connector in sync
 * This handles cases where git token is set directly (e.g., from action-runner)
 */
if (!import.meta.env.SSR) {
  gitSettingsStore.subscribe((gitSettings) => {
    const currentState = connectorsStore.get();
    const githubConnector = currentState.github;

    if (gitSettings.token && !githubConnector.isConnected) {
      // token was set externally, update connector state
      const newState: ConnectorsState = {
        ...currentState,
        github: {
          isConnected: true,
          credentials: { token: gitSettings.token },
          lastConnected: Date.now(),
        },
      };
      connectorsStore.set(newState);
      persistState(newState);
    } else if (!gitSettings.token && githubConnector.isConnected) {
      // token was cleared externally, update connector state
      const newState: ConnectorsState = {
        ...currentState,
        github: {
          isConnected: false,
          credentials: {},
        },
      };
      connectorsStore.set(newState);
      persistState(newState);
    }
  });
}

// Settings modal state
export const settingsModalOpen = atom<boolean>(false);
export const activeSettingsTab = atom<'account' | 'connectors' | 'github'>('connectors');

/**
 * Save connectors state to localStorage.
 */
function persistState(state: ConnectorsState): void {
  if (!import.meta.env.SSR) {
    localStorage.setItem(kConnectorsStorage, JSON.stringify(state));
  }
}

/**
 * Connect a connector with credentials.
 * Syncs GitHub token with git-settings store.
 */
export function connectConnector(id: ConnectorId, credentials: Record<string, string>): void {
  const current = connectorsStore.get();

  const newState: ConnectorsState = {
    ...current,
    [id]: {
      isConnected: true,
      credentials,
      lastConnected: Date.now(),
    },
  };

  connectorsStore.set(newState);
  persistState(newState);

  // sync GitHub token with git-settings
  if (id === 'github' && credentials.token) {
    setGitToken(credentials.token);
  }
}

/**
 * Disconnect a connector.
 * Syncs GitHub token with git-settings store.
 */
export function disconnectConnector(id: ConnectorId): void {
  const current = connectorsStore.get();

  const newState: ConnectorsState = {
    ...current,
    [id]: {
      isConnected: false,
      credentials: {},
    },
  };

  connectorsStore.set(newState);
  persistState(newState);

  // sync GitHub token with git-settings
  if (id === 'github') {
    setGitToken(null);
  }
}

/**
 * Get a specific connector's state.
 */
export function getConnectorState(id: ConnectorId): ConnectorState {
  return connectorsStore.get()[id];
}

/**
 * Get connector configuration by ID.
 */
export function getConnectorConfig(id: ConnectorId): ConnectorConfig | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

/**
 * Get all connectors by category.
 */
export function getConnectorsByCategory(category: ConnectorCategory): ConnectorConfig[] {
  return CONNECTORS.filter((c) => c.category === category);
}

/**
 * Check if any connectors are connected.
 */
export function hasConnectedConnectors(): boolean {
  const state = connectorsStore.get();

  return Object.values(state).some((s) => s.isConnected);
}

/**
 * Open settings modal.
 */
export function openSettingsModal(tab: 'account' | 'connectors' | 'github' = 'connectors'): void {
  activeSettingsTab.set(tab);
  settingsModalOpen.set(true);
}

/**
 * Close settings modal.
 */
export function closeSettingsModal(): void {
  settingsModalOpen.set(false);
}

/*
 * ============================================================================
 * OAuth Integration Functions
 * ============================================================================
 */

/**
 * Check if a connector uses OAuth authentication.
 */
export function isOAuthConnector(id: ConnectorId): boolean {
  const config = getConnectorConfig(id);

  return config?.authMethod === 'oauth';
}

/**
 * Get the authentication method for a connector.
 */
export function getAuthMethod(id: ConnectorId): AuthMethod {
  const config = getConnectorConfig(id);

  return config?.authMethod || 'api_key';
}

/**
 * Initiate OAuth flow for a connector.
 * Redirects to /api/auth/:provider
 */
export function initiateOAuth(id: ConnectorId): void {
  if (!isOAuthConnector(id)) {
    console.error(`Connector ${id} does not support OAuth`);

    return;
  }

  // Redirect to OAuth initiation endpoint
  window.location.href = `/api/auth/${id}`;
}

/**
 * Handle OAuth callback success.
 * Called after successful OAuth flow to update connector state.
 */
export function handleOAuthSuccess(providerId: string): void {
  const id = providerId as ConnectorId;

  if (!CONNECTORS.find((c) => c.id === id)) {
    console.error(`Unknown connector: ${providerId}`);

    return;
  }

  // Get the token from OAuth tokens store
  const accessToken = getAccessToken(providerId);

  if (!accessToken) {
    console.error(`No OAuth token found for ${providerId}`);

    return;
  }

  const current = connectorsStore.get();

  const newState: ConnectorsState = {
    ...current,
    [id]: {
      isConnected: true,
      credentials: { accessToken },
      lastConnected: Date.now(),
      isOAuth: true,
    },
  };

  connectorsStore.set(newState);
  persistState(newState);

  // Sync with git-settings if GitHub
  if (id === 'github') {
    setGitToken(accessToken);
  }
}

/**
 * Disconnect an OAuth connector.
 */
export function disconnectOAuthConnector(id: ConnectorId): void {
  if (!isOAuthConnector(id)) {
    disconnectConnector(id);

    return;
  }

  // Remove from OAuth tokens store
  removeToken(id);

  // Update connector state
  const current = connectorsStore.get();

  const newState: ConnectorsState = {
    ...current,
    [id]: {
      isConnected: false,
      credentials: {},
      isOAuth: true,
    },
  };

  connectorsStore.set(newState);
  persistState(newState);

  // Sync with git-settings if GitHub
  if (id === 'github') {
    setGitToken(null);
  }
}

/**
 * Check if an OAuth connector needs token refresh.
 */
export function needsTokenRefresh(id: ConnectorId): boolean {
  if (!isOAuthConnector(id)) {
    return false;
  }

  return isTokenExpired(id);
}

/**
 * Get OAuth connectors list.
 */
export function getOAuthConnectors(): ConnectorConfig[] {
  return CONNECTORS.filter((c) => c.authMethod === 'oauth');
}

/**
 * Get API key connectors list.
 */
export function getApiKeyConnectors(): ConnectorConfig[] {
  return CONNECTORS.filter((c) => !c.authMethod || c.authMethod === 'api_key');
}

/*
 * ============================================================================
 * OAuth Token Store Synchronization
 * ============================================================================
 */

/**
 * Sync OAuth tokens to connector states.
 * Handles both initial load and ongoing changes.
 */
function syncOAuthTokensToConnectors(): void {
  const tokens = oauthTokensStore.get();
  const current = connectorsStore.get();
  let hasChanges = false;
  const newState = { ...current };

  // Sync connected OAuth tokens
  for (const [providerId, token] of Object.entries(tokens)) {
    const id = providerId as ConnectorId;

    if (!CONNECTORS.find((c) => c.id === id)) {
      continue;
    }

    if (token && isProviderConnected(providerId) && !current[id].isConnected) {
      newState[id] = {
        isConnected: true,
        credentials: { accessToken: token.accessToken },
        lastConnected: token.connectedAt,
        isOAuth: true,
        expiresAt: token.expiresAt,
      };
      hasChanges = true;

      if (id === 'github') {
        setGitToken(token.accessToken);
      }
    }
  }

  // Handle disconnected OAuth providers
  for (const connector of CONNECTORS.filter((c) => c.authMethod === 'oauth')) {
    if (current[connector.id].isConnected && current[connector.id].isOAuth && !tokens[connector.id]) {
      newState[connector.id] = {
        isConnected: false,
        credentials: {},
        isOAuth: true,
      };
      hasChanges = true;

      if (connector.id === 'github') {
        setGitToken(null);
      }
    }
  }

  if (hasChanges) {
    connectorsStore.set(newState);
    persistState(newState);
  }
}

/**
 * Initialize OAuth integration.
 * Should be called on app startup.
 */
export function initializeOAuthIntegration(): void {
  if (import.meta.env.SSR) {
    return;
  }

  // Initialize OAuth tokens from localStorage
  initializeOAuthTokens();

  // Initial sync
  syncOAuthTokensToConnectors();

  // Subscribe to ongoing changes
  oauthTokensStore.subscribe(() => syncOAuthTokensToConnectors());
}

// Initialize OAuth integration on module load (client-side only)
if (!import.meta.env.SSR) {
  // Use setTimeout to ensure this runs after the module is fully loaded
  setTimeout(() => {
    initializeOAuthIntegration();
  }, 0);
}
