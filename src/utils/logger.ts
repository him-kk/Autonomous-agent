// ============================================
// Winston Logger Configuration
// ============================================

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config, isDevelopment } from '@/config/index.js';

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (isDevelopment()) {
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  );
}

// File transports
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  json(),
  errors({ stack: true })
);

// Combined log file
const combinedFileTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat
});

// Error log file
const errorFileTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: fileFormat
});

// Scraping log file
const scrapingFileTransport = new DailyRotateFile({
  filename: 'logs/scraping-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '7d',
  format: fileFormat
});

transports.push(combinedFileTransport, errorFileTransport, scrapingFileTransport);

// Create logger instance
export const logger = winston.createLogger({
  level: isDevelopment() ? 'debug' : 'info',
  defaultMeta: {
    service: 'autonomous-ai-agent',
    environment: config.nodeEnv
  },
  transports,
  exitOnError: false
});

// Stream for Morgan HTTP logging
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  }
};

// Specialized loggers for different components
export const scrapingLogger = logger.child({ component: 'scraper' });
export const plannerLogger = logger.child({ component: 'planner' });
export const searchLogger = logger.child({ component: 'search' });
export const memoryLogger = logger.child({ component: 'memory' });
export const analyticsLogger = logger.child({ component: 'analytics' });
export const apiLogger = logger.child({ component: 'api' });

// Log levels:
// error: 0
// warn: 1
// info: 2
// http: 3
// verbose: 4
// debug: 5
// silly: 6
