export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse<T = any> {
  content: T;
  usage: LLMUsage;
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

export interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse<string>>;
  generateJSON<T = any>(prompt: string, options?: LLMOptions): Promise<LLMResponse<T>>;
  generateWithTools(prompt: string, tools: any[], options?: LLMOptions): Promise<LLMResponse<any>>;
  analyzeImage(imageUrl: string, prompt: string, options?: LLMOptions): Promise<LLMResponse<string>>;
  createEmbedding(text: string): Promise<number[]>;
  createBatchEmbeddings(texts: string[]): Promise<number[][]>;
}
