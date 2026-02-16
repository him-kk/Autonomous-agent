// ============================================
// Service Routes - Service-Specific Endpoints
// ============================================

import { Router, Request, Response } from 'express';
import { authenticate } from '@/middleware/auth.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { Service } from '@/models/service.js';
import { serviceManager } from '@/services/serviceManager.js';
import { rankingEngine } from '@/services/rankingEngine.js';
import { z } from 'zod';

const router = Router();

// Get top ranked services
router.get(
  '/top',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const services = await Service.getTopRanked(limit);

    res.json({
      success: true,
      data: services.map(s => ({
        service_id: s.service_id,
        agencyName: s.agencyName,
        websiteURL: s.websiteURL,
        location: s.location,
        services: s.services.normalizedServices,
        rating: s.externalData.overallRating.average,
        ranking: {
          score: s.ranking.overallScore,
          rank: s.ranking.rank,
          tier: s.ranking.tier
        }
      })),
      meta: { total: services.length }
    });
  })
);

// Search services
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.query.category as string;
    const city = req.query.city as string;
    const country = req.query.country as string;
    const services = req.query.services as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const filters: any = {};
    if (category) filters.category = category;
    if (city || country) filters.location = { city, country };
    if (services) filters.services = services.split(',');
    filters.limit = limit;

    const results = await serviceManager.getTopServices(filters);

    res.json({
      success: true,
      data: results,
      meta: { total: results.length }
    });
  })
);

// Get service by ID
router.get(
  '/:serviceId',
  asyncHandler(async (req: Request, res: Response) => {
    const serviceId = Array.isArray(req.params.serviceId) 
      ? req.params.serviceId[0] 
      : req.params.serviceId;

    const service = await Service.findByServiceId(serviceId);

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found'
      });
      return;
    }

    res.json({
      success: true,
      data: service
    });
  })
);

// Get services by category
router.get(
  '/category/:category',
  asyncHandler(async (req: Request, res: Response) => {
    const category = Array.isArray(req.params.category) 
      ? req.params.category[0] 
      : req.params.category;

    const services = await Service.findByCategory(category);

    res.json({
      success: true,
      data: services,
      meta: { total: services.length }
    });
  })
);

// Get services by location
router.get(
  '/location/:city',
  asyncHandler(async (req: Request, res: Response) => {
    const city = Array.isArray(req.params.city) 
      ? req.params.city[0] 
      : req.params.city;
    const country = req.query.country as string;

    const services = await Service.findByLocation(city, country);

    res.json({
      success: true,
      data: services,
      meta: { total: services.length }
    });
  })
);

// Update service ranking (admin only)
router.put(
  '/:serviceId/ranking',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
      return;
    }

    const serviceId = Array.isArray(req.params.serviceId) 
      ? req.params.serviceId[0] 
      : req.params.serviceId;

    const score = await rankingEngine.calculateRanking(serviceId);

    res.json({
      success: true,
      data: { serviceId, score },
      message: 'Ranking updated successfully'
    });
  })
);

// Get service reviews
router.get(
  '/:serviceId/reviews',
  asyncHandler(async (req: Request, res: Response) => {
    const serviceId = Array.isArray(req.params.serviceId) 
      ? req.params.serviceId[0] 
      : req.params.serviceId;

    const service = await Service.findByServiceId(serviceId);

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found'
      });
      return;
    }

    res.json({
      success: true,
      data: service.reviews || [],
      meta: { total: service.reviews?.length || 0 }
    });
  })
);

export { router as servicesRouter };