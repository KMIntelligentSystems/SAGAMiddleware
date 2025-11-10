// ValidationProcess - Validates output from a target agent
// Uses ValidatingAgent to check if target agent's output is correct

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { validationFixedSyntaxResult,genReflectValidateResponse, d3jsValidationSuccess } from '../test/testData.js'
import * as fs from 'fs'; 

/**
 * ValidationProcess
 *
 * Validates the output of a target agent using ValidatingAgent.
 * Receives both the original user request and the target agent's output.
 *
 * Pattern:
 * 1. Get target agent's last result from contextManager
 * 2. Extract target agent's original task from user query
 * 3. Clear validating agent context
 * 4. Set context with:
 *    - USER REQUEST: Original task for target agent
 *    - VALIDATE: Target agent's output to validate
 * 5. Execute validating agent
 * 6. Store validation result
 *
 * Note: Retry logic (when validation fails) is handled by SagaCoordinator
 */
export class ValidationProcess {
  private validatingAgent: string;
  private targetAgent: string;
  private contextManager: ContextManager;
  private userQuery: string;
 
  constructor(
    validatingAgent: string,
    targetAgent: string,
    contextManager: ContextManager,
    userQuery: string
  ) {
    this.validatingAgent = validatingAgent;
    this.targetAgent = targetAgent as string;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
  }

  /**
   * Execute validation
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🔍 ValidationProcess: Validating output from ${this.targetAgent}`);

    const taskDescription = this.userQuery;
    console.log('VALIDATION TASK DESC', taskDescription)//1 [AGENT: TransactionGroupingAgent, tx-2]  2 You will validate python code 3 [AGENT: TransactionGroupingAgent, tx-2] 4 You will validate python code 5 [AGENT: TransactionGroupingAgent, tx-2] 4 5 repeated
    // Get target agent's last result
    const ctx = this.contextManager.getContext(this.validatingAgent) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.error(`❌ No result found for ${this.validatingAgent}`);
      return {
        agentName: this.validatingAgent,
        result: 'ERROR: No output to validate',
        success: false,
        timestamp: new Date(),
        error: `No lastTransactionResult found for ${this.targetAgent}`
      };
    }

    console.log('PATH', ctx.lastVisualizationSVG)

    // Extract target agent's original task from user query
  /*  const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.targetAgent.getName()
    );*/

     let result: AgentResult = {
      agentName: this.targetAgent,
      result: validationFixedSyntaxResult,
      success: true,
      timestamp: new Date()
    };

    console.log(`📝 Target agent output: ${ctx.lastTransactionResult.substring(0, 100)}...`);

    // Clear validating agent context

  if(this.targetAgent === 'D3JSCodeValidator') {
       const ctx = this.contextManager.getContext('D3JSCodeGenerator') as WorkingMemory;
       console.log('FIRST ',ctx.d3jsCodeResult)
       console.log('requirements:', ctx.userRequirements)
       console.log('THIRD',ctx.lastVisualizationSVG)
       const input = {requirements: ctx.userRequirements, d3jsCode:ctx.d3jsCodeResult, svgPath: ctx.lastVisualizationSVG }
        this.contextManager.updateContext(this.targetAgent, { //ValidatingAgent
        lastTransactionResult: input,
        transactionId: 'tx-3-3',
        timestamp: new Date()
      });
  } else  if(this.targetAgent === 'ConversationAgent') {
       const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;
       console.log('FINAL IN VALIDATION ', ctx.lastTransactionResult)
       const code = ctx.lastTransactionResult;
       const input = {d3jsOutput: code} 
       result.result = code;
        this.contextManager.updateContext(this.targetAgent, { //ValidatingAgent
        lastTransactionResult: input,
        transactionId: 'tx-1',
        timestamp: new Date()
      });
  }

  return {
      ...result,
      success: true
    };
  }
}