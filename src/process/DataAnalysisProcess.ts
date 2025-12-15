// DataAnalysisProcess - Analyzes data using D3JSCoordinatingAgent
// Follows the same pattern as FlowProcess

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { userVizQuery, openaiPythonAnalysisResult } from '../test/histogramData.js'
import {  summaryAgentPrompt } from '../types/visualizationSaga.js'
/**
 * DataAnalysisProcess
 *
 * Executes D3JSCoordinatingAgent to analyze data
 *
 * Pattern:
 * 1. Get target agent's last result (data to analyze)
 * 2. Clear D3JSCoordinatingAgent contextvi
 * 3. Set context with data
 * 4. Execute D3JSCoordinatingAgent for analysis
 * 5. Store analysis result
 */
export class DataAnalysisProcess {
  private agent: GenericAgent;
  private contextManager: ContextManager;
  private userQuery: string;
  private targeAgentName: string;
  private visualizationPrompt: string;
  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string,
    targeAgentName: string
  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
    this.targeAgentName = targeAgentName
    this.visualizationPrompt = 'Your task is to extract the part of the user request which pertains to the d3 js visualization. The output will be formatted as JSON. Include a specific entry for the full file path';
  }

  /**
   * Execute data analysis
   */
  async execute(): Promise<AgentResult> {
    console.log('ANALYSIS TARGET ', this.targeAgentName)
    console.log(`\n📊 DataAnalysisProcess: Analyzing data with ${this.agent.getName()}`);

    // Execute agent for data analysis
    let result: AgentResult = {
      agentName: this.agent.getName(),
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
    if(this.agent.getName() === 'TransactionGroupingAgent'){
      console.log('HERE TRANS')
        this.agent.setTaskDescription(this.visualizationPrompt);
        result.result = userVizQuery//await this.agent.execute({'USER QUERY: ': this.userQuery})
        this.contextManager.updateContext(this.targeAgentName, {
        lastTransactionResult: {user_query: result.result},
        transactionId: this.agent.getId(),
        timestamp: new Date()
        });
    } else if(this.agent.getName() === 'D3JSDataAnalyzer'){
        const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
      //  const targetCtx = this.contextManager.getContext(this.targeAgentName) as WorkingMemory
console.log('D3 JS COOD 1', JSON.stringify(ctx.lastTransactionResult).substring(2, 90))
        this.contextManager.updateContext(this.targeAgentName, {
          //IS USER QUERY NEEDED
        lastTransactionResult: { data_analysis: ctx.lastTransactionResult },
        transactionId: this.agent.getId(),
        timestamp: new Date()
        });
    }
    else if(this.agent.getName() === 'D3JSCoordinatingAgent'){
        const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
        const targetCtx = this.contextManager.getContext(this.targeAgentName) as WorkingMemory;
console.log('D3 JS COOD 2', ctx.lastTransactionResult.data_analysis)
        this.agent.setTaskDescription( summaryAgentPrompt)
        result.result = openaiPythonAnalysisResult//await this.agent.execute({'DATA RESULTS: ': ctx.pythonAnalysis})//

        this.contextManager.updateContext(this.targeAgentName, {
        lastTransactionResult: { python_analysis: result.result },//data_analysis: ctx.lastTransactionResult.data_analysis, 
        transactionId: this.agent.getId(),
        timestamp: new Date()
        });
    }
      
   
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