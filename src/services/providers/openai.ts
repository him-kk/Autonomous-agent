import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { LLMOptions, LLMProvider, LLMResponse } from '@/types/llm.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.llm.openai.apiKey
    });

    this.defaultModel = config.llm.openai.model;
    this.defaultTemperature = config.llm.openai.temperature;
    this.defaultMaxTokens = config.llm.openai.maxTokens;
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
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await this.client.chat.completions.create({
        model,
        messages,
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
      logger.error('OpenAI text generation error:', error);
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
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `${systemPrompt} Respond ONLY with valid JSON. Do not include markdown formatting or any other text.`
        },
        { role: 'user', content: prompt }
      ];

      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      let parsedContent: T;

      try {
        parsedContent = JSON.parse(content) as T;
      } catch (parseError) {
        logger.error('Failed to parse OpenAI JSON response:', content);
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
      logger.error('OpenAI JSON generation error:', error);
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
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await this.client.chat.completions.create({
        model,
        messages,
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
      logger.error('OpenAI tool generation error:', error);
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
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ];

      const response = await this.client.chat.completions.create({
        model,
        messages,
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
      logger.error('OpenAI image analysis error:', error);
      throw error;
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      logger.error('OpenAI embedding creation error:', error);
      throw error;
    }
  }

  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts
      });

      return response.data.map(d => d.embedding);
    } catch (error) {
      logger.error('OpenAI batch embedding creation error:', error);
      throw error;
    }
  }
}
