// ============================================
// Scraping Job Model
// ============================================

import mongoose, { Schema, Document, Model } from 'mongoose';
import { AgentStatus, FinalOutput } from '@/types/index.js';

export interface IScrapingJob extends Document {
  id: string;
  userId: string;
  query: string;
  status: AgentStatus;
  progress: number;
  currentStep: string;
  plan?: any;
  discoveredUrls?: any[];
  scrapedData?: any[];
  cleanedData?: any[];
  validationResults?: any[];
  analytics?: any;
  result?: FinalOutput;
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  startedAt?: Date;
  metadata?: Record<string, any>;
  updateProgress(progress: number, step: string): Promise<void>;
  markCompleted(result: FinalOutput): Promise<void>;
  markFailed(error: string): Promise<void>;
}

// ✅ Add interface for static methods
interface IScrapingJobModel extends Model<IScrapingJob> {
  findActiveJobs(): Promise<IScrapingJob[]>;
  findByUserId(userId: string, limit?: number): Promise<IScrapingJob[]>;
}

const ScrapingJobSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    query: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['idle', 'planning', 'searching', 'filtering', 'scraping', 'cleaning', 'validating', 'analyzing', 'completed', 'failed'],
      default: 'idle',
      index: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currentStep: {
      type: String,
      default: ''
    },
    plan: {
      type: Schema.Types.Mixed,
      default: null
    },
    discoveredUrls: [{
      url: String,
      source: String,
      relevanceScore: Number,
      category: String,
      discoveredAt: Date,
      metadata: Schema.Types.Mixed
    }],
    scrapedData: [{
      id: String,
      url: String,
      rawHtml: String,
      extractedData: Schema.Types.Mixed,
      timestamp: Date,
      scrapingMethod: String,
      success: Boolean,
      metadata: Schema.Types.Mixed
    }],
    cleanedData: [{
      id: String,
      sourceId: String,
      url: String,
      structuredData: Schema.Types.Mixed,
      cleaningMethod: String,
      confidence: Number,
      timestamp: Date
    }],
    validationResults: [{
      itemId: String,
      isValid: Boolean,
      score: Number,
      issues: [{
        field: String,
        issue: String,
        severity: String
      }],
      suggestions: [String],
      validatedAt: Date
    }],
    analytics: {
      type: Schema.Types.Mixed,
      default: null
    },
    result: {
      type: Schema.Types.Mixed,
      default: null
    },
    error: {
      type: String,
      default: null
    },
    retryCount: {
      type: Number,
      default: 0
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'scraping_jobs'
  }
);

// Indexes for common queries
ScrapingJobSchema.index({ userId: 1, createdAt: -1 });
ScrapingJobSchema.index({ status: 1, createdAt: -1 });
ScrapingJobSchema.index({ query: 'text' });

// Virtual for duration
ScrapingJobSchema.virtual('duration').get(function(this: IScrapingJob) {
  if (this.startedAt && this.completedAt) {
    return this.completedAt.getTime() - this.startedAt.getTime();
  }
  if (this.startedAt) {
    return Date.now() - this.startedAt.getTime();
  }
  return 0;
});

// Methods
ScrapingJobSchema.methods.updateProgress = async function(
  this: IScrapingJob,
  progress: number,
  step: string
): Promise<void> {
  this.progress = progress;
  this.currentStep = step;
  await this.save();
};

ScrapingJobSchema.methods.markCompleted = async function(
  this: IScrapingJob,
  result: FinalOutput
): Promise<void> {
  this.status = 'completed';
  this.progress = 100;
  this.result = result;
  this.completedAt = new Date();
  await this.save();
};

ScrapingJobSchema.methods.markFailed = async function(
  this: IScrapingJob,
  error: string
): Promise<void> {
  this.status = 'failed';
  this.error = error;
  this.completedAt = new Date();
  await this.save();
};

// Statics
ScrapingJobSchema.statics.findActiveJobs = function() {
  return this.find({
    status: { $in: ['planning', 'searching', 'filtering', 'scraping', 'cleaning', 'validating', 'analyzing'] }
  });
};

ScrapingJobSchema.statics.findByUserId = function(userId: string, limit: number = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// ✅ Export with both instance and static types
export const ScrapingJob = mongoose.model<IScrapingJob, IScrapingJobModel>('ScrapingJob', ScrapingJobSchema);