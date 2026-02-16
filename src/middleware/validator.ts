// ============================================
// Request Validator Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from './errorHandler.js';

// Validation schemas
export const scrapingRequestSchema = z.object({
  query: z.string().min(1).max(500),
  options: z.object({
    maxResults: z.number().int().min(1).max(1000).optional(),
    depth: z.number().int().min(1).max(10).optional(),
    priority: z.enum(['speed', 'accuracy', 'comprehensive']).optional(),
    outputFormat: z.enum(['json', 'csv', 'xlsx', 'pdf']).optional(),
    notifyOnComplete: z.boolean().optional()
  }).optional()
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100)
});

export const memoryQuerySchema = z.object({
  query: z.string().min(1),
  type: z.enum(['scraping_pattern', 'selector', 'failure', 'success', 'insight', 'strategy']).optional(),
  limit: z.number().int().min(1).max(100).optional()
});

// Validator factory
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code
        }));
        
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

// Query validator
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code
        }));
        
        next(new ValidationError('Query validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

// Params validator
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code
        }));
        
        next(new ValidationError('Params validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

// Export main validator
export const requestValidator = {
  body: validate,
  query: validateQuery,
  params: validateParams
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
      validatedQuery?: any;
      validatedParams?: any;
      user?: any;
    }
  }
}
