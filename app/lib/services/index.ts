/**
 * Services SDK Index.
 *
 * This file exports all service SDK modules for easy access.
 * Each service provides a lightweight API client using native fetch().
 *
 * Core services only: GitHub, Supabase, Netlify
 */

// GitHub - Repository & Issue Management
export * as github from './github';

// Netlify - Deployment & Hosting
export * as netlify from './netlify';

// Supabase - Database, Auth & Storage
export * as supabase from './supabase';

// Checkpoints - Time Travel feature
export * as checkpoints from './checkpoints';

// Re-export client classes for direct import
export { GitHubClient, createGitHubClient } from './github';
export { NetlifyClient, createNetlifyClient } from './netlify';
export { SupabaseClient, createSupabaseClient } from './supabase';
export { CheckpointService, createCheckpointService } from './checkpoints';
