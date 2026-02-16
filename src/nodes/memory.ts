// ============================================
// Memory Store Node - Vector DB Integration for Learning
// ============================================

import { llmService } from '@/services/llm.js';
import { memoryLogger as logger } from '@/utils/logger.js';
import { 
  AgentState, 
  MemoryInsight,
  MemoryEntry as MemoryEntryType 
} from '@/types/index.js';
import { MemoryEntry } from '@/models/Memory.js';
import { config } from '@/config/index.js';

export class MemoryNode {
  private nodeName = 'MemoryNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('MemoryNode invoked', { sessionId: state.sessionId });

    const startTime = Date.now();
    const insights: MemoryInsight[] = [];

    try {
      // Store successful patterns
      await this.storeSuccessfulPatterns(state);

      // Store failures for learning
      await this.storeFailures(state);

      // Generate insights
      const patternInsights = await this.generatePatternInsights(state);
      insights.push(...patternInsights);

      // Update embeddings for similarity search
      await this.updateEmbeddings();

      // Retrieve relevant memories for future use
      const relevantMemories = await this.retrieveRelevantMemories(state.query);

      logger.info('MemoryNode completed', {
        insightsGenerated: insights.length,
        memoriesRetrieved: relevantMemories.length,
        duration: Date.now() - startTime
      });

      return {
        memoryInsights: insights
      };
    } catch (error) {
      logger.error('MemoryNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      // Memory errors shouldn't stop the pipeline
      return {};
    }
  }

  private async storeSuccessfulPatterns(state: AgentState): Promise<void> {
    const successfulScrapes = state.scrapedData.filter(s => s.success);

    for (const scrape of successfulScrapes) {
      try {
        const domain = new URL(scrape.url).hostname;
        
        // Store selector patterns
        if (scrape.metadata.domSelector) {
          await this.storeMemory({
            type: 'selector',
            key: `selector_${domain}_${Date.now()}`,
            value: {
              selectors: scrape.metadata.domSelector,
              url: scrape.url,
              extractedKeys: Object.keys(scrape.extractedData)
            },
            metadata: {
              url: scrape.url,
              domain,
              success: true,
              confidence: 0.85
            },
            tags: ['selector', 'success', domain]
          });
        }

        // Store scraping pattern
        await this.storeMemory({
          type: 'scraping_pattern',
          key: `pattern_${domain}_${Date.now()}`,
          value: {
            url: scrape.url,
            loadTime: scrape.metadata.loadTime,
            method: scrape.scrapingMethod,
            dataExtracted: Object.keys(scrape.extractedData)
          },
          metadata: {
            url: scrape.url,
            domain,
            success: true,
            confidence: 0.8
          },
          tags: ['pattern', 'success', domain]
        });
      } catch (error) {
        logger.warn('Failed to store successful pattern:', error);
      }
    }
  }

  private async storeFailures(state: AgentState): Promise<void> {
    for (const failure of state.failedUrls) {
      try {
        const domain = new URL(failure.url).hostname;
        
        await this.storeMemory({
          type: 'failure',
          key: `failure_${domain}_${Date.now()}`,
          value: {
            url: failure.url,
            error: failure.error,
            errorType: failure.errorType,
            retryCount: failure.retryCount
          },
          metadata: {
            url: failure.url,
            domain,
            success: false,
            confidence: 0.9
          },
          tags: ['failure', failure.errorType, domain]
        });
      } catch (error) {
        logger.warn('Failed to store failure:', error);
      }
    }
  }

  private async generatePatternInsights(state: AgentState): Promise<MemoryInsight[]> {
    const insights: MemoryInsight[] = [];

    try {
      // Analyze successful patterns
      const successPatterns = await MemoryEntry.findByType('scraping_pattern', 20);
      
      if (successPatterns.length > 0) {
        // Find common successful domains
        const domainSuccess = new Map<string, number>();
        for (const pattern of successPatterns) {
          const domain = pattern.metadata.domain;
          if (domain) {
            domainSuccess.set(domain, (domainSuccess.get(domain) || 0) + 1);
          }
        }

        // Generate insights for high-success domains
        for (const [domain, count] of domainSuccess.entries()) {
          if (count >= 3) {
            insights.push({
              type: 'pattern',
              description: `Domain "${domain}" has high scraping success rate (${count} successes)`,
              confidence: Math.min(count / 5, 1),
              relatedUrls: successPatterns
                .filter(p => p.metadata.domain === domain)
                .map(p => p.metadata.url || ''),
              createdAt: new Date()
            });
          }
        }
      }

      // Analyze failures
      const failures = await MemoryEntry.findByType('failure', 20);
      
      if (failures.length > 0) {
        const errorTypes = new Map<string, number>();
        for (const failure of failures) {
          const errorType = failure.value.errorType || 'unknown';
          errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
        }

        for (const [errorType, count] of errorTypes.entries()) {
          if (count >= 3) {
            insights.push({
              type: 'failure',
              description: `Frequent error type "${errorType}" detected (${count} occurrences)`,
              confidence: Math.min(count / 10, 1),
              relatedUrls: failures
                .filter(f => f.value.errorType === errorType)
                .map(f => f.metadata.url || ''),
              createdAt: new Date()
            });
          }
        }
      }

      // Store insights
      for (const insight of insights) {
        await this.storeMemory({
          type: 'insight',
          key: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          value: insight,
          metadata: {
            success: true,
            confidence: insight.confidence
          },
          tags: ['insight', insight.type]
        });
      }
    } catch (error) {
      logger.error('Failed to generate insights:', error);
    }

    return insights;
  }

