export { SagaCoordinator } from './coordinator/sagaCoordinator.js';
export { GenericAgent } from './agents/genericAgent.js';
export { ContextManager } from './sublayers/contextManager.js';
export { ValidationManager, SchemaValidator } from './sublayers/validationManager.js';
export { TransactionManager } from './sublayers/transactionManager.js';
export { MCPClientManagerImpl, mcpClientManager } from './mcp/mcpClient.js';
export * from './types/index.js';

// Visualization workflow exports

export { 
  ConversationManager 
} from './services/conversationManager.js';



export * from './types/visualization.js';
export * from './types/visualizationSaga.js';

import { SagaCoordinator } from './coordinator/sagaCoordinator.js';
import { AgentDefinition, MCPServerConfig } from './types/index.js';
import { mcpClientManager } from './mcp/mcpClient.js';


export function createAgentDefinition(config: {
  name: string;
  task: string;
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama';
  model: string;
  apiKey: string;
  agentType: 'tool' | 'processing';
  expectedOutput?: string;
  context?: Record<string, any>;
  dependencies?: Array<{ agentName: string; required?: boolean }>;
  temperature?: number;
  maxTokens?: number;
  mcpServers?: MCPServerConfig[];
  mcpTools?: string[];
  mcpResources?: string[];
}): AgentDefinition {
  console.log("DEF  ", config.apiKey)
  return {
    id: config.name,
    name: config.name,
    taskDescription: config.task,
    agentType: config.agentType,
    llmConfig: {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKey: config.apiKey,
    },
    backstory: '',
    taskExpectedOutput: '', //config.expectedOutput,
    context: config.context || {},
    dependencies: (config.dependencies || []).map(dep => ({
      agentName: dep.agentName,
      required: dep.required !== false
    })),
    mcpServers: config.mcpServers,
    mcpTools: config.mcpTools,
    mcpResources: config.mcpResources
  };
}

// MCP utility functions
export function createMCPServerConfig(config: {
  name: string;
  command?: string;
  args?: string[];
  transport: 'stdio' | 'http' | 'sse';
  url?: string;
  env?: Record<string, string>;
  timeout?: number;
}): MCPServerConfig {
  return {
    name: config.name,
    command: config.command,
    args: config.args,
    transport: config.transport,
    url: config.url,
    env: config.env,
    timeout: config.timeout
  };
}

export async function connectToMCPServer(serverConfig: MCPServerConfig): Promise<void> {
  // Check if already connected before attempting to connect
  if (mcpClientManager.isConnected(serverConfig.name)) {
    console.log(`MCP server ${serverConfig.name} is already connected, skipping connection`);
    return;
  }
  return await mcpClientManager.connect(serverConfig);
}

export async function disconnectFromMCPServer(serverName: string): Promise<void> {
  return await mcpClientManager.disconnect(serverName);
}

export function getConnectedMCPServers(): string[] {
  return mcpClientManager.getConnectedServers();
}

export async function listMCPTools(serverName?: string): Promise<any[]> {
  return await mcpClientManager.listTools(serverName);
}

export async function listMCPResources(serverName?: string): Promise<any[]> {
  return await mcpClientManager.listResources(serverName);
}