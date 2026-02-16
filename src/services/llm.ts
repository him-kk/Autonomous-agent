// ============================================
// LLM Service - OpenAI Integration
// ============================================

import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface LLMResponse<T = any> {
  content: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  systemPrompt?: string;
}

class LLMService {
  private static instance: LLMService;
  private client: OpenAI;

  private constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  async generateText(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<string>> {
    const {
      model = config.openai.model,
      temperature = config.openai.temperature,
      maxTokens = config.openai.maxTokens,
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
      logger.error('LLM text generation error:', error);
      throw error;
    }
  }

  async generateJSON<T = any>(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<T>> {
    const {
      model = config.openai.model,
      temperature = 0.1, // Lower temperature for JSON
      maxTokens = config.openai.maxTokens,
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
        logger.error('Failed to parse LLM JSON response:', content);
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
      logger.error('LLM JSON generation error:', error);
      throw error;
    }
  }

  async generateWithTools(
    prompt: string,
    tools: any[],
    options: LLMOptions = {}
  ): Promise<LLMResponse<any>> {
    const {
      model = config.openai.model,
      temperature = config.openai.temperature,
      maxTokens = config.openai.maxTokens,
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
      logger.error('LLM tool generation error:', error);
      throw error;
    }
  }

  async analyzeImage(
    imageUrl: string,
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<string>> {
    const {
      model = 'gpt-4o',
      temperature = config.openai.temperature,
      maxTokens = config.openai.maxTokens
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
      logger.error('LLM image analysis error:', error);
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
      logger.error('Embedding creation error:', error);
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
      logger.error('Batch embedding creation error:', error);
      throw error;
    }
  }
}

export const llmService = LLMService.getInstance();
