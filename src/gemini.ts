import type { GeminiResponse, GeminiProviderConfig, LLMProvider, LLMOptions } from './types';

const DEFAULT_MODEL = 'gemini-2.0-flash';

const buildGeminiUrl = (model: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * Low-level Gemini API call. Use this for advanced features like tool/function calling.
 * For simple text generation, prefer `createGeminiProvider()` instead.
 *
 * Safely calls the Gemini API, ensuring that sensitive information (like the API key)
 * is never logged to the console, even if the request fails or throws an error.
 */
export async function callGemini(
	apiKey: string,
	body: unknown,
	model: string = DEFAULT_MODEL
): Promise<any> {
	const url = `${buildGeminiUrl(model)}?key=${apiKey}`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const text = await response.text();
			// Redact API key from response body in case it's echoed in the error
			const sanitizedText =
				apiKey && apiKey.length > 0 ? text.split(apiKey).join('[REDACTED_KEY]') : text;
			// Truncate to avoid massive logs
			console.error(`[Gemini] API Error ${response.status}:`, sanitizedText.slice(0, 500));
			return null;
		}

		return await response.json();
	} catch (e: any) {
		// Redact API key from error message if it appears (e.g. in URL)
		const rawMsg = e.message || String(e);
		const sanitizedMsg =
			apiKey && apiKey.length > 0 ? rawMsg.split(apiKey).join('[REDACTED_KEY]') : rawMsg;
		console.error('[Gemini] Network Error:', sanitizedMsg);
		return null;
	}
}

/**
 * Extracts the text content from a Gemini API response.
 * Returns null if the response is missing or malformed.
 */
export const extractGeminiText = (data: GeminiResponse | null | undefined): string | null =>
	data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

/**
 * Extracts and cleans the text from a Gemini response,
 * trimming whitespace and removing surrounding quotes.
 */
export const extractCleanGeminiText = (data: GeminiResponse | null | undefined): string | null => {
	const text = extractGeminiText(data);
	return text ? text.trim().replace(/^["']|["']$/g, '') : null;
};

/**
 * Creates an LLMProvider backed by the Google Gemini API.
 *
 * @example
 * ```ts
 * const provider = createGeminiProvider({ apiKey: 'your-api-key' });
 * const text = await provider.generateText('Hello!', { maxTokens: 100 });
 * ```
 */
export const createGeminiProvider = (config: GeminiProviderConfig): LLMProvider => ({
	generateText: async (prompt: string, options?: LLMOptions): Promise<string | null> => {
		const data = await callGemini(
			config.apiKey,
			{
				contents: [{ role: 'user', parts: [{ text: prompt }] }],
				generationConfig: {
					...(options?.maxTokens != null ? { maxOutputTokens: options.maxTokens } : {}),
					...(options?.temperature != null ? { temperature: options.temperature } : {})
				}
			},
			config.model
		);
		return extractCleanGeminiText(data);
	}
});
