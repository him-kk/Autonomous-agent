// ============================================
// Service Manager - CRUD Operations
// ============================================

import { Service, IService } from '@/models/service.js';
import { MemoryEntry } from '@/models/Memory.js';
import { logger } from '@/utils/logger.js';
import { CleanedItem } from '@/types/index.js';

export class ServiceManager {
  /**
   * Create a new service from scraped data
   */
  async createServiceFromScrapedData(cleanedItem: CleanedItem): Promise<IService | null> {
    try {
      const { structuredData, url, confidence } = cleanedItem;
      const fields = structuredData.fields;

      // Generate unique service ID
      const service_id = this.generateServiceId();

      // Map to Service schema
      const serviceData: Partial<IService> = {
        service_id,
        agencyName: fields.name || fields.title || 'Unknown',
        websiteURL: fields.website || url,
        
        location: {
          country: fields.country,
          city: fields.city,
          address: fields.address
        },

        contactDetails: {
          email: fields.email,
          phone: fields.phone,
          linkedIn: fields.linkedIn || fields.linkedin
        },

        services: {
          categories: this.categorizeServices(fields.services || []),
          rawServices: fields.services || [],
          normalizedServices: this.normalizeServices(fields.services || [])
        },

        companyInfo: {
          yearFounded: fields.yearFounded,
          employees: fields.employees ? { count: fields.employees } : undefined
        },

        externalData: {
          overallRating: {
            average: 0,
            count: 0,
            distribution: {
              '5star': 0,
              '4star': 0,
              '3star': 0,
              '2star': 0,
              '1star': 0
            }
          },
          reviewSources: []
        },

        ranking: {
          overallScore: 0,
          scoreComponents: {
            externalSentiment: { score: 0, contribution: 0 },
            internalInteraction: { score: 0, contribution: 0 },
            userFeedback: { score: 0, contribution: 0 },
            gamification: { score: 0, contribution: 0 },
            recency: { score: 100, contribution: 10 }
          }
        },

        platformMetrics: {
          impressions: 0,
          clicks: 0,
          pageViews: 0,
          bookmarks: 0,
          shares: 0,
          comparisons: 0,
          conversions: 0
        },

        scrapingMetadata: {
          sourceURL: url,
          sourceDomain: new URL(url).hostname,
          scrapingPattern: 'auto',
          confidence,
          success: true,
          lastScraped: new Date()
        },

        categories: {
          primary: this.detectPrimaryCategory(fields.services || []),
          secondary: fields.services?.slice(0, 5) || []
        },

        tags: this.generateTags(fields),

        status: {
          isActive: true,
          isVerified: false,
          isFeatured: false,
          claimedByOwner: false
        },

        version: {
          schemaVersion: '1.0',
          dataVersion: 1
        }
      };

      const service = await Service.create(serviceData);
      logger.info('Service created', { service_id, agencyName: service.agencyName });

      return service;
    } catch (error) {
      logger.error('Failed to create service:', error);
      return null;
    }
  }

  /**
   * Update existing service
   */
  async updateService(serviceId: string, updates: Partial<IService>): Promise<IService | null> {
    try {
      const service = await Service.findOneAndUpdate(
        { service_id: serviceId },
        { 
          $set: { 
            ...updates,
            lastDataRefresh: new Date(),
            'version.dataVersion': { $inc: 1 }
          }
        },
        { new: true }
      );

      if (service) {
        logger.info('Service updated', { service_id: serviceId });
      }

      return service;
    } catch (error) {
      logger.error('Failed to update service:', error);
      return null;
    }
  }

  /**
   * Get top services
   */
  async getTopServices(filters?: {
    category?: string;
    location?: { city?: string; country?: string };
    services?: string[];
    limit?: number;
  }): Promise<IService[]> {
    try {
      const query: any = { 'status.isActive': true };

      if (filters?.category) {
        query['categories.primary'] = filters.category;
      }

      if (filters?.location?.city) {
        query['location.city'] = new RegExp(filters.location.city, 'i');
      }

      if (filters?.location?.country) {
        query['location.country'] = new RegExp(filters.location.country, 'i');
      }

      if (filters?.services && filters.services.length > 0) {
        query['services.normalizedServices'] = { $in: filters.services };
      }

      const services = await Service.find(query)
        .sort({ 'ranking.overallScore': -1 })
        .limit(filters?.limit || 50);

      return services;
    } catch (error) {
      logger.error('Failed to get top services:', error);
      return [];
    }
  }

  /**
   * Link service to memory entry
   */
  async linkToMemory(serviceId: string, memoryEntryId: string): Promise<void> {
    try {
      const memory = await MemoryEntry.findById(memoryEntryId);
      if (memory) {
        if (!memory.services.includes(serviceId)) {
          memory.services.push(serviceId);
          await memory.save();
          logger.info('Service linked to memory', { serviceId, memoryEntryId });
        }
      }
    } catch (error) {
      logger.error('Failed to link service to memory:', error);
    }
  }

  // Helper methods
  private generateServiceId(): string {
    return `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private categorizeServices(services: string[]): Array<{ name: string; subcategories: string[]; isPrimary: boolean; description?: string }> {
    const categories: Array<{ name: string; subcategories: string[]; isPrimary: boolean }> = [];
    
    const serviceMap: Record<string, string[]> = {
      'SEO': ['Technical SEO', 'Local SEO', 'Enterprise SEO'],
      'PPC': ['Google Ads', 'Facebook Ads', 'Display Advertising'],
      'Social Media Marketing': ['Instagram Marketing', 'LinkedIn Marketing', 'Twitter Marketing'],
      'Content Marketing': ['Blog Writing', 'Copywriting', 'Video Content'],
      'Web Design': ['WordPress Development', 'UI/UX Design', 'E-commerce Development']
    };

    services.forEach((service, index) => {
      const subcats = serviceMap[service] || [];
      categories.push({
        name: service,
        subcategories: subcats,
        isPrimary: index === 0
      });
    });

    return categories;
  }

  private normalizeServices(services: string[]): string[] {
    return services.map(s => s.trim().replace(/[^a-zA-Z0-9\s]/g, '')).filter(Boolean);
  }

  private detectPrimaryCategory(services: string[]): string {
    const categoryMap: Record<string, string> = {
      'SEO': 'Digital Marketing',
      'PPC': 'Digital Marketing',
      'Social Media Marketing': 'Digital Marketing',
      'Content Marketing': 'Digital Marketing',
      'Web Design': 'Web Development',
      'Web Development': 'Web Development',
      'Branding': 'Creative Services'
    };

    for (const service of services) {
      if (categoryMap[service]) {
        return categoryMap[service];
      }
    }

    return 'General';
  }

  private generateTags(fields: Record<string, any>): string[] {
    const tags: string[] = [];
    
    if (fields.services && Array.isArray(fields.services)) {
      tags.push(...fields.services);
    }
    
    if (fields.city) tags.push(fields.city);
    if (fields.country) tags.push(fields.country);

    return [...new Set(tags)].filter(Boolean);
  }
}

export const serviceManager = new ServiceManager();