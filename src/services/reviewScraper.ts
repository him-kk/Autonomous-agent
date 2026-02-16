// ============================================
// Review Scraper - Extract Reviews from Multiple Platforms
// ============================================

import { chromium, Browser, Page } from 'playwright';
import { load } from 'cheerio';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

interface Review {
  reviewId: string;
  source: string;
  rating: number;
  reviewText: string;
  reviewerName?: string;
  reviewerTitle?: string;
  reviewerCompany?: string;
  date?: Date;
  verifiedPurchase?: boolean;
  helpful?: number;
}

export class ReviewScraper {
  private browser: Browser | null = null;

  /**
   * Initialize browser
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: config.scraping.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Close browser
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape Clutch reviews
   */
  async scrapeClutchReviews(clutchUrl: string): Promise<Review[]> {
    const reviews: Review[] = [];

    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();
      
      logger.info('Scraping Clutch reviews', { clutchUrl });

      await page.goto(clutchUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for reviews to load
      await page.waitForSelector('.review', { timeout: 10000 }).catch(() => {
        logger.warn('No reviews found on Clutch page');
      });

      const html = await page.content();
      const $ = load(html);

      // Extract reviews
      $('.review').each((index, element) => {
        try {
          const $review = $(element);

          const rating = parseFloat($review.find('.rating').text()) || 0;
          const reviewText = $review.find('.review-text, .description').text().trim();
          const reviewerName = $review.find('.reviewer-name, .author').text().trim();
          const reviewerTitle = $review.find('.reviewer-title, .position').text().trim();
          const reviewerCompany = $review.find('.reviewer-company, .company').text().trim();
          const dateText = $review.find('.review-date, .date').text().trim();

          if (reviewText) {
            reviews.push({
              reviewId: `clutch_${Date.now()}_${index}`,
              source: 'Clutch',
              rating: rating / 5 * 5, // Normalize to 5-star scale
              reviewText,
              reviewerName: reviewerName || undefined,
              reviewerTitle: reviewerTitle || undefined,
              reviewerCompany: reviewerCompany || undefined,
              date: dateText ? new Date(dateText) : undefined,
              verifiedPurchase: true // Clutch reviews are verified
            });
          }
        } catch (error) {
          logger.warn('Failed to parse Clutch review', { error });
        }
      });

      await page.close();

      logger.info('Clutch reviews scraped', { count: reviews.length });
    } catch (error) {
      logger.error('Failed to scrape Clutch reviews', { error });
    } finally {
      await this.closeBrowser();
    }

    return reviews;
  }

  /**
   * Scrape Google My Business reviews
   */
  async scrapeGoogleReviews(businessName: string, location?: string): Promise<Review[]> {
    const reviews: Review[] = [];

    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();

      const searchQuery = location 
        ? `${businessName} ${location} reviews`
        : `${businessName} reviews`;

      logger.info('Scraping Google reviews', { businessName, location });

      // Search on Google
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Click on reviews tab if available
      await page.click('div[data-async-trigger="reviewDialog"]').catch(() => {
        logger.warn('Reviews dialog not found');
      });

      await page.waitForTimeout(2000);

      // Scroll to load more reviews
      await this.scrollReviews(page);

      const html = await page.content();
      const $ = load(html);

      // Extract reviews
      $('div[data-review-id], .review-snippet, .gws-localreviews__google-review').each((index, element) => {
        try {
          const $review = $(element);

          const ratingText = $review.find('span[aria-label*="star"], .review-score').attr('aria-label') || '';
          const ratingMatch = ratingText.match(/(\d+)/);
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

          const reviewText = $review.find('.review-full-text, .review-snippet').text().trim();
          const reviewerName = $review.find('.reviewer-name, .author-name').text().trim();
          const dateText = $review.find('.review-date, .publish-date').text().trim();

          if (reviewText) {
            reviews.push({
              reviewId: `google_${Date.now()}_${index}`,
              source: 'Google',
              rating,
              reviewText,
              reviewerName: reviewerName || undefined,
              date: dateText ? this.parseRelativeDate(dateText) : undefined
            });
          }
        } catch (error) {
          logger.warn('Failed to parse Google review', { error });
        }
      });

      await page.close();

      logger.info('Google reviews scraped', { count: reviews.length });
    } catch (error) {
      logger.error('Failed to scrape Google reviews', { error });
    } finally {
      await this.closeBrowser();
    }

