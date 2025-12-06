// ExecuteGenericAgentsProcess - Modified to use AgentDefinition[] instead of SagaTransaction[]
// This version shows how to replace SagaTransaction with AgentDefinition array from DataProfiler

import { GenericAgent } from '../agents/genericAgent.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AgentResult, WorkingMemory, AgentDefinition } from '../types/index.js';
import { CreatedAgentInfo } from '../agents/dataProfiler.js';
import { dataProfilerError, pythonSuccessResult } from '../test/histogramData.js';
import { ContextManager } from '../sublayers/contextManager.js';
import * as fs from 'fs';

/**
 * ExecuteGenericAgentsProcess - Modified Version
 *
 * This version accepts AgentDefinition[] (from DataProfiler's CreatedAgentInfo[])
 * instead of SagaTransaction[]
 *
 * Key Changes:
 * 1. Input: Array of AgentDefinition instead of TransactionSetCollection
 * 2. Uses AgentDefinition.name instead of SagaTransaction.agentName
 * 3. Uses AgentDefinition.agentType instead of SagaTransaction.agentType
 * 4. Uses AgentDefinition.taskDescription instead of SagaTransaction.transactionPrompt
 */
export class ExecuteGenericAgentsProcess_AgentDefinition {
  private agent: string;
  private contextManager: ContextManager;//coordinator: SagaCoordinator;
  private targetAgent: string;

  constructor(
    agent: string,
    contextManager: ContextManager,//coordinator: SagaCoordinator,
    targetAgent: string
  ) {
   this.agent = agent; // FlowDefiningAgent
    this.contextManager = contextManager;
    this.targetAgent = targetAgent;
  }

  /**
   * Execute generic agent using AgentDefinition array
   */
  async execute(): Promise<AgentResult> {
    const ctx = this.contextManager.getContext(this.agent) as WorkingMemory;

    // Parse the CreatedAgentInfo array (contains AgentDefinition objects)
    let agentDefinitions: AgentDefinition[];
    try {
      // DataProfiler stores CreatedAgentInfo[] which has structure: { definition: AgentDefinition, order: number }
      const createdAgentInfos: CreatedAgentInfo[] = JSON.parse(ctx.lastTransactionResult);

      // Extract and sort AgentDefinition objects by order
      agentDefinitions = createdAgentInfos
        .sort((a, b) => a.order - b.order)
        .map(info => info.definition);

      console.log('AGENT DEFINITIONS FROM DATAPROFILER', JSON.stringify(agentDefinitions, null, 2));
    } catch (error) {
      console.error('Failed to parse agent definitions:', error);
      console.error('Raw data:', ctx.lastTransactionResult);
      throw new Error('Invalid agent definition data');
    }

    // Get error state from context
    let hasError = false;
    let correctedCode = '';
    let agentInError = '';
    if (ctx.hasError) {
      hasError = true;
      correctedCode = ctx.codeInErrorResult;
      agentInError = ctx.agentInError;
    }

    console.log('AGENT IN ERROR ', agentInError);

    // Execute agents
    let result: AgentResult = {
      agentName: '',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };

    agentDefinitions.forEach(def => {
      console.log('EXEC NAME ', def.name);
    });

    if (agentDefinitions.length > 1) {
      result = await this.executeAgentsWithLinearContext(agentDefinitions, hasError, correctedCode, agentInError);
    }

    return result;
  }

  /**
   * Execute a single agent (singleton pattern)
   *
   * CHANGES FROM ORIGINAL:
   * - Parameter: AgentDefinition instead of SagaTransaction
   * - Uses: definition.name instead of transaction.agentName
   */
 /* private async executeAgentWithSingletonContext(
    definition: AgentDefinition
  ): Promise<AgentResult> {
    console.log('SINGLETON ', definition.name);

    // Look up the agent by name
    const agent = this.agent;//coordinator.agents.get(definition.name);

    if (!agent) {
      throw new Error(`Agent ${definition.name} not found`);
    }

    // Execute the agent
    const result =await  agent.execute({});

    console.log('🔍 Singleton execution result:', JSON.stringify(result, null, 2).substring(0, 300));

    // Store result in both agent's own context and target agent context
    this.contextManager.updateContext(this.agent.getName(), {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    console.log('target agent 1', this.targetAgent);
    this.contextManager.updateContext(this.targetAgent, {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    return result;
  }*/

