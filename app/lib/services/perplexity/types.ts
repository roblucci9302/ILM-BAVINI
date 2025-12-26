/**
 * Perplexity API Types.
 *
 * Type definitions for the Perplexity AI chat completions API.
 */

/**
 * Perplexity API configuration.
 */
export interface PerplexityConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Available Perplexity models.
 */
export type PerplexityModel =
  | 'llama-3.1-sonar-small-128k-online'
  | 'llama-3.1-sonar-large-128k-online'
  | 'llama-3.1-sonar-huge-128k-online'
  | 'llama-3.1-sonar-small-128k-chat'
  | 'llama-3.1-sonar-large-128k-chat'
  | 'llama-3.1-8b-instruct'
  | 'llama-3.1-70b-instruct';

/**
 * Message role in a conversation.
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * A single message in a conversation.
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * Chat completion request options.
 */
export interface ChatCompletionOptions {
  model?: PerplexityModel;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
  presencePenalty?: number;
  frequencyPenalty?: number;
  searchDomainFilter?: string[];
  returnImages?: boolean;
  returnRelatedQuestions?: boolean;
  searchRecencyFilter?: 'month' | 'week' | 'day' | 'hour';
}

/**
 * Usage statistics for a completion.
 */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * A choice in the completion response.
 */
export interface Choice {
  index: number;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
  message: Message;
  delta?: Partial<Message>;
}

/**
 * Citation from web search results.
 */
export interface Citation {
  url: string;
  text?: string;
}

/**
 * Chat completion response.
 */
export interface ChatCompletionResponse {
  id: string;
  model: string;
  created: number;
  usage: Usage;
  citations?: string[];
  object: 'chat.completion';
  choices: Choice[];
}

/**
 * Streaming chunk response.
 */
export interface ChatCompletionChunk {
  id: string;
  model: string;
  created: number;
  object: 'chat.completion.chunk';
  choices: Choice[];
}

/**
 * Error response from the API.
 */
export interface PerplexityError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

/**
 * Simple question options for quick queries.
 */
export interface AskOptions {
  model?: PerplexityModel;
  systemPrompt?: string;
  temperature?: number;
  searchRecencyFilter?: 'month' | 'week' | 'day' | 'hour';
  searchDomainFilter?: string[];
}

/**
 * Default model for online search queries.
 */
export const DEFAULT_ONLINE_MODEL: PerplexityModel = 'llama-3.1-sonar-small-128k-online';

/**
 * Default model for chat without search.
 */
export const DEFAULT_CHAT_MODEL: PerplexityModel = 'llama-3.1-sonar-small-128k-chat';

/**
 * Available models list.
 */
export const PERPLEXITY_MODELS: PerplexityModel[] = [
  'llama-3.1-sonar-small-128k-online',
  'llama-3.1-sonar-large-128k-online',
  'llama-3.1-sonar-huge-128k-online',
  'llama-3.1-sonar-small-128k-chat',
  'llama-3.1-sonar-large-128k-chat',
  'llama-3.1-8b-instruct',
  'llama-3.1-70b-instruct',
];

/**
 * Online models (with web search).
 */
export const ONLINE_MODELS: PerplexityModel[] = [
  'llama-3.1-sonar-small-128k-online',
  'llama-3.1-sonar-large-128k-online',
  'llama-3.1-sonar-huge-128k-online',
];

/**
 * Check if a model supports online search.
 */
export function isOnlineModel(model: PerplexityModel): boolean {
  return model.includes('-online');
}