  private async updateEmbeddings(): Promise<void> {
    try {
      // Get entries without embeddings
      const entriesWithoutEmbeddings = await MemoryEntry.find({
        embedding: { $size: 0 }
      }).limit(50);

      for (const entry of entriesWithoutEmbeddings) {
        try {
          const textToEmbed = `${entry.type} ${entry.key} ${JSON.stringify(entry.value)}`;
          const embedding = await llmService.createEmbedding(textToEmbed);
          
          await entry.updateEmbedding(embedding);
        } catch (error) {
          logger.warn('Failed to create embedding:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to update embeddings:', error);
    }
  }

  private async retrieveRelevantMemories(query: string): Promise<MemoryEntryType[]> {
    try {
      // Create embedding for query
      const queryEmbedding = await llmService.createEmbedding(query);
      
      // Find similar memories
      const similarMemories = await MemoryEntry.findSimilar(queryEmbedding, undefined, 10);
      
      // Increment access count
      for (const memory of similarMemories) {
        await memory.incrementAccess();
      }
      
      return similarMemories;
    } catch (error) {
      logger.error('Failed to retrieve relevant memories:', error);
      return [];
    }
  }

  private async storeMemory(data: {
    type: 'scraping_pattern' | 'selector' | 'failure' | 'success' | 'insight' | 'strategy';
    key: string;
    value: any;
    metadata: {
      url?: string;
      domain?: string;
      query?: string;
      success: boolean;
      confidence: number;
    };
    tags: string[];
  }): Promise<void> {
    try {
      // Check if similar entry exists
      const existing = await MemoryEntry.findOne({
        type: data.type,
        key: data.key
      });

      if (existing) {
        // Update existing
        existing.value = data.value;
        existing.metadata = { ...existing.metadata, ...data.metadata };
        existing.updatedAt = new Date();
        await existing.save();
      } else {
        // Create new
        const entry = new MemoryEntry(data);
        await entry.save();
      }
    } catch (error) {
      logger.error('Failed to store memory:', error);
      throw error;
    }
  }

  // Get learned selectors for a domain
  async getLearnedSelectors(domain: string): Promise<string[]> {
    try {
      const selectors = await MemoryEntry.find({
        type: 'selector',
        'metadata.domain': domain,
        'metadata.success': true
      })
      .sort({ 'metadata.confidence': -1 })
      .limit(5);

      return selectors.map(s => s.value.selectors).filter(Boolean);
    } catch (error) {
      logger.error('Failed to get learned selectors:', error);
      return [];
    }
  }

  // Get failure patterns for a domain
  async getFailurePatterns(domain: string): Promise<any[]> {
    try {
      const failures = await MemoryEntry.findByDomain(domain, 'failure');
      return failures.map(f => ({
        errorType: f.value.errorType,
        error: f.value.error,
        count: f.accessCount
      }));
    } catch (error) {
      logger.error('Failed to get failure patterns:', error);
      return [];
    }
  }

  // Learn from user feedback
  async learnFromFeedback(
    url: string,
    feedback: { correct: boolean; corrections?: Record<string, any> }
  ): Promise<void> {
    try {
      const domain = new URL(url).hostname;
      
      await this.storeMemory({
        type: 'success',
        key: `feedback_${domain}_${Date.now()}`,
        value: {
          url,
          feedback,
          corrections: feedback.corrections
        },
        metadata: {
          url,
          domain,
          success: feedback.correct,
          confidence: feedback.correct ? 0.95 : 0.5
        },
        tags: ['feedback', feedback.correct ? 'positive' : 'negative', domain]
      });

      logger.info('Learned from user feedback', { url, correct: feedback.correct });
    } catch (error) {
      logger.error('Failed to learn from feedback:', error);
    }
  }
}

export const memoryNode = new MemoryNode();
