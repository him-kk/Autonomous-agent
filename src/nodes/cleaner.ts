import { load } from 'cheerio';
import { llmService } from '@/services/llm.js';
import { logger } from '@/utils/logger.js';
import { 
  AgentState, 
  ScrapedItem, 
  CleanedItem, 
  StructuredData,
  CleaningStats 
} from '@/types/index.js';

interface CleaningPrompt {
  rawHtml: string;
  url: string;
  entityType: string;
  expectedFields: string[];
}

export class CleanerNode {
  private nodeName = 'CleanerNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('CleanerNode invoked', { 
      itemsToClean: state.scrapedData.length 
    });

    const startTime = Date.now();
    const cleanedItems: CleanedItem[] = [];

    try {
      state.status = 'cleaning';

      // Determine entity type from query
      const entityType = this.determineEntityType(state.query);
      const expectedFields = this.getExpectedFields(entityType);

      // Process each scraped item
      for (let i = 0; i < state.scrapedData.length; i++) {
        const item = state.scrapedData[i];
        
        try {
          const cleaned = await this.cleanItem(item, entityType, expectedFields);
          cleanedItems.push(cleaned);
          
          logger.info('Item cleaned successfully', { 
            url: item.url, 
            confidence: cleaned.confidence,
            services: cleaned.structuredData.fields.services || []
          });
        } catch (error) {
          logger.error('Failed to clean item:', { url: item.url, error });
          
          // Try fallback cleaning
          const fallbackCleaned = await this.fallbackCleaning(item, entityType);
          if (fallbackCleaned) {
            cleanedItems.push(fallbackCleaned);
          }
        }
      }

      // Calculate stats
      const stats: CleaningStats = {
        totalProcessed: state.scrapedData.length,
        successfullyCleaned: cleanedItems.length,
        failedCleaning: state.scrapedData.length - cleanedItems.length,
        averageConfidence: cleanedItems.reduce((acc, item) => acc + item.confidence, 0) / cleanedItems.length || 0
      };

      logger.info('CleanerNode completed', {
        ...stats,
        duration: Date.now() - startTime
      });

      return {
        cleanedData: cleanedItems,
        status: 'validating'
      };
    } catch (error) {
      logger.error('CleanerNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }

  private async cleanItem(
    item: ScrapedItem,
    entityType: string,
    expectedFields: string[]
  ): Promise<CleanedItem> {
    // Pre-process HTML to extract relevant content
    const preprocessed = this.preprocessHtml(item.rawHtml);
    
    // Build cleaning prompt
    const prompt = this.buildCleaningPrompt({
      rawHtml: preprocessed,
      url: item.url,
      entityType,
      expectedFields
    });

    // Use LLM to structure data
    const response = await llmService.generateJSON<StructuredData>(prompt, {
      systemPrompt: this.getCleaningSystemPrompt(entityType),
      temperature: 0.1
    });

    const structuredData = response.content;
    
    // ✅ Ensure services field exists
    if (!structuredData.fields.services) {
      structuredData.fields.services = [];
    }
    
    // Calculate confidence based on field completion
    const confidence = this.calculateConfidence(structuredData, expectedFields);

    return {
      id: `cleaned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceId: item.id,
      url: item.url,
      structuredData,
      cleaningMethod: 'llm-assisted',
      confidence,
      timestamp: new Date()
    };
  }

  private preprocessHtml(html: string): string {
    const $ = load(html);
    
    // Remove script and style tags
    $('script, style, nav, footer, header, aside').remove();
    
    // Extract main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        return element.text().trim().substring(0, 8000); // Limit for LLM
      }
    }
    
    // Fallback to body text
    return $('body').text().trim().substring(0, 8000);
  }

  private buildCleaningPrompt(input: CleaningPrompt): string {
    return `Extract and structure data from the following web content.

URL: ${input.url}
Entity Type: ${input.entityType}
Expected Fields: ${input.expectedFields.join(', ')}

Content:
${input.rawHtml}

IMPORTANT INSTRUCTIONS:
1. Extract ALL services offered by this ${input.entityType}
2. Services should be an array of specific service names (e.g., ["SEO", "PPC", "Social Media Marketing"])
3. Look for services in:
   - Service lists or menus
   - "What we offer" sections
   - "Our services" sections
   - Service descriptions
   - Keywords like "specializing in", "we provide", "we offer"

Extract the data and return it as a JSON object with:
- entityType: the type of entity
- fields: object with extracted field values (MUST include "services" array)
- relationships: array of related entities
- rawText: cleaned text content

Be precise and only include data that is actually present in the content.`;
  }

  private getCleaningSystemPrompt(entityType: string): string {
    return `You are an expert data extraction and structuring assistant.
Your task is to extract structured data from web content.

Entity Type: ${entityType}

Guidelines:
1. Extract only factual information present in the content
2. Use null for missing fields, do not invent data
3. Clean and normalize text (remove extra whitespace, fix formatting)
4. Identify relationships between entities
5. Return valid JSON only
6. Be concise but complete
7. **CRITICAL: Always extract services as an array of strings**
8. **Services should be specific and normalized (e.g., "SEO", "PPC", "Social Media Marketing", "Web Design")**

Response format:
{
  "entityType": "string",
  "fields": { 
    "name": "Company Name",
    "services": ["SEO", "PPC", "Social Media Marketing", "Web Design"],
    "email": "contact@example.com",
    "phone": "+1234567890",
    ...
  },
  "relationships": [ 
    { "type": "partner", "target": "Partner Company", "confidence": 0.8 }
  ],
  "rawText": "string"
}

EXAMPLES OF GOOD SERVICE EXTRACTION:
✅ "services": ["SEO", "PPC", "Content Marketing", "Social Media Management"]
✅ "services": ["Web Design", "WordPress Development", "E-commerce Solutions"]
❌ "services": "SEO, PPC, Social Media" (should be array)
❌ "services": ["marketing"] (too vague, be specific)`;
  }

  private calculateConfidence(data: StructuredData, expectedFields: string[]): number {
    if (!data.fields || Object.keys(data.fields).length === 0) {
      return 0;
    }

    let score = 0;
    let totalWeight = 0;

    for (const field of expectedFields) {
      const weight = this.getFieldWeight(field);
      totalWeight += weight;
      
      const value = data.fields[field];
      
      // ✅ Special handling for services array
      if (field === 'services') {
        if (Array.isArray(value) && value.length > 0) {
          score += weight;
        }
      } else if (value !== null && value !== undefined && value !== '') {
        score += weight;
      }
    }

    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  }

  private getFieldWeight(field: string): number {
    const weights: Record<string, number> = {
      name: 3,
      title: 3,
      services: 3, // ✅ High weight for services
      email: 2,
      phone: 2,
      website: 2,
      address: 2,
      price: 2,
      description: 1,
      category: 1
    };
    
    return weights[field.toLowerCase()] || 1;
  }

  private async fallbackCleaning(
    item: ScrapedItem,
    entityType: string
  ): Promise<CleanedItem | null> {
    try {
      const $ = load(item.rawHtml);
      
      // Extract basic metadata
      const fields: Record<string, any> = {
        title: $('title').text() || '',
        description: $('meta[name="description"]').attr('content') || '',
        h1: $('h1').first().text() || '',
        url: item.url,
        services: [] // ✅ Initialize services array
      };

      // Extract contact info patterns
      const text = $('body').text();
      
      // Email pattern
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        fields.email = emailMatch[0];
      }

      // Phone pattern
      const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
      if (phoneMatch) {
        fields.phone = phoneMatch[0];
      }

      // ✅ Extract services using regex patterns
      fields.services = this.extractServicesWithRegex(text);

      return {
        id: `cleaned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourceId: item.id,
        url: item.url,
        structuredData: {
          entityType,
          fields,
          relationships: [],
          rawText: text.substring(0, 1000)
        },
        cleaningMethod: 'fallback-regex',
        confidence: 50,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Fallback cleaning failed:', error);
      return null;
    }
  }

  // ✅ NEW METHOD: Extract services using regex
  private extractServicesWithRegex(text: string): string[] {
    const services = new Set<string>();
    
    const servicePatterns = [
      { pattern: /\b(?:SEO|Search Engine Optimization)\b/gi, service: 'SEO' },
      { pattern: /\b(?:PPC|Pay Per Click)\b/gi, service: 'PPC' },
      { pattern: /\bSocial Media (?:Marketing|Management)\b/gi, service: 'Social Media Marketing' },
      { pattern: /\bContent Marketing\b/gi, service: 'Content Marketing' },
      { pattern: /\bEmail Marketing\b/gi, service: 'Email Marketing' },
      { pattern: /\bWeb (?:Design|Development)\b/gi, service: 'Web Design' },
      { pattern: /\bGraphic Design\b/gi, service: 'Graphic Design' },
      { pattern: /\bBranding\b/gi, service: 'Branding' },
      { pattern: /\bVideo Marketing\b/gi, service: 'Video Marketing' },
      { pattern: /\bInfluencer Marketing\b/gi, service: 'Influencer Marketing' },
      { pattern: /\bAffiliate Marketing\b/gi, service: 'Affiliate Marketing' },
      { pattern: /\bMarketing Automation\b/gi, service: 'Marketing Automation' },
      { pattern: /\bAnalytics\b/gi, service: 'Analytics' },
      { pattern: /\bCRO|Conversion Rate Optimization\b/gi, service: 'CRO' },
      { pattern: /\bGoogle Ads\b/gi, service: 'Google Ads' },
      { pattern: /\bFacebook Ads\b/gi, service: 'Facebook Ads' }
    ];
    
    for (const { pattern, service } of servicePatterns) {
      if (pattern.test(text)) {
        services.add(service);
      }
    }
    
    return Array.from(services);
  }

  private determineEntityType(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('agency') || queryLower.includes('company')) {
      return 'business';
    }
    if (queryLower.includes('product') || queryLower.includes('item')) {
      return 'product';
    }
    if (queryLower.includes('service')) {
      return 'service';
    }
    if (queryLower.includes('person') || queryLower.includes('people')) {
      return 'person';
    }
    if (queryLower.includes('event')) {
      return 'event';
    }
    if (queryLower.includes('job') || queryLower.includes('career')) {
      return 'job';
    }
    
    return 'general';
  }

  private getExpectedFields(entityType: string): string[] {
    const fieldsByType: Record<string, string[]> = {
      business: ['name', 'website', 'email', 'phone', 'address', 'services', 'description'], // ✅ services included
      product: ['name', 'price', 'description', 'category', 'brand', 'availability'],
      service: ['name', 'provider', 'price', 'description', 'category', 'services'], // ✅ services included
      person: ['name', 'email', 'phone', 'title', 'company', 'linkedin'],
      event: ['name', 'date', 'location', 'description', 'organizer'],
      job: ['title', 'company', 'location', 'salary', 'description', 'requirements'],
      general: ['title', 'description', 'url', 'content', 'services'] // ✅ services included
    };
    
    return fieldsByType[entityType] || fieldsByType.general;
  }

  // Batch cleaning for efficiency
  async cleanBatch(
    items: ScrapedItem[],
    entityType: string
  ): Promise<CleanedItem[]> {
    const batchSize = 5;
    const results: CleanedItem[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const expectedFields = this.getExpectedFields(entityType);

      const batchPromises = batch.map(item => 
        this.cleanItem(item, entityType, expectedFields).catch(error => {
          logger.error('Batch cleaning error:', error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is CleanedItem => r !== null));
    }

    return results;
  }
}

export const cleanerNode = new CleanerNode();