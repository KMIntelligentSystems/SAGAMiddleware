import { EventEmitter } from 'events';
import { 
  AgentDefinition, 
  SagaEvent, 
  AgentResult,
  WorkingMemory
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
  private visualizationSagaState: VisualizationSAGAState | null = null;
  private currentExecutingTransactionSet: VisualizationTransaction[] | null = null;
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
  // VISUALIZATION SAGA METHODS
  // ========================================

  initializeVisualizationSAGA(workflowId: string, request: VisualizationWorkflowRequest, transactionCount?: number): void {
    this.visualizationSagaState = {
      id: workflowId,
      status: 'initializing',
      currentTransaction: 0,
      totalTransactions: transactionCount || VISUALIZATION_TRANSACTIONS.length,
      
    
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
    request: BrowserGraphRequest, //VisualizationWorkflowRequest,
    workflowId: string = `viz_saga_${Date.now()}`,
    transactionOrdering?: VisualizationTransaction[],
    contextSet?: ContextSetDefinition
  ): Promise<AgentResult> {
    console.log(`🚀 Starting Visualization SAGA: ${workflowId}`);
    
    // Use provided transaction ordering or fall back to default
    const transactionsToExecute = transactionOrdering as VisualizationTransaction[];//|| VISUALIZATION_TRANSACTIONS;

   // this.initializeVisualizationSAGA(workflowId, request, transactionsToExecute.length);
    
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
      // VISUALIZATION_TRANSACTIONS:VisualizationTransaction
      
      for (const transaction of transactionsToExecute) {
        console.log(`🔄 Executing Transaction: ${transaction.name} (${transaction.id})`);
       
    
        const result = await this.executeVisualizationTransaction(transaction, request); 
        console.log("RRESULT ", result.result)
        
        if (!result.success) {
          console.log(`❌ Transaction failed: ${transaction.name} - ${result.error}`);
          this.visualizationSagaState!.errors.push(`${transaction.name}: ${result.error}`);
          
          // Execute compensations for completed transactions
          await this.executeCompensations();
          
          throw new Error(`Transaction ${transaction.name} failed: ${result.error}`);
        }
        //Get previous result to put into the context of the next agent to run. The previous result will have instructions for the next agent
        if(contextSet && counter < contextSet.llmPrompts.length - 1){
            const prevContextSet = contextSet as ContextSetDefinition
            const nextPromptIndex = counter + 1;
            if (prevContextSet.llmPrompts[nextPromptIndex]) {
              if(transaction.agentName != 'ConversationAgent'){
                   prevContextSet.llmPrompts[nextPromptIndex].context = {'currResult': result.result};
              }
              const nextContextSet: ContextSetDefinition = {
                name: '',
                transactionSetName: '', // Links to a transaction set
                dataSources: [],
                llmPrompts: [prevContextSet.llmPrompts[nextPromptIndex] ],
                userQuery: ''
              };
              this.contextManager.setActiveContextSet(nextContextSet);
            }
        }
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
      
      console.log(`🎉 Visualization SAGA completed successfully: ${workflowId}`);

 return {
        agentName: 'visualization_saga_coordinator',
        result: '',
        success: true,
        timestamp: new Date()
      };
    } catch (error) {
   //   await this.transactionManager.rollbackTransaction(transactionId);
      
  //  💥 Visualization SAGA failed: thread_saga_thread_JO596op9tdbjiJaySjJPQe21_1751344836444 - TypeError: Cannot set properties of undefined (setting 'context')
      
      console.log(`💥 Visualization SAGA failed: ${workflowId} - ${error}`);
    
      return {
        agentName: 'visualization_saga_coordinator',
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

  private async executeVisualizationTransaction(
    transaction: VisualizationTransaction, 
    request: BrowserGraphRequest
  ): Promise<AgentResult> {
    const agent = this.agents.get(transaction.agentName);
    if (!agent) {
      throw new Error(`Agent ${transaction.agentName} not registered for transaction ${transaction.id}`);
    }

    // Build context for this transaction
    const context = await this.buildVisualizationTransactionContext(transaction, request);
    
    // Execute the transaction
    const result = await agent.execute(context);
    console.log("RESULT ", result.result)
    
       // Check dependencies are satisfied (use the current transaction set being executed)
 /*  for (const depId of transaction.dependencies) {
      // Find dependency in the current transaction set being executed
      const transactionsToExecute = this.currentExecutingTransactionSet || VISUALIZATION_TRANSACTIONS;
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
await new Promise(resolve => setTimeout(resolve, 500));
    return result;
  }

  private async buildVisualizationTransactionContext(
    transaction: VisualizationTransaction, 
    request: VisualizationWorkflowRequest
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
    } else {
      // For other agents, first try to get instructions from ConversationAgent's working memory
      if (conversationContext && conversationContext.lastTransactionResult) {
        console.log("HERE IN CONVERSATIONCONTEXT")
        agentSpecificTask = this.parseConversationResultForAgent(conversationContext.lastTransactionResult, transaction.agentName);
      }

      // If no conversation context available, fall back to parsing the original user query
      if (!agentSpecificTask && request.userQuery) {
        agentSpecificTask = this.parseUserQueryForAgent(request.userQuery, transaction.agentName);
      }
    }
    
    // Build final context with text-only variables
    context = {
      dataSources: dataSourcesText,
      llmPrompt: llmPromptText,
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
      // Handle both formats: numbered sections and markdown sections
      
      // First try to find numbered sections like "1. Agent name: DataProcessingAgent"
      const numberedSectionRegex = new RegExp(`\\d+\\.\\s*Agent name:\\s*${agentName}[\\s\\S]*?(?=\\d+\\.\\s*Agent name:|$)`, 'i');
      let match = resultText.match(numberedSectionRegex);
      if (!match) {
        // Try markdown format like "**DataProcessingAgent**"
        const markdownSectionRegex = new RegExp(`\\*\\*${agentName}\\*\\*[\\s\\S]*?(?=\\d+\\.\\s*\\*\\*\\w+Agent\\*\\*|$)`, 'i');
        match = resultText.match(markdownSectionRegex);
      }
      if (match) {
        let agentSection = match[0];
        
        // Clean up the section by removing markdown formatting and extracting key information
        agentSection = agentSection.replace(/\*\*|\\\\/g, ''); // Remove markdown bold and escaped characters
        agentSection = agentSection.replace(/\\n/g, '\n'); // Convert escaped newlines to actual newlines
        
        // For numbered sections, extract everything after "Agent name: AgentName"
        if (agentSection.includes('Agent name:')) {
          const agentNameIndex = agentSection.indexOf('Agent name:');
          const afterAgentName = agentSection.substring(agentNameIndex);
          const lines = afterAgentName.split('\n');
          
          let cleanedInstructions = '';
          for (let i = 1; i < lines.length; i++) { // Skip the "Agent name:" line
            const trimmedLine = lines[i].trim();
            if (trimmedLine) {
              // Clean up the line and add it
              if (trimmedLine.startsWith('Task description:')) {
                cleanedInstructions += trimmedLine + '\n';
              } else if (!trimmedLine.match(/^\d+\.\s*Agent name:/)) {
                cleanedInstructions += trimmedLine + '\n';
              }
            }
          }
          
          console.log(`CLEANED for ${agentName}:`, cleanedInstructions.trim());
          return cleanedInstructions.trim();
        } else {
          // For markdown sections like "**DataProcessingAgent**: content"
          // Remove the agent name part and extract the content
          const agentNamePattern = new RegExp(`^${agentName}\\s*:\\s*`, 'i');
          const content = agentSection.replace(agentNamePattern, '').trim();
          
          // Remove any trailing numbered sections that might have been captured
          const cleanContent = content.replace(/\n\s*\d+\.\s*$/, '').trim();
          
          // For DataFilteringAgent, extract structured query parameters
          if (agentName === 'DataFilteringAgent') {
            const structuredQuery = this.parseDataFilteringQuery(cleanContent);
            console.log(`STRUCTURED QUERY for ${agentName}:`, JSON.stringify(structuredQuery, null, 2));
            return JSON.stringify(structuredQuery);
          }
          
          console.log(`CLEANED for ${agentName}:`, cleanContent);
          return cleanContent;
        }
      }
      
      return '';
    } catch (error) {
      console.warn(`Failed to parse conversation result for agent ${agentName}:`, error);
      return '';
    }
  }

  private parseDataFilteringQuery(content: string): any {
    try {
      const query: any = {
        collection: "supply_analysis",
        search_text: "",
        metadata_filters: {},
        date_filters: {},
        limit: 1000,
        include_distances: false
      };

      // Extract semantic search text from the quoted string
      const semanticSearchMatch = content.match(/Task description for semantic search:\s*["']([^"']+)["']/i);
      if (semanticSearchMatch) {
        const searchContent = semanticSearchMatch[1];
        
        // Extract the main search description before the colon
        const mainSearchMatch = searchContent.match(/^([^:]+):/);
        if (mainSearchMatch) {
          query.search_text = mainSearchMatch[1].trim();
        } else {
          query.search_text = searchContent;
        }
      } else {
        // Fallback: look for any quoted strings
        const quotedMatch = content.match(/["']([^"']+)["']/);
        if (quotedMatch) {
          query.search_text = quotedMatch[1];
        }
      }

      // Extract date range with flexible patterns
      const datePattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/g;
      const dateMatches = content.match(datePattern);
      
      if (dateMatches && dateMatches.length >= 2) {
        // Assume first date is start, second is end
        query.date_filters = {
          field: "timestamp",
          start_date: dateMatches[0],
          end_date: dateMatches[1]
        };
      } else if (dateMatches && dateMatches.length === 1) {
        // If only one date, try to determine if it's start or end
        if (content.toLowerCase().includes('start')) {
          query.date_filters = {
            field: "timestamp",
            start_date: dateMatches[0]
          };
        } else if (content.toLowerCase().includes('end')) {
          query.date_filters = {
            field: "timestamp",
            end_date: dateMatches[0]
          };
        }
      }

      // Extract energy type from search text or content
      const energyTypes = ['coal', 'gas', 'oil', 'solar', 'wind', 'nuclear', 'energy'];
      for (const energyType of energyTypes) {
        if (content.toLowerCase().includes(energyType)) {
          query.metadata_filters.energy_type = energyType;
          break;
        }
      }

      // Extract time aggregation patterns
      const aggregationTypes = ['hourly', 'daily', 'weekly', 'monthly'];
      for (const aggType of aggregationTypes) {
        if (content.toLowerCase().includes(aggType)) {
          query.metadata_filters.aggregation = aggType;
          break;
        }
      }

      // Extract trends/output patterns
      if (content.toLowerCase().includes('trend')) {
        query.metadata_filters.analysis_type = 'trend';
      }
      if (content.toLowerCase().includes('output')) {
        query.metadata_filters.metric_type = 'output';
      }

      return {
        tool_name: "structured_query",
        parameters: query
      };
    } catch (error) {
      console.warn('Failed to parse data filtering query:', error);
      return {
        tool_name: "structured_query",
        parameters: {
          collection: "supply_analysis",
          search_text: content,
          metadata_filters: {},
          limit: 100
        }
      };
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

  private updateVisualizationSAGAState(transactionId: string, result: AgentResult): void {
    if (!this.visualizationSagaState) return;

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

  getVisualizationSAGAState(): VisualizationSAGAState | null {
    return this.visualizationSagaState ? { ...this.visualizationSagaState } : null;
  }

  getVisualizationRequirements(): any {
    return '';//this.visualizationSagaState?.requirementsState.extractedRequirements || null;
  }

  getVisualizationOutput(): any {
    return '';//this.visualizationSagaState?.reportState.finalOutput || null;
  }
}