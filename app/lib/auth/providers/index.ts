/**
 * OAuth Providers Registry
 *
 * Centralized export of all OAuth provider configurations
 * Core providers only: GitHub, Supabase, Netlify
 */

import type { OAuthProviderConfig } from '../oauth';
import { createGitHubProvider, getGitHubUser, verifyGitHubToken, type GitHubUser } from './github';
import { createNetlifyProvider, getNetlifyUser, verifyNetlifyToken, type NetlifyUser } from './netlify';
import {
  createSupabaseProvider,
  getSupabaseOrganizations,
  getSupabaseProjects,
  verifySupabaseToken,
  refreshSupabaseToken,
} from './supabase';

// Re-export all providers
export * from './github';
export * from './netlify';
export * from './supabase';

/**
 * Provider IDs that support OAuth
 */
export const OAUTH_PROVIDER_IDS = ['github', 'netlify', 'supabase'] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

/**
 * Check if a connector ID supports OAuth
 */
export function supportsOAuth(connectorId: string): connectorId is OAuthProviderId {
  return OAUTH_PROVIDER_IDS.includes(connectorId as OAuthProviderId);
}

/**
 * Provider user info union type
 */
export type ProviderUser = GitHubUser | NetlifyUser;

/**
 * Get OAuth provider configuration by ID
 * Requires environment variables for client credentials
 */
export function getProviderConfig(
  providerId: OAuthProviderId,
  env: {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    NETLIFY_CLIENT_ID?: string;
    NETLIFY_CLIENT_SECRET?: string;
    SUPABASE_CLIENT_ID?: string;
    SUPABASE_CLIENT_SECRET?: string;
  },
): OAuthProviderConfig | null {
  switch (providerId) {
    case 'github':
      if (!env.GITHUB_CLIENT_ID) {
        return null;
      }

      return createGitHubProvider(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

    case 'netlify':
      if (!env.NETLIFY_CLIENT_ID) {
        return null;
      }

      return createNetlifyProvider(env.NETLIFY_CLIENT_ID, env.NETLIFY_CLIENT_SECRET);

    case 'supabase':
      if (!env.SUPABASE_CLIENT_ID) {
        return null;
      }

      return createSupabaseProvider(env.SUPABASE_CLIENT_ID, env.SUPABASE_CLIENT_SECRET);

    default:
      return null;
  }
}

/**
 * Fetch user info for a provider using access token
 */
export async function getProviderUser(providerId: OAuthProviderId, accessToken: string): Promise<ProviderUser> {
  switch (providerId) {
    case 'github':
      return getGitHubUser(accessToken);

    case 'netlify':
      return getNetlifyUser(accessToken);

    case 'supabase': {
      const orgs = await getSupabaseOrganizations(accessToken);

      return {
        id: orgs[0]?.id || 'unknown',
        name: orgs[0]?.name || 'Supabase User',
        email: '',
        avatar_url: null,
      } as unknown as ProviderUser;
    }

    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

/**
 * Verify a token is still valid for a provider
 */
export async function verifyProviderToken(providerId: OAuthProviderId, accessToken: string): Promise<boolean> {
  switch (providerId) {
    case 'github':
      return verifyGitHubToken(accessToken);

    case 'netlify':
      return verifyNetlifyToken(accessToken);

    case 'supabase':
      return verifySupabaseToken(accessToken);

    default:
      return false;
  }
}

/**
 * Provider display info for UI
 */
export const PROVIDER_DISPLAY_INFO: Record<
  OAuthProviderId,
  {
    name: string;
    icon: string;
    color: string;
    description: string;
  }
> = {
  github: {
    name: 'GitHub',
    icon: 'i-ph:github-logo',
    color: '#24292e',
    description: 'Repositories, issues, pull requests',
  },
  netlify: {
    name: 'Netlify',
    icon: 'i-ph:cloud-arrow-up',
    color: '#00C7B7',
    description: 'Deployments, sites, functions',
  },
  supabase: {
    name: 'Supabase',
    icon: 'i-ph:database',
    color: '#3ECF8E',
    description: 'Projects, databases, authentication',
  },
};

// Export specific functions for use in routes
export { getSupabaseOrganizations, getSupabaseProjects, refreshSupabaseToken };
