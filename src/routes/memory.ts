// ============================================
// Memory Routes
// ============================================

import { Router, Request, Response } from 'express';
import { authenticate } from '@/middleware/auth.js';
import { requestValidator } from '@/middleware/validator.js';
import { memoryQuerySchema } from '@/middleware/validator.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { MemoryEntry } from '@/models/Memory.js';
import { llmService } from '@/services/llm.js';
import { logger } from '@/utils/logger.js';

const router = Router();

// ✅ Helper function to safely extract query params
const getQueryParam = (param: any): string | undefined => {
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && param.length > 0) return String(param[0]);
  return undefined;
};

// Search memory entries
router.get(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // ✅ Use helper function
    const query = getQueryParam(req.query.query);
    const type = getQueryParam(req.query.type);
    const limitParam = getQueryParam(req.query.limit) || '10';
    const limit = parseInt(limitParam);
    
    const searchQuery: any = {};
    
    if (type) {
      searchQuery.type = type;
    }
    
    if (query) {
      searchQuery.$or = [
        { key: { $regex: query, $options: 'i' } },
        { 'value.url': { $regex: query, $options: 'i' } },
        { 'metadata.domain': { $regex: query, $options: 'i' } }
      ];
    }

    const entries = await MemoryEntry.find(searchQuery)
      .sort({ accessCount: -1, createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: entries.map(entry => ({
        id: entry._id,
        type: entry.type,
        key: entry.key,
        value: entry.value,
        metadata: entry.metadata,
        accessCount: entry.accessCount,
        createdAt: entry.createdAt
      })),
      meta: {
        total: await MemoryEntry.countDocuments(searchQuery)
      }
    });
  })
);

// Get memory by type
router.get(
  '/type/:type',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // ✅ Explicitly type as string from params
    const type = req.params.type as string;
    // ✅ Use helper function
    const limitParam = getQueryParam(req.query.limit) || '20';
    const limit = parseInt(limitParam);

    const entries = await MemoryEntry.findByType(type, limit);

    res.json({
      success: true,
      data: entries.map(entry => ({
        id: entry._id,
        type: entry.type,
        key: entry.key,
        value: entry.value,
        metadata: entry.metadata,
        accessCount: entry.accessCount,
        createdAt: entry.createdAt
      }))
    });
  })
);

// Get memory by domain
router.get(
  '/domain/:domain',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // ✅ Explicitly type domain as string from params
    const domain = req.params.domain as string;
    // ✅ Use helper function
    const type = getQueryParam(req.query.type);

    const entries = await MemoryEntry.findByDomain(domain, type);

    res.json({
      success: true,
      data: entries.map(entry => ({
        id: entry._id,
        type: entry.type,
        key: entry.key,
        value: entry.value,
        metadata: entry.metadata,
        accessCount: entry.accessCount,
        createdAt: entry.createdAt
      }))
    });
  })
);

// Get learned selectors for a domain
router.get(
  '/selectors/:domain',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const domain = req.params.domain as string;

    const selectors = await MemoryEntry.find({
      type: 'selector',
      'metadata.domain': domain,
      'metadata.success': true
    })
    .sort({ 'metadata.confidence': -1 })
    .limit(10);

    res.json({
      success: true,
      data: selectors.map(s => ({
        selectors: s.value.selectors,
        confidence: s.metadata.confidence,
        url: s.metadata.url
      }))
    });
  })
);

// Get failure patterns
router.get(
  '/failures',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // ✅ Use helper function
    const domain = getQueryParam(req.query.domain);

    const query: any = { type: 'failure' };
    if (domain) {
      query['metadata.domain'] = domain;
    }

    const failures = await MemoryEntry.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    // Group by error type
    const grouped = failures.reduce((acc: any, f) => {
      const errorType = f.value.errorType || 'unknown';
      if (!acc[errorType]) {
        acc[errorType] = [];
      }
      acc[errorType].push({
        url: f.metadata.url,
        error: f.value.error,
        createdAt: f.createdAt
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: grouped
    });
  })
);

// Semantic search using embeddings
router.post(
  '/semantic-search',
  authenticate,
  requestValidator.body(memoryQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, type, limit = 10 } = req.validatedBody;

    // Create embedding for query
    const embedding = await llmService.createEmbedding(query);

    // Find similar entries
    const similarEntries = await MemoryEntry.findSimilar(embedding, type, limit);

    res.json({
      success: true,
      data: similarEntries.map(entry => ({
        id: entry._id,
        type: entry.type,
        key: entry.key,
        value: entry.value,
        metadata: entry.metadata,
        similarity: 'calculated' // Would include actual similarity score
      }))
    });
  })
);

// Get memory insights
router.get(
  '/insights',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Get top patterns
    const patterns = await MemoryEntry.find({ type: 'scraping_pattern' })
      .sort({ accessCount: -1 })
      .limit(10);

    // Get top failures
    const failures = await MemoryEntry.find({ type: 'failure' })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get insights
    const insights = await MemoryEntry.find({ type: 'insight' })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        topPatterns: patterns.map(p => ({
          domain: p.metadata.domain,
          accessCount: p.accessCount,
          confidence: p.metadata.confidence
        })),
        recentFailures: failures.map(f => ({
          domain: f.metadata.domain,
          errorType: f.value.errorType,
          createdAt: f.createdAt
        })),
        insights: insights.map(i => ({
          description: i.value.description,
          confidence: i.value.confidence,
          createdAt: i.createdAt
        }))
      }
    });
  })
);

// Delete memory entry (admin only)
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Check if admin
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
      return;
    }

    const id = req.params.id as string;

    const entry = await MemoryEntry.findByIdAndDelete(id);

    if (!entry) {
      res.status(404).json({
        success: false,
        error: 'Memory entry not found'
      });
      return;
    }

    logger.info('Memory entry deleted', { id, admin: req.user!.id });

    res.json({
      success: true,
      message: 'Memory entry deleted successfully'
    });
  })
);

export { router as memoryRouter };