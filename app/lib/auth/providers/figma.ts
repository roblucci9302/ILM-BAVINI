/**
 * Figma OAuth Provider Configuration
 *
 * Figma OAuth 2.0 implementation
 * https://www.figma.com/developers/api#oauth2
 */

import type { OAuthProviderConfig } from '../oauth';

/**
 * Figma OAuth scopes
 * https://www.figma.com/developers/api#oauth-scopes
 */
export const FIGMA_SCOPES = {
  FILE_READ: 'file_read',
  FILE_DEV_RESOURCES_READ: 'file_dev_resources:read',
  FILE_DEV_RESOURCES_WRITE: 'file_dev_resources:write',
  WEBHOOKS_WRITE: 'webhooks:write',
} as const;

/**
 * Default scopes for BAVINI Figma integration
 */
export const DEFAULT_FIGMA_SCOPES = [FIGMA_SCOPES.FILE_READ];

/**
 * Create Figma OAuth provider configuration
 */
export function createFigmaProvider(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    id: 'figma',
    name: 'Figma',
    authorizationUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    scopes: DEFAULT_FIGMA_SCOPES,
    clientId,
    clientSecret,
    usePKCE: false, // Figma uses client_secret
  };
}

/**
 * Figma user info response
 */
export interface FigmaUser {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}

/**
 * Fetch Figma user info using access token
 */
export async function getFigmaUser(accessToken: string): Promise<FigmaUser> {
  const response = await fetch('https://api.figma.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Figma user: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Verify Figma token is still valid
 */
export async function verifyFigmaToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.figma.com/v1/me', {
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
 * Refresh Figma access token
 * Figma tokens expire after a certain period and need to be refreshed
 */
export async function refreshFigmaToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://www.figma.com/api/oauth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Figma token: ${response.status} - ${error}`);
  }

  return response.json();
}
