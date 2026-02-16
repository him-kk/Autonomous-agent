// ============================================
// Ranking Engine - Calculate Service Rankings
// ============================================

import { Service, IService } from '@/models/service.js';
import { logger } from '@/utils/logger.js';

export class RankingEngine {
  private weights = {
    externalSentiment: 0.35,
    internalInteraction: 0.25,
    userFeedback: 0.20,
    gamification: 0.10,
    recency: 0.10
  };

  /**
   * Calculate overall ranking score for a service
   */
  async calculateRanking(serviceId: string): Promise<number> {
    try {
      const service = await Service.findOne({ service_id: serviceId });
      if (!service) {
        throw new Error('Service not found');
      }

      // Calculate component scores
      const scores = {
        externalSentiment: this.calculateExternalSentiment(service),
        internalInteraction: this.calculateInternalInteraction(service),
        userFeedback: this.calculateUserFeedback(service),
        gamification: this.calculateGamification(service),
        recency: this.calculateRecency(service)
      };

      // Weighted overall score
      const overallScore = Object.keys(this.weights).reduce((total, key) => {
        const weight = this.weights[key as keyof typeof this.weights];
        const score = scores[key as keyof typeof scores];
        return total + (score * weight);
      }, 0);

      // Update service ranking
      await Service.updateRanking(serviceId, {
        overallScore,
        lastCalculated: new Date(),
        scoreComponents: Object.keys(scores).reduce((obj: any, key) => {
          const weight = this.weights[key as keyof typeof this.weights];
          const score = scores[key as keyof typeof scores];
          obj[key] = {
            score,
            contribution: score * weight,
            lastUpdated: new Date()
          };
          return obj;
        }, {})
      });

      logger.info('Ranking calculated', { serviceId, overallScore });

      return overallScore;
    } catch (error) {
      logger.error('Failed to calculate ranking:', error);
      return 0;
    }
  }

  /**
   * Calculate all service rankings
   */
  async calculateAllRankings(): Promise<void> {
    try {
      const services = await Service.find({ 'status.isActive': true });
      
      logger.info('Starting batch ranking calculation', { count: services.length });

      for (const service of services) {
        await this.calculateRanking(service.service_id);
      }

      // Update ranks based on scores
      await this.updateRanks();

      logger.info('Batch ranking calculation completed');
    } catch (error) {
      logger.error('Failed to calculate all rankings:', error);
    }
  }

  /**
   * Update rank positions
   */
  private async updateRanks(): Promise<void> {
    const services = await Service.find({ 'status.isActive': true })
      .sort({ 'ranking.overallScore': -1 });

    for (let i = 0; i < services.length; i++) {
      services[i].ranking.rank = i + 1;
      
      // Assign tier
      if (i < 10) {
        services[i].ranking.tier = 'Elite';
      } else if (i < 50) {
        services[i].ranking.tier = 'Excellent';
      } else if (i < 100) {
        services[i].ranking.tier = 'Good';
      } else {
        services[i].ranking.tier = 'Standard';
      }

      await services[i].save();
    }
  }

  // Component score calculations
  private calculateExternalSentiment(service: IService): number {
    const rating = service.externalData.overallRating.average;
    const count = service.externalData.overallRating.count;
    
    // Normalize to 0-100 scale
    let score = (rating / 5) * 100;
    
    // Boost for high review count
    if (count > 50) score += 5;
    if (count > 100) score += 5;
    
    return Math.min(score, 100);
  }

  private calculateInternalInteraction(service: IService): number {
    const metrics = service.platformMetrics;
    
    let score = 0;
    score += Math.min(metrics.pageViews / 10, 30);
    score += Math.min(metrics.clicks / 5, 20);
    score += Math.min(metrics.bookmarks * 5, 20);
    score += Math.min(metrics.conversions * 10, 30);
    
    return Math.min(score, 100);
  }

  private calculateUserFeedback(service: IService): number {
    // Placeholder - would use actual user reviews from platform
    return 50;
  }

  private calculateGamification(service: IService): number {
    let score = 0;
    
    // Awards
    if (service.awards && service.awards.length > 0) {
      score += Math.min(service.awards.length * 10, 30);
    }
    
    // Certifications
    if (service.companyInfo.certifications && service.companyInfo.certifications.length > 0) {
      score += Math.min(service.companyInfo.certifications.length * 5, 20);
    }
    
    // Case studies
    if (service.caseStudies && service.caseStudies.length > 0) {
      score += Math.min(service.caseStudies.length * 5, 20);
    }
    
    // Profile completeness
    const completeness = service.scrapingMetadata.dataCompleteness || 0;
    score += completeness * 0.3;
    
    return Math.min(score, 100);
  }

  private calculateRecency(service: IService): number {
    const lastRefresh = service.lastDataRefresh || service.createdAt;
    const daysSinceRefresh = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24);
    
    // Fresh data gets higher score
    if (daysSinceRefresh < 7) return 100;
    if (daysSinceRefresh < 30) return 80;
    if (daysSinceRefresh < 90) return 60;
    if (daysSinceRefresh < 180) return 40;
    return 20;
  }
}

export const rankingEngine = new RankingEngine();