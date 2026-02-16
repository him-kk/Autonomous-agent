// ============================================
// Scraping Routes
// ============================================

import { Router, Request, Response } from 'express';
import { authenticate, authenticateApiKey } from '@/middleware/auth.js';
import { requestValidator } from '@/middleware/validator.js';
import { scrapingRequestSchema } from '@/middleware/validator.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { getAgentGraph } from '@/graph/agentGraph.js';
import { ScrapingJob } from '@/models/Job.js';
import { logger } from '@/utils/logger.js';
import { z } from 'zod';

const router = Router();

// Start a new scraping job
router.post(
  '/',
  authenticateApiKey,
  requestValidator.body(scrapingRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, options } = req.validatedBody;
    const userId = req.user!.id;

    logger.info('Starting scraping job', { query, userId });

    // Create job record
    const job = new ScrapingJob({
      userId,
      query,
      status: 'planning',
      progress: 0,
      metadata: options
    });
    await job.save();

    // Start the agent graph asynchronously
    const graph = getAgentGraph();
    
    // Run graph in background
    graph.run(query, userId, {
      maxSteps: options?.depth ? options.depth * 10 : 50,
      timeout: 1800000
    }).then(async (result) => {
      // Update job with result
      if (result.finalOutput) {
        await job.markCompleted(result.finalOutput);
      } else if (result.errors.length > 0) {
        await job.markFailed(result.errors.map(e => e.error).join('; '));
      }
    }).catch(async (error) => {
      logger.error('Scraping job failed:', error);
      await job.markFailed(error.message);
    });

    res.status(202).json({
      success: true,
      message: 'Scraping job started',
      data: {
        jobId: job._id,
        query,
        status: job.status,
        createdAt: job.createdAt
      }
    });
  })
);

// Start scraping with real-time updates via SSE
router.post(
  '/stream',
  authenticateApiKey,
  requestValidator.body(scrapingRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, options } = req.validatedBody;
    const userId = req.user!.id;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const graph = getAgentGraph();
    
    try {
      // Send initial message
      res.write(`data: ${JSON.stringify({ type: 'start', query })}\n\n`);

      // Run graph with streaming updates
      await graph.runStream(query, userId, (state) => {
        const update = {
          type: 'update',
          status: state.status,
          progress: state.currentStep,
          step: state.status
        };
        res.write(`data: ${JSON.stringify(update)}\n\n`);
      });

      // Send completion
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })}\n\n`);
      res.end();
    }
  })
);

// Get job status
router.get(
  '/jobs/:jobId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const userId = req.user!.id;

    const job = await ScrapingJob.findOne({ _id: jobId, userId });

    if (!job) {
      res.status(404).json({
        success: false,
        error: 'Job not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        jobId: job._id,
        query: job.query,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }
    });
  })
);

// List user's jobs
router.get(
  '/jobs',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;

    const jobs = await ScrapingJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await ScrapingJob.countDocuments({ userId });

    res.json({
      success: true,
      data: jobs.map(job => ({
        jobId: job._id,
        query: job.query,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      })),
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Cancel a job
router.delete(
  '/jobs/:jobId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const userId = req.user!.id;

    const job = await ScrapingJob.findOne({ _id: jobId, userId });

    if (!job) {
      res.status(404).json({
        success: false,
        error: 'Job not found'
      });
      return;
    }

    // Only allow cancellation of active jobs
    if (['completed', 'failed'].includes(job.status)) {
      res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed or failed job'
      });
      return;
    }

    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.completedAt = new Date();
    await job.save();

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  })
);

// Quick scrape (synchronous, for simple queries)
router.post(
  '/quick',
  authenticateApiKey,
  requestValidator.body(z.object({
    query: z.string().min(1).max(200),
    maxResults: z.number().int().min(1).max(20).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, maxResults = 10 } = req.validatedBody;
    const userId = req.user!.id;

    logger.info('Quick scrape requested', { query, userId });

    const graph = getAgentGraph();
    
    // Set shorter timeout for quick scrape
    const result = await graph.run(query, userId, {
      maxSteps: 20,
      timeout: 60000 // 1 minute
    });

    if (result.finalOutput) {
      // Limit results if specified
      if (maxResults && result.finalOutput.detailedData) {
        result.finalOutput.detailedData = result.finalOutput.detailedData.slice(0, maxResults);
        result.finalOutput.totalSources = result.finalOutput.detailedData.length;
      }

      res.json({
        success: true,
        data: result.finalOutput
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Scraping failed',
        details: result.errors
      });
    }
  })
);

export { router as scrapingRouter };
