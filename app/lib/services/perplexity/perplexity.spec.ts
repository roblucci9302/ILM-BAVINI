/**
 * Perplexity SDK Tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerplexityClient, createPerplexityClient } from './client';
import { createChatCompletion, createChatCompletionStream, collectStreamText, ask, chat, search } from './chat';
import { DEFAULT_ONLINE_MODEL, DEFAULT_CHAT_MODEL, PERPLEXITY_MODELS, isOnlineModel } from './types';
import type { ChatCompletionResponse } from './types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PerplexityClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      expect(client).toBeInstanceOf(PerplexityClient);
    });

    it('should throw error without API key', () => {
      expect(() => new PerplexityClient({ apiKey: '' })).toThrow('Perplexity API key is required');
    });
  });

  describe('createPerplexityClient', () => {
    it('should create client instance', () => {
      const client = createPerplexityClient('pplx-test-key');
      expect(client).toBeInstanceOf(PerplexityClient);
    });
  });

  describe('post', () => {
    it('should make authenticated POST request', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        model: DEFAULT_ONLINE_MODEL,
        created: Date.now(),
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        object: 'chat.completion',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Hello!' } }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await client.post('/chat/completions', {
        model: DEFAULT_ONLINE_MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.perplexity.ai/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer pplx-test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'test',
            choices: [{ message: { content: 'ok' } }],
            usage: { total_tokens: 1 },
          }),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await client.validateApiKey();

      expect(result).toBe(true);
    });

    it('should return false for invalid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-invalid' });
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

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(client.post('/test', {})).rejects.toThrow('Invalid Perplexity API key');
    });

    it('should throw for 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(client.post('/test', {})).rejects.toThrow('Perplexity rate limit exceeded');
    });

    it('should throw for 402 quota exceeded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: () => Promise.resolve({}),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(client.post('/test', {})).rejects.toThrow('Perplexity quota exceeded');
    });
  });
});

describe('Chat Functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('createChatCompletion', () => {
    it('should create a chat completion', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        model: DEFAULT_ONLINE_MODEL,
        created: Date.now(),
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        object: 'chat.completion',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Hello!' } }],
        citations: ['https://example.com'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await createChatCompletion(client, {
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.choices[0].message.content).toBe('Hello!');
      expect(result.citations).toContain('https://example.com');
    });

    it('should throw error for empty messages', async () => {
      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(createChatCompletion(client, { messages: [] })).rejects.toThrow(
        'Messages are required for chat completion',
      );
    });
  });

  describe('createChatCompletionStream', () => {
    it('should return readable stream', async () => {
      const mockStream = new ReadableStream();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await createChatCompletionStream(client, {
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBe(mockStream);
    });
  });

  describe('ask', () => {
    it('should return answer with citations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'test',
            model: DEFAULT_ONLINE_MODEL,
            created: Date.now(),
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            object: 'chat.completion',
            choices: [
              { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'The answer is 42.' } },
            ],
            citations: ['https://example.com/source'],
          }),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await ask(client, 'What is the meaning of life?');

      expect(result.answer).toBe('The answer is 42.');
      expect(result.citations).toContain('https://example.com/source');
    });

    it('should throw for empty question', async () => {
      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(ask(client, '')).rejects.toThrow('Question is required');
    });

    it('should include system prompt when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'test',
            model: DEFAULT_ONLINE_MODEL,
            created: Date.now(),
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            object: 'chat.completion',
            choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Response' } }],
          }),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await ask(client, 'Question', { systemPrompt: 'You are helpful.' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('You are helpful.'),
        }),
      );
    });
  });

  describe('chat', () => {
    it('should return chat response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'test',
            model: DEFAULT_CHAT_MODEL,
            created: Date.now(),
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            object: 'chat.completion',
            choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Hi there!' } }],
          }),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await chat(client, [{ role: 'user', content: 'Hello' }]);

      expect(result).toBe('Hi there!');
    });

    it('should throw for empty messages', async () => {
      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(chat(client, [])).rejects.toThrow('Messages are required');
    });
  });

  describe('search', () => {
    it('should return search results with sources', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'test',
            model: DEFAULT_ONLINE_MODEL,
            created: Date.now(),
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            object: 'chat.completion',
            choices: [
              { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Search result summary' } },
            ],
            citations: ['https://source1.com', 'https://source2.com'],
          }),
      });

      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      const result = await search(client, 'best programming languages 2024');

      expect(result.summary).toBe('Search result summary');
      expect(result.sources).toHaveLength(2);
    });

    it('should throw for empty query', async () => {
      const client = new PerplexityClient({ apiKey: 'pplx-test-key' });
      await expect(search(client, '')).rejects.toThrow('Search query is required');
    });
  });
});

describe('Types and Constants', () => {
  describe('isOnlineModel', () => {
    it('should return true for online models', () => {
      expect(isOnlineModel('llama-3.1-sonar-small-128k-online')).toBe(true);
      expect(isOnlineModel('llama-3.1-sonar-large-128k-online')).toBe(true);
    });

    it('should return false for chat models', () => {
      expect(isOnlineModel('llama-3.1-sonar-small-128k-chat')).toBe(false);
      expect(isOnlineModel('llama-3.1-8b-instruct')).toBe(false);
    });
  });

  describe('PERPLEXITY_MODELS', () => {
    it('should contain all models', () => {
      expect(PERPLEXITY_MODELS).toContain(DEFAULT_ONLINE_MODEL);
      expect(PERPLEXITY_MODELS).toContain(DEFAULT_CHAT_MODEL);
      expect(PERPLEXITY_MODELS.length).toBeGreaterThan(0);
    });
  });
});
