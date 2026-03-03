import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOpenAIProvider } from '../openai';

describe('createOpenAIProvider', () => {
	const TEST_API_KEY = 'test-openai-key-12345';
	const mockResponse = {
		choices: [{ message: { content: 'Test response' } }]
	};

	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch = vi.fn();
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		vi.restoreAllMocks();
	});

	it('should return generated text on success', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockResponse
		});

		const provider = createOpenAIProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('Hello');

		expect(result).toBe('Test response');
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it('should return null on non-2xx response', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 429,
			text: async () => 'Rate limit exceeded'
		});

		const provider = createOpenAIProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('Hello');

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalledWith('[OpenAI] API Error 429:', expect.any(String));
	});

	it('should redact API key from error response body', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => `Invalid key: ${TEST_API_KEY}`
		});

		await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const logged = consoleErrorSpy.mock.calls[0]?.[1];
		expect(logged).not.toContain(TEST_API_KEY);
		expect(logged).toContain('[REDACTED_KEY]');
	});

	it('should redact API key from network error messages', async () => {
		(global.fetch as any).mockRejectedValue(
			new Error(`fetch failed for key=${TEST_API_KEY}`)
		);

		await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const logged = consoleErrorSpy.mock.calls[0]?.[1];
		expect(logged).not.toContain(TEST_API_KEY);
		expect(logged).toContain('[REDACTED_KEY]');
	});

	it('should return null on network error', async () => {
		(global.fetch as any).mockRejectedValue(new Error('Network failure'));

		const result = await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');
		expect(result).toBeNull();
	});

	it('should send a system message when systemPrompt is provided', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		const provider = createOpenAIProvider({ apiKey: TEST_API_KEY });
		await provider.generateText('Hello', { systemPrompt: 'You are a helpful assistant.' });

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.messages).toEqual([
			{ role: 'system', content: 'You are a helpful assistant.' },
			{ role: 'user', content: 'Hello' }
		]);
	});

	it('should not send a system message when systemPrompt is absent', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		const provider = createOpenAIProvider({ apiKey: TEST_API_KEY });
		await provider.generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
	});

	it('should pass maxTokens and temperature', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		const provider = createOpenAIProvider({ apiKey: TEST_API_KEY });
		await provider.generateText('Hello', { maxTokens: 50, temperature: 0.5 });

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.max_tokens).toBe(50);
		expect(body.temperature).toBe(0.5);
	});

	it('should not include maxTokens or temperature when not provided', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body).not.toHaveProperty('max_tokens');
		expect(body).not.toHaveProperty('temperature');
	});

	it('should use gpt-4o as default model', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.model).toBe('gpt-4o');
	});

	it('should support custom model override', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createOpenAIProvider({ apiKey: TEST_API_KEY, model: 'gpt-4-turbo' }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.model).toBe('gpt-4-turbo');
	});

	it('should send Authorization header with Bearer token', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const headers = (global.fetch as any).mock.calls[0][1].headers;
		expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
	});

	it('should return null when choices array is empty', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({ choices: [] })
		});

		const result = await createOpenAIProvider({ apiKey: TEST_API_KEY }).generateText('Hello');
		expect(result).toBeNull();
	});
});
