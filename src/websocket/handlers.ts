// ============================================
// WebSocket Handlers
// ============================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '@/utils/logger.js';
import { getAgentGraph } from '@/graph/agentGraph.js';
import { ScrapingJob } from '@/models/Job.js';

interface ScrapingJobData {
  query: string;
  options?: {
    maxResults?: number;
    depth?: number;
    priority?: 'speed' | 'accuracy' | 'comprehensive';
  };
}

export const setupWebSocketHandlers = (io: SocketIOServer): void => {
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Authenticate socket
    socket.on('authenticate', (token: string) => {
      // Verify token and associate socket with user
      // For now, just acknowledge
      socket.emit('authenticated', { success: true });
    });

    // Start scraping job
    socket.on('start-scraping', async (data: ScrapingJobData) => {
      try {
        const { query, options } = data;
        
        logger.info('WebSocket scraping started', { 
          socketId: socket.id, 
          query 
        });

        // Create job record
        const job = new ScrapingJob({
          userId: 'websocket-user', // Would be from authenticated user
          query,
          status: 'planning',
          progress: 0,
          metadata: options
        });
        await job.save();

        // Notify client
        socket.emit('job-created', {
          jobId: job._id,
          query,
          status: 'planning'
        });

        // Run agent graph with progress updates
        const graph = getAgentGraph();
        
        await graph.runStream(query, 'websocket-user', (state) => {
          socket.emit('progress', {
            jobId: job._id,
            status: state.status,
            progress: state.currentStep,
            discoveredUrls: state.discoveredUrls?.length || 0,
            scrapedData: state.scrapedData?.length || 0,
            cleanedData: state.cleanedData?.length || 0
          });
        });

        // Get final result
        const updatedJob = await ScrapingJob.findById(job._id);
        
        if (updatedJob?.result) {
          socket.emit('completed', {
            jobId: job._id,
            result: updatedJob.result
          });
        } else {
          socket.emit('error', {
            jobId: job._id,
            error: 'Job failed to complete'
          });
        }
      } catch (error) {
        logger.error('WebSocket scraping error:', error);
        socket.emit('error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get job status
    socket.on('get-status', async (jobId: string) => {
      try {
        const job = await ScrapingJob.findById(jobId);
        
        if (!job) {
          socket.emit('status-error', { error: 'Job not found' });
          return;
        }

        socket.emit('status', {
          jobId: job._id,
          query: job.query,
          status: job.status,
          progress: job.progress,
          currentStep: job.currentStep,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        });
      } catch (error) {
        socket.emit('status-error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Cancel job
    socket.on('cancel-job', async (jobId: string) => {
      try {
        const job = await ScrapingJob.findById(jobId);
        
        if (!job) {
          socket.emit('cancel-error', { error: 'Job not found' });
          return;
        }

        if (['completed', 'failed'].includes(job.status)) {
          socket.emit('cancel-error', { error: 'Cannot cancel completed job' });
          return;
        }

        job.status = 'failed';
        job.error = 'Cancelled by user';
        job.completedAt = new Date();
        await job.save();

        socket.emit('cancelled', { jobId });
      } catch (error) {
        socket.emit('cancel-error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Subscribe to job updates
    socket.on('subscribe', (jobId: string) => {
      socket.join(`job:${jobId}`);
      socket.emit('subscribed', { jobId });
    });

    // Unsubscribe from job updates
    socket.on('unsubscribe', (jobId: string) => {
      socket.leave(`job:${jobId}`);
      socket.emit('unsubscribed', { jobId });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
};

// Broadcast job update to all subscribers
export const broadcastJobUpdate = (
  io: SocketIOServer,
  jobId: string,
  update: any
): void => {
  io.to(`job:${jobId}`).emit('job-update', {
    jobId,
    ...update,
    timestamp: new Date().toISOString()
  });
};
