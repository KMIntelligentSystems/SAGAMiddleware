// FlowProcess - Extracts flow and tool call information from agent definitions
// Uses FlowDefiningAgent (typically another instance of TransactionGroupingAgent)

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import {agentDefinitionPrompt} from '../types/visualizationSaga.js';
import { flowDefiningAgentResult, flowData,d3jsFlowData } from '../test/testData.js';
import {  histoFlowDefineingAgentResult } from '../test/histogramData.js';
import {AgentParser} from '../agents/agentParser.js'

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
    console.log(`\n🔀 FlowProcess: Extracting flow from ${this.targetAgent.getName()} output`); //FlowDefiningAgent Extracting flow from TransactionGroupingAgent output

    // Get target agent's last result (agent definitions)
    const ctx = this.contextManager.getContext(this.targetAgent.getName()) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.error(`❌ Flow No result found for ${this.targetAgent.getName()}`);
      return {
        agentName: this.flowDefiningAgent.getName(),
        result: '',
        success: false,
        timestamp: new Date(),
        error: `No agent definitions found for ${this.targetAgent.getName()}`
      };
    }

    console.log(`📝 Agent definitions: ${JSON.stringify(ctx)}...`);

    // Clear flow defining agent context
    this.flowDefiningAgent.deleteContext();
    // Set new context
    this.flowDefiningAgent.receiveContext({ 'THE DATA TO PROCESS': ctx.lastTransactionResult });

    // Set context with agent definitions
    this.flowDefiningAgent.setTaskDescription(agentDefinitionPrompt);

    // Execute flow defining agent
//   const result = await this.flowDefiningAgent.execute({});
  
   let result: AgentResult = {
      agentName: 'cycle_start',
      result: '',
      success: true,
      timestamp: new Date()
    };

      if(this.flowDefiningAgent.getName() === 'DataProfiler' && this.targetAgent.getName() === 'FlowDefiningAgent'){
        //Get real rlows and tool users
           result.result = histoFlowDefineingAgentResult//await this.flowDefiningAgent.execute({}); // flowDefiningAgentResult  histoFlowDefineingAgentResult//
          
//const ctx = this.contextManager.getContext(this.targetAgent.getName()) as WorkingMemory;
     /* const agentDefinitionsText  = JSON.stringify(ctx.lastTransactionResult)
     //   console.log('DEFINE AGENT TRANSACTION GROUPING AGENT',  agentDefinitionsText)
       //  result.result = flowDefiningAgentResult;
         const transactionSetCollection = AgentParser.parseAndCreateAgents(
                  agentDefinitionsText,
                  result.result //flowDefiningAgentResult histoFlowDefineingAgentResult
        );
        // Stringify with proper formatting to ensure transactions are included
        const serialized = JSON.stringify(transactionSetCollection, null, 2);
        this.contextManager.updateContext(this.targetAgent.getName(), {
            lastTransactionResult: serialized
        })
    console.log(`✅ Created TransactionSetCollection: ${transactionSetCollection.id}`);
    console.log(`   Sets: ${transactionSetCollection.sets.length}`);
    // Verify transactions are properly serialized
    transactionSetCollection.sets.forEach((set, idx) => {
      console.log(`   Set ${idx + 1} (${set.name}): ${set.transactions.length} transactions`);
    });*/
  } else if(this.flowDefiningAgent.getName() === 'ValidatingAgent' && this.targetAgent.getName() === 'FlowDefiningAgent'){ 
       const valCtx = this.contextManager.getContext('ValidatingAgent') as WorkingMemory;
       console.log('FLOW VALIDATION',JSON.stringify(valCtx))
         this.contextManager.updateContext(this.targetAgent.getName(), {
                codeInErrorResult: valCtx.lastTransactionResult,
                agentInError: valCtx.agentInError,
                hasError:  valCtx.hasError,
                transactionId: this.targetAgent.getId(),
                timestamp: new Date()
              });
  } 

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

  getTargetAgent(){
    return this.targetAgent;
  }

  /**
   * Get the flow result
   */
  getFlowResult(): string | null {
    const ctx = this.contextManager.getContext(this.flowDefiningAgent.getName()) as WorkingMemory;
    return ctx?.lastTransactionResult || null;
  }
}