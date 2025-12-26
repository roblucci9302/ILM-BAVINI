/**
 * ElevenLabs API Client.
 *
 * Handles authentication and HTTP requests to the ElevenLabs API.
 */

import type { ElevenLabsConfig, ElevenLabsError, User } from './types';

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_TIMEOUT = 30000;

/**
 * ElevenLabs API client for making authenticated requests.
 */
export class ElevenLabsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: ElevenLabsConfig) {
    if (!config.apiKey) {
      throw new Error('ElevenLabs API key is required');
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
   * Make an authenticated POST request and return audio data.
   */
  async postAudio(endpoint: string, body?: unknown): Promise<ArrayBuffer> {
    const response = await this.request('POST', endpoint, body);

    return response.arrayBuffer();
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
  private async request(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'xi-api-key': this.apiKey,
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
    let message = `ElevenLabs API error: ${response.status}`;

    try {
      const error = (await response.json()) as ElevenLabsError;

      if (error.detail?.message) {
        message = error.detail.message;
      }
    } catch {
      // Ignore JSON parse errors.
    }

    if (response.status === 401) {
      throw new Error('Invalid ElevenLabs API key');
    }

    if (response.status === 402) {
      throw new Error('ElevenLabs quota exceeded');
    }

    if (response.status === 429) {
      throw new Error('ElevenLabs rate limit exceeded');
    }

    throw new Error(message);
  }

  /**
   * Get current user information.
   */
  async getUser(): Promise<User> {
    return this.get<User>('/user');
  }

  /**
   * Check if the API key is valid.
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getUser();

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new ElevenLabs client instance.
 */
export function createElevenLabsClient(apiKey: string): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey });
}
