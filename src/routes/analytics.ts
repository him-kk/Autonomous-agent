// ============================================
// Analytics Routes
// ============================================

import { Router, Request, Response } from 'express';
import { authenticate } from '@/middleware/auth.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { ScrapingJob } from '@/models/Job.js';
import { MemoryEntry } from '@/models/Memory.js';
import { logger } from '@/utils/logger.js';

const router = Router();

// Get dashboard analytics
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Get user's job statistics
    const totalJobs = await ScrapingJob.countDocuments({ userId });
    const completedJobs = await ScrapingJob.countDocuments({ userId, status: 'completed' });
    const failedJobs = await ScrapingJob.countDocuments({ userId, status: 'failed' });
    
    // Get recent jobs
    const recentJobs = await ScrapingJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate success rate
    const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    // Get data extracted over time
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const jobsLast30Days = await ScrapingJob.find({
      userId,
      createdAt: { $gte: last30Days }
    });

    const dailyStats = jobsLast30Days.reduce((acc: any, job) => {
      const date = job.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { jobs: 0, dataExtracted: 0 };
      }
      acc[date].jobs += 1;
      if (job.result?.detailedData) {
        acc[date].dataExtracted += job.result.detailedData.length;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        overview: {
          totalJobs,
          completedJobs,
          failedJobs,
          successRate,
          activeJobs: totalJobs - completedJobs - failedJobs
        },
        recentJobs: recentJobs.map(job => ({
          id: job._id,
          query: job.query,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt
        })),
        dailyStats: Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
          date,
          ...stats
        })),
        topQueries: await getTopQueries(userId)
      }
    });
  })
);

// Get system-wide analytics (admin only)
router.get(
  '/system',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
      return;
    }

    // System statistics
    const totalJobs = await ScrapingJob.countDocuments();
    const activeJobs = await ScrapingJob.findActiveJobs();
    const totalMemoryEntries = await MemoryEntry.countDocuments();
    
    // Success rate over time
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const jobsLast7Days = await ScrapingJob.find({
      createdAt: { $gte: last7Days }
    });

    const successRateByDay = jobsLast7Days.reduce((acc: any, job) => {
      const date = job.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, success: 0 };
      }
      acc[date].total += 1;
      if (job.status === 'completed') {
        acc[date].success += 1;
      }
      return acc;
    }, {});

    // Top domains scraped
    const topDomains = await MemoryEntry.aggregate([
      { $match: { 'metadata.domain': { $exists: true } } },
      { $group: { 
        _id: '$metadata.domain', 
        count: { $sum: 1 },
        successCount: { 
          $sum: { $cond: ['$metadata.success', 1, 0] } 
        }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Error types
    const errorTypes = await MemoryEntry.aggregate([
      { $match: { type: 'failure' } },
      { $group: { 
        _id: '$value.errorType', 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalJobs,
          activeJobs: activeJobs.length,
          totalMemoryEntries,
          systemHealth: 'healthy'
        },
        successRateByDay: Object.entries(successRateByDay).map(([date, stats]: [string, any]) => ({
          date,
          total: stats.total,
          success: stats.success,
          rate: Math.round((stats.success / stats.total) * 100)
        })),
        topDomains: topDomains.map(d => ({
          domain: d._id,
          totalScrapes: d.count,
          successRate: Math.round((d.successCount / d.count) * 100)
        })),
        errorTypes: errorTypes.map(e => ({
          type: e._id || 'unknown',
          count: e.count
        }))
      }
    });
  })
);

// Get job analytics
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

    // Calculate analytics from job data
    const analytics = {
      scrapingStats: {
        totalUrls: job.discoveredUrls?.length || 0,
        scrapedCount: job.scrapedData?.length || 0,
        failedCount: job.scrapedData?.filter((s: any) => !s.success).length || 0,
        successRate: job.scrapedData?.length 
          ? Math.round((job.scrapedData.filter((s: any) => s.success).length / job.scrapedData.length) * 100)
          : 0
      },
      dataQuality: {
        cleanedCount: job.cleanedData?.length || 0,
        validatedCount: job.validationResults?.length || 0,
        averageConfidence: job.cleanedData?.length
          ? job.cleanedData.reduce((acc: number, c: any) => acc + (c.confidence || 0), 0) / job.cleanedData.length
          : 0,
        validationPassRate: job.validationResults?.length
          ? Math.round((job.validationResults.filter((v: any) => v.isValid).length / job.validationResults.length) * 100)
          : 0
      },
      timing: {
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        duration: job.completedAt && job.startedAt
          ? job.completedAt.getTime() - job.startedAt.getTime()
          : null
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  })
);

// Get trends
router.get(
  '/trends',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const jobs = await ScrapingJob.find({
      userId,
      createdAt: { $gte: startDate },
      status: 'completed'
    });

    // Extract services trends
    const serviceCounts: Record<string, number> = {};
    
    for (const job of jobs) {
      if (job.result?.insights?.topServicesTrending) {
        for (const service of job.result.insights.topServicesTrending) {
          serviceCounts[service] = (serviceCounts[service] || 0) + 1;
        }
      }
    }

    // Sort by frequency
    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([service, count]) => ({ service, count }));

    // Daily job counts
    const dailyJobs = jobs.reduce((acc: any, job) => {
      const date = job.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        totalJobs: jobs.length,
        topServices,
        dailyJobs: Object.entries(dailyJobs).map(([date, count]) => ({ date, count }))
      }
    });
  })
);

// Helper function to get top queries
async function getTopQueries(userId: string): Promise<Array<{ query: string; count: number }>> {
  const jobs = await ScrapingJob.find({ userId });
  
  const queryCounts: Record<string, number> = {};
  
  for (const job of jobs) {
    const normalizedQuery = job.query.toLowerCase().trim();
    queryCounts[normalizedQuery] = (queryCounts[normalizedQuery] || 0) + 1;
  }

  return Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([query, count]) => ({ query, count }));
}

export { router as analyticsRouter };
