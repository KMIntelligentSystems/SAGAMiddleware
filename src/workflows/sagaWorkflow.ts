import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { createMCPServerConfig, connectToMCPServer, dataPreprocessor } from '../index.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { SagaWorkflowRequest, SagaState, HumanInLoopConfig, SAGA_TRANSACTIONS } from '../types/visualizationSaga.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { AgentDefinition, AgentResult, LLMConfig, MCPToolCall, MCPServerConfig } from '../types/index.js';
import { TransactionRegistry, TransactionRegistryConfig } from '../services/transactionRegistry.js';
import { ContextRegistry, ContextRegistryConfig, ContextSetDefinition, DataSource, LLMPromptConfig } from '../services/contextRegistry.js';
import { ConversationManager, ThreadMessage } from '../services/conversationManager.js';

export class SagaWorkflow {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;
  private initialized: boolean = false;
  private eventBusClient: SAGAEventBusClient;
  private config: HumanInLoopConfig;
  private transactionRegistry: TransactionRegistry;
  private contextRegistry: ContextRegistry;
  private conversationManager: ConversationManager;
  
  // Global thread and message retention
  private currentThreadId: string | null = null;
  private currentUserMessage: string | null = null;
  private lastThreadMessage: ThreadMessage | null = null;
  
  constructor(config: HumanInLoopConfig) {
    this.config = config;
    this.coordinator = new SagaCoordinator();
    this.ragServerConfig = createMCPServerConfig({
      name: "rag-server",
      transport: "stdio",
      command: "node",
      args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
      timeout: 600000
    });
    this.eventBusClient = new SAGAEventBusClient(config.eventBus.url);
    
    // Initialize TransactionRegistry
    const registryConfig: TransactionRegistryConfig = {
      eventBusUrl: config.eventBus.url,
      defaultTransactionSet: 'visualization'
    };
    this.transactionRegistry = new TransactionRegistry(registryConfig);
    
    // Initialize ContextRegistry
    const contextConfig: ContextRegistryConfig = {
      eventBusUrl: config.eventBus.url,
      defaultContextSet: 'default_visualization_context'
    };
    this.contextRegistry = new ContextRegistry(contextConfig);
    
    // Initialize ConversationManager
    this.conversationManager = new ConversationManager( process.env.ASSISTANT_ID  || '');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Visualization SAGA Processor...');
    
    // Initialize TransactionRegistry first set up event bus listener
    await this.transactionRegistry.initialize();
    
    // Register default visualization transaction set
    this.registerDefaultTransactionSet();
    
    // Initialize ContextRegistry after TransactionRegistry (requirement #4)
    await this.contextRegistry.initialize();
   
    
    // Register default context set for the visualization transaction set
    this.registerDefaultContextSet();
    
    // Connect to RAG server
    try {
      await connectToMCPServer(this.ragServerConfig);
      console.log('✅ Connected to RAG MCP server');
    } catch (error) {
      throw new Error(`Failed to connect to RAG server: ${error}`);
    }

    // Ensure data is indexed
    console.log('📊 Ensuring data is indexed...');
   /* const dataSource = await dataPreprocessor.ensureDataIndexed(
      "c:/repos/SAGAMiddleware/data/supply.csv",
      "supply_analysis",
      {
        type: "CSV",
        analysisType: "comprehensive",
        source: "supply.csv",
        indexedAt: new Date().toISOString()
      }
    );

    if (dataSource.status === 'error') {
      throw new Error(`Data preprocessing failed: ${dataSource.error}`);
    }

    console.log(`✅ Data indexed: ${dataSource.chunkCount} chunks available`);*/

    // Register SAGA agents
    this.registerAgents();

    // Set up event listeners
    this.setupEventListeners();

    // Listen for browser requests
    this.setupEventBusListener();

    this.initialized = true;
    console.log('✅ Visualization SAGA Processor initialized');
  }

