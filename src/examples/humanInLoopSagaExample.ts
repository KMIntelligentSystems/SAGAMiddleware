import { HumanInteractionService } from '../services/humanInteractionService.js';
import { SAGAPersistenceManager } from '../services/sagaPersistenceManager.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { VisualizationSAGAProcessor } from './visualizationSagaProcessing.js';
import {
  HumanInLoopConfig,
  HumanInLoopSAGAState,
  ApprovalArtifacts,
  ChartSpecification,
  CodeArtifacts,
  FinalDeliverable,
  HumanApprovedResult
} from '../types/humanInLoopSaga.js';
import { VisualizationWorkflowRequest } from '../types/visualizationSaga.js';

/**
 * Extended SAGA Coordinator that supports human-in-the-loop workflows
 */
export class HumanInLoopVisualizationCoordinator {
  private visualizationProcessor: VisualizationSAGAProcessor;
  private humanInteractionService: HumanInteractionService;
  private persistenceManager: SAGAPersistenceManager;
  private eventBusClient: SAGAEventBusClient;
  private config: HumanInLoopConfig;

  constructor(config: HumanInLoopConfig) {
    this.config = config;
    this.visualizationProcessor = new VisualizationSAGAProcessor();
    this.humanInteractionService = new HumanInteractionService(config);
    this.persistenceManager = new SAGAPersistenceManager(config);
    this.eventBusClient = new SAGAEventBusClient(config.eventBus.url);
    
    this.setupEventHandlers();
  }

  /**
   * Execute a complete human-in-the-loop visualization SAGA
   */
  async executeHumanInLoopVisualizationSAGA(
    workflowRequest: VisualizationWorkflowRequest,
    enableHumanLoop: boolean = true
  ): Promise<HumanApprovedResult> {
    const transactionId = workflowRequest.workflowId || `human_saga_${Date.now()}`;
    const startTime = new Date();

    console.log(`🚀 Starting Human-in-the-Loop Visualization SAGA: ${transactionId}`);
    
    // Initialize SAGA state
    const sagaState: HumanInLoopSAGAState = {
      id: transactionId,
      transactionId,
      status: 'initializing',
      startTime,
      lastActivity: startTime,
      humanDecisions: [], // Add missing property
      services: new Map([
        ['rag-service', { name: 'rag-service', status: 'pending', compensationActions: [] }],
        ['coding-service', { name: 'coding-service', status: 'pending', compensationActions: [] }],
        ['user-interaction-service', { name: 'user-interaction-service', status: 'pending', compensationActions: [] }]
      ]),
      pendingServices: ['rag-service'],
      completedServices: [],
      failedServices: [],
      persistenceKey: '',
      lastCheckpoint: startTime,
      checkpoints: [],
      timeoutStrategy: this.config.timeouts,
      artifacts: {},
      errors: [],
      compensations: []
    };

    try {
      // Save initial state
      await this.persistenceManager.saveTransactionState(transactionId, sagaState);

      // Phase 1: Generate Chart Specification via RAG Service
      console.log(`📊 Phase 1: Generating chart specification...`);
      sagaState.status = 'specification_pending';
      
      const specification = await this.executeSpecificationGeneration(workflowRequest, sagaState);
      sagaState.artifacts.specification = specification;
      sagaState.services.get('rag-service')!.status = 'completed';
      sagaState.completedServices.push('rag-service');

      // Create checkpoint after specification generation
      await this.persistenceManager.createCheckpoint(
        transactionId,
        'rag-service',
        { specification, workflowRequest },
        true
      );

      if (enableHumanLoop) {
        // Human Checkpoint 1: Specification Review
        console.log(`🤝 Human Checkpoint 1: Specification Review`);
        const specApprovalResult = await this.requestHumanApproval(
          transactionId,
          'specification_review',
          { 
            transactionId, 
            specification, 
            metadata: { 
              userQuery: workflowRequest.userQuery || 'No query provided',
              dataSource: 'supply_analysis',
              processingTime: Date.now() - startTime.getTime(),
              servicesCalled: sagaState.completedServices
            } 
          }
        );

        if (specApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'specification_rejected', sagaState);
        }

        if (specApprovalResult.decision === 'modify' && specApprovalResult.modifications) {
          // Apply modifications to specification
          sagaState.artifacts.specification = { ...specification, ...specApprovalResult.modifications };
        }
      }

      // Phase 2: Generate Code via Coding Service
      console.log(`💻 Phase 2: Generating visualization code...`);
      sagaState.status = 'code_pending';
      sagaState.pendingServices = ['coding-service'];

      const codeArtifacts = await this.executeCodingService(sagaState.artifacts.specification!, sagaState);
      sagaState.artifacts.code = codeArtifacts;
      sagaState.services.get('coding-service')!.status = 'completed';
      sagaState.completedServices.push('coding-service');

      // Create checkpoint after code generation
      await this.persistenceManager.createCheckpoint(
        transactionId,
        'coding-service',
        { specification: sagaState.artifacts.specification, code: codeArtifacts },
        true
      );

      if (enableHumanLoop) {
        // Human Checkpoint 2: Code Review
        console.log(`🤝 Human Checkpoint 2: Code Review`);
        const codeApprovalResult = await this.requestHumanApproval(
          transactionId,
          'code_review',
          { 
            transactionId, 
            specification: sagaState.artifacts.specification,
            generatedCode: codeArtifacts,
            metadata: { 
              userQuery: workflowRequest.userQuery || 'No query provided',
              dataSource: 'supply_analysis',
              processingTime: Date.now() - startTime.getTime(),
              servicesCalled: sagaState.completedServices
            }
          }
        );

        if (codeApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'code_rejected', sagaState);
        }

        if (codeApprovalResult.decision === 'modify' && codeApprovalResult.modifications) {
          // Apply modifications to code
          sagaState.artifacts.code = { ...codeArtifacts, ...codeApprovalResult.modifications };
        }
      }

