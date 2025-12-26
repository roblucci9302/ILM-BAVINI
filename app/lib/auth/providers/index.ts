/**
 * OAuth Providers Registry
 *
 * Centralized registry for all OAuth provider configurations
 * Core providers only: GitHub, Supabase, Netlify
 */

import type { OAuthProviderConfig } from '../oauth';
import type { CloudflareEnv } from '../env';
import { createGitHubProvider, getGitHubUser, verifyGitHubToken, type GitHubUser } from './github';
import { createNetlifyProvider, getNetlifyUser, verifyNetlifyToken, type NetlifyUser } from './netlify';
import { createSupabaseProvider, getSupabaseOrganizations, getSupabaseProjects, verifySupabaseToken } from './supabase';

// Re-export provider types
export type { GitHubUser } from './github';
export type { NetlifyUser } from './netlify';

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
 * Provider registry - maps provider IDs to their factory functions
 */
const PROVIDER_REGISTRY = {
  github: {
    create: (env: CloudflareEnv) =>
      env.GITHUB_CLIENT_ID ? createGitHubProvider(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET) : null,
    getUser: getGitHubUser,
    verify: verifyGitHubToken,
  },
  netlify: {
    create: (env: CloudflareEnv) =>
      env.NETLIFY_CLIENT_ID ? createNetlifyProvider(env.NETLIFY_CLIENT_ID, env.NETLIFY_CLIENT_SECRET) : null,
    getUser: getNetlifyUser,
    verify: verifyNetlifyToken,
  },
  supabase: {
    create: (env: CloudflareEnv) =>
      env.SUPABASE_CLIENT_ID ? createSupabaseProvider(env.SUPABASE_CLIENT_ID, env.SUPABASE_CLIENT_SECRET) : null,
    getUser: async (token: string) => {
      const orgs = await getSupabaseOrganizations(token);
      return {
        id: orgs[0]?.id || 'unknown',
        name: orgs[0]?.name || 'Supabase User',
        email: '',
        avatar_url: null,
      } as unknown as ProviderUser;
    },
    verify: verifySupabaseToken,
  },
} as const;

/**
 * Get OAuth provider configuration by ID
 */
export function getProviderConfig(providerId: OAuthProviderId, env: CloudflareEnv): OAuthProviderConfig | null {
  const provider = PROVIDER_REGISTRY[providerId];
  return provider?.create(env) ?? null;
}

/**
 * Fetch user info for a provider using access token
 */
export async function getProviderUser(providerId: OAuthProviderId, accessToken: string): Promise<ProviderUser> {
  const provider = PROVIDER_REGISTRY[providerId];

  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  return provider.getUser(accessToken);
}

/**
 * Verify a token is still valid for a provider
 */
export async function verifyProviderToken(providerId: OAuthProviderId, accessToken: string): Promise<boolean> {
  const provider = PROVIDER_REGISTRY[providerId];
  return provider?.verify(accessToken) ?? false;
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

// Export Supabase-specific functions
export { getSupabaseOrganizations, getSupabaseProjects };
