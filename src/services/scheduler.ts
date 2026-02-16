// ============================================
// Scheduler Service - Cron Jobs
// ============================================

import cron from 'node-cron';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { ScrapingJob } from '@/models/Job.js';
import { MemoryEntry } from '@/models/Memory.js';
import { getAgentGraph } from '@/graph/agentGraph.js';

// Scheduled tasks
let scrapingTask: cron.ScheduledTask | null = null;
let analyticsTask: cron.ScheduledTask | null = null;
let cleanupTask: cron.ScheduledTask | null = null;

export const startScheduledJobs = (): void => {
  if (config.nodeEnv === 'test') {
    return; // Don't run scheduled jobs in test environment
  }

  logger.info('Starting scheduled jobs');

  // Daily scraping job (default: 2 AM)
  if (config.scheduling.scrapingSchedule) {
    scrapingTask = cron.schedule(config.scheduling.scrapingSchedule, async () => {
      logger.info('Running scheduled scraping job');
      
      try {
        // Get pending scheduled jobs
        const pendingJobs = await ScrapingJob.find({
          'metadata.scheduled': true,
          status: { $in: ['idle', 'failed'] }
        });

        for (const job of pendingJobs) {
          try {
            const graph = getAgentGraph();
            await graph.run(job.query, job.userId);
            
            logger.info('Scheduled job completed', { jobId: job._id });
          } catch (error) {
            logger.error('Scheduled job failed:', { jobId: job._id, error });
          }
        }
      } catch (error) {
        logger.error('Scheduled scraping job error:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Scraping scheduler started', { 
      schedule: config.scheduling.scrapingSchedule 
    });
  }

  // Daily analytics job (default: 6 AM)
  if (config.scheduling.analyticsSchedule) {
    analyticsTask = cron.schedule(config.scheduling.analyticsSchedule, async () => {
      logger.info('Running scheduled analytics job');
      
      try {
        // Generate daily analytics report
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyJobs = await ScrapingJob.find({
          createdAt: { $gte: yesterday, $lt: today }
        });

        const stats = {
          totalJobs: dailyJobs.length,
          completedJobs: dailyJobs.filter(j => j.status === 'completed').length,
          failedJobs: dailyJobs.filter(j => j.status === 'failed').length,
          totalDataExtracted: dailyJobs.reduce((acc, j) => 
            acc + (j.result?.detailedData?.length || 0), 0
          )
        };

        // Store analytics in memory
        const analyticsEntry = new MemoryEntry({
          type: 'insight',
          key: `daily_analytics_${yesterday.toISOString().split('T')[0]}`,
          value: stats,
          metadata: {
            success: true,
            confidence: 1.0
          },
          tags: ['analytics', 'daily', 'system']
        });

        await analyticsEntry.save();

        logger.info('Daily analytics generated', stats);
      } catch (error) {
        logger.error('Scheduled analytics job error:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Analytics scheduler started', { 
      schedule: config.scheduling.analyticsSchedule 
    });
  }

  // Cleanup job (runs every hour)
  cleanupTask = cron.schedule('0 * * * *', async () => {
    logger.info('Running cleanup job');
    
    try {
      // Clean up old failed jobs (older than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deletedJobs = await ScrapingJob.deleteMany({
        status: 'failed',
        createdAt: { $lt: sevenDaysAgo }
      });

      // Clean up old memory entries (older than 90 days, low access count)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedMemories = await MemoryEntry.deleteMany({
        createdAt: { $lt: ninetyDaysAgo },
        accessCount: { $lt: 5 },
        type: { $in: ['failure', 'scraping_pattern'] }
      });

      logger.info('Cleanup completed', {
        deletedJobs: deletedJobs.deletedCount,
        deletedMemories: deletedMemories.deletedCount
      });
    } catch (error) {
      logger.error('Cleanup job error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('Cleanup scheduler started');
};

export const stopScheduledJobs = (): void => {
  if (scrapingTask) {
    scrapingTask.stop();
    logger.info('Scraping scheduler stopped');
  }
  
  if (analyticsTask) {
    analyticsTask.stop();
    logger.info('Analytics scheduler stopped');
  }
  
  if (cleanupTask) {
    cleanupTask.stop();
    logger.info('Cleanup scheduler stopped');
  }
};

// Schedule a new recurring job
export const scheduleRecurringJob = async (
  userId: string,
  query: string,
  schedule: string,
  options?: any
): Promise<string> => {
  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error('Invalid cron expression');
  }

  // Create job record
  const job = new ScrapingJob({
    userId,
    query,
    status: 'idle',
    metadata: {
      scheduled: true,
      cronSchedule: schedule,
      options
    }
  });

  await job.save();

  logger.info('Recurring job scheduled', { 
    jobId: job._id, 
    userId, 
    query, 
    schedule 
  });

  return job._id.toString();
};

// Cancel a recurring job
export const cancelRecurringJob = async (
  jobId: string,
  userId: string
): Promise<void> => {
  const job = await ScrapingJob.findOne({ _id: jobId, userId });
  
  if (!job) {
    throw new Error('Job not found');
  }

  if (!job.metadata?.scheduled) {
    throw new Error('Not a scheduled job');
  }

  await ScrapingJob.findByIdAndDelete(jobId);

  logger.info('Recurring job cancelled', { jobId, userId });
};
