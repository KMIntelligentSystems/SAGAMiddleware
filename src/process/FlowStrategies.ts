/**
 * FlowStrategies.ts
 *
 * Strategy pattern implementation for handling different flow types in the pipeline.
 * Handles both GenericAgent (from genericAgent.ts) and SDK Agents (from baseSDKAgent.ts)
 */

import { GenericAgent } from '../agents/genericAgent.js';
import { BaseSDKAgent } from '../agents/baseSDKAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import * as fs from 'fs';

/**
 * Flow Strategy Interface
 * Each strategy handles a specific type of processing step
 */
export interface FlowStrategy {
    execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager,
        userQuery?: string,
        agentsRegistry?: Map<string, GenericAgent>
    ): Promise<AgentResult>;
}

/**
 * LLM Call Strategy
 * Executes a GenericAgent with an LLM call using a prompt from the config
 * Used for: Context preparation, data transformation, aggregation
 */
export const LLMCallStrategy: FlowStrategy = {
    async execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager,
        userQuery?: string
    ): Promise<AgentResult> {
        // Only GenericAgent can make LLM calls in this strategy
        if (!(agent instanceof GenericAgent)) {
            throw new Error(`LLMCallStrategy requires GenericAgent, got: ${agent.constructor.name}`);
        }

        console.log(`🔄 LLMCallStrategy: Executing ${agent.getName()} with LLM call`);

        // Clear agent's internal context to avoid contamination from previous executions
        agent.deleteContext();

        // Get the agent's context from ContextManager
        const agentCtx = contextManager.getContext(agent.getName()) as WorkingMemory;

        // Build context data from ContextManager (includes pythonAnalysis, userQuery, etc.)
        const contextData: Record<string, any> = {};
        if (agentCtx) {
            // Include all relevant context data
            if (agentCtx.lastTransactionResult) contextData.lastTransactionResult = agentCtx.lastTransactionResult;
            if (agentCtx.pythonAnalysis) contextData.pythonAnalysis = agentCtx.pythonAnalysis;
            if (agentCtx.userQuery) contextData.userQuery = agentCtx.userQuery;
        }

        // Add current userQuery if provided
        if (userQuery) {
            contextData.userQuery = userQuery;
        }

        console.log(`📦 Context data keys: ${Object.keys(contextData).join(', ')}`);

        // Execute GenericAgent with context from ContextManager
        const result = await agent.execute(contextData);

        // Store result in target agent's context
        contextManager.updateContext(targetAgent, {
            lastTransactionResult: result.result,
            transactionId: agent.getId(),
            timestamp: new Date()
        });

        console.log(`✅ LLMCallStrategy: Stored result in ${targetAgent} context`);
        return result;
    }
};

/**
 * Context Pass Strategy
 * Passes existing context from one agent to another without LLM calls
 * Used for: Routing SDK agent results to downstream agents
 */
export const ContextPassStrategy: FlowStrategy = {
    async execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager
    ): Promise<AgentResult> {
        console.log(`🔄 ContextPassStrategy: Passing context from ${agent.getName()} to ${targetAgent}`);

        // Get the agent's name (works for both GenericAgent and BaseSDKAgent)
        const agentName = agent.getName();

        // Retrieve source context
        const sourceContext = contextManager.getContext(agentName) as WorkingMemory;

        if (!sourceContext || !sourceContext.lastTransactionResult) {
            console.warn(`⚠️ No context found for ${agentName}, passing empty context`);
        }

        // Pass context to target agent
        contextManager.updateContext(targetAgent, {
            lastTransactionResult: sourceContext?.lastTransactionResult || {},
            transactionId: sourceContext?.transactionId || agentName,
            timestamp: new Date()
        });

        console.log(`✅ ContextPassStrategy: Context passed to ${targetAgent}`);

        return {
            agentName: agentName,
            result: sourceContext?.lastTransactionResult || {},
            success: true,
            timestamp: new Date()
        };
    }
};

/**
 * Execute Agents Strategy
 * Executes GenericAgents that were created by SDK agents (e.g., Python code agents from DataProfiler)
 * Used for: Running dynamically created agents with MCP tool execution
 *
 * This strategy handles:
 * 1. Tool agents (Python code execution via MCP)
 * 2. Regular GenericAgents (LLM-based agents)
 */