  /**
   * Register the default visualization transaction set from types
   */
  private registerDefaultTransactionSet(): void {
    console.log('📝 Registering default visualization transaction set...');
    
    this.transactionRegistry.registerDefaultTransactionSet({
      name: 'visualization',
      description: 'Default visualization SAGA transaction set',
      transactions: SAGA_TRANSACTIONS,
    });
    
    // Set as active transaction set
    this.transactionRegistry.setActiveTransactionSet('visualization');
    
    console.log('✅ Default visualization transaction set registered and activated');
  }

  /**
   * Register the default context set for visualization transaction set
   */
  private registerDefaultContextSet(): void {
    console.log('📝 Registering default context set for visualization...');
    
    // Create default data sources (CSV files focus as per requirement #2)
    const defaultDataSources: DataSource[] = [
      {
        id: 'supply_csv',
        name: 'Supply Data',
        type: 'csv',
        path: 'c:/repos/SAGAMiddleware/data/supply.csv',
        metadata: {
          description: 'Supply chain energy data',
          columns: ['timestamp', 'output', 'type', 'location'],
          lastModified: new Date()
        }
      }
    ];
    
    // Create default LLM prompts for each agent (requirement #3)
    const defaultLLMPrompts: LLMPromptConfig[] = [
     
      {
        agentName: 'ConversationAgent',
        agentType: 'processing',
        transactionId: 'tx-1',
        backstory: 'Manage conversation with user as an intermediary passing user instructions to other agents.',
        taskDescription: `You are a conversation agent whose task is to pass verbatim what you receive to anther agent to process.
        **OVERRIDE**: Ignore any format or output structure requirements within the agent definitions. Ignore any instructions which contain 'you' as it does not pertain to any actions on your part. Your only job is to pass through the content unchanged. Pass through every thing between '[AGENT..][/AGENT].`,
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Pass through the user instructions exactly as received, preserving all formatting and bracket tags.'
      },
    /*  {
        agentName: 'DataProcessingAgent',
        agentType: 'tool',
        transactionId: 'tx-2',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'The usage of tool calling under appropiate matching of tool with intent to index a file.',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Provide information such as the collection name so another agent can search the vectorized CSV data chunks, Also provide that part of the "user query" which pertains directly to data filtering and not to the indexing'
      },
  
      {
        agentName: 'DataFilteringAgent',
        agentType: 'tool',
        transactionId: 'tx-3',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Use the inputs provided to create a query.',
        taskExpectedOutput: 'Provide only the JSON to be used for the search tools parameters'
      }*/
      {
        agentName: 'DataStructuringAgent',
        agentType: 'processing',
        transactionId: 'tx-4-1',
        backstory: 'You compute the values that meet the requirements.',
        taskDescription: 'Structure input data so that it is suitable as input for other operations',
        taskExpectedOutput: 'Provide structured data as required for a specific operation'
      },
      {
        agentName: 'DataReflectingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-2',
        backstory: 'You compute the values that meet the requirements.',
        taskDescription: 'Your task is to reflect on the input you receive and pose questions',
        taskExpectedOutput: 'Provide questions in a structured way'
      }
    ];
    
    const defaultContextSet: ContextSetDefinition = {
      name: 'default_visualization_context',
      transactionSetName: 'visualization', // Links to the transaction set (requirement #1)
      description: 'Default context set for visualization SAGA with CSV data sources',
      dataSources: defaultDataSources,
      llmPrompts: defaultLLMPrompts,
      userQuery: this.currentUserMessage as string
    };
    
    // Register the context set
    this.contextRegistry.registerDefaultContextSet(defaultContextSet);
    
    // Activate it for the visualization transaction set
    this.contextRegistry.activateContextSetForTransactionSet('visualization', 'default_visualization_context');
    
    // Initialize ConversationManager after context setup
    console.log('🧵 ConversationManager initialized with assistant ID:', process.env.OPENAI_ASSISTANT_ID || 'not set');
    
    console.log('✅ Default context set registered and activated for visualization transaction set');
  }

