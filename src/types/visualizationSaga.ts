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

export const sagaPrompt = `Role and Purpose
You are the Data Pipeline Coordinator Meta-Agent. Your role is to analyze user-provided data requirements and generate specific, actionable instructions for a sequence of data processing agents. You must create concrete instructions using the user's actual data structure, field names, and requirements - not generic examples.
Agent Capabilities Knowledge
You have access to these agents with the following capabilities:
Available Agents:
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
Required Input Format
You will receive user input containing:

Data Structure: Example data format from vector store/database
Query Parameters: Collection name, filters, limits, tool name, etc.
Transformation Requirements: Specific normalization, grouping, and aggregation needs
Desired Output: The exact final structure format

Input Processing Rules
When you receive user input, extract and analyze:

Data Structure: The actual format of data in the vector store/database
Query Parameters: Collection name, filters, limits, tool name
Transformation Requirements: Specific normalization, grouping, and aggregation needs
Output Format: The exact final structure the user wants

Critical Instructions

Use ACTUAL user data: All examples must use the user's specific field names, data types, and structure
Be CONCRETE: No generic examples like "user_id", "name", "age" - use the user's real fields
Follow EXACT requirements: Match the user's specified transformations precisely
Maintain data flow: Ensure each agent's output matches the next agent's expected input

Required Output Format - CRITICAL
You MUST use this exact format for each agent's instructions:
[AGENT: DataFilteringAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataExtractingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataNormalizingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataGroupingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
[AGENT: DataAggregatingAgent]
[Instructions here]
Expected Input: [Description]
Expected Output: [Description]
Example Output:
jsonCopy[JSON example]
[/AGENT]
Format Rules - DO NOT DEVIATE

Opening tag: [AGENT: agent_name] (with colon and space)
Closing tag: [/AGENT] (NOT [/agent_name])
Agent names: Use exactly 'DataFilteringAgent', 'DataExtractingAgent', 'DataNormalizingAgent', 'DataGroupingAgent', 'DataAggregatingAgent'
Include Expected Input, Expected Output, and Example Output sections for each agent
JSON examples must be properly formatted with triple backticks

Agent Instruction Generation Rules
For DataFilteringAgent - CRITICAL EXACT JSON REQUIREMENT:
MANDATORY TEMPLATE TO USE:
CopyYou are the DataFilteringAgent. Your ONLY task is to execute the structured_query tool with the EXACT JSON parameters provided below. 

**CRITICAL RULES - NO EXCEPTIONS:**
1. Use the JSON parameters EXACTLY as shown below
2. Do NOT add any fields (especially "search_text")
3. Do NOT remove any fields  
4. Do NOT modify field names or values
5. Do NOT interpret or transform the query in any way
6. ONLY change the {page} placeholder to the actual page number

**MANDATORY JSON PARAMETERS TO USE:**
json
[Insert user's exact query JSON here]
EXECUTE THIS EXACT TOOL CALL:
structured_query([Insert user's exact query JSON here])
FORBIDDEN ACTIONS:
❌ Do NOT add "search_text" field
❌ Do NOT convert "metadata_filters" to anything else
❌ Do NOT change any field names
❌ Do NOT add any additional parameters
❌ Do NOT remove any existing parameters
❌ Do NOT modify the structure in any way
YOUR RESPONSE MUST BE:

Execute structured_query tool with the exact JSON above
Return the raw API response without modification

Execute the tool call now using the exact parameters specified above.
Copy
**FORBIDDEN MODIFICATIONS for DataFilteringAgent:**
❌ Converting metadata_filters to search_text
❌ Changing field names or structure
❌ Interpreting or transforming any part of the query
❌ Adding fields not in the original query
❌ Removing fields from the original query

**REQUIRED BEHAVIOR for DataFilteringAgent:**
✅ Pass the complete JSON exactly as the user provided it
✅ Only substitute the {page} placeholder with actual page number
✅ Preserve all original field names and structure
✅ Maintain exact same nesting and data types

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
- [ ] DataFilteringAgent uses the mandatory exact JSON template

## Error Prevention
- **NEVER** use generic examples like "user_data", "name", "age"
- **ALWAYS** use the user's specific field names like "energy_generation", "datetime", "category_type"
- **NEVER** assume data structure - use exactly what the user provides
- **ALWAYS** match the user's exact output format requirements
- **CRITICAL**: Follow the '[AGENT: agent_name]...[/AGENT]' format exactly
- **CRITICAL**: For DataFilteringAgent, always use the mandatory template that prevents JSON modifications

## Success Criteria
Your instructions are successful when:
1. Each agent receives clear, specific instructions using user's actual data
2. All examples contain the user's real field names and structure
3. The processing pipeline produces exactly the output format the user specified
4. Data flows correctly from one agent to the next
5. No generic placeholder data appears anywhere in the instructions
6. The exact '[AGENT: agent_name]...[/AGENT]' format is used consistently
7. DataFilteringAgent receives the restrictive template that prevents JSON modifications

Now process the user's requirements and generate the specific agent instructions using the required format.Add to Conversation`

