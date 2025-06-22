import { VisualizationSAGAProcessor } from './visualizationSagaProcessing.js';
import { HumanInLoopBrowserCoordinator } from './humanInLoopSagaExample.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { VisualizationWorkflowRequest } from '../types/visualizationSaga.js';
import { HumanInLoopConfig } from '../types/humanInLoopSaga.js';
import * as readline from 'readline';

/**
 * Hybrid workflow that supports both local testing and event bus integration
 */
export class HybridSagaWorkflow {
  private visualizationProcessor: VisualizationSAGAProcessor;
  private humanLoopCoordinator?: HumanInLoopBrowserCoordinator;
  private eventBusClient?: SAGAEventBusClient;
  private mode: 'local' | 'event-bus' | 'human-loop';

  constructor(mode: 'local' | 'event-bus' | 'human-loop' = 'local') {
    this.mode = mode;
    this.visualizationProcessor = new VisualizationSAGAProcessor();
    
    if (mode === 'event-bus' || mode === 'human-loop') {
      this.initializeEventBusComponents();
    }
  }

  /**
   * Initialize event bus and human loop components
   */
  private initializeEventBusComponents(): void {
    console.log(`🔧 Initializing ${this.mode} components...`);

    // Create event bus client
    this.eventBusClient = new SAGAEventBusClient('http://localhost:3003');

    if (this.mode === 'human-loop') {
      // Create human-in-the-loop coordinator
      const config: HumanInLoopConfig = {
        timeouts: {
          specificationReviewTimeout: 5 * 60 * 1000, // 5 minutes for demo
          codeReviewTimeout: 10 * 60 * 1000, // 10 minutes for demo
          finalApprovalTimeout: 15 * 60 * 1000, // 15 minutes for demo
          maxTransactionLifetime: 60 * 60 * 1000, // 1 hour for demo
          onTimeout: 'compensate',
          compensationActions: {
            notifyUser: true,
            archiveArtifacts: true,
            releaseResources: true,
            emailNotification: false // Disabled for local testing
          }
        },
        services: {
          ragService: 'http://localhost:3001',
          codingService: 'http://localhost:3002',
          humanInterface: 'http://localhost:3004',
          persistence: 'memory://localhost'
        },
        eventBus: {
          url: 'http://localhost:3003',
          topics: ['saga_events', 'human_events'],
          retryAttempts: 3
        },
        humanInterface: {
          approvalBaseUrl: 'http://localhost:3004',
          emailNotifications: false,
          slackNotifications: false
        },
        persistence: {
          provider: 'database',
          retentionDays: 7, // Short retention for demo
          backupEnabled: false
        }
      };

      this.humanLoopCoordinator = new HumanInLoopBrowserCoordinator(config);
    }
  }

  /**
   * Execute workflow based on selected mode
   */
  async executeWorkflow(request: VisualizationWorkflowRequest): Promise<any> {
    console.log(`🚀 Executing ${this.mode} workflow...`);

    switch (this.mode) {
      case 'local':
        return await this.executeLocalWorkflow(request);
      
      case 'event-bus':
        return await this.executeEventBusWorkflow(request);
      
      case 'human-loop':
        return await this.executeHumanLoopWorkflow(request);
      
      default:
        throw new Error(`Unknown workflow mode: ${this.mode}`);
    }
  }

  /**
   * Local workflow - direct execution (existing approach)
   */
  private async executeLocalWorkflow(request: VisualizationWorkflowRequest): Promise<any> {
    console.log('📊 Executing local visualization workflow...');
    
    await this.visualizationProcessor.initialize();
    const coordinator = this.visualizationProcessor['coordinator'];
    
    const result = '';//await coordinator.executeVisualizationSAGA(request);
    
    console.log('✅ Local workflow completed');
    return result;
  }

