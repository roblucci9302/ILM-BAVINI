/**
 * Atlassian OAuth Provider Configuration.
 *
 * Atlassian OAuth 2.0 (3LO) implementation.
 * https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/.
 */

import type { OAuthProviderConfig } from '~/lib/auth/oauth';

/**
 * Atlassian OAuth scopes.
 */
export const ATLASSIAN_SCOPES = {
  READ_JIRA_WORK: 'read:jira-work',
  WRITE_JIRA_WORK: 'write:jira-work',
  READ_JIRA_USER: 'read:jira-user',
  READ_ME: 'read:me',
  OFFLINE_ACCESS: 'offline_access',
} as const;

/**
 * Default scopes for BAVINI Atlassian integration.
 */
export const DEFAULT_ATLASSIAN_SCOPES = [
  ATLASSIAN_SCOPES.READ_JIRA_WORK,
  ATLASSIAN_SCOPES.WRITE_JIRA_WORK,
  ATLASSIAN_SCOPES.READ_JIRA_USER,
  ATLASSIAN_SCOPES.READ_ME,
  ATLASSIAN_SCOPES.OFFLINE_ACCESS,
];

/**
 * Create Atlassian OAuth provider configuration.
 */
export function createAtlassianProvider(clientId: string, clientSecret?: string): OAuthProviderConfig {
  return {
    id: 'atlassian',
    name: 'Atlassian',
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: DEFAULT_ATLASSIAN_SCOPES,
    clientId,
    clientSecret,
    usePKCE: false,
  };
}

/**
 * Atlassian user info response.
 */
export interface AtlassianUser {
  account_id: string;
  email: string;
  name: string;
  picture: string;
  account_status: string;
  nickname: string;
  email_verified: boolean;
}

/**
 * Atlassian accessible resource (site).
 */
export interface AtlassianSite {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl: string;
}

/**
 * Fetch Atlassian user info using access token.
 */
export async function getAtlassianUser(accessToken: string): Promise<AtlassianUser> {
  const response = await fetch('https://api.atlassian.com/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Atlassian user: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Fetch Atlassian accessible resources (sites).
 */
export async function getAtlassianSites(accessToken: string): Promise<AtlassianSite[]> {
  const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Atlassian sites: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Verify Atlassian token is still valid.
 */
export async function verifyAtlassianToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.atlassian.com/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Refresh Atlassian access token.
 */
export async function refreshAtlassianToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Atlassian token: ${response.status} - ${error}`);
  }

  return response.json();
}