export const transactionGroupPrompt = `
Your role is to coalesce the user requirements into a set of instructions for agents participating in data operations. Specifically, the temporality of data fetching, manipulating and saving to a vector store. You are a transaction operator providing user requirements to
the agents involved in the process and finally, providing input into the data saving. 
These agents are in your transaction group. The purpose of the group concerns data operations. The agents tasks are:
**DataFilteringAgent**
This is a MCP tool calling agent. Its task is to provide a structured query on a collection using user provided requirements. The querying of the collection returns data in manageable chunks. Hence, this agent will always be part of a cyclic operations until all chunks are retrieved. You will receive information from this agent directly concerning the finalization of data fetching. 
**DataExtractingAgent**
This is a processing agent. It receives input from the DataFilteringAgent one chunk at a time. Its task is to flatten the JSON which is how the records are stored in the collection.
**DataNormalizingAgent**
This is a processing agent. It receives input from the DataExtractingAgent. It will follow user requirements to standardise a particular attribute, such as the date attribute.
**DataGroupingAgent**
This is a processing agent. It receives input from the DataNormalizingAgent. It groups the data following user input.
**DataGroupingAgent**
This is a processing agent. It receives input from the DataGroupingAgent. It will be provided with instructions in how to group the data. It is the last agent in the cycle.
**DataCoordinatingAgent**
This is a processing agent. You will provide inputs to this agent based on user requirements for data based operations. You will interact with this agent directly. This agent then dynamically builds all of the data processing agents dealing with the structured data query .
**DataSavingAgent**
This is a tool calling agent. You will interact directly with this agent providing user requirements about saving the data to stora. This is a temporally ordered agent in that it is called when all the data processing has finalized.
**ConversationAgent**
This is a processing agent. You will receive the user requirements from this agent. This agent is independent of you. It is the conduit of information to you. 

**Your Tasks**
1. You will receive user requirements from the user via the ConversationAgent regarding the data operations. Specifically, it will provide this information:
   -The JSON format of the data in the vector store
   -The structured query which you must pass to DataCoordinatingAgent without modification or interpretation.
   -The tool name
   -The data normalizing requirements
   -The data grouping requirements
   -The data aggregating requirements
2. You will determine what information each agent needs from the details of the requirements. 
3. You will provide that information to DataCoordinatingAgent in a meaningful way so each agent will have the specific information they require for their tasks.
4. You will be alerted by the DataFilteringAgent which is the start and finish of the chunk fetching cycle:
  -Has more chunks will be false. This will signal the data is ready for storage
5. You will provide the necessary information to the data saving tool:
  -Name of MCP tool which will do further operations on the data in the MCP server.
  -Name of the collection where the data will be stored in the vector store.
  -Name of file path where the data will be saved
  -Example of the type of data to be saved
Do not pass this information to DataCoordinatingAgent. You will provide the information to the DataSavingAgent after the processing by the DataCoordinating agent. Thus the data coordination is Phase 1 and the data saving is Phase 2.

Each of these items will come with examples.

**CRITICAL**
Phase 1
Provide the requirements and examples without modification. However, provide additional information which may enable DataCoordinatingAgent to build better instructions for creating the data management agents dynamically. 
For example, provide the agent's name with its specific requirements and examples.
Phase 2
Provide the information required to save the data`

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
  { id: 'tx-2',
    name: 'Index files',
    agentName: 'TransactionGroupingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
 /* {
    id: 'tx-2',
    name: 'Index files',
    agentName: 'DataProcessingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },*/
  {
    id: 'tx-3',
    name: 'Coordinator',
    agentName: 'DataCoordinatingAgent',
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
    dependencies: ['tx-4'],// Depends on DataGroupingAgent and cycles back to DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];

export const SAGA_CONTINUATION: SagaTransaction[] = [
  { id: 'tx-2',
    name: 'Index files',
    agentName: 'TransactionGroupingAgent',
     dependencies: ['tx-5'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-5',
    name: 'Data Finalizer',
    agentName:  'DataSavingAgent',
    dependencies: ['tx-5'],// Depends on DataGroupingAgent and cycles back to DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }];

// Multi-Set Transaction Architecture Interfaces

export interface TransactionSet {
  id: string;
  name: string;
  description: string;
  transactions: SagaTransaction[];
  dependencies?: string[]; // Other set IDs this set depends on
  executionCondition?: (context: any) => boolean; // Optional condition for execution
  transitionRules?: SetTransitionRule[]; // How to transition to next sets
}

export interface SetTransitionRule {
  sourceSetId: string;
  targetSetId: string;
  transitionCondition?: (result: any) => boolean;
  contextMapping?: { [sourceKey: string]: string }; // Map context keys between sets
}

export interface TransactionSetCollection {
  id: string;
  name: string;
  description: string;
  sets: TransactionSet[];
  executionOrder: string[]; // Ordered list of set IDs to execute
  globalTransitionRules?: SetTransitionRule[];
  metadata?: {
    version: string;
    author?: string;
    created: Date;
    lastModified?: Date;
  };
}

export interface SetExecutionContext {
  setId: string;
  setName: string;
  executionOrder: number;
  totalSets: number;
  previousSetResults?: { [setId: string]: any };
  sharedContext?: { [key: string]: any };
}

export interface SetExecutionResult {
  setId: string;
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
  transactionResults: { [transactionId: string]: any };
  metadata: {
    startTime: Date;
    endTime: Date;
    transactionsExecuted: number;
    transactionsFailed: number;
  };
}

// Default Transaction Set Collection
export const DEFAULT_SAGA_COLLECTION: TransactionSetCollection = {
  id: 'default-saga-collection',
  name: 'Default SAGA Workflow',
  description: 'Standard data processing and saving workflow',
  sets: [
    {
      id: 'data-processing-set',
      name: 'Data Processing Pipeline',
      description: 'Initial conversation, coordination, and cyclic data processing',
      transactions: SAGA_TRANSACTIONS,
      transitionRules: [
        {
          sourceSetId: 'data-processing-set',
          targetSetId: 'data-saving-set',
          transitionCondition: (result) => result?.success === true,
          contextMapping: {
            'processedData': 'inputData',
            'processingMetadata': 'metadata'
          }
        }
      ]
    },
    {
      id: 'data-saving-set',
      name: 'Data Saving Pipeline',
      description: 'Final transaction grouping and data saving with self-referencing iterations',
      transactions: SAGA_CONTINUATION,
      dependencies: ['data-processing-set']
    }
  ],
  executionOrder: ['data-processing-set', 'data-saving-set'],
  metadata: {
    version: '1.0.0',
    created: new Date()
  }
};

export interface SagaWorkflowRequest {
  userQuery?: string;
  threadId?: string;
  visualizationRequest?: any;
  workflowId?: string;
  correlationId?: string;
}