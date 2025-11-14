// ValidationProcess - Validates output from a target agent
// Uses ValidatingAgent to check if target agent's output is correct

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { validationFixedSyntaxResult,genReflectValidateResponse, d3jsValidationSuccess } from '../test/testData.js'
import { toolValidationErrorPrompt,  toolValidationCorrectionPrompt  } from '../types/visualizationSaga.js'
import { fixedByValidationProcessDataProfilerPython } from '../test/histogramData.js'
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
  private validatingAgent: GenericAgent;
  private targetAgent: string;
  private contextManager: ContextManager;
  private userQuery: string;
 
  constructor(
    validatingAgent: GenericAgent,
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
  // Get target agent's last result
    const ctx = this.contextManager.getContext(this.targetAgent) as WorkingMemory;


    if (!ctx || !ctx.lastTransactionResult) {
      console.error(`❌ No result found for ${this.validatingAgent.getName()}`);
      return {
        agentName: this.validatingAgent.getName(),
        result: 'ERROR: No output to validate',
        success: false,
        timestamp: new Date(),
        error: `No lastTransactionResult found for ${this.targetAgent}`
      };
    }

  
    // Extract target agent's original task from user query
  /*  const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.targetAgent.getName()
    );*/

    const outputPreview = typeof ctx.lastTransactionResult === 'string'
      ? ctx.lastTransactionResult.substring(0, 100)
      : JSON.stringify(ctx.lastTransactionResult).substring(0, 100);
    console.log(`📝 Target agent output: ${outputPreview}...`);

    // Execute validation based on target agent

    let result: AgentResult = {
      agentName: 'ValidatingAgent',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };

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
       // Execute the validating agent
       result = await this.validatingAgent.execute(input);
  } else  if(this.targetAgent === 'ConversationAgent') {
       const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;
       console.log('FINAL IN VALIDATION ', ctx.lastTransactionResult)
       const code = ctx.lastTransactionResult;
       const input = {d3jsOutput: code}
        this.contextManager.updateContext(this.targetAgent, { //ValidatingAgent
        lastTransactionResult: input,
        transactionId: 'tx-1',
        timestamp: new Date()
      });
       result = {
         agentName: this.validatingAgent.getName(),
         result: code,
         success: true,
         timestamp: new Date()
       };
  } else if (this.targetAgent === 'ValidatingAgent'){
    if(ctx.hasError){
         this.validatingAgent.setTaskDescription(toolValidationErrorPrompt);
         this.validatingAgent.deleteContext();
         console.log('PYTHON CODE ', ctx.codeInErrorResult)
         console.log('PYTHON CODE ERROR', ctx.lastTransactionResult)
           console.log('VAL CODE IN ERROR XXXX', ctx.agentInError);
         result.result = await this.validatingAgent.execute({'PYTHON CODE: ': ctx.codeInErrorResult, 'PYTHON CODE ERROR:': ctx.lastTransactionResult})
         result.success = false;
         this.contextManager.updateContext(this.validatingAgent.getName(), {
        lastTransactionResult: result.result,
        transactionId: this.validatingAgent.getId(),
        timestamp: new Date()
      });
    } else {
         result = {
           agentName: this.validatingAgent.getName(),
           result: 'No error to validate',
           success: true,
           timestamp: new Date()
         };
    }
  } else if(this.targetAgent === 'AgentStructureGenerator'){
      const agentCtx = this.contextManager.getContext('AgentStructureGenerator') as WorkingMemory;
      const agentDefinitions = agentCtx.lastTransactionResult;
      console.log('VALIDATION GENERATE AGENTS ',agentDefinitions)
      console.log('VAL CODE ', ctx.lastTransactionResult);
        console.log('VAL CODE IN ERROR ', ctx.agentInError);
       this.validatingAgent.setTaskDescription( toolValidationCorrectionPrompt );
         this.validatingAgent.deleteContext();
         
         result = await this.validatingAgent.execute({'AGENT DEFINITIONS: ': agentCtx, 'PYTHON CODE:': ctx.lastTransactionResult, 'AGENT:': ctx.agentInError})//fs.readFileSync('C:/repos/SAGAMiddleware/data/UpdatedAgentStructurePythonCoders.txt', 'utf-8'); //
         result.success = false;
         console.log('ERROR FIX ', result.result)
         this.contextManager.updateContext(this.targetAgent, {
        lastTransactionResult: result.result,
        codeInErrorResult: ctx.lastTransactionResult,
        agentInError: ctx.agentInError,
        hasError: true,
        transactionId: this.validatingAgent.getId(),
        timestamp: new Date()
      });
  }

    return result
  }
}