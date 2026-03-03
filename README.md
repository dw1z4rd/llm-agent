# @llm/agent

A lightweight, **LLM-agnostic** AI agent library. Plug in any LLM provider (Gemini, OpenAI, Anthropic, Ollama, etc.) with zero lock-in. Use it for any project — audio generation, server monitoring, chatbots, code analysis, or anything else that needs an LLM.

## Features

- **`LLMProvider` interface** — generic contract any LLM can implement
- **`withRetry()`** — automatic retry wrapper for any provider
- **`createGeminiProvider()`** — built-in Google Gemini provider
- **`callGemini()`** — low-level Gemini API client (for advanced features like tool/function calling)
- API key redaction in all error logs
- Zero dependencies, zero project-specific logic

## Quick Start

### Using the Generic Interface

```typescript
import { createGeminiProvider, withRetry } from '@reality-engine/llm-agent';

// Create a provider backed by Gemini
const gemini = createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY });

// Wrap with retry logic
const provider = withRetry(gemini, { maxRetries: 3 });

// Generate text — works for any use case
const response = await provider.generateText('Describe a rainy soundscape', {
  maxTokens: 200,
  temperature: 0.9
});
```

### Plugging in a Different LLM

Implement the `LLMProvider` interface to use any LLM:

```typescript
import { withRetry } from '@reality-engine/llm-agent';
import type { LLMProvider, LLMOptions } from '@reality-engine/llm-agent';

// Example: OpenAI provider
const openaiProvider: LLMProvider = {
  generateText: async (prompt: string, options?: LLMOptions) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens,
        temperature: options?.temperature
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  }
};

// Use it with retry, same as any other provider
const reliable = withRetry(openaiProvider, { maxRetries: 3 });
const text = await reliable.generateText('Summarize CPU usage trends');
```

### Low-Level Gemini API (Advanced)

For Gemini-specific features like function/tool calling:

```typescript
import { callGemini } from '@reality-engine/llm-agent';

const data = await callGemini(apiKey, {
  contents: [{ role: 'user', parts: [{ text: 'Create something' }] }],
  tools: [{ functionDeclarations: myTools }],
  generationConfig: { maxOutputTokens: 2048 }
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
}

interface RetryConfig {
  maxRetries: number;
  onRetryableFailure?: (attempt: number, error?: unknown) => void;
}
```

### Functions

| Function | Description |
|---|---|
| `createGeminiProvider(config)` | Create an `LLMProvider` backed by Google Gemini |
| `withRetry(provider, config?)` | Wrap any `LLMProvider` with automatic retry logic |
| `callGemini(apiKey, body, model?)` | Low-level Gemini API call (for tool calling, etc.) |
| `extractGeminiText(response)` | Extract text from a raw Gemini API response |
| `extractCleanGeminiText(response)` | Extract + trim + remove quotes from Gemini response |
