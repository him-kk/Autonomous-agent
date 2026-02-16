// // ============================================
// // Main Entry Point - Express API Server
// // ============================================

// import express, { Application, Request, Response, NextFunction } from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import compression from 'compression';
// import { createServer } from 'http';
// import { Server as SocketIOServer } from 'socket.io';

// import { config } from '@/config/index.js';
// import { logger, stream } from '@/utils/logger.js';
// import { initializeDatabases, closeDatabaseConnections } from '@/services/database.js';
// import { errorHandler } from '@/middleware/errorHandler.js';
// import { rateLimiter } from '@/middleware/rateLimiter.js';
// import { requestValidator } from '@/middleware/validator.js';
// import { authRouter } from '@/routes/auth.js';
// import { scrapingRouter } from '@/routes/scraping.js';
// import { memoryRouter } from '@/routes/memory.js';
// import { analyticsRouter } from '@/routes/analytics.js';
// import { exportRouter } from '@/routes/export.js';
// import { healthRouter } from '@/routes/health.js';
// import { setupWebSocketHandlers } from '@/websocket/handlers.js';
// import { startScheduledJobs } from '@/services/scheduler.js';

// class ApplicationServer {
//   public app: Application;
//   public server: ReturnType<typeof createServer>;
//   public io: SocketIOServer;

//   constructor() {
//     this.app = express();
//     this.server = createServer(this.app);
//     this.io = new SocketIOServer(this.server, {
//       cors: {
//         origin: '*',
//         methods: ['GET', 'POST']
//       }
//     });
    
//     this.initializeMiddlewares();
//     this.initializeRoutes();
//     this.initializeErrorHandling();
//     this.initializeWebSocket();
//   }

//   private initializeMiddlewares(): void {
//     // Security middleware
//     this.app.use(helmet({
//       contentSecurityPolicy: {
//         directives: {
//           defaultSrc: ["'self'"],
//           styleSrc: ["'self'", "'unsafe-inline'"],
//           scriptSrc: ["'self'"],
//           imgSrc: ["'self'", "data:", "https:"],
//         },
//       },
//     }));

//     // CORS
//     this.app.use(cors({
//       origin: config.nodeEnv === 'production' 
//         ? ['https://yourdomain.com'] 
//         : '*',
//       credentials: true
//     }));

//     // Compression
//     this.app.use(compression());

//     // Body parsing
//     this.app.use(express.json({ limit: '10mb' }));
//     this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//     // Rate limiting
//     this.app.use(rateLimiter);

//     // Request logging
//     this.app.use((req: Request, res: Response, next: NextFunction) => {
//       logger.info(`${req.method} ${req.path}`, {
//         ip: req.ip,
//         userAgent: req.get('user-agent')
//       });
//       next();
//     });
//   }

//   private initializeRoutes(): void {
//     // API routes
//     this.app.use('/api/v1/auth', authRouter);
//     this.app.use('/api/v1/scrape', scrapingRouter);
//     this.app.use('/api/v1/memory', memoryRouter);
//     this.app.use('/api/v1/analytics', analyticsRouter);
//     this.app.use('/api/v1/export', exportRouter);
//     this.app.use('/api/v1/health', healthRouter);

//     // API documentation
//     this.app.use('/api/docs', express.static('docs'));

//     // Root endpoint
//     this.app.get('/', (req: Request, res: Response) => {
//       res.json({
//         name: 'Autonomous AI Web Data Extraction Agent',
//         version: '1.0.0',
//         status: 'running',
//         documentation: '/api/docs',
//         health: '/api/v1/health'
//       });
//     });

//     // 404 handler
//     this.app.use((req: Request, res: Response) => {
//       res.status(404).json({
//         success: false,
//         error: 'Endpoint not found',
//         path: req.path
//       });
//     });
//   }

//   private initializeErrorHandling(): void {
//     this.app.use(errorHandler);
//   }

//   private initializeWebSocket(): void {
//     setupWebSocketHandlers(this.io);
//     logger.info('WebSocket handlers initialized');
//   }

//   public async start(): Promise<void> {
//     try {
//       // Initialize databases
//       await initializeDatabases();
//       logger.info('Databases initialized');

//       // Start scheduled jobs
//       startScheduledJobs();
//       logger.info('Scheduled jobs started');

