/**
 * Firecrawl API Client.
 *
 * Handles authentication and HTTP requests to the Firecrawl API.
 */

import type { FirecrawlConfig, FirecrawlError, CreditUsage } from './types';

const DEFAULT_BASE_URL = 'https://api.firecrawl.dev/v1';
const DEFAULT_TIMEOUT = 30000;

/**
 * Firecrawl API client for making authenticated requests.
 */
export class FirecrawlClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: FirecrawlConfig) {
    if (!config.apiKey) {
      throw new Error('Firecrawl API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Make an authenticated GET request.
   */
  async get<T>(endpoint: string): Promise<T> {
    const response = await this.request('GET', endpoint);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated POST request with JSON body.
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request('POST', endpoint, body);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated DELETE request.
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.request('DELETE', endpoint);

    return response.json() as Promise<T>;
  }

  /**
   * Core request method with authentication and error handling.
   */
  private async request(method: 'GET' | 'POST' | 'DELETE', endpoint: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle API error responses.
   */
  private async handleError(response: Response): Promise<never> {
    let message = `Firecrawl API error: ${response.status}`;

    try {
      const error = (await response.json()) as FirecrawlError;

      if (error.error) {
        message = error.error;
      }
    } catch {
      // Ignore JSON parse errors.
    }

    if (response.status === 401) {
      throw new Error('Invalid Firecrawl API key');
    }

    if (response.status === 402) {
      throw new Error('Firecrawl credits exhausted');
    }

    if (response.status === 429) {
      throw new Error('Firecrawl rate limit exceeded');
    }

    throw new Error(message);
  }

  /**
   * Check remaining credits.
   */
  async getCredits(): Promise<number> {
    const response = await this.get<CreditUsage>('/credits');

    return response.remaining_credits;
  }

  /**
   * Check if the API key is valid.
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getCredits();

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new Firecrawl client instance.
 */
export function createFirecrawlClient(apiKey: string): FirecrawlClient {
  return new FirecrawlClient({ apiKey });
}
