/**
 * Perplexity Chat Functions.
 *
 * Provides chat completion and search functionality.
 */

import type { PerplexityClient } from './client';
import type {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatCompletionChunk,
  Message,
  AskOptions,
  PerplexityModel,
} from './types';
import { DEFAULT_ONLINE_MODEL, DEFAULT_CHAT_MODEL } from './types';

/**
 * Create a chat completion request body.
 */
function buildRequestBody(options: ChatCompletionOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model || DEFAULT_ONLINE_MODEL,
    messages: options.messages,
  };

  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  if (options.topP !== undefined) {
    body.top_p = options.topP;
  }

  if (options.topK !== undefined) {
    body.top_k = options.topK;
  }

  if (options.stream !== undefined) {
    body.stream = options.stream;
  }

  if (options.presencePenalty !== undefined) {
    body.presence_penalty = options.presencePenalty;
  }

  if (options.frequencyPenalty !== undefined) {
    body.frequency_penalty = options.frequencyPenalty;
  }

  if (options.searchDomainFilter && options.searchDomainFilter.length > 0) {
    body.search_domain_filter = options.searchDomainFilter;
  }

  if (options.returnImages !== undefined) {
    body.return_images = options.returnImages;
  }

  if (options.returnRelatedQuestions !== undefined) {
    body.return_related_questions = options.returnRelatedQuestions;
  }

  if (options.searchRecencyFilter) {
    body.search_recency_filter = options.searchRecencyFilter;
  }

  return body;
}

/**
 * Create a chat completion.
 */
export async function createChatCompletion(
  client: PerplexityClient,
  options: ChatCompletionOptions,
): Promise<ChatCompletionResponse> {
  if (!options.messages || options.messages.length === 0) {
    throw new Error('Messages are required for chat completion');
  }

  const body = buildRequestBody({ ...options, stream: false });

  return client.post<ChatCompletionResponse>('/chat/completions', body);
}

/**
 * Create a streaming chat completion.
 */
export async function createChatCompletionStream(
  client: PerplexityClient,
  options: ChatCompletionOptions,
): Promise<ReadableStream<Uint8Array> | null> {
  if (!options.messages || options.messages.length === 0) {
    throw new Error('Messages are required for chat completion');
  }

  const body = buildRequestBody({ ...options, stream: true });

  return client.postStream('/chat/completions', body);
}

/**
 * Parse SSE stream chunks into ChatCompletionChunk objects.
 */
export async function* parseStreamChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);

          if (data === '[DONE]') {
            return;
          }

          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;
            yield chunk;
          } catch {
            // Ignore invalid JSON.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Collect all text from a streaming response.
 */
export async function collectStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  let text = '';

  for await (const chunk of parseStreamChunks(stream)) {
    const delta = chunk.choices[0]?.delta?.content;

    if (delta) {
      text += delta;
    }
  }

  return text;
}

/**
 * Simple question-answer with web search.
 */
export async function ask(
  client: PerplexityClient,
  question: string,
  options?: AskOptions,
): Promise<{ answer: string; citations?: string[] }> {
  if (!question || question.trim().length === 0) {
    throw new Error('Question is required');
  }

  const messages: Message[] = [];

  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  messages.push({ role: 'user', content: question });

  const response = await createChatCompletion(client, {
    model: options?.model || DEFAULT_ONLINE_MODEL,
    messages,
    temperature: options?.temperature,
    searchRecencyFilter: options?.searchRecencyFilter,
    searchDomainFilter: options?.searchDomainFilter,
  });

  const answer = response.choices[0]?.message?.content || '';

  return {
    answer,
    citations: response.citations,
  };
}

/**
 * Chat without web search (uses chat models).
 */
export async function chat(
  client: PerplexityClient,
  messages: Message[],
  options?: { model?: PerplexityModel; temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!messages || messages.length === 0) {
    throw new Error('Messages are required');
  }

  const response = await createChatCompletion(client, {
    model: options?.model || DEFAULT_CHAT_MODEL,
    messages,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Search the web and return summarized results.
 */
export async function search(
  client: PerplexityClient,
  query: string,
  options?: {
    model?: PerplexityModel;
    recency?: 'month' | 'week' | 'day' | 'hour';
    domains?: string[];
  },
): Promise<{ summary: string; sources: string[] }> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query is required');
  }

  const response = await createChatCompletion(client, {
    model: options?.model || DEFAULT_ONLINE_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful search assistant. Provide concise, factual answers based on web search results.',
      },
      { role: 'user', content: query },
    ],
    searchRecencyFilter: options?.recency,
    searchDomainFilter: options?.domains,
  });

  return {
    summary: response.choices[0]?.message?.content || '',
    sources: response.citations || [],
  };
}

/**
 * Get the latest news on a topic.
 */
export async function getNews(
  client: PerplexityClient,
  topic: string,
  recency: 'month' | 'week' | 'day' | 'hour' = 'day',
): Promise<{ summary: string; sources: string[] }> {
  return search(client, `Latest news about ${topic}`, { recency });
}

/**
 * Research a topic with citations.
 */
export async function research(
  client: PerplexityClient,
  topic: string,
  options?: {
    depth?: 'brief' | 'detailed';
    domains?: string[];
  },
): Promise<{ content: string; citations: string[] }> {
  const prompt =
    options?.depth === 'detailed'
      ? `Provide a detailed research summary about: ${topic}. Include key facts, statistics, and cite your sources.`
      : `Provide a brief overview of: ${topic}. Focus on the most important points.`;

  const response = await createChatCompletion(client, {
    model: 'llama-3.1-sonar-large-128k-online',
    messages: [
      {
        role: 'system',
        content: 'You are a research assistant. Provide well-structured, factual information with citations.',
      },
      { role: 'user', content: prompt },
    ],
    searchDomainFilter: options?.domains,
  });

  return {
    content: response.choices[0]?.message?.content || '',
    citations: response.citations || [],
  };
}
