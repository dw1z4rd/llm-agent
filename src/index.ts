// @llm/agent
// LLM-agnostic AI agent library — plug in any LLM provider

// Generic LLM provider interface and retry wrapper
export { withRetry, withSystemPrompt } from './retry';

// Built-in providers
export { callGemini, extractGeminiText, extractCleanGeminiText, createGeminiProvider } from './gemini';
export { createOpenAIProvider } from './openai';
export { createAnthropicProvider } from './anthropic';

// Types — generic
export type { LLMProvider, LLMOptions, RetryConfig } from './types';

// Types — Gemini-specific
export type {
	GeminiContentPart,
	GeminiContent,
	GeminiCandidate,
	GeminiResponse,
	GeminiProviderConfig
} from './types';

// Types — OpenAI-specific
export type { OpenAIProviderConfig, OpenAIMessage, OpenAIChoice, OpenAIResponse } from './types';

// Types — Anthropic-specific
export type {
	AnthropicProviderConfig,
	AnthropicContentBlock,
	AnthropicResponse
} from './types';
