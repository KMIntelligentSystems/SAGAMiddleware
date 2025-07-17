import { EventEmitter } from 'events';
import { 
  AgentDefinition, 
  SagaEvent, 
  AgentResult,
  WorkingMemory
} from '../types/index.js';
import { 
  SagaState, 
  SagaTransaction,
  SAGA_TRANSACTIONS,
  SagaWorkflowRequest,
  CompensationAction,
  IterationState,
  IterationConfig
} from '../types/visualizationSaga.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { ValidationManager } from '../sublayers/validationManager.js';
import { TransactionManager } from '../sublayers/transactionManager.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { ContextSetDefinition } from '../services/contextRegistry.js';

export class SagaCoordinator extends EventEmitter {
  private agents: Map<string, GenericAgent> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private executionOrder: string[] = [];
  private contextManager: ContextManager;
  private validationManager: ValidationManager;
  private transactionManager: TransactionManager;
  private activeExecutions: Set<string> = new Set();
  private sagaState: SagaState | null = null;
  private currentExecutingTransactionSet: SagaTransaction[] | null = null;
  private iterationStates: Map<string, IterationState> = new Map();
 // private currentContextSet: ContextSetDefinition | null = null;

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
 //   this.recalculateExecutionOrder();
    
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
  // SAGA METHODS
  // ========================================

  initializeSaga(workflowId: string, request: SagaWorkflowRequest, transactionCount?: number): void {
    this.sagaState = {
      id: workflowId,
      status: 'initializing',
      currentTransaction: 0,
      totalTransactions: transactionCount || SAGA_TRANSACTIONS.length,
      
    
      errors: [],
      startTime: new Date(),
      compensations: []
    };

    console.log(`🎯 Initialized SAGA: ${workflowId}`);
    this.emit('saga_initialized', this.sagaState);
  }

sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

