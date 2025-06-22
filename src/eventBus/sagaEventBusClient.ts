import { io as SocketIOClient } from 'socket.io-client';
import { VisualizationSAGAProcessor } from '../examples/visualizationSagaProcessing.js';
import { VisualizationWorkflowRequest, VisualizationSAGAState } from '../types/visualizationSaga.js';
import { EventMessage, ServiceRegistration, SAGAEventType, SAGAEventData } from './types.js';

export class SAGAEventBusClient {
  private socket: any;
  private visualizationProcessor: VisualizationSAGAProcessor;
  private isConnected: boolean = false;
  private messageQueue: EventMessage[] = [];
  private eventBusUrl: string;
  private isInitialized: boolean = false;

  constructor(eventBusUrl: string = 'http://localhost:3003') {
    this.eventBusUrl = eventBusUrl;
    this.visualizationProcessor = new VisualizationSAGAProcessor();
    this.initializeConnection();
  }

  private initializeConnection(): void {
    console.log(`🔌 Connecting SAGA Middleware to Event Bus: ${this.eventBusUrl}`);
    
    this.socket = SocketIOClient(this.eventBusUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    this.setupConnectionHandlers();
    this.setupEventHandlers();
  }

  private setupConnectionHandlers(): void {
    this.socket.on('connect', () => {
      console.log('✅ SAGA Middleware connected to Event Bus');
      this.isConnected = true;
      
      // Register this service with the Event Bus
      const registration: ServiceRegistration = {
        serviceType: 'saga-middleware',
        serviceName: 'visualization-saga-processor',
        version: '1.0.0',
        capabilities: [
          'executeVisualizationSAGA',
          'getVisualizationState',
          'executeSimpleVisualizationSAGA',
          'executeComplexVisualizationSAGA',
          'executeConversationBasedSAGA',
          'executeBatchProcessingSAGA'
        ]
      };
      this.socket.emit('register_service', registration);

      // Initialize the processor and setup event forwarding
      this.initializeProcessor();
      
      // Process any queued messages
      this.processMessageQueue();
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log(`🔌 SAGA Middleware disconnected from Event Bus: ${reason}`);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('❌ Failed to connect to Event Bus:', error);
      this.isConnected = false;
    });

    this.socket.on('reconnect', (attemptNumber: any) => {
      console.log(`🔄 SAGA Middleware reconnected to Event Bus (attempt ${attemptNumber})`);
    });

    this.socket.on('reconnect_error', (error: any) => {
      console.error('❌ Reconnection failed:', error);
    });
  }

  private setupEventHandlers(): void {
    this.socket.on('event_received', (message: EventMessage) => {
      console.log(`📥 Received event: ${message.type} from ${message.source}`);
      this.handleIncomingEvent(message);
    });
  }

  private async handleIncomingEvent(message: EventMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'start_visualization_saga':
          await this.handleStartVisualizationSaga(message);
          break;
          
        case 'start-graph-request':
          await this.handleStartGraphRequest(message);
          break;
          
        case 'get_visualization_state':
          await this.handleGetVisualizationState(message);
          break;
          
        case 'cancel_workflow':
          await this.handleCancelWorkflow(message);
          break;

        // Human-in-the-loop event handlers
        case 'human_decision_received':
          await this.handleHumanDecisionReceived(message);
          break;

        case 'human_approval_timeout':
          await this.handleHumanApprovalTimeout(message);
          break;

        case 'human_interaction_resumed':
          await this.handleHumanInteractionResumed(message);
          break;
          
        default:
          console.log(`⚠️ Unhandled event type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ Error handling event ${message.type}:`, error);
      
      this.publishEvent('saga_error', {
        error: error instanceof Error ? error.message : String(error),
        originalEvent: message.type,
        workflowId: message.workflowId,
        threadId: message.threadId
      }, 'broadcast');
    }
  }

