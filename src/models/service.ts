// ============================================
// Service Model - Main Service Collection
// ============================================

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IService extends Document {
  service_id: string;
  agencyName: string;
  websiteURL: string;
  logo?: string;

  location: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    timezone?: string;
    coordinates?: { lat: number; lng: number };
  };

  contactDetails: {
    email?: string;
    phone?: string;
    linkedIn?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };

  services: {
    categories: Array<{
      name: string;
      subcategories: string[];
      isPrimary: boolean;
      description?: string;
    }>;
    rawServices: string[];
    normalizedServices: string[];
  };

  companyInfo: {
    yearFounded?: number;
    employees?: {
      count?: number;
      range?: string;
      lastUpdated?: Date;
    };
    revenue?: {
      amount?: number;
      currency?: string;
      year?: number;
      range?: string;
    };
    certifications?: Array<{
      name: string;
      level?: string;
      verifiedDate?: Date;
    }>;
    industryFocus?: string[];
    companySize?: string;
  };

  notableClients?: Array<{
    name: string;
    logo?: string;
    industry?: string;
    projectType?: string;
    duration?: string;
    featured?: boolean;
  }>;

  awards?: Array<{
    title: string;
    organization?: string;
    year?: number;
    category?: string;
    rank?: string;
    verificationURL?: string;
  }>;

  externalData: {
    overallRating: {
      average: number;
      count: number;
      distribution: {
        '5star': number;
        '4star': number;
        '3star': number;
        '2star': number;
        '1star': number;
      };
      lastCalculated?: Date;
    };
    reviewSources: Array<{
      source: string;
      sourceURL?: string;
      rating: number;
      reviewCount: number;
      lastScraped?: Date;
      verifiedReviews?: boolean;
      platformWeight?: number;
    }>;
  };

  reviews?: Array<{
    reviewId: string;
    source: string;
    sourceURL?: string;
    rating: number;
    title?: string;
    reviewText?: string;
    reviewerName?: string;
    reviewerTitle?: string;
    reviewerCompany?: string;
    verifiedPurchase?: boolean;
    helpful?: number;
    notHelpful?: number;
    date?: Date;
    lastScraped?: Date;
    sentiment?: {
      score: number;
      label: string;
      confidence: number;
    };
    aspects?: {
      quality?: number;
      communication?: number;
      timeliness?: number;
      valueForMoney?: number;
      expertise?: number;
    };
    pros?: string[];
    cons?: string[];
    projectDetails?: {
      type?: string;
      budget?: string;
      duration?: string;
    };
  }>;

  socialSentiment?: {
    twitter?: {
      mentions: number;
      positive: number;
      neutral: number;
      negative: number;
      engagement: number;
      lastScraped?: Date;
    };
    linkedIn?: {
      followers: number;
      posts: number;
      engagement: number;
      lastScraped?: Date;
    };
    facebook?: {
      likes: number;
      rating: number;
      reviewCount: number;
      lastScraped?: Date;
    };
  };

  webPresence?: {
    domainAuthority?: number;
    pageAuthority?: number;
    backlinks?: number;
    referringDomains?: number;
    organicTraffic?: number;
    lastChecked?: Date;
  };

  caseStudies?: Array<{
    title: string;
    client?: string;
    industry?: string;
    challenge?: string;
    solution?: string;
    results?: {
      metrics: Array<{
        name: string;
        value: string;
        timeframe: string;
      }>;
    };
    url?: string;
    featured?: boolean;
    publishedDate?: Date;
  }>;

  pricing?: {
    model?: string;
    hourlyRate?: { min: number; max: number; currency: string };
    projectBudget?: { min: number; max: number; currency: string };
    retainerMin?: number;
    hasFreeTrial?: boolean;
    hasFreeConsultation?: boolean;
  };

  ranking: {
    overallScore: number;
    rank?: number;
    tier?: string;
    lastCalculated?: Date;
    scoreComponents: {
      externalSentiment: { score: number; contribution: number; lastUpdated?: Date };
      internalInteraction: { score: number; contribution: number };
      userFeedback: { score: number; contribution: number };
      gamification: { score: number; contribution: number };
      recency: { score: number; contribution: number };
    };
    historicalScores?: Array<{
      date: Date;
      score: number;
      rank: number;
    }>;
  };

  platformMetrics: {
    impressions: number;
    clicks: number;
    pageViews: number;
    avgTimeOnPage?: number;
    bookmarks: number;
    shares: number;
    comparisons: number;
    conversions: number;
    lastReset?: Date;
  };

  scrapingMetadata: {
    sourceURL: string;
    sourceDomain: string;
    scrapingPattern: string;
    confidence: number;
    success: boolean;
    lastScraped?: Date;
    scrapedBy?: string;
    dataCompleteness?: number;
    needsReview?: boolean;
    errors?: string[];
  };

  categories: {
    primary: string;
    secondary: string[];
    specializations?: string[];
    targetMarket?: string;
    minProjectSize?: number;
    teamSize?: string;
  };

  tags: string[];

  searchKeywords?: Array<{
    keyword: string;
    weight: number;
  }>;

  status: {
    isActive: boolean;
    isVerified: boolean;
    isFeatured: boolean;
    claimedByOwner: boolean;
    lastVerified?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  lastDataRefresh?: Date;
  nextScrapeScheduled?: Date;

  version: {
    schemaVersion: string;
    dataVersion: number;
  };
}

