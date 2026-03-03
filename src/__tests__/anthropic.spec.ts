import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnthropicProvider } from '../anthropic';

describe('createAnthropicProvider', () => {
	const TEST_API_KEY = 'test-anthropic-key-12345';
	const mockResponse = {
		content: [{ type: 'text', text: 'Test response' }]
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

		const provider = createAnthropicProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('Hello');

		expect(result).toBe('Test response');
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it('should return null on non-2xx response', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 529,
			text: async () => 'Overloaded'
		});

		const provider = createAnthropicProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('Hello');

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalledWith('[Anthropic] API Error 529:', expect.any(String));
	});

	it('should redact API key from error response body', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => `Invalid key: ${TEST_API_KEY}`
		});

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const logged = consoleErrorSpy.mock.calls[0]?.[1];
		expect(logged).not.toContain(TEST_API_KEY);
		expect(logged).toContain('[REDACTED_KEY]');
	});

	it('should redact API key from network error messages', async () => {
		(global.fetch as any).mockRejectedValue(
			new Error(`fetch failed for key=${TEST_API_KEY}`)
		);

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const logged = consoleErrorSpy.mock.calls[0]?.[1];
		expect(logged).not.toContain(TEST_API_KEY);
		expect(logged).toContain('[REDACTED_KEY]');
	});

	it('should return null on network error', async () => {
		(global.fetch as any).mockRejectedValue(new Error('Network failure'));

		const result = await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');
		expect(result).toBeNull();
	});

	it('should send top-level system field when systemPrompt is provided', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		const provider = createAnthropicProvider({ apiKey: TEST_API_KEY });
		await provider.generateText('Hello', { systemPrompt: 'You are a helpful assistant.' });

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.system).toBe('You are a helpful assistant.');
		expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
	});

	it('should not send system field when systemPrompt is absent', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body).not.toHaveProperty('system');
	});

	it('should always send max_tokens, defaulting to 1024', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.max_tokens).toBe(1024);
	});

	it('should use provided maxTokens over the default', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello', {
			maxTokens: 512
		});

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.max_tokens).toBe(512);
	});

	it('should pass temperature when provided', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello', {
			temperature: 0.3
		});

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.temperature).toBe(0.3);
	});

	it('should not include temperature when not provided', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body).not.toHaveProperty('temperature');
	});

	it('should use claude-sonnet-4-6 as default model', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.model).toBe('claude-sonnet-4-6');
	});

	it('should support custom model override', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY, model: 'claude-opus-4-6' }).generateText(
			'Hello'
		);

		const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
		expect(body.model).toBe('claude-opus-4-6');
	});

	it('should send correct Anthropic headers', async () => {
		(global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockResponse });

		await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');

		const headers = (global.fetch as any).mock.calls[0][1].headers;
		expect(headers['x-api-key']).toBe(TEST_API_KEY);
		expect(headers['anthropic-version']).toBe('2023-06-01');
	});

	it('should return null when content array is empty', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({ content: [] })
		});

		const result = await createAnthropicProvider({ apiKey: TEST_API_KEY }).generateText('Hello');
		expect(result).toBeNull();
	});
});
