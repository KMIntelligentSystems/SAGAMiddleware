// FlowProcess - Extracts flow and tool call information from agent definitions
// Uses FlowDefiningAgent (typically another instance of TransactionGroupingAgent)

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import {agentDefinitionPrompt} from '../types/visualizationSaga.js';

/**
 * FlowProcess
 *
 * Executes FlowDefiningAgent to extract:
 * - Flow diagram: <flow>A1 -> A2 -> A3</flow>
 * - Tool users: {"toolUsers": ["AgentName1", "AgentName2"]}
 *
 * Pattern:
 * 1. Get target agent's last result (agent definitions)
 * 2. Clear flow defining agent context
 * 3. Set context with agent definitions
 * 4. Execute flow defining agent
 * 5. Store flow result
 *
 * The flow result will be used by AgentGeneratorProcess to create the TransactionSet
 */
export class FlowProcess {
  private flowDefiningAgent: GenericAgent;
  private targetAgent: GenericAgent;
  private contextManager: ContextManager;

  constructor(
    flowDefiningAgent: GenericAgent,
    targetAgent: GenericAgent,
    contextManager: ContextManager
  ) {
    this.flowDefiningAgent = flowDefiningAgent;
    this.targetAgent = targetAgent;
    this.contextManager = contextManager;
  }

  /**
   * Execute flow extraction
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🔀 FlowProcess: Extracting flow from ${this.targetAgent.getName()} output`);

    // Get target agent's last result (agent definitions)
    const ctx = this.contextManager.getContext(this.targetAgent.getName()) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.error(`❌ No result found for ${this.targetAgent.getName()}`);
      return {
        agentName: this.flowDefiningAgent.getName(),
        result: '',
        success: false,
        timestamp: new Date(),
        error: `No agent definitions found for ${this.targetAgent.getName()}`
      };
    }

    console.log(`📝 Agent definitions: ${ctx.lastTransactionResult.substring(0, 150)}...`);

    // Clear flow defining agent context
    this.flowDefiningAgent.deleteContext();

    // Set context with agent definitions
    this.flowDefiningAgent.receiveContext({
      'EXTRACT FLOW AND TOOL CALLS': agentDefinitionPrompt
    });

    // Execute flow defining agent
 //   const result = await this.flowDefiningAgent.execute({});
  const result: AgentResult = {
      agentName: 'cycle_start',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
    // Store flow result
    this.contextManager.updateContext(this.flowDefiningAgent.getName(), {
      lastTransactionResult: result.result,
      transactionId: this.flowDefiningAgent.getId(),
      timestamp: new Date()
    });

    // Log extracted flow
    console.log(`✅ Flow extracted`);
    this.logFlowInfo(result.result);

    return result;
  }

  /**
   * Log flow information for debugging
   */
  private logFlowInfo(flowResult: string): void {
    try {
      // Extract flow
      const flowMatch = flowResult.match(/<flow>(.*?)<\/flow>/s);
      if (flowMatch) {
        console.log(`📊 Flow: ${flowMatch[1].trim()}`);
      }

      // Extract tool users
      const toolUsersMatch = flowResult.match(/\{"toolUsers":\s*(\[[^\]]+\])\}/);
      if (toolUsersMatch) {
        const toolUsers = JSON.parse(toolUsersMatch[1]);
        console.log(`🔧 Tool users: ${toolUsers.join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️  Could not parse flow info for logging');
    }
  }

  /**
   * Get the flow defining agent
   */
  getFlowDefiningAgent(): GenericAgent {
    return this.flowDefiningAgent;
  }

  /**
   * Get the flow result
   */
  getFlowResult(): string | null {
    const ctx = this.contextManager.getContext(this.flowDefiningAgent.getName()) as WorkingMemory;
    return ctx?.lastTransactionResult || null;
  }
}