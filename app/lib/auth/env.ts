/**
 * Cloudflare Environment Types
 *
 * Shared environment interface for Cloudflare Workers/Pages.
 * This extends the global Env interface with OAuth-specific helpers.
 *
 * @see worker-configuration.d.ts for the complete Env interface
 */

/**
 * OAuth environment variables available in Cloudflare Workers
 * This is a subset of Env focused on OAuth provider secrets.
 */
export interface CloudflareEnv {
  // OAuth Providers
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  NETLIFY_CLIENT_ID?: string;
  NETLIFY_CLIENT_SECRET?: string;
  SUPABASE_CLIENT_ID?: string;
  SUPABASE_CLIENT_SECRET?: string;

  // API Keys
  ANTHROPIC_API_KEY?: string;
  ADMIN_API_KEY?: string;

  // Environment
  ENVIRONMENT?: string;

  // KV/R2 Bindings (optional - may not be present in all contexts)
  TEMPLATES_KV?: KVNamespace;
  TEMPLATES_R2?: R2Bucket;
}

/**
 * Type for accessing Cloudflare context in Remix loaders/actions
 */
export interface CloudflareContext {
  cloudflare: {
    env: CloudflareEnv;
  };
}

/**
 * Helper to check if OAuth provider is configured
 */
export function isProviderConfigured(
  env: CloudflareEnv,
  provider: 'github' | 'netlify' | 'supabase'
): boolean {
  switch (provider) {
    case 'github':
      return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
    case 'netlify':
      return Boolean(env.NETLIFY_CLIENT_ID && env.NETLIFY_CLIENT_SECRET);
    case 'supabase':
      return Boolean(env.SUPABASE_CLIENT_ID && env.SUPABASE_CLIENT_SECRET);
    default:
      return false;
  }
}
