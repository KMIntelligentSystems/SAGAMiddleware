// Type definitions for Event Bus integration

export interface EventMessage {
  type: string;
  source: 'react-app' | 'express-server' | 'saga-middleware';
  target?: 'react-app' | 'express-server' | 'saga-middleware' | 'broadcast';
  data: any;
  messageId: string;
  timestamp: Date;
  threadId?: string;
  workflowId?: string;
  correlationId?: string;
}

export interface ServiceRegistration {
  serviceType: 'react-app' | 'express-server' | 'saga-middleware';
  serviceName: string;
  version?: string;
  capabilities?: string[];
}

export interface EventBusConfig {
  url: string;
  serviceName: string;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionAttempts?: number;
  timeout?: number;
}

// Event type definitions for better type safety
export type SAGAEventType = 
  | 'start_visualization_saga'
  | 'get_visualization_state'
  | 'start_chunk_processing'
  | 'get_chunk_workflow_state'
  | 'cancel_workflow'
  | 'saga_state_update'
  | 'saga_result'
  | 'saga_error'
  | 'visualization_state_response'
  | 'chunk_processing_result'
  | 'chunk_workflow_state_response'
  | 'workflow_cancelled'
  | 'saga_service_shutdown';

export interface SAGAEventData {
  threadId?: string;
  workflowId?: string;
  userQuery?: string;
  visualizationRequest?: any;
  collection?: string;
  initialChunkLimit?: number;
  state?: any;
  result?: any;
  error?: string;
  success?: boolean;
}