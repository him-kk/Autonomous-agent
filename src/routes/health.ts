// ============================================
// Health Check Routes
// ============================================

import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '@/services/database.js';
import { getAgentGraph } from '@/graph/agentGraph.js';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import os from 'os';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // Check database connections
    const dbHealth = await checkDatabaseHealth();
    
    // Check system resources
    const systemHealth = {
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      },
      cpu: os.loadavg(),
      uptime: os.uptime()
    };

    // Determine overall health
    const isHealthy = dbHealth.mongodb && dbHealth.redis && systemHealth.memory.usagePercent < 90;

    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        system: systemHealth
      },
      config: {
        nodeEnv: config.nodeEnv,
        features: {
          selfHealing: config.features.enableSelfHealing,
          multiModal: config.features.enableMultiModal,
          memoryLearning: config.features.enableMemoryLearning
        }
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Readiness check
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.mongodb && dbHealth.redis) {
      res.json({
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Database connection issues'
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Liveness check
router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint (for Prometheus)
router.get('/metrics', async (req: Request, res: Response) => {
  // This would typically return Prometheus-formatted metrics
  // For now, return basic metrics in JSON
  
  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      memory_usage_bytes: os.totalmem() - os.freemem(),
      memory_total_bytes: os.totalmem(),
      cpu_load_1m: os.loadavg()[0],
      cpu_load_5m: os.loadavg()[1],
      cpu_load_15m: os.loadavg()[2]
    },
    process: {
      uptime_seconds: process.uptime(),
      memory_usage_bytes: process.memoryUsage().heapUsed
    }
  };

  res.json(metrics);
});

export { router as healthRouter };
