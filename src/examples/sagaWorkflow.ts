import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { createMCPServerConfig, connectToMCPServer, dataPreprocessor } from '../index.js';
import { 
  createRequirementsInitializerAgent,
  createConversationManagerAgent,
  createRequirementsValidatorAgent
} from '../agents/visualizationSagaAgents.js';
import { createDataFilteringAgent, createChartSpecificationAgent } from '../agents/dataFilteringAgent.js';
import { createVisualizationReportAgent } from '../agents/visualizationReportAgent.js';
import { VisualizationWorkflowRequest, VisualizationSAGAState, HumanInLoopConfig } from '../types/visualizationSaga.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';


export class SagaWorkflow {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;
  private initialized: boolean = false;
  private eventBusClient: SAGAEventBusClient;
  private config: HumanInLoopConfig;
  
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
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Visualization SAGA Processor...');
    
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
      if (message.type === 'start-graph-request' && message.source === 'react-app') {
        console.log(`📊 Received start-graph-request from browser: ${JSON.stringify(message.data)}`);
     //   await this.handleBrowserGraphRequest(message);
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

    async executeSimpleVisualizationSAGA(): Promise<void> {
    console.log('\n📊 Executing Simple Visualization SAGA');
    console.log('==========================================');

    const workflowRequest: VisualizationWorkflowRequest = {
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
    };

    try {
      const result = await this.coordinator.executeVisualizationSAGA(workflowRequest);
  //    this.displaySAGAResults(result, 'Simple Visualization');
    } catch (error) {
      console.error('❌ Simple SAGA failed:', error);
    }
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