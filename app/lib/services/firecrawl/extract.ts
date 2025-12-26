/**
 * Firecrawl Extract Functions.
 *
 * Provides structured data extraction functionality using LLM.
 */

import type { FirecrawlClient } from './client';
import type { ExtractOptions, ExtractResult } from './types';

/**
 * Extract structured data from URLs using LLM.
 */
export async function extractData(client: FirecrawlClient, options: ExtractOptions): Promise<ExtractResult> {
  const { urls, ...rest } = options;

  if (!urls || urls.length === 0) {
    throw new Error('URLs are required for extraction');
  }

  if (!options.prompt && !options.schema) {
    throw new Error('Either prompt or schema is required for extraction');
  }

  const body = {
    urls,
    ...rest,
  };

  return client.post<ExtractResult>('/extract', body);
}

/**
 * Extract data using a natural language prompt.
 */
export async function extractWithPrompt(
  client: FirecrawlClient,
  urls: string[],
  prompt: string,
  options?: Omit<ExtractOptions, 'urls' | 'prompt'>,
): Promise<Record<string, unknown> | undefined> {
  const result = await extractData(client, {
    urls,
    prompt,
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to extract data');
  }

  return result.data;
}

/**
 * Extract data using a JSON schema.
 */
export async function extractWithSchema<T extends Record<string, unknown>>(
  client: FirecrawlClient,
  urls: string[],
  schema: Record<string, unknown>,
  options?: Omit<ExtractOptions, 'urls' | 'schema'>,
): Promise<T | undefined> {
  const result = await extractData(client, {
    urls,
    schema,
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to extract data');
  }

  return result.data as T | undefined;
}

/**
 * Extract contact information from a website.
 */
export async function extractContacts(
  client: FirecrawlClient,
  urls: string[],
): Promise<
  | {
      emails?: string[];
      phones?: string[];
      addresses?: string[];
      socialLinks?: string[];
    }
  | undefined
> {
  const schema = {
    type: 'object',
    properties: {
      emails: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses found on the page',
      },
      phones: {
        type: 'array',
        items: { type: 'string' },
        description: 'Phone numbers found on the page',
      },
      addresses: {
        type: 'array',
        items: { type: 'string' },
        description: 'Physical addresses found on the page',
      },
      socialLinks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Social media profile links',
      },
    },
  };

  return extractWithSchema(client, urls, schema);
}

/**
 * Extract product information from e-commerce pages.
 */
export async function extractProducts(
  client: FirecrawlClient,
  urls: string[],
): Promise<
  | {
      products?: Array<{
        name?: string;
        price?: string;
        currency?: string;
        description?: string;
        imageUrl?: string;
        availability?: string;
      }>;
    }
  | undefined
> {
  const schema = {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Product name' },
            price: { type: 'string', description: 'Product price' },
            currency: { type: 'string', description: 'Currency code (USD, EUR, etc.)' },
            description: { type: 'string', description: 'Product description' },
            imageUrl: { type: 'string', description: 'Main product image URL' },
            availability: { type: 'string', description: 'Stock availability status' },
          },
        },
      },
    },
  };

  return extractWithSchema(client, urls, schema);
}

/**
 * Extract article/blog content.
 */
export async function extractArticle(
  client: FirecrawlClient,
  urls: string[],
): Promise<
  | {
      title?: string;
      author?: string;
      publishDate?: string;
      content?: string;
      summary?: string;
      tags?: string[];
    }
  | undefined
> {
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Article title' },
      author: { type: 'string', description: 'Author name' },
      publishDate: { type: 'string', description: 'Publication date' },
      content: { type: 'string', description: 'Main article content' },
      summary: { type: 'string', description: 'Brief summary of the article' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Article tags or categories',
      },
    },
  };

  return extractWithSchema(client, urls, schema);
}

/**
 * Extract company/organization information.
 */
export async function extractCompanyInfo(
  client: FirecrawlClient,
  urls: string[],
): Promise<
  | {
      name?: string;
      description?: string;
      industry?: string;
      foundedYear?: string;
      headquarters?: string;
      employeeCount?: string;
      website?: string;
    }
  | undefined
> {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Company name' },
      description: { type: 'string', description: 'Company description or mission' },
      industry: { type: 'string', description: 'Industry or sector' },
      foundedYear: { type: 'string', description: 'Year the company was founded' },
      headquarters: { type: 'string', description: 'Headquarters location' },
      employeeCount: { type: 'string', description: 'Number of employees or range' },
      website: { type: 'string', description: 'Official website URL' },
    },
  };

  return extractWithSchema(client, urls, schema);
}