export const ExecuteAgentsStrategy: FlowStrategy = {
    async execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager,
        userQuery?: string,
        agentsRegistry?: Map<string, GenericAgent>
    ): Promise<AgentResult> {
        console.log(`🔄 ExecuteAgentsStrategy: Executing agents created by ${agent.getName()}`);

        // Get the ToolCallingAgent from the registry
        const toolCallingAgent = agentsRegistry?.get('ToolCallingAgent');
        if (!toolCallingAgent) {
            throw new Error('ToolCallingAgent not found in registry. Required for Python execution.');
        }

        // Get the agent's name
        const agentName = agent.getName();

        // Retrieve context containing agent definitions
        const ctx = contextManager.getContext(agentName) as WorkingMemory;

        if (!ctx || !ctx.lastTransactionResult) {
            throw new Error(`No agent definitions found in ${agentName} context`);
        }

        // Parse agent definitions (CreatedAgentInfo[] from DataProfiler)
        let agentDefinitions: any[];
        try {
            agentDefinitions = JSON.parse(ctx.lastTransactionResult);
            console.log(`📋 Found ${agentDefinitions.length} agent definitions to execute`);
        } catch (error) {
            throw new Error(`Failed to parse agent definitions from ${agentName}: ${error}`);
        }

        // Execute each GenericAgent sequentially
        let finalResult: AgentResult = {
            agentName: 'ExecuteAgentsStrategy',
            result: {},
            success: true,
            timestamp: new Date()
        };

        for (const agentInfo of agentDefinitions) {
            const definition = agentInfo.definition || agentInfo;
            console.log(`🔧 Executing GenericAgent: ${definition.name} (type: ${definition.agentType})`);

            // Handle tool agents (Python execution via MCP)
            if (definition.agentType === 'tool') {
                // Use the existing ToolCallingAgent from registry (already configured with MCP)
                console.log(`🔧 Using ToolCallingAgent from registry for ${definition.name}`);

                // Extract and clean Python code from taskDescription
                const pythonCode = cleanPythonCode(definition.taskDescription);
                console.log(`📝 Python code extracted (${pythonCode.length} chars)`);

                // Clear any previous context from ToolCallingAgent
                toolCallingAgent.deleteContext();

                // Execute with Python code in context
                const result = await toolCallingAgent.execute({ 'CODE:': pythonCode });

                if (!result.success) {
                    console.error(`❌ Tool agent ${definition.name} failed:`, result.error);

                    // Store error in target context
                    contextManager.updateContext(targetAgent, {
                        lastTransactionResult: result.result,
                        codeInErrorResult: definition.taskDescription,
                        agentInError: definition.name,
                        hasError: true,
                        success: false,
                        transactionId: agentName,
                        timestamp: new Date()
                    });

                    finalResult = result;
                    break;
                }

                finalResult = result;
                console.log(`✅ Tool agent ${definition.name} completed successfully`);
            } else {
                // Handle regular GenericAgents (non-tool agents)
                const genericAgent = new GenericAgent(definition);
                const result = await genericAgent.execute({});

                if (!result.success) {
                    console.error(`❌ Agent ${definition.name} failed:`, result.error);
                    finalResult = result;
                    break;
                }

                finalResult = result;
                console.log(`✅ Agent ${definition.name} completed successfully`);
            }
        }
finalResult.result = fs.readFileSync('C:/repos/SAGAMiddleware/data/histogramMCPResponse_2.txt', 'utf-8');
        // Store final result in target agent's context
        console.log('EXECUTIONSTRATEGY', targetAgent)
        contextManager.updateContext(targetAgent, {
            lastTransactionResult: finalResult.result,
            hasError: !finalResult.success,
            success: finalResult.success,
            transactionId: agentName,
            timestamp: new Date()
        });

        console.log(`✅ ExecuteAgentsStrategy: Results stored in ${targetAgent} context`);
        return finalResult;
    }
};

/**
 * Helper: Clean Python code from string format
 * Handles escaped newlines, string concatenation, quotes, etc.
 */
