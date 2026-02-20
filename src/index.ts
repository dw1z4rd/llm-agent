// @reality-engine/llm-agent
// LLM-agnostic AI agent library — plug in any LLM provider

// Generic LLM provider interface and retry wrapper
export { withRetry } from './retry';

// Built-in Gemini provider and low-level helpers
export { callGemini, extractGeminiText, extractCleanGeminiText, createGeminiProvider } from './gemini';

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
