import type { LLMProvider, LLMOptions, RetryConfig } from './types';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_BACKOFF_FACTOR = 2;

/**
 * Wraps an LLMProvider with automatic retry logic and exponential backoff.
 * Returns a new LLMProvider that retries on empty/null responses.
 *
 * @param provider - Any LLMProvider implementation
 * @param config - Optional retry configuration
 * @returns A new LLMProvider that retries failed attempts
 *
 * @example
 * ```ts
 * const provider = createGeminiProvider({ apiKey: 'key' });
 * const reliable = withRetry(provider, { maxRetries: 3, initialDelayMs: 500, backoffFactor: 2 });
 * const text = await reliable.generateText('Hello!');
 * ```
 */
export const withRetry = (provider: LLMProvider, config?: RetryConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
		const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
		const backoffFactor = config?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const text = await provider.generateText(prompt, options);
				if (text && text.length > 0) {
					return text;
				}
				config?.onRetryableFailure?.(attempt);
			} catch (e) {
				config?.onRetryableFailure?.(attempt, e);
			}

			if (attempt < maxRetries) {
				const delay = initialDelayMs * backoffFactor ** (attempt - 1);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		return null;
	}
});

/**
 * Wraps an LLMProvider to prepend a system prompt to every request.
 * Works with any LLMProvider regardless of the underlying LLM.
 *
 * The `systemPrompt` passed via `options` at call-time takes precedence
 * over the one provided here.
 *
 * @example
 * ```ts
 * const provider = createGeminiProvider({ apiKey: 'key' });
 * const agent = withSystemPrompt(provider, 'You are a helpful assistant.');
 * const text = await agent.generateText('What is 2+2?');
 * ```
 */
export const withSystemPrompt = (provider: LLMProvider, systemPrompt: string): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		const effective = options?.systemPrompt ?? systemPrompt;
		const fullPrompt = `${effective}\n\n${prompt}`;
		const { systemPrompt: _, ...rest } = options ?? {};
		return provider.generateText(fullPrompt, rest);
	}
});
