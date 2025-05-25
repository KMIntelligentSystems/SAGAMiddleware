import { EventEmitter } from 'events';
import { AgentDefinition, SagaEvent, AgentResult } from '../types';
import { GenericAgent } from '../agents/genericAgent';
import { ContextManager } from '../sublayers/contextManager';
import { ValidationManager } from '../sublayers/validationManager';
import { TransactionManager } from '../sublayers/transactionManager';

export class SagaCoordinator extends EventEmitter {
  private agents: Map<string, GenericAgent> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private executionOrder: string[] = [];
  private contextManager: ContextManager;
  private validationManager: ValidationManager;
  private transactionManager: TransactionManager;
  private activeExecutions: Set<string> = new Set();

  constructor() {
    super();
    this.contextManager = new ContextManager();
    this.validationManager = new ValidationManager();
    this.transactionManager = new TransactionManager();
  }

  registerAgent(definition: AgentDefinition): void {
    const agent = new GenericAgent(definition);
    this.agents.set(definition.name, agent);
    this.agentDefinitions.set(definition.name, definition);
    this.recalculateExecutionOrder();
  }

  async executeWorkflow(
    initialContext: Record<string, any> = {},
    correlationId: string = `workflow_${Date.now()}`
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();
    
    this.emitEvent({
      id: `start_${correlationId}`,
      type: 'transaction_start',
      data: { executionOrder: this.executionOrder },
      timestamp: new Date(),
      correlationId
    });

    const transactionId = await this.transactionManager.startTransaction('workflow');

    try {
      for (const agentName of this.executionOrder) {
        if (this.activeExecutions.has(agentName)) {
          throw new Error(`Agent ${agentName} is already executing`);
        }

        this.activeExecutions.add(agentName);
        
        try {
          const result = await this.executeAgent(agentName, initialContext, correlationId);
          results.set(agentName, result);

          if (!result.success) {
            throw new Error(`Agent ${agentName} failed: ${result.error}`);
          }

          this.contextManager.updateContext(agentName, { 
            lastResult: result.result,
            executionTime: result.timestamp 
          });

        } finally {
          this.activeExecutions.delete(agentName);
        }
      }

      await this.transactionManager.commitTransaction(transactionId);
      
      this.emitEvent({
        id: `commit_${correlationId}`,
        type: 'transaction_commit',
        data: { results: Array.from(results.entries()) },
        timestamp: new Date(),
        correlationId
      });

      return results;

    } catch (error) {
      await this.transactionManager.rollbackTransaction(transactionId);
      
      this.emitEvent({
        id: `rollback_${correlationId}`,
        type: 'transaction_rollback',
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        correlationId
      });

      throw error;
    }
  }

  async executeAgent(
    agentName: string, 
    additionalContext: Record<string, any> = {},
    correlationId: string = `agent_${Date.now()}`
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    this.emitEvent({
      id: `start_${agentName}_${correlationId}`,
      type: 'agent_start',
      agentName,
      timestamp: new Date(),
      correlationId
    });

    try {
      const dependencies = await this.resolveDependencies(agentName);
      const context = {
        ...this.contextManager.getContext(agentName),
        ...dependencies,
        ...additionalContext
      };

      const result = await agent.execute(context);

      const validation = await this.validationManager.validateAgentOutput(
        agentName, 
        result.result
      );

      if (!validation.isValid) {
        result.success = false;
        result.error = `Validation failed: ${validation.errors.join(', ')}`;
      }

      this.emitEvent({
        id: `complete_${agentName}_${correlationId}`,
        type: result.success ? 'agent_complete' : 'agent_error',
        agentName,
        data: { result: result.result, validation },
        timestamp: new Date(),
        correlationId
      });

      return result;

    } catch (error) {
      const errorResult: AgentResult = {
        agentName,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };

      this.emitEvent({
        id: `error_${agentName}_${correlationId}`,
        type: 'agent_error',
        agentName,
        data: { error: errorResult.error },
        timestamp: new Date(),
        correlationId
      });

      return errorResult;
    }
  }

  private async resolveDependencies(agentName: string): Promise<Record<string, any>> {
    const definition = this.agentDefinitions.get(agentName);
    if (!definition || !definition.dependencies.length) {
      return {};
    }

    const dependencyData: Record<string, any> = {};

    for (const dep of definition.dependencies) {
      const depContext = this.contextManager.getContext(dep.agentName);
      if (dep.required && !depContext?.lastResult) {
        throw new Error(`Required dependency ${dep.agentName} has not been executed`);
      }
      
      if (depContext?.lastResult) {
        dependencyData[dep.agentName] = depContext.lastResult;
      }
    }

    return dependencyData;
  }

  private recalculateExecutionOrder(): void {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const [name, definition] of this.agentDefinitions) {
      graph.set(name, definition.dependencies.map(d => d.agentName));
      inDegree.set(name, 0);
    }

    for (const [name, deps] of graph) {
      for (const dep of deps) {
        if (this.agentDefinitions.has(dep)) {
          inDegree.set(name, (inDegree.get(name) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const dependents = Array.from(this.agentDefinitions.entries())
        .filter(([_, def]) => def.dependencies.some(d => d.agentName === current))
        .map(([name, _]) => name);

      for (const dependent of dependents) {
        const currentDegree = inDegree.get(dependent) || 0;
        inDegree.set(dependent, currentDegree - 1);
        
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }

    if (result.length !== this.agentDefinitions.size) {
      throw new Error('Circular dependency detected in agent definitions');
    }

    this.executionOrder = result;
  }

  private emitEvent(event: SagaEvent): void {
    this.emit('saga_event', event);
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  getValidationManager(): ValidationManager {
    return this.validationManager;
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }

  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}