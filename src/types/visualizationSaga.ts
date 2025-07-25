// SAGA state management for visualization workflow
import { HumanInLoopSAGAState, HumanApprovalStage, HumanDecision } from './humanInLoopSaga.js';

export interface SagaState {
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

export interface SagaTransaction {
  id: string;
  name: string;
  agentName: string;
  dependencies: string[];
  compensationAgent?: string;
  compensationAction?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensated';
  iterationGroup?: string; // For grouping transactions that iterate together
  iterationRole?: 'coordinator' | 'fetcher' | 'processor' | 'saver' | 'generator' | 'reflector'; // Role in iteration cycle
}

// New interfaces for iteration management
export interface IterationState {
  transactionGroupId: string;
  currentIteration: number;
  chunkIds: string[];
  currentChunkIndex: number;
  currentChunkId?: string;
  maxIterations?: number;
  iterationResults: any[];
  finalizationCondition?: string; // Function name or condition
  metadata: {
    collectionName?: string;
    totalChunks?: number;
    processedChunks: number;
    startTime: Date;
    lastIterationTime?: Date;
  };
}

export interface IterationConfig {
  groupId: string;
  maxIterations?: number;
  chunkBatchSize?: number;
  finalizationCondition?: (state: IterationState) => boolean;
  onIterationComplete?: (iteration: number, result: any) => void;
  onGroupComplete?: (state: IterationState) => void;
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
export const SAGA_TRANSACTIONS: SagaTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'tx-1',
    name: 'Start Conversation',
    agentName: 'ConversationAgent',
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'tx-2',
    name: 'Index files',
    agentName: 'DataProcessingAgent',
     dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
 /* {
    id: 'tx-3',
    name: 'Apply RAG Tool',
    agentName: 'DataFilteringAgent',
    dependencies: [],
    compensationAction: 'cleanup_thread',
    status: 'pending'
  },
  {
    id: 'tx-4-1',
    name: 'Data Generator',
    agentName: 'DataStructuringAgent',
    dependencies: ['tx-4-2'], //['tx-3', 'tx-4-2']
    compensationAction: 'cleanup_thread',
    status: 'pending'
  },
  {
    id: 'tx-4-2',
    name: 'Data Reflector',
    agentName: 'DataReflectingAgent',
    dependencies: ['tx-4-1'], // Circular dependency with tx-4-1
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },*/
  {
    id: 'tx-3',
    name: 'Apply RAG Tool',
    agentName: 'DataFilteringAgent',
    dependencies: ['tx-4-1'], // First in chain - no dependencies
    compensationAction: 'cleanup_thread',
    status: 'pending'
  },
 /* {
    id: 'tx-4',
    name: 'Data presenter',
    agentName: 'DataPresentingAgent',
    dependencies: ['tx-3'], // Depends on DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },*/
  {
    id: 'tx-4-1',
    name: 'Data Extractor',
    agentName: 'DataExtractingAgent',
    dependencies: ['tx-4-2'], // Depends on DataPresentingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-2',
    name: 'Data Normalizer',
    agentName:  'DataNormalizingAgent',
    dependencies: ['tx-4-3'], // Depends on DataExtractingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-3',
    name: 'Data Grouper',
    agentName:  'DataGroupingAgent',
    dependencies: ['tx-4-4'], // Depends on DataNormalizingAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
   {
    id: 'tx-4-4',
    name: 'Data Finalizer',
    agentName:  'DataAggregatingAgent',
    dependencies: ['tx-3'], // Depends on DataGroupingAgent and cycles back to DataFilteringAgent
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  }
];


export interface SagaWorkflowRequest {
  userQuery?: string;
  threadId?: string;
  visualizationRequest?: any;
  workflowId?: string;
  correlationId?: string;
}