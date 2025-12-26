/**
 * Firecrawl Scrape Functions.
 *
 * Provides single-page scraping functionality.
 */

import type { FirecrawlClient } from './client';
import type { ScrapeOptions, ScrapeResult, BatchScrapeResponse, BatchScrapeStatusResponse } from './types';

/**
 * Scrape a single URL and return the content.
 */
export async function scrapeUrl(client: FirecrawlClient, options: ScrapeOptions): Promise<ScrapeResult> {
  const { url, formats = ['markdown'], ...rest } = options;

  if (!url) {
    throw new Error('URL is required for scraping');
  }

  const body = {
    url,
    formats,
    ...rest,
  };

  return client.post<ScrapeResult>('/scrape', body);
}

/**
 * Scrape a URL and return only markdown content.
 */
export async function scrapeToMarkdown(
  client: FirecrawlClient,
  url: string,
  options?: Omit<ScrapeOptions, 'url' | 'formats'>,
): Promise<string | undefined> {
  const result = await scrapeUrl(client, {
    url,
    formats: ['markdown'],
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to scrape URL');
  }

  return result.data?.markdown;
}

/**
 * Scrape a URL and return only HTML content.
 */
export async function scrapeToHtml(
  client: FirecrawlClient,
  url: string,
  options?: Omit<ScrapeOptions, 'url' | 'formats'>,
): Promise<string | undefined> {
  const result = await scrapeUrl(client, {
    url,
    formats: ['html'],
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to scrape URL');
  }

  return result.data?.html;
}

/**
 * Scrape a URL and return all links found on the page.
 */
export async function scrapeLinks(
  client: FirecrawlClient,
  url: string,
  options?: Omit<ScrapeOptions, 'url' | 'formats'>,
): Promise<string[]> {
  const result = await scrapeUrl(client, {
    url,
    formats: ['links'],
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to scrape URL');
  }

  return result.data?.links || [];
}

/**
 * Scrape a URL and take a screenshot.
 */
export async function scrapeScreenshot(
  client: FirecrawlClient,
  url: string,
  fullPage: boolean = false,
  options?: Omit<ScrapeOptions, 'url' | 'formats'>,
): Promise<string | undefined> {
  const format = fullPage ? 'screenshot@fullPage' : 'screenshot';
  const result = await scrapeUrl(client, {
    url,
    formats: [format],
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to scrape URL');
  }

  return result.data?.screenshot;
}

/**
 * Start a batch scrape job for multiple URLs.
 */
export async function batchScrape(
  client: FirecrawlClient,
  urls: string[],
  options?: Omit<ScrapeOptions, 'url'>,
): Promise<BatchScrapeResponse> {
  if (!urls || urls.length === 0) {
    throw new Error('URLs are required for batch scraping');
  }

  const body = {
    urls,
    ...options,
  };

  return client.post<BatchScrapeResponse>('/batch/scrape', body);
}

/**
 * Get the status of a batch scrape job.
 */
export async function getBatchScrapeStatus(client: FirecrawlClient, jobId: string): Promise<BatchScrapeStatusResponse> {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  return client.get<BatchScrapeStatusResponse>(`/batch/scrape/${jobId}`);
}

/**
 * Cancel a batch scrape job.
 */
export async function cancelBatchScrape(client: FirecrawlClient, jobId: string): Promise<{ success: boolean }> {
  if (!jobId) {
    throw new Error('Job ID is required');
  }

  return client.delete<{ success: boolean }>(`/batch/scrape/${jobId}`);
}

/**
 * Wait for a batch scrape job to complete.
 */
export async function waitForBatchScrape(
  client: FirecrawlClient,
  jobId: string,
  pollInterval: number = 2000,
  maxWait: number = 300000,
): Promise<BatchScrapeStatusResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await getBatchScrapeStatus(client, jobId);

    if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Batch scrape job timed out');
}
