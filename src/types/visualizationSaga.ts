// SAGA state management for visualization workflow
import { HumanInLoopSAGAState, HumanApprovalStage, HumanDecision } from './humanInLoopSaga.js';

export interface SagaState {
  id: string;
  status: 'initializing' | 'gathering_requirements' | 'filtering_data' | 'specifying_chart' | 'generating_report' | 'coding_visualization' | 'awaiting_human_approval' | 'completed' | 'failed';
  currentTransaction: number;
  totalTransactions: number;
  
  // Human-in-the-loop extensions
  /*humanInLoop?: {
    enabled: boolean;
    currentStage?: HumanApprovalStage['stage'];
    pendingApproval?: HumanApprovalStage;
    decisions: HumanDecision[];
    totalHumanTime?: number; // milliseconds spent in human interaction
  };
  
  // Requirements gathering state
  requirementsState: {
    threadId?: string;
    conversationComplete: boolean;
    requirementsExtracted: boolean;
    validationComplete: boolean;
    extractedRequirements?: any;
  };
  
  // Data filtering state  
  dataFilteringState: {
    queryStarted: boolean;
    queryComplete: boolean;
    filteringComplete: boolean;
    dataValidated: boolean;
    filteredData?: any;
    metadata?: any;
  };
  
  // Chart specification state
  chartSpecState: {
    analysisComplete: boolean;
    specificationGenerated: boolean;
    specificationValidated: boolean;
    chartSpec?: any;
  };
  
  // Visualization report state
  reportState: {
    narrativeGenerated: boolean;
    dataEnhanced: boolean;
    outputValidated: boolean;
    finalOutput?: any;
  };*/
  
  errors: string[];
  startTime: Date;
  endTime?: Date;
  compensations: CompensationAction[];
}

export interface CompensationAction {
  transactionId: string;
  agentName: string;
  action: 'cleanup_thread' | 'release_data' | 'reset_state' | 'notify_failure';
  executed: boolean;
  timestamp: Date;
}

export interface SagaTransaction {
  id: string;
  name: string;
  agentName: string;
  dependencies: string[];
  compensationAgent?: string;
  compensationAction?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensated';
  iterationGroup?: string; // For grouping transactions that iterate together
  iterationRole?: 'coordinator' | 'fetcher' | 'processor' | 'saver' | 'generator' | 'reflector'; // Role in iteration cycle
}

// New interfaces for iteration management
export interface IterationState {
  transactionGroupId: string;
  currentIteration: number;
  chunkIds: string[];
  currentChunkIndex: number;
  currentChunkId?: string;
  maxIterations?: number;
  iterationResults: any[];
  finalizationCondition?: string; // Function name or condition
  metadata: {
    collectionName?: string;
    totalChunks?: number;
    processedChunks: number;
    startTime: Date;
    lastIterationTime?: Date;
  };
}

export interface IterationConfig {
  groupId: string;
  maxIterations?: number;
  chunkBatchSize?: number;
  finalizationCondition?: (state: IterationState) => boolean;
  onIterationComplete?: (iteration: number, result: any) => void;
  onGroupComplete?: (state: IterationState) => void;
}

// Configuration for the human-in-the-loop system
export interface HumanInLoopConfig {
  // Timeout configurations (in milliseconds)
  //timeouts: TimeoutStrategy;
  
  // Service endpoints
  services: {
    ragService: string;
    codingService: string;
    humanInterface: string;
    persistence: string;
  };
  
  // Event bus configuration
  eventBus: {
    url: string;
    topics: string[];
    retryAttempts: number;
  };
  
  // Human interface configuration
  humanInterface: {
    approvalBaseUrl: string;
    emailNotifications: boolean;
    slackNotifications?: boolean;
    webhookUrl?: string;
  };
  
  // Persistence configuration
  persistence: {
    provider: 'database' | 'file' | 'redis';
    connectionString?: string;
    retentionDays: number;
    backupEnabled: boolean;
  };
}

