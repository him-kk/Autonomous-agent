// ============================================
// Service Saver Node - Save Cleaned Data to Service Collection
// ============================================

import { AgentState } from '@/types/index.js';
import { serviceManager } from '@/services/serviceManager.js';
import { logger } from '@/utils/logger.js';

export class ServiceSaverNode {
  private nodeName = 'ServiceSaverNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('ServiceSaverNode invoked', { 
      itemsToSave: state.cleanedData.length 
    });

    const startTime = Date.now();
    const savedServiceIds: string[] = [];

    try {
      // Save each cleaned item as a Service
      for (const cleanedItem of state.cleanedData) {
        try {
          const service = await serviceManager.createServiceFromScrapedData(cleanedItem);
          
          if (service) {
            savedServiceIds.push(service.service_id);
            logger.info('Service saved', { 
              service_id: service.service_id,
              agencyName: service.agencyName,
              services: service.services.normalizedServices
            });
          }
        } catch (error) {
          logger.error('Failed to save service:', error);
        }
      }

      logger.info('ServiceSaverNode completed', {
        totalSaved: savedServiceIds.length,
        duration: Date.now() - startTime
      });

      // ✅ CORRECT: Return savedServiceIds directly, not nested in metadata
      return {
        savedServiceIds: savedServiceIds
      };
    } catch (error) {
      logger.error('ServiceSaverNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }
}

export const serviceSaverNode = new ServiceSaverNode();