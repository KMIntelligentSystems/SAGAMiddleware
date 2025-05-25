export { SagaCoordinator } from './coordinator/sagaCoordinator';
export { GenericAgent } from './agents/genericAgent';
export { ContextManager } from './sublayers/contextManager';
export { ValidationManager, SchemaValidator } from './sublayers/validationManager';
export { TransactionManager } from './sublayers/transactionManager';
export * from './types';

import { SagaCoordinator } from './coordinator/sagaCoordinator';
import { AgentDefinition } from './types';

export function createSagaMiddleware(): SagaCoordinator {
  return new SagaCoordinator();
}

export function createAgentDefinition(config: {
  name: string;
  task: string;
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama';
  model: string;
  expectedOutput?: any;
  context?: Record<string, any>;
  dependencies?: Array<{ agentName: string; required?: boolean }>;
  temperature?: number;
  maxTokens?: number;
}): AgentDefinition {
  return {
    name: config.name,
    task: config.task,
    llmConfig: {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    },
    expectedOutput: config.expectedOutput,
    context: config.context || {},
    dependencies: (config.dependencies || []).map(dep => ({
      agentName: dep.agentName,
      required: dep.required !== false
    }))
  };
}