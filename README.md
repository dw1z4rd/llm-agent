# @llm/agent

A lightweight, **LLM-agnostic** AI agent library. Plug in any LLM provider (Gemini, OpenAI, Anthropic, Ollama, etc.) with zero lock-in.

## Features

- **`LLMProvider` interface** — generic contract any LLM can implement
- **`withRetry()`** — automatic retry with exponential backoff for any provider
- **`withSystemPrompt()`** — default system prompt for any provider
- **`createGeminiProvider()`** — built-in Google Gemini provider (uses native `systemInstruction`)
- **`callGemini()`** — low-level Gemini API client for advanced use (tool/function calling, etc.)
- API key redaction in all error logs
- Zero runtime dependencies

## Installation

```bash
npm install @llm/agent
```

## Quick Start

```typescript
import { createGeminiProvider, withRetry, withSystemPrompt } from '@llm/agent';

const gemini = createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY });

const provider = withSystemPrompt(
  withRetry(gemini, { maxRetries: 3, initialDelayMs: 500, backoffFactor: 2 }),
  'You are a helpful assistant.'
);

const response = await provider.generateText('Summarise this article...', {
  maxTokens: 300,
  temperature: 0.7
});
```

## API Reference

### Types

```typescript
interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<string | null>;
}

interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  /** Passed to the provider as-is. Providers handle this natively where supported
   *  (e.g. Gemini sends it as systemInstruction). Custom providers must implement it. */
  systemPrompt?: string;
}

interface RetryConfig {
  maxRetries: number;
  /** Initial delay before the first retry in ms (default: 500) */
  initialDelayMs?: number;
  /** Multiplier applied to the delay after each attempt (default: 2) */
  backoffFactor?: number;
  onRetryableFailure?: (attempt: number, error?: unknown) => void;
}

interface GeminiProviderConfig {
  apiKey: string;
  /** Defaults to gemini-2.0-flash */
  model?: string;
}
```

### Functions

| Function | Description |
|---|---|
| `createGeminiProvider(config)` | Create an `LLMProvider` backed by Google Gemini |
| `withRetry(provider, config?)` | Wrap any provider with retry logic and exponential backoff |
| `withSystemPrompt(provider, systemPrompt)` | Wrap any provider with a default system prompt |
| `callGemini<T>(apiKey, body, model?)` | Low-level Gemini API call, returns `T \| null` |
| `extractGeminiText(response)` | Extract text from a raw Gemini API response |
| `extractCleanGeminiText(response)` | Extract and trim text, stripping surrounding quotes |

### `withRetry`

Retries on null/empty responses and thrown errors, with exponential backoff between attempts.

```typescript
const provider = withRetry(gemini, {
  maxRetries: 4,
  initialDelayMs: 250,  // first retry after 250ms
  backoffFactor: 2,     // then 500ms, 1000ms, ...
  onRetryableFailure: (attempt, error) => console.warn(`Attempt ${attempt} failed`, error)
});
```

### `withSystemPrompt`

Sets a default system prompt on every call. Call-time `options.systemPrompt` takes precedence.

The system prompt is passed via `options` — providers handle it natively where supported. `createGeminiProvider` sends it as `systemInstruction`. Custom providers must read and apply `options.systemPrompt` themselves.

```typescript
const agent = withSystemPrompt(provider, 'You are a concise assistant. Reply in one sentence.');

// Uses the bound system prompt
await agent.generateText('What is 2+2?');

// Call-time override
await agent.generateText('What is 2+2?', { systemPrompt: 'Reply only with a number.' });
```

### Custom providers

Implement `LLMProvider` to use any LLM:

```typescript
import type { LLMProvider, LLMOptions } from '@llm/agent';

const openaiProvider: LLMProvider = {
  generateText: async (prompt: string, options?: LLMOptions) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        max_tokens: options?.maxTokens,
        temperature: options?.temperature
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  }
};
```

### Low-level Gemini API

For Gemini-specific features like function/tool calling, use `callGemini` directly:

```typescript
import { callGemini } from '@llm/agent';

const data = await callGemini(apiKey, {
  contents: [{ role: 'user', parts: [{ text: 'Call my function' }] }],
  tools: [{ functionDeclarations: myTools }],
  generationConfig: { maxOutputTokens: 2048 }
});
```

For non-standard response shapes, pass a type parameter:

```typescript
const data = await callGemini<MyResponseShape>(apiKey, body);
```