  async executeSagaWorkflow(
    request: BrowserGraphRequest, //SagaWorkflowRequest,
    workflowId: string = `saga_${Date.now()}`,
    transactionOrdering?: SagaTransaction[],
    contextSet?: ContextSetDefinition
  ): Promise<AgentResult> {
    console.log(`🚀 Starting SAGA: ${workflowId}`);
    
    // Use provided transaction ordering or fall back to default
    const transactionsToExecute = transactionOrdering || SAGA_TRANSACTIONS;

   // this.initializeSaga(workflowId, request, transactionsToExecute.length);
    
    //const transactionId = await this.transactionManager.startTransaction('visualization_saga');
    let counter = 0;
    try {
      // Store the current executing transaction set and context set
      this.currentExecutingTransactionSet = transactionsToExecute;
      this.contextManager.setActiveContextSet(contextSet)
    /*  this.currentContextSet = contextSet || null;
      
      console.log(`🔄 Executing ${transactionsToExecute.length} transactions from ${transactionOrdering ? 'TransactionRegistry' : 'default configuration'}`);
      console.log(`📊 Using context set: ${contextSet?.name || 'none'} with ${contextSet?.dataSources.length || 0} data sources`);*/
      
      // Execute transactions in order with compensation capability
      //executeWorkflow above use executeOrder array
      // SAGA_TRANSACTIONS:SagaTransaction
      
      // Group transactions by iteration groups
      const iterationGroups = this.groupTransactionsByIteration(transactionsToExecute);
      const regularTransactions = transactionsToExecute.filter(t => !t.iterationGroup);
      
      for (const transaction of transactionsToExecute) {
        console.log(`🔄 Executing Transaction: ${transaction.name} (${transaction.id})`);
        
        let result: AgentResult;
        
        // Check if this transaction has circular dependencies
        if (this.hasCircularDependency(transaction, transactionsToExecute)) {
          // Handle circular dependency with agent-driven loop control
          const circularPartner = this.findCircularPartner(transaction, transactionsToExecute);
          if (circularPartner) {
            result = await this.executeCircularDependencyLoop(transaction, circularPartner, request);
          } else {
            throw new Error(`Circular dependency detected but no partner found for ${transaction.id}`);
          }
        } else if (transaction.iterationGroup && iterationGroups.has(transaction.iterationGroup)) {
          // Handle iterative transaction group
          if (transaction.iterationRole === 'coordinator') {
            // This is the start of an iteration group - execute the full iterative cycle
            result = await this.executeIterativeTransactionGroup(
              iterationGroups.get(transaction.iterationGroup)!,
              request,
              {
                groupId: transaction.iterationGroup,
                maxIterations: 100, // Default max iterations
                chunkBatchSize: 1
              }
            );
            
            // Skip other transactions in this group as they've been processed
            const groupTransactionIds = iterationGroups.get(transaction.iterationGroup)!.map(t => t.id);
            counter += groupTransactionIds.length - 1; // Adjust counter for skipped transactions
          } else {
            // This transaction is part of a group but not the coordinator - skip it
            // (it will be executed as part of the coordinator's iteration cycle)
            continue;
          }
        } else {
          // Regular transaction execution
          result = await this.executeSagaTransaction(transaction, request);
        } 
        console.log("RRESULT ", result.result)
        
        if (!result.success) {
          console.log(`❌ Transaction failed: ${transaction.name} - ${result.error}`);
          this.sagaState!.errors.push(`${transaction.name}: ${result.error}`);
          
          // Execute compensations for completed transactions
          await this.executeCompensations();
          
          throw new Error(`Transaction ${transaction.name} failed: ${result.error}`);
        }
        // Each agent gets its own instructions from the bracket parsing - no context passing needed
        counter++;
    
    console.log("HERE BEFOR UPDATA CONTEXT")
        // Update context with transaction result
        this.contextManager.updateContext(transaction.agentName, {
          lastTransactionResult: result.result,
          transactionId: transaction.id,
          timestamp: new Date()
        });

        console.log(`✅ Transaction completed: ${transaction.name}`);
          // All transactions completed successfully
     /*   this.visualizationSagaState!.status = 'completed';
       this.visualizationSagaState!.endTime = new Date();
        this.emit('visualization_transaction_completed', { 
          transaction: transaction.id,
          name: transaction.name, 
          result: result.result,
          sagaState: this.visualizationSagaState
        });*/
      }
 
  
    //  await this.transactionManager.commitTransaction(transactionId);
      
      console.log(`🎉 SAGA completed successfully: ${workflowId}`);

 return {
        agentName: 'saga_coordinator',
        result: '',
        success: true,
        timestamp: new Date()
      };
    } catch (error) {
   //   await this.transactionManager.rollbackTransaction(transactionId);
      
  //  💥 Visualization SAGA failed: thread_saga_thread_JO596op9tdbjiJaySjJPQe21_1751344836444 - TypeError: Cannot set properties of undefined (setting 'context')
      
      console.log(`💥 SAGA failed: ${workflowId} - ${error}`);
    
      return {
        agentName: 'saga_coordinator',
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    } finally {
      // Clear the current executing transaction set and context set
      this.currentExecutingTransactionSet = null;
   //   this.currentContextSet = null;
    }
  }

  private async executeSagaTransaction(
    transaction: SagaTransaction, 
    request: BrowserGraphRequest
  ): Promise<AgentResult> {
    const agent = this.agents.get(transaction.agentName);
    if (!agent) {
      throw new Error(`Agent ${transaction.agentName} not registered for transaction ${transaction.id}`);
    }

    // Build context for this transaction
    const context = await this.buildSagaTransactionContext(transaction, request);
    
    // Execute the transaction
    const result = await agent.execute(context);
    console.log("RESULT ", result.result)
    
       // Check dependencies are satisfied (use the current transaction set being executed)
 /*  for (const depId of transaction.dependencies) {
      // Find dependency in the current transaction set being executed
      const transactionsToExecute = this.currentExecutingTransactionSet || SAGA_TRANSACTIONS;
      const depTransaction = transactionsToExecute.find(t => t.id === depId);
      if (depTransaction) {
        const depContext = this.contextManager.getContext(depTransaction.agentName);
        console.log("DEPS   ", depContext)
        if (!depContext?.lastTransactionResult) {
          throw new Error(`Dependency ${depId} not satisfied for transaction ${transaction.id}`);
        }
      }
    }*/


    // Update SAGA state based on transaction
  /*  this.updateVisualizationSAGAState(transaction.id, result);
    
    // Record compensation action if transaction succeeded
    if (result.success && transaction.compensationAction) {
      this.visualizationSagaState!.compensations.push({
        transactionId: transaction.id,
        agentName: transaction.agentName,
        action: transaction.compensationAction as any,
        executed: false,
        timestamp: new Date()
      });
    }*/
//await new Promise(resolve => setTimeout(resolve, 500));
    return result;
  }

  private async buildSagaTransactionContext(
    transaction: SagaTransaction, 
    request: SagaWorkflowRequest
  ): Promise<Record<string, any>> {
    const currContextSet: ContextSetDefinition = this.contextManager.getActiveContextSet();
    const conversationContext: WorkingMemory = this.contextManager.getContext('ConversationAgent') as WorkingMemory;
    
    let context: Record<string, any> = {};
    
    // 1. Extract data sources information to string (if not empty)
    let dataSourcesText = '';
    if (currContextSet.dataSources && currContextSet.dataSources.length > 0) {
      dataSourcesText = 'Data Sources:\n';
      currContextSet.dataSources.forEach((dataSource, index) => {
        dataSourcesText += `${index + 1}. ${dataSource.name} (${dataSource.type})`;
        if (dataSource.path) {
          dataSourcesText += ` - Path: ${dataSource.path}`;
        }
        if (dataSource.connectionString) {
          dataSourcesText += ` - Connection: ${dataSource.connectionString}`;
        }
        if (dataSource.tableName) {
          dataSourcesText += ` - Table: ${dataSource.tableName}`;
        }
        dataSourcesText += '\n';
      });
    }
    
    // 2. Always provide the LLM prompt
    let llmPromptText = '';
    const relevantPrompt = currContextSet.llmPrompts.find(p => p.agentName === transaction.agentName);
    if (relevantPrompt) {
      llmPromptText = `Agent: ${relevantPrompt.agentName}\n`;
      llmPromptText += `Backstory: ${relevantPrompt.backstory}\n`;
      llmPromptText += `Task Description: ${relevantPrompt.taskDescription}\n`;
      llmPromptText += `Expected Output: ${relevantPrompt.taskExpectedOutput}\n`;
      
      // Include existing context if available
      if (relevantPrompt.context) {
        llmPromptText += `Additional Context: ${JSON.stringify(relevantPrompt.context)}\n`;
      }
    }
    
    // 3. Parse user query to extract agent-specific task descriptions
    let agentSpecificTask = '';
    if (transaction.agentName === 'ConversationAgent') {
      // ConversationAgent needs the entire user query for human-in-the-loop conversations
      agentSpecificTask = request.userQuery || '';
    } 
    else {
      // For other agents, first try to get instructions from ConversationAgent's working memory
      if (conversationContext && conversationContext.lastTransactionResult) {
        console.log("HERE IN CONVERSATIONCONTEXT")
        agentSpecificTask = this.parseConversationResultForAgent(conversationContext.lastTransactionResult, transaction.agentName);
        if (transaction.agentName === 'DataManipulationAgent'){
            const filteringAgentContext: WorkingMemory = this.contextManager.getContext('DataFilteringAgent') as WorkingMemory;
            console.log('FILTERING AGENT   ',JSON.stringify(filteringAgentContext.lastTransactionResult))
            agentSpecificTask += `**FIND THE DATASET IN RESULTS**\n` + JSON.stringify(filteringAgentContext.lastTransactionResult);
        }
      }

      // If no conversation context available, fall back to parsing the original user query
      if (!agentSpecificTask && request.userQuery) {
        console.log('request.userQuery  ', request.userQuery)
        agentSpecificTask = this.parseUserQueryForAgent(request.userQuery, transaction.agentName);
      }
    }
    
    // Build final context with text-only variables
    context = {
     // dataSources: dataSourcesText,
   //   llmPrompt: llmPromptText,
      agentSpecificTask: agentSpecificTask
      //userQuery: request.userQuery || ''
    };
    
    console.log(`📊 Built context for ${transaction.agentName}: data sources (${currContextSet.dataSources?.length || 0}), prompt available: ${!!relevantPrompt}`);
    
    return context;
  }

  private parseConversationResultForAgent(conversationResult: any, agentName: string): string {
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
      console.log('CONVERSATION RESULT   ',conversationResult)
      console.log('RESULT TEXT FOR PARSING:', resultText);
      
      // Extract content between bracket tags for this agent
      // Handle both formats: [AGENT:AgentName] and [AGENT: AgentName] (with space)
      const startTag1 = `[AGENT:${agentName}]`;
      const startTag2 = `[AGENT: ${agentName}]`;
      const endTag = `[/AGENT]`;
      
      console.log(`🔍 Looking for tags: "${startTag1}" OR "${startTag2}" and "${endTag}"`);
      
      let startIndex = resultText.indexOf(startTag1);
      let startTagLength = startTag1.length;
      
      if (startIndex === -1) {
        startIndex = resultText.indexOf(startTag2);
        startTagLength = startTag2.length;
      }
      
      const endIndex = resultText.indexOf(endTag, startIndex);
      
      console.log(`🔍 Found startIndex: ${startIndex}, endIndex: ${endIndex}`);
      
      if (startIndex !== -1 && endIndex !== -1) {
        // Extract just the content, no bracket tags
        let content = resultText.substring(startIndex + startTagLength, endIndex).trim();
        
        // Remove any leading period or numbered prefix that might be captured
        content = content.replace(/^\d+\.\s*/, '').replace(/^\./, '').trim();
        
        console.log(`✅ Extracted content for ${agentName}:`, content);
        /*
Extracted content for DataFilteringAgent: Task for structured query search. **CRITICAL**: You must return the JSON EXACTLY as provided below. Do not modify field names, do not convert metadata_filters to search_text,
 do not change the structure in any way. Copy and return this exact JSON: { "collection": "supply_analysis", "metadata_filters": { "category_type": "Coal" }, "date_filters": 
{ "field": "datetime", "start_date": "2023-11-02T04:00:00.000Z", "end_date": "2023-11-05T23:55:00.000Z" }, "limit": 1000, "include_distances": false } Do not interpret or modify this JSON. Return it exactly as shown.
        */
        return content;
      }
    
      console.log(`⚠️ No bracket tags found for ${agentName}`);
      return '';
    } catch (error) {
      console.warn(`Failed to parse conversation result for agent ${agentName}:`, error);
      return '';
    }
  }


