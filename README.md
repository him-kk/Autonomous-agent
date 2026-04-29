# Autonomous AI Web Data Extraction Agent

A production-grade, autonomous web data extraction system built with LangGraph architecture. This agent uses AI-powered planning, multi-step reasoning, and self-improving capabilities to extract structured data from websites, marketplaces, and online platforms.

## Features

### Core Capabilities
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
- **User-Agent Rotation**: Stealth browsing capabilities
- **Real-time Updates**: WebSocket-based progress streaming

## Architecture

```
User Input → Planner Node → Search Node → Relevance Filter → Scraper Node
    ↓              ↓              ↓               ↓              ↓
  Output ← Analytics ← Validator ← Cleaner ← Memory Store
```

### Node Details

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

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Agent Framework**: LangGraph, LangChain.js
- **AI/LLM**: OpenAI GPT-4o (selectable via `LLM_PROVIDER`)
- **Scraping**: Playwright, Puppeteer, Cheerio
- **Database**: MongoDB, Redis
- **Vector DB**: Chroma, Pinecone
- **Queue**: BullMQ
- **Monitoring**: Winston, Sentry

## Quick Start

### Prerequisites
- Node.js 20+
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
npm install
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
npm run dev
```

### Using Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## API Usage

### Authentication

Register a new user:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'
```

Login to get API key:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

### Start Scraping Job

```bash
curl -X POST http://localhost:3000/api/v1/scrape \
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
curl http://localhost:3000/api/v1/scrape/jobs/{jobId} \
  -H "Authorization: Bearer your-jwt-token"
```

### Export Results

```bash
# Export as JSON
curl http://localhost:3000/api/v1/export/{jobId}/json \
  -H "Authorization: Bearer your-jwt-token" \
  --output result.json

# Export as CSV
curl http://localhost:3000/api/v1/export/{jobId}/csv \
  -H "Authorization: Bearer your-jwt-token" \
  --output result.csv
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `LLM_PROVIDER` | LLM provider to use | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | Required when `LLM_PROVIDER=openai` |
| `OPENAI_MODEL` | OpenAI model | `gpt-4o` |
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

## WebSocket API

Connect to WebSocket for real-time updates:

```javascript
const socket = io('ws://localhost:3000');

socket.emit('authenticate', 'your-jwt-token');

socket.emit('start-scraping', {
  query: 'Digital marketing agencies',
  options: { maxResults: 20 }
});

socket.on('progress', (data) => {
  console.log('Progress:', data.progress);
});

socket.on('completed', (data) => {
  console.log('Result:', data.result);
});
```

## Development

### Project Structure

```
src/
├── nodes/           # LangGraph nodes
├── graph/           # Graph orchestrator
├── routes/          # API routes
├── services/        # Business logic
├── models/          # Database models
├── middleware/      # Express middleware
├── utils/           # Utilities
├── types/           # TypeScript types
└── config/          # Configuration
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
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

### Kubernetes

See `k8s/` directory for Kubernetes manifests.

## Monitoring

### Health Checks

- `/api/v1/health` - Basic health
- `/api/v1/health/detailed` - Detailed status
- `/api/v1/health/ready` - Readiness probe
- `/api/v1/health/live` - Liveness probe
- `/api/v1/health/metrics` - Prometheus metrics

### Logging

Logs are written to:
- `logs/combined-YYYY-MM-DD.log`
- `logs/error-YYYY-MM-DD.log`
- `logs/scraping-YYYY-MM-DD.log`

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request


