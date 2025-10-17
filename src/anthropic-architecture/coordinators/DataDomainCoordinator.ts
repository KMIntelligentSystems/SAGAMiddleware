/**
 * Data Domain Coordinator
 *
 * Maintains context about user's data requirements and orchestrates stateless subagents
 * to perform schema analysis, transformations, validation, and summarization.
 */

import { BaseCoordinator } from './BaseCoordinator.js';
import {
  CoordinatorConfig,
  CoordinatorDecision,
  CoordinatorResponse,
  SubagentTask,
  SchemaAnalysisResult,
  DataTransformationResult,
  DataValidationResult,
  DataSummarizationResult
} from '../types/index.js';

export class DataDomainCoordinator extends BaseCoordinator {
  // Track data domain specific state
  private schemaAnalysis?: SchemaAnalysisResult;
  private transformationResults: DataTransformationResult[] = [];
  private validationResults: DataValidationResult[] = [];
  private summarizationResult?: DataSummarizationResult;

  constructor(config: CoordinatorConfig) {
    super(config);
  }

  /**
   * Make decision about next action based on current context
   */
  protected async makeDecision(): Promise<CoordinatorDecision> {
    const ctx = this.context!;

    // Build decision prompt
    const contextSummary = this.buildContextSummary();
    const availableSubagents = Array.from(this.subagents.values())
      .map(s => {
        const def = s.getDefinition();
        return `- ${def.type}: ${def.description}`;
      })
      .join('\n');

    const decisionPrompt = `${contextSummary}

Available Subagents:
${availableSubagents}

Based on the current context and user query, decide what action to take next.

Your options:
1. call_subagent - Call a specific subagent to gather more information or perform a task
2. synthesize - Synthesize the results from subagents into a coherent analysis
3. complete - The task is complete, ready to generate final response
4. pass_to_coordinator - Pass results to another coordinator (e.g., coding domain)

Respond with a JSON object:
{
  "action": "call_subagent|synthesize|complete|pass_to_coordinator",
  "reasoning": "Brief explanation of why this action",
  "subagentType": "type of subagent to call (if action is call_subagent)",
  "taskDescription": "description of task for subagent (if action is call_subagent)",
  "taskInput": "input data for subagent (if action is call_subagent)"
}`;

    // Call coordinator LLM for decision
    const response = await this.callCoordinatorLLM(decisionPrompt);

    // Parse decision
    try {
      const decision = JSON.parse(this.extractJsonFromResponse(response));

      const coordinatorDecision: CoordinatorDecision = {
        action: decision.action,
        reasoning: decision.reasoning
      };

      // If calling subagent, create task
      if (decision.action === 'call_subagent') {
        coordinatorDecision.taskToExecute = {
          taskId: `task_${Date.now()}_${decision.subagentType}`,
          taskType: decision.subagentType,
          description: decision.taskDescription,
          input: decision.taskInput,
          metadata: {
            priority: 'medium'
          }
        };
      }

      // If passing to coding coordinator
      if (decision.action === 'pass_to_coordinator') {
        coordinatorDecision.nextCoordinator = 'coding_domain_coordinator';
      }

      return coordinatorDecision;
    } catch (error) {
      console.error('Error parsing decision:', error);
      console.error('Response was:', response);

      // Fallback decision
      return {
        action: 'complete',
        reasoning: 'Error parsing decision, completing with current results'
      };
    }
  }

  /**
   * Synthesize results from all subagent calls
   */
  protected async synthesizeResults(): Promise<void> {
    console.log('\n🔄 Synthesizing results from subagents...');

    // Collect all results
    const results = Array.from(this.context!.taskResults.values())
      .filter(r => r.success)
      .map(r => ({
        taskType: this.context!.executedTasks.find(t => t.taskId === r.taskId)?.taskType,
        result: r.result
      }));

    // Store domain-specific results
    for (const { taskType, result } of results) {
      switch (taskType) {
        case 'schema_analyzer':
          this.schemaAnalysis = result as SchemaAnalysisResult;
          this.context!.discoveredSchema = result;
          break;
        case 'data_transformer':
          this.transformationResults.push(result as DataTransformationResult);
          break;
        case 'data_validator':
          this.validationResults.push(result as DataValidationResult);
          break;
        case 'data_summarizer':
          this.summarizationResult = result as DataSummarizationResult;
          this.context!.dataAnalysis = result;
          break;
      }
    }

    // Build synthesis prompt
    const synthesisPrompt = `Synthesize the following data analysis results into a coherent summary:

Schema Analysis:
${JSON.stringify(this.schemaAnalysis, null, 2)}

Transformation Results:
${JSON.stringify(this.transformationResults, null, 2)}

Validation Results:
${JSON.stringify(this.validationResults, null, 2)}

Summarization Result:
${JSON.stringify(this.summarizationResult, null, 2)}

Create a concise natural language summary that captures:
1. Data structure and semantics
2. Key transformations applied
3. Data quality assessment
4. Insights for downstream coding tasks

Format as plain text summary.`;

    const synthesis = await this.callCoordinatorLLM(synthesisPrompt);

    // Store synthesis in context
    this.context!.workingMemory.lastActionResult = {
      synthesis,
      schemaAnalysis: this.schemaAnalysis,
      transformationResults: this.transformationResults,
      validationResults: this.validationResults,
      summarizationResult: this.summarizationResult
    };

    console.log('✅ Synthesis complete');
  }

  /**
   * Generate final response
   */
  protected async generateFinalResponse(): Promise<CoordinatorResponse> {
    const ctx = this.context!;

    // Check if we should pass to coding coordinator
    const lastDecision = this.executionTrace!.decisions[this.executionTrace!.decisions.length - 1];

    if (lastDecision.action === 'pass_to_coordinator') {
      return {
        success: true,
        context: ctx,
        handoffData: {
          targetCoordinator: 'coding_domain_coordinator',
          payload: {
            schemaAnalysis: this.schemaAnalysis,
            transformationResults: this.transformationResults,
            summarizationResult: this.summarizationResult,
            synthesis: ctx.workingMemory.lastActionResult?.synthesis
          }
        }
      };
    }

    // Otherwise, return data domain results
    return {
      success: true,
      result: {
        schemaAnalysis: this.schemaAnalysis,
        transformationResults: this.transformationResults,
        validationResults: this.validationResults,
        summarizationResult: this.summarizationResult,
        synthesis: ctx.workingMemory.lastActionResult?.synthesis
      },
      context: ctx
    };
  }

  /**
   * Extract JSON from LLM response (handles markdown code blocks)
   */
  private extractJsonFromResponse(response: string): string {
    // Try to find JSON in markdown code block
    const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }

    // Try to find raw JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    throw new Error('No JSON found in response');
  }

  /**
   * Get data domain specific results
   */
  getDataAnalysisResults() {
    return {
      schemaAnalysis: this.schemaAnalysis,
      transformationResults: this.transformationResults,
      validationResults: this.validationResults,
      summarizationResult: this.summarizationResult
    };
  }
}