  /**
   * Execute multiple agents in linear sequence
   *
   * CHANGES FROM ORIGINAL:
   * - Parameter: AgentDefinition[] instead of SagaTransaction[]
   * - Uses: definition.name instead of transaction.agentName
   * - Uses: definition.agentType instead of transaction.agentType
   * - Uses: definition.taskDescription for code extraction
   */
  private async executeAgentsWithLinearContext(
    agentDefinitions: AgentDefinition[],
    inError: boolean,
    correctedCode: string,
    inErrorAgent: string
  ): Promise<AgentResult> {
    const firstAgent = agentDefinitions[0].name;
    let result: AgentResult = {
      agentName: '',
      result: '',
      success: true,
      timestamp: new Date()
    };

  
    for (const definition of agentDefinitions) {
      console.log('LINEAR AGENT DEFINITION ', definition);
      console.log('LINEAR AGENT NAME', definition.name);
      console.log('LINEAR AGENT TYPE', definition.agentType);

      // CHANGE: Use definition.agentType instead of transaction.agentType
      if (definition.agentType === 'tool') {
        console.log(`🔧 Executing tool agent: ${definition.name}`);
        const toolCallingAgent = new GenericAgent(definition);
        toolCallingAgent.deleteContext();

        let cleanCode = '';

        // CHANGE: Check error using definition.name instead of transaction.agentName
        if (inError && inErrorAgent === definition.name) {
          cleanCode = this.cleanPythonCode(correctedCode).trim();
          console.log('CLEAN CODE EXEC (corrected)', cleanCode);
        } else {
          // CHANGE: Extract Python code from definition.taskDescription
          // DataProfiler stores Python code in taskDescription field
          cleanCode = this.cleanPythonCode(definition.taskDescription).trim();
          console.log('CLEAN CODE EXEC (from definition)', cleanCode);
        }

        try {
          // Execute the tool calling agent with the Python code
          result.result = pythonSuccessResult; // Replace with: await toolCallingAgent.execute({'CODE:': cleanCode})

          console.log('TOOL CALL ' + definition.name, result);
          console.log('TOOL CALL SUCCESS FLAG: ', result.success);

          if (!result.success) {
            // CHANGE: Store definition instead of transaction in error context
            this.contextManager.updateContext(this.targetAgent, {
              lastTransactionResult: result.result,
              codeInErrorResult: definition.taskDescription, // Store the task description (Python code)
              agentInError: definition.name, // Store agent name
              hasError: true,
              success: false,
              transactionId: '',
              timestamp: new Date()
            });
            result.error = result.result;
            break;
          }
        } catch (error) {
          console.error(`❌ Tool execution failed:`, error);
          result = {
            agentName: 'ToolCallingAgent',
            result: `Error: ${error}`,
            success: false,
            timestamp: new Date()
          };
          break;
        }
      }
    }

    console.log('RESULT_2', result.result);
    console.log('RESULT_2_1', result.success);

    // After all agents complete, retrieve persisted data
    if (result.success) {
      const persistedData = fs.readFileSync('C:/repos/SAGAMiddleware/data/histogramMCPResponse.txt', 'utf-8');
      if (persistedData) {
        console.log('📊 Persisted dictionary retrieved successfully');
        this.contextManager.updateContext(this.targetAgent, {
          lastTransactionResult: persistedData,
          hasError: false,
          success: true,
          transactionId: '',
          timestamp: new Date()
        });
        result.result = persistedData;
      }
    }

    return result;
  }

  /**
   * Clean Python code from string format
   * (Same as original - no changes needed)
   */
  private cleanPythonCode(rawCode: string): string {
    let cleaned = rawCode.trim();

    // Step 0: Check if the input is an object string (contains agentName, result, etc.)
    if (cleaned.includes('agentName:') && cleaned.includes('result:')) {
      const resultMatch = cleaned.match(/result:\s*(['"])([\s\S]*?)(?=,\s*(?:success|timestamp|\}))/);
      if (resultMatch) {
        cleaned = resultMatch[2];
        cleaned = resultMatch[1] + cleaned;
      }
    }

    // Step 1: Convert escaped newlines to actual newlines
    cleaned = cleaned.replace(/\\n/g, '\n');

    // Step 2: Remove string concatenation operators
    cleaned = cleaned.replace(/'\s*\+\s*\n\s*'/gm, '\n');
    cleaned = cleaned.replace(/"\s*\+\s*\n\s*"/gm, '\n');
    cleaned = cleaned.replace(/\s*\+\s*$/gm, '');

    // Step 3: Remove the first and last quotes
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^['"]/, '');
    cleaned = cleaned.replace(/['"]$/, '');

    // Step 4: Handle escaped quotes
    cleaned = cleaned.replace(/\\'/g, "'");
    cleaned = cleaned.replace(/\\"/g, '"');

    // Step 5: Convert backticks to single quotes
    cleaned = cleaned.replace(/`/g, "'");

    // Step 6: Clean up each line while preserving Python indentation
    const lines = cleaned.split('\n');
    const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
    cleaned = trimmedLines.join('\n').trim();

    return cleaned;
  }
}

/**
 * SUMMARY OF CHANGES:
 *
 * 1. INPUT FORMAT:
 *    OLD: TransactionSetCollection { sets: TransactionSet[] { transactions: SagaTransaction[] } }
 *    NEW: CreatedAgentInfo[] { definition: AgentDefinition, order: number }
 *
 * 2. FIELD MAPPINGS:
 *    - SagaTransaction.agentName     → AgentDefinition.name
 *    - SagaTransaction.agentType     → AgentDefinition.agentType
 *    - SagaTransaction.transactionPrompt → AgentDefinition.taskDescription
 *    - SagaTransaction.id            → AgentDefinition.id
 *
 * 3. BENEFITS:
 *    - Eliminates need for intermediate transformation
 *    - Direct use of DataProfiler output
 *    - Simpler data structure (no nested TransactionSetCollection)
 *    - Access to full AgentDefinition (llmConfig, mcpServers, etc.) if needed
 *
 * 4. USAGE:
 *    const process = new ExecuteGenericAgentsProcess_AgentDefinition(
 *      flowDefiningAgent,
 *      coordinator,
 *      'TargetAgent'
 *    );
 *    // Context should contain CreatedAgentInfo[] from DataProfiler
 *    const result = await process.execute();
 */