  private parseUserQueryForAgent(userQuery: string, agentName: string): string {
    try {
      // Split the user query into sections by numbered lines
      const sections = userQuery.split(/\d+\.\s*Agent name:/);
      
      for (const section of sections) {
        if (section.trim() === '') continue;
        
        // Extract agent name and task description from each section
        const lines = section.trim().split('\n');
        const agentNameLine = lines[0]?.trim();
        
        // Check if this section is for the current agent
        if (agentNameLine?.includes(agentName)) {
          // Find the task description line
          const taskDescIndex = lines.findIndex(line => 
            line.trim().toLowerCase().startsWith('task description:')
          );
          
          if (taskDescIndex !== -1) {
            // Extract everything after "Task description:"
            let taskDescription = lines[taskDescIndex].replace(/task description:\s*/i, '').trim();
            
            // Include any additional lines that are part of the task description
            for (let i = taskDescIndex + 1; i < lines.length; i++) {
              if (lines[i].trim() && !lines[i].includes('Agent name:')) {
                taskDescription += ' ' + lines[i].trim();
              } else {
                break;
              }
            }
            
            return taskDescription;
          }
        }
      }
      
      // If no specific task found for this agent, return empty string
      return '';
    } catch (error) {
      console.warn(`Failed to parse user query for agent ${agentName}:`, error);
      return '';
    }
  }

