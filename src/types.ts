// ─── Generic LLM Provider Interface ──────────────────────────────────────────

/**
 * Options for a text generation request.
 * LLM-agnostic - works with any provider.
 */
export interface LLMOptions {
	/** Maximum number of tokens in the response */
	readonly maxTokens?: number;
	/** Sampling temperature (higher = more creative) */
	readonly temperature?: number;
}

/**
 * Generic LLM provider interface.
 * Implement this to plug in any LLM (Gemini, OpenAI, Anthropic, Ollama, etc.).
 */
export interface LLMProvider {
	/**
	 * Generate text from a prompt.
	 * @param prompt - The full prompt text (system + user combined or user-only)
	 * @param options - Generation options (maxTokens, temperature, etc.)
	 * @returns The generated text, or null if the request failed
	 */
	generateText(prompt: string, options?: LLMOptions): Promise<string | null>;
}

// ─── Retry Configuration ────────────────────────────────────────────────────

/**
 * Configuration for the retry wrapper.
 */
export interface RetryConfig {
	/** Maximum number of retry attempts (default: 3) */
	readonly maxRetries: number;
	/** Callback invoked on each failed attempt */
	readonly onRetryableFailure?: (attempt: number, error?: unknown) => void;
}

// ─── Gemini-Specific Types (for the built-in Gemini provider) ────────────────

/**
 * Gemini API content part
 */
export interface GeminiContentPart {
	readonly text?: string;
}

/**
 * Gemini API content block
 */
export interface GeminiContent {
	readonly role?: string;
	readonly parts: readonly GeminiContentPart[];
}

/**
 * Gemini API response candidate
 */
export interface GeminiCandidate {
	readonly content: {
		readonly parts: readonly GeminiContentPart[];
	};
}

/**
 * Gemini API response
 */
export interface GeminiResponse {
	readonly candidates?: readonly GeminiCandidate[];
}

/**
 * Configuration for the Gemini provider factory
 */
export interface GeminiProviderConfig {
	/** Gemini API key */
	readonly apiKey: string;
	/** Optional model name override (default: gemini-2.0-flash) */
	readonly model?: string;
}
