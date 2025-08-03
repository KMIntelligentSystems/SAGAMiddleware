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
  IterationConfig,
  sagaPrompt,
  transactionGroupPrompt
} from '../types/visualizationSaga.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { ValidationManager } from '../sublayers/validationManager.js';
import { globalDataProcessor } from '../processing/dataResultProcessor.js';
import { TransactionManager } from '../sublayers/transactionManager.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { ContextSetDefinition } from '../services/contextRegistry.js';
import { csvContent } from '../test/testData.js';

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
  private  conversationAgentCompleted = false;
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
    console.log(`🚀 SC: ${workflowId}`);
    
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
    //  const iterationGroups = this.groupTransactionsByIteration(transactionsToExecute);
     // const regularTransactions = transactionsToExecute.filter(t => !t.iterationGroup);

      //**********For use with testdata.js
   /*   this.contextManager.setContext('DataFilteringAgent', { lastTransactionResult: csvContent})
        const filteringAgentContext: WorkingMemory = this.contextManager.getContext('DataFilteringAgent') as WorkingMemory;
        le t filteredData = `              **FIND THE DATASET IN RESULTS**\n` + filteringAgentContext.lastTransactionResult;*/
      
      const processedInCycle = new Set<string>(); // Track transactions already processed in cycles
      const sagaCoordinatorAgent = this.agents.get('sagaCoordinatorAgent');
       sagaCoordinatorAgent?.setContext(sagaPrompt)
      
      for (const transaction of transactionsToExecute) {
        // Skip transactions that were already processed as part of a cycle
        if (processedInCycle.has(transaction.id)) {
          console.log(`⏭️  Skipping ${transaction.name} (${transaction.id}) - already processed in cycle`);
          continue;
        }
        
        console.log(`🔄 Executing Transaction: ${transaction.name} (${transaction.id})`);
        
        let result: AgentResult;
        
        // Check if transaction has dependencies where ALL dependents have no dependencies
        let hasLinearDependency = false;
        let allDependentsHaveEmptyDependencies = false;
        if (transaction.dependencies.length > 0) {
          const dependentTransactions = transactionsToExecute.filter(tx => 
            transaction.dependencies.includes(tx.id)
          );
            allDependentsHaveEmptyDependencies = dependentTransactions.every(depTx => 
            depTx.dependencies.length === 0
          );
          //tx-4 ->tx-2 -> []
          if (allDependentsHaveEmptyDependencies) {
            result = await this.executeSagaTransaction(transaction, request);
          }
          
          if (transaction.dependencies.length > 0 && !allDependentsHaveEmptyDependencies){
            // Check for linear chain: ['tx-2'] -> ['tx-5'] -> ['tx-6'] -> []
            const linearChainInfo = this.analyzeLinearChain(transaction, transactionsToExecute);
            
            if (linearChainInfo.isSelfReferencing) {
              // Special case: 'tx-2' -> 'tx-5' -> 'tx-5' (iterative saving)
              console.log('🔄 Self-referencing linear chain detected:', linearChainInfo.chain.map(t => t.id).join(' -> '));
              result = await this.executeSelfReferencingChain(linearChainInfo.chain, request);
              
              // Mark all chain transactions as processed
              for (const chainTx of linearChainInfo.chain) {
                processedInCycle.add(chainTx.id);
              }
            } else if (linearChainInfo.isLinearChain) {
              // Regular linear chain ending in []: just set flag
              console.log('📏 Linear chain detected:', linearChainInfo.chain.map(t => t.id).join(' -> ') + ' -> []');
              hasLinearDependency = true;
            } else {
              hasLinearDependency = true;
            }
          } 

          if (transaction.dependencies.length > 0 &&  !allDependentsHaveEmptyDependencies && !hasLinearDependency && this.hasExtendedCycleDependency(transaction, transactionsToExecute)) {
            // Handle extended cycle (N-agent cycle)
            const cyclePartners = this.findCyclePartners(transaction, transactionsToExecute);
            console.log('🔗 Extended cycle partners:', cyclePartners.map(t => t.agentName));
            if (cyclePartners.length > 0) {
              result = await this.executeExtendedCycleLoop(cyclePartners, request);
              
              // Mark all cycle transactions as processed to avoid re-execution
              for (const cycleTx of cyclePartners) {
                processedInCycle.add(cycleTx.id);
                this.contextManager.updateContext(cycleTx.agentName, {
                  lastTransactionResult: result.result,
                  transactionId: cycleTx.id,
                  timestamp: new Date(),
                  processedInCycle: true
                });
              }
              this.contextManager.updateContext('TransactionGroupingAgent', {'cycleCompleted': true})
              
              
            } else {
              throw new Error(`Extended cycle detected but no partners found for ${transaction.id}`);
            }
          } else if (this.hasCircularDependency(transaction, transactionsToExecute)) {
            // Handle traditional 2-agent circular dependency
            const circularPartner = this.findCircularPartner(transaction, transactionsToExecute);
            console.log('🔄  Circularpartner:', circularPartner?.agentName);
            if (circularPartner) {
              result = await this.executeCircularDependencyLoop(transaction, circularPartner, request);
            } else {
              throw new Error(`Circular dependency detected but no partner found for ${transaction.id}`);
            }
          } else {
            // Regular transaction execution
            result = await this.executeSagaTransaction(transaction, request);
          }
        } /*else if (this.hasCircularDependency(transaction, transactionsToExecute)) {
          // Handle traditional 2-agent circular dependency
          const circularPartner = this.findCircularPartner(transaction, transactionsToExecute);
          console.log('🔄  Circularpartner:', circularPartner?.agentName);
          if (circularPartner) {
            result = await this.executeCircularDependencyLoop(transaction, circularPartner, request);
          } else {
            throw new Error(`Circular dependency detected but no partner found for ${transaction.id}`);
          }
        }*/ 
       else {
          // Regular transaction execution
          result = await this.executeSagaTransaction(transaction, request);
        } 
        
        if (!result.success) {
          console.log(`❌ Transaction failed: ${transaction.name} - ${result.error}`);
          this.sagaState!.errors.push(`${transaction.name}: ${result.error}`);
          
          // Execute compensations for completed transactions
          await this.executeCompensations();
          
          throw new Error(`Transaction ${transaction.name} failed: ${result.error}`);
        }
        // Each agent gets its own instructions from the bracket parsing - no context passing needed
        counter++;

        // Update context with transaction result
        if(transaction.agentName == 'DataCoordinatingAgent'){
          console.log('SAGA RESULT ', result.result)
            this.contextManager.updateContext('ConversationAgent', {
          lastTransactionResult: result.result,
          transactionId: transaction.id,
          timestamp: new Date()
        });
        }
        else{
            this.contextManager.updateContext(transaction.agentName, {
          lastTransactionResult: result.result,
          transactionId: transaction.id,
          timestamp: new Date()
        });
        }
      

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
        const contextData = typeof relevantPrompt.context === 'string' 
          ? relevantPrompt.context 
          : JSON.stringify(relevantPrompt.context);
        llmPromptText += `Additional Context: ${contextData}\n`;
      }
    }
    
    // 3. Parse user query to extract agent-specific task descriptions
    let agentSpecificTask = '';
    if (transaction.agentName === 'ConversationAgent') {
      // ConversationAgent needs the entire user query for human-in-the-loop conversations
      agentSpecificTask = request.userQuery || '';
    } 
     else if(transaction.agentName === 'TransactionGroupingAgent')//
    {
      if(!this.conversationAgentCompleted){
        agentSpecificTask = transactionGroupPrompt;
        agentSpecificTask += 'User Requirements:' + this.parseConversationResultForAgent(conversationContext.lastTransactionResult, transaction.agentName);
        this.conversationAgentCompleted = true;
      }
      else {
        const filteringAgentResult: WorkingMemory = this.contextManager.getContext('DataFilteringAgent') as WorkingMemory;
         agentSpecificTask = 'Finalization of DataFilteringAgent ' + JSON.stringify(filteringAgentResult.lastTransactionResult);
         agentSpecificTask += 'User Requirements for saving processed data:' + this.parseConversationResultForAgent(conversationContext.lastTransactionResult, transaction.agentName);
         //const foundTransaction = SAGA_TRANSACTIONS.find(transaction => transaction.agentName === 'TransactionGroupingAgent');
       // foundTransaction?.dependencies.push('tx-5');

      }
      
     
    }
    //Was [AGENT dataCoordAgent froom prompt is it is]
    else if(transaction.agentName === 'DataCoordinatingAgent')
    {
       agentSpecificTask = sagaPrompt;
       agentSpecificTask += 'User Requirements:' + this.parseConversationResultForAgent(conversationContext.lastTransactionResult, 'TransactionGroupingAgent');
     
    }
    else {
      // For other agents, first try to get instructions from ConversationAgent's working memory
      if (conversationContext && conversationContext.lastTransactionResult) {
        console.log("HERE IN CONVERSATIONCONTEXT", transaction.agentName)
        agentSpecificTask = this.parseConversationResultForAgent(conversationContext.lastTransactionResult, transaction.agentName);

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
    }
    
    console.log(`📊 Built context for ${transaction.agentName}: agent task ${agentSpecificTask})`);
    
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

  // Extended cycle dependency detection methods (for N-agent cycles)
  private hasExtendedCycleDependency(
    transaction: SagaTransaction,
    transactions: SagaTransaction[]
  ): boolean {
    // Use DFS to detect cycles of any length
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (txId: string): boolean => {
    //txId =  tx-4-2
      if (recursionStack.has(txId)) {
       console.log('Found a back edge - cycle detected')
        return true; // Found a back edge - cycle detected
      }
      if (visited.has(txId)) {
      console.log('Already processed this path')
        return false; // Already processed this path
      }
      
      //txId =  tx-4-2
      visited.add(txId);
      recursionStack.add(txId);
    
      const tx = transactions.find(t => t.id === txId);
     
      if (tx) {
        // Find transactions that depend on this one (forward traversal)
        const dependents = transactions.filter(t => t.dependencies.includes(txId));
        for (const dependent of dependents) {
          if (hasCycle(dependent.id)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(txId);
      return false;
    };
    
    const cycleExists = hasCycle(transaction.id);
    if (cycleExists) {
      console.log(`🔗 Extended cycle detected starting from ${transaction.id}`);
    }
    return cycleExists;
  }

  private findCyclePartners(
    transaction: SagaTransaction,
    transactions: SagaTransaction[]
  ): SagaTransaction[] {
    // Find all transactions that are part of the same cycle
    const cycleTransactions: SagaTransaction[] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [];
    
    const findCycle = (txId: string): boolean => {
      const pathIndex = currentPath.indexOf(txId);
      if (pathIndex !== -1) {
        // Found cycle - extract all transactions in the cycle
        const cycleIds = currentPath.slice(pathIndex);
        
        for (const cycleTxId of cycleIds) {
          const cycleTx = transactions.find(t => t.id === cycleTxId);
          if (cycleTx && !cycleTransactions.includes(cycleTx)) {
            cycleTransactions.push(cycleTx);
          }
        }
        return true;
      }
      
      if (visited.has(txId)) {
        return false;
      }
      
      visited.add(txId);
      currentPath.push(txId);
      
      const tx = transactions.find(t => t.id === txId);
      if (tx) {
        for (const depId of tx.dependencies) {
          if (transactions.some(t => t.id === depId)) {
            if (findCycle(depId)) {
              return true;
            }
          }
        }
      }
      
      currentPath.pop();
      return false;
    };
    
    findCycle(transaction.id);
    
    // Sort by transaction ID to ensure consistent order
    cycleTransactions.sort((a, b) => a.id.localeCompare(b.id));
    
    console.log(`🔗 Cycle partners for ${transaction.id}:`, cycleTransactions.map(t => `${t.id}(${t.agentName})`));
    return cycleTransactions;
  }

  /**
   * Analyzes dependency chain starting from a transaction
   * Returns info about linear chains and self-referencing chains
   */
  private analyzeLinearChain(
    transaction: SagaTransaction,
    transactions: SagaTransaction[]
  ): { chain: SagaTransaction[], isLinearChain: boolean, isSelfReferencing: boolean } {
    const chain: SagaTransaction[] = [];
    const visited = new Set<string>();
    let isSelfReferencing = false;
    
    const buildChain = (currentTx: SagaTransaction): void => {
      if (visited.has(currentTx.id)) {
        // Check if this is a self-reference (tx depends on itself)
        if (currentTx.id === transaction.id && chain.length > 1) {
          isSelfReferencing = true;
        }
        return;
      }
      
      visited.add(currentTx.id);
      chain.push(currentTx);
      
      // If this transaction has dependencies, follow the chain
      if (currentTx.dependencies.length > 0) {
        // For linear chain, we expect only one dependency path
        if (currentTx.dependencies.length === 1) {
          const dependencyId = currentTx.dependencies[0];
          const dependencyTx = transactions.find(t => t.id === dependencyId);
          
          if (dependencyTx) {
            // Check for self-reference: 'tx-5' -> 'tx-5'
            if (dependencyTx.id === currentTx.id) {
              isSelfReferencing = true;
              return;
            }
            
            // Continue building chain
            if (dependencyTx.dependencies.length <= 1) {
              buildChain(dependencyTx);
            }
          }
        }
      }
    };
    
    buildChain(transaction);
    
    let isLinearChain = false;
    
    // Check for regular linear chain ending with empty dependencies
    if (chain.length > 1 && !isSelfReferencing) {
      const lastTransaction = chain[chain.length - 1];
      if (lastTransaction.dependencies.length === 0) {
        isLinearChain = true;
      }
    }
    
    return {
      chain,
      isLinearChain,
      isSelfReferencing
    };
  }

  /**
   * Executes self-referencing chains for iterative processing
   * Example: 'tx-2' -> 'tx-5' -> 'tx-5' (iterative saving)
   */
  private async executeSelfReferencingChain(
    chainTransactions: SagaTransaction[],
    request: BrowserGraphRequest
  ): Promise<AgentResult> {
    console.log(`🔄 Starting self-referencing chain with ${chainTransactions.length} agents`);
    
    // Find the self-referencing transaction (the one that iterates)
    const iteratingTransaction = chainTransactions.find(tx => 
      tx.dependencies.length === 1 && tx.dependencies[0] === tx.id
    );
    
    if (!iteratingTransaction) {
      console.error('❌ No self-referencing transaction found in chain');
      return {
        agentName: 'self_referencing_chain',
        result: null,
        success: false,
        error: 'No self-referencing transaction found',
        timestamp: new Date()
      };
    }
    
    // Execute the chain up to the self-referencing transaction first
    const preIterationTransactions = chainTransactions.filter(tx => tx.id !== iteratingTransaction.id);
    
    console.log(`📋 Pre-iteration transactions: ${preIterationTransactions.map(t => `${t.id}(${t.agentName})`).join(' → ')}`);
    console.log(`🔄 Iterating transaction: ${iteratingTransaction.id}(${iteratingTransaction.agentName})`);
    
    let finalResult: AgentResult = {
      agentName: 'chain_start',
      result: null,
      success: true,
      timestamp: new Date()
    };
    
    // Execute pre-iteration transactions in reverse order (dependencies first)
    const executionOrder = [...preIterationTransactions].reverse();
    for (const transaction of executionOrder) {
      console.log(`🎯 Executing pre-iteration: ${transaction.agentName}`);
      
      const result = await this.executeSagaTransaction(transaction, request);
      if (!result.success) {
        console.error(`❌ Pre-iteration transaction failed: ${transaction.agentName}`);
        return result;
      }
      
      this.contextManager.updateContext(transaction.agentName, {
        lastTransactionResult: result.result,
        transactionId: transaction.id,
        timestamp: new Date()
      });
      
      finalResult = result;
    }
    
    // Now execute the self-referencing transaction iteratively
    let iteration = 0;
    let hasMoreData = true;
    let allProcessedData: any[] = [];
    
    while (hasMoreData && iteration < 10) { // Safety limit
      console.log(`🔄 Iteration ${iteration + 1} for ${iteratingTransaction.agentName}`);
      
      // Set iteration context
      this.contextManager.updateContext(iteratingTransaction.agentName, {
        lastTransactionResult: finalResult.result,
        transactionId: iteratingTransaction.id,
        timestamp: new Date(),
        iteration: iteration,
        isSelfReferencing: true
      });
      
      const result = await this.executeSagaTransaction(iteratingTransaction, request);
      if (!result.success) {
        console.error(`❌ Self-referencing iteration ${iteration + 1} failed: ${iteratingTransaction.agentName}`);
        break;
      }
      
      // Check if there's more data to process (implementation specific)
      // This would need to be customized based on the specific use case
      hasMoreData = this.shouldContinueIteration(result, iteration);
      
      if (result.result && result.result.data) {
        allProcessedData = allProcessedData.concat(result.result.data);
      }
      
      finalResult = result;
      iteration++;
    }
    
    console.log(`✅ Self-referencing chain completed after ${iteration} iterations`);
    
    return {
      ...finalResult,
      result: {
        ...finalResult.result,
        data: allProcessedData,
        selfReferencingMetadata: {
          totalIterations: iteration,
          iteratingAgent: iteratingTransaction.agentName,
          preIterationAgents: preIterationTransactions.map(t => t.agentName),
          totalRecordsProcessed: allProcessedData.length
        }
      }
    };
  }

  /**
   * Determines if self-referencing iteration should continue
   */
  private shouldContinueIteration(result: AgentResult, iteration: number): boolean {
    // Implementation specific logic to determine if more iterations are needed
    // For saving operations, this might check if there's more data to save
    // For now, implement basic logic based on result content
    
    if (!result.result) return false;
    
    // Check if result indicates more data available
    if (typeof result.result === 'object' && result.result.hasMore !== undefined) {
      return result.result.hasMore;
    }
    
    // Check if result is empty or indicates completion
    if (typeof result.result === 'string') {
      const lowerResult = result.result.toLowerCase();
      if (lowerResult.includes('completed') || lowerResult.includes('finished') || lowerResult.includes('no more')) {
        return false;
      }
    }
    
    // Default: continue for a few iterations if no clear signal
    return iteration < 3;
  }

  // Agent-driven circular dependency loop execution
  private async executeCircularDependencyLoop(
    generatorTx: SagaTransaction,
    reflectorTx: SagaTransaction,
    request: BrowserGraphRequest
  ): Promise<AgentResult> {
    
    console.log(`🔄 Starting circular dependency loop: ${generatorTx.id} ↔ ${reflectorTx.id}`);
    
    let iteration = 0;
    const maxIterations = 2; // Safety limit
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
   /* if (!this.needsFeedback(generatorResult.result)) {
      console.log(`✅ Generator completed without feedback request`);
      return generatorResult;
    }*/
    /*
    1. reflectorContext =
   return {
      ...baseContext,
      agentSpecificTask: enhancedTask, // Enhanced task flows through normal mechanism just the prompt
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
    */
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
      /*reflector result
    agentName: 'DataReflectingAgent',
      result: '1. What specific steps were taken to generate the numerical data arrays for each installation on the given dates?\n' +
        '2. Can you provide details about the algorithm used to extract and process the data from the dataset?\n' +
      */
      // Check if reflector wants to terminate
    /*  if (!this.shouldContinueLoop(reflectorResult.result)) {
        console.log(`✅ Reflector signaled termination at iteration ${iteration}`);
        break;
      }*/
      
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
    /*
  agentName: 'DataStructuringAgent',
  result: '```json\n' +
    '{\n' +
    '  "2023-11-04": {\n' +
    '    "ERGTO1": [0, 0, 0],\n' +
    '    "RPCG": [14.6, 14.6, 14.6]\n' +
    '  }\n' +
    '}\n' +
    '```',
  success: true,
  timestamp: 2025-07-21T22:41:45.811Z,
  circularDependencyMetadata: {
    totalIterations: 2,
    finalIteration: true,
    reflectorFeedback: {
      agentName: 'DataReflectingAgent',
      result: '1. What specific steps were taken to generate the numerical data arrays for each installation on the given dates?\n' +
        '2. Can you provide details about the algorithm used to extract and process the data from the dataset?\n' +
        '3. Are there any assumptions made during the data extraction process that could affect the results?\n' +
        '4. How do you ensure the accuracy and consistency of the numerical values provided for each installation?\n' +
        '5. Is there a method in place to validate the results against alternative algorithms or datasets?\n' +
        '6. What criteria were used to determine the validity of the data extracted for each installation?\n' +
        '7. How do you handle any discrepancies or outliers in the numerical data?\n' +
        '8. Can you explain the rationale behind the chosen numerical patterns observed in the output?\n' +
        '9. Are there any limitations of the current approach that could impact the reliability of the results?\n' +
        '10. How frequently is the data updated, and what processes are in place to maintain its integrity over time?',
      success: true,
    */
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

  // Mock data chunking harness for DataFilteringAgent
  private parseDataChunks(csvContent: string): Array<{id: string, content: string, metadata: any}> {
    try {
      // Extract the JSON structure from csvContent
      const jsonStart = csvContent.indexOf('{');
      const jsonEnd = csvContent.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.warn('No valid JSON found in csvContent, returning empty chunks');
        return [];
      }
      
      const jsonString = csvContent.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonString);
      
      if (parsed.results && Array.isArray(parsed.results)) {
        console.log(`📦 Parsed ${parsed.results.length} data chunks from csvContent`);
        return parsed.results.map((chunk: any) => ({
          id: chunk.id || `chunk-${Date.now()}-${Math.random()}`,
          content: chunk.content || '',
          metadata: chunk.metadata || {}
        }));
      }
      
      console.warn('No results array found in parsed JSON');
      return [];
      
    } catch (error) {
      console.error('Error parsing csvContent for chunks:', error);
      return [];
    }
  }

  private initializeChunkProcessor(csvContent: string): {
    chunks: Array<{id: string, content: string, metadata: any}>,
    currentChunkIndex: number,
    hasMoreChunks: () => boolean,
    getNextChunk: () => any,
    getCurrentChunk: () => any
  } {
    const chunks = this.parseDataChunks(csvContent);
    let currentChunkIndex = 0;
    
    return {
      chunks,
      currentChunkIndex: 0,
      hasMoreChunks: () => currentChunkIndex < chunks.length,
      getNextChunk: () => {
        if (currentChunkIndex < chunks.length) {
          const chunk = chunks[currentChunkIndex];
          currentChunkIndex++;
          console.log(`📦 Providing chunk ${currentChunkIndex}/${chunks.length}: ${chunk.id}`);
          return chunk;
        }
        return null;
      },
      getCurrentChunk: () => {
        if (currentChunkIndex > 0 && currentChunkIndex <= chunks.length) {
          return chunks[currentChunkIndex - 1];
        }
        return null;
      }
    };
  }

  // Extended cycle execution (for N-agent cycles)  
  private async executeExtendedCycleLoop(
    cycleTransactions: SagaTransaction[],
    request: BrowserGraphRequest
  ): Promise<AgentResult> {
    
 //   console.log(`🔄 Starting extended cycle loop with ${cycleTransactions.length} agents`);
 
   // const orderedCycle = this.sortCycleTransactionsByDependencyOrder(cycleTransactions);
    
  //  console.log(`📋 Cycle execution order: ${orderedCycle.map(t => `${t.id}(${t.agentName})`).join(' → ')}`);
    
    let finalResult: AgentResult = {
      agentName: 'cycle_start',
      result: null,
      success: true,
      timestamp: new Date()
    };
    
    // Initialize pagination state
    let page = 1;
    let hasMoreChunks = true;
    let iteration = 0;
    let allProcessedData: any[] = [];
    let cycleCounter =  cycleTransactions.length;
    
    // Continue processing until all chunks are retrieved
    while (hasMoreChunks) {
      console.log(`🔄 Starting cycle iteration ${iteration + 1}, page: ${page}`);
      
      // Execute each agent in the cycle sequence for this chunk
      for (let i = 0; i < cycleCounter; i++) {
        const transaction = cycleTransactions[i];
    //    console.log(`🎯 Executing ${transaction.agentName} (${i + 1}/${orderedCycle.length}) for iteration ${iteration + 1}`);
        
        // Special handling for DataFilteringAgent - provide pagination context
        if (transaction.agentName === 'DataFilteringAgent' && i === 0) {
          // Get the existing prompt from context (comes from user via conversation agent)
          const existingContext = this.contextManager.getContext('DataFilteringAgent');
          let basePrompt = existingContext?.lastTransactionResult || '';
          
          // Ensure basePrompt is a string
          if (typeof basePrompt !== 'string') {
            console.log('BasePrompt type:', typeof basePrompt, 'Value:', basePrompt);
            basePrompt = String(basePrompt);
          }
          
          // Determine the offset value to use
          const currentOffset = iteration === 0 ? 1 : page;
          
          // Replace the {page} placeholder with the actual page number
          const updatedPrompt = basePrompt.replace(/{page}/g, page.toString());
          
          // Set DataFilteringAgent context with pagination state and updated prompt
          this.contextManager.setContext('DataFilteringAgent', {
            lastTransactionResult: updatedPrompt,
            transactionId: transaction.id,
            timestamp: new Date(),
            page: page,
            iteration: iteration,
            collection: 'supply_analysis'
          });
        }
        
        // Build context with cycle metadata and pagination information
        const cycleContext = await this.buildCycleTransactionContext(
          transaction, 
          request, 
          finalResult,
          {
            iteration: iteration,
            cyclePosition: i,
            totalInCycle: cycleTransactions.length,
            isFirstInCycle: i === 0,
            isLastInCycle: i === cycleTransactions.length - 1,
            cycleTransactions: cycleTransactions,
            page: page,
            hasMoreChunks: hasMoreChunks
          }
        );
        
        // Execute the transaction with cycle context
        finalResult = await this.executeSagaTransactionWithContext(transaction, request, cycleContext);
        console.log('RAW FINAL RESULT:', finalResult);
  console.log('RAW FINAL RESULT TYPE:', typeof finalResult.result);
  console.log('RAW FINAL RESULT LENGTH:', finalResult.result?.length);
        
        if (!finalResult.success) {
          console.error(`❌ Cycle transaction failed: ${transaction.agentName} - ${finalResult.error}`);
          return finalResult;
        }
        
        // Extract pagination info from DataFilteringAgent result
        if (transaction.agentName === 'DataFilteringAgent' && finalResult.result) {
          // Handle nested AgentResult structure
          let result = finalResult.result;
          
          // If result is a nested AgentResult object, extract the actual result string
          if (typeof result === 'object' && result !== null && 'result' in result) {
            result = result.result;
          }
          console.log('RESULT  FILTERINGDATA', result);
          console.log('RESULT TYPE:', typeof result);
          
          try {
            let resultString = '';
            
            // Extract the actual result content, not the entire object
            if (typeof result === 'string') {
              resultString = result;
            } else if (typeof result === 'object' && result !== null) {
              // If result is an object, it might be the AgentResult object
              // We need to extract the actual result content
              if ('result' in result && typeof result.result === 'string') {
                resultString = result.result;
              } else {
                resultString = JSON.stringify(result);
              }
            } else {
              resultString = String(result);
            }

            
            // Remove markdown formatting if present
            let cleanJson = resultString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Try to extract just the JSON content if it's mixed with other text
            // Look for the first { and last } to extract complete JSON
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }
            
            console.log('CLEAN JSON LENGTH:', cleanJson.length);
            console.log('CLEAN JSON PREVIEW:', cleanJson);
          
            
            // Try to parse as JSON first
            try {
              const parsedResult = JSON.parse(cleanJson);
              console.log('PARSED RESULT KEYS:', Object.keys(parsedResult));
              //PARSED RESULT KEYS: [ 'results', 'page', 'total_pages', 'total_count' ]
              
              // Look for pagination info in the parsed result
              if (parsedResult.results && Array.isArray(parsedResult.results) && parsedResult.results.length > 0) {
                console.log('ENTERED RESULTS ARRAY')
                
                // Extract pagination info directly from the root level
                const currentPage = parseInt(parsedResult.page) || 1;
                const totalPages = parseInt(parsedResult.total_pages) || 1;
                
                page = currentPage + 1;
                hasMoreChunks = false;//currentPage < totalPages;
                
                console.log(`📊 DataFilteringAgent pagination: page=${currentPage}, total_pages=${totalPages}, resultsReturned=${parsedResult.results.length}, hasMoreChunks=${hasMoreChunks}`);
              } else {
                hasMoreChunks = false;
                console.log(`📊 DataFilteringAgent: No results found, ending pagination`);
              }
            } catch (jsonError) {
              console.log('JSON parse failed, trying regex:', jsonError instanceof Error ? jsonError.message : String(jsonError));
              
              // Fallback to regex pattern matching - find the highest endRow from all chunks
              const metadataMatches = [...resultString.matchAll(/"metadata":\s*\{[^}]*"startRow":\s*(\d+)[^}]*"endRow":\s*(\d+)[^}]*"rowsInChunk":\s*(\d+)[^}]*\}/g)];
              
              if (metadataMatches.length > 0) {
                // Find the chunk with the highest endRow to determine pagination
                let maxEndRow = 0;
                let hasValidChunks = false;
                
                for (const match of metadataMatches) {
                  const startRow = parseInt(match[1]);
                  const endRow = parseInt(match[2]);
                  const rowsInChunk = parseInt(match[3]);
                  
                  console.log(`Found chunk: startRow=${startRow}, endRow=${endRow}, rowsInChunk=${rowsInChunk}`);
                  
                  if (endRow > maxEndRow) {
                    maxEndRow = endRow;
                  }
                  if (rowsInChunk > 0) {
                    hasValidChunks = true;
                  }
                }
                
                page = maxEndRow;
                hasMoreChunks = hasValidChunks;
                console.log(`📊 DataFilteringAgent pagination (regex): maxEndRow=${maxEndRow}, hasValidChunks=${hasValidChunks}, hasMoreChunks=${hasMoreChunks}`);
              } else {
                hasMoreChunks = false;
                console.log(`📊 DataFilteringAgent: Could not extract metadata, ending pagination`);
              }
            }
          } catch (error) {
            console.error(`Error parsing DataFilteringAgent result:`, error);
            hasMoreChunks = false;
          }
        }
        
        // Update current agent context with its result
        this.contextManager.updateContext(transaction.agentName, {
          lastTransactionResult: finalResult.result,
          transactionId: transaction.id,
          timestamp: new Date(),
          cycleIteration: iteration,
          cyclePosition: i
        });

        // Process and store result only for the last agent in the cycle
        if (i === cycleTransactions.length - 1) {
          console.log('RAW FINAL RESULT:', finalResult);
          const processedData = globalDataProcessor.parseResult(finalResult, transaction.agentName);
          
          const cycleKey = `cycle_${iteration}_final`;
          globalDataProcessor.storeResult(cycleKey, processedData);
          console.log(`💾 Stored final cycle result: ${cycleKey}`);
        }
        
        // Update next agent's context with current agent's output (for chain processing)
        const nextAgentIndex = (i + 1) % cycleTransactions.length;
        const nextAgent = cycleTransactions[nextAgentIndex];
        console.log('NEXT AGENT', nextAgent)
        if (nextAgent && i < cycleTransactions.length - 1) {
          if(nextAgent.agentName != 'DataFilteringAgent'){
            {
              // Normal context passing for other agents
              this.contextManager.updateContext(nextAgent.agentName, {
                lastTransactionResult: finalResult.result,
                transactionId: `from_${transaction.id}`,
                timestamp: new Date(),
                receivedFrom: transaction.agentName,
                cycleIteration: iteration
              });
              console.log(`🔗 Passed ${transaction.agentName} output to ${nextAgent.agentName} context`);
            }
        }
          console.log(`✅ ${transaction.agentName} completed processing iteration ${iteration }`);
        }
     /*   if (nextAgent && i < cycleTransactions.length - 1) { // Don't update for the last agent in cycle
          // Special handling for DataFilteringAgent - preserve original conversation prompt
          if (nextAgent.agentName === 'DataFilteringAgent' && iteration > 0) {
            // For DataFilteringAgent on subsequent cycles, don't overwrite the conversation context
            // Just update pagination metadata without changing lastTransactionResult
            const existingContext = this.contextManager.getContext(nextAgent.agentName);
            console.log('EXISTING FILTER CONTEXT', existingContext)
            this.contextManager.updateContext(nextAgent.agentName, {
              ...existingContext,
              transactionId: `from_${transaction.id}`,
              timestamp: new Date(),
              receivedFrom: transaction.agentName,
              cycleIteration: iteration,
              // Keep original lastTransactionResult for conversation prompt parsing
              lastTransactionResult: existingContext?.lastTransactionResult || ''
            });
            console.log(`🔗 Preserved original prompt for ${nextAgent.agentName} on cycle ${iteration}`);
          } else {
            // Normal context passing for other agents
            this.contextManager.updateContext(nextAgent.agentName, {
              lastTransactionResult: finalResult.result,
              transactionId: `from_${transaction.id}`,
              timestamp: new Date(),
              receivedFrom: transaction.agentName,
              cycleIteration: iteration
            });
            console.log(`🔗 Passed ${transaction.agentName} output to ${nextAgent.agentName} context`);
          }
        }*/
        
      //  console.log(`✅ ${transaction.agentName} completed processing iteration ${iteration + 1}`);
      }
      
      // Collect processed data from the final agent (DataAggregatingAgent)
      if (finalResult.result && finalResult.result.data) {
        allProcessedData = allProcessedData.concat(finalResult.result.data);
        console.log(`📦 Collected ${finalResult.result.data.length} records, total: ${allProcessedData.length}`);
      }
      
      iteration++;
      
      if (hasMoreChunks) {
        console.log(`📦 More chunks available, continuing to iteration ${iteration + 1}`);
      } else {
        console.log(`✅ All chunks processed, cycle complete after ${iteration} iterations`);
      }
    }
    
    // Return final result with all processed data and cycle metadata
    return {
      ...finalResult,
      result: {
        ...finalResult.result,
        data: allProcessedData,
        extendedCycleMetadata: {
          totalIterations: iteration,
          finalIteration: true,
          cycleAgents: cycleTransactions.map(t => t.agentName),
          cycleLength: cycleTransactions.length,
          totalRecordsProcessed: allProcessedData.length,
          page: page
        }
      }
    };
  }

  private createDataFilteringPrompt(offset: number = 0) {  // Default to 0
      return `[AGENT: DataExtractingAgent]
    Task: Extract energy generation records using offset ${offset}.

    Execute the structured_query tool with this exact JSON:
    {
      "collection": "supply_analysis",
      "metadata_filters": { 
        "category_type": "Coal"
      },
      "date_filters": { 
        "field": "datetime", 
        "start_date": "2023-11-02T04:00:00.000Z",
        "end_date": "2023-11-05T23:55:00.000Z"
      },
      "limit": 100,
      "offset": ${offset},
      "order_by": "id",
      "order_direction": "asc",
      "include_distances": false
    }

    [rest of prompt...]

    [/AGENT]`;
}

  // Helper method to sort cycle transactions by dependency order
  private sortCycleTransactionsByDependencyOrder(transactions: SagaTransaction[]): SagaTransaction[] {
    // For cycle transactions, we need to find the proper execution order
    // Start from a transaction that has dependencies within the cycle
    const sorted: SagaTransaction[] = [];
    const remaining = [...transactions];
    
    // Find a good starting point (transaction with fewest internal dependencies)
    let startTx = remaining[0];
    for (const tx of remaining) {
      const internalDeps = tx.dependencies.filter(depId => 
        transactions.some(t => t.id === depId)
      ).length;
      const currentInternalDeps = startTx.dependencies.filter(depId => 
        transactions.some(t => t.id === depId)
      ).length;
      if (internalDeps < currentInternalDeps) {
        startTx = tx;
      }
    }
    
    // Build the chain starting from startTx
    let current = startTx;
    while (sorted.length < transactions.length) {
      if (!sorted.includes(current)) {
        sorted.push(current);
      }
      
      // Find the next transaction that this one depends on (within the cycle)
      const nextDep = current.dependencies.find(depId => 
        transactions.some(t => t.id === depId && !sorted.includes(t))
      );
      
      if (nextDep) {
        const nextTx = transactions.find(t => t.id === nextDep);
        if (nextTx) {
          current = nextTx;
        } else {
          break;
        }
      } else {
        // If no next dependency, pick any remaining transaction
        const remainingTx = transactions.find(t => !sorted.includes(t));
        if (remainingTx) {
          current = remainingTx;
        } else {
          break;
        }
      }
    }
    
    return sorted;
  }

  // Helper method to build context for cycle transactions
  private async buildCycleTransactionContext(
    transaction: SagaTransaction,
    request: BrowserGraphRequest,
    previousResult: AgentResult,
    cycleMetadata: {
      iteration: number;
      cyclePosition: number;
      totalInCycle: number;
      isFirstInCycle: boolean;
      isLastInCycle: boolean;
      cycleTransactions: SagaTransaction[];
      currentChunk?: any;
      page?: number;
      hasMoreChunks?: boolean;
    }
  ): Promise<Record<string, any>> {
    
    // Get base context
    const baseContext = await this.buildSagaTransactionContext(transaction, request);
    
    // Add cycle-specific enhancements
    let enhancedTask = baseContext.agentSpecificTask || '';
    
    // Add cycle context information
    enhancedTask += `\n\nEXTENDED CYCLE PROCESSING CONTEXT:\n`;
    enhancedTask += `- You are agent ${cycleMetadata.cyclePosition + 1} of ${cycleMetadata.totalInCycle} in a processing cycle\n`;
    enhancedTask += `- Current cycle iteration: ${cycleMetadata.iteration}\n`;
    enhancedTask += `- Agent: ${transaction.agentName} (${transaction.id})\n`;
    
    // Add chunk information if available
    if (cycleMetadata.currentChunk) {
      enhancedTask += `- Processing chunk: ${cycleMetadata.currentChunk.id}\n`;
      enhancedTask += `- Chunk metadata: ${JSON.stringify(cycleMetadata.currentChunk.metadata)}\n`;
    }
    
    // Check if this agent has received data from previous agent in the chain
    const agentContext = this.contextManager.getContext(transaction.agentName);
    const hasReceivedData = agentContext?.receivedFrom && agentContext?.receivedFrom !== transaction.agentName;
    
    // Add pagination information for DataFilteringAgent
    if (transaction.agentName === 'DataFilteringAgent' && cycleMetadata.page !== undefined) {
      enhancedTask += `- Pagination: Continue from page ${cycleMetadata.page}\n`;
      enhancedTask += `- Use structured_query with page: ${cycleMetadata.page}\n`;
    }
    
    if (cycleMetadata.isFirstInCycle) {
      enhancedTask += `- You are the FIRST agent in this cycle iteration\n`;
      if (transaction.agentName === 'DataFilteringAgent') {
        if (cycleMetadata.iteration === 0) {
          enhancedTask += `- This is the initial data retrieval, start from beginning\n`;
        } else {
          enhancedTask += `- Continue pagination from where previous iteration left off\n`;
        }
      } else {
        enhancedTask += `- Initialize or continue processing for this cycle\n`;
      }
    } else if (cycleMetadata.isLastInCycle) {
      enhancedTask += `- You are the LAST agent in this cycle iteration\n`;
      enhancedTask += `- Finalize processing for this chunk\n`;
      if (hasReceivedData) {
        enhancedTask += `- Input received from ${agentContext.receivedFrom}: ${JSON.stringify(agentContext.lastTransactionResult)}\n`;
      } else {
        enhancedTask += `- Input from previous agent: ${JSON.stringify(previousResult.result)}\n`;
      }
    } else {
      enhancedTask += `- You are a MIDDLE agent in this cycle iteration\n`;
      enhancedTask += `- Process input from previous agent and prepare for next agent\n`;
      if (hasReceivedData) {
        enhancedTask += `- Input received from ${agentContext.receivedFrom}: ${JSON.stringify(agentContext.lastTransactionResult)}\n`;
      } else {
        enhancedTask += `- Input from previous agent: ${JSON.stringify(previousResult.result)}\n`;
      }
    }
    
    return {
      ...baseContext,
      agentSpecificTask: enhancedTask,
      extendedCycleDependency: {
        ...cycleMetadata,
        previousResult: previousResult.result,
        currentChunk: cycleMetadata.currentChunk
      },
      // Add pagination context for DataFilteringAgent
      ...(transaction.agentName === 'DataFilteringAgent' && {
        collection: 'supply_analysis',
        page: cycleMetadata.page || 1,
        maxChunks: 50,
        paginationEnabled: true
      })
    };
  }

  // Helper method to determine if cycle processing should continue
  private shouldContinueCycleProcessing(finalizingAgentResult: any): boolean {
    try {
      const resultText = typeof finalizingAgentResult === 'string' 
        ? finalizingAgentResult 
        : JSON.stringify(finalizingAgentResult);
        
      // Look for continuation indicators
      const continueKeywords = ['continue', 'more chunks', 'more data', 'not complete', 'additional processing', 'next chunk'];
      const stopKeywords = ['complete', 'finished', 'done', 'no more', 'final', 'end'];
      
      const lowerResult = resultText.toLowerCase();
      
      const hasContinueKeyword = continueKeywords.some(keyword => lowerResult.includes(keyword));
      const hasStopKeyword = stopKeywords.some(keyword => lowerResult.includes(keyword));
      
      // If explicit stop signal, don't continue
      if (hasStopKeyword && !hasContinueKeyword) {
        console.log(`🛑 Cycle stopping due to completion signal: ${hasStopKeyword}`);
        return false;
      }
      
      // If explicit continue signal, continue
      if (hasContinueKeyword && !hasStopKeyword) {
        console.log(`🔄 Cycle continuing due to continuation signal: ${hasContinueKeyword}`);
        return true;
      }
      
      // Default to stopping if unclear (safety)
      console.log(`🤔 Cycle continuation unclear, defaulting to stop`);
      return false;
      
    } catch (error) {
      console.warn('Error determining cycle continuation:', error);
      return false;
    }
  }
