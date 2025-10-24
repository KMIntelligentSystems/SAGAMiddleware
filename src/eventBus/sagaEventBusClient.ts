import { io as SocketIOClient } from 'socket.io-client';
import { SagaWorkflowRequest, SagaState } from '../types/visualizationSaga.js';
import { EventMessage, ServiceRegistration, SAGAEventType, SAGAEventData } from './types.js';

export class SAGAEventBusClient {
  private socket: any;
  //private visualizationProcessor: VisualizationSAGAProcessor;
  private isConnected: boolean = false;
  private messageQueue: EventMessage[] = [];
  private eventBusUrl: string;
  private isInitialized: boolean = false;

  constructor(eventBusUrl: string = 'http://localhost:3003') {
    this.eventBusUrl = eventBusUrl;
  //  this.visualizationProcessor = new VisualizationSAGAProcessor();
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
          'executeSagaWorkflow',
          'getSagaState',
          'executeSimpleSagaWorkflow',
          'executeComplexSagaWorkflow',
          'executeConversationBasedSagaWorkflow',
          'executeBatchProcessingSagaWorkflow'
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
      this.isConnected = true;

      // Process any messages that were queued during disconnection
      this.processMessageQueue();
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

    // Listen for console output requests from browser/client
    this.socket.on('request_console_output', () => {
      this.publishEvent('console_output', {
        message: 'SAGA Middleware is connected and ready',
        timestamp: new Date(),
        connectionState: {
          isConnected: this.isConnected,
          socketConnected: this.socket?.connected || false,
          queueSize: this.messageQueue.length
        }
      }, 'react-app');
    });
  }

  private async handleIncomingEvent(message: EventMessage): Promise<void> {
    try {
      switch (message.type) {
       
        case 'start-graph-request':
          await this.handleStartGraphRequest(message);
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

 

  private async handleStartGraphRequest(message: EventMessage): Promise<void> {
    const { data } = message
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

 
  
  
  private publishEvent(type: string, data: any, target?: string): void {
    const message: EventMessage = {
      type,
      source: 'saga-middleware',
      target: target as any,
      data,
      messageId: `saga_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      threadId: data.threadId,
      workflowId: data.workflowId,
      correlationId: data.correlationId
    };

    // Check actual socket connection state instead of relying on isConnected flag
    if (this.socket && this.socket.connected) {
      console.log(`📤 Publishing event: ${type} to ${target || 'broadcast'}`);
      console.log(`   Connection state - isConnected: ${this.isConnected}, socket.connected: ${this.socket.connected}`);
      this.socket.emit('publish_event', message);
    } else {
      console.log(`📦 Queueing event: ${type} (Event Bus not connected)`);
      console.log(`   Connection state - isConnected: ${this.isConnected}, socket.connected: ${this.socket?.connected || false}`);
      console.log(`   Queue size: ${this.messageQueue.length + 1} messages`);
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

  /**
   * Broadcast a console log message to connected clients (for browser visibility)
   */
  public broadcastConsoleLog(level: 'log' | 'error' | 'warn' | 'info', message: string, data?: any): void {
    this.publishEvent('console_log', {
      level,
      message,
      data,
      timestamp: new Date()
    }, 'broadcast');
  }

  /**
   * Get diagnostic information about the connection state
   */
  public getDiagnostics(): any {
    return {
      isConnected: this.isConnected,
      socketConnected: this.socket?.connected || false,
      socketId: this.socket?.id || null,
      queuedMessages: this.messageQueue.length,
      eventBusUrl: this.eventBusUrl,
      timestamp: new Date()
    };
  }

}