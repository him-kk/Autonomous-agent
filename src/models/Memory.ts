// // ============================================
// // Agent Memory Model
// // ============================================

// import mongoose, { Schema, Document, Model } from 'mongoose';

// export interface IMemoryEntry extends Document {
//   id: string;
//   type: 'scraping_pattern' | 'selector' | 'failure' | 'success' | 'insight' | 'strategy';
//   key: string;
//   value: any;
//   embedding: number[];
//   metadata: {
//     url?: string;
//     domain?: string;
//     query?: string;
//     success: boolean;
//     confidence: number;
//     [key: string]: any;
//   };
//   createdAt: Date;
//   updatedAt: Date;
//   accessCount: number;
//   lastAccessed: Date;
//   tags: string[];
//   incrementAccess(): Promise<void>;
//   updateEmbedding(embedding: number[]): Promise<void>;
// }

// // ✅ Add interface for static methods
// interface IMemoryEntryModel extends Model<IMemoryEntry> {
//   findByType(type: string, limit?: number): Promise<IMemoryEntry[]>;
//   findByDomain(domain: string, type?: string): Promise<IMemoryEntry[]>;
//   findByTags(tags: string[]): Promise<IMemoryEntry[]>;
//   findSimilar(embedding: number[], type?: string, limit?: number): Promise<IMemoryEntry[]>;
//   getSuccessPatterns(domain?: string): Promise<IMemoryEntry[]>;
//   getFailedSelectors(domain?: string): Promise<IMemoryEntry[]>;
// }

// const MemoryEntrySchema: Schema = new Schema(
//   {
//     type: {
//       type: String,
//       enum: ['scraping_pattern', 'selector', 'failure', 'success', 'insight', 'strategy'],
//       required: true,
//       index: true
//     },
//     key: {
//       type: String,
//       required: true,
//       index: true
//     },
//     value: {
//       type: Schema.Types.Mixed,
//       required: true
//     },
//     embedding: {
//       type: [Number],
//       default: [],
//       index: '2dsphere'
//     },
//     metadata: {
//       url: String,
//       domain: String,
//       query: String,
//       success: { type: Boolean, default: true },
//       confidence: { type: Number, default: 0.8 },
//       additionalInfo: Schema.Types.Mixed
//     },
//     accessCount: {
//       type: Number,
//       default: 0
//     },
//     lastAccessed: {
//       type: Date,
//       default: Date.now
//     },
//     tags: [{
//       type: String,
//       index: true
//     }]
//   },
//   {
//     timestamps: true,
//     collection: 'memory_entries'
//   }
// );

// // Compound indexes
// MemoryEntrySchema.index({ type: 1, key: 1 });
// MemoryEntrySchema.index({ 'metadata.domain': 1, type: 1 });
// MemoryEntrySchema.index({ tags: 1 });
// MemoryEntrySchema.index({ createdAt: -1 });

// // Methods
// MemoryEntrySchema.methods.incrementAccess = async function(this: IMemoryEntry): Promise<void> {
//   this.accessCount += 1;
//   this.lastAccessed = new Date();
//   await this.save();
// };

// MemoryEntrySchema.methods.updateEmbedding = async function(
//   this: IMemoryEntry,
//   embedding: number[]
// ): Promise<void> {
//   this.embedding = embedding;
//   await this.save();
// };

// // Statics
// MemoryEntrySchema.statics.findByType = function(type: string, limit: number = 100) {
//   return this.find({ type })
//     .sort({ accessCount: -1, lastAccessed: -1 })
//     .limit(limit);
// };

// MemoryEntrySchema.statics.findByDomain = function(domain: string, type?: string) {
//   const query: any = { 'metadata.domain': domain };
//   if (type) {
//     query.type = type;
//   }
//   return this.find(query).sort({ createdAt: -1 });
// };

// MemoryEntrySchema.statics.findByTags = function(tags: string[]) {
//   return this.find({ tags: { $in: tags } });
// };

// MemoryEntrySchema.statics.findSimilar = async function(
//   embedding: number[],
//   type?: string,
//   limit: number = 10
// ) {
//   // This would use vector similarity search
//   // For now, we'll use a simple approach
//   const query: any = {};
//   if (type) {
//     query.type = type;
//   }
  
//   // In production, this would use $vectorSearch or similar
//   return this.find(query)
//     .sort({ accessCount: -1 })
//     .limit(limit);
// };

// MemoryEntrySchema.statics.getSuccessPatterns = function(domain?: string) {
//   const query: any = { 
//     type: 'scraping_pattern',
//     'metadata.success': true 
//   };
//   if (domain) {
//     query['metadata.domain'] = domain;
//   }
//   return this.find(query)
//     .sort({ 'metadata.confidence': -1, accessCount: -1 })
//     .limit(20);
// };

// MemoryEntrySchema.statics.getFailedSelectors = function(domain?: string) {
//   const query: any = { 
//     type: 'selector',
//     'metadata.success': false 
//   };
//   if (domain) {
//     query['metadata.domain'] = domain;
//   }
//   return this.find(query)
//     .sort({ createdAt: -1 })
//     .limit(20);
// };

