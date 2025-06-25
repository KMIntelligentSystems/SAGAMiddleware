import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { createMCPServerConfig, connectToMCPServer, dataPreprocessor } from '../index.js';
import { 
  createRequirementsInitializerAgent,
  createConversationManagerAgent,
  createRequirementsValidatorAgent
} from '../agents/visualizationSagaAgents.js';
import { createDataFilteringAgent, createChartSpecificationAgent } from '../agents/dataFilteringAgent.js';
import { createVisualizationReportAgent } from '../agents/visualizationReportAgent.js';
import { VisualizationWorkflowRequest, VisualizationSAGAState, HumanInLoopConfig, VISUALIZATION_TRANSACTIONS } from '../types/visualizationSaga.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { AgentDefinition, AgentResult, LLMConfig, MCPToolCall } from '../types/index.js';
import { TransactionRegistry, TransactionRegistryConfig } from '../services/transactionRegistry.js';
import { ContextRegistry, ContextRegistryConfig, ContextSetDefinition, DataSource, LLMPromptConfig } from '../services/contextRegistry.js';

export class SagaWorkflow {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;
  private initialized: boolean = false;
  private eventBusClient: SAGAEventBusClient;
  private config: HumanInLoopConfig;
  private transactionRegistry: TransactionRegistry;
  private contextRegistry: ContextRegistry;
  
