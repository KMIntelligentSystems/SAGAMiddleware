// Base Process class for SAGA pattern
// Each Process represents one temporal business step in the workflow

import { EventEmitter } from 'events';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { TransactionSetCollection, SetExecutionResult } from '../types/visualizationSaga.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { ContextSetDefinition } from '../services/contextRegistry.js';
import { AgentCreationRequest, AgentDefinitionSource } from '../factory/types.js';

/**
 * Process state in the saga lifecycle
 */
export enum ProcessState {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

/**
 * Context passed to Process.execute()
 */
export interface ProcessContext {
  request: BrowserGraphRequest;
  sagaId: string;
  contextSet: ContextSetDefinition | null;
  previousResults?: Map<string, any>; // Results from previous processes
  globalContext?: Record<string, any>;
}

/**
 * Result returned by Process.execute()
 */
export interface ProcessResult {
  success: boolean;
  state: ProcessState;
  data: any;
  error?: string;
  metadata: {
    processId: string;
    processName: string;
    startTime: Date;
    endTime: Date;
    executionTime: number;
  };
  outputContext?: Record<string, any>; // Data passed to next process
}

/**
 * Configuration for Process
 */
export interface ProcessConfig {
  id: string;
  name: string;
  description: string;
  maxRetries?: number;
  timeout?: number;
  canCompensate?: boolean;
}

/**
 * Base Process class
 *
 * Represents one temporal business step in the SAGA workflow.
 * Each Process:
 * 1. Defines its own dynamic agents (via coordination agent)
 * 2. Validates agent definitions
 * 3. Executes agents (with success/failure validation loop)
 * 4. Passes results to next Process
 *
 * Pattern:
 * - CoordinationAgent (e.g., TransactionGroupingAgent) creates agent definitions
 * - ValidatingAgent validates the definitions (loop until valid)
 * - AgentParser creates GenericAgents (deterministic)
 * - Execute agents (coder → tool caller → validator loop)
 * - Return results
 */
export abstract class Process extends EventEmitter {
  protected config: ProcessConfig;
  protected coordinator: SagaCoordinator;
  protected state: ProcessState = ProcessState.PENDING;
  protected createdAgentIds: string[] = [];

  constructor(config: ProcessConfig, coordinator: SagaCoordinator) {
    super();
    this.config = config;
    this.coordinator = coordinator;
  }

  /**
   * Execute the process
   * Template method pattern - defines the standard flow
   */
  async execute(context: ProcessContext): Promise<ProcessResult> {
    const startTime = new Date();
    this.state = ProcessState.EXECUTING;
    this.emit('process:started', { processId: this.config.id, processName: this.config.name });

    try {
      console.log(`\n🎯 Starting Process: ${this.config.name}`);
      console.log(`📋 Process ID: ${this.config.id}`);

      // Step 1: Define agents for this process
      const agentDefinitions = await this.defineAgents(context);
      console.log(`✅ Defined ${agentDefinitions.length} agents for ${this.config.name}`);

      // Step 2: Validate agent definitions (with retry loop)
      const validatedDefinitions = await this.validateAgentDefinitions(agentDefinitions, context);
      console.log(`✅ Validated ${validatedDefinitions.length} agent definitions`);

      // Step 3: Register agents with coordinator
      await this.registerAgents(validatedDefinitions);
      console.log(`✅ Registered agents with coordinator`);

      // Step 4: Execute the process logic (agents run with validation loop)
      const executionResult = await this.executeProcessLogic(context);
      console.log(`✅ Process execution complete`);

      // Step 5: Process results
      const processedData = await this.processResults(executionResult, context);

      const success = executionResult.success;
      this.state = success ? ProcessState.COMPLETED : ProcessState.FAILED;

      const endTime = new Date();
      const result: ProcessResult = {
        success,
        state: this.state,
        data: processedData,
        error: executionResult.error,
        metadata: {
          processId: this.config.id,
          processName: this.config.name,
          startTime,
          endTime,
          executionTime: endTime.getTime() - startTime.getTime()
        },
        outputContext: this.extractOutputContext(processedData)
      };

      this.emit('process:completed', result);
      console.log(`✅ Process ${this.config.name} completed successfully\n`);
      return result;

    } catch (error) {
      this.state = ProcessState.FAILED;
      const endTime = new Date();

      const result: ProcessResult = {
        success: false,
        state: ProcessState.FAILED,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          processId: this.config.id,
          processName: this.config.name,
          startTime,
          endTime,
          executionTime: endTime.getTime() - startTime.getTime()
        }
      };

      this.emit('process:failed', result);
      console.error(`❌ Process ${this.config.name} failed:`, result.error);
      return result;
    }
  }

