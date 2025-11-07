import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import {agentDefinitionPrompt} from '../types/visualizationSaga.js';
import { flowDefiningAgentResult, flowData,d3jsFlowData } from '../test/testData.js';

export class FlowGeneratingProcess {
  private dataProfiler: string;
  private targetAgent: string;
  private contextManager: ContextManager;

  constructor(
     dataProfiler: string,
    targetAgent: string,
    contextManager: ContextManager
  ) {
    this. dataProfiler =  dataProfiler;
    this.targetAgent = targetAgent;
    this.contextManager = contextManager;
  }

  /**
   * Execute flow extraction
   */
  async execute(): Promise<AgentResult> {
    // Get target agent's last result (agent definitions)
    const ctx = this.contextManager.getContext(this. dataProfiler) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.error(`❌ Flow No result found for ${this.dataProfiler}`);
      return {
        agentName: this. dataProfiler,
        result: '',
        success: false,
        timestamp: new Date(),
        error: `No agent definitions found for ${this.dataProfiler}`
      };
    }

    console.log(`📝 Agent definitions: ${JSON.stringify(ctx.lastTransactionResult).substring(0, 150)}...`);

    // Clear flow defining agent context
   let result: AgentResult = {
      agentName: 'cycle_start',
      result: '',
      success: true,
      timestamp: new Date()
    };

    // Store flow result
    this.contextManager.updateContext(this.targetAgent, {
      lastTransactionResult: result.result,
      transactionId: 'tx-8',
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


}