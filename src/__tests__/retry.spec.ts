import { describe, it, expect, vi } from 'vitest';
import { withRetry, withSystemPrompt } from '../retry';
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

describe('withSystemPrompt', () => {
	it('should pass bound systemPrompt via options when no options are given', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'You are a helpful assistant.');

		await agent.generateText('Hello!');

		expect(generateText).toHaveBeenCalledWith('Hello!', {
			systemPrompt: 'You are a helpful assistant.'
		});
	});

	it('should pass bound systemPrompt when options are given without systemPrompt', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'Be concise.');

		await agent.generateText('Summarise this.', { maxTokens: 100, temperature: 0.5 });

		expect(generateText).toHaveBeenCalledWith('Summarise this.', {
			maxTokens: 100,
			temperature: 0.5,
			systemPrompt: 'Be concise.'
		});
	});

	it('should let call-time systemPrompt override the bound one', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'Bound prompt.');

		await agent.generateText('Hello!', { systemPrompt: 'Override prompt.' });

		expect(generateText).toHaveBeenCalledWith('Hello!', {
			systemPrompt: 'Override prompt.'
		});
	});

	it('should pass the user prompt through unchanged', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'System.');

		await agent.generateText('My prompt');

		expect(generateText).toHaveBeenCalledWith('My prompt', expect.any(Object));
	});

	it('should pass other options through unchanged', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'System.');

		await agent.generateText('Hello!', { maxTokens: 200, temperature: 0.9 });

		expect(generateText).toHaveBeenCalledWith('Hello!', {
			maxTokens: 200,
			temperature: 0.9,
			systemPrompt: 'System.'
		});
	});

	it('should return the underlying provider response', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('World!');
		const agent = withSystemPrompt({ generateText }, 'System.');

		const result = await agent.generateText('Hello!');
		expect(result).toBe('World!');
	});
});
