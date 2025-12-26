/**
 * Firecrawl API Types.
 *
 * Type definitions for the Firecrawl web scraping and crawling API.
 */

/**
 * Firecrawl API configuration.
 */
export interface FirecrawlConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Supported output formats for scraping.
 */
export type ScrapeFormat = 'markdown' | 'html' | 'rawHtml' | 'content' | 'links' | 'screenshot' | 'screenshot@fullPage';

/**
 * Options for scraping a single page.
 */
export interface ScrapeOptions {
  url: string;
  formats?: ScrapeFormat[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  headers?: Record<string, string>;
  waitFor?: number;
  timeout?: number;
  mobile?: boolean;
  skipTlsVerification?: boolean;
  removeBase64Images?: boolean;
  location?: {
    country?: string;
    languages?: string[];
  };
}

/**
 * Result from scraping a single page.
 */
export interface ScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    content?: string;
    links?: string[];
    screenshot?: string;
    metadata?: PageMetadata;
  };
  error?: string;
}

/**
 * Page metadata extracted during scraping.
 */
export interface PageMetadata {
  title?: string;
  description?: string;
  language?: string;
  keywords?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
  ogLocaleAlternate?: string[];
  ogSiteName?: string;
  sourceURL?: string;
  statusCode?: number;
}

/**
 * Options for crawling a website.
 */
export interface CrawlOptions {
  url: string;
  excludePaths?: string[];
  includePaths?: string[];
  maxDepth?: number;
  maxPages?: number;
  ignoreSitemap?: boolean;
  ignoreQueryParameters?: boolean;
  limit?: number;
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  webhook?: WebhookConfig;
  scrapeOptions?: Omit<ScrapeOptions, 'url'>;
}

/**
 * Webhook configuration for async crawling.
 */
export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Response when starting a crawl job.
 */
export interface CrawlJobResponse {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

/**
 * Status of a crawl job.
 */
export type CrawlStatus = 'scraping' | 'completed' | 'failed' | 'cancelled';

/**
 * Result of checking crawl job status.
 */
export interface CrawlStatusResponse {
  success: boolean;
  status?: CrawlStatus;
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  next?: string;
  data?: CrawlPageResult[];
  error?: string;
}

/**
 * Single page result from a crawl job.
 */
export interface CrawlPageResult {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  links?: string[];
  screenshot?: string;
  metadata?: PageMetadata;
}

/**
 * Options for map endpoint (getting all URLs from a website).
 */
export interface MapOptions {
  url: string;
  search?: string;
  ignoreSitemap?: boolean;
  sitemapOnly?: boolean;
  includeSubdomains?: boolean;
  limit?: number;
}

/**
 * Result from map endpoint.
 */
export interface MapResult {
  success: boolean;
  links?: string[];
  error?: string;
}

/**
 * Options for extracting structured data.
 */
export interface ExtractOptions {
  urls: string[];
  prompt?: string;
  schema?: Record<string, unknown>;
  systemPrompt?: string;
  allowExternalLinks?: boolean;
  enableWebSearch?: boolean;
  scrapeOptions?: Omit<ScrapeOptions, 'url'>;
}

/**
 * Result from extraction.
 */
export interface ExtractResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  warning?: string;
}

/**
 * Firecrawl API error response.
 */
export interface FirecrawlError {
  success: false;
  error: string;
}

/**
 * Credit usage information.
 */
export interface CreditUsage {
  remaining_credits: number;
}

/**
 * Batch scrape job response.
 */
export interface BatchScrapeResponse {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

/**
 * Batch scrape status response.
 */
export interface BatchScrapeStatusResponse {
  success: boolean;
  status?: CrawlStatus;
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  next?: string;
  data?: ScrapeResult['data'][];
  error?: string;
}

/**
 * Default scrape formats.
 */
export const DEFAULT_SCRAPE_FORMATS: ScrapeFormat[] = ['markdown'];

/**
 * Default crawl options.
 */
export const DEFAULT_CRAWL_OPTIONS = {
  maxDepth: 2,
  maxPages: 10,
  limit: 10,
} as const;

/**
 * Default timeouts in milliseconds.
 */
export const TIMEOUTS = {
  scrape: 30000,
  crawl: 60000,
  extract: 45000,
} as const;
