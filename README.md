# Autonomous AI Web Data Extraction Agent

A production-grade, full-stack autonomous web data extraction system built with LangGraph architecture and a modern React frontend. This agent uses AI-powered planning, multi-step reasoning, and self-improving capabilities to extract structured data from websites, marketplaces, and online platforms.

## Overview

This project consists of two integrated parts:
- **Backend**: LangGraph-powered AI agent for autonomous web scraping
- **Frontend**: React SPA with real-time job monitoring and results visualization

## Features

### Core Agent Capabilities
- **Autonomous Planning**: LLM-driven search strategy generation
- **Multi-Source Search**: Integration with SerpAPI, Bing, Google, DuckDuckGo
- **Smart Filtering**: AI-based relevance classification
- **Dynamic Scraping**: Playwright-based content extraction with stealth mode
- **Data Cleaning**: LLM-assisted data structuring and normalization
- **Quality Validation**: Rule-based and AI-assisted validation
- **Memory & Learning**: Vector DB storage for continuous improvement
- **Real-time Analytics**: Insights and trend generation

### Advanced Features
- **Self-Healing**: Automatic retry with adjusted strategies
- **Multi-Modal Extraction**: OCR, PDF parsing, image analysis
- **Smart Scheduling**: Cron-based recurring jobs
- **Rate Limiting**: Configurable request throttling
- **Proxy Rotation**: Automatic proxy switching
- **Real-time Updates**: WebSocket-based progress streaming

### Frontend Features
- **SPA Architecture**: React Router 6 with TypeScript
- **Real-time Dashboard**: Live job progress via WebSocket
- **Results Visualization**: Data tables, charts, and export options
- **Modern UI**: TailwindCSS 3 + Radix UI components
- **Type Safety**: Shared types between client and server

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────────────────────────┐
│   React SPA     │     │                    AI Agent (Node.js)                   │
│   (Frontend)    │◄───►│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐  │
│                 │ WS  │  │ Planner │──►│ Search  │──►│ Filter  │──►│ Scraper │  │
│ - Dashboard     │     │  └─────────┘   └─────────┘   └─────────┘   └────┬────┘  │
│ - Job Monitor   │     │                                                 │       │
│ - Results View  │     │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌────▼────┐  │
└─────────────────┘     │  │Analytics│◄──│Validator│◄──│ Cleaner │◄──│  Memory │  │
                        │  └─────────┘   └─────────┘   └─────────┘   └─────────┘  │
                        └─────────────────────────────────────────────────────────┘
```

### Agent Nodes

| Node | Function | Key Features |
|------|----------|--------------|
| Planner | Search strategy generation | LLM-driven, dynamic prompts |
| Search | URL discovery | SERP APIs, multi-provider |
| Relevance Filter | Source classification | AI-based categorization |
| Scraper | Content extraction | Playwright, stealth mode |
| Cleaner | Data structuring | LLM-assisted cleaning |
| Validator | Quality assurance | Rule-based + AI validation |
| Memory | Learning storage | Vector DB, embeddings |
| Analytics | Insights generation | Trends, summaries |

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Runtime** | Node.js 20+ |
| **Language** | TypeScript |
| **Agent Framework** | LangGraph, LangChain.js |
| **AI/LLM** | OpenAI GPT-4o |
| **Scraping** | Playwright, Puppeteer, Cheerio |
| **Database** | MongoDB |
| **Cache/Queue** | Redis, BullMQ |
| **Vector DB** | Chroma, Pinecone |
| **Monitoring** | Winston, Sentry |

### Frontend
| Technology | Purpose |
|------------|---------|
| **Framework** | React 18 |
| **Router** | React Router 6 (SPA mode) |
| **Build Tool** | Vite |
| **Styling** | TailwindCSS 3 |
| **UI Components** | Radix UI |
| **Icons** | Lucide React |
| **Testing** | Vitest |
| **Package Manager** | PNPM |

## Project Structure

```
├── client/                   # React SPA frontend
│   ├── pages/                # Route components
│   │   ├── Index.tsx         # Dashboard / Home
│   │   ├── Jobs.tsx          # Job monitoring
│   │   └── Results.tsx       # Results visualization
│   ├── components/
│   │   ├── ui/               # Pre-built UI components
│   │   └── scraper/          # Scraper-specific components
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities
│   ├── types/                # Frontend types
│   ├── App.tsx               # Router setup
│   └── global.css            # TailwindCSS theme
│
├── src/                      # Backend AI Agent
│   ├── nodes/                # LangGraph nodes
│   ├── graph/                # Graph orchestrator
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── models/               # Database models
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utilities
│   ├── types/                # TypeScript types
│   └── config/               # Configuration
│
├── shared/                   # Shared types (client + server)
│   └── api.ts                # API interfaces
│
├── server/                   # Express server setup
│   └── index.ts              # Server entry point
│
├── docker-compose.yml        # Docker services
└── package.json
```

## Quick Start

### Prerequisites
- Node.js 20+
- PNPM (`npm install -g pnpm`)
- MongoDB
- Redis
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/autonomous-ai-agent.git
cd autonomous-ai-agent
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Start services with Docker:
```bash
docker-compose up -d
```

5. Run the application:
```bash
pnpm dev
```

The application will be available at:
- **Frontend**: http://localhost:8080
- **API**: http://localhost:8080/api/
- **WebSocket**: ws://localhost:8080

## Development Commands

```bash
pnpm dev        # Start dev server (client + server with hot reload)
pnpm build      # Production build (client + server)
pnpm start      # Start production server
pnpm typecheck  # TypeScript validation
pnpm test       # Run Vitest tests
pnpm lint       # Run ESLint
pnpm lint:fix   # Fix ESLint issues
```

## Frontend Development

### SPA Routing

Routes are defined in `client/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";

