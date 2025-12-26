/**
 * Perplexity API Client.
 *
 * Handles authentication and HTTP requests to the Perplexity API.
 */

import type { PerplexityConfig, PerplexityError, ChatCompletionResponse, ChatCompletionOptions } from './types';
import { DEFAULT_ONLINE_MODEL } from './types';

const DEFAULT_BASE_URL = 'https://api.perplexity.ai';
const DEFAULT_TIMEOUT = 60000;

/**
 * Perplexity API client for making authenticated requests.
 */
export class PerplexityClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: PerplexityConfig) {
    if (!config.apiKey) {
      throw new Error('Perplexity API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Make an authenticated POST request with JSON body.
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request('POST', endpoint, body);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated POST request and return a stream.
   */
  async postStream(endpoint: string, body?: unknown): Promise<ReadableStream<Uint8Array> | null> {
    const response = await this.request('POST', endpoint, body);

    return response.body;
  }

  /**
   * Core request method with authentication and error handling.
   */
  private async request(method: 'POST', endpoint: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };

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
    let message = `Perplexity API error: ${response.status}`;

    try {
      const error = (await response.json()) as PerplexityError;

      if (error.error?.message) {
        message = error.error.message;
      }
    } catch {
      // Ignore JSON parse errors.
    }

    if (response.status === 401) {
      throw new Error('Invalid Perplexity API key');
    }

    if (response.status === 429) {
      throw new Error('Perplexity rate limit exceeded');
    }

    if (response.status === 402) {
      throw new Error('Perplexity quota exceeded');
    }

    throw new Error(message);
  }

  /**
   * Check if the API key is valid by making a minimal request.
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.post<ChatCompletionResponse>('/chat/completions', {
        model: DEFAULT_ONLINE_MODEL,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new Perplexity client instance.
 */
export function createPerplexityClient(apiKey: string): PerplexityClient {
  return new PerplexityClient({ apiKey });
}
