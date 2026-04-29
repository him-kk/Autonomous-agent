import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']),
  port: z.number().default(3000),
  host: z.string().default('0.0.0.0'),
  apiVersion: z.string().default('v1'),

  llm: z.object({
    provider: z.enum(['openai', 'groq', 'qwen', 'deepseek', 'openclaw']).default('openai'),
    openai: z.object({
      apiKey: z.string(),
      model: z.string().default('gpt-4o'),
      temperature: z.number().default(0.3),
      maxTokens: z.number().default(4000)
    }),
    groq: z.object({
      apiKey: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional()
    }).optional(),
    qwen: z.object({
      apiKey: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional()
    }).optional(),
    deepseek: z.object({
      apiKey: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional()
    }).optional(),
    openclaw: z.object({
      apiKey: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional()
    }).optional()
  }),

  langgraph: z.object({
    apiKey: z.string().optional(),
    project: z.string().default('autonomous-ai-agent'),
    tracing: z.boolean().default(true),
    smithEndpoint: z.string().optional(),
    smithApiKey: z.string().optional()
  }),

  mongodb: z.object({
    uri: z.string(),
    dbName: z.string().default('autonomous_ai_agent')
  }),

  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    password: z.string().optional(),
    db: z.number().default(0)
  }),

  vectorDb: z.object({
    provider: z.enum(['chroma', 'pinecone']).default('chroma'),
    chroma: z.object({
      url: z.string().default('http://localhost:8000'),
      collection: z.string().default('agent_memory')
    }),
    pinecone: z.object({
      apiKey: z.string().optional(),
      environment: z.string().optional(),
      index: z.string().optional()
    })
  }),

  search: z.object({
    serpapiKey: z.string().optional(),
    bingApiKey: z.string().optional(),
    googleApiKey: z.string().optional(),
    googleCx: z.string().optional(),
    duckduckgoEnabled: z.boolean().default(true)
  }),

  scraping: z.object({
    headless: z.boolean().default(true),
    timeout: z.number().default(30000),
    concurrency: z.number().default(5),
    retryAttempts: z.number().default(3),
    delayMs: z.number().default(2000),
    proxyRotationEnabled: z.boolean().default(false),
    proxyList: z.array(z.string()).default([]),
    userAgentRotationEnabled: z.boolean().default(true)
  }),

  rateLimit: z.object({
    windowMs: z.number().default(60000),
    maxRequests: z.number().default(100)
  }),

  auth: z.object({
    jwtSecret: z.string(),
    jwtExpiresIn: z.string().default('7d'),
    bcryptRounds: z.number().default(12)
  }),

  storage: z.object({
    uploadDir: z.string().default('./uploads'),
    maxFileSize: z.number().default(10485760)
  }),

  notifications: z.object({
    slackWebhookUrl: z.string().optional(),
    discordWebhookUrl: z.string().optional(),
    email: z.object({
      smtpHost: z.string().optional(),
      smtpPort: z.number().default(587),
      smtpUser: z.string().optional(),
      smtpPass: z.string().optional(),
      from: z.string().default('noreply@autonomous-ai-agent.com')
    })
  }),                                         // ✅ removed stray provider line

  monitoring: z.object({
    sentryDsn: z.string().optional(),
    posthogApiKey: z.string().optional(),
    posthogHost: z.string().default('https://app.posthog.com')
  }),

  scheduling: z.object({
    scrapingSchedule: z.string().default('0 2 * * *'),
    analyticsSchedule: z.string().default('0 6 * * *')
  }),

  features: z.object({
    enableSelfHealing: z.boolean().default(true),
    enableMultiModal: z.boolean().default(true),
    enableMemoryLearning: z.boolean().default(true),
    enableRealTimeAnalytics: z.boolean().default(true),
    enableSlackNotifications: z.boolean().default(false),
    enableEmailNotifications: z.boolean().default(false)
  })
});

export type Config = z.infer<typeof ConfigSchema>;

