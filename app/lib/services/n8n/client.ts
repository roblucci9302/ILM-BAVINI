/**
 * n8n API Client.
 *
 * Handles authentication and HTTP requests to the n8n API.
 */

import type { N8nConfig, N8nError } from './types';
import { DEFAULT_TIMEOUT } from './types';

/**
 * n8n API client for making authenticated requests.
 */
export class N8nClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: N8nConfig) {
    if (!config.apiKey) {
      throw new Error('n8n API key is required');
    }

    if (!config.instanceUrl) {
      throw new Error('n8n instance URL is required');
    }

    // Normalize instance URL (remove trailing slash).
    let instanceUrl = config.instanceUrl.trim();

    if (instanceUrl.endsWith('/')) {
      instanceUrl = instanceUrl.slice(0, -1);
    }

    this.apiKey = config.apiKey;
    this.baseUrl = `${instanceUrl}/api/v1`;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Make an authenticated GET request.
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await this.request('GET', url);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated POST request with JSON body.
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request('POST', `${this.baseUrl}${endpoint}`, body);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated PUT request with JSON body.
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request('PUT', `${this.baseUrl}${endpoint}`, body);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated PATCH request with JSON body.
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request('PATCH', `${this.baseUrl}${endpoint}`, body);

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated DELETE request.
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.request('DELETE', `${this.baseUrl}${endpoint}`);

    return response.json() as Promise<T>;
  }

  /**
   * Core request method with authentication and error handling.
   */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'X-N8N-API-KEY': this.apiKey,
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
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
    let message = `n8n API error: ${response.status}`;

    try {
      const error = (await response.json()) as N8nError;

      if (error.message) {
        message = error.message;
      }
    } catch {
      // Ignore JSON parse errors.
    }

    if (response.status === 401) {
      throw new Error('Invalid n8n API key');
    }

    if (response.status === 403) {
      throw new Error('n8n API access forbidden');
    }

    if (response.status === 404) {
      throw new Error('n8n resource not found');
    }

    if (response.status === 429) {
      throw new Error('n8n rate limit exceeded');
    }

    throw new Error(message);
  }

  /**
   * Check if the API key is valid.
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.get('/workflows', { limit: '1' });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the base URL for webhooks.
   */
  getWebhookBaseUrl(): string {
    return this.baseUrl.replace('/api/v1', '/webhook');
  }
}

/**
 * Create a new n8n client instance.
 */
export function createN8nClient(instanceUrl: string, apiKey: string): N8nClient {
  return new N8nClient({ instanceUrl, apiKey });
}
