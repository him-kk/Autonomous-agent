// ============================================
// Relevance Filter Node - AI-Based Source Classification
// ============================================

import { llmService } from '@/services/llm.js';
import { logger } from '@/utils/logger.js';
import { 
  AgentState, 
  DiscoveredUrl, 
  SourceCategory,
  RelevanceCriteria 
} from '@/types/index.js';

interface ClassificationResult {
  url: string;
  isRelevant: boolean;
  category: SourceCategory;
  relevanceScore: number;
  reasoning: string;
}

export class RelevanceFilterNode {
  private nodeName = 'RelevanceFilterNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('RelevanceFilterNode invoked', { 
      urlsToFilter: state.discoveredUrls.length 
    });

    const startTime = Date.now();

    try {
      state.status = 'filtering';

      // Define relevance criteria based on the query
      const criteria = this.defineCriteria(state.query, state.plan);

      // Classify URLs
      const classifiedUrls = await this.classifyUrls(state.discoveredUrls, criteria);

      // Separate relevant and rejected URLs
      const relevantUrls = classifiedUrls
        .filter(c => c.isRelevant)
        .map(c => state.discoveredUrls.find(u => u.url === c.url)!)
        .filter(Boolean);

      const rejectedUrls = classifiedUrls
        .filter(c => !c.isRelevant)
        .map(c => state.discoveredUrls.find(u => u.url === c.url)!)
        .filter(Boolean);

      // Sort by relevance score
      relevantUrls.sort((a, b) => b.relevanceScore - a.relevanceScore);

      logger.info('Relevance filtering completed', {
        totalUrls: state.discoveredUrls.length,
        relevantUrls: relevantUrls.length,
        rejectedUrls: rejectedUrls.length,
        duration: Date.now() - startTime
      });

      return {
        discoveredUrls: relevantUrls,
        status: 'scraping'
      };
    } catch (error) {
      logger.error('RelevanceFilterNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }

  private defineCriteria(query: string, plan: any): RelevanceCriteria {
    // Extract target categories from the plan
    const targetCategories: SourceCategory[] = ['marketplace', 'agency', 'directory'];
    
    // Add context-specific categories
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('blog') || queryLower.includes('article')) {
      targetCategories.push('blog');
    }
    
    if (queryLower.includes('news')) {
      targetCategories.push('news');
    }
    
    if (queryLower.includes('forum') || queryLower.includes('community')) {
      targetCategories.push('forum');
    }

    return {
      targetCategories,
      minRelevanceScore: 3.0,
      excludePatterns: [
        'login',
        'signup',
        'register',
        'cart',
        'checkout',
        'admin',
        'wp-admin',
        'private'
      ]
    };
  }

  private async classifyUrls(
    urls: DiscoveredUrl[], 
    criteria: RelevanceCriteria
  ): Promise<ClassificationResult[]> {
    const batchSize = 10;
    const results: ClassificationResult[] = [];

    // Process in batches to avoid overwhelming the LLM
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await this.classifyBatch(batch, criteria);
      results.push(...batchResults);
    }

    return results;
  }

  private async classifyBatch(
    urls: DiscoveredUrl[],
    criteria: RelevanceCriteria
  ): Promise<ClassificationResult[]> {
    const prompt = this.buildClassificationPrompt(urls, criteria);

    try {
      const response = await llmService.generateJSON<{ results: ClassificationResult[] } | ClassificationResult[]>(prompt, {
        systemPrompt: this.getClassificationSystemPrompt(),
        temperature: 0.2
      });

      //  FIXED: Handle both wrapped and unwrapped arrays
      let results: ClassificationResult[];
      
      if (Array.isArray(response.content)) {
        // Direct array response
        results = response.content;
      } else if (response.content && typeof response.content === 'object') {
        // Wrapped in an object - try to find the array
        const obj = response.content as any;
        
        // Try common keys
        if (Array.isArray(obj.results)) {
          results = obj.results;
        } else if (Array.isArray(obj.classifications)) {
          results = obj.classifications;
        } else if (Array.isArray(obj.urls)) {
          results = obj.urls;
        } else if (Array.isArray(obj.data)) {
          results = obj.data;
        } else {
          // Find first array property
          const arrayValue = Object.values(obj).find(val => Array.isArray(val));
          if (arrayValue && Array.isArray(arrayValue)) {
            results = arrayValue as ClassificationResult[];
          } else {
            throw new Error('No array found in response');
          }
        }
      } else {
        throw new Error('Unexpected response format from LLM');
      }

      // Map results to ensure URLs match
      return results.map((result, index) => ({
        ...result,
        url: urls[index]?.url || result.url
      }));
    } catch (error) {
      logger.error('Batch classification failed, using fallback:', error);
      return this.fallbackClassification(urls, criteria);
    }
  }

  private getClassificationSystemPrompt(): string {
    return `You are an expert content classifier for web scraping operations.
Your task is to classify URLs based on their relevance to the user's query.

Categories:
- marketplace: Platforms where services/products are listed (Fiverr, Upwork, Clutch)
- agency: Company websites offering services
- directory: Listing sites, top 10 lists, comparison sites
- blog: Articles, blog posts, content sites
- news: News articles, press releases
- forum: Discussion forums, community sites
- social: Social media profiles
- unknown: Cannot be determined

For each URL, provide:
- isRelevant: boolean (true if relevant to the query)
- category: one of the categories above
- relevanceScore: number 0-10 (higher = more relevant)
- reasoning: brief explanation

CRITICAL: Respond with a JSON object with a "results" key containing an array of classification results.

Example format:
{
  "results": [
    {
      "url": "https://example.com",
      "isRelevant": true,
      "category": "agency",
      "relevanceScore": 8,
      "reasoning": "Company website offering services"
    }
  ]
}`;
  }

  private buildClassificationPrompt(
    urls: DiscoveredUrl[],
    criteria: RelevanceCriteria
  ): string {
    const urlsJson = urls.map(u => ({
      url: u.url,
      title: u.metadata?.title || '',
      snippet: u.metadata?.snippet || '',
      initialCategory: u.category,
      initialScore: u.relevanceScore
    }));

    //  Handle optional excludePatterns
    const excludePatterns = criteria.excludePatterns || [];

    return `Classify the following URLs for relevance to the search operation.

Target Categories: ${criteria.targetCategories.join(', ')}
Minimum Relevance Score: ${criteria.minRelevanceScore}
Exclude Patterns: ${excludePatterns.join(', ')}

URLs to classify:
${JSON.stringify(urlsJson, null, 2)}

Provide a JSON object with a "results" key containing an array of classification results for each URL in the same order.`;
  }

  private fallbackClassification(
    urls: DiscoveredUrl[],
    criteria: RelevanceCriteria
  ): ClassificationResult[] {
    //  Handle optional excludePatterns
    const excludePatterns = criteria.excludePatterns || [];

    return urls.map(url => {
      // Check exclude patterns
      const shouldExclude = excludePatterns.some(pattern => 
        url.url.toLowerCase().includes(pattern.toLowerCase())
      );

      if (shouldExclude) {
        return {
          url: url.url,
          isRelevant: false,
          category: url.category,
          relevanceScore: 0,
          reasoning: 'URL matches exclude pattern'
        };
      }

      // Check if category is in target categories
      const isRelevant = criteria.targetCategories.includes(url.category);
      
      return {
        url: url.url,
        isRelevant: isRelevant && url.relevanceScore >= criteria.minRelevanceScore,
        category: url.category,
        relevanceScore: url.relevanceScore,
        reasoning: isRelevant ? 'Category matches target' : 'Category not in target list'
      };
    });
  }

  // Advanced filtering with custom rules
  async filterWithCustomRules(
    urls: DiscoveredUrl[],
    rules: {
      includeDomains?: string[];
      excludeDomains?: string[];
      minScore?: number;
      maxResults?: number;
    }
  ): Promise<DiscoveredUrl[]> {
    let filtered = [...urls];

    // Filter by include domains
    if (rules.includeDomains && rules.includeDomains.length > 0) {
      filtered = filtered.filter(url => 
        rules.includeDomains!.some(domain => url.url.includes(domain))
      );
    }

    // Filter by exclude domains
    if (rules.excludeDomains && rules.excludeDomains.length > 0) {
      filtered = filtered.filter(url => 
        !rules.excludeDomains!.some(domain => url.url.includes(domain))
      );
    }

    // Filter by minimum score
    if (rules.minScore !== undefined) {
      filtered = filtered.filter(url => url.relevanceScore >= rules.minScore!);
    }

    // Sort by relevance and limit
    filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    if (rules.maxResults) {
      filtered = filtered.slice(0, rules.maxResults);
    }

    return filtered;
  }

  // Quick heuristic classification (no LLM)
  quickClassify(url: string, title: string = '', snippet: string = ''): SourceCategory {
    const content = `${url} ${title} ${snippet}`.toLowerCase();

    const patterns: Record<SourceCategory, string[]> = {
      marketplace: ['fiverr', 'upwork', 'freelancer', 'guru', 'clutch', 'goodfirms', 'g2', 'capterra'],
      agency: ['agency', 'company', 'firm', 'consulting', 'solutions', 'services'],
      directory: ['directory', 'list', 'top', 'best', 'ranking', 'compare'],
      blog: ['blog', 'article', 'post', 'guide', 'tutorial'],
      news: ['news', 'press', 'media', 'journal'],
      forum: ['forum', 'community', 'discussion', 'reddit'],
      social: ['facebook', 'twitter', 'linkedin', 'instagram'],
      unknown: []
    };

    for (const [category, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => content.includes(kw))) {
        return category as SourceCategory;
      }
    }

    return 'unknown';
  }
}

export const relevanceFilterNode = new RelevanceFilterNode();