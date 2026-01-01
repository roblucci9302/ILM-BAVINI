/**
 * API Route for Multi-Agent System
 *
 * This route handles requests for the multi-agent orchestration system.
 * It streams responses back to the client in a format compatible with the chat UI.
 *
 * IMPORTANT: This route now receives the full conversation history and file context
 * to enable seamless switching between chat and agent modes.
 */

import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.agent');

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface FileContext {
  path: string;
  content?: string;
  type?: 'file' | 'folder';
}

interface AgentRequestBody {
  /** Current message (for backwards compatibility) */
  message?: string;
  /** Full conversation history */
  messages?: ChatMessage[];
  /** Existing files in the project */
  files?: FileContext[];
  /** Additional context */
  context?: Record<string, unknown>;
  /** Control mode for approvals */
  controlMode?: 'strict' | 'moderate' | 'permissive';
  /** Enable multi-agent mode */
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
  const {
    message,
    messages: incomingMessages,
    files,
    context: agentContext,
    controlMode = 'strict',
    multiAgent = false
  } = body;

  // Build messages array - prefer full history, fallback to single message
  let messages: ChatMessage[] = [];

  if (incomingMessages && incomingMessages.length > 0) {
    messages = incomingMessages;
    logger.info(`Agent request received with ${messages.length} messages (multiAgent: ${multiAgent})`);
  } else if (message) {
    // Backwards compatibility: single message
    messages = [{ role: 'user', content: message }];
    logger.info(`Agent request received with single message (multiAgent: ${multiAgent})`);
  } else {
    logger.error('No message or messages provided');
    return new Response(JSON.stringify({ error: 'No message provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log file context if present
  if (files && files.length > 0) {
    logger.info(`Project context: ${files.length} files available`);
    logger.debug('Files:', files.map(f => f.path).join(', '));
  }

  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  logger.debug('Last user message:', lastUserMessage.substring(0, 100));

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

        // Build context with file information if available
        const enrichedContext = {
          ...agentContext,
          ...(files && files.length > 0 ? {
            existingProject: true,
            projectFiles: files.map(f => f.path),
            fileContents: files.reduce((acc, f) => {
              if (f.content) {
                acc[f.path] = f.content;
              }
              return acc;
            }, {} as Record<string, string>),
          } : {}),
        };

        // Call the underlying chat API with FULL conversation history
        // This ensures the agent has context from previous messages
        const chatResponse = await fetch(new URL('/api/chat', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages, // Pass the full conversation history
            mode: 'agent',
            context: enrichedContext,
            multiAgent: true,
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