  private updateSagaState(transactionId: string, result: AgentResult): void {
    if (!this.sagaState) return;

  /*  switch (transactionId) {
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
    }*/

    // Update overall status
    if (result.success) {
      if (transactionId === 'req_validate') {
        this.sagaState.status = 'filtering_data';
      } else if (transactionId === 'data_filter') {
        this.sagaState.status = 'specifying_chart';
      } else if (transactionId === 'chart_spec') {
        this.sagaState.status = 'generating_report';
      }
    }
  }

  private async executeCompensations(): Promise<void> {
    console.log(`🔄 Executing compensations for failed SAGA`);
    
    // Execute compensations in reverse order
    const compensations = [...this.sagaState!.compensations].reverse();
    
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
   /* switch (compensation.action) {
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
    }*/
  }

  getSagaState(): SagaState | null {
    return this.sagaState ? { ...this.sagaState } : null;
  }

  getRequirements(): any {
    return '';//this.sagaState?.requirementsState.extractedRequirements || null;
  }

  getOutput(): any {
    return '';//this.sagaState?.reportState.finalOutput || null;
  }

  // ========================================
  // ITERATIVE TRANSACTION GROUP METHODS
  // ========================================

  private groupTransactionsByIteration(transactions: SagaTransaction[]): Map<string, SagaTransaction[]> {
    const groups = new Map<string, SagaTransaction[]>();
    
    for (const transaction of transactions) {
      if (transaction.iterationGroup) {
        if (!groups.has(transaction.iterationGroup)) {
          groups.set(transaction.iterationGroup, []);
        }
        groups.get(transaction.iterationGroup)!.push(transaction);
      }
    }
    
    // Sort transactions within each group by role priority
    const rolePriority = { 'coordinator': 1, 'fetcher': 2, 'processor': 3, 'saver': 4, 'generator': 5, 'reflector': 5 };
    for (const [groupId, groupTransactions] of groups.entries()) {
      groupTransactions.sort((a, b) => {
        const priorityA = rolePriority[a.iterationRole || 'coordinator'];
        const priorityB = rolePriority[b.iterationRole || 'coordinator'];
        return priorityA - priorityB;
      });
    }
    
    return groups;
  }

