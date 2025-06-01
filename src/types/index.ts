export interface AgentDependency {
  agentName: string;
  required: boolean;
}

export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[];
  transport: 'stdio' | 'http';
  url?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface AgentDefinition {
  name: string;
  llmConfig: LLMConfig;
  expectedOutput: any;
  context: Record<string, any>;
  dependencies: AgentDependency[];
  task: string;
  mcpServers?: MCPServerConfig[];
  mcpTools?: string[];
  mcpResources?: string[];
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama';
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface SagaEvent {
  id: string;
  type: 'agent_start' | 'agent_complete' | 'agent_error' | 'transaction_start' | 'transaction_commit' | 'transaction_rollback';
  agentName?: string;
  data?: any;
  timestamp: Date;
  correlationId: string;
}

export interface WorkingMemory {
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface Transaction {
  id: string;
  agentName: string;
  operations: CompensableOperation[];
  status: 'pending' | 'committed' | 'rolled_back';
}

export interface CompensableOperation {
  id: string;
  execute: () => Promise<any>;
  compensate: () => Promise<void>;
}

export interface AgentResult {
  agentName: string;
  result: any;
  success: boolean;
  error?: string;
  timestamp: Date;
}

// Add a dummy export to ensure JS file is generated
export const TYPES_VERSION = '1.0.0';