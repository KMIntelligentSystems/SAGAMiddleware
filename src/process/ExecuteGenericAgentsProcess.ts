// ExecuteGenericAgentsProcess - Executes generic agents in sequence
// Follows the same pattern as FlowProcess

import { GenericAgent } from '../agents/genericAgent.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { TransactionSetCollection, TransactionSet, SagaTransaction } from '../types/visualizationSaga.js';
import {  D3JSCoordinatingAgentFinalResult, D3JSCodeingAgentReuslt } from '../test/testData.js'

/**
 * ExecuteGenericAgentsProcess
 *
 * Executes generic agents that have been dynamically created
 *
 * Pattern:
 * 1. Get agent context
 * 2. Clear agent context if needed
 * 3. Set context with task data
 * 4. Execute agent
 * 5. Store execution result
 */
export class ExecuteGenericAgentsProcess {
  private transactionSetCollection: TransactionSetCollection;
  private coordinator: SagaCoordinator
  constructor(
    coordinator: SagaCoordinator,
    transactionSetCollection: TransactionSetCollection
  ) {
    this.coordinator = coordinator;
    this.transactionSetCollection = transactionSetCollection;
  }

  /**
   * Execute generic agent
   */
  async execute(): Promise<AgentResult> {

    // Get context for the agent
     let sagaTransactions: SagaTransaction[] = [];
     this.transactionSetCollection.sets.forEach((transactionSet: TransactionSet) => {
            transactionSet.transactions.forEach((transaction: SagaTransaction) => {
              sagaTransactions.push(transaction)
            console.log('NAME ', transaction.agentName)
             console.log('ID ', transaction.id)
            })
          });
        
    // Execute agent
    let result: AgentResult = {
      agentName: '',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };

    if(sagaTransactions.length > 1){
     result = await this.executeSagaTransactionWithLinearContext( sagaTransactions);
  }


    // Store execution result
  
    return result;
  }

  private async executeSagaTransactionWithLinearContext(
      linearTransactions: SagaTransaction[]
    ): Promise<AgentResult> {
     
       let result: AgentResult = {agentName: '',
      result: '',
      success: false,
      timestamp: new Date()
    };
     
      for (const linearTx of linearTransactions) {
             let agent = this.coordinator.agents.get(linearTx.agentName);
             console.log('LINEAR AGENT NAME', agent?.getName())
              console.log('LINEAR AGENT TASK ', agent?.getAgentDefinition().taskDescription) //task set
             console.log('LINEAR AGENT ', agent?.getContext())//nothing in context []
               //TEST START
          //    result = await agent?.execute({}) as AgentResult;
          //END
          
          
              result.result = D3JSCoordinatingAgentFinalResult
            
            
           /*   let cleanCode = this.cleanPythonCode(result.result || '')
            //  console.log('LINEAR CTX ', cleanCode)
            //TEST wrting code
          //    result = await agent?.execute({'Information to complete your task:': cleanCode}) as AgentResult;
             
              result.result = D3JSCodeingAgentReuslt;
              cleanCode = this.cleanPythonCode(result.result || '')
              const agentName = agent?.getName() as string
              //OUT LINEAR  PythonToolInvoker
              //OUT LINEAR  1  codeExecutorResult ie python tool call
              console.log('OUT LINEAR ', agentName)
              console.log('OUT LINEAR  1 ', cleanCode)
               try{
                //codeWriterResult is example of clean code previous Result which is executed 
                this.coordinator.contextManager.updateContext(agentName,{previousResult: cleanCode });
                //codeExecutorResult is example of result.result for python tool call response
                this.coordinator.contextManager.updateContext(agentName,{latestExecutionResult: result.result });
               }catch (error) {
                  console.log('ERROR ', error)
               }
              */
            
   
      }
        console.log('RESULT_2', result.result)
          // Execute with enhanced context
          return {agentName: '',
        result: result,
        success: true,
        timestamp: new Date(
          
        )};
    }
    
  
    private cleanPythonCode(rawCode: string): string {
      // Handle JavaScript-style concatenated strings with + operators
      let cleaned = rawCode
        // Remove string concatenation operators and newlines
        .replace(/'\s*\+\s*$/gm, '')
        .replace(/'\s*\+\s*'/g, '')
        .replace(/`/g, "'")  // Fix backticks to quotes
        // Remove leading/trailing quotes and handle escape sequences
        .replace(/^'/, '')
        .replace(/'$/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"');
      
      return cleaned.trim();
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
