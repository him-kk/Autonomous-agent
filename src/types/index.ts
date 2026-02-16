// ============================================
// Core Types for Autonomous AI Web Data Extraction Agent
// UPDATED WITH SERVICES FIELD
// ============================================

import { z } from 'zod';

// ============================================
// Agent State Types (LangGraph)
// ============================================

export interface AgentState {
  // Input
  query: string;
  userId: string;
  sessionId: string;
  
  // Planning
  plan: ExecutionPlan;
  currentStep: number;
  
  // Search & Discovery
  searchQueries: string[];
  discoveredUrls: DiscoveredUrl[];
  
  // Scraping
  scrapedData: ScrapedItem[];
  failedUrls: FailedUrl[];
  
  // Processing
  cleanedData: CleanedItem[];
  validationResults: ValidationResult[];
  
  // Memory & Learning
  memoryInsights: MemoryInsight[];
  
  // Analytics
  analytics: AnalyticsData;
  
  // Services (NEW)
  savedServiceIds: string[];  // ✅ ADDED
  
  // Output
  finalOutput: FinalOutput | null;
  
  // Metadata
  startTime: Date;
  endTime: Date | null;
  status: AgentStatus;
  errors: AgentError[];
}

export interface ExecutionPlan {
  goals: string[];
  searchQueries: string[];
  targetSites: string[];
  dataPoints: string[];
  estimatedSteps: number;
  strategy: ScrapingStrategy;
}

export interface ScrapingStrategy {
  approach: 'single' | 'recursive' | 'multi-source';
  depth: number;
  priority: 'speed' | 'accuracy' | 'comprehensive';
  selectors?: Record<string, string>;
}

export interface DiscoveredUrl {
  url: string;
  source: string;
  relevanceScore: number;
  category: SourceCategory;
  discoveredAt: Date;
  metadata?: Record<string, any>;
}

export interface ScrapedItem {
  id: string;
  url: string;
  rawHtml: string;
  extractedData: Record<string, any>;
  timestamp: Date;
  scrapingMethod: string;
  success: boolean;
  metadata: ScrapingMetadata;
}

export interface ScrapingMetadata {
  loadTime: number;
  retryCount: number;
  proxyUsed?: string;
  userAgent: string;
  screenshotPath?: string;
  domSelector: string;
}

export interface FailedUrl {
  url: string;
  error: string;
  retryCount: number;
  lastAttempt: Date;
  errorType: ErrorType;
}

export interface CleanedItem {
  id: string;
  sourceId: string;
  url: string;
  structuredData: StructuredData;
  cleaningMethod: string;
  confidence: number;
  timestamp: Date;
}

export interface StructuredData {
  entityType: string;
  fields: Record<string, any> & {
    services?: string[];
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    description?: string;
  };
  relationships: Relationship[];
  rawText: string;
}

export interface Relationship {
  type: string;
  target: string;
  confidence: number;
}

export interface ValidationResult {
  itemId: string;
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
  validatedAt: Date;
}

export interface ValidationIssue {
  field: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryInsight {
  type: 'pattern' | 'strategy' | 'failure' | 'success';
  description: string;
  confidence: number;
  relatedUrls: string[];
  createdAt: Date;
}

export interface AnalyticsData {
  totalSources: number;
  successfulScrapes: number;
  failedScrapes: number;
  averageLoadTime: number;
  dataQualityScore: number;
  topServices: ServiceCount[];
  priceRanges: PriceRange[];
  trends: Trend[];
  insights: string[];
}

export interface ServiceCount {
  service: string;
  count: number;
  percentage: number;
}

export interface PriceRange {
  category: string;
  min: number;
  max: number;
  avg: number;
  currency: string;
}

export interface Trend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change: number;
  period: string;
}

export interface FinalOutput {
  query: string;
  totalSources: number;
  marketplaces: number;
  agencies: number;
  topServices: string[];
  avgPricing: string;
  detailedData: any[];
  insights: InsightData;
  generatedAt: Date;
  exportFormats: ExportFormat[];
}

