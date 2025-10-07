// DataAnalysisProcess - Analyzes data using D3JSCoordinatingAgent
// Follows the same pattern as FlowProcess

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { CSVReader } from '../processing/csvReader.js';
import { aggregatorResult_1_1, aggregatorResult_1_2, aggregatorResult_1_3, aggregatorResult_1_4, aggregatorResult_1_5} from '../test/testData.js'
import { globalDataProcessor } from '../processing/dataResultProcessor.js';
//import * as fs from 'fs';
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
  private targeAgentName: string;

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
  }

  /**
   * Execute data analysis
   */
  async execute(): Promise<AgentResult> {
    console.log('ANALYSIS TARGET ', this.targeAgentName)
    console.log(`\n📊 DataAnalysisProcess: Analyzing data with ${this.agent.getName()}`);

    // Get context for the agent
    const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.log(`⚠️  No previous result found for ${this.agent.getName()}, starting fresh`);
    } else {
      console.log(`📝 Previous data: ${ctx.lastTransactionResult.substring(0, 150)}...`);
    }
    // Execute agent for data analysis
    const result: AgentResult = {
      agentName: this.agent.getName(),
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
    const targetCtx = this.contextManager.getContext(this.targeAgentName) as WorkingMemory;
    console.log('ANALYSIS LAST TRANS ', targetCtx.lastTransactionResult)
     console.log('ANALYSIS PREV TRANS ', targetCtx.previousTransactionResult)

    const csvReader = new CSVReader(0)
    csvReader.processFile(targetCtx.previousTransactionResult);
    const headerRow = csvReader.getHeaderRow();
     const results: string[] = [];
    let iteration = 0;
    let rows = csvReader.getNext20Rows();
    while(csvReader.hasMoreRows()){
      //  for (const transaction of chainTransactions/*executionOrder*/) {
          //TEST  
          if(iteration === 0){
              result.result = aggregatorResult_1_1.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }  if(iteration === 1){
              result.result = aggregatorResult_1_2.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }  if(iteration === 2){
              result.result = aggregatorResult_1_3.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }  if(iteration === 3){
              result.result = aggregatorResult_1_4.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          } if(iteration === 4){
              result.result = aggregatorResult_1_5.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }
          //End test
          // const result = await agent?.execute({'20 rows of data:': rows});
          if(result){
           // console.log('RESULT AGG', result.result)
            const cycleKey = `cycle_${iteration++}`;
            if(iteration < 5){
              globalDataProcessor.storeResult(cycleKey, {cleanedData: result.result});
            } 
            rows = csvReader.getNext20Rows();
            rows.unshift(headerRow);
          }
      }

    // Clear agent context
    this.agent.deleteContext();

    // Set context with user query for analysis
    this.agent.receiveContext({
      'DATA_ANALYSIS_TASK': this.userQuery
    });



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
  
/* private async executeSelfReferencingChain(
      chainTransactions: SagaTransaction[],
      request: BrowserGraphRequest
    ): Promise<AgentResult> {
      console.log(`🔄 Starting self-referencing chain with ${chainTransactions.length} agents`);
      let iteration = 0;
      // Find the self-referencing transaction (the one that iterates)
      const iteratingTransaction = chainTransactions.find(tx => 
        tx.dependencies.length === 1 && tx.dependencies[0] === tx.id
      );
      
      if (!iteratingTransaction) {
        console.error('❌ No self-referencing transaction found in chain');
        return {
          agentName: 'self_referencing_chain',
          result: null,
          success: false,
          error: 'No self-referencing transaction found',
          timestamp: new Date()
        };
      }
      
      // Execute the chain up to the self-referencing transaction first
      const preIterationTransactions = chainTransactions.filter(tx => tx.id !== iteratingTransaction.id);
      
      console.log(`📋 Pre-iteration transactions: ${preIterationTransactions.map(t => `${t.id}(${t.agentName})`).join(' → ')}`);
      console.log(`🔄 Iterating transaction: ${iteratingTransaction.id}(${iteratingTransaction.agentName})`);
      
      let finalResult: AgentResult = {
        agentName: 'chain_start',
        result: null,
        success: true,
        timestamp: new Date()
      };
   let result: AgentResult = {
        agentName: 'chain_start',
        result: null,
        success: true,
        timestamp: new Date()
      };
      // Execute pre-iteration transactions in reverse order (dependencies first)
      const executionOrder = [...preIterationTransactions].reverse();
      const agent = this.agents.get(iteratingTransaction.agentName);
      const headerRow = this.csvReader.getHeaderRow();
      console.log('HEADER', headerRow)
      const results: string[] = [];
   let rows = this.csvReader.getNext20Rows();
      while(this.csvReader.hasMoreRows()){
   
        if(iteration === 0){
            result.result = aggregatorResult_1_1.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }  if(iteration === 1){
            result.result = aggregatorResult_1_2.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }  if(iteration === 2){
            result.result = aggregatorResult_1_3.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }  if(iteration === 3){
            result.result = aggregatorResult_1_4.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } if(iteration === 4){
            result.result = aggregatorResult_1_5.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        //End test
        // const result = await agent?.execute({'20 rows of data:': rows});
        if(result){
          console.log('RESULT AGG', result.result)
         // results.push(result.result);
         //For test did not take into account last 5 rows only 20 rows rturned last 5 not but iterates anyway because currentPosition < 105
          const cycleKey = `cycle_${iteration++}`;
          if(iteration < 5){
            globalDataProcessor.storeResult(cycleKey, {cleanedData: result.result});
          } 
          rows = this.csvReader.getNext20Rows();
          rows.unshift(headerRow);
          finalResult = result;
           agent?.deleteContext();
        }
  
     // }
    }*/
     

     
      
   
    
}