// //  Export with both instance and static types
// export const MemoryEntry = mongoose.model<IMemoryEntry, IMemoryEntryModel>('MemoryEntry', MemoryEntrySchema);
// ============================================
// Agent Memory Model - UPDATED WITH SERVICES
// ============================================

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMemoryEntry extends Document {
  id: string;
  type: 'scraping_pattern' | 'selector' | 'failure' | 'success' | 'insight' | 'strategy';
  key: string;
  value: any;
  services: string[]; // ✅ NEW: Services array
  embedding: number[];
  metadata: {
    url?: string;
    domain?: string;
    query?: string;
    success: boolean;
    confidence: number;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
  incrementAccess(): Promise<void>;
  updateEmbedding(embedding: number[]): Promise<void>;
  updateServices(services: string[]): Promise<void>; // ✅ NEW METHOD
}

// ✅ Add interface for static methods
interface IMemoryEntryModel extends Model<IMemoryEntry> {
  findByType(type: string, limit?: number): Promise<IMemoryEntry[]>;
  findByDomain(domain: string, type?: string): Promise<IMemoryEntry[]>;
  findByTags(tags: string[]): Promise<IMemoryEntry[]>;
  findSimilar(embedding: number[], type?: string, limit?: number): Promise<IMemoryEntry[]>;
  getSuccessPatterns(domain?: string): Promise<IMemoryEntry[]>;
  getFailedSelectors(domain?: string): Promise<IMemoryEntry[]>;
  findByService(service: string): Promise<IMemoryEntry[]>; // ✅ NEW STATIC METHOD
  getTopServices(limit?: number): Promise<{ service: string; count: number }[]>; // ✅ NEW
}

const MemoryEntrySchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: ['scraping_pattern', 'selector', 'failure', 'success', 'insight', 'strategy'],
      required: true,
      index: true
    },
    key: {
      type: String,
      required: true,
      index: true
    },
    value: {
      type: Schema.Types.Mixed,
      required: true
    },
    // ✅ NEW FIELD: Services array
    services: {
      type: [String],
      default: [],
      index: true
    },
    embedding: {
      type: [Number],
      default: [],
      index: '2dsphere'
    },
    metadata: {
      url: String,
      domain: String,
      query: String,
      success: { type: Boolean, default: true },
      confidence: { type: Number, default: 0.8 },
      additionalInfo: Schema.Types.Mixed
    },
    accessCount: {
      type: Number,
      default: 0
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    },
    tags: [{
      type: String,
      index: true
    }]
  },
  {
    timestamps: true,
    collection: 'memory_entries'
  }
);

// Compound indexes
MemoryEntrySchema.index({ type: 1, key: 1 });
MemoryEntrySchema.index({ 'metadata.domain': 1, type: 1 });
MemoryEntrySchema.index({ tags: 1 });
MemoryEntrySchema.index({ createdAt: -1 });
MemoryEntrySchema.index({ services: 1 }); // ✅ NEW INDEX

// Methods
MemoryEntrySchema.methods.incrementAccess = async function(this: IMemoryEntry): Promise<void> {
  this.accessCount += 1;
  this.lastAccessed = new Date();
  await this.save();
};

MemoryEntrySchema.methods.updateEmbedding = async function(
  this: IMemoryEntry,
  embedding: number[]
): Promise<void> {
  this.embedding = embedding;
  await this.save();
};

// ✅ NEW METHOD: Update services
MemoryEntrySchema.methods.updateServices = async function(
  this: IMemoryEntry,
  services: string[]
): Promise<void> {
  this.services = services;
  await this.save();
};

// Statics
MemoryEntrySchema.statics.findByType = function(type: string, limit: number = 100) {
  return this.find({ type })
    .sort({ accessCount: -1, lastAccessed: -1 })
    .limit(limit);
};

MemoryEntrySchema.statics.findByDomain = function(domain: string, type?: string) {
  const query: any = { 'metadata.domain': domain };
  if (type) {
    query.type = type;
  }
  return this.find(query).sort({ createdAt: -1 });
};

MemoryEntrySchema.statics.findByTags = function(tags: string[]) {
  return this.find({ tags: { $in: tags } });
};

MemoryEntrySchema.statics.findSimilar = async function(
  embedding: number[],
  type?: string,
  limit: number = 10
) {
  // This would use vector similarity search
  // For now, we'll use a simple approach
  const query: any = {};
  if (type) {
    query.type = type;
  }
  
  // In production, this would use $vectorSearch or similar
  return this.find(query)
    .sort({ accessCount: -1 })
    .limit(limit);
};

MemoryEntrySchema.statics.getSuccessPatterns = function(domain?: string) {
  const query: any = { 
    type: 'scraping_pattern',
    'metadata.success': true 
  };
  if (domain) {
    query['metadata.domain'] = domain;
  }
  return this.find(query)
    .sort({ 'metadata.confidence': -1, accessCount: -1 })
    .limit(20);
};

MemoryEntrySchema.statics.getFailedSelectors = function(domain?: string) {
  const query: any = { 
    type: 'selector',
    'metadata.success': false 
  };
  if (domain) {
    query['metadata.domain'] = domain;
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(20);
};

// ✅ NEW STATIC METHOD: Find by service
MemoryEntrySchema.statics.findByService = function(service: string) {
  return this.find({ 
    services: { $in: [service] },
    type: 'scraping_pattern'
  })
    .sort({ createdAt: -1, accessCount: -1 })
    .limit(50);
};

// ✅ NEW STATIC METHOD: Get top services
MemoryEntrySchema.statics.getTopServices = async function(limit: number = 10) {
  const result = await this.aggregate([
    { $match: { type: 'scraping_pattern', services: { $exists: true, $ne: [] } } },
    { $unwind: '$services' },
    { $group: { _id: '$services', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, service: '$_id', count: 1 } }
  ]);
  
  return result;
};

// ✅ Export with both instance and static types
export const MemoryEntry = mongoose.model<IMemoryEntry, IMemoryEntryModel>('MemoryEntry', MemoryEntrySchema);