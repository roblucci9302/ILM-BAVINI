import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('~/utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { action } from './api.agent';

describe('api.agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('action', () => {
    const createMockRequest = (body: Record<string, unknown>) => ({
      url: 'http://localhost:3000/api/agent',
      json: vi.fn().mockResolvedValue(body),
    });

    const createMockContext = () => ({
      cloudflare: {
        env: {
          ANTHROPIC_API_KEY: 'test-key',
        },
      },
    });

    it('should return streaming response', async () => {
      // Mock chat API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('0:"Hello"\n'));
            controller.close();
          },
        }),
      });

      const request = createMockRequest({
        message: 'Create a component',
        controlMode: 'strict',
        multiAgent: true,
      });
      const context = createMockContext();

      const response = await action({
        request: request as unknown as Request,
        context: context as any,
        params: {},
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should include Cache-Control header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      });

      const request = createMockRequest({
        message: 'Test',
      });
      const context = createMockContext();

      const response = await action({
        request: request as unknown as Request,
        context: context as any,
        params: {},
      });

      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });

    it('should stream orchestrator status updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      });

      const request = createMockRequest({
        message: 'Build an app',
      });
      const context = createMockContext();

      const response = await action({
        request: request as unknown as Request,
        context: context as any,
        params: {},
      });

      const reader = response.body?.getReader();
      const chunks: string[] = [];
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value));
        }
      }

      const fullResponse = chunks.join('');

      // Should contain orchestrator status
      expect(fullResponse).toContain('orchestrator');
      expect(fullResponse).toContain('thinking');
    });

    describe('control modes', () => {
      it('should accept strict control mode', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        });

        const request = createMockRequest({
          message: 'Test',
          controlMode: 'strict',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        expect(response.status).toBe(200);
      });

      it('should accept moderate control mode', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        });

        const request = createMockRequest({
          message: 'Test',
          controlMode: 'moderate',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        expect(response.status).toBe(200);
      });

      it('should accept permissive control mode', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        });

        const request = createMockRequest({
          message: 'Test',
          controlMode: 'permissive',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        expect(response.status).toBe(200);
      });
    });

    describe('error handling', () => {
      it('should handle chat API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
        });

        const request = createMockRequest({
          message: 'Test',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        const reader = response.body?.getReader();
        const chunks: string[] = [];
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(decoder.decode(value));
          }
        }

        const fullResponse = chunks.join('');

        // Should contain error status
        expect(fullResponse).toContain('error');
        expect(fullResponse).toContain('failed');
      });

      it('should stream failed status on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const request = createMockRequest({
          message: 'Test',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        const reader = response.body?.getReader();
        const chunks: string[] = [];
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(decoder.decode(value));
          }
        }

        const fullResponse = chunks.join('');

        expect(fullResponse).toContain('"status":"failed"');
      });
    });

    describe('stream format', () => {
      it('should stream JSON chunks with newlines', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('0:"Test content"\n'));
              controller.close();
            },
          }),
        });

        const request = createMockRequest({
          message: 'Test',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        const reader = response.body?.getReader();
        const chunks: string[] = [];
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(decoder.decode(value));
          }
        }

        const fullResponse = chunks.join('');
        const lines = fullResponse.trim().split('\n');

        // Each line should be valid JSON
        for (const line of lines) {
          expect(() => JSON.parse(line)).not.toThrow();
        }
      });

      it('should include done chunk at end', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
        });

        const request = createMockRequest({
          message: 'Test',
        });
        const context = createMockContext();

        const response = await action({
          request: request as unknown as Request,
          context: context as any,
          params: {},
        });

        const reader = response.body?.getReader();
        const chunks: string[] = [];
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(decoder.decode(value));
          }
        }

        const fullResponse = chunks.join('');

        expect(fullResponse).toContain('"type":"done"');
      });
    });
  });
});