/*
from genericAgent  async execute(contextData: Record<string, any>
  return {
        agentName: this.definition.name,
        **result,
        success: true,
        timestamp: startTime
      };'

      executeSagaTransaction( 
      const context = await this.buildSagaTransactionContext(transaction, request);
      gets agent promt from conversation agent also adds filtering agent data to data structuring agent
      This is returned as agent specific task
      This is the context that is used in execute(contextDat
    
      returns result

      executeCircularDependencyLoo: Phase 1: Generator initial execution (iteration ${iteration})`);
    generatorResult = await this.executeSagaTransaction(generatorTx, request);
    

agentName: 'DataReflectingAgent',

 ...generatorResult.result,
  **result: '1. What specific input or data are we reflecting on for this task?\n' +
    '2. Are there any particular areas or aspects of the input that require more focus or questioning?\n' +
    '3. What is the ultimate goal or objective of reflecting on this input?\n' +
    '4. Are there any constraints or guidelines we need to consider while posing questions?\n' +
    '5. How will the questions we pose contribute to the overall task completion?\n' +
    '6. Is there any additional context or information from other agents that could inform our questioning process?',
  success: true,
  timestamp: 2025-07-21T11:11:06.733Z,


  circularDependencyMetadata: {
    totalIterations: 1,
    finalIteration: true,
    reflectorFeedback: { ====================reflectorResult.result
      agentName: 'DataStructuringAgent',
      result: '```json\n' +
        '[\n' +
        '    {\n' +
        '        "date": "2023-11-03",\n' +
        '        "installation": "ERGTO1",\n' +
        '        "values": [0, 0, 0]\n' +
        '    },\n' +
        '    {\n' +
        '        "date": "2023-11-03",\n' +
        '        "installation": "RPCG",\n' +
        '        "values": [13.3, 13.5, 13.5]\n' +
        '    },\n' +
        '    {\n' +
        '        "date": "2023-11-04",\n' +
        '        "installation": "ERGTO1",\n' +
        '        "values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]\n' +
        '    },\n' +
        '    {\n' +
        '        "date": "2023-11-04",\n' +
        '        "installation": "RPCG",\n' +
        '        "values": [12, 14.6, 14.6, 14.6, 14.6, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 
13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, 13.3, -2.2, -2.2, -2.2, -2.2]\n' +
        '    }\n' +
        ']\n' +
        '```\n' +
        '\n' +
        '**Iteration 2 Feedback Response:**\n' +
        '\n' +
        '1. The installation names "ERGTO1" and "RPCG" likely refer to specific power generation facilities or equipment locations. Further context would be needed to confirm their exact significance.\n' +       
        '2. The zero values recorded for "ERGTO1" could indicate that the installation was not operational or generating energy during those periods. Additional operational data might clarify this.\n' +
        '3. The consistent values for "RPCG" on November 4th suggest stable energy generation, while the sudden drop to -2.2 could be due to a measurement error, equipment malfunction, or intentional shutdown. Fu
rther investigation into operational logs or maintenance records might provide insights.\n' +
        '4. The dataset does not include explicit metadata explaining the purpose of these recordings. Typically, such data could be used for monitoring energy production, efficiency analysis, or regulatory compl
iance.\n' +
        '5. The data points appear to be collected at regular intervals, likely every 5 minutes, based on the timestamps. This structured data could be used for detailed analysis of energy production patterns and
 operational efficiency.',
*/
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
  /*
 reflector result
    agentName: 'DataReflectingAgent',
      result: '1. What specific steps were taken to generate the numerical data arrays for each installation on the given dates?\n' +
        '2. Can you provide details about the algorithm used to extract and process the data from the dataset?\n' +
      
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

  */

  private async executeSagaTransactionWithContext(
    transaction: SagaTransaction,
    request: BrowserGraphRequest,
    iterationContext: Record<string, any>
  ): Promise<AgentResult> {
    const agent = this.agents.get(transaction.agentName);
    if (!agent) {
      throw new Error(`Agent ${transaction.agentName} not registered for transaction ${transaction.id}`);
    }
   // console.log('ITERATION CONTEXT  ', JSON.stringify(iterationContext))
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
    
   /* if (transaction.agentName === 'DataStructuringAgent') {
      // Generator receives feedback and enhances its task
    //  const feedback = this.parseReflectorFeedback(partnerResult.result);
     console.log('REFLECT RESULT IN GENERATOR   ', partnerResult.result)
      enhancedTask = this.enhanceGeneratorTask(enhancedTask, partnerResult.result, iteration);
    } else if (transaction.agentName === 'DataReflectingAgent') {
      // Reflector receives output and enhances its task
      //const generatorOutput = this.parseGeneratorOutput(partnerResult.result);
      console.log('GENERATOR RESULT IN REFLECT   ', partnerResult.result)
      enhancedTask = this.enhanceReflectorTask(enhancedTask, partnerResult.result, iteration);
    }*/
    console.log('ENHANCED TASK    ', enhancedTask)
     /*reflector result
    agentName: 'DataReflectingAgent',
      result: '1. What specific steps were taken to generate the numerical data arrays for each installation on the given dates?\n' +
        '2. Can you provide details about the algorithm used to extract and process the data from the dataset?\n' +
      */
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
  /*
  genericAgent execute
RRESULT  {
  agentName: 'DataReflectingAgent',
  result: '1. What specific input or data are we reflecting on for this task?\n' +
    '2. Are there any particular areas or aspects of the input that require more focus or questioning?\n' +
    '3. What is the ultimate goal or objective of reflecting on this input?\n' +
    '4. Are there any constraints or guidelines we need to consider while posing questions?\n' +
    '5. How will the questions we pose contribute to the overall task completion?\n' +
    '6. Is there any additional context or information from other agents that could inform our questioning process?',
  success: true,
  timestamp: 2025-07-21T11:11:06.733Z,
  circularDependencyMetadata: {
    totalIterations: 1,
    finalIteration: true,
    reflectorFeedback: {
      agentName: 'DataStructuringAgent',
      result: '```json\n' +
  */

  private enhanceGeneratorTask(
    originalTask: string, 
    feedback: any, 
    iteration: number
  ): string {

const filteringAgentContext: WorkingMemory = this.contextManager.getContext('DataFilteringAgent') as WorkingMemory;

originalTask += filteringAgentContext.lastTransactionResult;

/*if (!feedback || Object.keys(feedback).length === 0) {
      // Initial run - add reflection request to the task
      return `${originalTask}  

CIRCULAR DEPENDENCY PROTOCOL:
After completing your task, include a JSON object in your response with this structure:
{
  "taskResult": {  your task output / },
  //  "taskContext": "${originalTask.replace(/"/g, '\\"')}",
  //  "iteration": ${iteration}
  }
}`;
}
*/
/*
"reflectionRequest": {
    "needsFeedback": true,
    "feedbackType": "task_review",
    "specificQuestions": [
      "Does the output meet the task requirements?",
      "Are there any quality issues?",
      "Should any aspects be improved?"
    ],
*/

let agentSpecificTask = '';
//if (transaction.agentName === 'DataStructuringAgent'){
          //Looking at the WorkingMemory interface (lines 63-65), it's defined as { [key: string]: any }, so it expects an object.


const reflectingAgentContext: WorkingMemory = this.contextManager.getContext('DataReflectingAgent') as WorkingMemory;
const generatingAgentContext: WorkingMemory = this.contextManager.getContext('DataStructuringAgent') as WorkingMemory;
let reflectResults;
let genResults;
if(reflectingAgentContext && reflectingAgentContext.lastTransactionResult){
   
   reflectResults = typeof reflectingAgentContext.lastTransactionResult === 'string' 
          ? reflectingAgentContext.lastTransactionResult
          : JSON.stringify(reflectingAgentContext.lastTransactionResult, null, 2);
     } else {
          reflectResults = typeof reflectingAgentContext.lastTransactionResult === 'object' 
          ? JSON.stringify(reflectingAgentContext.lastTransactionResult, null, 2) 
          : String(reflectingAgentContext.lastTransactionResult);
     }   
     
if(generatingAgentContext && generatingAgentContext.lastTransactionResult){
    genResults = typeof generatingAgentContext.lastTransactionResult === 'string' 
          ? generatingAgentContext.lastTransactionResult
          : JSON.stringify(generatingAgentContext.lastTransactionResult, null, 2);
     } else {
        genResults = typeof generatingAgentContext.lastTransactionResult === 'object' 
          ? JSON.stringify(generatingAgentContext.lastTransactionResult, null, 2) 
          : String(generatingAgentContext.lastTransactionResult);
     }   
      originalTask += `              **PHASE 2 QUESTIONS**\n` + reflectResults;
      originalTask += `              **ANSWER QUESTIONS OF PHASE 1 RESULT:**\n` + genResults;
    // Subsequent runs - incorporate feedback

return `${originalTask}

  FEEDBACK FROM REFLECTOR (Iteration ${iteration}):

  Please address the questions and improve your task output. Include the same JSON structure in your response with updated iteration number.`;

  /*
 Assessment: ${feedback.quality_assessment || 'N/A'}
  Suggestions: ${Array.isArray(feedback.suggestions) ? feedback.suggestions.join(', ') : feedback.suggestions || 'None'}
  Strengths: ${Array.isArray(feedback.strengths) ? feedback.strengths.join(', ') : feedback.strengths || 'None'}
  Issues: ${Array.isArray(feedback.issues) ? feedback.issues.join(', ') : feedback.issues || 'None'}




  this.contextManager.updateContext(reflectorTx.agentName, {
        lastTransactionResult: reflectorResult.result,
        transactionId: reflectorTx.id,
        timestamp: new Date(),
        circularIteration: iteration,
        partnerOutput: generatorResult.result
      });
  */
  }

  private enhanceReflectorTask(
    originalTask: string, 
    generatorOutput: any, 
    iteration: number
  ): string {

   let csvResultData;
   if (generatorOutput) {
          csvResultData = typeof generatorOutput === 'string' 
          ? generatorOutput
          : JSON.stringify(generatorOutput, null, 2);
     } else {
          csvResultData = typeof generatorOutput === 'object' 
          ? JSON.stringify(generatorOutput, null, 2) 
          : String(generatorOutput);
     }         
    const taskContext = `Ask questions concerning this data: ${csvResultData}`;//generatorOutput.reflectionRequest?.taskContext || 'Unknown task';
        
    return `${originalTask}

GENERATOR OUTPUT TO REVIEW (Iteration ${iteration}):
Task Context: ${taskContext}

`;

    //Output: ${typeof generatorOutput.taskResult === 'string' ? generatorOutput.taskResult : JSON.stringify(generatorOutput.taskResult, null, 2)}
     /*
     Ask your questions in relation to the generating  agents results:
{
  "agentName": "DataReflectingAgent",
    "result": "1. What is the specific task that the DataReflectingAgent is supposed to perform

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
}
     */

  }


  // JSON parsing helpers
  private needsFeedback(result: any): boolean {
    console.log('FEEDBACK     ',result)
    try {
      const jsonContent = this.extractJsonFromResponse(result);
      const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      return parsed.reflectionRequest?.needsFeedback === true;
    } catch {
      return false;
    }
  }

  private shouldContinueLoop(result: any): boolean {
    try {
      const jsonContent = this.extractJsonFromResponse(result);
      const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      return parsed.loopControl?.continue === true;
    } catch {
      return false;
    }
  }

  private parseReflectorFeedback(result: any): any {
    try {
      const jsonContent = this.extractJsonFromResponse(result);
      const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      return parsed.feedback || {};
    } catch {
      return {};
    }
  }

  private parseGeneratorOutput(result: any): any {
    try {
      const jsonContent = this.extractJsonFromResponse(result);
      const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      return parsed.taskResult ? parsed : { taskResult: parsed };
    } catch {
      return {};
    }
  }

  private extractJsonFromResponse(result: any): any {
    if (typeof result !== 'string') {
      return result;
    }
    
    try {
      // First try to parse the entire result as JSON
      return JSON.parse(result);
    } catch {
      // If that fails, try to extract JSON from the response
      // Look for patterns like { ... } or [ ... ]
      const jsonMatches = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Try to parse the last JSON-like structure found
        const lastJsonMatch = jsonMatches[jsonMatches.length - 1];
        try {
          return JSON.parse(lastJsonMatch);
        } catch {
          // If still fails, return the original result
          return result;
        }
      }
      
      // If no JSON structure found, return the original result
      return result;
    }
  }
}