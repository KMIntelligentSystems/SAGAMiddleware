// DataSummarizingProcess - Summarizes data using D3JSCoordinatingAgent
// Follows the same pattern as FlowProcess

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { globalDataProcessor } from '../processing/dataResultProcessor.js';
import { D3JSCoordinatingAgentAnalysis } from '../types/visualizationSaga.js'
import { D3JSCoordinatingAgentFinalResult } from '../test/testData.js'

/**
 * DataSummarizingProcess
 *
 * Executes D3JSCoordinatingAgent to summarize data
 *
 * Pattern:
 * 1. Get target agent's last result (data to summarize)
 * 2. Clear D3JSCoordinatingAgent context
 * 3. Set context with data
 * 4. Execute D3JSCoordinatingAgent for summarization
 * 5. Store summary result
 */
export class DataSummarizingProcess {
  private agent: GenericAgent;
  private contextManager: ContextManager;
  private userQuery: string;
  

  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string,
  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
  }

  /**
   * Execute data summarization
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n📋 DataSummarizingProcess: Summarizing data with ${this.agent.getName()}`);

    // Get context for the agent
    const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.log(`⚠️  No previous result found for ${this.agent.getName()}, starting fresh`);
    } else {
      console.log(`📝 Previous data: ${ctx.lastTransactionResult.substring(0, 150)}...`);
    }

    // Clear agent context
    this.agent.setTaskDescription(D3JSCoordinatingAgentAnalysis );
    this.agent.deleteContext();

    // Set context with user que)ry for summarization
    this.agent.receiveContext({
      'DATA_SUMMARIZATION_TASK': this.userQuery
    }); 
    
    const allStoredResults = globalDataProcessor.getAllResults();
            const resultEntries = Array.from(allStoredResults.entries());
            let i = 0;
            //receive the set of analysis results
            this.agent.receiveContext({'AGENT RESULTS:': ''});
            console.log('NUM ', resultEntries.length)
            resultEntries.forEach(entry =>{
              const res = `Iteration ${i++}:\n`;

              this.agent.receiveContext({res: entry});
            });


    // Execute agent for data summarization
  //  this.agent.execute({});
    const result: AgentResult = {
      agentName: this.agent.getName(),
      result: D3JSCoordinatingAgentFinalResult,
      success: true,
      timestamp: new Date()
    };

    // Store summary result
    this.contextManager.updateContext(this.agent.getName(), {
      dataGuidanceAnalysis: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    console.log(`✅ Data summarization completed`);
    console.log(`📄 Summary preview: ${result.result.substring(0, 100)}...`);

    return result;
  }

  /**
   * Get the agent
   */
  getAgent(): GenericAgent {
    return this.agent;
  }

  /**
   * Get the summary result
   */
  getSummaryResult(): string | null {
    const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
    return ctx?.lastTransactionResult || null;
  }
}
