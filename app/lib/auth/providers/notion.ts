/**
 * Notion OAuth Provider Configuration
 *
 * Notion OAuth 2.0 implementation (Public Integration)
 * https://developers.notion.com/docs/authorization
 */

import type { OAuthProviderConfig } from '../oauth';

/**
 * Notion doesn't use granular scopes - access is determined by the pages
 * the user shares with the integration during the OAuth flow
 */

/**
 * Create Notion OAuth provider configuration
 */
export function createNotionProvider(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    id: 'notion',
    name: 'Notion',
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [], // Notion doesn't use scopes in the authorization URL
    clientId,
    clientSecret,
    usePKCE: false, // Notion uses Basic Auth with client credentials
  };
}

/**
 * Notion OAuth token response (different from standard)
 */
export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  owner: {
    type: 'user' | 'workspace';
    user?: {
      id: string;
      name: string;
      avatar_url: string | null;
      type: string;
      person?: {
        email: string;
      };
    };
  };
  duplicated_template_id: string | null;
}

/**
 * Exchange Notion authorization code for token
 * Notion requires Basic Auth header with client credentials
 */
export async function exchangeNotionCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<NotionTokenResponse> {
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Notion code: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Notion user info (from token response owner)
 */
export interface NotionUser {
  id: string;
  name: string;
  avatar_url: string | null;
  email?: string;
  workspace_id: string;
  workspace_name: string | null;
}

/**
 * Parse Notion user from token response
 */
export function parseNotionUser(tokenResponse: NotionTokenResponse): NotionUser {
  const owner = tokenResponse.owner;

  return {
    id: owner.user?.id || tokenResponse.bot_id,
    name: owner.user?.name || tokenResponse.workspace_name || 'Notion User',
    avatar_url: owner.user?.avatar_url || tokenResponse.workspace_icon,
    email: owner.user?.person?.email,
    workspace_id: tokenResponse.workspace_id,
    workspace_name: tokenResponse.workspace_name,
  };
}

/**
 * Verify Notion token is still valid
 */
export async function verifyNotionToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Search Notion pages/databases accessible by the integration
 */
export async function searchNotion(
  accessToken: string,
  query?: string,
): Promise<{
  results: Array<{ id: string; object: string; [key: string]: unknown }>;
  has_more: boolean;
}> {
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(query ? { query } : {}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search Notion: ${response.status} - ${error}`);
  }

  return response.json();
}
