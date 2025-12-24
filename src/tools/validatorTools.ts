/**
 * Local Tools for D3JSCodeValidator SDK Agent
 *
 * These tools allow the D3JSCodeValidator to autonomously decide what happens next:
 * - trigger_conversation: Pass validated code directly to user
 * - trigger_code_correction: Request D3JSCodingAgent to fix validation errors
 */

import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AgentResult } from '../types/index.js';
import { histogramValidationPrompt } from '../types/visualizationSaga.js';

export interface ValidatorToolContext {
  coordinator: SagaCoordinator;
  validationReport: any;
  originalCode: string;
}

/**
 * Tool 1: Trigger Conversation Agent
 *
 * Called when validation PASSES - sends code directly to ConversationAgent for user output
 */
export async function trigger_conversation(
  context: ValidatorToolContext,
  params: { code: string; message?: string }
): Promise<{ success: boolean; result: string }> {
  console.log('🎯 trigger_conversation tool called - validation PASSED');
  console.log(`📝 Message: ${params.message || 'Validation passed, sending to user'}`);

  try {
    // Get ConversationAgent from registry
    const conversationAgent = context.coordinator.agents.get('ConversationAgent');

    if (!conversationAgent) {
      throw new Error('ConversationAgent not found in registry');
    }

    // Update ConversationAgent's context with the validated code
    context.coordinator.contextManager.updateContext('ConversationAgent', {
      validatedCode: params.code,
      validationStatus: 'PASSED',
      validationReport: context.validationReport,
      message: params.message,
      timestamp: new Date()
    });

    console.log('✅ Code passed to ConversationAgent for user output');

    return {
      success: true,
      result: 'Code forwarded to ConversationAgent for user delivery'
    };
  } catch (error) {
    console.error('❌ Error in trigger_conversation:', error);
    return {
      success: false,
      result: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tool 2: Trigger Code Correction
 *
 * Called when validation FAILS - requests D3JSCodingAgent to fix the errors
 */
export async function trigger_code_correction(
  context: ValidatorToolContext,
  params: {
    originalCode: string;
    validationErrors: string[];
    validationReport: any;
  }
): Promise<{ success: boolean; result: string }> {
  console.log('🔧 trigger_code_correction tool called - validation FAILED');
  console.log(`❌ Errors found: ${params.validationErrors.length}`);

  try {
    // Get D3JSCodingAgent from registry
    const codingAgent = context.coordinator.agents.get('D3JSCodingAgent');

    if (!codingAgent) {
      throw new Error('D3JSCodingAgent not found in registry');
    }

    // Build correction prompt with validation errors
    const correctionPrompt = `
You are an expert D3.js coding agent. Your previous code failed validation with the following errors:

**Validation Report:**
${JSON.stringify(params.validationReport, null, 2)}

**Specific Errors:**
${params.validationErrors.map((err, idx) => `${idx + 1}. ${err}`).join('\n')}

**Original Code:**
${params.originalCode}

**Your Task:**
Analyze the validation errors and generate corrected D3.js code that addresses all issues.
Output ONLY the complete, corrected HTML/JavaScript code with no explanations or markdown.
`;

    // Set the correction prompt
    codingAgent.setTaskDescription(correctionPrompt);

    // Clear agent context to avoid contamination
    codingAgent.deleteContext();

    // Update D3JSCodingAgent's context with validation data AND retry prompt
    context.coordinator.contextManager.updateContext('D3JSCodingAgent', {
      originalCode: params.originalCode,
      validationErrors: params.validationErrors,
      validationReport: params.validationReport,
      validationStatus: 'FAILED',
      correctionAttempt: true,
      prompt: histogramValidationPrompt,  // Set retry prompt for code correction
      timestamp: new Date()
    });

    // Execute D3JSCodingAgent to generate corrected code
    const result = await codingAgent.execute({
      validationReport: params.validationReport,
      validationErrors: params.validationErrors,
      originalCode: params.originalCode
    });

    if (result.success) {
      console.log('✅ D3JSCodingAgent generated corrected code');

      // Forward corrected code to ConversationAgent
      const conversationAgent = context.coordinator.agents.get('ConversationAgent');
      if (conversationAgent) {
        context.coordinator.contextManager.updateContext('ConversationAgent', {
          correctedCode: result.result,
          validationStatus: 'CORRECTED',
          originalValidationReport: params.validationReport,
          timestamp: new Date()
        });
        console.log('✅ Corrected code forwarded to ConversationAgent');
      }
    }

    return {
      success: result.success,
      result: result.success
        ? 'Code correction completed and forwarded to ConversationAgent'
        : `Code correction failed: ${result.error}`
    };
  } catch (error) {
    console.error('❌ Error in trigger_code_correction:', error);
    return {
      success: false,
      result: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Export tool definitions in MCP-compatible format
 */
export const VALIDATOR_TOOLS = [
  {
    name: 'trigger_conversation',
    description: 'Pass validated D3.js code to ConversationAgent for user output. Use when validation PASSES.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The validated D3.js code to send to user'
        },
        message: {
          type: 'string',
          description: 'Optional success message to include with the code'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'trigger_code_correction',
    description: 'Request D3JSCodingAgent to fix validation errors. Use when validation FAILS.',
    inputSchema: {
      type: 'object',
      properties: {
        originalCode: {
          type: 'string',
          description: 'The original D3.js code that failed validation'
        },
        validationErrors: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specific validation errors to fix'
        },
        validationReport: {
          type: 'object',
          description: 'Complete validation report with details'
        }
      },
      required: ['originalCode', 'validationErrors', 'validationReport']
    }
  }
];