      // Phase 3: Prepare Final Deliverable
      console.log(`📦 Phase 3: Preparing final deliverable...`);
      sagaState.status = 'final_approval_pending';

      const finalArtifacts = await this.prepareFinalArtifacts(
        sagaState.artifacts.specification!,
        sagaState.artifacts.code!,
        workflowRequest
      );
      sagaState.artifacts.final = finalArtifacts;

      if (enableHumanLoop) {
        // Human Checkpoint 3: Final Approval
        console.log(`🤝 Human Checkpoint 3: Final Approval & Sign-off`);
        const finalApprovalResult = await this.requestHumanApproval(
          transactionId,
          'final_approval',
          { 
            transactionId, 
            finalArtifacts,
            metadata: { 
              userQuery: workflowRequest.userQuery || 'No query provided',
              dataSource: 'supply_analysis',
              processingTime: Date.now() - startTime.getTime(),
              servicesCalled: sagaState.completedServices
            }
          }
        );

        if (finalApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'final_rejected', sagaState);
        }
      }

      // Phase 4: Persist Final Artifacts
      console.log(`💾 Phase 4: Persisting final approved artifacts...`);
      await this.persistFinalArtifacts(finalArtifacts, transactionId);

      // Complete transaction
      sagaState.status = 'completed';
      sagaState.endTime = new Date();
      sagaState.services.get('user-interaction-service')!.status = 'completed';
      sagaState.completedServices.push('user-interaction-service');

      await this.persistenceManager.saveTransactionState(transactionId, sagaState);

      const result: HumanApprovedResult = {
        success: true,
        transactionId,
        artifacts: finalArtifacts,
        processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
        humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
        servicesUsed: sagaState.completedServices
      };

      console.log(`🎉 Human-in-the-Loop SAGA completed successfully: ${transactionId}`);
      console.log(`⏱️  Total time: ${Math.round(result.processingTime / 1000)}s`);
      console.log(`🤝 Human interaction time: ${Math.round(result.humanInteractionTime / 1000)}s`);

      return result;

    } catch (error) {
      console.error(`💥 Human-in-the-Loop SAGA failed: ${transactionId}`, error);
      return await this.handleFailure(transactionId, error, sagaState);
    }
  }

  /**
   * Execute specification generation using RAG service
   */
  private async executeSpecificationGeneration(
    workflowRequest: VisualizationWorkflowRequest,
    sagaState: HumanInLoopSAGAState
  ): Promise<ChartSpecification> {
    console.log(`🔍 Executing RAG service for data filtering and specification...`);
    
    // Initialize visualization processor and execute
    await this.visualizationProcessor.initialize();
    const coordinator = this.visualizationProcessor['coordinator'];
    
    // Execute the visualization SAGA to get specification
    const result = await coordinator.executeVisualizationSAGA(workflowRequest);
    
    if (!result.success) {
      throw new Error(`RAG service failed: ${result.error}`);
    }

    // Extract chart specification from result
    const chartSpec: ChartSpecification = {
      chartType: result.result?.finalOutput?.chartSpec?.chartType || 'line',
      title: result.result?.finalOutput?.chartSpec?.title || 'Energy Visualization',
      dataMapping: result.result?.finalOutput?.chartSpec?.dataMapping || {
        xAxis: 'timestamp',
        yAxis: 'output'
      },
      filters: workflowRequest.visualizationRequest?.filters || {},
      aggregation: workflowRequest.visualizationRequest?.filters?.aggregation || 'hourly',
      visualizationConfig: result.result?.finalOutput?.chartSpec || {}
    };

    console.log(`✅ Chart specification generated: ${chartSpec.chartType} chart`);
    return chartSpec;
  }

  /**
   * Execute coding service to generate React visualization code
   */
  private async executeCodingService(
    specification: ChartSpecification,
    sagaState: HumanInLoopSAGAState
  ): Promise<CodeArtifacts> {
    console.log(`💻 Executing coding service to generate visualization code...`);
    
    // In a real implementation, this would call an external coding service
    // For demo purposes, we'll generate a sample React component
    const reactComponent = this.generateReactComponent(specification);
    
    const codeArtifacts: CodeArtifacts = {
      reactComponent,
      chartLibrary: 'recharts',
      dependencies: ['react', 'recharts', 'styled-components'],
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // Demo preview
      testData: [
        { timestamp: '2023-11-01', output: 1200, type: 'coal' },
        { timestamp: '2023-11-02', output: 1350, type: 'coal' },
        { timestamp: '2023-11-03', output: 1180, type: 'coal' }
      ]
    };

    console.log(`✅ Code generated: React component with ${codeArtifacts.chartLibrary}`);
    return codeArtifacts;
  }

  /**
   * Request human approval and wait for decision
   */
  private async requestHumanApproval(
    transactionId: string,
    stage: 'specification_review' | 'code_review' | 'final_approval',
    artifacts: ApprovalArtifacts
  ): Promise<{ decision: 'approve' | 'reject' | 'modify'; feedback?: string; modifications?: any }> {
    console.log(`🤝 Requesting human approval for ${stage}...`);
    
    // Request approval via human interaction service
    const approvalToken = await this.humanInteractionService.requestApproval(
      transactionId,
      stage,
      artifacts
    );

    // Publish approval request event
    this.eventBusClient['publishEvent']('human_approval_requested', {
      transactionId,
      humanStage: stage,
      interactionToken: approvalToken.token,
      approvalUrl: approvalToken.approvalUrl,
      artifacts,
      timeoutAt: approvalToken.expiresAt
    }, 'broadcast');

    // Wait for human decision (in real implementation, this would be event-driven)
    console.log(`⏳ Waiting for human decision... (Timeout: ${approvalToken.expiresAt.toISOString()})`);
    console.log(`🔗 Approval URL: ${approvalToken.approvalUrl}`);
    
    // For demo purposes, simulate immediate approval
    // In real implementation, this would wait for actual human input via events
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate thinking time
    
    return {
      decision: 'approve',
      feedback: 'Looks good! Proceeding with the specification.',
      modifications: undefined
    };
  }

  /**
   * Prepare final deliverable package
   */
  private async prepareFinalArtifacts(
    specification: ChartSpecification,
    code: CodeArtifacts,
    workflowRequest: VisualizationWorkflowRequest
  ): Promise<FinalDeliverable> {
    const finalDeliverable: FinalDeliverable = {
      specification,
      code,
      documentation: this.generateDocumentation(specification, code),
      deploymentInstructions: this.generateDeploymentInstructions(code),
      version: `v1.0.0_${Date.now()}`,
      createdAt: new Date()
    };

    return finalDeliverable;
  }

  /**
   * Handle rejection at any stage
   */
  private async handleRejection(
    transactionId: string,
    reason: string,
    sagaState: HumanInLoopSAGAState
  ): Promise<HumanApprovedResult> {
    console.log(`❌ Human rejection: ${reason} for transaction ${transactionId}`);
    
    // Execute compensations
    await this.executeDistributedCompensation(transactionId, sagaState);
    
    sagaState.status = 'compensated';
    sagaState.endTime = new Date();
    sagaState.errors.push(`Human rejected: ${reason}`);
    
    await this.persistenceManager.saveTransactionState(transactionId, sagaState);

    return {
      success: false,
      transactionId,
      reason,
      processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
      humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
      servicesUsed: sagaState.completedServices
    };
  }

  /**
   * Handle system failure
   */
  private async handleFailure(
    transactionId: string,
    error: any,
    sagaState: HumanInLoopSAGAState
  ): Promise<HumanApprovedResult> {
    await this.executeDistributedCompensation(transactionId, sagaState);
    
    sagaState.status = 'failed';
    sagaState.endTime = new Date();
    sagaState.errors.push(error instanceof Error ? error.message : String(error));
    
    await this.persistenceManager.saveTransactionState(transactionId, sagaState);

    return {
      success: false,
      transactionId,
      reason: 'system_failure',
      processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
      humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
      servicesUsed: sagaState.completedServices
    };
  }

  /**
   * Execute compensation actions across all services
   */
  private async executeDistributedCompensation(
    transactionId: string,
    sagaState: HumanInLoopSAGAState
  ): Promise<void> {
    console.log(`🔄 Executing distributed compensation for transaction ${transactionId}`);
    
    // Cancel any pending human approvals
    await this.humanInteractionService.cancelApprovals(transactionId, 'Transaction failed');
    
    // Execute service-specific compensations
    for (const [serviceId, service] of sagaState.services.entries()) {
      if (service.status === 'completed') {
        console.log(`↪️ Compensating service: ${serviceId}`);
        // In real implementation, would call service-specific compensation
      }
    }
  }

  /**
   * Calculate total time spent in human interactions
   */
  private calculateHumanInteractionTime(sagaState: HumanInLoopSAGAState): number {
    // In real implementation, would track actual human interaction time
    return 30000; // Demo: 30 seconds
  }

  /**
   * Persist final artifacts to long-term storage
   */
  private async persistFinalArtifacts(deliverable: FinalDeliverable, transactionId: string): Promise<void> {
    console.log(`💾 Persisting final artifacts for transaction ${transactionId}`);
    
    // In real implementation, would save to database, file system, or cloud storage
    // For demo, just log the artifacts
    console.log(`📄 Documentation: ${deliverable.documentation.substring(0, 100)}...`);
    console.log(`🔧 Deployment instructions ready`);
    console.log(`📦 Version: ${deliverable.version}`);
  }

  /**
   * Generate React component code
   */
  private generateReactComponent(specification: ChartSpecification): string {
    return `
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ${specification.title.replace(/\\s+/g, '')}Chart = ({ data }) => {
  return (
    <div style={{ width: '100%', height: '400px' }}>
      <h2>${specification.title}</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="${specification.dataMapping.xAxis}" />
          <YAxis dataKey="${specification.dataMapping.yAxis}" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="${specification.dataMapping.yAxis}" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ${specification.title.replace(/\\s+/g, '')}Chart;
`;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation(specification: ChartSpecification, code: CodeArtifacts): string {
    return `
# ${specification.title} Visualization

## Overview
This visualization displays ${specification.chartType} chart showing energy data with ${specification.aggregation} aggregation.

## Usage
\`\`\`jsx
import Chart from './Chart';
const data = [/* your data here */];
<Chart data={data} />
\`\`\`

## Dependencies
${code.dependencies.join(', ')}

## Configuration
- Chart Type: ${specification.chartType}
- Aggregation: ${specification.aggregation}
- X-Axis: ${specification.dataMapping.xAxis}
- Y-Axis: ${specification.dataMapping.yAxis}

Generated at: ${new Date().toISOString()}
`;
  }

  /**
   * Generate deployment instructions
   */
  private generateDeploymentInstructions(code: CodeArtifacts): string {
    return `
# Deployment Instructions

1. Install dependencies:
   npm install ${code.dependencies.join(' ')}

2. Copy the generated component to your project

3. Import and use in your React application

4. Ensure your data follows the expected format

5. Test with the provided sample data
`;
  }

  /**
   * Setup event handlers for various services
   */
  private setupEventHandlers(): void {
    // Human interaction service events
    this.humanInteractionService.on('approval_requested', (event) => {
      console.log(`📧 Approval notification sent for ${event.stage}`);
    });

    this.humanInteractionService.on('decision_received', (decision) => {
      console.log(`✅ Decision processed: ${decision.decision}`);
    });

    this.humanInteractionService.on('approval_timeout', (event) => {
      console.log(`⏰ Approval timeout: ${event.stage}`);
    });

    // Persistence manager events
    this.persistenceManager.on('state_saved', (event) => {
      console.log(`💾 State saved: ${event.transactionId}`);
    });

    this.persistenceManager.on('checkpoint_created', (event) => {
      console.log(`📍 Checkpoint created: ${event.serviceId}`);
    });
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Human-in-the-Loop Coordinator...');
    
    await Promise.all([
      this.humanInteractionService.shutdown(),
      this.persistenceManager.shutdown(),
      this.eventBusClient.shutdown()
    ]);

    console.log('✅ Human-in-the-Loop Coordinator shutdown complete');
  }
}

// Example usage and demo
export async function runHumanInLoopExample(): Promise<void> {
  const config: HumanInLoopConfig = {
    timeouts: {
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
    },
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

  const coordinator = new HumanInLoopVisualizationCoordinator(config);

  try {
    console.log('🚀 Starting Human-in-the-Loop SAGA Example...');

    const workflowRequest: VisualizationWorkflowRequest = {
      userQuery: "Show me coal energy output trends over the last 3 days with human approval workflow",
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
      workflowId: `human_loop_demo_${Date.now()}`
    };

    const result = await coordinator.executeHumanInLoopVisualizationSAGA(workflowRequest, true);

    if (result.success) {
      console.log('🎉 Human-in-the-Loop SAGA completed successfully!');
      console.log(`📊 Final artifacts ready: Version ${result.artifacts?.version}`);
    } else {
      console.log(`❌ SAGA failed: ${result.reason}`);
    }

  } catch (error) {
    console.error('💥 Human-in-the-Loop example failed:', error);
  } finally {
    await coordinator.shutdown();
  }
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\\\/g, '/')}`) {
  runHumanInLoopExample();
}