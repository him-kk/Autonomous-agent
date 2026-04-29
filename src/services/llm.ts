import  {config}  from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { OpenAIProvider } from '@/services/providers/openai.js';
import { GroqProvider } from '@/services/providers/groq.js';
import { QwenProvider } from '@/services/providers/qwen.js';
import { DeepseekProvider } from '@/services/providers/deepseek.js';
import { OpenClawProvider } from '@/services/providers/openclaw.js';
import { LLMOptions, LLMProvider, LLMResponse } from '@/types/llm.js';

const createProvider = (): LLMProvider => {
  switch (config.llm.provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'groq':
      return new GroqProvider();
    case 'qwen':
      return new QwenProvider();
    case 'deepseek':
      return new DeepseekProvider();
    case 'openclaw':
      return new OpenClawProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
  }
};

class LLMService {
  private static instance: LLMService;
  private provider: LLMProvider;

  private constructor() {
    this.provider = createProvider();
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
    try {
      return await this.provider.generateText(prompt, options);
    } catch (error) {
      logger.error('LLM text generation error:', error);
      throw error;
    }
  }

  async generateJSON<T = any>(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse<T>> {
    try {
      return await this.provider.generateJSON<T>(prompt, options);
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
    try {
      return await this.provider.generateWithTools(prompt, tools, options);
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
    try {
      return await this.provider.analyzeImage(imageUrl, prompt, options);
    } catch (error) {
      logger.error('LLM image analysis error:', error);
      throw error;
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      return await this.provider.createEmbedding(text);
    } catch (error) {
      logger.error('LLM embedding creation error:', error);
      throw error;
    }
  }

  async createBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      return await this.provider.createBatchEmbeddings(texts);
    } catch (error) {
      logger.error('LLM batch embedding creation error:', error);
      throw error;
    }
  }
}

export const llmService = LLMService.getInstance();
