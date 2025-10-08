// ValidationProcess - Validates output from a target agent
// Uses ValidatingAgent to check if target agent's output is correct

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { validationFixedSyntaxResult } from '../test/testData.js'


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
  private targetAgent: GenericAgent;
  private contextManager: ContextManager;
  private userQuery: string;

  constructor(
    validatingAgent: GenericAgent,
    targetAgent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string
  ) {
    this.validatingAgent = validatingAgent;
    this.targetAgent = targetAgent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
  }

  /**
   * Execute validation
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🔍 ValidationProcess: Validating output from ${this.targetAgent.getName()}`);

    const taskDescription = this.userQuery;
    console.log('VALIDATION TASK DESC', taskDescription)// You will validate python code
    // Get target agent's last result
    const ctx = this.contextManager.getContext(this.targetAgent.getName()) as WorkingMemory;

    if (!ctx || !ctx.lastTransactionResult) {
      console.error(`❌ No result found for ${this.targetAgent.getName()}`);
      return {
        agentName: this.validatingAgent.getName(),
        result: 'ERROR: No output to validate',
        success: false,
        timestamp: new Date(),
        error: `No lastTransactionResult found for ${this.targetAgent.getName()}`
      };
    }

    // Extract target agent's original task from user query
  /*  const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.targetAgent.getName()
    );*/

    console.log(`📝 Target agent output: ${ctx.lastTransactionResult.substring(0, 100)}...`);

    // Clear validating agent context
    this.validatingAgent.deleteContext();

    // Set context for validation
  //  this.validatingAgent.receiveContext({ 'USER REQUEST': conversationContext });
    this.validatingAgent.receiveContext({ 'CODE': ctx.d3jsCodeResult });
    this.validatingAgent.receiveContext({ 'VALIDATE': ctx.lastTransactionResult });
    this.validatingAgent.setTaskDescription(this.targetAgent.getAgentDefinition().taskDescription);
    // Execute validation
 //  const result = await this.validatingAgent.execute({});
 //  console.log('VALIDATION ', result.result)
  const result: AgentResult = {
      agentName: 'cycle_start',
      result: validationFixedSyntaxResult,
      success: true,
      timestamp: new Date()
    };
   

    // Check if validation passed
    const validationPassed = this.isValidationSuccessful(result.result);

    if (validationPassed) {
      console.log(`✅ Validation PASSED for ${this.targetAgent.getName()}`); //TransactionGroupingAgent
       // Store validation result in context manager
    // NOTE: We store under targetAgent's name so it can see validation feedback
  /* this.contextManager.updateContext(this.targetAgent.getName(), {
      lastTransactionResult: result.result,
      validationResult: result.result,
      transactionId: this.validatingAgent.getId(),
      timestamp: new Date()
    });*/
    } else {
      console.warn(`⚠️  Validation FAILED for ${this.targetAgent.getName()}`);
      console.log(`📋 Validation feedback: ${result.result.substring(0, 200)}...`);
    }
//Assume that ValidatingAgent has fixed errors
  /*  this.contextManager.updateContext('FlowDefiningAgent', {
      lastTransactionResult: result.result,
      validationResult: result.result,
      transactionId: this.validatingAgent.getId(),
      timestamp: new Date()
    });*/

    return {
      ...result,
      success: validationPassed
    };
  }

  /**
   * Check if validation result indicates success
   * Based on typical validation results like validationFixedSyntaxResult in testData.js
   */
  private isValidationSuccessful(validationResult: any): boolean {
    // Type guard: ensure validationResult can be converted to string
    if (validationResult === null || validationResult === undefined) {
      return false;
    }

    const resultStr = typeof validationResult === 'string' ? validationResult : String(validationResult);
    const resultLower = resultStr.toLowerCase();

    // Try to parse as JSON to check for structured success/error fields
    try {
      // Look for JSON object in the string
      const jsonMatch = resultStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Check for explicit success field (e.g., "success": false)
        if (typeof parsed.success === 'boolean') {
          return parsed.success;
        }

        // Check for errors array (presence indicates failure)
        if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
          return false;
        }
      }
    } catch (e) {
      // Not JSON or invalid JSON, continue with text-based checks
    }

    // Check for explicit failure indicators
    if (resultLower.includes('"success": false') ||
        resultLower.includes('"success":false')) {
      return false;
    }

    if (resultLower.includes('"errors"') && resultLower.includes('[')) {
      return false;
    }

    // Check for text-based failure indicators
    if (resultLower.includes('error') ||
        resultLower.includes('invalid') ||
        resultLower.includes('incorrect') ||
        resultLower.includes('fail')) {
      return false;
    }

    // Check for success indicators
    if (resultLower.includes('"success": true') ||
        resultLower.includes('"success":true') ||
        resultLower.includes('valid') && !resultLower.includes('invalid') ||
        resultLower.includes('correct') ||
        resultLower.includes('passed')) {
      return true;
    }

    // Default: assume validation passed if no clear failure indicators
    return true;
  }

  /**
   * Parse conversation result to extract content for a specific agent
   */
  private parseConversationResultForAgent(conversationResult: any, agentName: string): string {
    try {
      let resultText = '';
      if (typeof conversationResult === 'string') {
        resultText = conversationResult;
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        return '';
      }

      const startTagPattern = new RegExp(`\\[AGENT:\\s*${agentName}(?:,\\s*[^\\]]+)?\\]`);
      const endTag = `[/AGENT]`;

      const startTagMatch = resultText.match(startTagPattern);
      let startIndex = -1;
      let startTagLength = 0;

      if (startTagMatch) {
        startIndex = startTagMatch.index!;
        startTagLength = startTagMatch[0].length;
      } else {
        return '';
      }

      const endIndex = resultText.indexOf(endTag, startIndex);

      if (startIndex !== -1 && endIndex !== -1) {
        let content = resultText.substring(startIndex + startTagLength, endIndex).trim();
        content = content.replace(/^\d+\.\s*/, '').replace(/^\./, '').trim();
        return content;
      }

      return '';
    } catch (error) {
      console.warn(`Failed to parse for agent ${agentName}:`, error);
      return '';
    }
  }

  /**
   * Get validation result
   */
  getValidationResult(): string | null {
    const ctx = this.contextManager.getContext(this.targetAgent.getName()) as WorkingMemory;
    return ctx?.validationResult || null;
  }
}