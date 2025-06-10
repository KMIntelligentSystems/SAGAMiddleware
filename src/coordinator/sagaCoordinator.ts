import { EventEmitter } from 'events';
import { 
  AgentDefinition, 
  SagaEvent, 
  AgentResult
} from '../types/index.js';
import { 
  VisualizationSAGAState, 
  VisualizationTransaction,
  VISUALIZATION_TRANSACTIONS,
  VisualizationWorkflowRequest,
  CompensationAction
} from '../types/visualizationSaga.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { ValidationManager } from '../sublayers/validationManager.js';
import { TransactionManager } from '../sublayers/transactionManager.js';

export class SagaCoordinator extends EventEmitter {
  private agents: Map<string, GenericAgent> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private executionOrder: string[] = [];
  private contextManager: ContextManager;
  private validationManager: ValidationManager;
  private transactionManager: TransactionManager;
  private activeExecutions: Set<string> = new Set();
  private visualizationSagaState: VisualizationSAGAState | null = null;

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
    
    console.log(`🔧 Registered agent: ${definition.name}`);
    console.log(`🔧 MCP servers: ${definition.mcpServers?.map(s => s.name).join(', ') || 'none'}`);
    console.log(`🔧 MCP tools: ${definition.mcpTools?.join(', ') || 'none'}`);
  }

  async ensureAgentMCPCapabilities(): Promise<void> {
    console.log('🔧 Ensuring all agents have MCP capabilities...');
    for (const [name, agent] of this.agents.entries()) {
      try {
        await agent.refreshCapabilities();
        const tools = agent.getAvailableTools();
        console.log(`🔧 Agent ${name} tools refreshed: ${tools.map(t => t.name).join(', ') || 'none'}`);
      } catch (error) {
        console.error(`🔧 Failed to refresh MCP capabilities for ${name}:`, error);
      }
    }
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

    for (const [name, definition] of this.agentDefinitions.entries()) {
      graph.set(name, definition.dependencies.map(d => d.agentName));
      inDegree.set(name, 0);
    }

    for (const [name, deps] of graph.entries()) {
      for (const dep of deps) {
        if (this.agentDefinitions.has(dep)) {
          inDegree.set(name, (inDegree.get(name) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [name, degree] of inDegree.entries()) {
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


  // ========================================
  // VISUALIZATION SAGA METHODS
  // ========================================

  initializeVisualizationSAGA(workflowId: string, request: VisualizationWorkflowRequest): void {
    this.visualizationSagaState = {
      id: workflowId,
      status: 'initializing',
      currentTransaction: 0,
      totalTransactions: VISUALIZATION_TRANSACTIONS.length,
      
      requirementsState: {
        threadId: request.threadId,
        conversationComplete: false,
        requirementsExtracted: false,
        validationComplete: false,
        extractedRequirements: request.visualizationRequest
      },
      
      dataFilteringState: {
        queryStarted: false,
        queryComplete: false,
        filteringComplete: false,
        dataValidated: false
      },
      
      chartSpecState: {
        analysisComplete: false,
        specificationGenerated: false,
        specificationValidated: false
      },
      
      reportState: {
        narrativeGenerated: false,
        dataEnhanced: false,
        outputValidated: false
      },
      
      errors: [],
      startTime: new Date(),
      compensations: []
    };

    console.log(`🎯 Initialized Visualization SAGA: ${workflowId}`);
    this.emit('visualization_saga_initialized', this.visualizationSagaState);
  }

sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

  async executeVisualizationSAGA(
    request: VisualizationWorkflowRequest,
    workflowId: string = `viz_saga_${Date.now()}`
  ): Promise<AgentResult> {
    console.log(`🚀 Starting Visualization SAGA: ${workflowId}`);
    
    this.initializeVisualizationSAGA(workflowId, request);
    
    const transactionId = await this.transactionManager.startTransaction('visualization_saga');
    
    try {
      // Execute transactions in order with compensation capability
      for (const transaction of VISUALIZATION_TRANSACTIONS) {
        this.visualizationSagaState!.currentTransaction++;
        
        console.log(`🔄 Executing Transaction: ${transaction.name} (${transaction.id})`);
        this.emit('visualization_transaction_started', { 
          transaction: transaction.id, 
          name: transaction.name,
          sagaState: this.visualizationSagaState 
        });
        console.log("NAME  ", transaction.name)
if(transaction.name == 'Initialize Requirements Gathering'){
  console.log("HEREEEEEEEEEEEEEEEEEEEE  ")
this.sleep(12000)
}
        const result = await this.executeVisualizationTransaction(transaction, request);
        
        if (!result.success) {
          console.log(`❌ Transaction failed: ${transaction.name} - ${result.error}`);
          this.visualizationSagaState!.errors.push(`${transaction.name}: ${result.error}`);
          
          // Execute compensations for completed transactions
          await this.executeCompensations();
          
          throw new Error(`Transaction ${transaction.name} failed: ${result.error}`);
        }

        // Update context with transaction result
        this.contextManager.updateContext(transaction.agentName, {
          lastTransactionResult: result.result,
          transactionId: transaction.id,
          timestamp: new Date()
        });

        console.log(`✅ Transaction completed: ${transaction.name}`);
        this.emit('visualization_transaction_completed', { 
          transaction: transaction.id,
          name: transaction.name, 
          result: result.result,
          sagaState: this.visualizationSagaState
        });
      }

      // All transactions completed successfully
      this.visualizationSagaState!.status = 'completed';
      this.visualizationSagaState!.endTime = new Date();
      
      await this.transactionManager.commitTransaction(transactionId);
      
      console.log(`🎉 Visualization SAGA completed successfully: ${workflowId}`);
      this.emit('visualization_saga_completed', this.visualizationSagaState);

      return {
        agentName: 'visualization_saga_coordinator',
        result: {
          sagaState: this.visualizationSagaState,
          finalOutput: this.visualizationSagaState?.reportState.finalOutput,
          summary: {
            totalTransactions: this.visualizationSagaState?.totalTransactions || 0,
            processingTime: this.visualizationSagaState?.endTime 
              ? this.visualizationSagaState.endTime.getTime() - this.visualizationSagaState.startTime.getTime()
              : 0,
            requirementsGathered: this.visualizationSagaState?.requirementsState.conversationComplete || false,
            dataFiltered: this.visualizationSagaState?.dataFilteringState.filteringComplete || false,
            chartSpecGenerated: this.visualizationSagaState?.chartSpecState.specificationGenerated || false
          }
        },
        success: true,
        timestamp: new Date()
      };

    } catch (error) {
      await this.transactionManager.rollbackTransaction(transactionId);
      
      this.visualizationSagaState!.status = 'failed';
      this.visualizationSagaState!.endTime = new Date();
      
      console.log(`💥 Visualization SAGA failed: ${workflowId} - ${error}`);
      this.emit('visualization_saga_failed', { 
        sagaState: this.visualizationSagaState, 
        error: error instanceof Error ? error.message : String(error) 
      });

      return {
        agentName: 'visualization_saga_coordinator',
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  private async executeVisualizationTransaction(
    transaction: VisualizationTransaction, 
    request: VisualizationWorkflowRequest
  ): Promise<AgentResult> {
    const agent = this.agents.get(transaction.agentName);
    if (!agent) {
      throw new Error(`Agent ${transaction.agentName} not registered for transaction ${transaction.id}`);
    }

    // Check dependencies are satisfied
    for (const depId of transaction.dependencies) {
      const depTransaction = VISUALIZATION_TRANSACTIONS.find(t => t.id === depId);
      if (depTransaction) {
        const depContext = this.contextManager.getContext(depTransaction.agentName);
        if (!depContext?.lastTransactionResult) {
          throw new Error(`Dependency ${depId} not satisfied for transaction ${transaction.id}`);
        }
      }
    }

    // Build context for this transaction
    const context = await this.buildVisualizationTransactionContext(transaction, request);
    
    // Execute the transaction
    const result = await agent.execute(context);
    
    // Update SAGA state based on transaction
    this.updateVisualizationSAGAState(transaction.id, result);
    
    // Record compensation action if transaction succeeded
    if (result.success && transaction.compensationAction) {
      this.visualizationSagaState!.compensations.push({
        transactionId: transaction.id,
        agentName: transaction.agentName,
        action: transaction.compensationAction as any,
        executed: false,
        timestamp: new Date()
      });
    }

    return result;
  }

  private async buildVisualizationTransactionContext(
    transaction: VisualizationTransaction, 
    request: VisualizationWorkflowRequest
  ): Promise<Record<string, any>> {
    const baseContext = {
      transactionId: transaction.id,
      transactionName: transaction.name,
      sagaState: this.visualizationSagaState,
      workflowRequest: request
    };

    // Add dependency results
    const dependencyContext: Record<string, any> = {};
    for (const depId of transaction.dependencies) {
      const depTransaction = VISUALIZATION_TRANSACTIONS.find(t => t.id === depId);
      if (depTransaction) {
        const depContext = this.contextManager.getContext(depTransaction.agentName);
        if (depContext?.lastTransactionResult) {
          dependencyContext[depId] = depContext.lastTransactionResult;
          dependencyContext[depTransaction.agentName] = depContext.lastTransactionResult;
        }
      }
    }

    return { ...baseContext, ...dependencyContext };
  }

  private updateVisualizationSAGAState(transactionId: string, result: AgentResult): void {
    if (!this.visualizationSagaState) return;

    switch (transactionId) {
      case 'req_init':
        this.visualizationSagaState.requirementsState.conversationComplete = result.success;
        break;
      case 'req_extract':
        this.visualizationSagaState.requirementsState.requirementsExtracted = result.success;
        if (result.success) {
          this.visualizationSagaState.requirementsState.extractedRequirements = result.result;
        }
        break;
      case 'req_validate':
        this.visualizationSagaState.requirementsState.validationComplete = result.success;
        break;
      case 'data_query':
        this.visualizationSagaState.dataFilteringState.queryStarted = true;
        this.visualizationSagaState.dataFilteringState.queryComplete = result.success;
        break;
      case 'data_filter':
        this.visualizationSagaState.dataFilteringState.filteringComplete = result.success;
        if (result.success) {
          this.visualizationSagaState.dataFilteringState.filteredData = result.result;
        }
        break;
      case 'chart_spec':
        this.visualizationSagaState.chartSpecState.specificationGenerated = result.success;
        if (result.success) {
          this.visualizationSagaState.chartSpecState.chartSpec = result.result;
        }
        break;
      case 'viz_report':
        this.visualizationSagaState.reportState.narrativeGenerated = result.success;
        this.visualizationSagaState.reportState.outputValidated = result.success;
        if (result.success) {
          this.visualizationSagaState.reportState.finalOutput = result.result;
        }
        break;
    }

    // Update overall status
    if (result.success) {
      if (transactionId === 'req_validate') {
        this.visualizationSagaState.status = 'filtering_data';
      } else if (transactionId === 'data_filter') {
        this.visualizationSagaState.status = 'specifying_chart';
      } else if (transactionId === 'chart_spec') {
        this.visualizationSagaState.status = 'generating_report';
      }
    }
  }

  private async executeCompensations(): Promise<void> {
    console.log(`🔄 Executing compensations for failed Visualization SAGA`);
    
    // Execute compensations in reverse order
    const compensations = [...this.visualizationSagaState!.compensations].reverse();
    
    for (const compensation of compensations) {
      if (!compensation.executed) {
        try {
          console.log(`↪️ Executing compensation: ${compensation.action} for ${compensation.agentName}`);
          await this.executeCompensationAction(compensation);
          compensation.executed = true;
        } catch (error) {
          console.error(`❌ Compensation failed: ${compensation.action} - ${error}`);
        }
      }
    }
  }

  private async executeCompensationAction(compensation: CompensationAction): Promise<void> {
    switch (compensation.action) {
      case 'cleanup_thread':
        // Clean up OpenAI thread if it was created
        if (this.visualizationSagaState?.requirementsState.threadId) {
          console.log(`🧹 Cleaning up thread: ${this.visualizationSagaState.requirementsState.threadId}`);
          // Could notify React app to clean up thread
        }
        break;
      case 'release_data':
        // Release any cached data
        if (this.visualizationSagaState?.dataFilteringState.filteredData) {
          console.log(`🧹 Releasing filtered data`);
          this.visualizationSagaState.dataFilteringState.filteredData = undefined;
        }
        break;
      case 'reset_state':
        // Reset agent state
        this.contextManager.clearContext(compensation.agentName);
        break;
      case 'notify_failure':
        // Emit failure notification
        this.emit('compensation_executed', { 
          action: compensation.action, 
          agentName: compensation.agentName 
        });
        break;
    }
  }

  getVisualizationSAGAState(): VisualizationSAGAState | null {
    return this.visualizationSagaState ? { ...this.visualizationSagaState } : null;
  }

  getVisualizationRequirements(): any {
    return this.visualizationSagaState?.requirementsState.extractedRequirements || null;
  }

  getVisualizationOutput(): any {
    return this.visualizationSagaState?.reportState.finalOutput || null;
  }
}