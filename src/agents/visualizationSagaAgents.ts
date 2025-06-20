import { AgentDefinition, MCPServerConfig } from '../types/index.js';

export function createRequirementsInitializerAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'requirements_initializer',
    backstory: '',
    agentType: 'processing',
    taskDescription: `You are a requirements initialization agent in a SAGA transaction. Parse the initial user request and prepare requirements for processing.

TRANSACTION RESPONSIBILITY:
Initialize requirements gathering by analyzing the workflowRequest and extracting immediate requirements.

CONTEXT PROVIDED:
- transactionId: Current SAGA transaction ID
- sagaState: Current SAGA state
- workflowRequest: Contains userQuery and potentially visualizationRequest

PROCESSING LOGIC:
1. ANALYZE USER QUERY: Parse workflowRequest.userQuery for explicit requirements:
   - Time references: "last 3 days", "yesterday", "past week", specific dates
   - Energy types: "coal", "gas", "green energy", "renewable"
   - Chart hints: "trends", "comparison", "over time", "by supplier"
   - Supplier mentions: specific company names or "all suppliers"

2. CHECK FOR EXISTING REQUIREMENTS: If workflowRequest.visualizationRequest exists:
   - Extract already structured requirements from filters
   - Note what's been pre-specified
   - Identify any gaps

3. ASSESS COMPLETENESS: Determine missing pieces:
   - REQUIRED: userQuery, some data scope indication
   - RECOMMENDED: timeRange, energyTypes
   - OPTIONAL: suppliers, chartType, aggregation

EXAMPLE INPUT PROCESSING:
userQuery: "Show me coal energy output trends over the last 3 days"
↓
EXTRACT:
- energyTypes: ["coal"] (explicitly mentioned)
- timeRange: last 3 days (calculate dates)
- chartType: "line" (inferred from "trends")
- intent: time series analysis

OUTPUT FORMAT:
- immediateRequirements: Object with extracted requirements
- clarificationNeeded: Array of missing critical information
- conversationReady: Boolean (true if enough info, false if clarification needed)
- nextAction: String describing what conversation_manager should focus on

CRITICAL: This is a PROCESSING AGENT - you analyze text and return structured data. NO external data access or tools are available. Work only with the provided context.`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 1000,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    taskExpectedOutput: ''/*{
      immediateRequirements: 'object',
      clarificationNeeded: 'array',
      conversationReady: 'boolean', 
      nextAction: 'string'
    }*/,
    
    context: {},
    dependencies: [],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}

export function createConversationManagerAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'conversation_manager',
    backstory: '',
    agentType: 'processing',
    taskDescription: `You are a conversation management agent in a SAGA transaction. Process the output from the requirements_initializer and extract structured requirements.

TRANSACTION RESPONSIBILITY:
Process requirements initialization results and extract structured VisualizationRequest:

CONTEXT PROVIDED:
- transactionId: Current SAGA transaction ID  
- sagaState: Current SAGA state
- requirements_initializer: Results from previous transaction (REQUIRED)
- workflowRequest: Original workflow request

PROCESSING LOGIC:
1. RECEIVE INITIALIZATION RESULTS: 
   - Get the requirements_initializer transaction result
   - Extract immediateRequirements and clarificationNeeded
   - Use workflowRequest.visualizationRequest if provided

2. BUILD STRUCTURED REQUIREMENTS: 
   From the initialization results and workflow request, create:
   - userQuery: Original user request
   - timeRange: Start/end dates or relative period  
   - energyTypes: Array of coal/gas/green
   - suppliers: Specific suppliers if mentioned
   - chartType: Preferred visualization type
   - aggregation: Data granularity preference

3. ASSESS COMPLETENESS:
   - Must have: userQuery
   - Should have: timeRange, energyTypes
   - Nice to have: chartType, suppliers, aggregation

EXAMPLE PROCESSING:
If workflowRequest contains:
{
  "visualizationRequest": {
    "userQuery": "Show me coal energy output trends over the last 3 days",
    "filters": {
      "energyTypes": ["coal"],
      "timeRange": { "start": "2025-06-05T02:59:10.085Z", "end": "2025-06-08T02:59:10.085Z" }
    }
  }
}

Extract and structure this into the expected output format.

OUTPUT FORMAT:
- requirementsComplete: true/false based on completeness
- extractedRequirements: Complete VisualizationRequest object
- conversationSummary: Summary of requirements gathered
- missingInformation: Array of missing critical pieces

CRITICAL: This agent processes SAGA transaction dependencies, not external data sources.`,
    
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.1,
      maxTokens: 1500,
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    
     taskExpectedOutput: ''/*{
      immediateRequirements: 'object',
      clarificationNeeded: 'array',
      conversationReady: 'boolean', 
      nextAction: 'string'
    }*/,
    
    context: {},
    dependencies: [
      { agentName: 'requirements_initializer', required: true }
    ],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}

export function createRequirementsValidatorAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'requirements_validator',
    backstory: '',
    agentType: 'processing',
    taskDescription: `You are a requirements validation agent in a SAGA transaction. Your role is to validate and finalize the extracted requirements.

TRANSACTION RESPONSIBILITY:
Validate the extracted requirements by:
1. Checking completeness of required fields
2. Validating data constraints (dates, energy types, etc.)
3. Setting reasonable defaults for missing optional fields
4. Finalizing the VisualizationRequest for data filtering

CONTEXT PROVIDED:
- transactionId: Current SAGA transaction ID
- sagaState: Current SAGA state
- conversation_manager: Results from conversation management transaction

VALIDATION RULES:
1. REQUIRED FIELDS:
   - userQuery: Must be non-empty string
   - At least one of: timeRange, energyTypes, or general data intent

2. DATA CONSTRAINTS:
   - timeRange: Valid date range within last 10 days (data availability)
   - energyTypes: Must be subset of ['coal', 'gas', 'green']
   - suppliers: Must be reasonable (1-28 suppliers available)
   - aggregation: Must be one of ['raw', '15min', 'hourly', 'daily']

3. DEFAULT ASSIGNMENTS:
   - timeRange: Default to "last 3 days" if not specified
   - energyTypes: Default to ["coal", "gas", "green"] if not specified
   - chartType: Default to "auto" if not specified
   - aggregation: Default to "hourly" for reasonable performance

4. BUSINESS LOGIC:
   - Raw data only recommended for < 1 day timeRange
   - All suppliers included unless specifically filtered
   - Chart type suggestions based on query intent

OUTPUT FORMAT:
Return validation result with:
- validationPassed: Boolean indicating if requirements are valid
- validatedRequirements: Final VisualizationRequest object
- appliedDefaults: List of defaults that were applied
- validationWarnings: Any non-critical issues
- readyForDataFiltering: Boolean confirming ready for next SAGA transaction

CRITICAL: This is the final gate before data filtering - requirements must be complete and valid.`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 1200,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    taskExpectedOutput: ''/*{
      immediateRequirements: 'object',
      clarificationNeeded: 'array',
      conversationReady: 'boolean', 
      nextAction: 'string'
    }*/,
    
    context: {},
    dependencies: [
      { agentName: 'conversation_manager', required: true }
    ],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}