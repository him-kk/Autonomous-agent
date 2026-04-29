import Groq from 'groq-sdk';
import { logger } from '@/utils/logger.js';
import { LLMOptions, LLMProvider, LLMResponse } from '@/types/llm.js';

export class GroqProvider implements LLMProvider {
  private client: Groq;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    this.defaultModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'; // ✅ updated default
    this.defaultTemperature = parseFloat(process.env.GROQ_TEMPERATURE || '0.3');
    this.defaultMaxTokens = parseInt(process.env.GROQ_MAX_TOKENS || '4000');
  }

  async generateText(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<string>> {
    const {
      model = this.defaultModel,
      temperature = this.defaultTemperature,
      maxTokens = this.defaultMaxTokens,
      systemPrompt = 'You are a helpful AI assistant.'
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      });

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || 'unknown'
      };
    } catch (error) {
      logger.error('Groq text generation error:', error);
      throw error;
    }
  }

  async generateJSON<T = any>(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<T>> {
    const {
      model = this.defaultModel,
      temperature = 0.1,
      maxTokens = this.defaultMaxTokens,
      systemPrompt = 'You are a helpful AI assistant. Always respond with valid JSON only. No markdown, no backticks, no explanation — just raw JSON.'
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' } // ✅ forces pure JSON output
      });

      const raw = response.choices[0]?.message?.content || '{}';

      // ✅ strip markdown fences as safety net
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      let parsedContent: T;
      try {
        parsedContent = JSON.parse(cleaned) as T;
      } catch (parseError) {
        logger.error('Failed to parse Groq JSON response:', { raw, cleaned });
        throw new Error('Invalid JSON response from LLM');
      }

      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content: parsedContent,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || 'unknown'
      };
    } catch (error) {
      logger.error('Groq JSON generation error:', error);
      throw error;
    }
  }

  async generateWithTools(
    prompt: string,
    tools: any[],
    options: LLMOptions = {}
  ): Promise<LLMResponse<any>> {
    const {
      model = this.defaultModel,
      temperature = this.defaultTemperature,
      maxTokens = this.defaultMaxTokens,
      systemPrompt = 'You are a helpful AI assistant with access to tools.'
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        tools,
        tool_choice: 'auto'
      } as any);

      const message = response.choices[0]?.message as any;
      const content = message?.content || '';
      const toolCalls = message?.tool_calls || [];
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content: {
          text: content,
          toolCalls
        },
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || 'unknown'
      };
    } catch (error) {
      logger.error('Groq tool generation error:', error);
      throw error;
    }
  }

  async analyzeImage(
    imageUrl: string,
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<string>> {
    throw new Error('Groq does not currently support image analysis. Use OpenAI or Anthropic for vision tasks.');
  }

  async createEmbedding(text: string): Promise<number[]> {
    throw new Error('Groq does not provide embedding API. Use alternative embedding service.');
  }

  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    throw new Error('Groq does not provide embedding API. Use alternative embedding service.');
  }
}