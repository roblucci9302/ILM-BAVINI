/**
 * Miro OAuth Provider Configuration.
 *
 * Miro OAuth 2.0 implementation.
 * https://developers.miro.com/docs/getting-started-with-oauth.
 */

import type { OAuthProviderConfig } from '~/lib/auth/oauth';

/**
 * Miro OAuth scopes.
 */
export const MIRO_SCOPES = {
  BOARDS_READ: 'boards:read',
  BOARDS_WRITE: 'boards:write',
  IDENTITY_READ: 'identity:read',
} as const;

/**
 * Default scopes for BAVINI Miro integration.
 */
export const DEFAULT_MIRO_SCOPES = [MIRO_SCOPES.BOARDS_READ, MIRO_SCOPES.BOARDS_WRITE, MIRO_SCOPES.IDENTITY_READ];

/**
 * Create Miro OAuth provider configuration.
 */
export function createMiroProvider(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    id: 'miro',
    name: 'Miro',
    authorizationUrl: 'https://miro.com/oauth/authorize',
    tokenUrl: 'https://api.miro.com/v1/oauth/token',
    scopes: DEFAULT_MIRO_SCOPES,
    clientId,
    clientSecret,
    usePKCE: false,
  };
}

/**
 * Miro user info response.
 */
export interface MiroUser {
  id: string;
  name: string;
  email: string;
  picture?: { imageUrl: string };
  createdAt: string;
  modifiedAt: string;
}

/**
 * Fetch Miro user info using access token.
 */
export async function getMiroUser(accessToken: string): Promise<MiroUser> {
  const response = await fetch('https://api.miro.com/v1/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Miro user: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Verify Miro token is still valid.
 */
export async function verifyMiroToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.miro.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Refresh Miro access token.
 */
export async function refreshMiroToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch('https://api.miro.com/v1/oauth/token', {
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
    throw new Error(`Failed to refresh Miro token: ${response.status} - ${error}`);
  }

  return response.json();
}