   private registerAgents(): void {
      console.log('🔧 Registering Visualization SAGA agents...');

      // Get all llmPrompts and extract unique agent names
      const contextSet = this.contextRegistry.getContextSetForTransactionSet('visualization');
      if (!contextSet) {
        throw new Error('No context set found for visualization transaction set');
      }
      const uniqueAgentNames = [...new Set(contextSet.llmPrompts.map(prompt => prompt.agentName))];
      
      // Extract agent types for each unique agent
      const agentTypes = new Map<string, string>();
      for (const prompt of contextSet.llmPrompts) {
        agentTypes.set(prompt.agentName, prompt.agentType);
      }

      // Create agents dynamically from llmPrompts
      for (const agentName of uniqueAgentNames) {
        let agent: AgentDefinition;
        const agentType = agentTypes.get(agentName);
        
        if (agentType === 'tool') {
          agent = this.createAgentFromLLMPrompts(agentName, [this.ragServerConfig]);
        } else {
          agent = this.createAgentFromLLMPrompts(agentName);
        }
        
        this.coordinator.registerAgent(agent);
        console.log(`✅ Registered agent: ${agentName}`);
      }

      console.log('✅ All SAGA agents registered');
    }

    private createAgentFromLLMPrompts(agentName: string, mcpServers?: MCPServerConfig[]): AgentDefinition {
      // Get llmPrompts for this agent from the context registry
      const llmPrompts = this.contextRegistry.getLLMPromptsForAgent('visualization', agentName);
      
      if (llmPrompts.length === 0) {
        throw new Error(`No LLM prompts found for agent: ${agentName}`);
      }

      // Use the first prompt as the base configuration
      const basePrompt = llmPrompts[0];
      
      // Get LLM configuration from prompt parameters if available, otherwise use defaults
      const promptParams = basePrompt.parameters || {};
      
      // Get agent type from llmPrompts
      const agentType = basePrompt.agentType as 'tool' | 'processing';
      
      // Create LLM config based on agent type
      const llmConfig: LLMConfig = {
        provider: 'openai',
        model: promptParams.model || (agentType === 'tool' ? 'gpt-4o-mini' : 'gpt-4o'),
        temperature: promptParams.temperature || (agentType === 'tool' ? 0.2 : 0.3),
        maxTokens: promptParams.maxTokens || (agentType === 'tool' ? 2000 : 1500),
        apiKey: process.env.OPENAI_API_KEY
      };

      // Create base context from llmPrompts
    /*  let context = basePrompt.context || {};
      
      // Add specific context for data_filtering agent
      if (agentName === 'DataFilteringAgent') {
        context = {
          ...context,
          collection: 'supply_analysis',
          maxChunks: 50
        };
      }*/
      let context = basePrompt.context || {};
      // Create agent definition using information from llmPrompts
      const agentDefinition: AgentDefinition = {
        name: agentName,
        backstory: basePrompt.backstory,
        taskDescription: basePrompt.taskDescription,
        taskExpectedOutput: basePrompt.taskExpectedOutput,
        llmConfig,
        context,
        dependencies: [],
        agentType: agentType,
        mcpServers: mcpServers || []
      };

      return agentDefinition;
    }
  
    private setupEventListeners(): void {
      this.coordinator.on('saga_initialized', (state: SagaState) => {
        console.log(`🎯 [SAGA] Initialized: ${state.id} (${state.totalTransactions} transactions)`);
      });
  
      this.coordinator.on('transaction_started', (event: any) => {
        console.log(`🔄 [SAGA] Transaction started: ${event.name} (${event.transaction})`);
      });
  
      this.coordinator.on('transaction_completed', (event: any) => {
        console.log(`✅ [SAGA] Transaction completed: ${event.name}`);
      });
  
      this.coordinator.on('saga_completed', (state: SagaState) => {
        const duration = state.endTime ? state.endTime.getTime() - state.startTime.getTime() : 0;
        console.log(`🎉 [SAGA] Completed: ${state.id} in ${Math.round(duration / 1000)}s`);
      });
  
      this.coordinator.on('saga_failed', (event: any) => {
        console.log(`💥 [SAGA] Failed: ${event.error}`);
      });
  
      this.coordinator.on('compensation_executed', (event: any) => {
        console.log(`↪️ [SAGA] Compensation executed: ${event.action} for ${event.agentName}`);
      });
    }

