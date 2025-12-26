/**
 * Linear OAuth Provider Configuration.
 *
 * Linear OAuth 2.0 implementation with PKCE support.
 * https://linear.app/developers/oauth-2-0-authentication.
 */

import type { OAuthProviderConfig } from '~/lib/auth/oauth';

/**
 * Linear OAuth scopes.
 * https://developers.linear.app/docs/oauth/authentication.
 */
export const LINEAR_SCOPES = {
  READ: 'read',
  WRITE: 'write',
  ISSUES_CREATE: 'issues:create',
  COMMENTS_CREATE: 'comments:create',
  ADMIN: 'admin',
} as const;

/**
 * Default scopes for BAVINI Linear integration.
 */
export const DEFAULT_LINEAR_SCOPES = [LINEAR_SCOPES.READ, LINEAR_SCOPES.WRITE];

/**
 * Create Linear OAuth provider configuration.
 */
export function createLinearProvider(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    id: 'linear',
    name: 'Linear',
    authorizationUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    scopes: DEFAULT_LINEAR_SCOPES,
    clientId,
    clientSecret,
    usePKCE: true,
  };
}

/**
 * Linear user info response.
 */
export interface LinearUser {
  id: string;
  name: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  admin: boolean;
  active: boolean;
  createdAt: string;
}

/**
 * Fetch Linear user info using access token (GraphQL API).
 */
export async function getLinearUser(accessToken: string): Promise<LinearUser> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query Me {
          viewer {
            id
            name
            displayName
            email
            avatarUrl
            admin
            active
            createdAt
          }
        }
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Linear user: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { data: { viewer: LinearUser } };

  if (!data.data?.viewer) {
    throw new Error('Failed to fetch Linear user: Invalid response');
  }

  return data.data.viewer;
}

/**
 * Verify Linear token is still valid.
 */
export async function verifyLinearToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { viewer { id } }`,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Refresh Linear access token.
 */
export async function refreshLinearToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Linear token: ${response.status} - ${error}`);
  }

  return response.json();
}