interface IServiceModel extends Model<IService> {
  findByServiceId(serviceId: string): Promise<IService | null>;
  getTopRanked(limit?: number): Promise<IService[]>;
  findByCategory(category: string): Promise<IService[]>;
  findByLocation(city: string, country?: string): Promise<IService[]>;
  findByServices(services: string[]): Promise<IService[]>;
  updateRanking(serviceId: string, rankingData: any): Promise<IService | null>;
}

const ServiceSchema = new Schema(
  {
    service_id: { type: String, required: true, unique: true, index: true },
    agencyName: { type: String, required: true, index: true },
    websiteURL: { type: String, required: true },
    logo: String,

    location: {
      country: String,
      state: String,
      city: { type: String, index: true },
      address: String,
      timezone: String,
      coordinates: { lat: Number, lng: Number }
    },

    contactDetails: {
      email: String,
      phone: String,
      linkedIn: String,
      twitter: String,
      facebook: String,
      instagram: String
    },

    services: {
      categories: [{
        name: { type: String, required: true },
        subcategories: [String],
        isPrimary: { type: Boolean, default: false },
        description: String
      }],
      rawServices: { type: [String], default: [] },
      normalizedServices: { type: [String], default: [], index: true }
    },

    companyInfo: {
      yearFounded: Number,
      employees: {
        count: Number,
        range: String,
        lastUpdated: Date
      },
      revenue: {
        amount: Number,
        currency: String,
        year: Number,
        range: String
      },
      certifications: [{
        name: String,
        level: String,
        verifiedDate: Date
      }],
      industryFocus: [String],
      companySize: String
    },

    notableClients: [{
      name: String,
      logo: String,
      industry: String,
      projectType: String,
      duration: String,
      featured: Boolean
    }],

    awards: [{
      title: String,
      organization: String,
      year: Number,
      category: String,
      rank: String,
      verificationURL: String
    }],

    externalData: {
      overallRating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
        distribution: {
          '5star': { type: Number, default: 0 },
          '4star': { type: Number, default: 0 },
          '3star': { type: Number, default: 0 },
          '2star': { type: Number, default: 0 },
          '1star': { type: Number, default: 0 }
        },
        lastCalculated: Date
      },
      reviewSources: [{
        source: { type: String, required: true },
        sourceURL: String,
        rating: { type: Number, min: 0, max: 5 },
        reviewCount: { type: Number, default: 0 },
        lastScraped: Date,
        verifiedReviews: Boolean,
        platformWeight: Number
      }]
    },

    reviews: [{
      reviewId: { type: String, required: true },
      source: String,
      sourceURL: String,
      rating: { type: Number, min: 0, max: 5 },
      title: String,
      reviewText: String,
      reviewerName: String,
      reviewerTitle: String,
      reviewerCompany: String,
      verifiedPurchase: Boolean,
      helpful: Number,
      notHelpful: Number,
      date: Date,
      lastScraped: Date,
      sentiment: {
        score: { type: Number, min: -1, max: 1 },
        label: { type: String, enum: ['positive', 'neutral', 'negative'] },
        confidence: { type: Number, min: 0, max: 1 }
      },
      aspects: {
        quality: Number,
        communication: Number,
        timeliness: Number,
        valueForMoney: Number,
        expertise: Number
      },
      pros: [String],
      cons: [String],
      projectDetails: {
        type: String,
        budget: String,
        duration: String
      }
    }],

    socialSentiment: {
      twitter: {
        mentions: { type: Number, default: 0 },
        positive: { type: Number, default: 0 },
        neutral: { type: Number, default: 0 },
        negative: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
        lastScraped: Date
      },
      linkedIn: {
        followers: { type: Number, default: 0 },
        posts: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
        lastScraped: Date
      },
      facebook: {
        likes: { type: Number, default: 0 },
        rating: { type: Number, default: 0 },
        reviewCount: { type: Number, default: 0 },
        lastScraped: Date
      }
    },

    webPresence: {
      domainAuthority: Number,
      pageAuthority: Number,
      backlinks: Number,
      referringDomains: Number,
      organicTraffic: Number,
      lastChecked: Date
    },

    caseStudies: [{
      title: String,
      client: String,
      industry: String,
      challenge: String,
      solution: String,
      results: {
        metrics: [{
          name: String,
          value: String,
          timeframe: String
        }]
      },
      url: String,
      featured: Boolean,
      publishedDate: Date
    }],

    pricing: {
      model: String,
      hourlyRate: { min: Number, max: Number, currency: String },
      projectBudget: { min: Number, max: Number, currency: String },
      retainerMin: Number,
      hasFreeTrial: Boolean,
      hasFreeConsultation: Boolean
    },

    ranking: {
      overallScore: { type: Number, default: 0, min: 0, max: 100, index: -1 },
      rank: Number,
      tier: String,
      lastCalculated: Date,
      scoreComponents: {
        externalSentiment: { score: Number, contribution: Number, lastUpdated: Date },
        internalInteraction: { score: Number, contribution: Number },
        userFeedback: { score: Number, contribution: Number },
        gamification: { score: Number, contribution: Number },
        recency: { score: Number, contribution: Number }
      },
      historicalScores: [{
        date: Date,
        score: Number,
        rank: Number
      }]
    },

    platformMetrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      pageViews: { type: Number, default: 0 },
      avgTimeOnPage: Number,
      bookmarks: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      comparisons: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      lastReset: Date
    },

    // REPLACE WITH THIS:
