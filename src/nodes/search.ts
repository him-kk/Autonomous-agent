// ============================================
// Search Node - SERP API Integration & URL Discovery
// ============================================

import axios, { AxiosError } from 'axios';
import { config } from '@/config/index.js';
import { searchLogger as logger } from '@/utils/logger.js';
import { 
  AgentState, 
  SearchInput, 
  SearchOutput, 
  SearchResult,
  DiscoveredUrl,
  SourceCategory 
} from '@/types/index.js';

// Search API configurations
interface SearchProvider {
  name: string;
  search: (query: string, maxResults: number) => Promise<SearchResult[]>;
}

export class SearchNode {
  private nodeName = 'SearchNode';
  private providers: SearchProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // SerpAPI Provider
    if (config.search.serpapiKey) {
      this.providers.push({
        name: 'serpapi',
        search: this.searchSerpAPI.bind(this)
      });
    }

    // Bing API Provider
    if (config.search.bingApiKey) {
      this.providers.push({
        name: 'bing',
        search: this.searchBing.bind(this)
      });
    }

    // Google Custom Search Provider
    if (config.search.googleApiKey && config.search.googleCx) {
      this.providers.push({
        name: 'google',
        search: this.searchGoogle.bind(this)
      });
    }

    // DuckDuckGo Scraper (fallback)
    if (config.search.duckduckgoEnabled) {
      this.providers.push({
        name: 'duckduckgo',
        search: this.searchDuckDuckGo.bind(this)
      });
    }
  }

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('SearchNode invoked', { 
      query: state.query, 
      searchQueries: state.searchQueries.length 
    });

    const startTime = Date.now();
    const allResults: SearchResult[] = [];

    try {
      state.status = 'searching';

      // Execute searches for each query
      for (const query of state.searchQueries) {
        try {
          const results = await this.executeSearch(query, 10);
          allResults.push(...results);
          
          logger.info('Search completed for query', { 
            query, 
            resultsFound: results.length 
          });
        } catch (error) {
          //  FIXED: Properly format error object
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorDetails = this.formatAxiosError(error);
          
          logger.error('Search failed for query:', { 
            query, 
            error: errorMessage,
            details: errorDetails
          });
        }
      }

      // Remove duplicates and convert to discovered URLs
      const uniqueResults = this.deduplicateResults(allResults);
      const discoveredUrls = this.convertToDiscoveredUrls(uniqueResults);

      logger.info('SearchNode completed', {
        totalQueries: state.searchQueries.length,
        totalResults: allResults.length,
        uniqueResults: uniqueResults.length,
        duration: Date.now() - startTime
      });

      return {
        discoveredUrls,
        status: 'filtering'
      };
    } catch (error) {
      logger.error('SearchNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }

  //  NEW: Helper to format axios errors
  private formatAxiosError(error: any): any {
    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      };
    }
    return error;
  }

  private async executeSearch(query: string, maxResults: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Try each provider until we get results
    for (const provider of this.providers) {
      try {
        logger.info(`Trying provider: ${provider.name}`, { query });
        const providerResults = await provider.search(query, maxResults);
        results.push(...providerResults);
        
        logger.info(`Provider ${provider.name} returned results`, { 
          count: providerResults.length 
        });
        
        if (results.length >= maxResults) {
          break;
        }
      } catch (error) {
        const errorDetails = this.formatAxiosError(error);
        logger.warn(`Search provider ${provider.name} failed:`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          details: errorDetails
        });
        continue;
      }
    }

    return results.slice(0, maxResults);
  }

  private async searchSerpAPI(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const url = 'https://serpapi.com/search';
      
      logger.info('Calling SerpAPI', { 
        query, 
        apiKey: config.search.serpapiKey?.substring(0, 10) + '...' 
      });

      const response = await axios.get(url, {
        params: {
          q: query,
          api_key: config.search.serpapiKey,
          engine: 'google',
          num: maxResults
        },
        timeout: 10000
      });

      //  Check for API errors in response
      if (response.data.error) {
        throw new Error(`SerpAPI Error: ${response.data.error}`);
      }

      const organicResults = response.data.organic_results || [];
      
      logger.info('SerpAPI response received', { 
        resultsCount: organicResults.length,
        searchInfo: response.data.search_information 
      });

      return organicResults.map((result: any, index: number) => ({
        title: result.title || '',
        url: result.link || '',
        snippet: result.snippet || '',
        source: 'serpapi',
        rank: index + 1,
        metadata: {
          displayedUrl: result.displayed_url,
          date: result.date
        }
      }));
    } catch (error) {
      //  FIXED: Properly handle and re-throw errors
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.error || error.message;
        
        logger.error('SerpAPI axios error', {
          status: statusCode,
          message: errorMessage,
          data: error.response?.data
        });

        throw new Error(`SerpAPI failed (${statusCode}): ${errorMessage}`);
      }
      
      throw error;
    }
  }

  private async searchBing(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const url = 'https://api.bing.microsoft.com/v7.0/search';
      const response = await axios.get(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': config.search.bingApiKey
        },
        params: {
          q: query,
          count: maxResults
        },
        timeout: 10000
      });

      const webPages = response.data.webPages?.value || [];
      
      return webPages.map((result: any, index: number) => ({
        title: result.name || '',
        url: result.url || '',
        snippet: result.snippet || '',
        source: 'bing',
        rank: index + 1,
        metadata: {
          dateLastCrawled: result.dateLastCrawled,
          displayUrl: result.displayUrl
        }
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Bing API failed: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  private async searchGoogle(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const url = 'https://www.googleapis.com/customsearch/v1';
      const response = await axios.get(url, {
        params: {
          q: query,
          key: config.search.googleApiKey,
          cx: config.search.googleCx,
          num: Math.min(maxResults, 10)
        },
        timeout: 10000
      });

      const items = response.data.items || [];
      
      return items.map((result: any, index: number) => ({
        title: result.title || '',
        url: result.link || '',
        snippet: result.snippet || '',
        source: 'google',
        rank: index + 1,
        metadata: {
          formattedUrl: result.formattedUrl,
          htmlSnippet: result.htmlSnippet
        }
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Google API failed: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    // DuckDuckGo doesn't have an official API, so we use their HTML interface
    // This is a simplified implementation - in production, use a proper scraping approach
    const url = 'https://html.duckduckgo.com/html/';
    
    try {
      const response = await axios.post(url, 
        new URLSearchParams({ q: query, kl: 'us-en' }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        }
      );

      // Parse HTML response (simplified)
      const html = response.data;
      const results: SearchResult[] = [];
      
      // Extract results using regex (in production, use Cheerio)
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
      let match;
      let count = 0;
      
      while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
        const url = match[1];
        const title = match[2].replace(/<[^>]*>/g, '');
        
        results.push({
          title,
          url,
          snippet: '',
          source: 'duckduckgo',
          rank: count + 1
        });
        count++;
      }

      return results;
    } catch (error) {
      logger.error('DuckDuckGo search failed:', this.formatAxiosError(error));
      return [];
    }
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const normalized = this.normalizeUrl(result.url);
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slashes, www prefix, and query parameters
      return `${urlObj.hostname.replace(/^www\./, '')}${urlObj.pathname.replace(/\/$/, '')}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private convertToDiscoveredUrls(results: SearchResult[]): DiscoveredUrl[] {
    return results.map(result => ({
      url: result.url,
      source: result.source,
      relevanceScore: this.calculateRelevanceScore(result),
      category: this.categorizeUrl(result.url, result.title, result.snippet),
      discoveredAt: new Date(),
      metadata: {
        title: result.title,
        snippet: result.snippet,
        rank: result.rank,
        ...result.metadata
      }
    }));
  }

  private calculateRelevanceScore(result: SearchResult): number {
    let score = 0;
    
    // Higher rank = higher score
    score += Math.max(0, 11 - result.rank) * 0.5;
    
    // Check for marketplace indicators
    const marketplaceDomains = ['fiverr.com', 'upwork.com', 'freelancer.com', 'clutch.co', 'goodfirms.co'];
    if (marketplaceDomains.some(domain => result.url.includes(domain))) {
      score += 2;
    }
    
    // Check for service indicators in title/snippet
    const serviceKeywords = ['agency', 'services', 'company', 'consulting', 'solutions'];
    const content = `${result.title} ${result.snippet}`.toLowerCase();
    if (serviceKeywords.some(kw => content.includes(kw))) {
      score += 1;
    }
    
    return Math.min(score, 10);
  }

  private categorizeUrl(url: string, title: string, snippet: string): SourceCategory {
    const content = `${url} ${title} ${snippet}`.toLowerCase();
    
    // Marketplace indicators
    const marketplaceIndicators = ['fiverr', 'upwork', 'freelancer', 'guru', 'peopleperhour', 'clutch', 'goodfirms'];
    if (marketplaceIndicators.some(ind => content.includes(ind))) {
      return 'marketplace';
    }
    
    // Agency indicators
    const agencyIndicators = ['agency', 'company', 'services', 'consulting', 'solutions', 'firm'];
    if (agencyIndicators.some(ind => content.includes(ind))) {
      return 'agency';
    }
    
    // Blog indicators
    const blogIndicators = ['blog', 'article', 'news', 'post'];
    if (blogIndicators.some(ind => content.includes(ind))) {
      return 'blog';
    }
    
    // Directory indicators
    const directoryIndicators = ['directory', 'list', 'top', 'best', 'ranking'];
    if (directoryIndicators.some(ind => content.includes(ind))) {
      return 'directory';
    }
    
    return 'unknown';
  }

  // Advanced search with filters
  async searchWithFilters(
    query: string, 
    filters: { 
      site?: string; 
      fileType?: string; 
      dateRange?: string;
      exclude?: string[];
    }
  ): Promise<SearchResult[]> {
    let enhancedQuery = query;
    
    if (filters.site) {
      enhancedQuery += ` site:${filters.site}`;
    }
    
    if (filters.fileType) {
      enhancedQuery += ` filetype:${filters.fileType}`;
    }
    
    if (filters.exclude) {
      filters.exclude.forEach(ex => {
        enhancedQuery += ` -${ex}`;
      });
    }

    return this.executeSearch(enhancedQuery, 10);
  }
}

export const searchNode = new SearchNode();