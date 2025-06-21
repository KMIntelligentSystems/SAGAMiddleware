import { AgentDefinition } from '../types/index.js';
import { VisualizationRequest } from '../types/visualization.js';
import OpenAI from 'openai';

export interface OpenAIThreadContext {
  threadId: string;
  assistantId: string;
  openaiClient: OpenAI;
  currentState: 'gathering_requirements' | 'clarifying_details' | 'requirements_complete' | 'ready_for_visualization';
  extractedRequirements: Partial<VisualizationRequest>;
  lastInteraction: Date;
  requirementExtractionRun?: string; // OpenAI run ID for requirement extraction
}

export interface ConversationContext {
  threadId: string;
  initialRequest: string;
  conversationHistory: ConversationMessage[];
  currentState: 'gathering_requirements' | 'clarifying_details' | 'requirements_complete';
  extractedRequirements: Partial<VisualizationRequest>;
  lastInteraction: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    requirementExtracted?: boolean;
    clarificationNeeded?: string[];
  };
}

export interface ConversationResult {
  threadId: string;
  requirementsComplete: boolean;
  visualizationRequest?: VisualizationRequest;
  nextQuestion?: string;
  conversationHistory: ConversationMessage[];
  extractedSoFar: Partial<VisualizationRequest>;
}

export function createConversationAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'conversation_manager',
    agentType: 'processing',
    backstory: '',
    taskDescription: `You are a conversation manager that uses AI SDK with OpenAI threads to gather visualization requirements from users.

CORE RESPONSIBILITIES:
1. MAINTAIN CONVERSATION CONTEXT: Use the provided threadId to maintain conversation state
2. EXTRACT REQUIREMENTS: Parse user responses to build a complete VisualizationRequest
3. ASK CLARIFYING QUESTIONS: Guide users to specify their visualization needs
4. VALIDATE COMPLETENESS: Ensure all necessary information is gathered before proceeding

CONVERSATION FLOW:
1. ANALYZE INITIAL REQUEST: Parse the user's first message for:
   - Intent (what they want to visualize)
   - Explicit requirements (time range, energy types, suppliers)
   - Chart preferences (if any)
   - Ambiguous areas needing clarification

2. PROGRESSIVE REQUIREMENT GATHERING: Ask focused questions to clarify:
   - Time Range: "What time period are you interested in?" (if not specified)
   - Energy Types: "Which energy types? Coal, gas, green, or all?" (if not clear)
   - Suppliers: "Any specific suppliers, or all 28?" (if relevant)
   - Chart Type: "How would you like to see this? Line chart for trends, bar chart for comparisons?" (if helpful)
   - Granularity: "Do you want raw 5-minute data, hourly, or daily summaries?" (for time series)

3. CONFIRM UNDERSTANDING: Summarize requirements before finalizing:
   "So you want to see [summary of request]. Is this correct?"

4. COMPLETE REQUIREMENTS: Output structured VisualizationRequest when ready

CONTEXT PROVIDED:
- threadId: OpenAI thread identifier for conversation continuity
- initialRequest: User's first message
- conversationHistory: Previous messages in this thread
- currentState: Current conversation phase

INTELLIGENT QUESTIONING STRATEGY:
- Ask 1-2 focused questions per response (not overwhelming)
- Prioritize the most important missing information first
- Use energy domain knowledge to suggest reasonable defaults
- Provide examples when helpful: "e.g., 'last 3 days' or 'December 10-15'"

REQUIREMENT VALIDATION:
- Time Range: Must be reasonable (not longer than available data)
- Energy Types: Must be valid (coal, gas, green)
- Suppliers: Must exist in the dataset
- Chart Type: Must be appropriate for the data being requested

OUTPUT DECISION LOGIC:
- requirementsComplete: true ONLY when you have enough info to create a meaningful visualization
- nextQuestion: Provide if more clarification needed
- visualizationRequest: Complete object if ready to proceed

CONVERSATION EXAMPLES:
User: "Show me energy trends"
Assistant: "I'd be happy to show you energy trends! To create the best visualization:
1. What time period interests you? (e.g., 'last 3 days', 'past week', 'December 10-15')
2. Are you interested in all energy types (coal, gas, green) or specific ones?"

User: "Coal output for last week"
Assistant: "Perfect! For coal output over the last week:
- Would you like to see all suppliers or focus on specific ones?
- How detailed should this be? Hourly trends or daily summaries work better for a week of data."

CRITICAL: Use the threadId to maintain conversation context through the AI SDK. Build requirements incrementally and confirm understanding before completion.`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 1500,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    taskExpectedOutput: '',/*{
      threadId: 'string',
      requirementsComplete: 'boolean',
      visualizationRequest: 'object',
      nextQuestion: 'string',
      conversationHistory: 'array',
      extractedSoFar: 'object'
    },*/
    
    context: {
      energyTypes: ['coal', 'gas', 'green'],
      supplierCount: 28,
      dataGranularity: '5-minute intervals',
      availableTimeRange: '10 days of data',
      commonChartTypes: ['line', 'bar', 'scatter', 'area', 'heatmap']
    },
    dependencies: [],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}

