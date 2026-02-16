// ============================================
// LangGraph Orchestrator - Main Agent Graph
// ============================================

import { StateGraph, END } from '@langchain/langgraph';
import { 
  AgentState, 
  AgentStatus,
  ExecutionPlan 
} from '@/types/index.js';
import { plannerNode } from '@/nodes/planner.js';
import { searchNode } from '@/nodes/search.js';
import { relevanceFilterNode } from '@/nodes/relevanceFilter.js';
import { scraperNode } from '@/nodes/scraper.js';
import { cleanerNode } from '@/nodes/cleaner.js';
import { validatorNode } from '@/nodes/validator.js';
import { serviceSaverNode } from '@/nodes/serviceSaver.js';  // ✅ ADDED
import { memoryNode } from '@/nodes/memory.js';
import { analyticsNode } from '@/nodes/analytics.js';
import { logger } from '@/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Graph State Channels
// ============================================

interface GraphState {
  query: string;
  userId: string;
  sessionId: string;
  plan: ExecutionPlan | null;
  currentStep: number;
  searchQueries: string[];
  discoveredUrls: any[];
  scrapedData: any[];
  failedUrls: any[];
  cleanedData: any[];
  validationResults: any[];
  memoryInsights: any[];
  analytics: any;
  savedServiceIds: string[];
  finalOutput: any;
  startTime: Date;
  endTime: Date | null;
  status: AgentStatus;
  errors: any[];
}

const defaultState: GraphState = {
  query: '',
  userId: '',
  sessionId: '',
  plan: null,
  currentStep: 0,
  searchQueries: [],
  discoveredUrls: [],
  scrapedData: [],
  failedUrls: [],
  cleanedData: [],
  validationResults: [],
  memoryInsights: [],
  analytics: null,
  savedServiceIds: [],
  finalOutput: null,
  startTime: new Date(),
  endTime: null,
  status: 'idle',
  errors: []
};

// ============================================
// Node Wrappers
// ============================================

const plannerWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return plannerNode.invoke(agentState);
};

const searchWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return searchNode.invoke(agentState);
};

const relevanceFilterWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return relevanceFilterNode.invoke(agentState);
};

const scraperWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return scraperNode.invoke(agentState);
};

const cleanerWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return cleanerNode.invoke(agentState);
};

const validatorWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return validatorNode.invoke(agentState);
};

// ✅ ADDED: Service Saver Wrapper
const serviceSaverWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return serviceSaverNode.invoke(agentState);
};

const memoryWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return memoryNode.invoke(agentState);
};

const analyticsWrapper = async (state: GraphState): Promise<Partial<GraphState>> => {
  const agentState = state as AgentState;
  return analyticsNode.invoke(agentState);
};

// ============================================
// Conditional Edges
// ============================================

const shouldRetryScraping = (state: GraphState): string => {
  // Check if we need to retry scraping based on validation results
  const validationFailures = state.validationResults.filter(
    (r: any) => !r.isValid && r.score < 50
  );
  
  if (validationFailures.length > 5 && state.currentStep < 3) {
    logger.info('Retrying scraping due to validation failures');
    return 'scrape_node';
  }
  
  return 'service_saver_node';  // ✅ CHANGED: Go to service saver instead of analytics
};

const checkForErrors = (state: GraphState): string => {
  const recentErrors = state.errors.filter(
    (e: any) => e.timestamp > new Date(Date.now() - 60000)
  );
  
  if (recentErrors.length > 5) {
    logger.error('Too many errors, terminating graph');
    return 'end';
  }
  
  return 'continue';
};

// ============================================
// Graph Builder
// ============================================

export class AgentGraph {
  private graph: any;

  constructor() {
    this.buildGraph();
  }