const parseConfig = (): Config => {
  const config = {
    nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    apiVersion: process.env.API_VERSION || 'v1',

    llm: {
      provider: (process.env.LLM_PROVIDER as Config['llm']['provider']) || 'openai',
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o',           // ✅ was missing
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000')
      },
      groq: {                                                    // ✅ was missing
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL,
        temperature: process.env.GROQ_TEMPERATURE ? parseFloat(process.env.GROQ_TEMPERATURE) : undefined,
        maxTokens: process.env.GROQ_MAX_TOKENS ? parseInt(process.env.GROQ_MAX_TOKENS) : undefined
      },
      qwen: {                                                    // ✅ was missing
        apiKey: process.env.QWEN_API_KEY,
        model: process.env.QWEN_MODEL,
        temperature: process.env.QWEN_TEMPERATURE ? parseFloat(process.env.QWEN_TEMPERATURE) : undefined,
        maxTokens: process.env.QWEN_MAX_TOKENS ? parseInt(process.env.QWEN_MAX_TOKENS) : undefined
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL,
        temperature: process.env.DEEPSEEK_TEMPERATURE ? parseFloat(process.env.DEEPSEEK_TEMPERATURE) : undefined,
        maxTokens: process.env.DEEPSEEK_MAX_TOKENS ? parseInt(process.env.DEEPSEEK_MAX_TOKENS) : undefined
      },
      openclaw: {
        apiKey: process.env.OPENCLAW_API_KEY,
        model: process.env.OPENCLAW_MODEL,
        temperature: process.env.OPENCLAW_TEMPERATURE ? parseFloat(process.env.OPENCLAW_TEMPERATURE) : undefined,
        maxTokens: process.env.OPENCLAW_MAX_TOKENS ? parseInt(process.env.OPENCLAW_MAX_TOKENS) : undefined
      }
      // ✅ removed 'anthropic' — not in schema
    },

    langgraph: {
      apiKey: process.env.LANGGRAPH_API_KEY,
      project: process.env.LANGGRAPH_PROJECT || 'autonomous-ai-agent',
      tracing: process.env.LANGSMITH_TRACING === 'true',
      smithEndpoint: process.env.LANGSMITH_ENDPOINT,
      smithApiKey: process.env.LANGSMITH_API_KEY
    },

    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/autonomous_ai_agent',
      dbName: process.env.MONGODB_DB_NAME || 'autonomous_ai_agent'
    },

    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },

    vectorDb: {
      provider: (process.env.VECTOR_DB_PROVIDER as 'chroma' | 'pinecone') || 'chroma',
      chroma: {
        url: process.env.CHROMA_URL || 'http://localhost:8000',
        collection: process.env.CHROMA_COLLECTION || 'agent_memory'
      },
      pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT,
        index: process.env.PINECONE_INDEX
      }
    },

    search: {
      serpapiKey: process.env.SERPAPI_KEY,
      bingApiKey: process.env.BING_API_KEY,
      googleApiKey: process.env.GOOGLE_API_KEY,
      googleCx: process.env.GOOGLE_CX,
      duckduckgoEnabled: process.env.DUCKDUCKGO_ENABLED !== 'false'
    },

    scraping: {
      headless: process.env.SCRAPER_HEADLESS !== 'false',
      timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000'),
      concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '5'),
      retryAttempts: parseInt(process.env.SCRAPER_RETRY_ATTEMPTS || '3'),
      delayMs: parseInt(process.env.SCRAPER_DELAY_MS || '2000'),
      proxyRotationEnabled: process.env.PROXY_ROTATION_ENABLED === 'true',
      proxyList: process.env.PROXY_LIST?.split(',') || [],
      userAgentRotationEnabled: process.env.USER_AGENT_ROTATION_ENABLED !== 'false'
    },

    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    },

    auth: {
      jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
    },

    storage: {
      uploadDir: process.env.UPLOAD_DIR || './uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760')
    },

    notifications: {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
      email: {
        smtpHost: process.env.EMAIL_SMTP_HOST,
        smtpPort: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
        smtpUser: process.env.EMAIL_SMTP_USER,
        smtpPass: process.env.EMAIL_SMTP_PASS,
        from: process.env.EMAIL_FROM || 'noreply@autonomous-ai-agent.com'
      }
    },
    // ✅ removed 'vision' — not in schema

    monitoring: {
      sentryDsn: process.env.SENTRY_DSN,
      posthogApiKey: process.env.POSTHOG_API_KEY,
      posthogHost: process.env.POSTHOG_HOST || 'https://app.posthog.com'
    },

    scheduling: {
      scrapingSchedule: process.env.SCRAPING_SCHEDULE || '0 2 * * *',
      analyticsSchedule: process.env.ANALYTICS_SCHEDULE || '0 6 * * *'
    },

    features: {
      enableSelfHealing: process.env.ENABLE_SELF_HEALING !== 'false',
      enableMultiModal: process.env.ENABLE_MULTI_MODAL !== 'false',
      enableMemoryLearning: process.env.ENABLE_MEMORY_LEARNING !== 'false',
      enableRealTimeAnalytics: process.env.ENABLE_REAL_TIME_ANALYTICS !== 'false',
      enableSlackNotifications: process.env.ENABLE_SLACK_NOTIFICATIONS === 'true',
      enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true'
    }
  };

  return ConfigSchema.parse(config);
};

export const config = parseConfig();

export const isDevelopment = () => config.nodeEnv === 'development';
export const isProduction = () => config.nodeEnv === 'production';
export const isTest = () => config.nodeEnv === 'test';