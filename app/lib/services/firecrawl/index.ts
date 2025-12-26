/**
 * Firecrawl SDK.
 *
 * Provides web scraping, crawling, and data extraction functionality.
 */

// Client
export { FirecrawlClient, createFirecrawlClient } from './client';

// Types
export type {
  FirecrawlConfig,
  FirecrawlError,
  ScrapeFormat,
  ScrapeOptions,
  ScrapeResult,
  PageMetadata,
  CrawlOptions,
  CrawlJobResponse,
  CrawlStatus,
  CrawlStatusResponse,
  CrawlPageResult,
  MapOptions,
  MapResult,
  ExtractOptions,
  ExtractResult,
  WebhookConfig,
  CreditUsage,
  BatchScrapeResponse,
  BatchScrapeStatusResponse,
} from './types';

export { DEFAULT_SCRAPE_FORMATS, DEFAULT_CRAWL_OPTIONS, TIMEOUTS } from './types';

// Scrape functions
export {
  scrapeUrl,
  scrapeToMarkdown,
  scrapeToHtml,
  scrapeLinks,
  scrapeScreenshot,
  batchScrape,
  getBatchScrapeStatus,
  cancelBatchScrape,
  waitForBatchScrape,
} from './scrape';

// Crawl functions
export {
  startCrawl,
  getCrawlStatus,
  cancelCrawl,
  waitForCrawl,
  crawlWebsite,
  mapWebsite,
  getWebsiteUrls,
  searchWebsite,
  getSitemapUrls,
} from './crawl';

// Extract functions
export {
  extractData,
  extractWithPrompt,
  extractWithSchema,
  extractContacts,
  extractProducts,
  extractArticle,
  extractCompanyInfo,
} from './extract';
