/**
 * Cloudflare Environment Types
 *
 * Shared environment interface for OAuth provider secrets
 * Core providers only: GitHub, Supabase, Netlify
 */

/**
 * OAuth environment variables available in Cloudflare Workers
 */
export interface CloudflareEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  NETLIFY_CLIENT_ID?: string;
  NETLIFY_CLIENT_SECRET?: string;
  SUPABASE_CLIENT_ID?: string;
  SUPABASE_CLIENT_SECRET?: string;
}

/**
 * Type for accessing Cloudflare context in Remix loaders/actions
 */
export interface CloudflareContext {
  cloudflare: {
    env: CloudflareEnv;
  };
}
