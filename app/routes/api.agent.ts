/**
 * API Route for Multi-Agent System
 *
 * This route handles requests for the multi-agent orchestration system.
 * It streams responses back to the client in a format compatible with the chat UI.
 */

import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.agent');

// ============================================================================
// TYPES
// ============================================================================

interface AgentRequestBody {
  message: string;
  context?: Record<string, unknown>;
  controlMode?: 'strict' | 'moderate' | 'permissive';
  multiAgent?: boolean;
}

interface StreamChunk {
  type: 'text' | 'artifact' | 'agent_status' | 'error' | 'done';
  content?: string;
  artifact?: {
    type: 'file' | 'command' | 'analysis';
    path?: string;
    content: string;
    action?: 'created' | 'modified' | 'deleted' | 'executed';
  };
  agent?: string;
  status?: string;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function createStreamChunk(chunk: StreamChunk): string {
  return JSON.stringify(chunk) + '\n';
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request, context }: ActionFunctionArgs) {
  const body = await request.json<AgentRequestBody>();
  const { message, context: agentContext, controlMode = 'strict', multiAgent = false } = body;

  logger.info(`Agent request received (multiAgent: ${multiAgent}, controlMode: ${controlMode})`);
  logger.debug('Message:', message.substring(0, 100));

  // Create a streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        controller.enqueue(
          encoder.encode(
            createStreamChunk({
              type: 'agent_status',
              agent: 'orchestrator',
              status: 'thinking',
            })
          )
        );

        // For now, we'll use a simple proxy to the main LLM
        // In a full implementation, this would orchestrate multiple agents
        // The multi-agent logic runs client-side with WebContainer

        // Simulate orchestrator analysis
        controller.enqueue(
          encoder.encode(
            createStreamChunk({
              type: 'text',
              content: `[Orchestrator] Analyzing request...\n\n`,
            })
          )
        );

        // Call the underlying chat API for actual LLM response
        // This is a bridge until the full client-side agent system is connected
        const chatResponse = await fetch(new URL('/api/chat', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: message,
              },
            ],
            mode: 'agent',
            context: agentContext,
          }),
        });

        if (!chatResponse.ok) {
          throw new Error(`Chat API error: ${chatResponse.statusText}`);
        }

        // Stream the response from chat API
        const reader = chatResponse.body?.getReader();

        if (reader) {
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const text = decoder.decode(value, { stream: true });

            // Parse AI SDK format and convert to our format
            // AI SDK uses: 0:"text"\n format
            const lines = text.split('\n').filter(Boolean);

            for (const line of lines) {
              // Try to parse AI SDK format
              // AI SDK uses: 0:"text" for content, d:{...} for done/metadata, e:{...} for errors
              const match = line.match(/^([0-9a-z]):(.+)$/i);

              if (match) {
                const [, type, data] = match;

                if (type === '0') {
                  // Text chunk - this is the actual content
                  try {
                    const content = JSON.parse(data);
                    controller.enqueue(
                      encoder.encode(
                        createStreamChunk({
                          type: 'text',
                          content,
                        })
                      )
                    );
                  } catch {
                    // If not JSON, use as-is
                    controller.enqueue(
                      encoder.encode(
                        createStreamChunk({
                          type: 'text',
                          content: data,
                        })
                      )
                    );
                  }
                }
                // Ignore other types: d (done/metadata), e (error), etc.
                // These contain token counts and other metadata we don't want to display
              }
              // If line doesn't match AI SDK format, it might be a control message - ignore it
            }
          }
        }

        // Send completion status
        controller.enqueue(
          encoder.encode(
            createStreamChunk({
              type: 'agent_status',
              agent: 'orchestrator',
              status: 'completed',
            })
          )
        );

        controller.enqueue(
          encoder.encode(
            createStreamChunk({
              type: 'done',
            })
          )
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Agent error:', errorMessage);

        controller.enqueue(
          encoder.encode(
            createStreamChunk({
              type: 'error',
              error: errorMessage,
            })
          )
        );

        controller.enqueue(
          encoder.encode(
            createStreamChunk({
              type: 'agent_status',
              agent: 'orchestrator',
              status: 'failed',
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
