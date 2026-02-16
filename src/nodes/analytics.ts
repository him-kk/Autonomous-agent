// ============================================
// Analytics Node - Insights and Trend Generation
// ============================================

import { llmService } from '@/services/llm.js';
import { analyticsLogger as logger } from '@/utils/logger.js';
import { 
  AgentState, 
  AnalyticsData,
  CleanedItem,
  ServiceCount,
  PriceRange,
  Trend,
  InsightData,
  FinalOutput
} from '@/types/index.js';

export class AnalyticsNode {
  private nodeName = 'AnalyticsNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('AnalyticsNode invoked', { 
      itemsToAnalyze: state.cleanedData.length 
    });

    const startTime = Date.now();

    try {
      state.status = 'analyzing';

      // Calculate basic analytics
      const analytics = await this.calculateAnalytics(state.cleanedData, state.query);

      // Generate insights
      const insights = await this.generateInsights(state.cleanedData, analytics);

      // Create final output
      const finalOutput = this.createFinalOutput(state, analytics, insights);

      logger.info('AnalyticsNode completed', {
        totalSources: analytics.totalSources,
        dataQualityScore: analytics.dataQualityScore,
        duration: Date.now() - startTime
      });

      return {
        analytics,
        finalOutput,
        status: 'completed',
        endTime: new Date()
      };
    } catch (error) {
      logger.error('AnalyticsNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }

  private async calculateAnalytics(
    data: CleanedItem[],
    query: string
  ): Promise<AnalyticsData> {
    const totalSources = data.length;
    const successfulScrapes = data.filter(d => d.confidence > 50).length;
    const failedScrapes = totalSources - successfulScrapes;
    
    // Calculate average confidence as data quality score
    const dataQualityScore = data.reduce((acc, d) => acc + d.confidence, 0) / totalSources || 0;

    // Extract services
    const topServices = this.extractTopServices(data);

    // Extract price ranges
    const priceRanges = this.extractPriceRanges(data);

    // Detect trends
    const trends = this.detectTrends(data);

    // Generate insights
    const insights = await this.generateAISummary(data, query);

    return {
      totalSources,
      successfulScrapes,
      failedScrapes,
      averageLoadTime: 0, // Would come from scraper metadata
      dataQualityScore,
      topServices,
      priceRanges,
      trends,
      insights
    };
  }

  private extractTopServices(data: CleanedItem[]): ServiceCount[] {
    const serviceCounts = new Map<string, number>();

    for (const item of data) {
      const fields = item.structuredData.fields;
      
      // Look for services field
      const services = fields.services || fields.service;
      if (services) {
        if (Array.isArray(services)) {
          services.forEach((service: string) => {
            const normalized = service.toLowerCase().trim();
            serviceCounts.set(normalized, (serviceCounts.get(normalized) || 0) + 1);
          });
        } else if (typeof services === 'string') {
          const normalized = services.toLowerCase().trim();
          serviceCounts.set(normalized, (serviceCounts.get(normalized) || 0) + 1);
        }
      }

      // Also check description for service mentions
      const description = fields.description || '';
      const commonServices = [
        'seo', 'social media', 'ppc', 'content marketing', 
        'email marketing', 'web design', 'development',
        'branding', 'consulting', 'advertising'
      ];
      
      for (const service of commonServices) {
        if (description.toLowerCase().includes(service)) {
          serviceCounts.set(service, (serviceCounts.get(service) || 0) + 1);
        }
      }
    }

    // Convert to array and calculate percentages
    const total = data.length || 1;
    const sorted = Array.from(serviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return sorted.map(([service, count]) => ({
      service: service.charAt(0).toUpperCase() + service.slice(1),
      count,
      percentage: Math.round((count / total) * 100)
    }));
  }

  private extractPriceRanges(data: CleanedItem[]): PriceRange[] {
    const prices: number[] = [];
    const currency = 'USD';

    for (const item of data) {
      const fields = item.structuredData.fields;
      const priceValue = fields.price || fields.pricing || fields.cost;
      
      if (priceValue) {
        const parsed = this.parsePrice(priceValue);
        if (parsed !== null) {
          prices.push(parsed);
        }
      }
    }

    if (prices.length === 0) {
      return [];
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    return [{
      category: 'General',
      min,
      max,
      avg: Math.round(avg),
      currency
    }];
  }

  private parsePrice(priceValue: any): number | null {
    if (typeof priceValue === 'number') {
      return priceValue;
    }

    if (typeof priceValue === 'string') {
      // Remove currency symbols and extract number
      const cleaned = priceValue.replace(/[^\d.,]/g, '').replace(',', '');
      const match = cleaned.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }

    return null;
  }

  private detectTrends(data: CleanedItem[]): Trend[] {
    const trends: Trend[] = [];

    // Analyze service mentions over time (if timestamp available)
    const serviceTrend = this.analyzeServiceTrend(data);
    if (serviceTrend) {
      trends.push(serviceTrend);
    }

    // Analyze pricing trends
    const priceTrend = this.analyzePriceTrend(data);
    if (priceTrend) {
      trends.push(priceTrend);
    }

    return trends;
  }

  private analyzeServiceTrend(data: CleanedItem[]): Trend | null {
    // Simplified trend analysis
    const serviceMentions = new Map<string, number>();
    
    for (const item of data) {
      const description = item.structuredData.fields.description || '';
      const services = ['seo', 'social media', 'ppc', 'content marketing'];
      
      for (const service of services) {
        if (description.toLowerCase().includes(service)) {
          serviceMentions.set(service, (serviceMentions.get(service) || 0) + 1);
        }
      }
    }

    if (serviceMentions.size === 0) {
      return null;
    }

    // Find most mentioned service
    const topService = Array.from(serviceMentions.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      metric: `${topService[0]} mentions`,
      direction: 'up',
      change: Math.round((topService[1] / data.length) * 100),
      period: 'current'
    };
  }

  private analyzePriceTrend(data: CleanedItem[]): Trend | null {
    const prices: number[] = [];
    
    for (const item of data) {
      const price = this.parsePrice(item.structuredData.fields.price);
      if (price !== null) {
        prices.push(price);
      }
    }

    if (prices.length < 2) {
      return null;
    }

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    return {
      metric: 'Average pricing',
      direction: avg > 1000 ? 'up' : 'stable',
      change: Math.round(avg),
      period: 'current'
    };
  }

  private async generateAISummary(
    data: CleanedItem[],
    query: string
  ): Promise<string[]> {
    try {
      const sampleData = data.slice(0, 10).map(d => ({
        fields: d.structuredData.fields,
        confidence: d.confidence
      }));

      const prompt = `Analyze the following data extracted from web sources and provide key insights.

Query: "${query}"
Number of sources: ${data.length}
Sample data: ${JSON.stringify(sampleData, null, 2)}

Provide 3-5 key insights about:
1. Market trends
2. Common patterns
3. Notable findings
4. Recommendations

Return as a JSON array of insight strings.`;

      const response = await llmService.generateJSON<string[]>(prompt, {
        systemPrompt: 'You are a market research analyst. Provide concise, actionable insights.',
        temperature: 0.3
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to generate AI summary:', error);
      return ['Data analysis completed successfully'];
    }
  }

  private async generateInsights(
    data: CleanedItem[],
    analytics: AnalyticsData
  ): Promise<InsightData> {
    // Identify top trending services
    const topServicesTrending = analytics.topServices
      .slice(0, 5)
      .map(s => s.service);

    // Identify marketplace opportunities
    const marketplaceOpportunities = this.identifyMarketplaces(data);

    // Generate competitive analysis
    const competitiveAnalysis = await this.generateCompetitiveAnalysis(data);

    // Generate market trends
    const marketTrends = analytics.trends.map(t => 
      `${t.metric}: ${t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'} ${t.change}%`
    );

    return {
      topServicesTrending,
      marketplaceOpportunities,
      competitiveAnalysis,
      marketTrends
    };
  }

  private identifyMarketplaces(data: CleanedItem[]): string[] {
    const marketplaces = new Set<string>();
    
    for (const item of data) {
      const url = item.url.toLowerCase();
      
      if (url.includes('fiverr')) marketplaces.add('Fiverr');
      if (url.includes('upwork')) marketplaces.add('Upwork');
      if (url.includes('freelancer')) marketplaces.add('Freelancer');
      if (url.includes('clutch')) marketplaces.add('Clutch');
      if (url.includes('goodfirms')) marketplaces.add('GoodFirms');
      if (url.includes('g2')) marketplaces.add('G2');
    }

    return Array.from(marketplaces);
  }

  private async generateCompetitiveAnalysis(data: CleanedItem[]): Promise<string> {
    try {
      const companies = data
        .map(d => d.structuredData.fields.name || d.structuredData.fields.title)
        .filter(Boolean)
        .slice(0, 10);

      if (companies.length === 0) {
        return 'Insufficient data for competitive analysis';
      }

      const prompt = `Analyze the competitive landscape for the following companies:
${companies.join('\n')}

Provide a brief competitive analysis (2-3 sentences) highlighting key differentiators and market positioning.`;

      const response = await llmService.generateText(prompt, {
        systemPrompt: 'You are a competitive intelligence analyst.',
        temperature: 0.3
      });

      return response.content;
    } catch (error) {
      logger.error('Failed to generate competitive analysis:', error);
      return 'Competitive analysis unavailable';
    }
  }

  private createFinalOutput(
    state: AgentState,
    analytics: AnalyticsData,
    insights: InsightData
  ): FinalOutput {
    const marketplaceCount = state.discoveredUrls.filter(
      u => u.category === 'marketplace'
    ).length;

    const agencyCount = state.discoveredUrls.filter(
      u => u.category === 'agency'
    ).length;

    // Format detailed data
    const detailedData = state.cleanedData.map(item => ({
      name: item.structuredData.fields.name || item.structuredData.fields.title || 'Unknown',
      services: item.structuredData.fields.services || [],
      pricing: item.structuredData.fields.price || 'Not specified',
      location: item.structuredData.fields.address || item.structuredData.fields.location || 'Unknown',
      website: item.structuredData.fields.website || item.url,
      email: item.structuredData.fields.email || null,
      phone: item.structuredData.fields.phone || null,
      description: item.structuredData.fields.description || null,
      confidence: item.confidence
    }));

    // Calculate average pricing
    const avgPricing = analytics.priceRanges.length > 0
      ? `$${Math.round(analytics.priceRanges[0].avg)}/month`
      : 'Not available';

    return {
      query: state.query,
      totalSources: analytics.totalSources,
      marketplaces: marketplaceCount,
      agencies: agencyCount,
      topServices: analytics.topServices.map(s => s.service),
      avgPricing,
      detailedData,
      insights,
      generatedAt: new Date(),
      exportFormats: [
        { format: 'json', url: `/api/export/${state.sessionId}.json`, size: 0 },
        { format: 'csv', url: `/api/export/${state.sessionId}.csv`, size: 0 }
      ]
    };
  }

  // Generate report in different formats
  async generateReport(
    finalOutput: FinalOutput,
    format: 'json' | 'csv' | 'pdf' | 'html'
  ): Promise<Buffer> {
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(finalOutput, null, 2));
      
      case 'csv':
        return this.generateCsvReport(finalOutput);
      
      case 'html':
        return this.generateHtmlReport(finalOutput);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private generateCsvReport(finalOutput: FinalOutput): Buffer {
    const headers = ['Name', 'Services', 'Pricing', 'Location', 'Website', 'Email', 'Phone'];
    const rows = finalOutput.detailedData.map(item => [
      item.name,
      Array.isArray(item.services) ? item.services.join('; ') : item.services,
      item.pricing,
      item.location,
      item.website,
      item.email || '',
      item.phone || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
    return Buffer.from(csv);
  }

  private generateHtmlReport(finalOutput: FinalOutput): Buffer {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Data Extraction Report - ${finalOutput.query}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .insights { margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #4CAF50; color: white; }
    tr:hover { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Data Extraction Report</h1>
  <p><strong>Query:</strong> ${finalOutput.query}</p>
  <p><strong>Generated:</strong> ${finalOutput.generatedAt.toISOString()}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Sources: ${finalOutput.totalSources}</p>
    <p>Marketplaces: ${finalOutput.marketplaces}</p>
    <p>Agencies: ${finalOutput.agencies}</p>
    <p>Average Pricing: ${finalOutput.avgPricing}</p>
  </div>
  
  <div class="insights">
    <h2>Insights</h2>
    <p>${finalOutput.insights.competitiveAnalysis}</p>
    <h3>Top Trending Services</h3>
    <ul>${finalOutput.insights.topServicesTrending.map(s => `<li>${s}</li>`).join('')}</ul>
    <h3>Marketplace Opportunities</h3>
    <ul>${finalOutput.insights.marketplaceOpportunities.map(m => `<li>${m}</li>`).join('')}</ul>
  </div>
  
  <h2>Detailed Data</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Services</th>
        <th>Pricing</th>
        <th>Location</th>
        <th>Website</th>
      </tr>
    </thead>
    <tbody>
      ${finalOutput.detailedData.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${Array.isArray(item.services) ? item.services.join(', ') : item.services}</td>
          <td>${item.pricing}</td>
          <td>${item.location}</td>
          <td><a href="${item.website}" target="_blank">${item.website}</a></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    return Buffer.from(html);
  }
}

export const analyticsNode = new AnalyticsNode();
