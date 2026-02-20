import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, extractGeminiText, extractCleanGeminiText, createGeminiProvider } from '../gemini';

describe('callGemini', () => {
	const TEST_API_KEY = 'test-api-key-12345';
	const mockResponse = {
		candidates: [{ content: { parts: [{ text: 'Test response' }] } }]
	};

	let consoleErrorSpy: vi.SpyInstance;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch = vi.fn();
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		vi.restoreAllMocks();
	});

	it('should successfully call Gemini API and return response', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockResponse
		});

		const result = await callGemini(TEST_API_KEY, { test: 'body' });

		expect(result).toEqual(mockResponse);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it('should return null on non-2xx response', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 400,
			text: async () => 'Error response'
		});

		const result = await callGemini(TEST_API_KEY, { test: 'body' });

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalledWith('[Gemini] API Error 400:', expect.any(String));
	});

	it('should redact API key from error response body', async () => {
		const errorWithKey = `Error: Invalid key ${TEST_API_KEY} provided`;
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => errorWithKey
		});

		await callGemini(TEST_API_KEY, { test: 'body' });

		expect(consoleErrorSpy).toHaveBeenCalled();
		const loggedMessage = consoleErrorSpy.mock.calls[0][1];
		expect(loggedMessage).not.toContain(TEST_API_KEY);
		expect(loggedMessage).toContain('[REDACTED_KEY]');
	});

	it('should redact all occurrences of API key from error response body', async () => {
		const errorWithMultipleKeys = `Error: ${TEST_API_KEY} is invalid. Please check ${TEST_API_KEY}`;
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => errorWithMultipleKeys
		});

		await callGemini(TEST_API_KEY, { test: 'body' });

		expect(consoleErrorSpy).toHaveBeenCalled();
		const loggedMessage = consoleErrorSpy.mock.calls[0][1];
		expect(loggedMessage).not.toContain(TEST_API_KEY);
		expect((loggedMessage.match(/\[REDACTED_KEY\]/g) || []).length).toBe(2);
	});

	it('should handle empty API key without breaking', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 400,
			text: async () => 'Error response'
		});

		const result = await callGemini('', { test: 'body' });

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();
		const loggedMessage = consoleErrorSpy.mock.calls[0][1];
		expect(loggedMessage).toBe('Error response'.slice(0, 500));
	});

	it('should redact API key from network error messages', async () => {
		const errorWithUrl = new Error(`Failed to fetch: https://example.com?key=${TEST_API_KEY}`);
		(global.fetch as any).mockRejectedValue(errorWithUrl);

		const result = await callGemini(TEST_API_KEY, { test: 'body' });

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();
		const loggedMessage = consoleErrorSpy.mock.calls[0][1];
		expect(loggedMessage).not.toContain(TEST_API_KEY);
		expect(loggedMessage).toContain('[REDACTED_KEY]');
	});

	it('should redact all occurrences of API key from network error messages', async () => {
		const errorMessage = `Retry failed for ${TEST_API_KEY} with key=${TEST_API_KEY}`;
		(global.fetch as any).mockRejectedValue(new Error(errorMessage));

		await callGemini(TEST_API_KEY, { test: 'body' });

		expect(consoleErrorSpy).toHaveBeenCalled();
		const loggedMessage = consoleErrorSpy.mock.calls[0][1];
		expect(loggedMessage).not.toContain(TEST_API_KEY);
		expect((loggedMessage.match(/\[REDACTED_KEY\]/g) || []).length).toBe(2);
	});

	it('should handle network error with empty API key', async () => {
		const error = new Error('Network error');
		(global.fetch as any).mockRejectedValue(error);

		const result = await callGemini('', { test: 'body' });

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalledWith('[Gemini] Network Error:', 'Network error');
	});

	it('should handle non-Error exceptions', async () => {
		(global.fetch as any).mockRejectedValue('String error');

		const result = await callGemini(TEST_API_KEY, { test: 'body' });

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();
	});

	it('should truncate long error responses to 500 characters', async () => {
		const longError = 'x'.repeat(1000);
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => longError
		});

		await callGemini(TEST_API_KEY, { test: 'body' });

		expect(consoleErrorSpy).toHaveBeenCalled();
		const loggedMessage = consoleErrorSpy.mock.calls[0][1];
		expect(loggedMessage.length).toBe(500);
	});

	it('should pass correct URL with API key to fetch', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockResponse
		});

		await callGemini(TEST_API_KEY, { test: 'body' });

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining(`?key=${TEST_API_KEY}`),
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			})
		);
	});

	it('should pass correct body to fetch', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => mockResponse
		});

		const testBody = { prompt: 'test prompt', temperature: 0.7 };
		await callGemini(TEST_API_KEY, testBody);

		expect(global.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: JSON.stringify(testBody)
			})
		);
	});
});

