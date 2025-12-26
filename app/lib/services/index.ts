/**
 * Services SDK Index.
 *
 * This file exports all service SDK modules for easy access.
 * Each service provides a lightweight API client using native fetch().
 */

// ElevenLabs - Text-to-Speech
export * as elevenlabs from './elevenlabs';

// Firecrawl - Web Scraping & Crawling
export * as firecrawl from './firecrawl';

// GitHub - Repository & Issue Management
export * as github from './github';

// Notion - Pages & Databases
export * as notion from './notion';

// Netlify - Deployment & Hosting
export * as netlify from './netlify';

// Stripe - Payments & Subscriptions
export * as stripe from './stripe';

// Linear - Issue Tracking (GraphQL)
export * as linear from './linear';

// Supabase - Database, Auth & Storage
export * as supabase from './supabase';

// Shopify - E-commerce
export * as shopify from './shopify';

// Figma - Design Files & Components
export * as figma from './figma';

// Atlassian - Jira & Confluence
export * as atlassian from './atlassian';

// Perplexity - AI Search
export * as perplexity from './perplexity';

// n8n - Workflow Automation
export * as n8n from './n8n';

// Miro - Collaborative Whiteboard
export * as miro from './miro';

// Re-export client classes for direct import
export { ElevenLabsClient, createElevenLabsClient } from './elevenlabs/client';
export { FirecrawlClient, createFirecrawlClient } from './firecrawl/client';
export { GitHubClient, createGitHubClient } from './github';
export { NotionClient, createNotionClient } from './notion';
export { NetlifyClient, createNetlifyClient } from './netlify';
export { StripeClient, createStripeClient } from './stripe';
export { LinearClient, createLinearClient } from './linear';
export { SupabaseClient, createSupabaseClient } from './supabase';
export { ShopifyClient, createShopifyClient } from './shopify';
export { FigmaClient, createFigmaClient } from './figma';
export { AtlassianClient, createAtlassianClient } from './atlassian';
export { PerplexityClient, createPerplexityClient } from './perplexity';
export { N8nClient, createN8nClient } from './n8n';
export { MiroClient, createMiroClient } from './miro';
