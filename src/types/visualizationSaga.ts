// SAGA state management for visualization workflow
import { HumanInLoopSAGAState, HumanApprovalStage, HumanDecision } from './humanInLoopSaga.js';

export interface VisualizationSAGAState {
  id: string;
  status: 'initializing' | 'gathering_requirements' | 'filtering_data' | 'specifying_chart' | 'generating_report' | 'coding_visualization' | 'awaiting_human_approval' | 'completed' | 'failed';
  currentTransaction: number;
  totalTransactions: number;
  
  // Human-in-the-loop extensions
  /*humanInLoop?: {
    enabled: boolean;
    currentStage?: HumanApprovalStage['stage'];
    pendingApproval?: HumanApprovalStage;
    decisions: HumanDecision[];
    totalHumanTime?: number; // milliseconds spent in human interaction
  };
  
  // Requirements gathering state
  requirementsState: {
    threadId?: string;
    conversationComplete: boolean;
    requirementsExtracted: boolean;
    validationComplete: boolean;
    extractedRequirements?: any;
  };
  
  // Data filtering state  
  dataFilteringState: {
    queryStarted: boolean;
    queryComplete: boolean;
    filteringComplete: boolean;
    dataValidated: boolean;
    filteredData?: any;
    metadata?: any;
  };
  
  // Chart specification state
  chartSpecState: {
    analysisComplete: boolean;
    specificationGenerated: boolean;
    specificationValidated: boolean;
    chartSpec?: any;
  };
  
  // Visualization report state
  reportState: {
    narrativeGenerated: boolean;
    dataEnhanced: boolean;
    outputValidated: boolean;
    finalOutput?: any;
  };*/
  
  errors: string[];
  startTime: Date;
  endTime?: Date;
  compensations: CompensationAction[];
}

export interface CompensationAction {
  transactionId: string;
  agentName: string;
  action: 'cleanup_thread' | 'release_data' | 'reset_state' | 'notify_failure';
  executed: boolean;
  timestamp: Date;
}

export interface VisualizationTransaction {
  id: string;
  name: string;
  agentName: string;
  dependencies: string[];
  compensationAgent?: string;
  compensationAction?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensated';
}

// Configuration for the human-in-the-loop system
export interface HumanInLoopConfig {
  // Timeout configurations (in milliseconds)
  //timeouts: TimeoutStrategy;
  
  // Service endpoints
  services: {
    ragService: string;
    codingService: string;
    humanInterface: string;
    persistence: string;
  };
  
  // Event bus configuration
  eventBus: {
    url: string;
    topics: string[];
    retryAttempts: number;
  };
  
  // Human interface configuration
  humanInterface: {
    approvalBaseUrl: string;
    emailNotifications: boolean;
    slackNotifications?: boolean;
    webhookUrl?: string;
  };
  
  // Persistence configuration
  persistence: {
    provider: 'database' | 'file' | 'redis';
    connectionString?: string;
    retentionDays: number;
    backupEnabled: boolean;
  };
}

// Transaction definitions for visualization SAGA
export const VISUALIZATION_TRANSACTIONS: VisualizationTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-1',
    name: 'Start Conversation',
    agentName: 'ConversationAgent',
    dependencies: ['tx-2'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'tx-2',
    name: 'Index files',
    agentName: 'DataProcessingAgent',
     dependencies: ['tx-3'],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'tx-3',
    name: 'Apply RAG Tool',
    agentName: 'DataFilteringAgent',
    dependencies: [],
    compensationAction: 'cleanup_thread',
    status: 'pending'
  }
];

export interface VisualizationWorkflowRequest {
  userQuery?: string;
  threadId?: string;
  visualizationRequest?: any;
  workflowId?: string;
  correlationId?: string;
}