describe('extractGeminiText', () => {
	it('should extract text from valid response', () => {
		const response = {
			candidates: [{ content: { parts: [{ text: 'Hello world' }] } }]
		};
		expect(extractGeminiText(response)).toBe('Hello world');
	});

	it('should return null for null response', () => {
		expect(extractGeminiText(null)).toBeNull();
	});

	it('should return null for undefined response', () => {
		expect(extractGeminiText(undefined)).toBeNull();
	});

	it('should return null for empty candidates', () => {
		expect(extractGeminiText({ candidates: [] })).toBeNull();
	});

	it('should return null for missing text', () => {
		const response = {
			candidates: [{ content: { parts: [{}] } }]
		};
		expect(extractGeminiText(response as any)).toBeNull();
	});
});

describe('extractCleanGeminiText', () => {
	it('should extract and clean text from response', () => {
		const response = {
			candidates: [{ content: { parts: [{ text: '  "Hello world"  ' }] } }]
		};
		expect(extractCleanGeminiText(response)).toBe('Hello world');
	});

	it('should trim whitespace', () => {
		const response = {
			candidates: [{ content: { parts: [{ text: '  some text  ' }] } }]
		};
		expect(extractCleanGeminiText(response)).toBe('some text');
	});

	it('should remove surrounding single quotes', () => {
		const response = {
			candidates: [{ content: { parts: [{ text: "'quoted'" }] } }]
		};
		expect(extractCleanGeminiText(response)).toBe('quoted');
	});

	it('should return null for null response', () => {
		expect(extractCleanGeminiText(null)).toBeNull();
	});
});

describe('createGeminiProvider', () => {
	const TEST_API_KEY = 'test-provider-key';

	let consoleErrorSpy: vi.SpyInstance;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		global.fetch = vi.fn();
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		vi.restoreAllMocks();
	});

	it('should implement the LLMProvider interface', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({
				candidates: [{ content: { parts: [{ text: 'Generated text' }] } }]
			})
		});

		const provider = createGeminiProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('Hello');

		expect(result).toBe('Generated text');
	});

	it('should pass maxTokens and temperature to Gemini API', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({
				candidates: [{ content: { parts: [{ text: 'ok' }] } }]
			})
		});

		const provider = createGeminiProvider({ apiKey: TEST_API_KEY });
		await provider.generateText('test', { maxTokens: 50, temperature: 0.8 });

		const fetchCall = (global.fetch as any).mock.calls[0];
		const body = JSON.parse(fetchCall[1].body);
		expect(body.generationConfig.maxOutputTokens).toBe(50);
		expect(body.generationConfig.temperature).toBe(0.8);
	});

	it('should return null on API failure', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => 'Server error'
		});

		const provider = createGeminiProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('test');

		expect(result).toBeNull();
	});

	it('should clean quotes from response text', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({
				candidates: [{ content: { parts: [{ text: '"quoted response"' }] } }]
			})
		});

		const provider = createGeminiProvider({ apiKey: TEST_API_KEY });
		const result = await provider.generateText('test');

		expect(result).toBe('quoted response');
	});

	it('should support custom model override', async () => {
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({
				candidates: [{ content: { parts: [{ text: 'ok' }] } }]
			})
		});

		const provider = createGeminiProvider({ apiKey: TEST_API_KEY, model: 'gemini-1.5-pro' });
		await provider.generateText('test');

		const fetchUrl = (global.fetch as any).mock.calls[0][0];
		expect(fetchUrl).toContain('gemini-1.5-pro');
	});
});