export interface InsightData {
  topServicesTrending: string[];
  marketplaceOpportunities: string[];
  competitiveAnalysis: string;
  marketTrends: string[];
}

export interface ExportFormat {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  url: string;
  size: number;
}

export interface AgentError {
  node: string;
  error: string;
  timestamp: Date;
  recoverable: boolean;
}

// ============================================
// Enums
// ============================================

export type AgentStatus = 
  | 'idle' 
  | 'planning' 
  | 'searching' 
  | 'filtering' 
  | 'scraping' 
  | 'cleaning' 
  | 'validating' 
  | 'analyzing' 
  | 'completed' 
  | 'failed';

export type SourceCategory = 
  | 'marketplace' 
  | 'agency' 
  | 'blog' 
  | 'news' 
  | 'directory' 
  | 'social' 
  | 'forum' 
  | 'unknown';

export type ErrorType = 
  | 'network' 
  | 'timeout' 
  | 'blocked' 
  | 'parse' 
  | 'validation' 
  | 'unknown';

// ============================================
// Node Input/Output Types
// ============================================

export interface PlannerInput {
  query: string;
  userPreferences?: UserPreferences;
  previousPlans?: ExecutionPlan[];
}

export interface PlannerOutput {
  plan: ExecutionPlan;
  reasoning: string;
}

export interface SearchInput {
  queries: string[];
  maxResults?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  excludeDomains?: string[];
  includeDomains?: string[];
  dateRange?: { start: Date; end: Date };
  contentType?: string[];
}

export interface SearchOutput {
  results: SearchResult[];
  totalFound: number;
  searchTime: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rank: number;
  metadata?: Record<string, any>;
}

export interface RelevanceFilterInput {
  urls: SearchResult[];
  criteria: RelevanceCriteria;
}

export interface RelevanceCriteria {
  targetCategories: SourceCategory[];
  minRelevanceScore: number;
  excludePatterns?: string[];
}

export interface RelevanceFilterOutput {
  relevantUrls: DiscoveredUrl[];
  rejectedUrls: DiscoveredUrl[];
  classificationTime: number;
}

export interface ScraperInput {
  urls: DiscoveredUrl[];
  config: ScrapingConfig;
}

export interface ScrapingConfig {
  headless: boolean;
  timeout: number;
  retryAttempts: number;
  delayMs: number;
  useProxy: boolean;
  extractSelectors?: Record<string, string>;
  scrollToBottom: boolean;
  waitForDynamic: boolean;
  captureScreenshots: boolean;
}

export interface ScraperOutput {
  scrapedItems: ScrapedItem[];
  failedUrls: FailedUrl[];
  stats: ScrapingStats;
}

export interface ScrapingStats {
  totalAttempted: number;
  successful: number;
  failed: number;
  averageTime: number;
  totalDataSize: number;
}

export interface CleanerInput {
  rawData: ScrapedItem[];
  schema: DataSchema;
}

export interface DataSchema {
  entityType: string;
  fields: SchemaField[];
  requiredFields: string[];
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  description: string;
  validation?: z.ZodType<any>;
}

export interface CleanerOutput {
  cleanedItems: CleanedItem[];
  cleaningStats: CleaningStats;
}

export interface CleaningStats {
  totalProcessed: number;
  successfullyCleaned: number;
  failedCleaning: number;
  averageConfidence: number;
}

