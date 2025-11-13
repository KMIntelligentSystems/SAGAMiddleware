// ExecuteGenericAgentsProcess - Executes generic agents in sequence
// Follows the same pattern as FlowProcess

import { GenericAgent } from '../agents/genericAgent.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { TransactionSetCollection, TransactionSet, SagaTransaction } from '../types/visualizationSaga.js';
import {  D3JSCoordinatingAgentFinalResult, D3JSCodeingAgentReuslt, graphAnalyzerResult_1, visCodeWriterResult, codeExecutorResult,pythonLogCodeResult, agentConstructorPythonOutput,agentConstructorPythonExecutionError, dataLoaderPython,
   dataFilterPython, dataTransformerPython, dataAggregatorPython, dataExporterPython, dataExporterPythonresult
} from '../test/testData.js'
import { dataProfilerError } from '../test/histogramData.js'
import * as fs from 'fs'

/**,agentConstructorPythonExecutionError
 * ExecuteGenericAgentsProcess
 *
 * Executes generic agents that have been dynamically created
 *
 * Pattern:,
 * 1. Get agent context
 * 2. Clear agent context if needed
 * 3. Set context with task data
 * 4. Execute agent
 * 5. Store execution result
 */
export class ExecuteGenericAgentsProcess {
  private agent: GenericAgent;
//  private transactionSetCollection: TransactionSetCollection;
  private coordinator: SagaCoordinator;
  private targetAgent: string;

  constructor(
    agent: GenericAgent,
    coordinator: SagaCoordinator,
//    transactionSetCollection: TransactionSetCollection,
    targetAgent: string
  ) {
    this.agent = agent; //FlowDefiningAgent
    this.coordinator = coordinator;
 //   this.transactionSetCollection = JSON.parse(transactionSetCollection);
    this.targetAgent = targetAgent;
   
  }

