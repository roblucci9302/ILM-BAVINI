/**
 * Git settings store for managing GitHub authentication.
 * Uses localStorage for persistence across sessions.
 *
 * NOTE: This store is maintained for backwards compatibility.
 * GitHub authentication is now handled through the OAuth system
 * in lib/auth/. The connectors store syncs the OAuth token to
 * this store to support existing code that uses getGitToken().
 *
 * For new integrations, prefer using the OAuth system directly:
 * - lib/auth/tokens.ts for token management
 * - lib/stores/connectors.ts for connector state
 *
 * @deprecated Use OAuth integration through lib/auth/ for new code
 */

import { atom } from 'nanostores';

export const kGitToken = 'bavini_git_token';

export interface GitSettings {
  token: string | null;

  /** Source of the token: 'oauth' or 'manual' (legacy) */
  source?: 'oauth' | 'manual';
}

/**
 * Initialize the git settings store from localStorage.
 */
function initStore(): GitSettings {
  if (!import.meta.env.SSR) {
    const persistedToken = localStorage.getItem(kGitToken);

    return {
      token: persistedToken,
    };
  }

  return { token: null };
}

export const gitSettingsStore = atom<GitSettings>(initStore());

/**
 * Set the GitHub token and persist to localStorage.
 * @param token The GitHub token or null to clear
 * @param source Optional source indicator ('oauth' for OAuth, 'manual' for legacy)
 */
export function setGitToken(token: string | null, source?: 'oauth' | 'manual'): void {
  gitSettingsStore.set({ token, source: token ? source : undefined });

  if (!import.meta.env.SSR) {
    if (token) {
      localStorage.setItem(kGitToken, token);
    } else {
      localStorage.removeItem(kGitToken);
    }
  }
}

/**
 * Check if the current token is from OAuth.
 */
export function isOAuthToken(): boolean {
  return gitSettingsStore.get().source === 'oauth';
}

/**
 * Get the current GitHub token.
 */
export function getGitToken(): string | null {
  return gitSettingsStore.get().token;
}

/**
 * Clear the GitHub token from storage.
 */
export function clearGitToken(): void {
  setGitToken(null);
}
