// ============================================
// Planner Node Tests
// ============================================

import { plannerNode } from '@/nodes/planner.ts';
import { AgentState } from '@/types/index.ts';

describe('PlannerNode', () => {
  const createMockState = (query: string): AgentState => ({
    query,
    userId: 'test-user',
    sessionId: 'test-session',
    plan: null as any,
    currentStep: 0,
    searchQueries: [],
    discoveredUrls: [],
    scrapedData: [],
    failedUrls: [],
    cleanedData: [],
    validationResults: [],
    memoryInsights: [],
    analytics: null as any,
    finalOutput: null,
    startTime: new Date(),
    endTime: null,
    status: 'idle',
    errors: []
  });

  it('should generate a plan for a valid query', async () => {
    const state = createMockState('Digital marketing agencies in India');
    
    const result = await plannerNode.invoke(state);
    
    expect(result.plan).toBeDefined();
    expect(result.searchQueries).toBeDefined();
    expect(result.status).toBe('searching');
  });

  it('should include goals in the plan', async () => {
    const state = createMockState('SEO services');
    
    const result = await plannerNode.invoke(state);
    
    expect(result.plan?.goals).toBeDefined();
    expect(result.plan?.goals.length).toBeGreaterThan(0);
  });

  it('should include search queries in the plan', async () => {
    const state = createMockState('Web development companies');
    
    const result = await plannerNode.invoke(state);
    
    expect(result.plan?.searchQueries).toBeDefined();
    expect(result.plan?.searchQueries.length).toBeGreaterThan(0);
  });

  it('should include a scraping strategy', async () => {
    const state = createMockState('Social media marketing');
    
    const result = await plannerNode.invoke(state);
    
    expect(result.plan?.strategy).toBeDefined();
    expect(result.plan?.strategy.approach).toBeDefined();
    expect(result.plan?.strategy.depth).toBeDefined();
  });
});
