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
import { getPrompt, hasPrompt } from '../config/promptRegistry.js';
import { validateWorkflowRequirements } from '../tools/workflowRequirementsBuilder.js';
import { opusPythonAnalysisResult_Jan_02,  openaiPythonAnalysisResult_Jan_02, openaiD3JSCodingAgentPrompt_Jan_02 , openaiDataProfilerPrompt_Jan_02, opusD3JSCodingAgentPrompt_Jan_02  } from '../test/histogramData.js'
import { AgentPromptArray } from '../agents/promptGeneratorAgent.js';

/**
 * Flow Strategy Interface
 * Each strategy handles a specific type of processing step
 */
export interface FlowStrategy {
    execute(
        agent: GenericAgent | BaseSDKAgent,
        targetAgent: string,
        contextManager: ContextManager,
        source: string,  // Source agent name for context tracking
        userQuery?: any,
        agentsRegistry?: Map<string, GenericAgent>,
        nodeMetadata?: any,  // Target node metadata for prompt injection
        prompts?: AgentPromptArray
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
        source: string,
        userQuery?: any,
        agentsRegistry?: Map<string, GenericAgent>,
        nodeMetadata?:any,
        prompts?: AgentPromptArray
    ): Promise<AgentResult> {
        // Only GenericAgent can make LLM calls in this strategy
        console.log(`🔍 LLMCallStrategy received agent:`, {
            name: agent.getName ? agent.getName() : 'NO getName',
            constructor: agent.constructor.name,
            isGenericAgent: agent instanceof GenericAgent,
            targetAgent: targetAgent
        });

        if (!(agent instanceof GenericAgent)) {
            throw new Error(`LLMCallStrategy requires GenericAgent, got: ${agent.constructor.name} (name: ${agent.getName ? agent.getName() : 'unknown'})`);
        }

        console.log(`🔄 LLMCallStrategy: Executing ${agent.getName()} with LLM call`);

           console.log('USER QUERY ', userQuery)


        // Get the agent's context from ContextManager BEFORE clearing
        const agentCtx = contextManager.getContext(source) as WorkingMemory;
         
        // Extract prompt for targetAgent from prompts array
        let targetPrompt = '';
        if (prompts && Array.isArray(prompts)) {
            const promptEntry = prompts.find(item => item.agentName === agent.getName());
            if (promptEntry) {
                targetPrompt = promptEntry.prompt;
                console.log(`📝 LLMCallStrategy: Found prompt for ${agent.getName()} (${targetPrompt.length} chars)`);
            } else {
                console.warn(`⚠️ No prompt found for ${agent.getName()} in prompts array`);
            }
        }

        // Clear agent's internal context to avoid contamination from previous executions
        let result: AgentResult = {
            agentName: 'cycle_start',
            result: '',
            success: true,
            timestamp: new Date()
          };
          
       agent.setTaskDescription(targetPrompt)
       result = await agent.execute({'last result':agentCtx.lastTransactionResult,'User Information': agentCtx.userQuery});
     console.log('RESULT ', result.result)

        // Store result in target agent's context
        contextManager.updateContext(targetAgent, {
            lastTransactionResult: result.result,
            transactionId: agent.getId(),
            timestamp: new Date()
        });

        console.log(`✅ LMCaLllStrategy: Stored result in ${targetAgent} context`);
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
        contextManager: ContextManager,
        source: string,
        userQuery?: string,
        agentsRegistry?: Map<string, GenericAgent>,
        nodeMetadata?: any,
        prompts?: AgentPromptArray
    ): Promise<AgentResult> {
        if(agent.getName() === 'UserInput'){
           await agent.execute({});
        }

        console.log(`🔄 ContextPassStrategy: Passing context from ${agent.getName()} to ${targetAgent}`);

        // Get the agent's name (works for both GenericAgent and BaseSDKAgent)
        const agentName = agent.getName();

        // Retrieve source context
        const sourceContext = contextManager.getContext(agentName) as WorkingMemory;
        //This is the user workflow requirements
        console.log('SOURCE ', sourceContext?.lastTransactionResult)
        console.log('SOURCE USER ', sourceContext?.userQuery)

        if (!sourceContext || !sourceContext.lastTransactionResult) {
            console.warn(`⚠️ No context found for ${agentName}, passing empty context`);
        }

        // Extract prompt for targetAgent from prompts array
        let targetPrompt = '';
        if (prompts && Array.isArray(prompts)) {
            const promptEntry = prompts.find(item => item.agentName === targetAgent);
            if (promptEntry) {
                targetPrompt = promptEntry.prompt;
                console.log(`📝 ContextPassStrategy: Found prompt for ${targetAgent} (${targetPrompt.length} chars)`);
            } else {
                console.warn(`⚠️ No prompt found for ${targetAgent} in prompts array`);
            }
        }

        // Pass context to target agent with extracted prompt
        contextManager.updateContext(targetAgent, {
            lastTransactionResult: sourceContext?.lastTransactionResult || {},      //This is the user workflow requirements
            prompt: targetPrompt,
            userQuery:  sourceContext?.userQuery,
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
        source: string,
        userQuery?: string,
        agentsRegistry?: Map<string, GenericAgent>,
        nodeMetadata?: any,
        prompts?: AgentPromptArray
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
        await agent.execute({});
        const ctx = contextManager.getContext(agentName) as WorkingMemory;

        // Create GenericAgents from the agent definitions
        // ctx.lastTransactionResult contains the array of CreatedAgentInfo from DataProfiler
        const agentDefinitions = ctx.lastTransactionResult;

        if (!Array.isArray(agentDefinitions)) {
            throw new Error(`Expected agent definitions to be an array, got: ${typeof agentDefinitions}`);
        }
     
        const genericAgents = createGenericAgentsFromDefinitions(agentDefinitions);

        console.log(`✅ Created ${genericAgents.length} GenericAgent(s) with taskDescription in context`);

        // Display all agents and their contexts
        console.log('\n📋 All Created Agents:');
        genericAgents.forEach((agent, index) => {
            console.log(`\n[${index + 1}] Agent: ${agent.getName()}`);
            console.log(`    ID: ${agent.getId()}`);
            console.log(`    Type: ${agent.getAgentDefinition().agentType}`);
            console.log(`    Context:`, agent.getContext());
            console.log(`    Dependencies:`, agent.getDependencies());
        });

        // Execute the generic agents with linear context (adapted from ExecuteGenericAgentsProcess)
        const executionResult = await executeGenericAgentsWithLinearContext(
            genericAgents,
            toolCallingAgent,
            contextManager,
            targetAgent,
            agentName
        );

           // Validate that Python code output
           let result: AgentResult = {
            agentName: 'cycle_start',
            result: '',
            success: true,
            timestamp: new Date()
          };
//  
        const validatingCtx = contextManager.getContext(targetAgent);
        const prompt = getPrompt('D3ReadyAnalysis');
        const validatingAgent = agentsRegistry?.get(targetAgent);
        validatingAgent.setTaskDescription(prompt);
        result.result = openaiPythonAnalysisResult_Jan_02//opusPythonAnalysisResult_Jan_02//await validatingAgent.execute({'ANALYZE THE PROVIDED INFORMATION': validatingCtx.lastTransactionResult})
        contextManager.updateContext(targetAgent, {lastTransactionResult: result.result})

        console.log(`✅ ExecuteAgentsStrategy: Results stored in ${targetAgent} context`);
        return executionResult;
    }
};

/**
 * Helper: Create GenericAgents from agent definitions with taskDescription in context
 * Used by ExecuteAgentsStrategy to convert DataProfiler output into runnable agents
 *
 * @param agentDefinitions - Array of AgentDefinition objects (or CreatedAgentInfo objects with .definition property)
 * @returns Array of GenericAgent instances with taskDescription in their context
 */
export function createGenericAgentsFromDefinitions(agentDefinitions: any[]): GenericAgent[] {
    console.log('🔧 Creating GenericAgents from agent definitions');
    console.log(`📋 Found ${agentDefinitions.length} agent definition(s) to convert`);

    const genericAgents: GenericAgent[] = [];

    for (const agentInfo of agentDefinitions) {
        // Handle both AgentDefinition directly or CreatedAgentInfo with .definition property
        const definition = agentInfo.definition || agentInfo;

        if (!definition.name || !definition.taskDescription) {
            console.error('Invalid agent definition:', agentInfo);
            throw new Error('Agent definition must have name and taskDescription');
        }

        console.log(`🤖 Creating GenericAgent for: ${definition.name} (type: ${definition.agentType})`);

        // Extract the Python code from taskDescription before modifying it
        const pythonCode = definition.taskDescription;

        // Modify the definition to set taskDescription to placeholder
        const modifiedDefinition = {
            ...definition,
            taskDescription: 'To be completed'
        };

        // Create the GenericAgent instance with modified definition
        const genericAgent = new GenericAgent(modifiedDefinition);

        // Set the Python code into the agent's context
        const contextMessage = `Task: ${pythonCode}`;
        genericAgent.setContext(contextMessage);
        console.log(`✅ Set Python code in context for ${definition.name}`);

        genericAgents.push(genericAgent);
    }

    console.log(`✅ Created ${genericAgents.length} GenericAgent instance(s)`);
    return genericAgents;
}

/**
 * Execute generic agents sequentially with linear context propagation
 * Adapted from ExecuteGenericAgentsProcess.executeSagaTransactionWithLinearContext
 *
 * @param genericAgents - Array of GenericAgent instances to execute
 * @param toolCallingAgent - The tool calling agent for Python execution
 * @param contextManager - Context manager for storing results
 * @param targetAgent - Target agent name for context updates
 * @param sourceAgent - Source agent name (e.g., DataProfiler)
 * @returns Final execution result
 */
async function executeGenericAgentsWithLinearContext(
    genericAgents: GenericAgent[],
    toolCallingAgent: GenericAgent,
    contextManager: ContextManager,
    targetAgent: string,
    sourceAgent: string
): Promise<AgentResult> {
    console.log(`🔄 Executing ${genericAgents.length} agents with linear context propagation`);

    let finalResult: AgentResult = {
        agentName: 'ExecuteGenericAgentsWithLinearContext',
        result: '',
        success: true,
        timestamp: new Date()
    };

    // Check if we're recovering from an error
    const ctx = contextManager.getContext(targetAgent) as WorkingMemory;
    let inError = false;
    let correctedCode = '';
    let agentInError = '';

    if (ctx && ctx.hasError) {
        inError = true;
        correctedCode = ctx.codeInErrorResult;
        agentInError = ctx.agentInError;
        console.log(`⚠️ Recovering from error in agent: ${agentInError}`);
    }

    // Execute each agent sequentially
    for (const agent of genericAgents) {
        const agentName = agent.getName();
        const agentDef = agent.getAgentDefinition();

        console.log(`\n🔧 Executing agent: ${agentName} (type: ${agentDef.agentType})`);

        if (agentDef.agentType === 'tool') {
            // Clear previous context from tool calling agent
            toolCallingAgent.deleteContext();

            let pythonCode = '';

            // If recovering from error and this is the agent that failed, use corrected code
            if (inError && agentInError === agentName) {
                pythonCode = cleanPythonCodeForExecution(correctedCode).trim();
                console.log(`📝 Using corrected code for ${agentName}`);
            } else {
                // Extract Python code from agent's context
                const agentContext = agent.getContext();
                if (agentContext && agentContext.length > 0) {
                    // Context is stored as ["Task: <python_code>"]
                    const contextStr = agentContext[0];
                    if (contextStr.startsWith('Task: ')) {
                        pythonCode = contextStr.substring(6).trim();
                    } else {
                        pythonCode = contextStr.trim();
                    }
                }
                console.log(`📝 Extracted Python code from context (${pythonCode.length} chars)`);
            }

            try {
                // Execute the Python code via ToolCallingAgent
                const result = await toolCallingAgent.execute({ 'CODE:': pythonCode });

                console.log(`✅ Tool agent ${agentName} execution result:`, {
                    success: result.success,
                    resultLength: result.result?.length || 0
                });

                if (!result.success) {
                    // Store error state in target context
                    contextManager.updateContext(targetAgent, {
                        lastTransactionResult: result.result,
                        codeInErrorResult: pythonCode,
                        agentInError: agentName,
                        hasError: true,
                        success: false,
                        transactionId: sourceAgent,
                        timestamp: new Date()
                    });

                    finalResult = {
                        agentName,
                        result: result.result,
                        success: false,
                        error: result.error || result.result,
                        timestamp: new Date()
                    };

                    console.error(`❌ Agent ${agentName} failed:`, result.error);
                    break;
                }

                // Store successful result
                finalResult = result;

            } catch (error) {
                console.error(`❌ Tool execution failed for ${agentName}:`, error);
                finalResult = {
                    agentName,
                    result: `Error: ${error}`,
                    success: false,
                    timestamp: new Date()
                };
                break;
            }
        } else {
            // Handle non-tool agents (processing agents)
            console.log(`⚙️ Executing processing agent: ${agentName}`);
            try {
                const result = await agent.execute({});
                if (!result.success) {
                    console.error(`❌ Agent ${agentName} failed:`, result.error);
                    finalResult = result;
                    break;
                }
                finalResult = result;
            } catch (error) {
                console.error(`❌ Agent execution failed for ${agentName}:`, error);
                finalResult = {
                    agentName,
                    result: `Error: ${error}`,
                    success: false,
                    timestamp: new Date()
                };
                break;
            }
        }
    }

    // If all agents succeeded, retrieve the persisted result
    if (finalResult.success) {
        console.log('✅ All agents completed successfully');

        // Read the final result from the persisted file
        try {
            const persistedData = fs.readFileSync('C:/repos/SAGAMiddleware/data/histogramMCPResponse_3.txt', 'utf-8');
            console.log('📊 Persisted dictionary retrieved successfully', targetAgent);

            finalResult.result = persistedData;

            // Update target context with final success state
            contextManager.updateContext(targetAgent, {
                lastTransactionResult: persistedData,
                hasError: false,
                success: true,
                transactionId: sourceAgent,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('⚠️ Could not read persisted result file:', error);
            // Continue with existing result if file read fails
        }
    }

    return finalResult;
}

/**
 * Clean Python code for execution
 * Simplified version adapted from ExecuteGenericAgentsProcess
 */
function cleanPythonCodeForExecution(rawCode: string): string {
    let cleaned = rawCode.trim();

    // Check if the input is an object string (contains agentName, result, etc.)
    if (cleaned.includes('agentName:') && cleaned.includes('result:')) {
        const resultMatch = cleaned.match(/result:\s*(['"])([\s\S]*?)(?=,\s*(?:success|timestamp|\}))/);
        if (resultMatch) {
            cleaned = resultMatch[2];
            cleaned = resultMatch[1] + cleaned;
        }
    }

    // Convert escaped newlines to actual newlines
    cleaned = cleaned.replace(/\\n/g, '\n');

    // Remove string concatenation operators
    cleaned = cleaned.replace(/'\s*\+\s*\n\s*'/gm, '\n');
    cleaned = cleaned.replace(/"\s*\+\s*\n\s*"/gm, '\n');
    cleaned = cleaned.replace(/\s*\+\s*$/gm, '');

    // Remove first and last quotes
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^['"]/, '');
    cleaned = cleaned.replace(/['"]$/, '');

    // Handle escaped quotes
    cleaned = cleaned.replace(/\\'/g, "'");
    cleaned = cleaned.replace(/\\"/g, '"');

    // Clean up lines while preserving Python indentation
    const lines = cleaned.split('\n');
    const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
    cleaned = trimmedLines.join('\n').trim();

    return cleaned;
}

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
        contextManager: ContextManager,
        source: string,
        userQuery?: string,
        agentsRegistry?: Map<string, GenericAgent>,
        nodeMetadata?: any,
        prompts?: AgentPromptArray
    ): Promise<AgentResult> {
        // Only SDK agents allowed in this strategy
        if (!(agent instanceof BaseSDKAgent)) {
            throw new Error(`SDKAgentStrategy requires BaseSDKAgent, got: ${agent.constructor.name}`);
        }

        console.log(`🔄 SDKAgentStrategy: Executing SDK agent ${agent.getName()}`);

          let targetPrompt = '';
        if (prompts && Array.isArray(prompts)) {
            const promptEntry = prompts.find(item => item.agentName === agent.getName());
            if (promptEntry) {
                targetPrompt = promptEntry.prompt;
                console.log(`📝 SDKAgentStrategy: Found prompt for ${agent.getName()} (${targetPrompt.length} chars)`);
            } else {
                console.warn(`⚠️ No prompt found for ${agent.getName()} in prompts array`);
            }
        }
        const ctx = contextManager.getContext(agent.getName());
        contextManager.updateContext(agent.getName(),{prompt: targetPrompt})
        // Execute SDK agent (it will read its input from contextManager)
        const result = await agent.execute({});

        // Store result in target agent's context (or its own if no target specified)
        const target = targetAgent || agent.getName();
        contextManager.updateContext(target, {
            lastTransactionResult: result.result,
            userQuery: ctx.lastTransactionResult,
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
        source: string,
        userQuery?: string,
        agentsRegistry?: Map<string, GenericAgent>,
        nodeMetadata?: any
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