scrapingMetadata: {
  sourceURL: { type: String, required: true },
  sourceDomain: { type: String, required: true },
  scrapingPattern: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 100 },  // ✅ Changed max from 1 to 100
  success: { type: Boolean, default: true },
  lastScraped: Date,
  scrapedBy: String,
  dataCompleteness: Number,
  needsReview: Boolean,
  errors: [String]
},

    categories: {
      primary: { type: String, required: true, index: true },
      secondary: { type: [String], default: [] },
      specializations: [String],
      targetMarket: String,
      minProjectSize: Number,
      teamSize: String
    },

    tags: { type: [String], default: [], index: true },

    searchKeywords: [{
      keyword: String,
      weight: Number
    }],

    status: {
      isActive: { type: Boolean, default: true, index: true },
      isVerified: { type: Boolean, default: false },
      isFeatured: { type: Boolean, default: false },
      claimedByOwner: { type: Boolean, default: false },
      lastVerified: Date
    },

    lastAccessed: Date,
    lastDataRefresh: Date,
    nextScrapeScheduled: Date,

    version: {
      schemaVersion: { type: String, default: '1.0' },
      dataVersion: { type: Number, default: 1 }
    }
  },
  {
    timestamps: true,
    collection: 'services'
  }
);

// Indexes
ServiceSchema.index({ 'location.city': 1, 'location.country': 1 });
ServiceSchema.index({ 'services.normalizedServices': 1 });
ServiceSchema.index({ 'ranking.overallScore': -1 });
ServiceSchema.index({ 'externalData.overallRating.average': -1 });
ServiceSchema.index({ 'categories.primary': 1, 'ranking.overallScore': -1 });

// Static Methods
ServiceSchema.statics.findByServiceId = function(serviceId: string) {
  return this.findOne({ service_id: serviceId, 'status.isActive': true });
};

ServiceSchema.statics.getTopRanked = function(limit: number = 50) {
  return this.find({ 'status.isActive': true })
    .sort({ 'ranking.overallScore': -1 })
    .limit(limit);
};

ServiceSchema.statics.findByCategory = function(category: string) {
  return this.find({ 
    'categories.primary': category,
    'status.isActive': true 
  }).sort({ 'ranking.overallScore': -1 });
};

ServiceSchema.statics.findByLocation = function(city: string, country?: string) {
  const query: any = { 
    'location.city': new RegExp(city, 'i'),
    'status.isActive': true 
  };
  if (country) {
    query['location.country'] = new RegExp(country, 'i');
  }
  return this.find(query).sort({ 'ranking.overallScore': -1 });
};

ServiceSchema.statics.findByServices = function(services: string[]) {
  return this.find({
    'services.normalizedServices': { $in: services },
    'status.isActive': true
  }).sort({ 'ranking.overallScore': -1 });
};

ServiceSchema.statics.updateRanking = function(serviceId: string, rankingData: any) {
  return this.findOneAndUpdate(
    { service_id: serviceId },
    { 
      $set: { 'ranking': rankingData },
      $push: { 
        'ranking.historicalScores': {
          date: new Date(),
          score: rankingData.overallScore,
          rank: rankingData.rank
        }
      }
    },
    { new: true }
  );
};

export const Service = mongoose.model<IService, IServiceModel>('Service', ServiceSchema);