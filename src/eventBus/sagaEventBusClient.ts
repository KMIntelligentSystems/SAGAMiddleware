import { io as SocketIOClient } from 'socket.io-client';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { VisualizationWorkflowRequest, VisualizationSAGAState } from '../types/visualizationSaga.js';
import { EventMessage, ServiceRegistration, SAGAEventType, SAGAEventData } from './types.js';

export class SAGAEventBusClient {
  private socket: any;
  private sagaCoordinator: SagaCoordinator;
  private isConnected: boolean = false;
  private messageQueue: EventMessage[] = [];
  private eventBusUrl: string;

  constructor(eventBusUrl: string = 'http://localhost:3003') {
    this.eventBusUrl = eventBusUrl;
    this.sagaCoordinator = new SagaCoordinator();
    this.initializeConnection();
    this.setupSagaEventForwarding();
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
        serviceName: 'visualization-saga-coordinator',
        version: '1.0.0',
        capabilities: [
          'executeVisualizationSAGA',
          'getVisualizationState', 
          'getChunkWorkflowState',
          'executeChunkProcessing'
        ]
      };
      this.socket.emit('register_service', registration);

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
          
        case 'get_visualization_state':
          await this.handleGetVisualizationState(message);
          break;
          
        case 'start_chunk_processing':
          await this.handleStartChunkProcessing(message);
          break;
          
        case 'get_chunk_workflow_state':
          await this.handleGetChunkWorkflowState(message);
          break;
          
        case 'cancel_workflow':
          await this.handleCancelWorkflow(message);
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
      const result = await this.sagaCoordinator.executeVisualizationSAGA(workflowRequest);
      
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

  private async handleGetVisualizationState(message: EventMessage): Promise<void> {
    const state = this.sagaCoordinator.getVisualizationSAGAState();
    
    this.publishEvent('visualization_state_response', {
      state,
      workflowId: message.data.workflowId,
      threadId: message.data.threadId,
      requestId: message.messageId
    }, message.source);
  }

  private async handleStartChunkProcessing(message: EventMessage): Promise<void> {
    const { collection, initialChunkLimit, workflowId } = message.data;
    console.log(`🔄 Starting Chunk Processing for collection: ${collection}`);
    
    try {
      const result = await this.sagaCoordinator.executeChunkProcessingWorkflow(
        collection, 
        initialChunkLimit, 
        workflowId
      );
      
      this.publishEvent('chunk_processing_result', {
        result,
        workflowId,
        collection,
        success: result.success
      }, 'broadcast');
      
    } catch (error) {
      this.publishEvent('chunk_processing_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        collection,
        success: false
      }, 'broadcast');
    }
  }

  private async handleGetChunkWorkflowState(message: EventMessage): Promise<void> {
    const state = this.sagaCoordinator.getChunkWorkflowState();
    const accumulatedData = this.sagaCoordinator.getAccumulatedData();
    
    this.publishEvent('chunk_workflow_state_response', {
      workflowState: state,
      accumulatedData,
      workflowId: message.data.workflowId,
      requestId: message.messageId
    }, message.source);
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

  private setupSagaEventForwarding(): void {
    console.log('🔧 Setting up SAGA event forwarding to Event Bus');

    // Visualization SAGA events
    this.sagaCoordinator.on('visualization_saga_initialized', (state: VisualizationSAGAState) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_saga_initialized', 
        state,
        threadId: state.requirementsState?.threadId,
        workflowId: state.id
      }, 'broadcast');
    });

    this.sagaCoordinator.on('visualization_transaction_started', (event: any) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_transaction_started', 
        event,
        threadId: event.sagaState?.requirementsState?.threadId,
        workflowId: event.sagaState?.id,
        transactionName: event.name
      }, 'broadcast');
    });

    this.sagaCoordinator.on('visualization_transaction_completed', (event: any) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_transaction_completed', 
        event,
        threadId: event.sagaState?.requirementsState?.threadId,
        workflowId: event.sagaState?.id,
        transactionName: event.name
      }, 'broadcast');
    });

    this.sagaCoordinator.on('visualization_saga_completed', (state: VisualizationSAGAState) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_saga_completed', 
        state,
        threadId: state.requirementsState?.threadId,
        workflowId: state.id,
        finalOutput: state.reportState?.finalOutput
      }, 'broadcast');
    });

    this.sagaCoordinator.on('visualization_saga_failed', (event: any) => {
      this.publishEvent('saga_state_update', { 
        type: 'visualization_saga_failed', 
        event,
        threadId: event.sagaState?.requirementsState?.threadId,
        workflowId: event.sagaState?.id,
        error: event.error
      }, 'broadcast');
    });

    // Chunk processing events
    this.sagaCoordinator.on('workflow_status_changed', (state: any) => {
      this.publishEvent('saga_state_update', {
        type: 'chunk_workflow_status_changed',
        state,
        workflowId: state.id,
        status: state.status
      }, 'broadcast');
    });

    this.sagaCoordinator.on('data_accumulated', (event: any) => {
      this.publishEvent('saga_state_update', {
        type: 'chunk_data_accumulated',
        event,
        chunkId: event.chunkId,
        totalProcessed: event.totalProcessed
      }, 'broadcast');
    });

    this.sagaCoordinator.on('processing_decision', (event: any) => {
      this.publishEvent('saga_state_update', {
        type: 'chunk_processing_decision',
        event,
        decision: event.decision,
        reason: event.reason
      }, 'broadcast');
    });

    // Compensation events
    this.sagaCoordinator.on('compensation_executed', (event: any) => {
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

    if (this.isConnected) {
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
      serviceName: 'visualization-saga-coordinator',
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

  public getSagaCoordinator(): SagaCoordinator {
    return this.sagaCoordinator;
  }
}