  private buildGraph(): void {
    // Create the state graph
    const workflow = new StateGraph<GraphState>({
      channels: defaultState as any
    });

    // Add nodes - Use unique names that don't conflict with state attributes
    workflow.addNode('plan_node', plannerWrapper);
    workflow.addNode('search_node', searchWrapper);
    workflow.addNode('filter_node', relevanceFilterWrapper);
    workflow.addNode('scrape_node', scraperWrapper);
    workflow.addNode('clean_node', cleanerWrapper);
    workflow.addNode('validate_node', validatorWrapper);
    workflow.addNode('service_saver_node', serviceSaverWrapper);  // ✅ ADDED
    workflow.addNode('analytics_node', analyticsWrapper);
    workflow.addNode('memory_node', memoryWrapper);

    // Set the entry point
    workflow.setEntryPoint('plan_node' as any);
    
    // Define edges between nodes
    workflow.addEdge('plan_node' as any, 'search_node' as any);
    workflow.addEdge('search_node' as any, 'filter_node' as any);
    workflow.addEdge('filter_node' as any, 'scrape_node' as any);
    workflow.addEdge('scrape_node' as any, 'clean_node' as any);
    workflow.addEdge('clean_node' as any, 'validate_node' as any);
    
    // Conditional edge from validator
    workflow.addConditionalEdges(
      'validate_node' as any,
      shouldRetryScraping,
      {
        scrape_node: 'scrape_node',
        service_saver_node: 'service_saver_node'  // ✅ CHANGED
      } as any
    );

    // ✅ ADDED: New flow after service saver
    workflow.addEdge('service_saver_node' as any, 'analytics_node' as any);
    workflow.addEdge('analytics_node' as any, 'memory_node' as any);
    workflow.addEdge('memory_node' as any, END);

    // Compile the graph
    this.graph = workflow.compile();
  }

  async run(
    query: string,
    userId: string = 'anonymous',
    options: {
      maxSteps?: number;
      timeout?: number;
    } = {}
  ): Promise<GraphState> {
    const sessionId = uuidv4();
    
    logger.info('Starting agent graph', { 
      query, 
      userId, 
      sessionId,
      options 
    });

    const initialState: GraphState = {
      ...defaultState,
      query,
      userId,
      sessionId,
      startTime: new Date()
    };

    try {
      const result = await this.graph.invoke(initialState, {
        recursionLimit: options.maxSteps || 50,
        timeout: options.timeout || 1800000 // 5 minutes
      });

      logger.info('Agent graph completed', { 
        sessionId,
        status: result.status,
        errors: result.errors.length,
        savedServices: result.savedServiceIds?.length || 0  // ✅ ADDED: Log saved services
      });

      return result;
    } catch (error) {
      logger.error('Agent graph failed:', error);
      
      return {
        ...initialState,
        status: 'failed',
        endTime: new Date(),
        errors: [
          ...initialState.errors,
          {
            node: 'graph',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            recoverable: false
          }
        ]
      };
    }
  }

  async runStream(
    query: string,
    userId: string = 'anonymous',
    onUpdate: (state: GraphState) => void
  ): Promise<GraphState> {
    const sessionId = uuidv4();
    
    logger.info('Starting streaming agent graph', { 
      query, 
      userId, 
      sessionId 
    });

    const initialState: GraphState = {
      ...defaultState,
      query,
      userId,
      sessionId,
      startTime: new Date()
    };

    try {
      const stream = await this.graph.stream(initialState);
      
      let finalState: GraphState = initialState;
      
      for await (const state of stream) {
        finalState = state;
        onUpdate(state);
      }

      return finalState;
    } catch (error) {
      logger.error('Streaming agent graph failed:', error);
      throw error;
    }
  }
}

// ============================================
// Graph Runner Singleton
// ============================================

let agentGraphInstance: AgentGraph | null = null;

export const getAgentGraph = (): AgentGraph => {
  if (!agentGraphInstance) {
    agentGraphInstance = new AgentGraph();
  }
  return agentGraphInstance;
};

// ============================================
// Direct Execution Helpers
// ============================================

export const runExtraction = async (
  query: string,
  userId?: string
): Promise<any> => {
  const graph = getAgentGraph();
  const result = await graph.run(query, userId);
  return result.finalOutput;
};

export const streamExtraction = async (
  query: string,
  onUpdate: (state: any) => void,
  userId?: string
): Promise<any> => {
  const graph = getAgentGraph();
  const result = await graph.runStream(query, userId, onUpdate);
  return result.finalOutput;
};
