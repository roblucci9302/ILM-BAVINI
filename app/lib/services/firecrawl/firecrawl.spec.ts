/**
 * Firecrawl SDK Tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FirecrawlClient, createFirecrawlClient } from './client';
import { scrapeUrl, scrapeToMarkdown, scrapeToHtml, scrapeLinks, batchScrape, getBatchScrapeStatus } from './scrape';
import { startCrawl, getCrawlStatus, cancelCrawl, mapWebsite, getWebsiteUrls } from './crawl';
import { extractData, extractWithPrompt, extractWithSchema } from './extract';
import type { ScrapeResult, CrawlJobResponse, CrawlStatusResponse, MapResult, ExtractResult } from './types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FirecrawlClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      expect(client).toBeInstanceOf(FirecrawlClient);
    });

    it('should throw error without API key', () => {
      expect(() => new FirecrawlClient({ apiKey: '' })).toThrow('Firecrawl API key is required');
    });
  });

  describe('createFirecrawlClient', () => {
    it('should create client instance', () => {
      const client = createFirecrawlClient('fc-test-key');
      expect(client).toBeInstanceOf(FirecrawlClient);
    });
  });

  describe('get', () => {
    it('should make authenticated GET request', async () => {
      const mockResponse = { remaining_credits: 1000 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await client.get('/credits');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.firecrawl.dev/v1/credits',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer fc-test-key',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('post', () => {
    it('should make authenticated POST request with JSON body', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await client.post('/scrape', { url: 'https://example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.firecrawl.dev/v1/scrape',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer fc-test-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ url: 'https://example.com' }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCredits', () => {
    it('should return remaining credits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ remaining_credits: 500 }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const credits = await client.getCredits();

      expect(credits).toBe(500);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ remaining_credits: 100 }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await client.validateApiKey();

      expect(result).toBe(true);
    });

    it('should return false for invalid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ success: false, error: 'Invalid API key' }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-invalid' });
      const result = await client.validateApiKey();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(client.get('/test')).rejects.toThrow('Invalid Firecrawl API key');
    });

    it('should throw for 402 credits exhausted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: () => Promise.resolve({}),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(client.get('/test')).rejects.toThrow('Firecrawl credits exhausted');
    });

    it('should throw for 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(client.get('/test')).rejects.toThrow('Firecrawl rate limit exceeded');
    });
  });
});

describe('Scrape Functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('scrapeUrl', () => {
    it('should scrape a URL successfully', async () => {
      const mockResult: ScrapeResult = {
        success: true,
        data: {
          markdown: '# Hello World',
          metadata: { title: 'Test Page' },
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await scrapeUrl(client, { url: 'https://example.com' });

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scrape'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('https://example.com'),
        }),
      );
    });

    it('should throw error for missing URL', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(scrapeUrl(client, { url: '' })).rejects.toThrow('URL is required for scraping');
    });
  });

  describe('scrapeToMarkdown', () => {
    it('should return markdown content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { markdown: '# Title' } }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await scrapeToMarkdown(client, 'https://example.com');

      expect(result).toBe('# Title');
    });

    it('should throw on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Page not found' }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(scrapeToMarkdown(client, 'https://example.com')).rejects.toThrow('Page not found');
    });
  });

  describe('scrapeToHtml', () => {
    it('should return HTML content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { html: '<h1>Title</h1>' } }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await scrapeToHtml(client, 'https://example.com');

      expect(result).toBe('<h1>Title</h1>');
    });
  });

  describe('scrapeLinks', () => {
    it('should return links array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { links: ['https://example.com/page1', 'https://example.com/page2'] },
          }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await scrapeLinks(client, 'https://example.com');

      expect(result).toEqual(['https://example.com/page1', 'https://example.com/page2']);
    });
  });

  describe('batchScrape', () => {
    it('should start batch scrape job', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, id: 'batch-123' }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await batchScrape(client, ['https://example1.com', 'https://example2.com']);

      expect(result.success).toBe(true);
      expect(result.id).toBe('batch-123');
    });

    it('should throw for empty URLs', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(batchScrape(client, [])).rejects.toThrow('URLs are required for batch scraping');
    });
  });

  describe('getBatchScrapeStatus', () => {
    it('should get batch status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, status: 'completed', total: 2, completed: 2 }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await getBatchScrapeStatus(client, 'batch-123');

      expect(result.status).toBe('completed');
    });
  });
});

describe('Crawl Functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('startCrawl', () => {
    it('should start crawl job', async () => {
      const mockResponse: CrawlJobResponse = { success: true, id: 'crawl-123' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await startCrawl(client, { url: 'https://example.com' });

      expect(result).toEqual(mockResponse);
    });

    it('should throw for missing URL', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(startCrawl(client, { url: '' })).rejects.toThrow('URL is required for crawling');
    });
  });

  describe('getCrawlStatus', () => {
    it('should get crawl status', async () => {
      const mockResponse: CrawlStatusResponse = {
        success: true,
        status: 'scraping',
        total: 10,
        completed: 3,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await getCrawlStatus(client, 'crawl-123');

      expect(result.status).toBe('scraping');
      expect(result.completed).toBe(3);
    });

    it('should throw for missing job ID', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(getCrawlStatus(client, '')).rejects.toThrow('Job ID is required');
    });
  });

  describe('cancelCrawl', () => {
    it('should cancel crawl job', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await cancelCrawl(client, 'crawl-123');

      expect(result.success).toBe(true);
    });
  });

  describe('mapWebsite', () => {
    it('should map website URLs', async () => {
      const mockResponse: MapResult = {
        success: true,
        links: ['https://example.com/', 'https://example.com/about', 'https://example.com/contact'],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await mapWebsite(client, { url: 'https://example.com' });

      expect(result.links).toHaveLength(3);
    });

    it('should throw for missing URL', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(mapWebsite(client, { url: '' })).rejects.toThrow('URL is required for mapping');
    });
  });

  describe('getWebsiteUrls', () => {
    it('should return URL list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, links: ['https://example.com/a', 'https://example.com/b'] }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const urls = await getWebsiteUrls(client, 'https://example.com');

      expect(urls).toEqual(['https://example.com/a', 'https://example.com/b']);
    });
  });
});

describe('Extract Functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('extractData', () => {
    it('should extract data with prompt', async () => {
      const mockResponse: ExtractResult = {
        success: true,
        data: { title: 'Test', description: 'A test page' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await extractData(client, {
        urls: ['https://example.com'],
        prompt: 'Extract title and description',
      });

      expect(result.data).toEqual({ title: 'Test', description: 'A test page' });
    });

    it('should throw for empty URLs', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(extractData(client, { urls: [], prompt: 'test' })).rejects.toThrow(
        'URLs are required for extraction',
      );
    });

    it('should throw for missing prompt and schema', async () => {
      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(extractData(client, { urls: ['https://example.com'] })).rejects.toThrow(
        'Either prompt or schema is required for extraction',
      );
    });
  });

  describe('extractWithPrompt', () => {
    it('should return extracted data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { answer: '42' } }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const result = await extractWithPrompt(client, ['https://example.com'], 'What is the answer?');

      expect(result).toEqual({ answer: '42' });
    });

    it('should throw on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Extraction failed' }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      await expect(extractWithPrompt(client, ['https://example.com'], 'Extract data')).rejects.toThrow(
        'Extraction failed',
      );
    });
  });

  describe('extractWithSchema', () => {
    it('should return typed data', async () => {
      const mockData = { name: 'John', age: 30 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockData }),
      });

      const client = new FirecrawlClient({ apiKey: 'fc-test-key' });
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const result = await extractWithSchema<{ name: string; age: number }>(client, ['https://example.com'], schema);

      expect(result).toEqual(mockData);
    });
  });
});
