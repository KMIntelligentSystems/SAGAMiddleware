/**
 * Agent Definitions
 *
 * Centralized agent configuration for the SAGA system.
 * Extracted from sagaWorkflow.ts for easier access by DAG Designer.
 */

import { LLMPromptConfig } from '../services/contextRegistry.js';

/**
 * All registered agents in the system
 * This is the source of truth for what agents are available
 */
export const AGENT_DEFINITIONS: LLMPromptConfig[] = [
    {
        agentName: 'ConversationAgent',
        agentType: 'processing',
        transactionId: 'tx-1',
        backstory: 'Receives workflow requirements from frontend and passes them to DAG Designer for autonomous workflow creation.',
        taskDescription: `Your role is to receive workflow requirements from the frontend and ensure they are in the correct format for the DAG Designer.

The frontend may send detailed agent specifications in an "agents" array. These are CRITICAL - they specify Python agents that will be executed via ExecuteAgentsStrategy.

IMPORTANT: If frontend includes an "agents" array, PRESERVE IT - this tells DAG Designer which Python agents to create.

Required fields:
- objective: What the user wants to accomplish
- inputData: {type, source, schema (optional)}
- outputExpectation: {type, format (optional), quality (optional)}

Optional but important fields:
- agents: Array of agent specifications with {name, description, task, inputFrom, outputSchema}
- constraints: {maxExecutionTime, parallelismAllowed, executionOrder}

Output a clean JSON object with WorkflowRequirements format:
{
  "objective": "...",
  "inputData": {
    "type": "...",
    "source": "...",
    "schema": {...}
  },
  "outputExpectation": {
    "type": "...",
    "format": "...",
    "quality": [...]
  },
  "agents": [
    {
      "name": "...",
      "description": "...",
      "task": "...",
      "inputFrom": null or "PreviousAgentName",
      "outputSchema": {...}
    }
  ],
  "constraints": {
    "parallelismAllowed": false,
    "executionOrder": "sequential"
  }
}

Preserve all values provided by the user, especially the agents array if present.`,
        taskExpectedOutput: 'Complete WorkflowRequirements JSON including agents array if provided by frontend'
    },
    {
        agentName: 'TransactionGroupingAgent',
        agentType: 'processing',
        transactionId: 'tx-2',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Your role is coordinator. You will receive instructions which will indicate your specific task and the output from thinking through the task to provide meaningful instructions for other agents to enable them to execute their tasks',
        taskExpectedOutput: 'Output as expected.'
    },
    {
        agentName: 'DataProfiler',
        agentType: 'processing',
        transactionId: 'tx-2-2',
        backstory: 'You analyze data files and generate technical specifications.',
        taskDescription: 'Your role is to analyze CSV data files, understand their structure, identify data patterns, and generate comprehensive technical specifications for agent generation. You process user requirements in the context of the actual data.',
        taskExpectedOutput: 'Detailed technical specification including file structure, data types, transformation requirements, and agent generation guidelines.'
    },
    {
        agentName: 'D3JSCoordinatingAgent',
        agentType: 'processing',
        transactionId: 'tx-5',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Your role is coordinator. You will receive instructions which will indicate your specific task and the output from thinking through the task to provide meaningful instructions for other agents to enable them to execute their tasks',
        taskExpectedOutput: 'Provide output in expected format.'
    },
    {
        agentName: 'D3JSCodeValidator',
        agentType: 'processing',
        transactionId: 'tx-5-2',
        backstory: 'You are a D3.js code validator and quality assurance specialist.',
        taskDescription: 'Your role is to validate D3.js visualization code against requirements, check for errors, ensure best practices, and verify that the code will render correctly. You can call tools and read files.',
        taskExpectedOutput: 'Validation report indicating whether code meets requirements, list of any issues found, and corrected code if needed.'
    },
    {
        agentName: 'D3JSCodingAgent',
        agentType: 'processing',
        transactionId: 'tx-7',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: `You are a d3 js coding expert especially in graphical representation of data using csv file format. You will receive a set of user requirements and
         d3 js code implementing the d3 js code as per the requirements. Your tasks are:
         1. Check the code for errors. Your priority is to fix the errors
         2. Ensure the code aligns with the requirements. Where possible implement the desideratum
         If there are no errors and the requirments are implemented then output the code as is.
       `,
        taskExpectedOutput: `Javascript d3 js`
    },
    {
        agentName: 'ToolCallingAgent',
        agentType: 'tool',
        transactionId: 'tx-2-1',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: `You are a Python execution agent.

TOOL: execute_python
INPUT: Use the code from context.clean_code
ACTION: Call execute_python with the clean_code as the "code" argument

DO NOT generate placeholder code. Use ONLY the code provided in your context.
 `,
        taskExpectedOutput: 'Clean python code to be executed'
    },
    {
        agentName: 'DataFilteringAgent',
        agentType: 'tool',
        transactionId: 'tx-4',
        backstory: 'Filter and chunk data for processing pipeline.',
        taskDescription: 'Your task is to provide a user query to a data store. You must pass the query exactly as it is without modification.',
        taskExpectedOutput: 'Filtered data chunks ready for presentation processing'
    },
    {
        agentName: 'DataExtractingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-1',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Use the inputs provided to create Clean JSON. Only parse JSON and validate required fields exist',
        taskExpectedOutput: 'Provide  Flat list of validated records'
    },
    {
        agentName: 'DataNormalizingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-2',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Convert datetime to date strings',
        taskExpectedOutput: 'Provide same records with added "date" field (YYYY-MM-DD)'
    },
    {
        agentName: 'DataGroupingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-3',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Group by the parameters you are provided in <context>. Only focus on the grouped logic using the input parameters',
        taskExpectedOutput: 'Provide grouped structure grouped by the input parameters'
    },
    {
        agentName: 'DataAggregatingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-4',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Extract values array for each group. Focus only on array extraction. The parameters for the extraction are in <context>',
        taskExpectedOutput: 'Provide Final structure using the input parameters'
    },
    {
        agentName: 'DataSavingAgent',
        agentType: 'tool',
        transactionId: 'tx-5',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Iteratively call a tool to process chunks of data. Be sure to use the tool name you are given to call the correct tool ',
        taskExpectedOutput: 'You should expect feedback from the tool call operation'
    },
    {
        agentName: 'ValidatingAgent',
        agentType: 'processing',
        transactionId: 'tx-3',
        backstory: `Your role is to ensure rules are enforced in a JSON object. You act as validator and you report what needs
        to be amended in the JSON object that does not follow the rules.`,
        taskDescription: `Your role is part of a validation process`,
        taskExpectedOutput: 'Return expected output as instructed '
    }
];

/**
 * SDK Agents (Claude SDK with terminal/file access)
 * These are instantiated in dagExecutor.ts
 */
export const SDK_AGENTS = [
    'DataProfiler',
    'AgentStructureGenerator',
    'D3JSCodeGenerator',
    'D3JSCodeUpdater',
    'D3JSCodeValidator',
    'D3JSDataAnalyzer'
] as const;

/**
 * Helper function to get agent by name
 */
export function getAgentDefinition(agentName: string): LLMPromptConfig | undefined {
    return AGENT_DEFINITIONS.find(a => a.agentName === agentName);
}

/**
 * Helper function to get all agents of a specific type
 */
export function getAgentsByType(agentType: 'tool' | 'processing'): LLMPromptConfig[] {
    return AGENT_DEFINITIONS.filter(a => a.agentType === agentType);
}

/**
 * Helper function to check if agent is SDK agent
 */
export function isSDKAgent(agentName: string): boolean {
    return SDK_AGENTS.includes(agentName as any);
}
