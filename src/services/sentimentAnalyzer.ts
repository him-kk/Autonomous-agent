// ============================================
// Sentiment Analyzer - Review Analysis
// ============================================

import { llmService } from '@/services/llm.js';
import { logger } from '@/utils/logger.js';

export class SentimentAnalyzer {
  /**
   * Analyze review sentiment
   */
  async analyzeReview(reviewText: string): Promise<{
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }> {
    try {
      const prompt = `Analyze the sentiment of the following review and return a JSON object with:
- score: a number between -1 (very negative) and 1 (very positive)
- label: "positive", "neutral", or "negative"
- confidence: a number between 0 and 1

Review: "${reviewText}"

Return only valid JSON.`;

      const response = await llmService.generateJSON<{
        score: number;
        label: 'positive' | 'neutral' | 'negative';
        confidence: number;
      }>(prompt, {
        systemPrompt: 'You are a sentiment analysis expert.',
        temperature: 0.1
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to analyze review sentiment:', error);
      return { score: 0, label: 'neutral', confidence: 0 };
    }
  }

  /**
   * Extract pros and cons from review
   */
  async extractProsAndCons(reviewText: string): Promise<{
    pros: string[];
    cons: string[];
  }> {
    try {
      const prompt = `Extract the pros (positive points) and cons (negative points) from this review:

"${reviewText}"

Return a JSON object with:
- pros: array of positive points
- cons: array of negative points

Return only valid JSON.`;

      const response = await llmService.generateJSON<{
        pros: string[];
        cons: string[];
      }>(prompt, {
        systemPrompt: 'You are an expert at extracting key points from reviews.',
        temperature: 0.1
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to extract pros/cons:', error);
      return { pros: [], cons: [] };
    }
  }

  /**
   * Analyze aspect-based sentiment
   */
  async analyzeAspects(reviewText: string): Promise<{
    quality?: number;
    communication?: number;
    timeliness?: number;
    valueForMoney?: number;
    expertise?: number;
  }> {
    try {
      const prompt = `Rate the following aspects (1-5) based on this review:

"${reviewText}"

Aspects:
- quality: Overall quality of work
- communication: Communication effectiveness
- timeliness: Meeting deadlines
- valueForMoney: Value for money
- expertise: Level of expertise

Return a JSON object with scores for each aspect. Only include aspects that are mentioned.

Return only valid JSON.`;

      const response = await llmService.generateJSON<{
        quality?: number;
        communication?: number;
        timeliness?: number;
        valueForMoney?: number;
        expertise?: number;
      }>(prompt, {
        systemPrompt: 'You are an expert at aspect-based sentiment analysis.',
        temperature: 0.1
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to analyze aspects:', error);
      return {};
    }
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();