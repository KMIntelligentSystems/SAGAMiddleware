// Human-in-the-Loop SAGA Architecture Types

export interface HumanApprovalStage {
  stage: 'specification_review' | 'code_review' | 'final_approval' | 'requirements_review' | 'data_analysis_review' | 'visualization_review';
  startTime: Date;
  timeoutAt: Date;
  artifacts: ApprovalArtifacts;
  interactionToken: string;
}
export interface ApprovalArtifacts {
  transactionId: string;
  specification?: ChartSpecification;
  generatedCode?: CodeArtifacts;
  finalArtifacts?: FinalDeliverable;
  metadata?: {
    userQuery: string;
    dataSource: string;
    processingTime: number;
    servicesCalled: string[];
  };
}

export interface ChartSpecification {
  chartType: string;
  title: string;
  dataMapping: {
    xAxis: string;
    yAxis: string;
    series?: string[];
  };
  filters: {
    timeRange?: { start: string; end: string };
    energyTypes?: string[];
    suppliers?: string[];
  };
  aggregation: 'raw' | 'hourly' | 'daily' | 'weekly';
  visualizationConfig: any;
}

export interface CodeArtifacts {
  reactComponent: string;
  chartLibrary: 'recharts' | 'd3' | 'plotly';
  dependencies: string[];
  preview?: string; // Base64 image or HTML preview
  testData?: any[];
}

export interface FinalDeliverable {
  specification: ChartSpecification;
  code: CodeArtifacts;
  documentation: string;
  deploymentInstructions: string;
  version: string;
  createdAt: Date;
}

export interface HumanDecision {
  transactionId: string;
  interactionToken: string;
  decision: 'approve' | 'reject' | 'modify';
  feedback?: string;
  modifications?: any;
  decidedAt: Date;
  decidedBy?: string; // User identifier
}

export interface HumanApprovalToken {
  token: string;
  transactionId: string;
  stage: HumanApprovalStage['stage'];
  expiresAt: Date;
  artifacts: ApprovalArtifacts;
  approvalUrl?: string; // URL for human to review
}

export interface SAGAService {
  name: 'requirements-service' | 'data-analysis-service' | 'coding-service' | 'user-interaction-service' | 'persistence-service' | 'browser-request-service';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'awaiting_human' | 'timeout';
  checkpoint?: SAGACheckpoint;
  compensationActions: ServiceCompensationAction[];
  startTime?: Date;
  endTime?: Date;
}

export interface SAGACheckpoint {
  serviceId: string;
  transactionId: string;
  state: any;
  timestamp: Date;
  canResume: boolean;
  version: string;
}

export interface ServiceCompensationAction {
  serviceId: string;
  action: 'cleanup_resources' | 'notify_user' | 'archive_artifacts' | 'release_data' | 'rollback_state';
  executed: boolean;
  timestamp?: Date;
  error?: string;
}

export interface TimeoutStrategy {
  specificationReviewTimeout: number; // milliseconds
  codeReviewTimeout: number;
  finalApprovalTimeout: number;
  maxTransactionLifetime: number;
  
  onTimeout: 'compensate' | 'extend' | 'archive';
  compensationActions: {
    notifyUser: boolean;
    archiveArtifacts: boolean;
    releaseResources: boolean;
    emailNotification?: boolean;
  };
}

export interface HumanInLoopSAGAState {
  // Base SAGA information
  id: string;
  transactionId: string;
  status: 'initializing' | 'specification_pending' | 'requirements_pending' | 'data_analysis_pending' | 
          'code_pending' | 'final_approval_pending' | 'completed' | 'failed' | 'timeout' | 'compensated';
  
  // Temporal tracking
  startTime: Date;
  endTime?: Date;
  humanInteractionStartTime?: Date;
  humanInteractionEndTime?: Date;
  lastActivity: Date;
  
  // Human workflow state
  currentHumanStage?: HumanApprovalStage['stage'];
  humanDecisions: HumanDecision[];
  pendingApproval?: HumanApprovalToken;
  
  // Distributed service coordination
  services: Map<string, SAGAService>;
  pendingServices: string[];
  completedServices: string[];
  failedServices: string[];
  
  // Persistence and recovery
  persistenceKey: string;
  lastCheckpoint: Date;
  checkpoints: SAGACheckpoint[];
  
  // Timeout management
  timeoutStrategy: TimeoutStrategy;
  timeoutScheduled?: Date;
  
  // Artifacts tracking
  artifacts: {
    specification?: ChartSpecification;
    code?: CodeArtifacts;
    final?: FinalDeliverable;
  };
  
