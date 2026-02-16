// ============================================
// User Model
// ============================================

import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '@/config/index.js';

export interface IUser extends Document {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin' | 'api';
  apiKey?: string;
  preferences: {
    outputFormat: 'json' | 'csv' | 'xlsx' | 'pdf';
    maxResults: number;
    depth: number;
    priority: 'speed' | 'accuracy' | 'comprehensive';
    notifications: boolean;
    language: string;
  };
  usage: {
    totalRequests: number;
    totalDataExtracted: number;
    lastRequestAt?: Date;
  };
  subscription: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    expiresAt?: Date;
    requestsLimit: number;
    requestsUsed: number;
  };
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateApiKey(): Promise<string>;
  hasAvailableRequests(): boolean;
  incrementUsage(): Promise<void>;
}

// ✅ Add interface for static methods
interface IUserModel extends Model<IUser> {
  findByApiKey(apiKey: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  findByEmailWithPassword(email: string): Promise<IUser | null>;
  getUsageStats(userId: string): Promise<any>;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'api'],
      default: 'user'
    },
    apiKey: {
      type: String,
      unique: true,
      sparse: true
    },
    preferences: {
      outputFormat: {
        type: String,
        enum: ['json', 'csv', 'xlsx', 'pdf'],
        default: 'json'
      },
      maxResults: {
        type: Number,
        default: 100,
        min: 1,
        max: 10000
      },
      depth: {
        type: Number,
        default: 2,
        min: 1,
        max: 10
      },
      priority: {
        type: String,
        enum: ['speed', 'accuracy', 'comprehensive'],
        default: 'accuracy'
      },
      notifications: {
        type: Boolean,
        default: true
      },
      language: {
        type: String,
        default: 'en'
      }
    },
    usage: {
      totalRequests: {
        type: Number,
        default: 0
      },
      totalDataExtracted: {
        type: Number,
        default: 0
      },
      lastRequestAt: {
        type: Date,
        default: null
      }
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'basic', 'pro', 'enterprise'],
        default: 'free'
      },
      expiresAt: {
        type: Date,
        default: null
      },
      requestsLimit: {
        type: Number,
        default: 100
      },
      requestsUsed: {
        type: Number,
        default: 0
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Indexes - Remove duplicate indexes
UserSchema.index({ email: 1 });
UserSchema.index({ apiKey: 1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // ✅ Fixed: Explicitly type this.password as string
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(config.auth.bcryptRounds);
    const password = this.password as string;  // Explicit type assertion
    this.password = await bcrypt.hash(password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Methods
UserSchema.methods.comparePassword = async function(
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateApiKey = async function(this: IUser): Promise<string> {
  const apiKey = `ak_${Buffer.from(`${this._id}_${Date.now()}`).toString('base64')}`;
  this.apiKey = apiKey;
  await this.save();
  return apiKey;
};

UserSchema.methods.hasAvailableRequests = function(this: IUser): boolean {
  const { requestsLimit, requestsUsed } = this.subscription;
  
  // Check if subscription is expired
  if (this.subscription.expiresAt && this.subscription.expiresAt < new Date()) {
    return false;
  }
  
  return requestsUsed < requestsLimit;
};

UserSchema.methods.incrementUsage = async function(this: IUser): Promise<void> {
  this.usage.totalRequests += 1;
  this.usage.lastRequestAt = new Date();
  this.subscription.requestsUsed += 1;
  await this.save();
};

// Statics
UserSchema.statics.findByApiKey = function(apiKey: string) {
  return this.findOne({ apiKey, isActive: true });
};

UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

UserSchema.statics.findByEmailWithPassword = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true }).select('+password');
};

UserSchema.statics.getUsageStats = async function(userId: string) {
  const user = await this.findById(userId);
  if (!user) return null;
  
  return {
    totalRequests: user.usage.totalRequests,
    totalDataExtracted: user.usage.totalDataExtracted,
    lastRequestAt: user.usage.lastRequestAt,
    subscription: {
      plan: user.subscription.plan,
      requestsLimit: user.subscription.requestsLimit,
      requestsUsed: user.subscription.requestsUsed,
      requestsRemaining: user.subscription.requestsLimit - user.subscription.requestsUsed,
      expiresAt: user.subscription.expiresAt
    }
  };
};

export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);