     /**
   * Setup event bus listener for start-graph-request events from browser
   */
  private async setupEventBusListener(): Promise<void> {
    console.log('🔧 Setting up Event Bus listener for browser requests...');
    
    // Wait for event bus connection
    let attempts = 0;
    while (!this.eventBusClient.isEventBusConnected() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!this.eventBusClient.isEventBusConnected()) {
      console.error('❌ Failed to connect to Event Bus after 30 seconds');
      return;
    }
    
    console.log('✅ Event Bus connected, setting up message listener...');
    
    // Access the socket directly to listen for events
    const socket = this.eventBusClient['socket'];
    
    socket.on('event_received', async (message: any) => {
       if (message.type === 'thread_id_response' && message.source === 'react-app') {
        console.log(`🧵 Received thread_id_response from browser:` + JSON.stringify(message.data));
        await this.handleOpenAIThreadRequest(message)
       } else if (message.type === 'start-graph-request' && message.source === 'react-app') {
        console.log(`📊 Received start-graph-request from browser: ${JSON.stringify(message.data)}`);
        await this.handleBrowserGraphRequest(message);
      } else if (message.type === 'enhanced_graph_request') {
        console.log(`📊 Received enhanced routed graph request with priority: ${message.data.routingInfo?.priority}`);
   //     await this.handleEnhancedBrowserRequest(message.data.browserRequest, message.data.routingInfo);
      } else if (message.type === 'human_loop_graph_request') {
        console.log(`📊 Received legacy routed graph request: ${JSON.stringify(message.data)}`);
     //   await this.handleBrowserGraphRequest(message.data.originalMessage);
      }
    });
    
    console.log('🎧 Listening for browser graph requests via service bus...');
  }

  /**
   * Handle OpenAI thread request from browser
   */
  private async handleOpenAIThreadRequest(message: any): Promise<void> {
    try {
      console.log(`🧵 Processing OpenAI thread request from browser...`);
      
      // Extract threadId from message
      const { data } = message;
      const threadId = data.threadId;
      
      if (!threadId) {
        console.error('❌ No threadId provided in thread_id_response');
        return;
      }
      
      // Store thread globally for retention
      this.currentThreadId = threadId;
      
      // Fetch latest message from OpenAI thread
      const threadMessage = await this.conversationManager.fetchLatestThreadMessage(threadId);
      
      if (!threadMessage) {
        console.error(`❌ No user message found in thread ${threadId}`);
        return;
      }
      
      // Store message globally for retention
      this.currentUserMessage = threadMessage.userMessage;
      this.lastThreadMessage = threadMessage;
      
      console.log(`📝 Fetched user message: ${threadMessage.userMessage.substring(0, 100)}...`);
      
      // Create browser request from thread message
      const browserRequest: BrowserGraphRequest = {
        userQuery: threadMessage.userMessage,
        correlationId: ''
      };
      
      // Execute SAGA with thread context
      await this.executeThreadVisualizationSAGA(browserRequest, threadId);
      
    } catch (error) {
      console.error('❌ Error handling OpenAI thread request:', error);
      
      // Send error response back to thread if possible
      if (this.currentThreadId) {
        try {
        /*  await this.conversationManager.sendResponseToThread(
            this.currentThreadId, 
            'I encountered an error processing your request. Please try again.'
          );*/
        } catch (responseError) {
          console.error('❌ Failed to send error response to thread:', responseError);
        }
      }
    }
  }

