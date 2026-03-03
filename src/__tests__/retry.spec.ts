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
	it('should prepend system prompt to user prompt when no options are passed', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'You are a helpful assistant.');

		await agent.generateText('Hello!');

		expect(generateText).toHaveBeenCalledWith('You are a helpful assistant.\n\nHello!');
	});

	it('should prepend system prompt when options are passed without systemPrompt', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'Be concise.');

		await agent.generateText('Summarise this.', { maxTokens: 100, temperature: 0.5 });

		expect(generateText).toHaveBeenCalledWith('Be concise.\n\nSummarise this.', {
			maxTokens: 100,
			temperature: 0.5
		});
	});

	it('should use call-time systemPrompt over the bound one', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'Bound prompt.');

		await agent.generateText('Hello!', { systemPrompt: 'Override prompt.' });

		expect(generateText).toHaveBeenCalledWith('Override prompt.\n\nHello!', {});
	});

	it('should strip systemPrompt from options before passing to the underlying provider', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'System.');

		await agent.generateText('Hello!', { systemPrompt: 'Override.', maxTokens: 50 });

		const receivedOptions = generateText.mock.calls[0]?.[1];
		expect(receivedOptions).not.toHaveProperty('systemPrompt');
		expect(receivedOptions).toEqual({ maxTokens: 50 });
	});

	it('should pass other options through unchanged', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('ok');
		const agent = withSystemPrompt({ generateText }, 'System.');

		await agent.generateText('Hello!', { maxTokens: 200, temperature: 0.9 });

		expect(generateText).toHaveBeenCalledWith(expect.any(String), {
			maxTokens: 200,
			temperature: 0.9
		});
	});

	it('should return the underlying provider response', async () => {
		const generateText = vi.fn<LLMProvider['generateText']>().mockResolvedValue('World!');
		const agent = withSystemPrompt({ generateText }, 'System.');

		const result = await agent.generateText('Hello!');
		expect(result).toBe('World!');
	});
});
