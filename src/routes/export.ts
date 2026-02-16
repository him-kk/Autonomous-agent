// ============================================
// Export Routes
// ============================================

import { Router, Request, Response } from 'express';
import { authenticate } from '@/middleware/auth.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { ScrapingJob } from '@/models/Job.js';
import { analyticsNode } from '@/nodes/analytics.js';
import { logger } from '@/utils/logger.js';
import { Parser } from 'json2csv';

const router = Router();

// Export job result as JSON
router.get(
  '/:jobId/json',
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

    if (!job.result) {
      res.status(400).json({
        success: false,
        error: 'Job result not available'
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="extraction_${jobId}.json"`);
    
    res.json(job.result);
  })
);

// Export job result as CSV
router.get(
  '/:jobId/csv',
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

    if (!job.result?.detailedData) {
      res.status(400).json({
        success: false,
        error: 'Job result not available'
      });
      return;
    }

    try {
      // Flatten the data for CSV
      const flattenedData = job.result.detailedData.map((item: any) => ({
        name: item.name,
        services: Array.isArray(item.services) ? item.services.join('; ') : item.services,
        pricing: item.pricing,
        location: item.location,
        website: item.website,
        email: item.email || '',
        phone: item.phone || '',
        description: item.description || '',
        confidence: item.confidence
      }));

      const parser = new Parser();
      const csv = parser.parse(flattenedData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="extraction_${jobId}.csv"`);
      
      res.send(csv);
    } catch (error) {
      logger.error('CSV export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate CSV'
      });
    }
  })
);

// Export job result as HTML report
router.get(
  '/:jobId/html',
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

    if (!job.result) {
      res.status(400).json({
        success: false,
        error: 'Job result not available'
      });
      return;
    }

    const html = await analyticsNode.generateReport(job.result, 'html');

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="report_${jobId}.html"`);
    
    res.send(html);
  })
);

// Export multiple jobs
router.post(
  '/batch',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobIds, format = 'json' } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'jobIds array required'
      });
      return;
    }

    const jobs = await ScrapingJob.find({
      _id: { $in: jobIds },
      userId,
      status: 'completed'
    });

    if (jobs.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No completed jobs found'
      });
      return;
    }

    // Combine all results
    const combinedData = {
      exportDate: new Date().toISOString(),
      totalJobs: jobs.length,
      results: jobs.map(job => ({
        query: job.query,
        completedAt: job.completedAt,
        data: job.result
      }))
    };

    if (format === 'csv') {
      // Flatten all data for CSV
      const allData = jobs.flatMap(job => 
        job.result?.detailedData?.map((item: any) => ({
          query: job.query,
          ...item
        })) || []
      );

      const parser = new Parser();
      const csv = parser.parse(allData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="batch_export_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="batch_export_${Date.now()}.json"`);
      res.json(combinedData);
    }
  })
);

// Get export formats for a job
router.get(
  '/:jobId/formats',
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

    const formats = [
      {
        format: 'json',
        name: 'JSON',
        description: 'Raw JSON data',
        url: `/api/v1/export/${jobId}/json`,
        available: !!job.result
      },
      {
        format: 'csv',
        name: 'CSV',
        description: 'Comma-separated values',
        url: `/api/v1/export/${jobId}/csv`,
        available: !!job.result?.detailedData
      },
      {
        format: 'html',
        name: 'HTML Report',
        description: 'Formatted HTML report',
        url: `/api/v1/export/${jobId}/html`,
        available: !!job.result
      }
    ];

    res.json({
      success: true,
      data: formats
    });
  })
);

export { router as exportRouter };
