import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { 
  createRequirementsInitializerAgent,
  createConversationManagerAgent,
  createRequirementsValidatorAgent
} from '../agents/visualizationSagaAgents.js';
import { createDataFilteringAgent, createChartSpecificationAgent } from '../agents/dataFilteringAgent.js';
import { createVisualizationReportAgent } from '../agents/visualizationReportAgent.js';
import { createMCPServerConfig, connectToMCPServer, dataPreprocessor } from '../index.js';
import { VisualizationWorkflowRequest, VisualizationSAGAState } from '../types/visualizationSaga.js';
import { VisualizationRequest } from '../types/visualization.js';
import * as readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

export class VisualizationSAGAProcessor {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;
  private initialized: boolean = false;

  constructor() {
    this.coordinator = new SagaCoordinator();
    this.ragServerConfig = createMCPServerConfig({
      name: "rag-server",
      transport: "stdio",
      command: "node",
      args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
      timeout: 120000
    });
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
      this.displaySAGAResults(result, 'Simple Visualization');
    } catch (error) {
      console.error('❌ Simple SAGA failed:', error);
    }
  }

  async executeComplexVisualizationSAGA(): Promise<void> {
    console.log('\n🔬 Executing Complex Visualization SAGA');
    console.log('==========================================');

    const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: "Compare efficiency between green energy and gas suppliers during peak hours, show daily aggregates with supplier breakdown",
      workflowId: `complex_saga_${Date.now()}`
    };

    try {
      const result = await this.coordinator.executeVisualizationSAGA(workflowRequest);
      this.displaySAGAResults(result, 'Complex Visualization');
    } catch (error) {
      console.error('❌ Complex SAGA failed:', error);
    }
  }

  async executeConversationBasedSAGA(): Promise<void> {
    console.log('\n💬 Executing Conversation-based SAGA');
    console.log('=====================================');

    const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: "Show me energy trends", // Intentionally vague to trigger conversation
      threadId: `mock_thread_${Date.now()}`, // Mock thread ID
      workflowId: `conversation_saga_${Date.now()}`
    };

    try {
      const result = await this.coordinator.executeVisualizationSAGA(workflowRequest);
      this.displaySAGAResults(result, 'Conversation-based Visualization');
    } catch (error) {
      console.error('❌ Conversation SAGA failed:', error);
    }
  }

  async executeFailureRecoverySAGA(): Promise<void> {
    console.log('\n💥 Executing Failure Recovery SAGA Demo');
    console.log('========================================');

    const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: "Show me invalid_energy_type data for impossible_date_range", // Intentional invalid request
      visualizationRequest: {
        userQuery: "Show me invalid_energy_type data for impossible_date_range",
        filters: {
          energyTypes: ['invalid_energy_type' as any],
          timeRange: {
            start: "2023-11-02T04:00:00.000Z",
            end: "2023-11-05T23:55:00.000Z"
          }
        }
      },
      workflowId: `failure_saga_${Date.now()}`
    };

    try {
      const result = await this.coordinator.executeVisualizationSAGA(workflowRequest);
      this.displaySAGAResults(result, 'Failure Recovery Demo');
    } catch (error) {
      console.log('✅ Expected failure occurred - compensation should have executed');
      console.error('❌ Failure Recovery SAGA result:', error);
    }
  }

  async executeBatchProcessingSAGA(): Promise<void> {
    console.log('\n📦 Executing Batch Processing SAGA');
    console.log('===================================');

    const batchRequests = [
      {
        userQuery: "Coal output by hour for yesterday",
        filters: { energyTypes: ['coal'], aggregation: 'hourly' }
      },
      {
        userQuery: "Green energy efficiency trends",
        filters: { energyTypes: ['green'], aggregation: 'daily' }
      },
      {
        userQuery: "Gas supplier comparison",
        filters: { energyTypes: ['gas'], aggregation: 'hourly' }
      }
    ];

    console.log(`Processing ${batchRequests.length} visualization requests...`);

    for (let i = 0; i < batchRequests.length; i++) {
      const request = batchRequests[i];
      console.log(`\n📊 Batch ${i + 1}/${batchRequests.length}: ${request.userQuery}`);

      const workflowRequest: VisualizationWorkflowRequest = {
        ...request,
        visualizationRequest: {
          userQuery: request.userQuery,
          filters: request.filters
        } as VisualizationRequest,
        workflowId: `batch_saga_${i + 1}_${Date.now()}`
      };

      try {
        const result = await this.coordinator.executeVisualizationSAGA(workflowRequest);
        this.displaySAGAResults(result, `Batch ${i + 1}`);
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
      }
    }
  }

  private displaySAGAResults(result: any, sagaType: string): void {
    console.log(`\n📋 ${sagaType} SAGA Results:`);
    console.log('═'.repeat(50));

    if (result.success) {
      const summary = result.result.summary;
      console.log(`✅ Status: SUCCESS`);
      console.log(`⏱️  Processing Time: ${Math.round(summary.processingTime / 1000)}s`);
      console.log(`🔄 Transactions: ${summary.totalTransactions}`);
      console.log(`📝 Requirements Gathered: ${summary.requirementsGathered ? 'Yes' : 'No'}`);
      console.log(`🔍 Data Filtered: ${summary.dataFiltered ? 'Yes' : 'No'}`);
      console.log(`📊 Chart Spec Generated: ${summary.chartSpecGenerated ? 'Yes' : 'No'}`);

      if (result.result.finalOutput) {
        const output = result.result.finalOutput;
        console.log(`\n📈 Visualization Output:`);
        console.log(`  Title: ${output.chartSpec?.title || 'N/A'}`);
        console.log(`  Chart Type: ${output.chartSpec?.chartType || 'N/A'}`);
        console.log(`  Data Points: ${output.metadata?.dataPoints || 'N/A'}`);
        console.log(`  Key Insights: ${output.narrative?.keyInsights?.length || 0}`);
        if (output.narrative?.keyInsights?.length > 0) {
          output.narrative.keyInsights.slice(0, 2).forEach((insight: string, i: number) => {
            console.log(`    ${i + 1}. ${insight}`);
          });
        }
      }
    } else {
      console.log(`❌ Status: FAILED`);
      console.log(`💥 Error: ${result.error}`);
    }

    console.log('═'.repeat(50));
  }
}

// Interactive menu system
function createVisualizationMenu(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n🎯 Visualization SAGA Processing Examples');
    console.log('==========================================');
    console.log('');
    console.log('Choose a SAGA workflow to execute:');
    console.log('1. Simple Time Series Query (Coal trends)');
    console.log('2. Complex Multi-filter Query (Green vs Gas efficiency)');
    console.log('3. Conversation-based Requirements (Vague query)');
    console.log('4. Failure Recovery Demo (Invalid request + compensation)');
    console.log('5. Batch Processing (Multiple visualizations)');
    console.log('6. Run All Examples');
    console.log('0. Exit');
    console.log('');

    rl.question('Enter your choice (0-6): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Main execution function
export async function runVisualizationSAGAExample(): Promise<void> {
  const processor = new VisualizationSAGAProcessor();

  try {
    await processor.initialize();

    const choice = await createVisualizationMenu();

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