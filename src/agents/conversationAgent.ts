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