// Utility class for managing conversation state
export class ConversationManager {
  private conversations = new Map<string, ConversationContext>();

  async startConversation(threadId: string, initialRequest: string): Promise<ConversationResult> {
    const context: ConversationContext = {
      threadId,
      initialRequest,
      conversationHistory: [{
        role: 'user',
        content: initialRequest,
        timestamp: new Date()
      }],
      currentState: 'gathering_requirements',
      extractedRequirements: {
        userQuery: initialRequest,
        filters: {}
      },
      lastInteraction: new Date()
    };

    this.conversations.set(threadId, context);

    // Process initial request through conversation agent
    return await this.processConversationTurn(threadId, initialRequest, true);
  }

  async continueConversation(threadId: string, userMessage: string): Promise<ConversationResult> {
    const context = this.conversations.get(threadId);
    if (!context) {
      throw new Error(`Conversation thread ${threadId} not found`);
    }

    // Add user message to history
    context.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    context.lastInteraction = new Date();

    return await this.processConversationTurn(threadId, userMessage, false);
  }

  private async processConversationTurn(threadId: string, message: string, isInitial: boolean): Promise<ConversationResult> {
    // This would integrate with your AI SDK implementation
    // For now, returning a mock structure that shows the expected flow
    
    const context = this.conversations.get(threadId)!;
    
    // Here you would call the conversation agent through SAGA middleware
    // const agentResult = await sagaMiddleware.executeAgent('conversation_manager', {
    //   threadId,
    //   message,
    //   context: context,
    //   isInitial
    // });

    // Mock processing logic for demonstration
    const result = await this.mockConversationProcessing(context, message, isInitial);
    
    // Update conversation state
    if (result.requirementsComplete) {
      context.currentState = 'requirements_complete';
    }

    // Add assistant response to history
    if (result.nextQuestion) {
      context.conversationHistory.push({
        role: 'assistant',
        content: result.nextQuestion,
        timestamp: new Date()
      });
    }

    this.conversations.set(threadId, context);
    return result;
  }

  private async mockConversationProcessing(context: ConversationContext, message: string, isInitial: boolean): Promise<ConversationResult> {
    // This is a simplified mock - in reality this would be handled by the conversation agent
    const extracted = context.extractedRequirements;
    
    if (isInitial) {
      // Analyze initial request
      if (message.toLowerCase().includes('coal')) {
        extracted.filters!.energyTypes = ['coal'];
      }
      if (message.toLowerCase().includes('last week')) {
        extracted.filters!.timeRange = {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        };
      }
    }

    // Determine if we need more information
    const needsTimeRange = !extracted.filters?.timeRange;
    const needsEnergyType = !extracted.filters?.energyTypes;
    const needsAggregation = !extracted.filters?.aggregation;

    if (needsTimeRange) {
      return {
        threadId: context.threadId,
        requirementsComplete: false,
        nextQuestion: "What time period would you like to analyze? (e.g., 'last 3 days', 'past week', or specific dates)",
        conversationHistory: context.conversationHistory,
        extractedSoFar: extracted
      };
    }

    if (needsEnergyType) {
      return {
        threadId: context.threadId,
        requirementsComplete: false,
        nextQuestion: "Which energy types are you interested in? Coal, gas, green energy, or all types?",
        conversationHistory: context.conversationHistory,
        extractedSoFar: extracted
      };
    }

    if (needsAggregation) {
      return {
        threadId: context.threadId,
        requirementsComplete: false,
        nextQuestion: "How detailed should the data be? Raw 5-minute intervals, hourly summaries, or daily aggregates?",
        conversationHistory: context.conversationHistory,
        extractedSoFar: extracted
      };
    }

    // Requirements complete
    const visualizationRequest: VisualizationRequest = {
      userQuery: context.initialRequest,
      filters: extracted.filters || {},
      chartPreferences: extracted.chartPreferences || { type: 'auto' }
    };

    return {
      threadId: context.threadId,
      requirementsComplete: true,
      visualizationRequest,
      conversationHistory: context.conversationHistory,
      extractedSoFar: extracted
    };
  }

  getConversation(threadId: string): ConversationContext | undefined {
    return this.conversations.get(threadId);
  }

  cleanupOldConversations(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    for (const [threadId, context] of this.conversations.entries()) {
      if (context.lastInteraction < cutoff) {
        this.conversations.delete(threadId);
      }
    }
  }
}

// Singleton instance for global access
export const conversationManager = new ConversationManager();