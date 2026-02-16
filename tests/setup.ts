// ============================================
// Test Setup
// ============================================

import { config } from '@/config/index.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';

// Global test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('@/services/llm.js', () => ({
  llmService: {
    generateText: jest.fn().mockResolvedValue({
      content: 'Mocked response',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'gpt-4o',
      finishReason: 'stop'
    }),
    generateJSON: jest.fn().mockResolvedValue({
      content: {},
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'gpt-4o',
      finishReason: 'stop'
    }),
    createEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1))
  }
}));

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue({ status: () => 200 }),
          content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
          close: jest.fn()
        }),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }
}));

// Global teardown
afterAll(async () => {
  // Clean up any resources
});
