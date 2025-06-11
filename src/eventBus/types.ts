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
  | 'start-graph-request'
  | 'get_visualization_state'
  | 'cancel_workflow'
  | 'saga_state_update'
  | 'saga_result'
  | 'saga_error'
  | 'visualization_state_response'
  | 'workflow_cancelled'
  | 'saga_service_shutdown'
  // Human-in-the-loop events
  | 'human_approval_requested'
  | 'human_decision_received'
  | 'human_approval_timeout'
  | 'human_interaction_resumed'
  | 'service_checkpoint'
  | 'service_compensation'
  | 'transaction_timeout'
  | 'transaction_archived';

export interface SAGAEventData {
  threadId?: string;
  workflowId?: string;
  userQuery?: string;
  visualizationRequest?: any;
  state?: any;
  result?: any;
  error?: string;
  success?: boolean;
  correlationId?: string;
  processingTime?: number;
  
  // Human-in-the-loop data
  interactionToken?: string;
  humanStage?: 'specification_review' | 'code_review' | 'final_approval';
  approvalUrl?: string;
  artifacts?: any;
  decision?: {
    decision: 'approve' | 'reject' | 'modify';
    feedback?: string;
    modifications?: any;
    decidedBy?: string;
  };
  timeoutAt?: Date;
  serviceId?: string;
  checkpoint?: any;
  compensation?: any[];
}