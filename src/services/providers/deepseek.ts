import OpenAI from 'openai';
import { logger } from '@/utils/logger.js';
import { LLMOptions, LLMProvider, LLMResponse } from '@/types/llm.js';

// Deepseek uses OpenAI-compatible API
export class DeepseekProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    this.client = new OpenAI({
      apiKey,
      baseURL
    });

    this.defaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.defaultTemperature = parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.3');
    this.defaultMaxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS || '4000');
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
      logger.error('Deepseek text generation error:', error);
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
      systemPrompt = 'You are a helpful AI assistant. Always respond with valid JSON.'
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt} Respond ONLY with valid JSON. Do not include markdown formatting or any other text.`
          },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      });

      const content = response.choices[0]?.message?.content || '{}';
      let parsedContent: T;

      try {
        parsedContent = JSON.parse(content) as T;
      } catch (parseError) {
        logger.error('Failed to parse Deepseek JSON response:', content);
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
      logger.error('Deepseek JSON generation error:', error);
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
      });

      const message = response.choices[0]?.message;
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
      logger.error('Deepseek tool generation error:', error);
      throw error;
    }
  }

  async analyzeImage(
    imageUrl: string,
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<string>> {
    const {
      model = this.defaultModel,
      temperature = this.defaultTemperature,
      maxTokens = this.defaultMaxTokens
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature,
        max_tokens: maxTokens
      } as any);

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
      logger.error('Deepseek image analysis error:', error);
      throw error;
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    throw new Error('Deepseek embedding not yet implemented. Use OpenAI embedding provider.');
  }

  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    throw new Error('Deepseek embedding not yet implemented. Use OpenAI embedding provider.');
  }
}