function cleanPythonCode(rawCode: string): string {
    let cleaned = rawCode.trim();

    // Remove object wrapper if present
    if (cleaned.includes('agentName:') && cleaned.includes('result:')) {
        const resultMatch = cleaned.match(/result:\s*(['"])([\s\S]*?)(?=,\s*(?:success|timestamp|\}))/);
        if (resultMatch) {
            cleaned = resultMatch[2];
            cleaned = resultMatch[1] + cleaned;
        }
    }

    // Convert escaped newlines to actual newlines
    cleaned = cleaned.replace(/\\n/g, '\n');

    // Remove string concatenation
    cleaned = cleaned.replace(/'\s*\+\s*\n\s*'/gm, '\n');
    cleaned = cleaned.replace(/"\s*\+\s*\n\s*"/gm, '\n');
    cleaned = cleaned.replace(/\s*\+\s*$/gm, '');

    // Remove outer quotes
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^['"]/, '');
    cleaned = cleaned.replace(/['"]$/, '');

    // Handle escaped quotes
    cleaned = cleaned.replace(/\\'/g, "'");
    cleaned = cleaned.replace(/\\"/g, '"');

    // Convert backticks to single quotes
    cleaned = cleaned.replace(/`/g, "'");

    // Clean up lines while preserving Python indentation
    const lines = cleaned.split('\n');
    const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
    cleaned = trimmedLines.join('\n').trim();

    return cleaned;
}

/**
 * SDK Agent Strategy
 * Executes a Claude SDK Agent (DataProfiler, D3JSDataAnalyzer, etc.)
 * Used for: Complex reasoning, code generation, file analysis
 */
export const SDKAgentStrategy: FlowStrategy = {
    async execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager
    ): Promise<AgentResult> {
        // Only SDK agents allowed in this strategy
        if (!(agent instanceof BaseSDKAgent)) {
            throw new Error(`SDKAgentStrategy requires BaseSDKAgent, got: ${agent.constructor.name}`);
        }

        console.log(`🔄 SDKAgentStrategy: Executing SDK agent ${agent.getName()}`);

        // Execute SDK agent (it will read its input from contextManager)
        const result = await agent.execute({});

        // Store result in target agent's context (or its own if no target specified)
        const target = targetAgent || agent.getName();
        contextManager.updateContext(target, {
            lastTransactionResult: result.result,
            transactionId: agent.getName(),
            timestamp: new Date()
        });

        console.log(`✅ SDKAgentStrategy: ${agent.getName()} completed, stored in ${target} context`);
        return result;
    }
};

/**
 * Validation Strategy
 * Executes a validation agent and merges its analysis with existing code/data from its context
 * Used for: Validation flows where validator needs to combine its analysis with previous step's output
 *
 * Pattern:
 * - Validator agent's context contains CODE (from previous step)
 * - Validator executes and produces ANALYSIS
 * - Both are merged and stored in target agent's context as { ANALYSIS, CODE }
 */
export const ValidationStrategy: FlowStrategy = {
    async execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager,
        userQuery?: string
    ): Promise<AgentResult> {
        if (!(agent instanceof GenericAgent)) {
            throw new Error(`ValidationStrategy requires GenericAgent, got: ${agent.constructor.name}`);
        }

        console.log(`🔄 ValidationStrategy: Executing ${agent.getName()} for validation`);

        // Execute validation agent
        const result = await agent.execute({ userQuery: userQuery || '' });

        // Get CODE/data from validator's own context (stored by previous step)
        const validatorCtx = contextManager.getContext(agent.getName()) as WorkingMemory;
        const code = validatorCtx?.lastTransactionResult || '';

        console.log(`📦 ValidationStrategy: Merging ANALYSIS with CODE from ${agent.getName()} context`);

        // Store merged result in target agent's context
        contextManager.updateContext(targetAgent, {
            lastTransactionResult: {
                ANALYSIS: result.result,  // Validator's analysis
                CODE: code                // Code/data from previous step
            },
            transactionId: agent.getId(),
            timestamp: new Date()
        });

        console.log(`✅ ValidationStrategy: Merged result stored in ${targetAgent} context`);
        return result;
    }
};

/**
 * Strategy Registry
 * Maps flowType strings to their corresponding strategy implementations
 */
export const FLOW_STRATEGIES: Record<string, FlowStrategy> = {
    'llm_call': LLMCallStrategy,
    'context_pass': ContextPassStrategy,
    'execute_agents': ExecuteAgentsStrategy,
    'sdk_agent': SDKAgentStrategy,
    'validation': ValidationStrategy
};

/**
 * Get a flow strategy by type
 * @param flowType - The type of flow ('llm_call', 'context_pass', etc.)
 * @returns The corresponding FlowStrategy implementation
 * @throws Error if flowType is unknown
 */
export function getFlowStrategy(flowType: string): FlowStrategy {
    const strategy = FLOW_STRATEGIES[flowType];

    if (!strategy) {
        throw new Error(`Unknown flowType: ${flowType}. Valid types: ${Object.keys(FLOW_STRATEGIES).join(', ')}`);
    }

    return strategy;
}
