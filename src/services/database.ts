// ============================================
// Database Services - MongoDB & Redis
// ============================================

import mongoose from 'mongoose';
import { Redis as RedisClient } from 'ioredis';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

// ============================================
// MongoDB Connection
// ============================================

class MongoDBService {
  private static instance: MongoDBService;
  private connection: typeof mongoose | null = null;

  private constructor() {}

  static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  async connect(): Promise<typeof mongoose> {
    if (this.connection) {
      return this.connection;
    }

    try {
      const options: mongoose.ConnectOptions = {
        dbName: config.mongodb.dbName,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connection = await mongoose.connect(config.mongodb.uri, options);
      
      logger.info('MongoDB connected successfully', {
        host: this.connection.connection.host,
        port: this.connection.connection.port,
        dbName: config.mongodb.dbName
      });

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      logger.info('MongoDB disconnected');
    }
  }

  getConnection(): typeof mongoose {
    if (!this.connection) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.connection;
  }

  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }
}

// ============================================
// Redis Connection
// ============================================

class RedisService {
  private static instance: RedisService;
  private client: RedisClient | null = null;  // ✅ Fixed: Use RedisClient alias

  private constructor() {}

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  async connect(): Promise<RedisClient> {
    if (this.client) {
      return this.client;
    }

    try {
      this.client = new RedisClient(config.redis.url, {
        password: config.redis.password,
        db: config.redis.db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        showFriendlyErrorStack: true
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (err) => {
        logger.error('Redis error:', err);
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      // Test connection
      await this.client.ping();
      
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis disconnected');
    }
  }

  getClient(): RedisClient {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  // Cache helpers
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client?.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const data = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client?.setex(key, ttlSeconds, data);
      } else {
        await this.client?.set(key, data);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client?.del(key);
    } catch (error) {
      logger.error('Redis delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client?.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  }

  // Rate limiting helper
  async increment(key: string, windowSeconds: number): Promise<number> {
    try {
      const multi = this.client?.multi();
      multi?.incr(key);
      multi?.expire(key, windowSeconds);
      const results = await multi?.exec();
      return (results?.[0]?.[1] as number) || 0;
    } catch (error) {
      logger.error('Redis increment error:', error);
      return 0;
    }
  }

  // Queue helpers for BullMQ
  async addToQueue(queueName: string, data: any): Promise<void> {
    try {
      await this.client?.lpush(`queue:${queueName}`, JSON.stringify(data));
    } catch (error) {
      logger.error('Redis addToQueue error:', error);
    }
  }

  async getFromQueue(queueName: string): Promise<any | null> {
    try {
      const data = await this.client?.brpop(`queue:${queueName}`, 0);
      return data ? JSON.parse(data[1]) : null;
    } catch (error) {
      logger.error('Redis getFromQueue error:', error);
      return null;
    }
  }
}

// ============================================
// Database Health Check
// ============================================

export const checkDatabaseHealth = async (): Promise<{
  mongodb: boolean;
  redis: boolean;
}> => {
  const mongoDB = MongoDBService.getInstance();
  const redis = RedisService.getInstance();

  return {
    mongodb: mongoDB.isConnected(),
    redis: redis.isConnected()
  };
};

// ============================================
// Initialize All Databases
// ============================================

export const initializeDatabases = async (): Promise<void> => {
  const mongoDB = MongoDBService.getInstance();
  const redis = RedisService.getInstance();

  await Promise.all([
    mongoDB.connect(),
    redis.connect()
  ]);

  logger.info('All databases initialized successfully');
};

// ============================================
// Close All Database Connections
// ============================================

export const closeDatabaseConnections = async (): Promise<void> => {
  const mongoDB = MongoDBService.getInstance();
  const redis = RedisService.getInstance();

  await Promise.all([
    mongoDB.disconnect(),
    redis.disconnect()
  ]);

  logger.info('All database connections closed');
};

// Export singleton instances
export const mongoDB = MongoDBService.getInstance();
export const redis = RedisService.getInstance();

// Export classes for testing
export { MongoDBService, RedisService };