    return reviews;
  }

  /**
   * Scrape Trustpilot reviews
   */
  async scrapeTrustpilotReviews(companyName: string): Promise<Review[]> {
    const reviews: Review[] = [];

    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();

      const trustpilotUrl = `https://www.trustpilot.com/review/${companyName.toLowerCase().replace(/\s+/g, '')}`;

      logger.info('Scraping Trustpilot reviews', { trustpilotUrl });

      await page.goto(trustpilotUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Scroll to load reviews
      await this.scrollReviews(page);

      const html = await page.content();
      const $ = load(html);

      // Extract reviews
      $('.review, article[data-service-review-card-paper]').each((index, element) => {
        try {
          const $review = $(element);

          const ratingElement = $review.find('div[data-service-review-rating]');
          const ratingText = ratingElement.attr('data-service-review-rating') || ratingElement.find('img').attr('alt') || '';
          const ratingMatch = ratingText.match(/(\d+)/);
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

          const reviewText = $review.find('.review-content__text, p[data-service-review-text-typography]').text().trim();
          const reviewerName = $review.find('.consumer-information__name, span[data-consumer-name-typography]').text().trim();
          const dateText = $review.find('.review-content-header__dates time, time').attr('datetime') || '';

          if (reviewText) {
            reviews.push({
              reviewId: `trustpilot_${Date.now()}_${index}`,
              source: 'Trustpilot',
              rating,
              reviewText,
              reviewerName: reviewerName || undefined,
              date: dateText ? new Date(dateText) : undefined,
              verifiedPurchase: $review.find('.review-content-header__verified').length > 0
            });
          }
        } catch (error) {
          logger.warn('Failed to parse Trustpilot review', { error });
        }
      });

      await page.close();

      logger.info('Trustpilot reviews scraped', { count: reviews.length });
    } catch (error) {
      logger.error('Failed to scrape Trustpilot reviews', { error });
    } finally {
      await this.closeBrowser();
    }

    return reviews;
  }

  /**
   * Scrape G2 reviews
   */
  async scrapeG2Reviews(productSlug: string): Promise<Review[]> {
    const reviews: Review[] = [];

    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();

      const g2Url = `https://www.g2.com/products/${productSlug}/reviews`;

      logger.info('Scraping G2 reviews', { g2Url });

      await page.goto(g2Url, { waitUntil: 'networkidle', timeout: 30000 });

      // Scroll to load reviews
      await this.scrollReviews(page);

      const html = await page.content();
      const $ = load(html);

      // Extract reviews
      $('.paper, div[itemprop="review"]').each((index, element) => {
        try {
          const $review = $(element);

          const ratingElement = $review.find('.stars, div[itemprop="reviewRating"]');
          const ratingText = ratingElement.attr('class') || ratingElement.find('meta[itemprop="ratingValue"]').attr('content') || '';
          const ratingMatch = ratingText.match(/(\d+)/);
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

          const reviewText = $review.find('.review-text, div[itemprop="reviewBody"]').text().trim();
          const reviewerName = $review.find('.reviewer-name, span[itemprop="author"]').text().trim();
          const reviewerTitle = $review.find('.reviewer-title').text().trim();
          const dateText = $review.find('.review-date, time[itemprop="datePublished"]').attr('datetime') || '';

          if (reviewText) {
            reviews.push({
              reviewId: `g2_${Date.now()}_${index}`,
              source: 'G2',
              rating,
              reviewText,
              reviewerName: reviewerName || undefined,
              reviewerTitle: reviewerTitle || undefined,
              date: dateText ? new Date(dateText) : undefined,
              verifiedPurchase: $review.find('.verified-badge').length > 0
            });
          }
        } catch (error) {
          logger.warn('Failed to parse G2 review', { error });
        }
      });

      await page.close();

      logger.info('G2 reviews scraped', { count: reviews.length });
    } catch (error) {
      logger.error('Failed to scrape G2 reviews', { error });
    } finally {
      await this.closeBrowser();
    }

    return reviews;
  }

  /**
   * Scrape all available reviews for a company
   */
  async scrapeAllReviews(options: {
    companyName: string;
    clutchUrl?: string;
    trustpilotSlug?: string;
    g2Slug?: string;
    location?: string;
  }): Promise<Review[]> {
    const allReviews: Review[] = [];

    // Clutch
    if (options.clutchUrl) {
      const clutchReviews = await this.scrapeClutchReviews(options.clutchUrl);
      allReviews.push(...clutchReviews);
    }

    // Google
    const googleReviews = await this.scrapeGoogleReviews(options.companyName, options.location);
    allReviews.push(...googleReviews);

    // Trustpilot
    if (options.trustpilotSlug) {
      const trustpilotReviews = await this.scrapeTrustpilotReviews(options.trustpilotSlug);
      allReviews.push(...trustpilotReviews);
    }

    // G2
    if (options.g2Slug) {
      const g2Reviews = await this.scrapeG2Reviews(options.g2Slug);
      allReviews.push(...g2Reviews);
    }

    logger.info('All reviews scraped', { 
      total: allReviews.length,
      sources: [...new Set(allReviews.map(r => r.source))]
    });

    return allReviews;
  }

  /**
   * Helper: Scroll page to load more reviews
   */
  private async scrollReviews(page: Page, scrolls: number = 3): Promise<void> {
    for (let i = 0; i < scrolls; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Helper: Parse relative dates like "2 days ago"
   */
  private parseRelativeDate(dateText: string): Date {
    const now = new Date();
    
    const patterns = [
      { pattern: /(\d+)\s*day[s]?\s*ago/i, unit: 'days' },
      { pattern: /(\d+)\s*week[s]?\s*ago/i, unit: 'weeks' },
      { pattern: /(\d+)\s*month[s]?\s*ago/i, unit: 'months' },
      { pattern: /(\d+)\s*year[s]?\s*ago/i, unit: 'years' }
    ];

    for (const { pattern, unit } of patterns) {
      const match = dateText.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        const date = new Date(now);
        
        switch (unit) {
          case 'days':
            date.setDate(date.getDate() - value);
            break;
          case 'weeks':
            date.setDate(date.getDate() - value * 7);
            break;
          case 'months':
            date.setMonth(date.getMonth() - value);
            break;
          case 'years':
            date.setFullYear(date.getFullYear() - value);
            break;
        }
        
        return date;
      }
    }

    return now;
  }
}

export const reviewScraper = new ReviewScraper();