  private async handleStartVisualizationSaga(message: EventMessage): Promise<void> {
    const { data } = message;
    console.log(`🚀 Starting Visualization SAGA for threadId: ${data.threadId}`);
    
    const workflowRequest: VisualizationWorkflowRequest = {
      threadId: data.threadId,
      userQuery: data.userQuery,
      visualizationRequest: data.visualizationRequest,
      workflowId: data.workflowId || `saga_${Date.now()}`,
      correlationId: data.correlationId || message.messageId
    };

    try {
      // Ensure processor is initialized
      if (!this.isInitialized) {
        await this.visualizationProcessor.initialize();
        this.isInitialized = true;
        this.setupSagaEventForwarding();
      }
      
      const coordinator = this.visualizationProcessor['coordinator']; // Access private coordinator
      const result = await coordinator.executeVisualizationSAGA(workflowRequest);
      
      this.publishEvent('saga_result', {
        result,
        workflowId: workflowRequest.workflowId,
        threadId: workflowRequest.threadId,
        success: result.success,
        processingTime: result.timestamp ? new Date().getTime() - result.timestamp.getTime() : 0
      }, 'broadcast');
      
    } catch (error) {
      this.publishEvent('saga_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: workflowRequest.workflowId,
        threadId: workflowRequest.threadId,
        success: false
      }, 'broadcast');
    }
  }

  private async handleStartGraphRequest(message: EventMessage): Promise<void> {
    const { data } = message;
    console.log(`📊 Routing enhanced start-graph-request from ${message.source} to human-in-loop handler`);
    
    // Validate and parse browser request
    const browserRequest = this.validateAndParseRequest(data);
    
    // Route this message to the enhanced human-in-loop coordinator
    // The actual processing will be handled by HumanInLoopBrowserCoordinator
    this.publishEvent('enhanced_graph_request', {
      browserRequest,
      originalMessage: message,
      routingInfo: {
        source: message.source,
        priority: this.calculatePriority(browserRequest),
        estimatedDuration: this.estimateProcessingTime(browserRequest)
      },
      routedFrom: 'saga-middleware',
      routedAt: new Date()
    }, 'broadcast');
    
    console.log(`✅ Enhanced start-graph-request routed to human-in-loop processor`);
    console.log(`📊 Priority: ${this.calculatePriority(browserRequest)}, Estimated duration: ${this.estimateProcessingTime(browserRequest)}ms`);
  }

  /**
   * Validate and parse incoming browser request
   */
  private validateAndParseRequest(data: any): any {
    console.log(`🔍 Validating browser request data...`);
    
    // Ensure required fields are present
    const userQuery = data.userQuery || data.query || 'Graph visualization request';
    const outputFields = data.outputFields || ['timestamp', 'output', 'type'];
    const graphType = data.chartType || 'line';
    const collection = data.collection || 'supply_analysis';
    
    const validatedRequest = {
      userQuery,
      dataRequirements: {
        dateRange: {
          start: data.filters?.timeRange?.start || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          end: data.filters?.timeRange?.end || new Date().toISOString()
        },
        outputFields,
        graphType,
        aggregation: data.aggregation || 'hourly'
      },
      dataSource: {
        collection,
        database: data.database,
        filters: data.filters || {}
      },
      requestId: data.workflowId || `validated_${Date.now()}`,
      threadId: data.threadId || `thread_${Date.now()}`,
      correlationId: data.correlationId || `corr_${Date.now()}`
    };
    
    console.log(`✅ Browser request validated: ${userQuery.substring(0, 50)}...`);
    return validatedRequest;
  }

  /**
   * Calculate priority based on request characteristics
   */
  private calculatePriority(browserRequest: any): 'low' | 'medium' | 'high' {
    // Simple priority calculation based on data characteristics
    const timeRange = new Date(browserRequest.dataRequirements.dateRange.end).getTime() - 
                     new Date(browserRequest.dataRequirements.dateRange.start).getTime();
    const days = timeRange / (1000 * 60 * 60 * 24);
    
    if (days <= 1) return 'high';      // Real-time or recent data
    if (days <= 7) return 'medium';    // Weekly data
    return 'low';                      // Historical data
  }

  /**
   * Estimate processing time based on request complexity
   */
  private estimateProcessingTime(browserRequest: any): number {
    // Base time for processing
    let estimatedTime = 5000; // 5 seconds base
    
    // Add time based on date range
    const timeRange = new Date(browserRequest.dataRequirements.dateRange.end).getTime() - 
                     new Date(browserRequest.dataRequirements.dateRange.start).getTime();
    const days = timeRange / (1000 * 60 * 60 * 24);
    estimatedTime += days * 1000; // 1 second per day
    
    // Add time based on output fields
    estimatedTime += browserRequest.dataRequirements.outputFields.length * 500; // 0.5s per field
    
    // Add time based on aggregation complexity
    const aggregationMultiplier: Record<string, number> = {
      'hourly': 1.5,
      'daily': 1.0,
      'weekly': 0.8,
      'monthly': 0.5
    };
    estimatedTime *= aggregationMultiplier[browserRequest.dataRequirements.aggregation] || 1.0;
    
    return Math.round(estimatedTime);
  }

  private async handleGetVisualizationState(message: EventMessage): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.visualizationProcessor.initialize();
        this.isInitialized = true;
        this.setupSagaEventForwarding();
      }
      
      const coordinator = this.visualizationProcessor['coordinator'];
      const state = coordinator.getVisualizationSAGAState();
      
      this.publishEvent('visualization_state_response', {
        state,
        workflowId: message.data.workflowId,
        threadId: message.data.threadId,
        requestId: message.messageId
      }, message.source);
    } catch (error) {
      this.publishEvent('saga_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: message.data.workflowId,
        threadId: message.data.threadId,
        requestId: message.messageId
      }, message.source);
    }
  }


  private async handleCancelWorkflow(message: EventMessage): Promise<void> {
    const { workflowId, workflowType } = message.data;
    console.log(`🛑 Canceling workflow: ${workflowId} (${workflowType})`);
    
    // Note: Would need to implement cancellation logic in SagaCoordinator
    this.publishEvent('workflow_cancelled', {
      workflowId,
      workflowType,
      cancelled: true,
      timestamp: new Date()
    }, 'broadcast');
  }

  // Human-in-the-loop event handlers
  private async handleHumanDecisionReceived(message: EventMessage): Promise<void> {
    const { interactionToken, decision, workflowId } = message.data;
    console.log(`🤝 Human decision received: ${decision?.decision} for token ${interactionToken}`);
    
    try {
      if (!this.isInitialized) {
        await this.visualizationProcessor.initialize();
        this.isInitialized = true;
        this.setupSagaEventForwarding();
      }
      
      // Forward decision to coordinator for processing
      const coordinator = this.visualizationProcessor['coordinator'];
      
      // Emit event to resume SAGA processing
      coordinator.emit('human_decision_received', {
        interactionToken,
        decision,
        workflowId,
        timestamp: new Date()
      });

      this.publishEvent('saga_state_update', {
        type: 'human_decision_processed',
        workflowId,
        interactionToken,
        decision: decision?.decision,
        feedback: decision?.feedback
      }, 'broadcast');

    } catch (error) {
      this.publishEvent('saga_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        interactionToken,
        eventType: 'human_decision_processing'
      }, 'broadcast');
    }
  }

  private async handleHumanApprovalTimeout(message: EventMessage): Promise<void> {
    const { interactionToken, workflowId, humanStage, timeoutAt } = message.data;
    console.log(`⏰ Human approval timeout for ${humanStage} (Token: ${interactionToken})`);
    
    try {
      if (!this.isInitialized) {
        await this.visualizationProcessor.initialize();
        this.isInitialized = true;
        this.setupSagaEventForwarding();
      }

      const coordinator = this.visualizationProcessor['coordinator'];
      
      // Emit timeout event to trigger compensation
      coordinator.emit('human_approval_timeout', {
        interactionToken,
        workflowId,
        humanStage,
        timeoutAt
      });

      this.publishEvent('saga_state_update', {
        type: 'human_approval_timeout_processed',
        workflowId,
        interactionToken,
        humanStage,
        timeoutAt
      }, 'broadcast');

    } catch (error) {
      this.publishEvent('saga_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        interactionToken,
        eventType: 'human_timeout_processing'
      }, 'broadcast');
    }
  }

  private async handleHumanInteractionResumed(message: EventMessage): Promise<void> {
    const { workflowId, interactionToken, artifacts } = message.data;
    console.log(`🔄 Human interaction resumed for workflow ${workflowId}`);
    
    try {
      if (!this.isInitialized) {
        await this.visualizationProcessor.initialize();
        this.isInitialized = true;
        this.setupSagaEventForwarding();
      }

      const coordinator = this.visualizationProcessor['coordinator'];
      
      // Resume SAGA processing from where it left off
      coordinator.emit('human_interaction_resumed', {
        workflowId,
        interactionToken,
        artifacts,
        resumedAt: new Date()
      });

      this.publishEvent('saga_state_update', {
        type: 'human_interaction_resumed_processed',
        workflowId,
        interactionToken
      }, 'broadcast');

    } catch (error) {
      this.publishEvent('saga_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        interactionToken,
        eventType: 'human_resume_processing'
      }, 'broadcast');
    }
  }

  private async initializeProcessor(): Promise<void> {
    if (!this.isInitialized) {
      console.log('🔧 Initializing Visualization SAGA Processor...');
      try {
      //  await this.visualizationProcessor.initialize();
        this.isInitialized = true;
        this.setupSagaEventForwarding();
        console.log('✅ Visualization SAGA Processor initialized');
      } catch (error) {
        console.error('❌ Failed to initialize processor:', error);
        throw error;
      }
    }
  }

  private setupSagaEventForwarding(): void {
    if (!this.isInitialized) return;
    
    console.log('🔧 Setting up SAGA event forwarding to Event Bus');
    const coordinator = this.visualizationProcessor['coordinator'];

    // Visualization SAGA events
    coordinator.on('visualization_saga_initialized', (state: VisualizationSAGAState) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_saga_initialized', 
        state,
        threadId: state.requirementsState?.threadId,
        workflowId: state.id
      }, 'broadcast');
    });

    coordinator.on('visualization_transaction_started', (event: any) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_transaction_started', 
        event,
        threadId: event.sagaState?.requirementsState?.threadId,
        workflowId: event.sagaState?.id,
        transactionName: event.name
      }, 'broadcast');
    });

    coordinator.on('visualization_transaction_completed', (event: any) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_transaction_completed', 
        event,
        threadId: event.sagaState?.requirementsState?.threadId,
        workflowId: event.sagaState?.id,
        transactionName: event.name
      }, 'broadcast');
    });

    coordinator.on('visualization_saga_completed', (state: VisualizationSAGAState) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_saga_completed', 
        state,
        threadId: state.requirementsState?.threadId,
        workflowId: state.id,
        finalOutput: state.reportState?.finalOutput
      }, 'broadcast');
    });

    coordinator.on('visualization_saga_failed', (event: any) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_saga_failed', 
        event,
        threadId: event.sagaState?.requirementsState?.threadId,
        workflowId: event.sagaState?.id,
        error: event.error
      }, 'broadcast');
    });

    // Compensation events
    coordinator.on('compensation_executed', (event: any) => {
      this.publishEvent('saga_state_update', {
        type: 'compensation_executed',
        event,
        action: event.action,
        agentName: event.agentName
      }, 'broadcast');
    });
  }

  private publishEvent(type: string, data: any, target?: string): void {
    const message: EventMessage = {
      type,
      source: 'saga-middleware',
      target: target as any,
      data,
      messageId: `saga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      threadId: data.threadId,
      workflowId: data.workflowId,
      correlationId: data.correlationId
    };

    // Check actual socket connection state instead of relying on isConnected flag
    if (this.socket && this.socket.connected) {
      console.log(`📤 Publishing event: ${type} to ${target || 'broadcast'}`);
      this.socket.emit('publish_event', message);
    } else {
      console.log(`📦 Queueing event: ${type} (Event Bus not connected)`);
      this.messageQueue.push(message);
    }
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`📬 Processing ${this.messageQueue.length} queued messages`);
      
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.socket.emit('publish_event', message);
        }
      }
    }
  }

  // Public methods for external control
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down SAGA Event Bus Client...');
    
    this.publishEvent('saga_service_shutdown', {
      serviceName: 'visualization-saga-processor',
      shutdownTime: new Date()
    }, 'broadcast');
    
    // Give time for the shutdown message to be sent
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.socket.disconnect();
    console.log('✅ SAGA Event Bus Client shutdown complete');
  }

  public isEventBusConnected(): boolean {
    return this.isConnected;
  }

  public getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  public getVisualizationProcessor(): VisualizationSAGAProcessor {
    return this.visualizationProcessor;
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeProcessor();
    }
  }
}