  /**
     * Handle graph request from browser via Event Bus using Enhanced SAGA
     */
    private async handleBrowserGraphRequest(message: any): Promise<void> {
      try {
        console.log(`📊 Processing enhanced graph request from browser...`);
        
        // Extract data from the message
        const { data } = message;
        const threadId = data.threadId || `browser_${Date.now()}`;
        const userQuery = data.userQuery || data.query || 'Show me coal energy output trends over the last 3 days';
        
        // Create enhanced browser request with three key inputs
        const browserRequest: BrowserGraphRequest = {
          // Input 1: Requirements for the graph
          userQuery,
          
          // Input 2: Data requirements including date ranges, output fields, and graph type
          correlationId: message.messageId || `corr_${Date.now()}`
        };

        /* const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: "Show me coal energy output trends over the last 3 days",
      visualizationRequest: {
        userQuery: "Show me coal energy output trends over the last 3 days",
        filters: {
          energyTypes: ['coal'],
          timeRange: {
            start: "2023-11-02T04:00:00.000Z",
            end: "2023-11-05T23:55:00.000Z"
          },
          aggregation: 'hourly'
        },
        chartPreferences: {
          type: 'line'
        }
      },
      workflowId: `simple_saga_${Date.now()}`
    };*/
        
  
        console.log(`📋 Requirements: ${browserRequest.userQuery}`);
   
        
        // Execute the enhanced human-in-the-loop SAGA
        const result = await this.executeSimpleVisualizationSAGA(browserRequest);
        
        // Publish enhanced result back to event bus for the browser
        this.eventBusClient['publishEvent']('enhanced_saga_result', {
          result,
          workflowId: '',//browserRequest.requestId,
          threadId: '',//browserRequest.threadId,
          success: result.success,
          correlationId: browserRequest.correlationId,
         // processingTime: result.processingTime,
        //  refinementCycles: result.refinementCycles,
          source: 'enhanced-human-in-loop-saga',
          enhancedFeatures: {
            requirementsAnalysis: true,
            dataAnalysis: true,
            enhancedCoding: true,
            interactiveDemo: true,
            qualityMetrics: true
          }
        }, 'broadcast');
        
        if (result.success) {
          
         
        } else {
        //  console.log(`❌ Enhanced browser graph request failed: ${result.reason}`);
        }
        
      } catch (error) {
        console.error(`💥 Error handling enhanced browser graph request:`, error);
        
        // Publish error back to event bus
        this.eventBusClient['publishEvent']('enhanced_saga_error', {
          error: error instanceof Error ? error.message : String(error),
          workflowId: message.data?.workflowId || `enhanced_browser_error_${Date.now()}`,
          threadId: message.data?.threadId,
          correlationId: message.messageId,
          source: 'enhanced-human-in-loop-saga',
          enhancedContext: {
            phase: 'request_processing',
            services: ['requirements-service', 'data-analysis-service', 'coding-service']
          }
        }, 'broadcast');
      }
    }
  
