import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../retry';
import type { LLMProvider } from '../types';

/** Creates a mock LLMProvider with the given generateText implementation */
const mockProvider = (fn: LLMProvider['generateText']): LLMProvider => ({
	generateText: fn
});

describe('withRetry', () => {
	it('should return text on first successful attempt', async () => {
		const provider = mockProvider(async () => 'Hello!');
		const reliable = withRetry(provider);

		const result = await reliable.generateText('test');
		expect(result).toBe('Hello!');
	});

	it('should retry on null response and succeed', async () => {
		const generateText = vi
			.fn<LLMProvider['generateText']>()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce('Retry success!');

		const reliable = withRetry(mockProvider(generateText));

		const result = await reliable.generateText('test');
		expect(result).toBe('Retry success!');
		expect(generateText).toHaveBeenCalledTimes(2);
	});

	it('should retry on empty string response and succeed', async () => {
		const generateText = vi
			.fn<LLMProvider['generateText']>()
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('Got it!');

		const reliable = withRetry(mockProvider(generateText));

		const result = await reliable.generateText('test');
		expect(result).toBe('Got it!');
		expect(generateText).toHaveBeenCalledTimes(2);
	});

	it('should return null after all retries fail', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue(null);
		const reliable = withRetry(mockProvider(generateText), { maxRetries: 2 });

		const result = await reliable.generateText('test');
		expect(result).toBeNull();
		expect(generateText).toHaveBeenCalledTimes(2);
	});

	it('should call onRetryableFailure callback on empty responses', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue(null);
		const onFailure = vi.fn();

		const reliable = withRetry(mockProvider(generateText), {
			maxRetries: 2,
			onRetryableFailure: onFailure
		});

		await reliable.generateText('test');
		expect(onFailure).toHaveBeenCalledTimes(2);
		expect(onFailure).toHaveBeenCalledWith(1);
		expect(onFailure).toHaveBeenCalledWith(2);
	});

	it('should call onRetryableFailure with error on thrown exceptions', async () => {
		const error = new Error('Network failure');
		const generateText = vi.fn<LLMProvider['generateText']>().mockRejectedValue(error);
		const onFailure = vi.fn();

		const reliable = withRetry(mockProvider(generateText), {
			maxRetries: 1,
			onRetryableFailure: onFailure
		});

		const result = await reliable.generateText('test');
		expect(result).toBeNull();
		expect(onFailure).toHaveBeenCalledWith(1, error);
	});

	it('should use default max retries of 3', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue(null);
		const reliable = withRetry(mockProvider(generateText));

		await reliable.generateText('test');
		expect(generateText).toHaveBeenCalledTimes(3);
	});

	it('should pass prompt and options through to the underlying provider', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const reliable = withRetry(mockProvider(generateText));

		await reliable.generateText('my prompt', { maxTokens: 50, temperature: 0.8 });
		expect(generateText).toHaveBeenCalledWith('my prompt', {
			maxTokens: 50,
			temperature: 0.8
		});
	});

	it('should work with any LLMProvider implementation', async () => {
		// Simulate a custom provider (e.g. OpenAI, Anthropic, local model)
		const customProvider: LLMProvider = {
			generateText: async (prompt) => `Echo: ${prompt}`
		};
		const reliable = withRetry(customProvider);

		const result = await reliable.generateText('hello');
		expect(result).toBe('Echo: hello');
	});
});
