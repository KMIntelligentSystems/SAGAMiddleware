/**
 * Base class for contextful coordinators in Anthropic architecture
 * Coordinators maintain context, make decisions, and orchestrate stateless subagents
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CoordinatorConfig,
  CoordinatorContext,
  CoordinatorRequest,
  CoordinatorResponse,
  CoordinatorDecision,
  SubagentTask,
  SubagentResult,
  ExecutionTrace
} from '../types/index.js';
import { BaseSubagent } from '../subagents/BaseSubagent.js';
import { WorkingMemory } from '../../types/index.js';

export abstract class BaseCoordinator {
  protected config: CoordinatorConfig;
  protected anthropicClient: Anthropic;
  protected subagents: Map<string, BaseSubagent> = new Map();
  protected context?: CoordinatorContext;
  protected executionTrace?: ExecutionTrace;

  constructor(config: CoordinatorConfig) {
    this.config = config;

    // Initialize Anthropic client
    this.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    console.log(`📋 Initialized ${config.name} coordinator`);
  }

  /**
   * Register a subagent with this coordinator
   */
  registerSubagent(subagent: BaseSubagent): void {
    const def = subagent.getDefinition();
    this.subagents.set(def.type, subagent);
    console.log(`🔧 Registered subagent: ${def.name} (${def.type})`);
  }

  /**
   * Execute coordinator - main entry point
   */
  async execute(request: CoordinatorRequest): Promise<CoordinatorResponse> {
    const startTime = Date.now();

    // Initialize context
    this.context = this.initializeContext(request);
    this.executionTrace = {
      coordinatorId: this.config.id,
      startTime: new Date(),
      decisions: [],
      subagentCalls: []
    };

    console.log(`\n🎯 [${this.config.name}] Starting execution`);
    console.log(`📝 User Query: ${request.userQuery}`);

    let iteration = 0;
    const maxIterations = this.config.maxIterations || 10;

    try {
      while (iteration < maxIterations) {
        iteration++;
        console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);

        // Make decision about next action
        const decision = await this.makeDecision();
        this.executionTrace.decisions.push(decision);

        console.log(`💭 Decision: ${decision.action}`);
        console.log(`   Reasoning: ${decision.reasoning}`);

        // Execute decision
        if (decision.action === 'call_subagent' && decision.taskToExecute) {
          await this.executeSubagentTask(decision.taskToExecute);
        } else if (decision.action === 'synthesize') {
          await this.synthesizeResults();
        } else if (decision.action === 'complete') {
          break;
        } else if (decision.action === 'pass_to_coordinator') {
          break;
        }

        // Update context
        this.context!.metadata.iterationCount = iteration;
        this.context!.metadata.lastUpdateTime = new Date();
      }

      // Generate final response
      const response = await this.generateFinalResponse();

      this.executionTrace.endTime = new Date();
      this.executionTrace.finalResult = response;

      const executionTime = Date.now() - startTime;
      console.log(`\n✅ [${this.config.name}] Completed in ${executionTime}ms (${iteration} iterations)`);

      return response;

    } catch (error) {
      console.error(`❌ [${this.config.name}] Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context: this.context!
      };
    }
  }

  /**
   * Initialize coordinator context from request
   */
  protected initializeContext(request: CoordinatorRequest): CoordinatorContext {
    return {
      coordinatorId: this.config.id,
      userQuery: request.userQuery,
      domain: this.config.domain,
      workingMemory: {
        conversationHistory: [],
        lastActionResult: {},
        previousResult: '',
        currentTask: request.userQuery,
        context: request.context || {}
      },
      executedTasks: [],
      taskResults: new Map(),
      metadata: {
        startTime: new Date(),
        lastUpdateTime: new Date(),
        iterationCount: 0
      }
    };
  }

  /**
   * Make decision about next action - implemented by specific coordinators
   */
  protected abstract makeDecision(): Promise<CoordinatorDecision>;

  /**
   * Synthesize results from subagents - implemented by specific coordinators
   */
  protected abstract synthesizeResults(): Promise<void>;

  /**
   * Generate final response - implemented by specific coordinators
   */
  protected abstract generateFinalResponse(): Promise<CoordinatorResponse>;

  /**
   * Execute a subagent task
   */
  protected async executeSubagentTask(task: SubagentTask): Promise<SubagentResult> {
    console.log(`\n🤖 Executing subagent task: ${task.taskType}`);
    console.log(`   Task ID: ${task.taskId}`);

    const subagent = this.subagents.get(task.taskType);
    if (!subagent) {
      throw new Error(`Subagent not found for task type: ${task.taskType}`);
    }

    const startTime = Date.now();
    const result = await subagent.executeTask(task);
    const executionTime = Date.now() - startTime;

    console.log(`   ${result.success ? '✅' : '❌'} Completed in ${executionTime}ms`);

    // Store result in context
    this.context!.taskResults.set(task.taskId, result);
    this.context!.executedTasks.push(task);

    // Add to execution trace
    this.executionTrace!.subagentCalls.push({
      task,
      result,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Call coordinator LLM for reasoning/decision making
   */
  protected async callCoordinatorLLM(
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const response = await this.anthropicClient.messages.create({
      model: this.config.llmConfig.model,
      max_tokens: this.config.llmConfig.maxTokens || 4000,
      temperature: this.config.llmConfig.temperature || 0.5,
      system: systemPrompt || this.config.systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    // Extract text content
    const textContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return textContent;
  }

  /**
   * Build context summary for LLM
   */
  protected buildContextSummary(): string {
    const ctx = this.context!;

    let summary = `Current Context Summary:\n\n`;
    summary += `User Query: ${ctx.userQuery}\n\n`;

    if (ctx.executedTasks.length > 0) {
      summary += `Executed Tasks (${ctx.executedTasks.length}):\n`;
      for (const task of ctx.executedTasks) {
        const result = ctx.taskResults.get(task.taskId);
        summary += `- ${task.taskType}: ${result?.success ? 'Success' : 'Failed'}\n`;
      }
      summary += '\n';
    }

    if (ctx.discoveredSchema) {
      summary += `Discovered Schema:\n${JSON.stringify(ctx.discoveredSchema, null, 2)}\n\n`;
    }

    if (ctx.dataAnalysis) {
      summary += `Data Analysis:\n${JSON.stringify(ctx.dataAnalysis, null, 2)}\n\n`;
    }

    summary += `Iteration: ${ctx.metadata.iterationCount}\n`;

    return summary;
  }

  /**
   * Get execution trace for debugging
   */
  getExecutionTrace(): ExecutionTrace | undefined {
    return this.executionTrace;
  }

  /**
   * Get current context
   */
  getContext(): CoordinatorContext | undefined {
    return this.context;
  }
}
