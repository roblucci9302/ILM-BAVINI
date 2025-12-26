/**
 * OAuth Callback Route
 *
 * GET /api/auth/callback
 *
 * Handles OAuth callback from providers
 * Exchanges authorization code for tokens and returns to client
 */

import { type LoaderFunctionArgs, redirect } from '@remix-run/cloudflare';
import { validateState, isStateExpired, exchangeCodeForTokens } from '~/lib/auth/oauth';
import { getProviderConfig, type OAuthProviderId } from '~/lib/auth/providers';

/**
 * Environment interface for Cloudflare
 * Core providers only: GitHub, Supabase, Netlify
 */
interface CloudflareEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  NETLIFY_CLIENT_ID?: string;
  NETLIFY_CLIENT_SECRET?: string;
  SUPABASE_CLIENT_ID?: string;
  SUPABASE_CLIENT_SECRET?: string;
}

/**
 * OAuth state stored in cookie
 */
interface OAuthStateCookie {
  provider: string;
  state: string;
  codeVerifier?: string;
  redirectUri: string;
  createdAt: number;
}

/**
 * Parse cookie header to get specific cookie value
 */
function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());

  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split('=');

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OAuth errors from provider
  if (error) {
    const errorMessage = errorDescription || error;

    return redirect(`/?oauth_error=${encodeURIComponent(errorMessage)}`);
  }

  // Validate required parameters
  if (!code || !state) {
    return redirect('/?oauth_error=' + encodeURIComponent('Paramètres OAuth manquants'));
  }

  // Get stored state from cookie
  const cookieHeader = request.headers.get('Cookie');
  const storedStateJson = getCookie(cookieHeader, 'bavini_oauth_state');

  if (!storedStateJson) {
    return redirect('/?oauth_error=' + encodeURIComponent('Session OAuth expirée. Veuillez réessayer.'));
  }

  let storedState: OAuthStateCookie;

  try {
    storedState = JSON.parse(storedStateJson);
  } catch {
    return redirect('/?oauth_error=' + encodeURIComponent('Session OAuth invalide'));
  }

  // Validate state to prevent CSRF
  if (!validateState(state, storedState.state)) {
    return redirect('/?oauth_error=' + encodeURIComponent('Validation OAuth échouée (CSRF)'));
  }

  // Check if state is expired
  if (isStateExpired(storedState.createdAt)) {
    return redirect('/?oauth_error=' + encodeURIComponent('Session OAuth expirée. Veuillez réessayer.'));
  }

  const env = context.cloudflare.env as CloudflareEnv;
  const provider = storedState.provider as OAuthProviderId;

  // Get provider configuration
  const config = getProviderConfig(provider, env);

  if (!config) {
    return redirect('/?oauth_error=' + encodeURIComponent(`Provider ${provider} non configuré`));
  }

  try {
    // Standard OAuth token exchange for all providers
    const tokenResponse = await exchangeCodeForTokens(config, code, storedState.redirectUri, storedState.codeVerifier);

    /*
     * Create a response that will pass the token to the client
     * We use a temporary page that stores the token and redirects
     */
    const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Connexion réussie - BAVINI</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0a0a0a;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #22c55e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Connexion réussie!</h1>
    <p>Redirection en cours...</p>
  </div>
  <script>
    // Store token data in localStorage
    const tokenData = ${JSON.stringify({
      provider,
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresIn: tokenResponse.expires_in,
      refreshToken: tokenResponse.refresh_token,
      scope: tokenResponse.scope,
      connectedAt: Date.now(),
    })};

    // Store in localStorage for the app to pick up
    const storageKey = 'bavini_oauth_tokens';
    const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
    existing[tokenData.provider] = {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenType: tokenData.tokenType,
      scope: tokenData.scope,
      connectedAt: tokenData.connectedAt,
      expiresAt: tokenData.expiresIn
        ? Date.now() + (tokenData.expiresIn * 1000)
        : undefined
    };
    localStorage.setItem(storageKey, JSON.stringify(existing));

    // Dispatch custom event for the app to know
    window.dispatchEvent(new CustomEvent('oauth-success', {
      detail: { provider: tokenData.provider }
    }));

    // Redirect to settings with success message
    window.location.href = '/?oauth_success=' + tokenData.provider;
  </script>
</body>
</html>
    `.trim();

    // Clear the OAuth state cookie
    return new Response(successHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': 'bavini_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Échec de connexion OAuth';
    console.error('OAuth callback error:', err);

    return redirect('/?oauth_error=' + encodeURIComponent(errorMessage));
  }
}