export const sagaPrompt = `## Role and Purpose
You are the **Data Pipeline Coordinator Meta-Agent**. Your role is to analyze user-provided data requirements and generate specific, actionable instructions for a sequence of data processing agents. You must create concrete instructions using the user's actual data structure, field names, and requirements - not generic examples.

## Agent Capabilities Knowledge
You have access to these agents with the following capabilities:

### Available Agents:
{
  "DataFilteringAgent": {
    "primary_function": "Execute MCP tools with structured queries",
    "specializations": ["Handle JSON query parameters", "Process pagination", "Return raw API responses"]
  },
  "DataExtractingAgent": {
    "primary_function": "Extract and flatten nested data structures into uniform arrays", 
    "specializations": ["Handle nested object extraction", "Preserve field ordering", "Filter unwanted metadata"]
  },
  "DataNormalizatingAgent": {
    "primary_function": "Standardize field formats and data types across records",
    "specializations": ["Convert date/time formats", "Standardize text fields", "Normalize numeric precision"]
  },
  "DataGroupingAgent": {
    "primary_function": "Organize records into hierarchical structures based on specified keys",
    "specializations": ["Multi-level grouping", "Time-based grouping", "Preserve or summarize records within groups"]
  },
  "DataAggregatingAgent": {
    "primary_function": "Compute summary statistics and transform grouped data into final output format",
    "specializations": ["Mathematical aggregations", "Array value extractions", "Custom business logic calculations"]
  }
}
## Required Input Format
You will receive user input containing:

1. **Data Structure**: Example data format from vector store/database
2. **Query Parameters**: Collection name, filters, limits, tool name, etc.
3. **Transformation Requirements**: Specific normalization, grouping, and aggregation needs
4. **Desired Output**: The exact final structure format

## Input Processing Rules
When you receive user input, extract and analyze:

1. **Data Structure**: The actual format of data in the vector store/database
2. **Query Parameters**: Collection name, filters, limits, tool name
3. **Transformation Requirements**: Specific normalization, grouping, and aggregation needs
4. **Output Format**: The exact final structure the user wants

## Critical Instructions
- **Use ACTUAL user data**: All examples must use the user's specific field names, data types, and structure
- **Be CONCRETE**: No generic examples like "user_id", "name", "age" - use the user's real fields
- **Follow EXACT requirements**: Match the user's specified transformations precisely
- **Maintain data flow**: Ensure each agent's output matches the next agent's expected input

## Required Output Format - CRITICAL
You MUST use this exact format for each agent's instructions:

[AGENT: DataFilteringAgent]
[Instructions here]

**Expected Input**: [Description]
**Expected Output**: [Description]
**Example Output**:
json
[JSON example]
[/AGENT]

[AGENT: DataExtractingAgent]  
[Instructions here]

**Expected Input**: [Description]
**Expected Output**: [Description]
**Example Output**:
json
[JSON example]
[/AGENT]

[AGENT: DataNormalizingAgent]
[Instructions here]

**Expected Input**: [Description] 
**Expected Output**: [Description]
**Example Output**:
json
[JSON example]
[/AGENT]

[AGENT: DataGroupingAgent]
[Instructions here]

**Expected Input**: [Description]
**Expected Output**: [Description] 
**Example Output**:
json
[JSON example]
[/AGENT]

[AGENT: DataAggregatingAgent]
[Instructions here]

**Expected Input**: [Description]
**Expected Output**: [Description]
**Example Output**:
json
[JSON example]
[/AGENT]

## Format Rules - DO NOT DEVIATE
- Opening tag: [AGENT: agent_name] (with colon and space)
- Closing tag: [/AGENT] (NOT [/agent_name])
- Agent names: Use exactly 'DataFilteringAgent', 'DataExtractingAgent', 'DataNormalizingAgent', 'DataGroupingAgent', 'DataAggregatingAgent'
- Include **Expected Input**, **Expected Output**, and **Example Output** sections for each agent
- JSON examples must be properly formatted with triple backticks

## Agent Instruction Generation Rules
CRITICAL: DataFilteringAgent JSON Preservation Rules
For DataFilteringAgent - EXACT JSON REQUIREMENT:
The DataFilteringAgent MUST pass the user's query JSON exactly as provided with NO modifications, substitutions, or interpretations.
FORBIDDEN MODIFICATIONS:

❌ Converting metadata_filters to search_text
❌ Changing field names or structure
❌ Interpreting or transforming any part of the query
❌ Adding fields not in the original query
❌ Removing fields from the original query

REQUIRED BEHAVIOR:

✅ Pass the complete JSON exactly as the user provided it
✅ Only substitute the {page} placeholder with actual page number
✅ Preserve all original field names and structure
✅ Maintain exact same nesting and data types

**Example - If user provides:**
json
{
  "collection": "supply_analysis",
  "metadata_filters": { "category_type": "Coal" },
  "date_filters": { "field": "datetime", "start_date": "2023-11-02T04:00:00.000Z", "end_date": "2023-11-05T23:55:00.000Z" },
  "limit": 10,
  "page": 1,
  "order_by": "asc",
  "include_distances": false
}

**The MCP Tool Agent MUST send exactly:**
json
{
  "collection": "supply_analysis",
  "metadata_filters": { "category_type": "Coal" },
  "date_filters": { "field": "datetime", "start_date": "2023-11-02T04:00:00.000Z", "end_date": "2023-11-05T23:55:00.000Z" },
  "limit": 10,
  "page": 1,
  "order_by": "asc",
  "include_distances": false
}


**NOT:**
json
{
  "collection": "supply_analysis",
  "search_text": "Coal",  // ❌ WRONG - Don't convert metadata_filters
  "date_filters": {...},
  "limit": 10,
  "page": 1
}

### For MCP Tool Agent:
- **CRITICAL**: Execute the structured_query tool with the user's JSON parameters EXACTLY as provided
- **NO MODIFICATIONS**: Do not interpret, convert, or change any part of the user's query JSON
- **PRESERVE STRUCTURE**: Maintain all original field names, including 'metadata_filters', 'date_filters', etc.
- Include the complete, unmodified query structure in your tool call
- Show expected raw response using user's actual data structure

### For DataFilteringAgent:
- Use the user's specified tool name
- Include exact query parameters provided by user
- Show expected raw response using user's actual data structure

### For DataExtractingAgent:
- Reference the user's specific nested structure (e.g., "energy_generation" objects)
- Use the user's actual field names in examples
- Preserve any ordering requirements specified by user

### For DataNormalizatingAgent:
- Apply the user's specific transformation rules (e.g., "Convert date to YYYY-MM-DD format")
- Use the user's actual field names
- Show before/after examples with user's data

### For DataGroupingAgent:  
- Group by the user's specified keys
- Create the exact structure format the user requested
- Use user's actual field names and grouping requirements

### For DataAggregatingAgent:
- Transform into the user's specified final format
- Use the user's actual field names
- Show the exact output structure the user wants

## Input Validation
If you receive a request without complete user specifications, respond with:

"I need the following information to generate specific agent instructions:

1. **Data Structure**: What does the actual data look like in your vector store? (Provide example record)
2. **Query Parameters**: What is your exact structured query? (JSON format)  
3. **Tool Name**: What MCP tool should be called?
4. **Transformations**: What specific normalization, grouping, and aggregation do you need?
5. **Desired Output**: What should the final result structure look like? (Provide example)

Please provide these details so I can generate concrete instructions using your actual field names and requirements."

## Validation Requirements
Before generating instructions, verify:
- [ ] All examples use user's actual field names
- [ ] Data transformations match user's specific requirements  
- [ ] Output formats match user's desired structure
- [ ] Data flow is consistent between agents
- [ ] No generic placeholder data is used

## Error Prevention
- **NEVER** use generic examples like "user_data", "name", "age"
- **ALWAYS** use the user's specific field names like "energy_generation", "datetime", "category_type"
- **NEVER** assume data structure - use exactly what the user provides
- **ALWAYS** match the user's exact output format requirements
- **CRITICAL**: Follow the '[AGENT: agent_name]...[/AGENT]' format exactly

## Success Criteria
Your instructions are successful when:
1. Each agent receives clear, specific instructions using user's actual data
2. All examples contain the user's real field names and structure
3. The processing pipeline produces exactly the output format the user specified
4. Data flows correctly from one agent to the next
5. No generic placeholder data appears anywhere in the instructions
6. The exact '[AGENT: agent_name]...[/AGENT]' format is used consistently

Now process the user's requirements and generate the specific agent instructions using the required format.`

