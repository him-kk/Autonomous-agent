# LLM Provider Guide

This project now supports multiple LLM providers. You can easily switch between them by changing the `LLM_PROVIDER` environment variable.


## Installation

### Install Required Dependencies

Install the SDK for your chosen provider(s):

```bash
# OpenAI (default)
npm install openai


# Groq
npm install groq-sdk
```

Note: Qwen, Deepseek, and OpenClaw use OpenAI-compatible APIs, so they only require the `openai` SDK.

If you plan to use multiple providers, install all SDKs:

```bash
npm install openai groq-sdk
```

## Configuration

### 1. Copy the `.env.example` file

```bash
cp .env.example .env
```

### 2. Set Your Provider

Choose ONE provider and add its credentials to `.env`:

#### OpenAI (Default)

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=4000
```


```env
```

#### Groq

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk-...
GROQ_MODEL=mixtral-8x7b-32768
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=4000
```

#### Qwen (Alibaba Cloud)

```env
LLM_PROVIDER=qwen
QWEN_API_KEY=your-qwen-api-key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-turbo
QWEN_TEMPERATURE=0.3
QWEN_MAX_TOKENS=4000
```

#### Deepseek

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TEMPERATURE=0.3
DEEPSEEK_MAX_TOKENS=4000
```

#### OpenClaw

```env
LLM_PROVIDER=openclaw
OPENCLAW_API_KEY=your-openclaw-api-key
OPENCLAW_BASE_URL=https://api.openclaw.com/v1
OPENCLAW_MODEL=openclaw-7b
OPENCLAW_TEMPERATURE=0.3
OPENCLAW_MAX_TOKENS=4000
```

## Testing Different Providers

### Quick Test Script

Create `test-providers.ts` to verify each provider:

```typescript
import { llmService } from './src/services/llm.js';

async function testProvider() {
  try {
    // Test text generation
    const textResponse = await llmService.generateText('Say hello!');
    console.log('Text Response:', textResponse.content);

    // Test JSON generation
    const jsonResponse = await llmService.generateJSON({
      prompt: 'Return a JSON object with name and age',
      systemPrompt: 'Return valid JSON only'
    });
    console.log('JSON Response:', jsonResponse.content);

    // Test embeddings (OpenAI only)
    const embedding = await llmService.createEmbedding('test text');
    console.log('Embedding created:', embedding.length > 0 ? 'Success' : 'Failed');
  } catch (error) {
    console.error('Provider test failed:', error.message);
  }
}

testProvider();
```

### Run Tests for Each Provider

```bash
# Test OpenAI
LLM_PROVIDER=openai npm run dev


# Test Groq
LLM_PROVIDER=groq npm run dev

# Test Qwen
LLM_PROVIDER=qwen npm run dev

# Test Deepseek
LLM_PROVIDER=deepseek npm run dev

# Test OpenClaw
LLM_PROVIDER=openclaw npm run dev
```

## Adding a New Provider

To add support for a new LLM provider:

1. **Create a new provider file** at `src/services/providers/newprovider.ts`:

```typescript
import { LLMOptions, LLMProvider, LLMResponse } from '@/types/llm.js';

export class NewProvider implements LLMProvider {
  async generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse<string>> {
    // Implementation
  }

  async generateJSON<T = any>(prompt: string, options?: LLMOptions): Promise<LLMResponse<T>> {
    // Implementation
  }

  async generateWithTools(prompt: string, tools: any[], options?: LLMOptions): Promise<LLMResponse<any>> {
    // Implementation
  }

  async analyzeImage(imageUrl: string, prompt: string, options?: LLMOptions): Promise<LLMResponse<string>> {
    // Implementation (optional)
  }

  async createEmbedding(text: string): Promise<number[]> {
    // Implementation (optional)
  }

  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Implementation (optional)
  }
}
```

2. **Update the config schema** in `src/config/index.ts` to include the new provider credentials.

3. **Update the LLM service** in `src/services/llm.ts` to import and route to your new provider.

4. **Add to the exports** in `src/services/providers/index.ts`.

5. **Update `.env.example`** with the new provider's environment variables.

## Provider Comparison

### Performance

- **Groq**: Fastest (optimized for speed)
- **Deepseek**: Very fast and cost-effective
- **OpenAI**: Balanced (higher latency, better quality)
- **Qwen**: Good balance
- **OpenClaw**: Depends on infrastructure



Typically from lowest to highest:
1. **Qwen** - Most cost-effective
2. **Deepseek** - Very affordable
3. **Groq** - Free tier available
4. **OpenAI** - Premium pricing
6. **OpenClaw** - Varies

## Handling Embedding Fallback

For providers without embeddings support, you can:

1. **Use OpenAI for embeddings only**:
```typescript
// Use OpenAI provider just for embeddings
const embeddingProvider = new OpenAIProvider();
const embedding = await embeddingProvider.createEmbedding(text);
```

2. **Use an external embedding service**:
```typescript
// HuggingFace, sentence-transformers, etc.
// Update memory.ts and multimodal.ts to use alternative service
```

## Troubleshooting

### Provider not recognized
- Ensure `LLM_PROVIDER` environment variable is set correctly
- Check `.env` file for typos in provider name

### API Key errors
- Verify API key format for your provider
- Check if API key has the required permissions
- Ensure API key is valid and not expired

### Embedding errors
- Embedding is only supported with OpenAI provider
- For other providers, implement fallback or use external service

### Rate limiting
- Groq has aggressive rate limits on free tier
OpenAI has standard rate limits
- Deepseek offers higher limits for paid tier

## Environment Variables Reference

See `.env.example` for complete list of all supported environment variables for each provider.

## Adding Provider Support Dynamically

You can also set provider at runtime:

```typescript
// In your application startup
process.env.LLM_PROVIDER = 'groq';
process.env.GROQ_API_KEY = process.env.GROQ_KEY;

// Then initialize llmService
const { llmService } = await import('@/services/llm.js');
```

Note: This requires reloading the service, so it's better to set via `.env` before startup.
