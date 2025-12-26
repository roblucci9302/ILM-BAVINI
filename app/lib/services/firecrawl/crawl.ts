/**
 * Firecrawl Crawl Functions.
 *
 * Provides website crawling functionality.
 */

import type { FirecrawlClient } from './client';
import type { CrawlOptions, CrawlJobResponse, CrawlStatusResponse, MapOptions, MapResult } from './types';

/**
 * Start a crawl job for a website.
 */
export async function startCrawl(client: FirecrawlClient, options: CrawlOptions): Promise<CrawlJobResponse> {
  const { url, ...rest } = options;

  if (!url) {
    throw new Error('URL is required for crawling');
  }

  const body = {
    url,
    ...rest,
  };

  return client.post<CrawlJobResponse>('/crawl', body);
}

/**
 * Get the status of a crawl job.
 */
export async function getCrawlStatus(client: FirecrawlClient, jobId: string): Promise<CrawlStatusResponse> {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  return client.get<CrawlStatusResponse>(`/crawl/${jobId}`);
}

/**
 * Cancel a crawl job.
 */
export async function cancelCrawl(client: FirecrawlClient, jobId: string): Promise<{ success: boolean }> {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  return client.delete<{ success: boolean }>(`/crawl/${jobId}`);
}

/**
 * Wait for a crawl job to complete.
 */
export async function waitForCrawl(
  client: FirecrawlClient,
  jobId: string,
  pollInterval: number = 2000,
  maxWait: number = 300000,
): Promise<CrawlStatusResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await getCrawlStatus(client, jobId);

    if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Crawl job timed out');
}

/**
 * Crawl a website and wait for completion.
 */
export async function crawlWebsite(
  client: FirecrawlClient,
  options: CrawlOptions,
  pollInterval: number = 2000,
  maxWait: number = 300000,
): Promise<CrawlStatusResponse> {
  const job = await startCrawl(client, options);

  if (!job.success || !job.id) {
    throw new Error(job.error || 'Failed to start crawl');
  }

  return waitForCrawl(client, job.id, pollInterval, maxWait);
}

/**
 * Get all URLs from a website (sitemap discovery).
 */
export async function mapWebsite(client: FirecrawlClient, options: MapOptions): Promise<MapResult> {
  const { url, ...rest } = options;

  if (!url) {
    throw new Error('URL is required for mapping');
  }

  const body = {
    url,
    ...rest,
  };

  return client.post<MapResult>('/map', body);
}

/**
 * Get all URLs from a website as a simple list.
 */
export async function getWebsiteUrls(
  client: FirecrawlClient,
  url: string,
  options?: Omit<MapOptions, 'url'>,
): Promise<string[]> {
  const result = await mapWebsite(client, { url, ...options });

  if (!result.success) {
    throw new Error(result.error || 'Failed to map website');
  }

  return result.links || [];
}

/**
 * Search for specific pages on a website.
 */
export async function searchWebsite(
  client: FirecrawlClient,
  url: string,
  searchQuery: string,
  options?: Omit<MapOptions, 'url' | 'search'>,
): Promise<string[]> {
  const result = await mapWebsite(client, { url, search: searchQuery, ...options });

  if (!result.success) {
    throw new Error(result.error || 'Failed to search website');
  }

  return result.links || [];
}

/**
 * Get URLs from sitemap only (faster than full mapping).
 */
export async function getSitemapUrls(
  client: FirecrawlClient,
  url: string,
  options?: Omit<MapOptions, 'url' | 'sitemapOnly'>,
): Promise<string[]> {
  const result = await mapWebsite(client, { url, sitemapOnly: true, ...options });

  if (!result.success) {
    throw new Error(result.error || 'Failed to get sitemap');
  }

  return result.links || [];
}