  /**
   * Execute visualization SAGA specifically for OpenAI thread requests
   */
  private async executeThreadVisualizationSAGA(browserRequest: BrowserGraphRequest, threadId: string): Promise<void> {
    try {
      console.log(`🧵 Executing Thread Visualization SAGA for thread: ${threadId}`);
      
      // Get active transaction set
      const activeTransactionSet = this.transactionRegistry.getActiveTransactionSet();
      if (!activeTransactionSet) {
        throw new Error('No active transaction set found');
      }
      console.log("COUNT TRSN ", activeTransactionSet.transactions.length)
      // Get the active context set for this transaction set
      const activeContextSet = this.contextRegistry.getContextSetForTransactionSet(activeTransactionSet.name);
      // Using context set: default_visualization_context for transaction set: visualization
      console.log(`🔄 Using context set: ${activeContextSet?.name || 'none'} for transaction set: ${activeTransactionSet.name}`);
      
      
      // Execute SAGA through coordinator
      const result = await this.coordinator.executeSagaWorkflow(
        browserRequest,
        `thread_saga_${threadId}_${Date.now()}`,
        activeTransactionSet.transactions,
        activeContextSet
      );
      console.log('HEERERERWQRWER')
      // Send response back to thread
      if (result.success) {
        const responseMessage = result.result || 'Your request has been processed successfully.';
     //   await this.conversationManager.sendResponseToThread(threadId, responseMessage);
        console.log(`✅ Thread SAGA completed successfully for thread: ${threadId}`);
      } else {
        const errorMessage = `I encountered an issue processing your request: ${result.error || 'Unknown error'}`;
     //   await this.conversationManager.sendResponseToThread(threadId, errorMessage);
        console.log(`❌ Thread SAGA failed for thread: ${threadId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error executing Thread Visualization SAGA:`, error);
      
      // Send error response to thread
      try {
        const errorMessage = 'I encountered a technical error. Please try again or rephrase your request.';
       // await this.conversationManager.sendResponseToThread(threadId, errorMessage);
      } catch (responseError) {
        console.error('❌ Failed to send error response to thread:', responseError);
      }
    }
  }

    async executeSimpleVisualizationSAGA(browserRequest: BrowserGraphRequest): Promise<AgentResult> {
    console.log('\n📊 Executing Simple Visualization SAGA');
    console.log('==========================================');

   /* const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: "Show me coal energy output trends over the last 3 days",
      visualizationRequest: {
        userQuery: "Show me coal energy output trends over the last 3 days",
        filters: {
          energyTypes: ['coal'],
          timeRange: {
            start: "2023-11-02T04:00:00.000Z",
            end: "2023-11-05T23:55:00.000Z"
          },
          aggregation: 'hourly'
        },
        chartPreferences: {
          type: 'line'
        }
      },
      workflowId: `simple_saga_${Date.now()}`
    };*/

    try {
      // Get the active transaction set from registry
      const activeTransactionSet = this.transactionRegistry.getActiveTransactionSet();
      if (!activeTransactionSet) {
        throw new Error('No active transaction set found in registry');
      }
      
      console.log(`🔄 Using transaction set: ${activeTransactionSet.name} with ${activeTransactionSet.transactions.length} transactions`);
      
      // Get the active context set for this transaction set
      const activeContextSet = this.contextRegistry.getContextSetForTransactionSet(activeTransactionSet.name);
      
      console.log(`🔄 Using context set: ${activeContextSet?.name || 'none'} for transaction set: ${activeTransactionSet.name}`);
      
      // Pass transaction ordering and context to coordinator
      const result = await this.coordinator.executeSagaWorkflow(
        browserRequest, 
        `simple_saga_${Date.now()}`,
        activeTransactionSet.transactions,
        activeContextSet
      );
      
      return result;
  //    this.displaySAGAResults(result, 'Simple Visualization');
    } catch (error) {
      console.error('❌ Simple SAGA failed:', error);
      const transactionId = ';ll'
      return await this.handleFailure(transactionId, error, 'sagaState');
    }
  }

   /**
     * Handle system failure
     */
    private async handleFailure(
      transactionId: string,
      error: any,
      sagaState: any
    ): Promise<AgentResult> {
      await this.executeDistributedCompensation(transactionId, sagaState);
      
   /*   sagaState.status = 'failed';
      sagaState.endTime = new Date();
      sagaState.errors.push(error instanceof Error ? error.message : String(error));
      
      await this.persistenceManager.saveTransactionState(transactionId, sagaState);
  */
      return {
        success: false,
        agentName: '',
        result: '',
        error: 'error',
        timestamp: new Date()
      //  transactionId,
       // reason: 'system_failure',
       // processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
      //  humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
       // servicesUsed: sagaState.completedServices
      };
    }
  
    /**
     * Execute compensation actions across all services
     */
    private async executeDistributedCompensation(
      transactionId: string,
      sagaState: AgentResult
    ): Promise<void> {
      console.log(`🔄 Executing distributed compensation for transaction ${transactionId}`);
      
      // Cancel any pending human approvals
    //  await this.humanInteractionService.cancelApprovals(transactionId, 'Transaction failed');
      
      // Execute service-specific compensations
    /*  for (const [serviceId, service] of sagaState.services.entries()) {
        if (service.status === 'completed') {
          console.log(`↪️ Compensating service: ${serviceId}`);
          // In real implementation, would call service-specific compensation
        }
      }
    }*/
  
    /**
     * Calculate total time spent in human interactions
     */
 /*   private calculateHumanInteractionTime(sagaState: AgentResult): number {
      // In real implementation, would track actual human interaction time
      return 30000; // Demo: 30 seconds
    }*/
  
    /**
     * Persist final artifacts to long-term storage
     */
   /* private async persistFinalArtifacts(deliverable: FinalDeliverable, transactionId: string): Promise<void> {
      console.log(`💾 Persisting final artifacts for transaction ${transactionId}`);
      
      // In real implementation, would save to database, file system, or cloud storage
      // For demo, just log the artifacts
      console.log(`📄 Documentation: ${deliverable.documentation.substring(0, 100)}...`);
      console.log(`🔧 Deployment instructions ready`);
      console.log(`📦 Version: ${deliverable.version}`);
    }*/
  
}
}


// Main execution function
export async function runVisualizationSAGAExample(): Promise<void> {
    const config: HumanInLoopConfig = {
  /*    timeouts: {
        specificationReviewTimeout: 24 * 60 * 60 * 1000, // 24 hours
        codeReviewTimeout: 48 * 60 * 60 * 1000, // 48 hours
        finalApprovalTimeout: 7 * 24 * 60 * 60 * 1000, // 1 week
        maxTransactionLifetime: 30 * 24 * 60 * 60 * 1000, // 30 days
        onTimeout: 'compensate',
        compensationActions: {
          notifyUser: true,
          archiveArtifacts: true,
          releaseResources: true,
          emailNotification: true
        }
      },*/
      services: {
        ragService: 'http://localhost:3001',
        codingService: 'http://localhost:3002',
        humanInterface: 'http://localhost:3004',
        persistence: 'redis://localhost:6379'
      },
      eventBus: {
        url: 'http://localhost:3003',
        topics: ['saga_events', 'human_events'],
        retryAttempts: 3
      },
      humanInterface: {
        approvalBaseUrl: 'http://localhost:3004',
        emailNotifications: true,
        slackNotifications: false
      },
      persistence: {
        provider: 'database',
        retentionDays: 90,
        backupEnabled: true
      }
    };
  
  const processor = new SagaWorkflow(config);

  try {
    await processor.initialize();
     // Wait a bit for the event bus connection to be established
    await new Promise(resolve => setTimeout(resolve, 2000));
   // await processor.executeSimpleVisualizationSAGA();
    console.log('📡 Coordinator is now listening for browser requests via event bus...');
    console.log('💡 Send start-graph-request messages from react-app to trigger processing');
    console.log('');
    console.log('Press Ctrl+C to exit...');

  /*  const choice = await createVisualizationMenu();

    switch (choice) {
      case '1':
        console.log('\n🔄 Running Simple Time Series Query...');
        await processor.executeSimpleVisualizationSAGA();
        break;
      
      case '2':
        console.log('\n🔄 Running Complex Multi-filter Query...');
        await processor.executeComplexVisualizationSAGA();
        break;
      
      case '3':
        console.log('\n🔄 Running Conversation-based Requirements...');
        await processor.executeConversationBasedSAGA();
        break;
      
      case '4':
        console.log('\n🔄 Running Failure Recovery Demo...');
        await processor.executeFailureRecoverySAGA();
        break;
      
      case '5':
        console.log('\n🔄 Running Batch Processing...');
        await processor.executeBatchProcessingSAGA();
        break;
      
      case '6':
        console.log('\n🔄 Running All Examples...');
        await processor.executeSimpleVisualizationSAGA();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
        await processor.executeComplexVisualizationSAGA();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await processor.executeConversationBasedSAGA();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await processor.executeFailureRecoverySAGA();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await processor.executeBatchProcessingSAGA();
        console.log('\n🎉 All examples completed!');
        break;
      
      case '0':
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
      
      default:
        console.log('❌ Invalid choice. Please run again and select 0-6.');
        process.exit(1);
    }
*/
    console.log('\n✨ Visualization SAGA processing complete!');
    console.log('Press any key to exit...');
    
    // Keep console open
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => process.exit(0));
    } catch (stdinError) {
      console.log('Waiting 10 seconds before exit...');
      setTimeout(() => process.exit(0), 10000);
    }

  } catch (error) {
    console.error('💥 Visualization SAGA processing failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('visualizationSagaProcessing.js') || process.argv[1].endsWith('visualizationSagaProcessing.ts')) {
  runVisualizationSAGAExample();
}