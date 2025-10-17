/**
 * Type definitions for Anthropic Coordinator-Subagent Architecture
 */

import { LLMConfig, MCPServerConfig, WorkingMemory } from '../../types/index.js';

// ============================================================================
// SUBAGENT TYPES
// ============================================================================

/**
 * Task specification for a stateless subagent
 */
export interface SubagentTask {
  taskId: string;
  taskType: string; // e.g., 'schema_analysis', 'data_transformation', 'validation'
  description: string;
  input: any; // Task-specific input data
  parameters?: Record<string, any>; // Optional parameters for the task
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    timeout?: number;
    retryCount?: number;
  };
}

/**
 * Result from a stateless subagent execution
 */
export interface SubagentResult {
  taskId: string;
  success: boolean;
  result?: any; // Task-specific result data
  error?: string;
  executionTime: number;
  metadata?: {
    tokensUsed?: number;
    toolCallsMade?: number;
    timestamp: Date;
  };
}

/**
 * Definition for a stateless subagent
 */
export interface SubagentDefinition {
  id: string;
  name: string;
  type: string; // e.g., 'schema_analyzer', 'data_transformer'
  description: string;
  capabilities: string[]; // What this subagent can do
  llmConfig?: LLMConfig;
  mcpServers?: MCPServerConfig[];
  promptTemplate: string; // Base prompt for this subagent
}

// ============================================================================
// COORDINATOR TYPES
// ============================================================================

/**
 * Coordinator context that maintains state across subagent calls
 */
export interface CoordinatorContext {
  coordinatorId: string;
  userQuery: string;
  domain: 'data' | 'coding'; // Domain this coordinator handles

  // Accumulated knowledge
  workingMemory: WorkingMemory;
  discoveredSchema?: any; // Data schema discovered during execution
  dataAnalysis?: any; // Analysis results accumulated

  // Execution tracking
  executedTasks: SubagentTask[];
  taskResults: Map<string, SubagentResult>;

  // Decision state
  nextAction?: 'call_subagent' | 'synthesize' | 'pass_to_next_coordinator' | 'complete';

  metadata: {
    startTime: Date;
    lastUpdateTime: Date;
    iterationCount: number;
  };
}

/**
 * Request to coordinator
 */
export interface CoordinatorRequest {
  userQuery: string;
  context?: Partial<CoordinatorContext>;
  requirements?: Record<string, any>;
}

/**
 * Response from coordinator
 */
export interface CoordinatorResponse {
  success: boolean;
  result?: any; // Final synthesized result
  error?: string;
  context: CoordinatorContext;

  // For passing to next coordinator
  handoffData?: {
    targetCoordinator: string;
    payload: any;
  };
}

/**
 * Configuration for a coordinator
 */
export interface CoordinatorConfig {
  id: string;
  name: string;
  domain: 'data' | 'coding';
  description: string;

  // Available subagents for this coordinator
  availableSubagents: SubagentDefinition[];

  // LLM configuration for coordinator reasoning
  llmConfig: LLMConfig;

  // System prompt for coordinator
  systemPrompt: string;

  // Execution limits
  maxIterations?: number;
  maxSubagentCalls?: number;
}

// ============================================================================
// DATA DOMAIN SPECIFIC TYPES
// ============================================================================

/**
 * Schema analysis result
 */
export interface SchemaAnalysisResult {
  columns: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'unknown';
    nullable: boolean;
    uniqueCount?: number;
    sampleValues?: any[];
  }>;
  rowCount: number;
  filePath: string;
  inferredRelationships?: Array<{
    column: string;
    relationType: 'temporal' | 'categorical_group' | 'numeric_range';
    description: string;
  }>;
}

/**
 * Data transformation specification
 */
export interface DataTransformationSpec {
  sourceFile: string;
  operations: Array<{
    type: 'filter' | 'group' | 'aggregate' | 'normalize' | 'pivot';
    parameters: Record<string, any>;
  }>;
  outputFile: string;
}

/**
 * Data transformation result
 */
export interface DataTransformationResult {
  outputFile: string;
  rowsProcessed: number;
  rowsOutput: number;
  summary: {
    min?: Record<string, number>;
    max?: Record<string, number>;
    mean?: Record<string, number>;
    categories?: Record<string, string[]>;
  };
}

/**
 * Data validation rules
 */
export interface DataValidationRules {
  requiredColumns?: string[];
  columnTypes?: Record<string, string>;
  rangeChecks?: Record<string, { min?: number; max?: number }>;
  customValidations?: Array<{
    rule: string;
    errorMessage: string;
  }>;
}

/**
 * Data validation result
 */
export interface DataValidationResult {
  isValid: boolean;
  errors: Array<{
    type: 'missing_column' | 'type_mismatch' | 'range_violation' | 'custom';
    column?: string;
    message: string;
    affectedRows?: number;
  }>;
  warnings?: Array<{
    type: string;
    message: string;
  }>;
}

/**
 * Data summarization result (iterative, chunk-based)
 */
export interface DataSummarizationResult {
  chunksSummarized: number;
  totalRows: number;
  summary: {
    temporalRange?: { start: string; end: string };
    categories?: string[];
    numericRanges?: Record<string, { min: number; max: number; mean: number }>;
    visualizationRecommendations?: string[];
  };
  detailedAnalysis: string; // Natural language summary for coding agent
}

// ============================================================================
// EXECUTION FLOW TYPES
// ============================================================================

/**
 * Coordinator decision made during execution
 */
export interface CoordinatorDecision {
  action: 'call_subagent' | 'synthesize' | 'retry' | 'pass_to_coordinator' | 'complete';
  reasoning: string; // Why this decision was made
  taskToExecute?: SubagentTask;
  nextCoordinator?: string;
}

/**
 * Full execution trace for debugging
 */
export interface ExecutionTrace {
  coordinatorId: string;
  startTime: Date;
  endTime?: Date;
  decisions: CoordinatorDecision[];
  subagentCalls: Array<{
    task: SubagentTask;
    result: SubagentResult;
    timestamp: Date;
  }>;
  finalResult?: CoordinatorResponse;
}