  private async executeIterativeTransactionGroup(
    groupTransactions: SagaTransaction[],
    request: BrowserGraphRequest,
    config: IterationConfig
  ): Promise<AgentResult> {
    console.log(`🔄 Starting iterative transaction group: ${config.groupId}`);
    
    // Initialize iteration state
    const iterationState: IterationState = {
      transactionGroupId: config.groupId,
      currentIteration: 0,
      chunkIds: [],
      currentChunkIndex: 0,
      maxIterations: config.maxIterations || 100,
      iterationResults: [],
      metadata: {
        processedChunks: 0,
        startTime: new Date()
      }
    };
    
    this.iterationStates.set(config.groupId, iterationState);
    
    try {
      // Phase 1: Initial setup - coordinator gets collection info and chunk IDs
      const coordinator = groupTransactions.find(t => t.iterationRole === 'coordinator');
      const fetcher = groupTransactions.find(t => t.iterationRole === 'fetcher');
      const saver = groupTransactions.find(t => t.iterationRole === 'saver');
      
      if (!coordinator || !fetcher || !saver) {
        throw new Error(`Incomplete transaction group: missing coordinator, fetcher, or saver`);
      }
      
      console.log(`📋 Phase 1: Coordinator setup - getting collection info`);
      let coordinatorResult = await this.executeSagaTransaction(coordinator, request);
      if (!coordinatorResult.success) {
        throw new Error(`Coordinator failed: ${coordinatorResult.error}`);
      }
      
      // Update coordinator context
      this.contextManager.updateContext(coordinator.agentName, {
        lastTransactionResult: coordinatorResult.result,
        transactionId: coordinator.id,
        timestamp: new Date()
      });
      
      // Phase 2: Fetcher gets all chunk IDs
      console.log(`📋 Phase 2: Fetcher getting all chunk IDs`);
      let fetcherResult = await this.executeSagaTransaction(fetcher, request);
      if (!fetcherResult.success) {
        throw new Error(`Fetcher failed: ${fetcherResult.error}`);
      }
      
      // Extract chunk IDs from fetcher result
      iterationState.chunkIds = this.extractChunkIds(fetcherResult.result);
      iterationState.metadata.totalChunks = iterationState.chunkIds.length;
      
      console.log(`📋 Found ${iterationState.chunkIds.length} chunks to process`);
      
      // Phase 3: Iterative processing
      console.log(`📋 Phase 3: Starting iterative chunk processing`);
      
      for (let i = 0; i < iterationState.chunkIds.length && i < iterationState.maxIterations!; i++) {
        const chunkId = iterationState.chunkIds[i];
        iterationState.currentIteration = i + 1;
        iterationState.currentChunkIndex = i;
        iterationState.currentChunkId = chunkId;
        iterationState.metadata.lastIterationTime = new Date();
        
        console.log(`🔄 Iteration ${i + 1}/${iterationState.chunkIds.length}: Processing chunk ${chunkId}`);
        
        // Step 3a: Fetcher gets specific chunk data
        const fetcherContext = this.buildIterationContext(fetcher, iterationState, 'fetch_chunk');
        const chunkResult = await this.executeSagaTransactionWithContext(fetcher, request, fetcherContext);
        
        if (!chunkResult.success) {
          console.warn(`⚠️ Chunk ${chunkId} fetch failed: ${chunkResult.error}`);
          continue;
        }
        
        // Step 3b: Coordinator processes the chunk
        const coordinatorContext = this.buildIterationContext(coordinator, iterationState, 'process_chunk', chunkResult.result);
        coordinatorResult = await this.executeSagaTransactionWithContext(coordinator, request, coordinatorContext);
        
        if (!coordinatorResult.success) {
          console.warn(`⚠️ Chunk ${chunkId} processing failed: ${coordinatorResult.error}`);
          continue;
        }
        
        // Step 3c: Saver saves the processed chunk
        const saverContext = this.buildIterationContext(saver, iterationState, 'save_chunk', coordinatorResult.result);
        const saveResult = await this.executeSagaTransactionWithContext(saver, request, saverContext);
        
        if (!saveResult.success) {
          console.warn(`⚠️ Chunk ${chunkId} save failed: ${saveResult.error}`);
          continue;
        }
        
        // Store iteration result
        iterationState.iterationResults.push({
          iteration: i + 1,
          chunkId,
          processed: coordinatorResult.result,
          saved: saveResult.result
        });
        
        iterationState.metadata.processedChunks++;
        
        // Check finalization condition
        if (config.finalizationCondition && config.finalizationCondition(iterationState)) {
          console.log(`✅ Finalization condition met at iteration ${i + 1}`);
          break;
        }
      }
      
      console.log(`✅ Iterative processing completed: ${iterationState.metadata.processedChunks} chunks processed`);
      
      // Return final result
      return {
        agentName: `iterative_group_${config.groupId}`,
        result: {
          groupId: config.groupId,
          totalIterations: iterationState.currentIteration,
          processedChunks: iterationState.metadata.processedChunks,
          totalChunks: iterationState.metadata.totalChunks,
          results: iterationState.iterationResults
        },
        success: true,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Iterative transaction group failed: ${error}`);
      return {
        agentName: `iterative_group_${config.groupId}`,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    } finally {
      // Cleanup iteration state
      this.iterationStates.delete(config.groupId);
    }
  }

  // Circular dependency detection methods
  private hasCircularDependency(
    transaction: SagaTransaction,
    transactions: SagaTransaction[]
  ): boolean {
    // Check if any of this transaction's dependencies also depend on this transaction
    for (const depId of transaction.dependencies) {
      const depTransaction = transactions.find(t => t.id === depId);
      if (depTransaction && depTransaction.dependencies.includes(transaction.id)) {
        return true;
      }
    }
    return false;
  }

  private findCircularPartner(
    transaction: SagaTransaction,
    transactions: SagaTransaction[]
  ): SagaTransaction | null {
    for (const depId of transaction.dependencies) {
      const depTransaction = transactions.find(t => t.id === depId);
      if (depTransaction && depTransaction.dependencies.includes(transaction.id)) {
        return depTransaction;
      }
    }
    return null;
  }

  // Agent-driven circular dependency loop execution
  private async executeCircularDependencyLoop(
    generatorTx: SagaTransaction,
    reflectorTx: SagaTransaction,
    request: BrowserGraphRequest
  ): Promise<AgentResult> {
    
    console.log(`🔄 Starting circular dependency loop: ${generatorTx.id} ↔ ${reflectorTx.id}`);
    
    let iteration = 0;
    const maxIterations = 10; // Safety limit
    let generatorResult: AgentResult;
    let reflectorResult: AgentResult | undefined;
    
    // Phase 1: Generator gets initial context from previous agents
    console.log(`🎯 Phase 1: Generator initial execution (iteration ${iteration})`);
    generatorResult = await this.executeSagaTransaction(generatorTx, request);
    
    // Update generator context
    this.contextManager.updateContext(generatorTx.agentName, {
      lastTransactionResult: generatorResult.result,
      transactionId: generatorTx.id,
      timestamp: new Date(),
      circularIteration: iteration
    });
    
    // Check if generator requests feedback
    if (!this.needsFeedback(generatorResult.result)) {
      console.log(`✅ Generator completed without feedback request`);
      return generatorResult;
    }
    
    // Phase 2: Circular feedback loop
    while (iteration < maxIterations) {
      iteration++;
      console.log(`🔄 Circular iteration ${iteration}/${maxIterations}`);
      
      // Step 1: Reflector provides feedback
      console.log(`🤔 Reflector analyzing generator output`);
      const reflectorContext = await this.buildCircularContext(
        reflectorTx, generatorResult, iteration, 'reflector', request
      );
      
      reflectorResult = await this.executeSagaTransactionWithContext(
        reflectorTx, request, reflectorContext
      );
      
      // Check if reflector wants to terminate
      if (!this.shouldContinueLoop(reflectorResult.result)) {
        console.log(`✅ Reflector signaled termination at iteration ${iteration}`);
        break;
      }
      
      // Step 2: Generator processes feedback
      console.log(`🎯 Generator processing feedback`);
      const generatorContext = await this.buildCircularContext(
        generatorTx, reflectorResult, iteration, 'generator', request
      );
      
      generatorResult = await this.executeSagaTransactionWithContext(
        generatorTx, request, generatorContext
      );
      
      // Update contexts for next iteration
      this.contextManager.updateContext(generatorTx.agentName, {
        lastTransactionResult: generatorResult.result,
        transactionId: generatorTx.id,
        timestamp: new Date(),
        circularIteration: iteration,
        partnerFeedback: reflectorResult.result
      });
      
      this.contextManager.updateContext(reflectorTx.agentName, {
        lastTransactionResult: reflectorResult.result,
        transactionId: reflectorTx.id,
        timestamp: new Date(),
        circularIteration: iteration,
        partnerOutput: generatorResult.result
      });
    }
    
    console.log(`🏁 Circular dependency loop completed after ${iteration} iterations`);
    
    // Return final generator result
    return {
      ...generatorResult,
      result: {
        ...generatorResult.result,
        circularDependencyMetadata: {
          totalIterations: iteration,
          finalIteration: true,
          reflectorFeedback: reflectorResult ? reflectorResult.result : null
        }
      }
    };
  }

  private extractChunkIds(fetcherResult: any): string[] {
    try {
      // Try to extract chunk IDs from different possible formats
      if (Array.isArray(fetcherResult)) {
        // If result is already an array of chunk IDs
        return fetcherResult.filter(id => typeof id === 'string');
      }
      
      if (typeof fetcherResult === 'string') {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(fetcherResult);
          if (Array.isArray(parsed)) {
            return parsed.filter(id => typeof id === 'string');
          }
          if (parsed.chunks && Array.isArray(parsed.chunks)) {
            return parsed.chunks.map((chunk: any) => chunk.id || chunk._id || chunk).filter((id: any) => typeof id === 'string');
          }
        } catch {
          // If not JSON, treat as single chunk ID
          return [fetcherResult];
        }
      }
      
      if (fetcherResult && typeof fetcherResult === 'object') {
        // Look for common chunk ID array properties
        const possibleArrays = ['chunks', 'ids', 'chunkIds', 'documents', 'results'];
        for (const prop of possibleArrays) {
          if (Array.isArray(fetcherResult[prop])) {
            return fetcherResult[prop].map((item: any) => 
              typeof item === 'string' ? item : (item.id || item._id || String(item))
            ).filter((id: any) => id);
          }
        }
      }
      
      console.warn('Could not extract chunk IDs from fetcher result:', fetcherResult);
      return [];
    } catch (error) {
      console.error('Error extracting chunk IDs:', error);
      return [];
    }
  }

  private buildIterationContext(
    transaction: SagaTransaction, 
    iterationState: IterationState, 
    phase: 'fetch_chunk' | 'process_chunk' | 'save_chunk',
    additionalData?: any
  ): Record<string, any> {
    const baseContext: Record<string, any> = {
      iterationPhase: phase,
      currentIteration: iterationState.currentIteration,
      currentChunkId: iterationState.currentChunkId,
      currentChunkIndex: iterationState.currentChunkIndex,
      totalChunks: iterationState.chunkIds.length,
      collectionName: iterationState.metadata.collectionName,
      processedChunks: iterationState.metadata.processedChunks
    };
    
    if (additionalData) {
      baseContext.chunkData = additionalData;
    }
    
    return baseContext;
  }

  private async executeSagaTransactionWithContext(
    transaction: SagaTransaction,
    request: BrowserGraphRequest,
    iterationContext: Record<string, any>
  ): Promise<AgentResult> {
    const agent = this.agents.get(transaction.agentName);
    if (!agent) {
      throw new Error(`Agent ${transaction.agentName} not registered for transaction ${transaction.id}`);
    }
    
    // Build enhanced context that includes iteration data
    const baseContext = await this.buildSagaTransactionContext(transaction, request);
    const enhancedContext = {
      ...baseContext,
      ...iterationContext
    };
    
    // Execute with enhanced context
    return await agent.execute(enhancedContext);
  }

  // Circular dependency context building and JSON parsing methods
  private async buildCircularContext(
    transaction: SagaTransaction,
    partnerResult: AgentResult,
    iteration: number,
    role: 'generator' | 'reflector',
    request: BrowserGraphRequest
  ): Promise<Record<string, any>> {
    
    // Get base context (includes original agentSpecificTask)
    const baseContext = await this.buildSagaTransactionContext(transaction, request);
    
    // Enhance the agentSpecificTask with circular context
    let enhancedTask = baseContext.agentSpecificTask || '';
    
    if (role === 'generator') {
      // Generator receives feedback and enhances its task
      const feedback = this.parseReflectorFeedback(partnerResult.result);
      enhancedTask = this.enhanceGeneratorTask(enhancedTask, feedback, iteration);
    } else {
      // Reflector receives output and enhances its task
      const generatorOutput = this.parseGeneratorOutput(partnerResult.result);
      enhancedTask = this.enhanceReflectorTask(enhancedTask, generatorOutput, iteration);
    }
    
    return {
      ...baseContext,
      agentSpecificTask: enhancedTask, // Enhanced task flows through normal mechanism
      circularDependency: {
        iteration,
        role,
        partner: {
          agentName: partnerResult.agentName,
          result: partnerResult.result,
          timestamp: partnerResult.timestamp
        }
      }
    };
  }

  private enhanceGeneratorTask(
    originalTask: string, 
    feedback: any, 
    iteration: number
  ): string {
    if (!feedback || Object.keys(feedback).length === 0) {
      // Initial run - add reflection request to the task
      return `${originalTask}

CIRCULAR DEPENDENCY PROTOCOL:
After completing your task, include a JSON object in your response with this structure:
{
  "taskResult": { /* your task output */ },
  "reflectionRequest": {
    "needsFeedback": true,
    "feedbackType": "task_review",
    "specificQuestions": [
      "Does the output meet the task requirements?",
      "Are there any quality issues?",
      "Should any aspects be improved?"
    ],
    "taskContext": "${originalTask.replace(/"/g, '\\"')}",
    "iteration": ${iteration}
  }
}`;
    }
    
    // Subsequent runs - incorporate feedback
    return `${originalTask}

FEEDBACK FROM REFLECTOR (Iteration ${iteration}):
Quality Assessment: ${feedback.quality_assessment || 'N/A'}
Suggestions: ${JSON.stringify(feedback.suggestions || [])}
Strengths: ${JSON.stringify(feedback.strengths || [])}
Issues: ${JSON.stringify(feedback.issues || [])}

Please address this feedback and improve your task output. Include the same JSON structure in your response with updated iteration number.`;
  }

  private enhanceReflectorTask(
    originalTask: string, 
    generatorOutput: any, 
    iteration: number
  ): string {
    const taskContext = generatorOutput.reflectionRequest?.taskContext || 'Unknown task';
    
    return `${originalTask}

GENERATOR OUTPUT TO REVIEW (Iteration ${iteration}):
Task Context: ${taskContext}
Output: ${JSON.stringify(generatorOutput.taskResult, null, 2)}

Your specific questions to address:
${generatorOutput.reflectionRequest?.specificQuestions?.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n') || ''}

Please provide feedback on this output. Include a JSON object in your response with this structure:
{
  "feedback": {
    "quality_assessment": "excellent/good/fair/poor",
    "suggestions": ["suggestion1", "suggestion2"],
    "strengths": ["strength1", "strength2"],
    "issues": ["issue1", "issue2"]
  },
  "loopControl": {
    "continue": true/false,
    "reason": "explanation for decision",
    "iteration": ${iteration}
  }
}`;
  }

  // JSON parsing helpers
  private needsFeedback(result: any): boolean {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed.reflectionRequest?.needsFeedback === true;
    } catch {
      return false;
    }
  }

  private shouldContinueLoop(result: any): boolean {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed.loopControl?.continue === true;
    } catch {
      return false;
    }
  }

  private parseReflectorFeedback(result: any): any {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed.feedback || {};
    } catch {
      return {};
    }
  }

  private parseGeneratorOutput(result: any): any {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return parsed.taskResult ? parsed : { taskResult: parsed };
    } catch {
      return {};
    }
  }
}