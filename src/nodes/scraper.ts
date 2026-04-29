import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { load } from 'cheerio';
import { config } from '@/config/index.js';
import { scrapingLogger as logger } from '@/utils/logger.js';
import { 
  AgentState, 
  DiscoveredUrl, 
  ScrapedItem, 
  FailedUrl,
  ScrapingConfig,
  ScrapingStats 
} from '@/types/index.js';
import { MemoryEntry } from '@/models/Memory.js';
import UserAgent from 'user-agents';

export class ScraperNode {
  private nodeName = 'ScraperNode';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private proxyIndex = 0;

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('ScraperNode invoked', { 
      urlsToScrape: state.discoveredUrls.length 
    });

    const startTime = Date.now();
    const scrapedItems: ScrapedItem[] = [];
    const failedUrls: FailedUrl[] = [];

    try {
      state.status = 'scraping';

      // Initialize browser
      await this.initializeBrowser();

      // Get scraping configuration
      const scrapingConfig = this.getScrapingConfig(state.plan);

      // Scrape each URL
      for (let i = 0; i < state.discoveredUrls.length; i++) {
        const url = state.discoveredUrls[i];
        
        // Update progress
        state.currentStep = i + 1;
        
        try {
          const result = await this.scrapeUrl(url, scrapingConfig);
          
          if (result.success) {
            scrapedItems.push(result);
            logger.info('Successfully scraped', { url: url.url, index: i + 1 });
          } else {
            failedUrls.push({
              url: url.url,
              error: result.error || 'Unknown error',
              retryCount: 0,
              lastAttempt: new Date(),
              errorType: this.classifyError(result.error || '')
            });
          }
        } catch (error) {
          logger.error('Scraping failed for URL:', { url: url.url, error });
          failedUrls.push({
            url: url.url,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount: 0,
            lastAttempt: new Date(),
            errorType: this.classifyError(error instanceof Error ? error.message : '')
          });
        }

        // Delay between requests
        if (i < state.discoveredUrls.length - 1) {
          await this.delay(scrapingConfig.delayMs);
        }
      }

      // Retry failed URLs if configured
      if (scrapingConfig.retryAttempts > 0 && failedUrls.length > 0) {
        const retryResults = await this.retryFailedUrls(failedUrls, scrapingConfig);
        scrapedItems.push(...retryResults.successful);
        // Update failed URLs list
        const remainingFailed = failedUrls.filter(
          f => !retryResults.successful.some(s => s.url === f.url)
        );
        failedUrls.length = 0;
        failedUrls.push(...remainingFailed);
      }

      // Calculate stats
      const stats: ScrapingStats = {
        totalAttempted: state.discoveredUrls.length,
        successful: scrapedItems.length,
        failed: failedUrls.length,
        averageTime: (Date.now() - startTime) / state.discoveredUrls.length,
        totalDataSize: scrapedItems.reduce((acc, item) => acc + item.rawHtml.length, 0)
      };

      logger.info('ScraperNode completed', {
        ...stats,
        duration: Date.now() - startTime
      });

      return {
        scrapedData: scrapedItems,
        failedUrls,
        status: 'cleaning'
      };
    } catch (error) {
      logger.error('ScraperNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  private async initializeBrowser(): Promise<void> {
    const launchOptions: any = {
      headless: config.scraping.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };

    // Add proxy if enabled
    if (config.scraping.proxyRotationEnabled && config.scraping.proxyList.length > 0) {
      const proxy = this.getNextProxy();
      if (proxy) {
        launchOptions.proxy = { server: proxy };
      }
    }

    this.browser = await chromium.launch(launchOptions);
    
    // Create context with custom settings
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: this.getRandomUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 }
    });

    // ✅ Fixed: Add stealth scripts with proper typing
    await this.context.addInitScript(() => {
      // @ts-ignore - This runs in browser context, not Node.js
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      // @ts-ignore
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Override permissions query
      // @ts-ignore - window exists in browser context
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' 
          // @ts-ignore
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      );
    });
  }

  private async closeBrowser(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async scrapeUrl(
    discoveredUrl: DiscoveredUrl, 
    config: ScrapingConfig
  ): Promise<ScrapedItem & { success: boolean; error?: string }> {
    const url = discoveredUrl.url;
    const startTime = Date.now();
    
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();
    
    try {
      // Set default timeout
      page.setDefaultTimeout(config.timeout);
      page.setDefaultNavigationTimeout(config.timeout);

      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.timeout
      });

      if (!response) {
        throw new Error('No response received');
      }

      if (response.status() >= 400) {
        throw new Error(`HTTP ${response.status()}`);
      }

      // Wait for dynamic content if configured
      if (config.waitForDynamic) {
        await this.waitForDynamicContent(page);
      }

      // Scroll to bottom if configured
      if (config.scrollToBottom) {
        await this.scrollToBottom(page);
      }

      // Extract data using selectors if provided
      let extractedData: Record<string, any> = {};
      if (config.extractSelectors && Object.keys(config.extractSelectors).length > 0) {
        extractedData = await this.extractWithSelectors(page, config.extractSelectors);
      }

      // Get page content
      const content = await page.content();
      
      // Parse with Cheerio for additional extraction
      const $ = load(content);
      
      // Extract basic metadata
      const metadata = await this.extractMetadata($, page);

      // Capture screenshot if configured
      let screenshotPath: string | undefined;
      if (config.captureScreenshots) {
        screenshotPath = await this.captureScreenshot(page, url);
      }

      const loadTime = Date.now() - startTime;

      // ✅ Try to learn from successful scrape (includes services extraction)
      await this.learnFromSuccess(url, content, extractedData);

      return {
        id: `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        rawHtml: content,
        extractedData: {
          ...extractedData,
          metadata
        },
        timestamp: new Date(),
        scrapingMethod: 'playwright',
        success: true,
        metadata: {
          loadTime,
          retryCount: 0,
          userAgent: await page.evaluate(() => navigator.userAgent),
          screenshotPath,
          domSelector: Object.keys(config.extractSelectors || {}).join(', ')
        }
      };
    } catch (error) {
      return {
        id: `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        rawHtml: '',
        extractedData: {},
        timestamp: new Date(),
        scrapingMethod: 'playwright',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          loadTime: Date.now() - startTime,
          retryCount: 0,
          userAgent: '',
          domSelector: ''
        }
      };
    } finally {
      await page.close();
    }
  }

  private async waitForDynamicContent(page: Page): Promise<void> {
    // Wait for common dynamic content indicators
    const selectors = [
      '[data-loaded="true"]',
      '.loaded',
      '#content-loaded',
      '[data-rendered]'
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
      } catch {
        // Continue if selector not found
      }
    }

    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }

  private async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait for any lazy-loaded content
    await page.waitForTimeout(1000);
  }

  private async extractWithSelectors(
    page: Page,
    selectors: Record<string, any>
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [key, selectorConfig] of Object.entries(selectors)) {
      try {
        // ✅ Normalize selector
        const cssSelector =
          typeof selectorConfig === 'string'
            ? selectorConfig
            : selectorConfig.selector;

        if (!cssSelector) {
          logger.warn(`No selector found for key: ${key}`);
          result[key] = [];
          continue;
        }

        const elements = await page.$$(cssSelector);

        // ✅ Support attributes + text
        const values = await Promise.all(
          elements.map(el =>
            selectorConfig?.attribute
              ? el.getAttribute(selectorConfig.attribute)
              : el.textContent()
          )
        );

        result[key] = values.filter(Boolean);
      } catch (error) {
        logger.warn(`Failed to extract selector ${key}:`, error);
        result[key] = [];
      }
    }

    return result;
  }

  private async extractMetadata($: any, page: Page): Promise<Record<string, any>> {
    return {
      title: $('title').text() || '',
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || '',
      h1: $('h1').first().text() || '',
      h2s: $('h2').map((i: number, el: any) => $(el).text()).get(),
      url: page.url()
    };
  }

  private async captureScreenshot(page: Page, url: string): Promise<string> {
    const filename = `screenshot_${Date.now()}_${Buffer.from(url).toString('base64').substring(0, 20)}.png`;
    const filepath = `${config.storage.uploadDir}/screenshots/${filename}`;
    
    await page.screenshot({ 
      path: filepath,
      fullPage: true 
    });
    
    return filepath;
  }

  private async retryFailedUrls(
    failedUrls: FailedUrl[],
    config: ScrapingConfig
  ): Promise<{ successful: ScrapedItem[]; stillFailed: FailedUrl[] }> {
    const successful: ScrapedItem[] = [];
    const stillFailed: FailedUrl[] = [];

    for (const failed of failedUrls) {
      if (failed.retryCount >= config.retryAttempts) {
        stillFailed.push(failed);
        continue;
      }

      // Try with different strategy
      const discoveredUrl: DiscoveredUrl = {
        url: failed.url,
        source: 'retry',
        relevanceScore: 5,
        category: 'unknown',
        discoveredAt: new Date()
      };

      // Rotate proxy/user-agent for retry
      if (this.context) {
        await this.context.close();
      }
      await this.initializeBrowser();

      const result = await this.scrapeUrl(discoveredUrl, {
        ...config,
        timeout: config.timeout * 1.5 // Increase timeout for retry
      });

      if (result.success) {
        successful.push(result as ScrapedItem);
      } else {
        failed.retryCount++;
        failed.lastAttempt = new Date();
        stillFailed.push(failed);
      }

      await this.delay(config.delayMs * 2);
    }

    return { successful, stillFailed };
  }

  // ✅ UPDATED: Learn from success with services extraction
  private async learnFromSuccess(
    url: string, 
    html: string, 
    extractedData: any
  ): Promise<void> {
    try {
      const domain = new URL(url).hostname;
      
      // ✅ Extract services from multiple sources
      const services = this.extractServices(extractedData, html);
      
      logger.info('Services extracted', { url, services, count: services.length });
      
      const memoryEntry = new MemoryEntry({
        type: 'scraping_pattern',
        key: `pattern_${domain}_${Date.now()}`,
        value: {
          url,
          selectors: Object.keys(extractedData),
          dataKeys: Object.keys(extractedData)
        },
        services: services, // ✅ SAVE SERVICES
        metadata: {
          url,
          domain,
          success: true,
          confidence: 0.85
        },
        tags: ['scraper', 'success', domain, ...services.map(s => s.toLowerCase())]
      });

      await memoryEntry.save();
      
      logger.info('Learning saved with services', { 
        domain, 
        servicesCount: services.length 
      });
    } catch (error) {
      logger.warn('Failed to save learning:', error);
    }
  }

  // ✅ NEW METHOD: Extract services from HTML and extractedData
  private extractServices(extractedData: any, html: string): string[] {
    const servicesSet = new Set<string>();
    
    // 1. Check if services are already in extractedData
    if (extractedData.services && Array.isArray(extractedData.services)) {
      extractedData.services.forEach((s: string) => {
        if (s && s.trim()) {
          servicesSet.add(this.normalizeService(s.trim()));
        }
      });
    }
    
    // 2. Check common field names that might contain services
    const serviceFields = ['service', 'services', 'offerings', 'specialties', 'expertise'];
    for (const field of serviceFields) {
      if (extractedData[field]) {
        const value = extractedData[field];
        if (Array.isArray(value)) {
          value.forEach((s: string) => {
            if (s && s.trim()) {
              servicesSet.add(this.normalizeService(s.trim()));
            }
          });
        } else if (typeof value === 'string') {
          const services = value.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
          services.forEach(s => servicesSet.add(this.normalizeService(s)));
        }
      }
    }
    
    // 3. Parse HTML for service keywords and patterns
    const htmlServices = this.extractServicesFromHtml(html);
    htmlServices.forEach(s => servicesSet.add(s));
    
    // 4. Return unique services as array
    return Array.from(servicesSet).filter(s => s.length > 0);
  }

  // ✅ NEW METHOD: Extract services from HTML content
  private extractServicesFromHtml(html: string): string[] {
    const services = new Set<string>();
    
    // Common digital marketing service keywords
    const serviceKeywords = [
      // SEO related
      { pattern: /\b(?:SEO|Search Engine Optimization|Organic Search)\b/gi, normalized: 'SEO' },
      { pattern: /\b(?:Local SEO|Local Search)\b/gi, normalized: 'Local SEO' },
      { pattern: /\b(?:Technical SEO)\b/gi, normalized: 'Technical SEO' },
      
      // PPC/Advertising
      { pattern: /\b(?:PPC|Pay Per Click|Paid Advertising)\b/gi, normalized: 'PPC' },
      { pattern: /\b(?:Google Ads|AdWords)\b/gi, normalized: 'Google Ads' },
      { pattern: /\b(?:Facebook Ads|Meta Ads)\b/gi, normalized: 'Facebook Ads' },
      { pattern: /\b(?:Display Advertising)\b/gi, normalized: 'Display Advertising' },
      
      // Social Media
      { pattern: /\b(?:Social Media Marketing|SMM)\b/gi, normalized: 'Social Media Marketing' },
      { pattern: /\b(?:Social Media Management)\b/gi, normalized: 'Social Media Management' },
      { pattern: /\b(?:Instagram Marketing)\b/gi, normalized: 'Instagram Marketing' },
      { pattern: /\b(?:LinkedIn Marketing)\b/gi, normalized: 'LinkedIn Marketing' },
      
      // Content
      { pattern: /\b(?:Content Marketing)\b/gi, normalized: 'Content Marketing' },
      { pattern: /\b(?:Content Writing|Copywriting)\b/gi, normalized: 'Content Writing' },
      { pattern: /\b(?:Blog Writing)\b/gi, normalized: 'Blog Writing' },
      
      // Email
      { pattern: /\b(?:Email Marketing)\b/gi, normalized: 'Email Marketing' },
      { pattern: /\b(?:Email Automation)\b/gi, normalized: 'Email Automation' },
      
      // Web Development
      { pattern: /\b(?:Web Design|Website Design)\b/gi, normalized: 'Web Design' },
      { pattern: /\b(?:Web Development|Website Development)\b/gi, normalized: 'Web Development' },
      { pattern: /\b(?:UI\/UX Design|UX Design)\b/gi, normalized: 'UI/UX Design' },
      { pattern: /\b(?:WordPress Development)\b/gi, normalized: 'WordPress Development' },
      
      // Branding
      { pattern: /\b(?:Branding|Brand Strategy)\b/gi, normalized: 'Branding' },
      { pattern: /\b(?:Logo Design)\b/gi, normalized: 'Logo Design' },
      { pattern: /\b(?:Graphic Design)\b/gi, normalized: 'Graphic Design' },
      
      // Video
      { pattern: /\b(?:Video Marketing|Video Production)\b/gi, normalized: 'Video Marketing' },
      { pattern: /\b(?:YouTube Marketing)\b/gi, normalized: 'YouTube Marketing' },
      
      // Analytics
      { pattern: /\b(?:Analytics|Data Analysis|Web Analytics)\b/gi, normalized: 'Analytics' },
      { pattern: /\b(?:Conversion Rate Optimization|CRO)\b/gi, normalized: 'CRO' },
      
      // E-commerce
      { pattern: /\b(?:E-commerce Marketing|Ecommerce)\b/gi, normalized: 'E-commerce Marketing' },
      { pattern: /\b(?:Shopify Development)\b/gi, normalized: 'Shopify Development' },
      
      // Other
      { pattern: /\b(?:Marketing Automation)\b/gi, normalized: 'Marketing Automation' },
      { pattern: /\b(?:Influencer Marketing)\b/gi, normalized: 'Influencer Marketing' },
      { pattern: /\b(?:Affiliate Marketing)\b/gi, normalized: 'Affiliate Marketing' },
      { pattern: /\b(?:Mobile Marketing|App Marketing)\b/gi, normalized: 'Mobile Marketing' },
      { pattern: /\b(?:Online Reputation Management|ORM)\b/gi, normalized: 'Online Reputation Management' },
      { pattern: /\b(?:Consulting|Digital Strategy)\b/gi, normalized: 'Consulting' }
    ];
    
    // Search for each pattern
    for (const { pattern, normalized } of serviceKeywords) {
      if (pattern.test(html)) {
        services.add(normalized);
      }
    }
    
    return Array.from(services);
  }

  // ✅ NEW METHOD: Normalize service names
  private normalizeService(service: string): string {
    // Remove common prefixes/suffixes
    let normalized = service
      .replace(/^(?:Our |The |Digital )/i, '')
      .replace(/ Services?$/i, '')
      .trim();
    
    // Capitalize properly
    const abbreviations = ['SEO', 'PPC', 'SMM', 'CRO', 'ORM', 'UI', 'UX', 'SEM'];
    if (abbreviations.includes(normalized.toUpperCase())) {
      return normalized.toUpperCase();
    }
    
    // Title case for multi-word services
    normalized = normalized
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return normalized;
  }

  private getScrapingConfig(plan: any): ScrapingConfig {
    return {
      headless: config.scraping.headless,
      timeout: config.scraping.timeout,
      retryAttempts: config.scraping.retryAttempts,
      delayMs: config.scraping.delayMs,
      useProxy: config.scraping.proxyRotationEnabled,
      extractSelectors: plan?.strategy?.selectors || {},
      scrollToBottom: plan?.strategy?.approach === 'recursive',
      waitForDynamic: true,
      captureScreenshots: false
    };
  }

  private getNextProxy(): string | null {
    if (config.scraping.proxyList.length === 0) {
      return null;
    }
    
    const proxy = config.scraping.proxyList[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % config.scraping.proxyList.length;
    return proxy;
  }

  private getRandomUserAgent(): string {
    if (config.scraping.userAgentRotationEnabled) {
      const userAgent = new UserAgent();
      return userAgent.toString();
    }
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  private classifyError(error: string): any {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'timeout';
    }
    if (errorLower.includes('network') || errorLower.includes('net::')) {
      return 'network';
    }
    if (errorLower.includes('403') || errorLower.includes('blocked') || errorLower.includes('captcha')) {
      return 'blocked';
    }
    if (errorLower.includes('parse') || errorLower.includes('syntax')) {
      return 'parse';
    }
    
    return 'unknown';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const scraperNode = new ScraperNode();