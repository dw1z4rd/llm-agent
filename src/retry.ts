import type { LLMProvider, LLMOptions, RetryConfig } from './types';

const DEFAULT_MAX_RETRIES = 3;

/**
 * Wraps an LLMProvider with automatic retry logic.
 * Returns a new LLMProvider that retries on empty/null responses.
 *
 * @param provider - Any LLMProvider implementation
 * @param config - Optional retry configuration
 * @returns A new LLMProvider that retries failed attempts
 *
 * @example
 * ```ts
 * const provider = createGeminiProvider({ apiKey: 'key' });
 * const reliable = withRetry(provider, { maxRetries: 3 });
 * const text = await reliable.generateText('Hello!');
 * ```
 */
export const withRetry = (provider: LLMProvider, config?: RetryConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;

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
		}

		return null;
	}
});
