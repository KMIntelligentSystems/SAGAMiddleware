// SAGA state management for visualization workflow
export interface VisualizationSAGAState {
  id: string;
  status: 'initializing' | 'gathering_requirements' | 'filtering_data' | 'specifying_chart' | 'generating_report' | 'coding_visualization' | 'completed' | 'failed';
  currentTransaction: number;
  totalTransactions: number;
  
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
  };
  
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

// Transaction definitions for visualization SAGA
export const VISUALIZATION_TRANSACTIONS: VisualizationTransaction[] = [
  // Transaction Set 1: Requirements Gathering SAGA
  {
    id: 'req_init',
    name: 'Initialize Requirements Gathering',
    agentName: 'requirements_initializer', 
    dependencies: [],
    compensationAction: 'cleanup_conversation_state',
    status: 'pending'
  },
  {
    id: 'req_extract',
    name: 'Extract User Requirements',
    agentName: 'conversation_manager',
    dependencies: ['req_init'],
    compensationAction: 'cleanup_thread',
    status: 'pending'
  },
  {
    id: 'req_validate', 
    name: 'Validate Requirements',
    agentName: 'requirements_validator',
    dependencies: ['req_extract'],
    compensationAction: 'reset_requirements_state',
    status: 'pending'
  },
  
  // Transaction Set 2: Data Filtering SAGA  
  {
    id: 'data_query',
    name: 'Query RAG Server',
    agentName: 'data_filtering',
    dependencies: ['req_validate'],
    compensationAction: 'release_data_connections',
    status: 'pending'
  },
  {
    id: 'data_filter',
    name: 'Filter and Process Data', 
    agentName: 'data_filtering',
    dependencies: ['data_query'],
    compensationAction: 'cleanup_filtered_data',
    status: 'pending'
  },
  {
    id: 'chart_spec',
    name: 'Generate Chart Specification',
    agentName: 'chart_specification', 
    dependencies: ['data_filter'],
    compensationAction: 'reset_chart_spec',
    status: 'pending'
  },
  {
    id: 'viz_report',
    name: 'Generate Visualization Report',
    agentName: 'visualization_report',
    dependencies: ['chart_spec'],
    compensationAction: 'cleanup_report_state',
    status: 'pending'
  }
  
  // Transaction Set 3: Coding SAGA (future)
  // {
  //   id: 'code_gen',
  //   name: 'Generate D3 Code',
  //   agentName: 'code_generator',
  //   dependencies: ['viz_report'],
  //   compensationAction: 'cleanup_generated_code',
  //   status: 'pending'
  // }
];

export interface VisualizationWorkflowRequest {
  userQuery?: string;
  threadId?: string;
  visualizationRequest?: any;
  workflowId?: string;
  correlationId?: string;
}