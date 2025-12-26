/**
 * Perplexity SDK.
 *
 * Provides AI-powered search and chat functionality.
 */

// Client
export { PerplexityClient, createPerplexityClient } from './client';

// Types
export type {
  PerplexityConfig,
  PerplexityError,
  PerplexityModel,
  MessageRole,
  Message,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatCompletionChunk,
  Choice,
  Usage,
  Citation,
  AskOptions,
} from './types';

export { DEFAULT_ONLINE_MODEL, DEFAULT_CHAT_MODEL, PERPLEXITY_MODELS, ONLINE_MODELS, isOnlineModel } from './types';

// Chat functions
export {
  createChatCompletion,
  createChatCompletionStream,
  parseStreamChunks,
  collectStreamText,
  ask,
  chat,
  search,
  getNews,
  research,
} from './chat';
