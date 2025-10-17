/**
 * Base class for stateless subagents in Anthropic architecture
 * Subagents receive a task, execute it, and return a result without maintaining context
 */

import Anthropic from '@anthropic-ai/sdk';
import { SubagentTask, SubagentResult, SubagentDefinition } from '../types/index.js';
import { LLMConfig, MCPServerConfig, MCPToolCall } from '../../types/index.js';
import { mcpClientManager } from '../../mcp/mcpClient.js';

export abstract class BaseSubagent {
  protected definition: SubagentDefinition;
  protected anthropicClient?: Anthropic;
  protected llmConfig: LLMConfig;

  constructor(definition: SubagentDefinition) {
    this.definition = definition;
    this.llmConfig = definition.llmConfig || {
      provider: 'anthropic',
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0.3,
      maxTokens: 4000
    };

    // Initialize Anthropic client if provider is anthropic
    if (this.llmConfig.provider === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  }

  /**
   * Execute a task - implemented by specific subagent types
   */
  abstract executeTask(task: SubagentTask): Promise<SubagentResult>;

  /**
   * Get the system prompt for this subagent
   */
  protected getSystemPrompt(): string {
    return this.definition.promptTemplate;
  }

  /**
   * Format task input into a user message
   */
  protected formatTaskInput(task: SubagentTask): string {
    return `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nParameters:\n${JSON.stringify(task.parameters || {}, null, 2)}`;
  }

  /**
   * Call LLM with task
   */
  protected async callLLM(
    userMessage: string,
    systemPrompt?: string,
    tools?: any[]
  ): Promise<{ content: string; toolCalls?: any[] }> {
    const startTime = Date.now();

    if (this.llmConfig.provider === 'anthropic' && this.anthropicClient) {
      const response = await this.anthropicClient.messages.create({
        model: this.llmConfig.model,
        max_tokens: this.llmConfig.maxTokens || 4000,
        temperature: this.llmConfig.temperature || 0.3,
        system: systemPrompt || this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ],
        ...(tools && tools.length > 0 ? { tools } : {})
      });

      // Extract text content and tool calls
      const textContent = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      const toolCalls = response.content
        .filter((block: any) => block.type === 'tool_use')
        .map((block: any) => ({
          id: block.id,
          name: block.name,
          input: block.input
        }));

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    }

    // Fallback for other providers (OpenAI, etc.)
    throw new Error(`Provider ${this.llmConfig.provider} not yet implemented for subagents`);
  }

  /**
   * Execute MCP tool call
   */
  protected async executeMCPTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    try {
      const toolCall: MCPToolCall = {
        name: toolName,
        arguments: args
      };
      const result = await mcpClientManager.callTool(serverName, toolCall);
      return result;
    } catch (error) {
      console.error(`Error executing MCP tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Create a successful result
   */
  protected createSuccessResult(
    taskId: string,
    result: any,
    executionTime: number,
    metadata?: any
  ): SubagentResult {
    return {
      taskId,
      success: true,
      result,
      executionTime,
      metadata: {
        ...metadata,
        timestamp: new Date()
      }
    };
  }

  /**
   * Create a failure result
   */
  protected createFailureResult(
    taskId: string,
    error: string,
    executionTime: number
  ): SubagentResult {
    return {
      taskId,
      success: false,
      error,
      executionTime,
      metadata: {
        timestamp: new Date()
      }
    };
  }

  /**
   * Get subagent info
   */
  getDefinition(): SubagentDefinition {
    return this.definition;
  }
}