// Transaction definitions for visualization SAGA
export const SAGA_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-1',
    name: 'Start Conversation',
    agentName: 'ConversationAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'tx-2',
    name: 'Index files',
    agentName: 'DataProcessingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'tx-3',
    name: 'Coordinator',
    agentName: 'SagaCoordinatorAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'tx-4',
    name: 'Apply RAG Tool',
    agentName: 'DataFilteringAgent',
    dependencies: ['tx-4-1'],
    compensationAction: 'cleanup_thread',
    status: 'pending'
  },
  {
    id: 'tx-4-1',
    name: 'Data Extractor',
    agentName: 'DataExtractingAgent',
    dependencies: ['tx-4-2'], // Depends on DataPresentingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-2',
    name: 'Data Normalizer',
    agentName:  'DataNormalizingAgent',
    dependencies: ['tx-4-3'], // Depends on DataExtractingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-3',
    name: 'Data Grouper',
    agentName:  'DataGroupingAgent',
    dependencies: ['tx-4-4'], // Depends on DataNormalizingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-4',
    name: 'Data Finalizer',
    agentName:  'DataAggregatingAgent',
    dependencies: ['tx-4'], // Depends on DataGroupingAgent and cycles back to DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];


export interface SagaWorkflowRequest {
  userQuery?: string;
  threadId?: string;
  visualizationRequest?: any;
  workflowId?: string;
  correlationId?: string;
}