//       // Start server
//       this.server.listen(config.port, config.host, () => {
//         logger.info(`Server running on http://${config.host}:${config.port}`);
//         logger.info(`Environment: ${config.nodeEnv}`);
//       });

//       // Graceful shutdown
//       this.setupGracefulShutdown();
//     } catch (error) {
//       logger.error('Failed to start server:', error);
//       process.exit(1);
//     }
//   }

//   private setupGracefulShutdown(): void {
//     const shutdown = async (signal: string) => {
//       logger.info(`${signal} received. Starting graceful shutdown...`);

//       // Close HTTP server
//       this.server.close(async () => {
//         logger.info('HTTP server closed');

//         // Close database connections
//         await closeDatabaseConnections();
//         logger.info('Database connections closed');

//         // Exit process
//         process.exit(0);
//       });

//       // Force exit after 30 seconds
//       setTimeout(() => {
//         logger.error('Forced shutdown after timeout');
//         process.exit(1);
//       }, 30000);
//     };

//     process.on('SIGTERM', () => shutdown('SIGTERM'));
//     process.on('SIGINT', () => shutdown('SIGINT'));

//     // Handle uncaught exceptions
//     process.on('uncaughtException', (error) => {
//       logger.error('Uncaught exception:', error);
//       shutdown('UNCAUGHT_EXCEPTION');
//     });

//     process.on('unhandledRejection', (reason) => {
//       logger.error('Unhandled rejection:', reason);
//     });
//   }
// }

// // Start the application
// const server = new ApplicationServer();
// server.start();

// export default server;
// ============================================
// Main Entry Point - Express API Server
// ============================================

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from '@/config/index.js';
import { logger, stream } from '@/utils/logger.js';
import { initializeDatabases, closeDatabaseConnections } from '@/services/database.js';
import { errorHandler } from '@/middleware/errorHandler.js';
import { rateLimiter } from '@/middleware/rateLimiter.js';
import { requestValidator } from '@/middleware/validator.js';
import { authRouter } from '@/routes/auth.js';
import { scrapingRouter } from '@/routes/scraping.js';
import { memoryRouter } from '@/routes/memory.js';
import { analyticsRouter } from '@/routes/analytics.js';
import { exportRouter } from '@/routes/export.js';
import { healthRouter } from '@/routes/health.js';
import { servicesRouter } from '@/routes/services.js'; // ✅ NEW IMPORT
import { setupWebSocketHandlers } from '@/websocket/handlers.js';
import { startScheduledJobs } from '@/services/scheduler.js';

class ApplicationServer {
  public app: Application;
  public server: ReturnType<typeof createServer>;
  public io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeWebSocket();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: config.nodeEnv === 'production' 
        ? ['https://yourdomain.com'] 
        : '*',
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/v1/auth', authRouter);
    this.app.use('/api/v1/scrape', scrapingRouter);
    this.app.use('/api/v1/memory', memoryRouter);
    this.app.use('/api/v1/analytics', analyticsRouter);
    this.app.use('/api/v1/export', exportRouter);
    this.app.use('/api/v1/health', healthRouter);
    this.app.use('/api/v1/services', servicesRouter); // ✅ NEW ROUTE

    // API documentation
    this.app.use('/api/docs', express.static('docs'));

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Autonomous AI Web Data Extraction Agent',
        version: '1.0.0',
        status: 'running',
        documentation: '/api/docs',
        health: '/api/v1/health',
        services: '/api/v1/services' // ✅ NEW
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private initializeWebSocket(): void {
    setupWebSocketHandlers(this.io);
    logger.info('WebSocket handlers initialized');
  }

  public async start(): Promise<void> {
    try {
      // Initialize databases
      await initializeDatabases();
      logger.info('Databases initialized');

      // Start scheduled jobs
      startScheduledJobs();
      logger.info('Scheduled jobs started');

      // Start server
      this.server.listen(config.port, config.host, () => {
        logger.info(`Server running on http://${config.host}:${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Close HTTP server
      this.server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connections
        await closeDatabaseConnections();
        logger.info('Database connections closed');

        // Exit process
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
    });
  }
}

// Start the application
const server = new ApplicationServer();
server.start();

export default server;