/**
 * OAuth Token Refresh Route
 *
 * POST /api/auth/refresh
 *
 * Refreshes an expired access token using the refresh token
 * Returns new access token (and possibly new refresh token)
 */

import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { refreshAccessToken } from '~/lib/auth/oauth';
import { getProviderConfig, refreshFigmaToken, type OAuthProviderId } from '~/lib/auth/providers';

/**
 * Environment interface for Cloudflare
 */
interface CloudflareEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  FIGMA_CLIENT_ID?: string;
  FIGMA_CLIENT_SECRET?: string;
  NOTION_CLIENT_ID?: string;
  NOTION_CLIENT_SECRET?: string;
}

/**
 * Request body for token refresh
 */
interface RefreshRequest {
  provider: string;
  refreshToken: string;
}

export async function action({ request, context }: ActionFunctionArgs) {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RefreshRequest;

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { provider, refreshToken } = body;

  // Validate required fields
  if (!provider || !refreshToken) {
    return new Response(JSON.stringify({ error: 'provider et refreshToken sont requis' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const env = context.cloudflare.env as CloudflareEnv;

  // Get provider configuration
  const config = getProviderConfig(provider as OAuthProviderId, env);

  if (!config) {
    return new Response(JSON.stringify({ error: `Provider ${provider} non configuré` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let tokenResponse;

    // Figma has a different refresh endpoint
    if (provider === 'figma' && config.clientSecret) {
      const figmaResponse = await refreshFigmaToken(config.clientId, config.clientSecret, refreshToken);

      tokenResponse = {
        access_token: figmaResponse.access_token,
        token_type: 'Bearer',
        expires_in: figmaResponse.expires_in,
      };
    } else if (provider === 'notion') {
      // Notion tokens don't expire and can't be refreshed
      return new Response(JSON.stringify({ error: "Les tokens Notion n'expirent pas" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (provider === 'github') {
      /*
       * GitHub OAuth tokens don't expire (only OAuth Apps, not GitHub Apps)
       * For GitHub Apps with expiring tokens, you would need to use the refresh flow
       */
      return new Response(JSON.stringify({ error: "Les tokens GitHub OAuth n'expirent pas" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Standard OAuth refresh
      tokenResponse = await refreshAccessToken(config, refreshToken);
    }

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        expiresIn: tokenResponse.expires_in,
        refreshToken: tokenResponse.refresh_token,
        scope: tokenResponse.scope,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Échec du rafraîchissement du token';
    console.error('Token refresh error:', err);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Reject GET requests
 */
export async function loader() {
  return new Response(JSON.stringify({ error: 'Use POST method' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