  /**
   * Compensate the process (rollback)
   */
  async compensate(): Promise<void> {
    if (!this.config.canCompensate) {
      console.warn(`⚠️  Process ${this.config.name} cannot be compensated`);
      return;
    }

    this.state = ProcessState.COMPENSATING;
    this.emit('process:compensating', { processId: this.config.id });

    try {
      console.log(`↩️  Compensating Process: ${this.config.name}`);

      // Unregister agents created by this process
      await this.unregisterAgents();

      // Execute custom compensation logic
      await this.executeCompensation();

      this.state = ProcessState.COMPENSATED;
      this.emit('process:compensated', { processId: this.config.id });
      console.log(`✅ Process ${this.config.name} compensated`);
    } catch (error) {
      console.error(`❌ Compensation failed for ${this.config.name}:`, error);
      this.emit('process:compensation_failed', {
        processId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Unregister agents created by this process
   */
  private async unregisterAgents(): Promise<void> {
    this.createdAgentIds.forEach(agentId => {
      for (const [name, agent] of this.coordinator.agents.entries()) {
        if (agent.getId() === agentId) {
          this.coordinator.agents.delete(name);
          console.log(`  ✓ Unregistered agent: ${name} (${agentId})`);
          break;
        }
      }
    });
    this.createdAgentIds = [];
  }

  // ========== Getters ==========

  getState(): ProcessState {
    return this.state;
  }

  getConfig(): ProcessConfig {
    return { ...this.config };
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  canCompensate(): boolean {
    return this.config.canCompensate ?? false;
  }

  getCreatedAgentIds(): string[] {
    return [...this.createdAgentIds];
  }

  // ========== Abstract Methods (MUST override in subclasses) ==========

  /**
   * Step 1: Define agents for this process
   * Use TransactionGroupingAgent or similar to create agent definitions
   */
  protected abstract defineAgents(context: ProcessContext): Promise<string[]>;

  /**
   * Step 2: Validate agent definitions (with retry loop)
   * Use ValidatingAgent in a loop until valid
   */
  protected abstract validateAgentDefinitions(
    agentDefinitions: string[],
    context: ProcessContext
  ): Promise<any[]>;

  /**
   * Step 4: Execute the process logic
   * Run the agents (coder → tool caller → validator loop)
   */
  protected abstract executeProcessLogic(context: ProcessContext): Promise<SetExecutionResult>;

  // ========== Hook Methods (Override as needed) ==========

  /**
   * Step 3: Register agents (can override for custom registration)
   */
  protected async registerAgents(validatedDefinitions: any[]): Promise<void> {
    const factory = this.coordinator.agentFactory;

    // Use factory to create AgentDefinitions from validated text
    const request: AgentCreationRequest = {
      conversationText: validatedDefinitions.join('\n'),
      source: AgentDefinitionSource.DEFAULT_AGENT
    };

    const result = factory.defineAgents(request);

    if (!result.success) {
      throw new Error(`Agent registration failed: ${result.errors?.join(', ')}`);
    }

    // Register each agent
    result.agentDefinitions.forEach(def => {
      factory.registerAgent(this.coordinator, def);
      this.createdAgentIds.push(def.id);
    });

    // Register flows if provided
    if (result.flowInfo && result.flowInfo.flow.length > 0) {
      this.coordinator.registerAgentFlows(result.flowInfo.flow);
    }
  }

  /**
   * Step 5: Process execution results
   */
  protected async processResults(
    executionResult: SetExecutionResult,
    context: ProcessContext
  ): Promise<any> {
    // Default: return raw result
    return executionResult;
  }

  /**
   * Extract output context for next process
   */
  protected extractOutputContext(data: any): Record<string, any> | undefined {
    return undefined;
  }

  /**
   * Execute custom compensation logic
   */
  protected async executeCompensation(): Promise<void> {
    // Default: no-op
  }

  // ========== Utility Methods ==========

  /**
   * Parse conversation result to extract content for a specific agent
   * Extracts content between [AGENT: agentName, id]...[/AGENT] tags
   *
   * @param conversationResult - User request or conversation text
   * @param agentName - Name of agent to extract content for
   * @returns Extracted content for the specified agent
   */
  protected parseConversationResultForAgent(conversationResult: any, agentName: string): string {
    try {
      // Extract the result string from the conversation context
      let resultText = '';
      if (typeof conversationResult === 'string') {
        resultText = conversationResult;
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        return '';
      }

      // Extract content between bracket tags for this agent
      // Handle formats: [AGENT: AgentName, id] and legacy formats
      const startTagPattern = new RegExp(`\\[AGENT:\\s*${agentName}(?:,\\s*[^\\]]+)?\\]`);
      const endTag = `[/AGENT]`;

      const startTagMatch = resultText.match(startTagPattern);
      let startIndex = -1;
      let startTagLength = 0;

      if (startTagMatch) {
        startIndex = startTagMatch.index!;
        startTagLength = startTagMatch[0].length;
        console.log(`🔍 Process: Found start tag for ${agentName} at index ${startIndex}`);
      } else {
        console.log(`🔍 Process: No matching start tag found for agent: ${agentName}`);
      }

      const endIndex = resultText.indexOf(endTag, startIndex);

      if (startIndex !== -1 && endIndex !== -1) {
        // Extract just the content, no bracket tags
        let content = resultText.substring(startIndex + startTagLength, endIndex).trim();

        // Remove any leading period or numbered prefix that might be captured
        content = content.replace(/^\d+\.\s*/, '').replace(/^\./, '').trim();

        console.log(`✅ Process: Extracted content for ${agentName} (${content.length} chars)`);
        return content;
      }

      console.log(`⚠️ Process: No bracket tags found for ${agentName}`);
      return '';
    } catch (error) {
      console.warn(`Process: Failed to parse conversation result for agent ${agentName}:`, error);
      return '';
    }
  }
}