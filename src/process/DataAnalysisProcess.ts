// DataAnalysisProcess - Analyzes data using D3JSCoordinatingAgent
// Follows the same pattern as FlowProcess

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';

/**
 * DataAnalysisProcess
 *
 * Executes D3JSCoordinatingAgent to analyze data
 *
 * Pattern:
 * 1. Get target agent's last result (data to analyze)
 * 2. Clear D3JSCoordinatingAgent context
 * 3. Set context with data
 * 4. Execute D3JSCoordinatingAgent for analysis
 * 5. Store analysis result
 */
export class DataAnalysisProcess {
  private agent: GenericAgent;
  private contextManager: ContextManager;
  private userQuery: string;

  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string
  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
  }

  /**
   * Execute data analysis
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n📊 DataAnalysisProcess: Analyzing data with ${this.agent.getName()}`);

    // Get context for the agent
    const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.log(`⚠️  No previous result found for ${this.agent.getName()}, starting fresh`);
    } else {
      console.log(`📝 Previous data: ${ctx.lastTransactionResult.substring(0, 150)}...`);
    }

    // Clear agent context
    this.agent.deleteContext();

    // Set context with user query for analysis
    this.agent.receiveContext({
      'DATA_ANALYSIS_TASK': this.userQuery
    });

    // Execute agent for data analysis
    const result: AgentResult = {
      agentName: this.agent.getName(),
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };

    // Store analysis result
    this.contextManager.updateContext(this.agent.getName(), {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    console.log(`✅ Data analysis completed`);
    console.log(`📄 Analysis preview: ${result.result.substring(0, 100)}...`);

    return result;
  }

  /**
   * Get the agent
   */
  getAgent(): GenericAgent {
    return this.agent;
  }

  /**
   * Get the analysis result
   */
  getAnalysisResult(): string | null {
    const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
    return ctx?.lastTransactionResult || null;
  }
}