export interface ValidatorInput {
  items: CleanedItem[];
  rules: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'format' | 'range' | 'unique' | 'custom';
  params?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidatorOutput {
  results: ValidationResult[];
  overallScore: number;
  retryNeeded: boolean;
  urlsToRetry: string[];
}

export interface AnalyticsInput {
  validatedData: CleanedItem[];
  query: string;
  historicalData?: any[];
}

export interface AnalyticsOutput {
  analytics: AnalyticsData;
  report: string;
  visualizations: Visualization[];
}

export interface Visualization {
  type: 'chart' | 'table' | 'graph' | 'map';
  title: string;
  data: any;
  config: Record<string, any>;
}

// ============================================
// Memory & Learning Types
// ============================================

export interface MemoryEntry {
  id: string;
  type: 'scraping_pattern' | 'selector' | 'failure' | 'success' | 'insight' | 'strategy';
  key: string;
  value: any;
  services: string[];
  embedding: number[];
  metadata: MemoryMetadata;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface MemoryMetadata {
  url?: string;
  domain?: string;
  query?: string;
  success: boolean;
  confidence: number;
}

export interface LearningUpdate {
  pattern: string;
  outcome: 'success' | 'failure';
  adjustment: string;
  impact: number;
}

// ============================================
// User & Configuration Types
// ============================================

export interface UserPreferences {
  outputFormat: 'json' | 'csv' | 'xlsx' | 'pdf';
  maxResults: number;
  depth: number;
  priority: 'speed' | 'accuracy' | 'comprehensive';
  notifications: boolean;
  language: string;
}

export interface ScrapingJob {
  id: string;
  userId: string;
  query: string;
  status: AgentStatus;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: FinalOutput;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: Date;
  };
}

// ============================================
// Multi-Modal Types
// ============================================

export interface ImageData {
  url: string;
  base64?: string;
  localPath?: string;
  ocrText?: string;
  labels?: string[];
  confidence: number;
}

export interface PdfData {
  url: string;
  pages: number;
  extractedText: string;
  metadata: Record<string, any>;
}

export interface VideoData {
  url: string;
  duration: number;
  transcript?: string;
  frames: ImageData[];
}

// ============================================
// Zod Schemas for Validation
// ============================================

export const AgentStateSchema = z.object({
  query: z.string().min(1),
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  plan: z.any(),
  currentStep: z.number().min(0),
  searchQueries: z.array(z.string()),
  discoveredUrls: z.array(z.any()),
  scrapedData: z.array(z.any()),
  failedUrls: z.array(z.any()),
  cleanedData: z.array(z.any()),
  validationResults: z.array(z.any()),
  memoryInsights: z.array(z.any()),
  analytics: z.any(),
  savedServiceIds: z.array(z.string()),  // ✅ ADDED
  finalOutput: z.any().nullable(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  status: z.enum(['idle', 'planning', 'searching', 'filtering', 'scraping', 'cleaning', 'validating', 'analyzing', 'completed', 'failed']),
  errors: z.array(z.any())
});

export const ExecutionPlanSchema = z.object({
  goals: z.array(z.string()),
  searchQueries: z.array(z.string()),
  targetSites: z.array(z.string()),
  dataPoints: z.array(z.string()),
  estimatedSteps: z.number().positive(),
  strategy: z.object({
    approach: z.enum(['single', 'recursive', 'multi-source']),
    depth: z.number().min(0).max(10),
    priority: z.enum(['speed', 'accuracy', 'comprehensive']),
    selectors: z.record(z.string()).optional()
  })
});

export const ServiceCountSchema = z.object({
  service: z.string(),
  count: z.number().int().positive(),
  percentage: z.number().min(0).max(100)
});

export const StructuredDataSchema = z.object({
  entityType: z.string(),
  fields: z.record(z.any()).and(
    z.object({
      services: z.array(z.string()).optional()
    })
  ),
  relationships: z.array(z.any()),
  rawText: z.string()
});

export const MemoryEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['scraping_pattern', 'selector', 'failure', 'success', 'insight', 'strategy']),
  key: z.string(),
  value: z.any(),
  services: z.array(z.string()),
  embedding: z.array(z.number()),
  metadata: z.object({
    url: z.string().optional(),
    domain: z.string().optional(),
    query: z.string().optional(),
    success: z.boolean(),
    confidence: z.number().min(0).max(1)
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  accessCount: z.number().int().nonnegative(),
  lastAccessed: z.date()
});