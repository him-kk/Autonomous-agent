// ============================================
// Planner Node - LLM-Driven Search Strategy Generation
// ============================================

import { llmService } from '@/services/llm.js';
import { plannerLogger as logger } from '@/utils/logger.js';
import { 
  AgentState, 
  ExecutionPlan, 
  PlannerInput, 
  PlannerOutput,
  ScrapingStrategy 
} from '@/types/index.js';
import { MemoryEntry } from '@/models/Memory.js';

// Prompt templates
const PLANNER_SYSTEM_PROMPT = `You are an expert web scraping strategist and data extraction planner. 
Your role is to analyze user queries and create comprehensive scraping strategies.

You must:
1. Understand the user's data extraction goal
2. Generate effective search queries
3. Identify target websites and marketplaces
4. Define data points to extract
5. Choose the optimal scraping approach

Respond with a detailed JSON plan including:
- goals: Array of extraction objectives
- searchQueries: Array of search queries to use
- targetSites: Array of website types to target
- dataPoints: Array of specific data fields to extract
- estimatedSteps: Estimated number of steps
- strategy: Object with approach, depth, priority, and optional selectors`;

const PLANNER_USER_PROMPT_TEMPLATE = `Analyze the following user query and create a comprehensive scraping plan:

User Query: "{query}"

Context:
- Previous similar queries: {previousQueries}
- Successful patterns from memory: {memoryPatterns}
- User preferences: {userPreferences}

Create a detailed plan that maximizes data extraction success.`;

export class PlannerNode {
  private nodeName = 'PlannerNode';

  async invoke(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('PlannerNode invoked', { query: state.query, sessionId: state.sessionId });
    
    const startTime = Date.now();
    
    try {
      // Update status
      state.status = 'planning';
      state.currentStep = 0;

      // Retrieve memory insights
      const memoryPatterns = await this.retrieveMemoryPatterns(state.query);
      
      // Generate plan
      const plan = await this.generatePlan(state.query, memoryPatterns);
      
      // Update state
      state.plan = plan;
      state.searchQueries = plan.searchQueries;
      
      logger.info('Plan generated successfully', {
        query: state.query,
        goals: plan.goals.length,
        searchQueries: plan.searchQueries.length,
        estimatedSteps: plan.estimatedSteps,
        duration: Date.now() - startTime
      });

      return { 
        plan, 
        searchQueries: plan.searchQueries,
        status: 'searching' 
      };
    } catch (error) {
      logger.error('PlannerNode error:', error);
      state.errors.push({
        node: this.nodeName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: true
      });
      throw error;
    }
  }

  private async retrieveMemoryPatterns(query: string): Promise<any[]> {
    try {
      // Search for similar successful patterns in memory
      const patterns = await MemoryEntry.find({
        type: { $in: ['scraping_pattern', 'strategy', 'success'] },
        'metadata.query': { $regex: query.split(' ').join('|'), $options: 'i' }
      })
      .sort({ 'metadata.confidence': -1, accessCount: -1 })
      .limit(5);

      return patterns.map(p => ({
        key: p.key,
        value: p.value,
        confidence: p.metadata.confidence
      }));
    } catch (error) {
      logger.warn('Failed to retrieve memory patterns:', error);
      return [];
    }
  }

  private async generatePlan(query: string, memoryPatterns: any[]): Promise<ExecutionPlan> {
    const prompt = PLANNER_USER_PROMPT_TEMPLATE
      .replace('{query}', query)
      .replace('{previousQueries}', '[]')
      .replace('{memoryPatterns}', JSON.stringify(memoryPatterns, null, 2))
      .replace('{userPreferences}', JSON.stringify({}));

    const response = await llmService.generateJSON<ExecutionPlan>(prompt, {
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      temperature: 0.3
    });

    // Validate and enhance the plan
    const plan = this.validateAndEnhancePlan(response.content);
    
    return plan;
  }

  private validateAndEnhancePlan(plan: any): ExecutionPlan {
    // Ensure all required fields exist
    const validatedPlan: ExecutionPlan = {
      goals: Array.isArray(plan.goals) ? plan.goals : [plan.goals || 'Extract relevant data'],
      searchQueries: Array.isArray(plan.searchQueries) ? plan.searchQueries : [plan.searchQueries || ''],
      targetSites: Array.isArray(plan.targetSites) ? plan.targetSites : [],
      dataPoints: Array.isArray(plan.dataPoints) ? plan.dataPoints : [],
      estimatedSteps: plan.estimatedSteps || 10,
      strategy: this.validateStrategy(plan.strategy)
    };

    // Add default search queries if none provided
    if (validatedPlan.searchQueries.length === 0) {
      validatedPlan.searchQueries = [plan.goals?.[0] || 'data extraction'];
    }

    return validatedPlan;
  }

  private validateStrategy(strategy: any): ScrapingStrategy {
    return {
      approach: ['single', 'recursive', 'multi-source'].includes(strategy?.approach) 
        ? strategy.approach 
        : 'multi-source',
      depth: Math.min(Math.max(strategy?.depth || 2, 1), 10),
      priority: ['speed', 'accuracy', 'comprehensive'].includes(strategy?.priority)
        ? strategy.priority
        : 'accuracy',
      selectors: strategy?.selectors || {}
    };
  }

  // Alternative planning method for complex queries
  async generateAdvancedPlan(input: PlannerInput): Promise<PlannerOutput> {
    const { query, userPreferences, previousPlans } = input;

    const systemPrompt = `${PLANNER_SYSTEM_PROMPT}

For complex queries, consider:
1. Multi-step extraction workflows
2. Recursive crawling for discovery
3. Competitor analysis patterns
4. Dynamic content handling
5. Rate limiting and ethical considerations`;

    const userPrompt = `Create an advanced scraping plan for:

Query: "${query}"

User Preferences: ${JSON.stringify(userPreferences, null, 2)}
Previous Plans: ${JSON.stringify(previousPlans?.map(p => ({
  goals: p.goals,
  strategy: p.strategy
})) || [], null, 2)}

Generate a sophisticated plan with fallback strategies.`;

    const response = await llmService.generateJSON<ExecutionPlan>(userPrompt, {
      systemPrompt,
      temperature: 0.2
    });

    return {
      plan: this.validateAndEnhancePlan(response.content),
      reasoning: `Generated plan with ${response.content.goals?.length || 0} goals and ${response.content.searchQueries?.length || 0} search queries.`
    };
  }

  // Self-improvement: Learn from execution results
  async learnFromExecution(
    originalPlan: ExecutionPlan,
    executionResult: { success: boolean; issues: string[]; improvements: string[] }
  ): Promise<void> {
    try {
      const memoryEntry = new MemoryEntry({
        type: 'strategy',
        key: `plan_${Date.now()}`,
        value: {
          originalPlan,
          executionResult,
          lessons: executionResult.improvements
        },
        metadata: {
          success: executionResult.success,
          confidence: executionResult.success ? 0.9 : 0.5
        },
        tags: ['planner', 'strategy', executionResult.success ? 'success' : 'failure']
      });

      await memoryEntry.save();
      logger.info('Planner learned from execution', { success: executionResult.success });
    } catch (error) {
      logger.error('Failed to save learning:', error);
    }
  }
}

export const plannerNode = new PlannerNode();
