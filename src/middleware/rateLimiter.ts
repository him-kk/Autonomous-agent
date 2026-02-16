// ============================================
// Rate Limiter Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '@/services/database.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

// Create rate limiter instance
let rateLimiterInstance: RateLimiterRedis | null = null;
let isInitialized = false;

export const initializeRateLimiter = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  try {
    const redisClient = redis.getClient();
    
    rateLimiterInstance = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'middleware',
      points: config.rateLimit.maxRequests,
      duration: config.rateLimit.windowMs / 1000,
      blockDuration: 60 * 15, // Block for 15 minutes if exceeded
    });
    
    isInitialized = true;
    logger.info('Rate limiter initialized');
  } catch (error) {
    logger.error('Failed to initialize rate limiter:', error);
    throw error;
  }
};

// Don't initialize on module load - will be called after Redis connects

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Initialize on first request if not already initialized
    if (!isInitialized) {
      try {
        await initializeRateLimiter();
      } catch (error) {
        // If initialization fails, allow the request through
        logger.warn('Rate limiter not available, allowing request');
        return next();
      }
    }

    if (!rateLimiterInstance) {
      // Fallback if rate limiter not initialized
      return next();
    }

    // Use IP + user ID (if authenticated) as key
    const key = req.user?.id || req.ip || 'anonymous';
    
    const rateLimitRes = await rateLimiterInstance.consume(key);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.rateLimit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString());
    
    next();
  } catch (rejRes: any) {
    // Rate limit exceeded
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      path: req.path,
      retryAfter: rejRes.msBeforeNext / 1000 
    });
    
    res.setHeader('Retry-After', Math.round(rejRes.msBeforeNext / 1000));
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    });
  }
};

// Export for use in routes
export const rateLimiter = rateLimiterMiddleware;

// Specific rate limiters for different endpoints
export const strictRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isInitialized) {
      try {
        await initializeRateLimiter();
      } catch (error) {
        logger.warn('Strict rate limiter not available, allowing request');
        return next();
      }
    }

    if (!rateLimiterInstance) {
      return next();
    }

    const key = `strict:${req.user?.id || req.ip || 'anonymous'}`;
    
    // More strict: 10 requests per minute
    const strictLimiter = new RateLimiterRedis({
      storeClient: redis.getClient(),
      keyPrefix: 'strict',
      points: 10,
      duration: 60,
      blockDuration: 60 * 30,
    });
    
    await strictLimiter.consume(key);
    next();
  } catch (error) {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for this endpoint',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
};