<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/jobs" element={<JobMonitor />} />
  <Route path="/results/:jobId" element={<ResultsView />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

### Styling

Use TailwindCSS utility classes with the `cn()` helper:

```typescript
import { cn } from "@/lib/utils";

className={cn(
  "base-classes",
  { "conditional-class": condition },
  props.className
)}
```

### Adding New Pages

1. Create component in `client/pages/MyPage.tsx`
2. Add route in `client/App.tsx`
3. Add navigation link in your layout component

## API Usage

### Authentication

Register a new user:
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'
```

Login to get API key:
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

### Start Scraping Job

```bash
curl -X POST http://localhost:8080/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "Digital marketing agencies in India",
    "options": {
      "maxResults": 50,
      "depth": 2,
      "priority": "accuracy",
      "outputFormat": "json"
    }
  }'
```

### Check Job Status

```bash
curl http://localhost:8080/api/v1/scrape/jobs/{jobId} \
  -H "Authorization: Bearer your-jwt-token"
```

### Export Results

```bash
# Export as JSON
curl http://localhost:8080/api/v1/export/{jobId}/json \
  -H "Authorization: Bearer your-jwt-token" \
  --output result.json

# Export as CSV
curl http://localhost:8080/api/v1/export/{jobId}/csv \
  -H "Authorization: Bearer your-jwt-token" \
  --output result.csv
```

## WebSocket API

Connect to WebSocket for real-time updates:

```javascript
const socket = io('ws://localhost:8080');

// Authenticate
socket.emit('authenticate', 'your-jwt-token');

// Start scraping
socket.emit('start-scraping', {
  query: 'Digital marketing agencies',
  options: { maxResults: 20 }
});

// Listen for updates
socket.on('progress', (data) => {
  console.log('Progress:', data.progress);
});

socket.on('completed', (data) => {
  console.log('Result:', data.result);
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8080` |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `MONGODB_URI` | MongoDB connection | `mongodb://localhost:27017/autonomous_ai_agent` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `SERPAPI_KEY` | SerpAPI key | Optional |
| `SCRAPER_HEADLESS` | Run browser headless | `true` |

### Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `ENABLE_SELF_HEALING` | Auto-retry failed operations | `true` |
| `ENABLE_MULTI_MODAL` | Enable OCR, PDF extraction | `true` |
| `ENABLE_MEMORY_LEARNING` | Store and learn from patterns | `true` |
| `ENABLE_REAL_TIME_ANALYTICS` | Generate insights | `true` |

## Output Format

```json
{
  "query": "Digital marketing agencies in India",
  "totalSources": 42,
  "marketplaces": 5,
  "agencies": 37,
  "topServices": ["SEO", "SMM", "PPC"],
  "avgPricing": "$1800/month",
  "detailedData": [
    {
      "name": "ABC Marketing",
      "services": ["SEO", "PPC"],
      "pricing": "$1500/month",
      "location": "Delhi",
      "website": "abcdigital.com",
      "email": "contact@abcdigital.com",
      "confidence": 92
    }
  ],
  "insights": {
    "topServicesTrending": ["SEO", "SMM"],
    "marketplaceOpportunities": ["Fiverr", "Upwork"],
    "competitiveAnalysis": "...",
    "marketTrends": ["..."]
  }
}
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production API keys
- [ ] Set up MongoDB replica set
- [ ] Configure Redis persistence
- [ ] Enable rate limiting
- [ ] Set up monitoring (Sentry)
- [ ] Configure SSL/TLS
- [ ] Set up log rotation

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Cloud Deployment

- **Frontend**: Deploy to Netlify or Vercel
- **Backend**: Deploy to Railway, Render, or AWS
- **Database**: Use MongoDB Atlas
- **Redis**: Use Redis Cloud or Upstash

See `k8s/` directory for Kubernetes manifests.

## Monitoring

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/health` | Basic health |
| `/api/v1/health/detailed` | Detailed status |
| `/api/v1/health/ready` | Readiness probe |
| `/api/v1/health/live` | Liveness probe |
| `/api/v1/health/metrics` | Prometheus metrics |

### Logging

Logs are written to:
- `logs/combined-YYYY-MM-DD.log`
- `logs/error-YYYY-MM-DD.log`
- `logs/scraping-YYYY-MM-DD.log`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