  constructor(config: HumanInLoopConfig) {
    this.config = config;
    this.coordinator = new SagaCoordinator();
    this.ragServerConfig = createMCPServerConfig({
      name: "rag-server",
      transport: "stdio",
      command: "node",
      args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
      timeout: 120000
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
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Visualization SAGA Processor...');
    
    // Initialize TransactionRegistry first
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
    this.registerVisualizationSAGAAgents();

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
    
    this.transactionRegistry.registerTransactionSet({
      name: 'visualization',
      description: 'Default visualization SAGA transaction set',
      transactions: VISUALIZATION_TRANSACTIONS,
      metadata: {
        version: '1.0.0',
        author: 'system',
        created: new Date()
      }
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
        agentName: 'requirements_initializer',
        transactionId: 'req_init',
        backstory: 'Initialize requirements gathering for data visualization. Extract user intent and prepare for conversation.',
        taskDescription: 'Focus on understanding what the user wants to visualize from the available data sources.',
        taskExpectedOutput: 'Structured requirements object with user intent and data preferences'
      },
      {
        agentName: 'conversation_manager',
        transactionId: 'req_extract',
        backstory: 'Manage conversation with user to extract detailed visualization requirements from the available CSV data sources.',
        taskDescription: 'Ask clarifying questions about time ranges, data fields, chart types, and filtering preferences.',
        context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Complete requirements specification for visualization'
      },
      {
        agentName: 'requirements_validator',
        transactionId: 'req_validate',
        backstory: 'Validate extracted requirements against available data sources and ensure feasibility.',
        taskDescription: 'Check if requested data fields exist in CSV files and requirements are achievable.',
        taskExpectedOutput: 'Validated requirements with any necessary adjustments'
      },
      {
        agentName: 'data_filtering',
        transactionId: 'data_query',
        backstory: 'Query and filter data from CSV files based on validated requirements.',
        taskDescription: 'Use the CSV data sources to extract relevant data matching user requirements.',
        context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Filtered dataset ready for visualization'
      },
      {
        agentName: 'data_filtering',
        transactionId: 'data_filter',
        backstory: 'Process and clean the filtered data for visualization.',
        taskDescription: 'Clean, aggregate, and format data according to user requirements.',
        taskExpectedOutput: 'Processed data ready for chart generation'
      },
      {
        agentName: 'chart_specification',
        transactionId: 'chart_spec',
        backstory: 'Generate chart specification based on processed data and user requirements.',
        taskDescription: 'Create detailed chart configuration including type, axes, styling, and layout.',
        taskExpectedOutput: 'Complete chart specification object'
      },
      {
        agentName: 'visualization_report',
        transactionId: 'viz_report',
        backstory: 'Generate final visualization report with chart and narrative.',
        taskDescription: 'Combine chart specification with explanatory text and insights from the data.',
        taskExpectedOutput: 'Complete visualization report with chart and narrative'
      }
    ];
    
    const defaultContextSet: ContextSetDefinition = {
      name: 'default_visualization_context',
      transactionSetName: 'visualization', // Links to the transaction set (requirement #1)
      description: 'Default context set for visualization SAGA with CSV data sources',
      dataSources: defaultDataSources,
      llmPrompts: defaultLLMPrompts,
      globalContext: {
        csvBasePath: 'c:/repos/SAGAMiddleware/data/',
        supportedChartTypes: ['line', 'bar', 'pie', 'scatter'],
        defaultTimeRange: '3 days',
        maxDataPoints: 10000
      },
      metadata: {
        version: '1.0.0',
        author: 'system',
        created: new Date()
      }
    };
    
    // Register the context set
    this.contextRegistry.registerContextSet(defaultContextSet);
    
    // Activate it for the visualization transaction set
    this.contextRegistry.activateContextSetForTransactionSet('visualization', 'default_visualization_context');
    
    console.log('✅ Default context set registered and activated for visualization transaction set');
  }

   private registerVisualizationSAGAAgents(): void {
      console.log('🔧 Registering Visualization SAGA agents...');
  
      const requirementsInitializer = createRequirementsInitializerAgent();
      const conversationManager = createConversationManagerAgent();
      const requirementsValidator = createRequirementsValidatorAgent();
      const dataFilteringAgent = createDataFilteringAgent([this.ragServerConfig]);
      const chartSpecAgent = createChartSpecificationAgent();
      const visualizationReportAgent = createVisualizationReportAgent();
  
      this.coordinator.registerAgent(requirementsInitializer);
      this.coordinator.registerAgent(conversationManager);
      this.coordinator.registerAgent(requirementsValidator);
      this.coordinator.registerAgent(dataFilteringAgent);
      this.coordinator.registerAgent(chartSpecAgent);
      this.coordinator.registerAgent(visualizationReportAgent);
  
      console.log('✅ All SAGA agents registered');
    }
  
    private setupEventListeners(): void {
      this.coordinator.on('visualization_saga_initialized', (state: VisualizationSAGAState) => {
        console.log(`🎯 [SAGA] Initialized: ${state.id} (${state.totalTransactions} transactions)`);
      });
  
      this.coordinator.on('visualization_transaction_started', (event: any) => {
        console.log(`🔄 [SAGA] Transaction started: ${event.name} (${event.transaction})`);
      });
  
      this.coordinator.on('visualization_transaction_completed', (event: any) => {
        console.log(`✅ [SAGA] Transaction completed: ${event.name}`);
      });
  
      this.coordinator.on('visualization_saga_completed', (state: VisualizationSAGAState) => {
        const duration = state.endTime ? state.endTime.getTime() - state.startTime.getTime() : 0;
        console.log(`🎉 [SAGA] Completed: ${state.id} in ${Math.round(duration / 1000)}s`);
      });
  
      this.coordinator.on('visualization_saga_failed', (event: any) => {
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
        console.log(`📊 Received thread_id_response from browser:` + JSON.stringify(message.data));
        await this.handleBrowserGraphRequest(message)
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
          dataRequirements: {
            dateRange: {
              start: data.filters?.timeRange?.start || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Last 3 days
              end: data.filters?.timeRange?.end || new Date().toISOString()
            },
            outputFields: data.outputFields || ['timestamp', 'output', 'type'],
            graphType: (data.chartType || 'line') as 'line' | 'bar' | 'pie' | 'scatter',
            aggregation: data.aggregation || 'hourly',
          dataRequirement: message.drReq,
          codeRequirement: message.cdReq,
          csvPath: ``
          },
          
          // Input 3: Data source specification
          dataSource: {
            collection: data.collection || 'supply_analysis',
            database: data.database,
            filters: data.filters?.energyTypes ? { type: { $in: data.filters.energyTypes } } : {}
          },
          
          // Request metadata
          requestId: data.workflowId || `enhanced_browser_${Date.now()}`,
          threadId,
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
        
        console.log(`🚀 Starting Enhanced Human-in-Loop Browser SAGA for request: ${browserRequest.requestId}`);
        console.log(`📋 Requirements: ${browserRequest.userQuery}`);
        console.log(`📊 Data Source: ${browserRequest.dataSource.collection}`);
        console.log(`📈 Graph Type: ${browserRequest.dataRequirements.dataRequirement}`);
        
        // Execute the enhanced human-in-the-loop SAGA
        const result = await this.executeSimpleVisualizationSAGA(browserRequest);
        
        // Publish enhanced result back to event bus for the browser
        this.eventBusClient['publishEvent']('enhanced_saga_result', {
          result,
          workflowId: browserRequest.requestId,
          threadId: browserRequest.threadId,
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
          console.log(`✅ Enhanced browser graph request completed successfully: ${browserRequest.requestId}`);
         
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
      const result = await this.coordinator.executeVisualizationSAGA(
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