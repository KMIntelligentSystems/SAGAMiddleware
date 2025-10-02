// ValidationProcess - Validates output from a target agent
// Uses ValidatingAgent to check if target agent's output is correct

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';

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
    const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.targetAgent.getName()
    );

    console.log(`📝 Target agent output: ${ctx.lastTransactionResult.substring(0, 100)}...`);

    // Clear validating agent context
    this.validatingAgent.deleteContext();

    // Set context for validation
    this.validatingAgent.receiveContext({ 'USER REQUEST': conversationContext });
    this.validatingAgent.receiveContext({ 'VALIDATE': ctx.lastTransactionResult });

    // Execute validation
  //  const result = await this.validatingAgent.execute({});
  const result: AgentResult = {
      agentName: 'cycle_start',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
    // Store validation result in context manager
    // NOTE: We store under targetAgent's name so it can see validation feedback
    this.contextManager.updateContext(this.targetAgent.getName(), {
      lastTransactionResult: result.result,
      validationResult: result.result,
      transactionId: this.validatingAgent.getId(),
      timestamp: new Date()
    });

    // Check if validation passed
    const validationPassed = this.isValidationSuccessful(result.result);

    if (validationPassed) {
      console.log(`✅ Validation PASSED for ${this.targetAgent.getName()}`);
    } else {
      console.warn(`⚠️  Validation FAILED for ${this.targetAgent.getName()}`);
      console.log(`📋 Validation feedback: ${result.result.substring(0, 200)}...`);
    }

    return {
      ...result,
      success: validationPassed
    };
  }

  /**
   * Check if validation result indicates success
   */
  private isValidationSuccessful(validationResult: string): boolean {
    const resultLower = validationResult.toLowerCase();

    // Check for success indicators
    if (resultLower.includes('valid') && !resultLower.includes('invalid')) {
      return true;
    }

    if (resultLower.includes('success')) {
      return true;
    }

    if (resultLower.includes('correct')) {
      return true;
    }

    // Check for failure indicators
    if (resultLower.includes('error') ||
        resultLower.includes('invalid') ||
        resultLower.includes('incorrect') ||
        resultLower.includes('fail')) {
      return false;
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