  /**
   * Event bus workflow - via SAGA event bus (no human interaction)
   */
  private async executeEventBusWorkflow(request: VisualizationWorkflowRequest): Promise<any> {
    console.log('📡 Executing event bus workflow...');
    
    if (!this.eventBusClient) {
      throw new Error('Event bus client not initialized');
    }

    // Ensure event bus client is ready
    await this.eventBusClient.ensureInitialized();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Event bus workflow timeout'));
      }, 30000); // 30 second timeout

      // Listen for saga result
      this.eventBusClient!['socket'].on('event_received', (message: any) => {
        if (message.type === 'saga_result' && message.data.workflowId === request.workflowId) {
          clearTimeout(timeout);
          console.log('✅ Event bus workflow completed');
          resolve(message.data.result);
        }
        
        if (message.type === 'saga_error' && message.data.workflowId === request.workflowId) {
          clearTimeout(timeout);
          reject(new Error(`Event bus workflow failed: ${message.data.error}`));
        }
      });

      // Publish start event
      this.eventBusClient!['publishEvent']('start_visualization_saga', {
        threadId: request.threadId,
        userQuery: request.userQuery,
        visualizationRequest: request.visualizationRequest,
        workflowId: request.workflowId,
        correlationId: `hybrid_${Date.now()}`
      }, 'broadcast');
    });
  }

  /**
   * Human-in-the-loop workflow - with approval stages
   */
  private async executeHumanLoopWorkflow(request: VisualizationWorkflowRequest): Promise<any> {
    console.log('🤝 Executing human-in-the-loop workflow...');
    
    if (!this.humanLoopCoordinator) {
      throw new Error('Human loop coordinator not initialized');
    }

    // For demo purposes, simulate quick approvals
    console.log('💡 Demo mode: Human approvals will be simulated');
    console.log('🔗 In production, users would receive approval URLs');
    
    const result = await this.humanLoopCoordinator.executeHumanInLoopBrowserSAGA(
      request,
      true // Enable human loop
    );
    
    console.log('✅ Human-in-the-loop workflow completed');
    return result;
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<void> {
    console.log('🏥 Running health check...');

    // Check visualization processor
    try {
      await this.visualizationProcessor.initialize();
      console.log('✅ VisualizationSAGAProcessor: Ready');
    } catch (error) {
      console.log('❌ VisualizationSAGAProcessor: Failed');
    }

    // Check event bus (if enabled)
    if (this.eventBusClient) {
      try {
        const isConnected = this.eventBusClient.isEventBusConnected();
        console.log(`${isConnected ? '✅' : '❌'} Event Bus: ${isConnected ? 'Connected' : 'Disconnected'}`);
      } catch (error) {
        console.log('❌ Event Bus: Connection failed');
      }
    }

    // Check human loop coordinator (if enabled)
    if (this.humanLoopCoordinator) {
      console.log('✅ Human Loop Coordinator: Ready');
    }

    console.log('🏥 Health check complete');
  }

  /**
   * Shutdown all components
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down hybrid workflow...');

    if (this.humanLoopCoordinator) {
      await this.humanLoopCoordinator.shutdown();
    }

    if (this.eventBusClient) {
      await this.eventBusClient.shutdown();
    }

    console.log('✅ Hybrid workflow shutdown complete');
  }
}

/**
 * Interactive menu for selecting workflow mode
 */
async function selectWorkflowMode(): Promise<'local' | 'event-bus' | 'human-loop'> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n🎯 SAGA Workflow Mode Selection');
    console.log('=================================');
    console.log('');
    console.log('1. Local Mode (Direct execution - fastest)');
    console.log('   ✅ No external dependencies');
    console.log('   ✅ Immediate results');
    console.log('   ✅ Perfect for development');
    console.log('');
    console.log('2. Event Bus Mode (Distributed execution)');
    console.log('   🔧 Requires event bus server on port 3003');
    console.log('   📡 SAGA via event communication');
    console.log('   ⚡ Good for microservices testing');
    console.log('');
    console.log('3. Human-in-the-Loop Mode (Full workflow)');
    console.log('   👤 Includes human approval stages');
    console.log('   📧 Approval URLs and notifications');
    console.log('   ⏱️  Long-running transactions');
    console.log('');

    rl.question('Select mode (1-3): ', (answer) => {
      rl.close();
      
      switch (answer.trim()) {
        case '1':
          resolve('local');
          break;
        case '2':
          resolve('event-bus');
          break;
        case '3':
          resolve('human-loop');
          break;
        default:
          console.log('Invalid selection, defaulting to local mode');
          resolve('local');
      }
    });
  });
}

/**
 * Main execution function
 */
export async function runHybridWorkflowExample(): Promise<void> {
  console.log('🚀 Starting Hybrid SAGA Workflow Demo...');

  try {
    // Let user select workflow mode
    const mode = await selectWorkflowMode();
    console.log(`\n🔧 Starting ${mode} mode...\n`);

    // Create hybrid workflow
    const workflow = new HybridSagaWorkflow(mode);

    // Run health check
    await workflow.healthCheck();

    // Create sample request
    const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: `Show me coal energy output trends (${mode} mode)`,
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
      workflowId: `hybrid_${mode}_${Date.now()}`
    };

    // Execute workflow
    console.log('🚀 Executing workflow...');
    const startTime = Date.now();
    
    const result = await workflow.executeWorkflow(workflowRequest);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Display results
    console.log('\n📋 Workflow Results:');
    console.log('==================');
    console.log(`✅ Mode: ${mode}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🆔 Workflow ID: ${workflowRequest.workflowId}`);
    
    if (result.success !== false) {
      console.log('🎉 Workflow completed successfully!');
      
      if (mode === 'human-loop') {
        console.log(`👤 Human interaction time: ${Math.round((result.humanInteractionTime || 0) / 1000)}s`);
        console.log(`🔧 Services used: ${result.servicesUsed?.join(', ') || 'N/A'}`);
      }
    } else {
      console.log(`❌ Workflow failed: ${result.reason || result.error}`);
    }

    // Keep console open briefly
    console.log('\nPress any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async () => {
      await workflow.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('💥 Hybrid workflow failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runHybridWorkflowExample();
}