  /**
   * Execute generic agent
   */
  async execute(): Promise<AgentResult> {

      const ctx = this.coordinator.contextManager.getContext(this.agent.getName()) as WorkingMemory;
//console.log('TRANSACTION COLLECTION ', ctx.lastTransactionResult)
      // Parse the transaction set collection with error handling
      let transactionSetCollection: TransactionSetCollection;
      try {
        transactionSetCollection = JSON.parse(ctx.lastTransactionResult);
        console.log('DEFINE AGENT TRANSACTION GROUPING AGENT', JSON.stringify(transactionSetCollection, null, 2));
      } catch (error) {
        console.error('Failed to parse transactionSetCollection:', error);
        console.error('Raw data:', ctx.lastTransactionResult);
        throw new Error('Invalid transaction set collection data');
      }
    // Get context for the agent
     let sagaTransactions: SagaTransaction[] = [];
     transactionSetCollection.sets.forEach((transactionSet: TransactionSet) => {
            transactionSet.transactions.forEach((transaction: SagaTransaction) => {
              sagaTransactions.push(transaction)
            console.log('NAME ', transaction.agentName)
             console.log('ID ', transaction.id)
            })
          });
     let hasError = false;
     let correctedCode = '';
     let agentInError = '';
     if(ctx.hasError){
       hasError = true;
      correctedCode = ctx.codeInErrorResult;
      agentInError = ctx.agentInError;
     }
console.log('AGENT IN ERROR ', agentInError)
    // Execute agent
    let result: AgentResult = {
      agentName: '',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
sagaTransactions.forEach(e => {
  console.log('EXEC NAME ', e.agentName)
})
    if(sagaTransactions.length > 1){
     result = await this.executeSagaTransactionWithLinearContext( sagaTransactions, hasError, correctedCode, agentInError);
    } else if(sagaTransactions.length === 1){
     result = await this.executeSagaTransactionWithSingletonContext( sagaTransactions[0]);
    }

    // Store execution result
  
    return result;
  }
 // MCPExecutePythonCaller output:
  //"df.to_csv('C:/repos/SAGAMiddleware/data/Output_one_hour_normalized_daily_avg.csv', index=False)"
  // python code passed, get rows by 20 for self-reference - results accumulated passed to d3js coordinator to summarise for coder
  /*
    const toolCtx = this.coordinator.contextManager.getContext(sagaTransactionName) as WorkingMemory; //sagaTranName - MCPExecutePythonCaller
           const csvReader = new CSVReader(0)
           csvReader.processFile(toolCtx.previousResult); //pythonresult visCodeWriterResult : Output_one_hour_normalized_daily_avg.csv
           const count = csvReader.getRowCount();
            this.coordinator.registerCSVReader(csvReader);
  */
       
  private async executeSagaTransactionWithSingletonContext(
      transaction: SagaTransaction
    ): Promise<AgentResult> {
     console.log('SINGLETON ', transaction.agentName)
      const agent = this.coordinator.agents.get(transaction.agentName);

      if (!agent) {
        throw new Error(`Agent ${transaction.agentName} not found`);
      }

      // Execute the agent
      const result = await agent.execute({});

      console.log('🔍 Singleton execution result:', JSON.stringify(result, null, 2).substring(0, 300));

      // Store result in both agent's own context and target agent context
      this.coordinator.contextManager.updateContext(this.agent.getName(), {
        lastTransactionResult: result.result,
        transactionId: this.agent.getId(),
        timestamp: new Date()
      });

      console.log('target agent 1',this.targetAgent)
      this.coordinator.contextManager.updateContext(this.targetAgent, {
        lastTransactionResult: result.result,
        transactionId: this.agent.getId(),
        timestamp: new Date()
      });

      return result;

    }  
    
    private async executeSagaTransactionWithLinearContext(
      linearTransactions: SagaTransaction[],
      inError: boolean, 
      correctedCode: string, 
      inErrorAgent: string
    ): Promise<AgentResult> {

      const firstAgent = linearTransactions[0].agentName;
      let prevResult = '';
       let result: AgentResult = {agentName: '',
      result: '',
      success: false,
      timestamp: new Date()
    };
      let cleanCode = '';
      const validatingAgent =  this.coordinator.agents.get('ValidatingAgent') as GenericAgent;
      const toolCallingAgent = this.coordinator.agents.get('ToolCallingAgent') as GenericAgent;

     /* let hasError = false;
      let codeInError;
      let agentInError;
      const ctx = this.coordinator.contextManager.getContext(this.targetAgent) as WorkingMemory;
      //TypeError: Cannot read properties of undefined (reading 'hasError')
      if(ctx && ctx.hasError){
        hasError = true;
        codeInError = ctx.codeInErrorResult;
        agentInError = ctx.agentInError;
      }*/
      for (const linearTx of linearTransactions) {
        console.log('LINEAR TX ', linearTx)
        console.log('LINEAR TX 1',inError)
           console.log('LINEAR TX 2',inErrorAgent)
 console.log('LINEAR TX 3', correctedCode)

        if (linearTx.agentType === 'tool') {
          console.log(`🔧 Executing tool agent: ${linearTx.agentName}`);
          toolCallingAgent.deleteContext();
          let cleanCode = '';
          if(inError && inErrorAgent === linearTx.agentName){
                cleanCode = this.cleanPythonCode( correctedCode).trim();
                console.log('CLEAN CODE EXEC ', cleanCode)
                await toolCallingAgent.execute({'CODE:': cleanCode}) as AgentResult;
          } else {
               cleanCode = this.cleanPythonCode(JSON.stringify(linearTx)).trim();
          }
       

          try {
            // Actually execute the tool calling agent
            result.result = dataProfilerError//await toolCallingAgent.execute({'CODE:': cleanCode}) as AgentResult;

            console.log('TOOL CALL ' + linearTx.agentName, result)
            console.log('TOOL CALL SUCCESS FLAG: ', result.success)

            if (!result.success) {
              console.log('RESULT ERROR EXEC 1', linearTx.agentName )
                console.log('RESULT ERROR EXEC CODE', linearTx )
              this.coordinator.contextManager.updateContext(this.targetAgent, {
                 lastTransactionResult: result.result,
                codeInErrorResult: linearTx,
                agentInError: linearTx.agentName,
                hasError: true,
                transactionId: this.agent.getId(),
                timestamp: new Date()
              });
              result.error = result.result
              break;
            } else {
              this.coordinator.contextManager.updateContext(this.targetAgent, {
                  lastTransactionResult: result.result,//pythonLogCodeResult,
                  hasError: false,                 
                  transactionId: this.agent.getId(),  
                  timestamp: new Date()
         });
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
       
        console.log('RESULT_2', result.result)
         console.log('RESULT_2_1', result.success)
          // Execute with enhanced context - propagate the actual success flag from tool execution
          return {agentName: '',
        result: result,
        success: result.success, // Use the actual success flag from the tool result
        timestamp: new Date(

        )};
    }
    
  
    private cleanPythonCode(rawCode: string): string {
      let cleaned = rawCode.trim();

      // Step 0: Check if the input is an object string (contains agentName, result, etc.)
      // If so, extract just the result field value
      if (cleaned.includes('agentName:') && cleaned.includes('result:')) {
        // Find the result field - it's typically: result: 'code...' + 'more code' +
        const resultMatch = cleaned.match(/result:\s*(['"])([\s\S]*?)(?=,\s*(?:success|timestamp|\}))/);
        if (resultMatch) {
          // Extract just the concatenated string value (group 2)
          cleaned = resultMatch[2];
          // Add back the opening quote that was captured in group 1
          cleaned = resultMatch[1] + cleaned;
        }
      }

      // Step 1: Convert escaped newlines to actual newlines FIRST
      // This converts the JavaScript string format to multiline text
      cleaned = cleaned.replace(/\\n/g, '\n');

      // Step 2: Remove string concatenation operators
      // Pattern: 'text' +
      //          'more text'
      // Remove the trailing ' + and leading ' on continuation
      cleaned = cleaned.replace(/'\s*\+\s*\n\s*'/gm, '\n');
      cleaned = cleaned.replace(/"\s*\+\s*\n\s*"/gm, '\n');

      // Remove any remaining + patterns at end of lines (with or without quotes)
      cleaned = cleaned.replace(/\s*\+\s*$/gm, '');

      // Step 3: Remove the very first and last quotes from the entire string
      cleaned = cleaned.trim();
      cleaned = cleaned.replace(/^['"]/, '');
      cleaned = cleaned.replace(/['"]$/, '');

      // Step 4: Handle escaped quotes
      cleaned = cleaned.replace(/\\'/g, "'");
      cleaned = cleaned.replace(/\\"/g, '"');

      // Step 5: Convert backticks to single quotes (if any)
      cleaned = cleaned.replace(/`/g, "'");

      // Step 6: Clean up each line while preserving Python indentation
      const lines = cleaned.split('\n');
      const trimmedLines = lines.map(line => {
        // Remove trailing whitespace but preserve leading indentation
        return line.replace(/\s+$/, '');
      });

      // Rejoin and trim overall leading/trailing blank lines
      cleaned = trimmedLines.join('\n').trim();

      return cleaned;
    }
  
    private cleanJavaScriptCode(rawCode: any): string {
      let codeToClean = rawCode;
  
      // If it's a string that looks like JavaScript object literal, try to evaluate it
      if (typeof rawCode === 'string' && rawCode.trim().startsWith('{')) {
        try {
          // Safely evaluate the JavaScript object literal
          const evaluated = eval('(' + rawCode + ')');
          if (evaluated && typeof evaluated === 'object' && 'result' in evaluated) {
            codeToClean = evaluated.result;
          }
        } catch (e) {
          console.warn('Could not evaluate JavaScript object literal, treating as raw string');
          codeToClean = rawCode;
        }
      }
      // Handle object with result property (like d3jsCodeResult structure)
      else if (typeof rawCode === 'object' && rawCode !== null && 'result' in rawCode) {
        codeToClean = rawCode.result;
      }
  
      // Type safety check
      if (!codeToClean || typeof codeToClean !== 'string') {
        console.warn('cleanJavaScriptCode received non-string input:', typeof codeToClean, codeToClean);
        return typeof codeToClean === 'object' ? JSON.stringify(codeToClean) : String(codeToClean || '');
      }
  
      // Handle JavaScript-style concatenated strings with + operators
      let cleaned = codeToClean
        // Remove string concatenation operators and newlines
        .replace(/'\s*\+\s*$/gm, '')
        .replace(/'\s*\+\s*'/g, '')
        .replace(/"\s*\+\s*$/gm, '')
        .replace(/"\s*\+\s*"/g, '')
        .replace(/`/g, "'")  // Fix backticks to quotes
        // Remove leading/trailing quotes and handle escape sequences
        .replace(/^['"]/, '')
        .replace(/['"]$/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"');
  
      // Replace hardcoded file paths with relative paths for browser compatibility
      cleaned = cleaned.replace(
        /const CSV_PATH = ['"'][^'"]*\/([^\/'"]+\.csv)['"];/g,
        "const CSV_PATH = './$1';"
      );
  
      // Replace d3.csv absolute paths with relative paths
      cleaned = cleaned.replace(
        /d3\.csv\(['"][^'"]*\/([^\/'"]+\.csv)['"]/g,
        "d3.csv('./$1'"
      );
  
      // Add error handling for missing CSV files
      if (cleaned.includes("d3.csv")) {
        cleaned = cleaned.replace(
          /(d3\.csv\([^)]+\))/g,
          "$1.catch(err => { console.error('CSV file not found:', err); return []; })"
        );
      }
  
      // Restore template literal placeholders that were escaped for text storage
      // Convert ${/variable} back to ${variable}
    //  cleaned = cleaned.replace(/\$\/\{([^}]+)\}/g, '${$1}');
      
      return cleaned.trim();
    }
}
