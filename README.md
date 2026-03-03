# @llm/agent

A lightweight, **LLM-agnostic** AI agent library. Plug in any LLM provider with zero lock-in.

## Features

- **`LLMProvider` interface** — generic contract any LLM can implement
- **`withRetry()`** — automatic retry with exponential backoff for any provider
- **`withSystemPrompt()`** — default system prompt for any provider
- **`createGeminiProvider()`** — built-in Google Gemini provider (uses native `systemInstruction`)
- **`createOpenAIProvider()`** — built-in OpenAI provider (uses system message)
- **`createAnthropicProvider()`** — built-in Anthropic provider (uses native `system` field)
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

const provider = withSystemPrompt(
  withRetry(
    createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY }),
    { maxRetries: 3, initialDelayMs: 500, backoffFactor: 2 }
  ),
  'You are a helpful assistant.'
);

const response = await provider.generateText('Summarise this article...', {
  maxTokens: 300,
  temperature: 0.7
});
```

## Built-in Providers

### Google Gemini

```typescript
import { createGeminiProvider } from '@llm/agent';

const provider = createGeminiProvider({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.0-flash' // default
});

const text = await provider.generateText('Hello!', {
  systemPrompt: 'You are a concise assistant.',
  maxTokens: 200,
  temperature: 0.8
});
```

`systemPrompt` is sent as Gemini's native `systemInstruction` field.

### OpenAI

```typescript
import { createOpenAIProvider } from '@llm/agent';

const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o' // default
});

const text = await provider.generateText('Hello!', {
  systemPrompt: 'You are a concise assistant.',
  maxTokens: 200,
  temperature: 0.8
});
```

`systemPrompt` is sent as a `system` role message prepended to the messages array.

### Anthropic

```typescript
import { createAnthropicProvider } from '@llm/agent';

const provider = createAnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6' // default
});

const text = await provider.generateText('Hello!', {
  systemPrompt: 'You are a concise assistant.',
  maxTokens: 512, // defaults to 1024 if not set (required by Anthropic API)
  temperature: 0.8
});
```

`systemPrompt` is sent as Anthropic's native top-level `system` field.

## API Reference

### Types

```typescript
interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<string | null>;
}

interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  /** Passed to the provider natively where supported.
   *  Custom providers must read and apply this themselves. */
  systemPrompt?: string;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs?: number; // default: 500
  backoffFactor?: number;  // default: 2
  onRetryableFailure?: (attempt: number, error?: unknown) => void;
}

interface GeminiProviderConfig  { apiKey: string; model?: string; }
interface OpenAIProviderConfig  { apiKey: string; model?: string; }
interface AnthropicProviderConfig { apiKey: string; model?: string; }
```

### Functions

| Function | Description |
|---|---|
| `createGeminiProvider(config)` | `LLMProvider` backed by Google Gemini |
| `createOpenAIProvider(config)` | `LLMProvider` backed by OpenAI |
| `createAnthropicProvider(config)` | `LLMProvider` backed by Anthropic |
| `withRetry(provider, config?)` | Wrap any provider with retry and exponential backoff |
| `withSystemPrompt(provider, systemPrompt)` | Wrap any provider with a default system prompt |
| `callGemini<T>(apiKey, body, model?)` | Low-level Gemini API call, returns `T \| null` |
| `extractGeminiText(response)` | Extract text from a raw Gemini API response |
| `extractCleanGeminiText(response)` | Extract and trim text, stripping surrounding quotes |

### `withRetry`

Retries on null/empty responses and thrown errors with exponential backoff.

```typescript
const provider = withRetry(gemini, {
  maxRetries: 4,
  initialDelayMs: 250, // first retry after 250ms
  backoffFactor: 2,    // then 500ms, 1000ms, 2000ms ...
  onRetryableFailure: (attempt, error) => console.warn(`Attempt ${attempt} failed`, error)
});
```

### `withSystemPrompt`

Sets a default system prompt on every call. Call-time `options.systemPrompt` takes precedence.

The system prompt is passed via `options` so providers can handle it natively. Custom provider implementors must read and apply `options.systemPrompt` themselves.

```typescript
const agent = withSystemPrompt(provider, 'You are a concise assistant.');

await agent.generateText('What is 2+2?');
// override per-call:
await agent.generateText('What is 2+2?', { systemPrompt: 'Reply only with a number.' });
```

### Custom providers

Implement `LLMProvider` to use any LLM:

```typescript
import type { LLMProvider, LLMOptions } from '@llm/agent';

const myProvider: LLMProvider = {
  generateText: async (prompt: string, options?: LLMOptions) => {
    const response = await myLLMApi({
      system: options?.systemPrompt,
      user: prompt,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature
    });
    return response.text ?? null;
  }
};
```

### Low-level Gemini API

For Gemini-specific features like function/tool calling:

```typescript
import { callGemini } from '@llm/agent';

const data = await callGemini(apiKey, {
  contents: [{ role: 'user', parts: [{ text: 'Call my function' }] }],
  tools: [{ functionDeclarations: myTools }],
  generationConfig: { maxOutputTokens: 2048 }
});

// Pass a type parameter for non-standard response shapes:
const data = await callGemini<MyResponseShape>(apiKey, body);
```
