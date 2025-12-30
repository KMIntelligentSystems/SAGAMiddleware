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
        taskDescription: `Your role is to receive workflow requirements as formatted JSON and provide a natural language summary of the requirements
        focusing closely on objectives and information relevamt to that objective. This information will be provided as a prompt to a data analyzing agent.
        So the first agent and next will be relevant but the other agents will have other concerns not directly relevant to data analysis`,
        taskExpectedOutput: 'Report as directed'
    },
   {
        agentName: 'DataProfiler',
        agentType: 'processing',
        transactionId: 'tx-2-2',
        backstory: 'You analyze data files and generate technical specifications.',
        taskDescription: `Your role is to analyze CSV data files, understand their structure, identify data patterns, and generate agents provided with Python code for specific data analytical tasks. 
        You will use a tool to generate these agents.`,
        taskExpectedOutput: 'Generated agents with specific Python code in their taskDescription field'
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
        agentName: 'ValidatingAgent',
        agentType: 'processing',
        transactionId: 'tx-3',
        backstory: `Your role is to ensure rules are enforced in a JSON object. You act as validator and you report what needs
        to be amended in the JSON object that does not follow the rules.`,
        taskDescription: `Your role is part of a validation process`,
        taskExpectedOutput: 'Return expected output as instructed '
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
