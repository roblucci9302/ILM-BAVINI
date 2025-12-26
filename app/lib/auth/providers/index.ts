/**
 * OAuth Providers Registry
 *
 * Centralized export of all OAuth provider configurations
 */

import type { OAuthProviderConfig } from '../oauth';
import { createGitHubProvider, getGitHubUser, verifyGitHubToken, type GitHubUser } from './github';
import { createFigmaProvider, getFigmaUser, verifyFigmaToken, refreshFigmaToken, type FigmaUser } from './figma';
import {
  createNotionProvider,
  exchangeNotionCode,
  parseNotionUser,
  verifyNotionToken,
  type NotionUser,
  type NotionTokenResponse,
} from './notion';
import { createLinearProvider, getLinearUser, verifyLinearToken, refreshLinearToken, type LinearUser } from './linear';
import { createNetlifyProvider, getNetlifyUser, verifyNetlifyToken, type NetlifyUser } from './netlify';
import { createMiroProvider, getMiroUser, verifyMiroToken, refreshMiroToken, type MiroUser } from './miro';
import {
  createSupabaseProvider,
  getSupabaseOrganizations,
  getSupabaseProjects,
  verifySupabaseToken,
  refreshSupabaseToken,
} from './supabase';
import {
  createAtlassianProvider,
  getAtlassianUser,
  getAtlassianSites,
  verifyAtlassianToken,
  refreshAtlassianToken,
  type AtlassianUser,
} from './atlassian';
import { createShopifyProvider, getShopifyShop, exchangeShopifyCode, verifyShopifyToken } from './shopify';

// Re-export all providers
export * from './github';
export * from './figma';
export * from './notion';
export * from './linear';
export * from './netlify';
export * from './miro';
export * from './supabase';
export * from './atlassian';
export * from './shopify';

/**
 * Provider IDs that support OAuth
 */
export const OAUTH_PROVIDER_IDS = [
  'github',
  'figma',
  'notion',
  'linear',
  'netlify',
  'miro',
  'supabase',
  'atlassian',
  'shopify',
] as const;
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
export type ProviderUser = GitHubUser | FigmaUser | NotionUser | LinearUser | NetlifyUser | MiroUser | AtlassianUser;

/**
 * Get OAuth provider configuration by ID
 * Requires environment variables for client credentials
 */