  // Error and compensation tracking
  errors: string[];
  compensations: ServiceCompensationAction[];
}

export interface RequirementsArtifact {
  processedQuery: string;
  extractedEntities: any[];
  analysisScope: string;
  validationResults: ValidationResult[];
  refinedRequirements?: string;
}

export interface ValidationResult {
  field: string;
  status: 'valid' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface DataAnalysisArtifact {
  queryPlan: DatabaseQuery;
  dataSchema: DataSchema;
  sampleData: any[];
  dataQualityMetrics: QualityMetrics;
  recommendedVisualization: VisualizationRecommendation;
}

export interface DatabaseQuery {
  collection: string;
  filters: Record<string, any>;
  aggregation: any[];
  projections: string[];
  estimatedResultSize: number;
}

export interface DataSchema {
  fields: FieldDefinition[];
  totalRecords: number;
  dateRange: { min: Date; max: Date };
  uniqueValues: Record<string, any[]>;
}

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  description?: string;
}

export interface QualityMetrics {
  completeness: number; // 0-1
  accuracy: number; // 0-1
  consistency: number; // 0-1
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'missing_data' | 'outlier' | 'inconsistent_format';
  severity: 'low' | 'medium' | 'high';
  affectedRecords: number;
  description: string;
}

export interface VisualizationRecommendation {
  recommendedType: 'line' | 'bar' | 'pie' | 'scatter';
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    type: string;
    confidence: number;
    pros: string[];
    cons: string[];
  }>;
}

export interface EnhancedSAGAState extends HumanInLoopSAGAState {
  // Enhanced artifacts
  artifacts: {
    requirements?: RequirementsArtifact;
    dataAnalysis?: DataAnalysisArtifact;
    code?: CodeArtifacts;
    final?: FinalDeliverable;
  };
  
  // Browser context
  browserContext: {
    originalRequest: any; // BrowserGraphRequest from eventBus types
    refinementCycle: number;
    userFeedback: HumanFeedback[];
  };
}

export interface HumanFeedback {
  stage: 'requirements_review' | 'data_analysis_review' | 'visualization_review' | 'final_approval';
  decision: 'approve' | 'reject' | 'modify' | 'refine';
  feedback: string;
  refinementType?: 'requirements_change' | 'data_scope_change' | 'visualization_change';
  modifications?: any;
  timestamp: Date;
  userId?: string;
}

export interface InteractiveDemo {
  previewUrl: string;
  interactiveControls: ControlDefinition[];
  exportOptions: string[];
  embedCode: string;
}

export interface ControlDefinition {
  type: 'slider' | 'dropdown' | 'checkbox' | 'date-picker';
  name: string;
  label: string;
  options?: any[];
  defaultValue?: any;
}

export interface EnhancedApprovalStage {
  stage: 'requirements_review' | 'data_analysis_review' | 'visualization_review' | 'final_approval';
  artifacts: {
    preview?: string; // Base64 image or live URL
    interactiveDemo?: InteractiveDemo;
    dataQuality?: QualityMetrics;
    recommendations?: string[];
    sampleData?: any[];
  };
  allowedActions: ('approve' | 'reject' | 'modify' | 'refine')[];
}

export interface EnhancedHumanDecision {
  decision: 'approve' | 'reject' | 'modify' | 'refine';
  feedback?: string;
  modifications?: any;
  refinementType?: 'requirements_change' | 'data_scope_change' | 'visualization_change';
  decidedBy?: string;
  decidedAt: Date;
}

export interface HumanApprovedResult {
  success: boolean;
  transactionId: string;
  reason?: string;
  artifacts?: FinalDeliverable;
  processingTime: number;
  humanInteractionTime: number;
  servicesUsed: string[];
  refinementCycles?: number;
}

export interface DistributedSAGAEvent {
  type: 'human_approval_requested' | 'human_decision_received' | 'human_timeout' |
        'human_interaction_resumed' | 'service_checkpoint' | 'service_compensation' |
        'transaction_timeout' | 'transaction_archived';
  
  transactionId: string;
  serviceId?: string;
  humanStage?: HumanApprovalStage['stage'];
  interactionToken?: string;
  
  data: {
    artifacts?: ApprovalArtifacts;
    decision?: HumanDecision;
    checkpoint?: SAGACheckpoint;
    timeout?: { expiresAt: Date; strategy: TimeoutStrategy['onTimeout'] };
    compensation?: ServiceCompensationAction[];
  };
  
  timestamp: Date;
  correlationId?: string;
}

// Configuration for the human-in-the-loop system
export interface HumanInLoopConfig {
  // Timeout configurations (in milliseconds)
  timeouts: TimeoutStrategy;
  
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