export function getProviderConfig(
  providerId: OAuthProviderId,
  env: {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    FIGMA_CLIENT_ID?: string;
    FIGMA_CLIENT_SECRET?: string;
    NOTION_CLIENT_ID?: string;
    NOTION_CLIENT_SECRET?: string;
    LINEAR_CLIENT_ID?: string;
    LINEAR_CLIENT_SECRET?: string;
    NETLIFY_CLIENT_ID?: string;
    NETLIFY_CLIENT_SECRET?: string;
    MIRO_CLIENT_ID?: string;
    MIRO_CLIENT_SECRET?: string;
    SUPABASE_CLIENT_ID?: string;
    SUPABASE_CLIENT_SECRET?: string;
    ATLASSIAN_CLIENT_ID?: string;
    ATLASSIAN_CLIENT_SECRET?: string;
    SHOPIFY_CLIENT_ID?: string;
    SHOPIFY_CLIENT_SECRET?: string;
  },
): OAuthProviderConfig | null {
  switch (providerId) {
    case 'github':
      if (!env.GITHUB_CLIENT_ID) {
        return null;
      }

      return createGitHubProvider(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

    case 'figma':
      if (!env.FIGMA_CLIENT_ID) {
        return null;
      }

      return createFigmaProvider(env.FIGMA_CLIENT_ID, env.FIGMA_CLIENT_SECRET);

    case 'notion':
      if (!env.NOTION_CLIENT_ID) {
        return null;
      }

      return createNotionProvider(env.NOTION_CLIENT_ID, env.NOTION_CLIENT_SECRET);

    case 'linear':
      if (!env.LINEAR_CLIENT_ID) {
        return null;
      }

      return createLinearProvider(env.LINEAR_CLIENT_ID, env.LINEAR_CLIENT_SECRET);

    case 'netlify':
      if (!env.NETLIFY_CLIENT_ID) {
        return null;
      }

      return createNetlifyProvider(env.NETLIFY_CLIENT_ID, env.NETLIFY_CLIENT_SECRET);

    case 'miro':
      if (!env.MIRO_CLIENT_ID) {
        return null;
      }

      return createMiroProvider(env.MIRO_CLIENT_ID, env.MIRO_CLIENT_SECRET);

    case 'supabase':
      if (!env.SUPABASE_CLIENT_ID) {
        return null;
      }

      return createSupabaseProvider(env.SUPABASE_CLIENT_ID, env.SUPABASE_CLIENT_SECRET);

    case 'atlassian':
      if (!env.ATLASSIAN_CLIENT_ID) {
        return null;
      }

      return createAtlassianProvider(env.ATLASSIAN_CLIENT_ID, env.ATLASSIAN_CLIENT_SECRET);

    case 'shopify':
      if (!env.SHOPIFY_CLIENT_ID) {
        return null;
      }

      return createShopifyProvider(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);

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

    case 'figma':
      return getFigmaUser(accessToken);

    case 'notion': {
      const response = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Notion user');
      }

      const data = (await response.json()) as {
        id: string;
        name?: string;
        avatar_url?: string;
        person?: { email?: string };
      };

      return {
        id: data.id,
        name: data.name || 'Notion User',
        avatar_url: data.avatar_url || null,
        email: data.person?.email,
        workspace_id: '',
        workspace_name: null,
      } as NotionUser;
    }

    case 'linear':
      return getLinearUser(accessToken);

    case 'netlify':
      return getNetlifyUser(accessToken);

    case 'miro':
      return getMiroUser(accessToken);

    case 'supabase': {
      const orgs = await getSupabaseOrganizations(accessToken);

      return {
        id: orgs[0]?.id || 'unknown',
        name: orgs[0]?.name || 'Supabase User',
        email: '',
        avatar_url: null,
      } as unknown as ProviderUser;
    }

    case 'atlassian':
      return getAtlassianUser(accessToken);

    case 'shopify': {
      return {
        id: 'shopify-user',
        name: 'Shopify Store',
        email: '',
      } as unknown as ProviderUser;
    }

    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

/**
 * Verify a token is still valid for a provider
 */
export async function verifyProviderToken(
  providerId: OAuthProviderId,
  accessToken: string,
  extra?: { shopDomain?: string },
): Promise<boolean> {
  switch (providerId) {
    case 'github':
      return verifyGitHubToken(accessToken);

    case 'figma':
      return verifyFigmaToken(accessToken);

    case 'notion':
      return verifyNotionToken(accessToken);

    case 'linear':
      return verifyLinearToken(accessToken);

    case 'netlify':
      return verifyNetlifyToken(accessToken);

    case 'miro':
      return verifyMiroToken(accessToken);

    case 'supabase':
      return verifySupabaseToken(accessToken);

    case 'atlassian':
      return verifyAtlassianToken(accessToken);

    case 'shopify':
      if (!extra?.shopDomain) {
        return false;
      }

      return verifyShopifyToken(accessToken, extra.shopDomain);

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
  figma: {
    name: 'Figma',
    icon: 'i-ph:figma-logo',
    color: '#f24e1e',
    description: 'Design files and components',
  },
  notion: {
    name: 'Notion',
    icon: 'i-ph:notion-logo',
    color: '#000000',
    description: 'Pages, databases, workspaces',
  },
  linear: {
    name: 'Linear',
    icon: 'i-ph:kanban',
    color: '#5E6AD2',
    description: 'Issues, projects, roadmaps',
  },
  netlify: {
    name: 'Netlify',
    icon: 'i-ph:cloud-arrow-up',
    color: '#00C7B7',
    description: 'Deployments, sites, functions',
  },
  miro: {
    name: 'Miro',
    icon: 'i-ph:presentation-chart',
    color: '#FFD02F',
    description: 'Boards, collaboration, diagrams',
  },
  supabase: {
    name: 'Supabase',
    icon: 'i-ph:database',
    color: '#3ECF8E',
    description: 'Projects, databases, authentication',
  },
  atlassian: {
    name: 'Atlassian',
    icon: 'i-ph:trello-logo',
    color: '#0052CC',
    description: 'Jira, Confluence, projects',
  },
  shopify: {
    name: 'Shopify',
    icon: 'i-ph:shopping-bag',
    color: '#96BF48',
    description: 'Products, orders, customers',
  },
};

// Export specific functions for use in routes
export {
  exchangeNotionCode,
  parseNotionUser,
  refreshFigmaToken,
  refreshLinearToken,
  refreshMiroToken,
  refreshSupabaseToken,
  refreshAtlassianToken,
  exchangeShopifyCode,
  getSupabaseOrganizations,
  getSupabaseProjects,
  getAtlassianSites,
  getShopifyShop,
};
