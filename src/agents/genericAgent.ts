import { AgentDefinition, AgentResult, LLMConfig, MCPToolCall } from '../types/index.js';
import { mcpClientManager } from '../mcp/mcpClient.js';

export class GenericAgent {
  private availableTools: any[] = [];
  private availableResources: any[] = [];
  
  constructor(private definition: AgentDefinition) {
    this.initializeMCPConnections();
  }

  getName(): string {
    return this.definition.name;
  }

  getDependencies(): string[] {
    return this.definition.dependencies.map(dep => dep.agentName);
  }

  getRequiredDependencies(): string[] {
    return this.definition.dependencies
      .filter(dep => dep.required)
      .map(dep => dep.agentName);
  }

  async execute(contextData: Record<string, any> = {}): Promise<AgentResult> {
    const startTime = new Date();
    
    try {
      // Refresh MCP capabilities if needed
      await this.refreshMCPCapabilities();
      
      const prompt = this.buildPrompt(contextData);
      const llmResult = await this.invokeLLM(prompt);
      
      let result = this.parseOutput(llmResult);
      
      // Process any MCP tool calls in the result
      result = await this.processMCPToolCalls(result);
      
      return {
        agentName: this.definition.name,
        result,
        success: true,
        timestamp: startTime
      };
    } catch (error) {
      return {
        agentName: this.definition.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  private buildPrompt(contextData: Record<string, any>): string {
    const baseContext = { ...this.definition.context, ...contextData };
    
    let prompt = `Task: ${this.definition.task}\n\n`;
    
    if (Object.keys(baseContext).length > 0) {
      prompt += `Context:\n`;
      for (const [key, value] of Object.entries(baseContext)) {
        prompt += `${key}: ${JSON.stringify(value)}\n`;
      }
      prompt += '\n';
    }

    // Add MCP tools information
    if (this.availableTools.length > 0) {
      prompt += `Available Tools:\n`;
      for (const tool of this.availableTools) {
        prompt += `- ${tool.name}: ${tool.description || 'No description'}\n`;
        if (tool.inputSchema) {
          prompt += `  Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}\n`;
        }
      }
      prompt += '\n';
      prompt += `To use a tool, include in your response: {"mcpToolCall": {"name": "toolName", "arguments": {...}}}\n\n`;
    }

    // Add MCP resources information
    if (this.availableResources.length > 0) {
      prompt += `Available Resources:\n`;
      for (const resource of this.availableResources) {
        prompt += `- ${resource.uri}: ${resource.description || 'No description'}\n`;
      }
      prompt += '\n';
    }

    if (this.definition.expectedOutput) {
      prompt += `Expected Output Format:\n${JSON.stringify(this.definition.expectedOutput, null, 2)}\n\n`;
    }

    prompt += `Please complete the task and provide the response in the expected format.`;
    
    return prompt;
  }

  private async invokeLLM(prompt: string): Promise<string> {
    const config = this.definition.llmConfig;
    
    switch (config.provider) {
      case 'openai':
        return await this.invokeOpenAI(prompt, config);
      case 'anthropic':
        return await this.invokeAnthropic(prompt, config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  private async invokeOpenAI(prompt: string, config: LLMConfig): Promise<string> {
    const { ChatOpenAI } = await import('@langchain/openai');
     console.log("key",config.apiKey )
    const llm = new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await llm.invoke(prompt);
    return response.content as string;
  }

  private async invokeAnthropic(prompt: string, config: LLMConfig): Promise<string> {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const llm = new ChatAnthropic({
      model: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      apiKey: config.apiKey
    });

    const response = await llm.invoke(prompt);
    return response.content as string;
  }

  

  private parseOutput(llmResponse: string): any {
    try {
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      const codeBlockMatch = llmResponse.match(/```\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      return JSON.parse(llmResponse);
    } catch {
      return { raw: llmResponse };
    }
  }

  // MCP-related methods
  private async initializeMCPConnections(): Promise<void> {
    if (!this.definition.mcpServers) {
      return;
    }

    for (const serverConfig of this.definition.mcpServers) {
      try {
        if (!mcpClientManager.isConnected(serverConfig.name)) {
          await mcpClientManager.connect(serverConfig);
        }
      } catch (error) {
        console.error(`Failed to connect to MCP server ${serverConfig.name}:`, error);
      }
    }

    await this.refreshMCPCapabilities();
  }

  private async refreshMCPCapabilities(): Promise<void> {
    if (!this.definition.mcpServers) {
      return;
    }

    try {
      // Get available tools
      this.availableTools = await mcpClientManager.listTools();
      
      // Filter tools if specific tools are requested
      if (this.definition.mcpTools && this.definition.mcpTools.length > 0) {
        this.availableTools = this.availableTools.filter(tool => 
          this.definition.mcpTools!.includes(tool.name)
        );
      }

      // Get available resources
      this.availableResources = await mcpClientManager.listResources();
      
      // Filter resources if specific resources are requested
      if (this.definition.mcpResources && this.definition.mcpResources.length > 0) {
        this.availableResources = this.availableResources.filter(resource => 
          this.definition.mcpResources!.includes(resource.uri)
        );
      }
    } catch (error) {
      console.error('Failed to refresh MCP capabilities:', error);
    }
  }

  private async processMCPToolCalls(result: any): Promise<any> {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Check if result contains MCP tool calls
    if (result.mcpToolCall) {
      try {
        const toolCall: MCPToolCall = result.mcpToolCall;
        const toolResult = await this.executeMCPTool(toolCall);
        
        return {
          ...result,
          mcpToolResult: toolResult,
          mcpToolCallSuccess: true
        };
      } catch (error) {
        return {
          ...result,
          mcpToolError: error instanceof Error ? error.message : String(error),
          mcpToolCallSuccess: false
        };
      }
    }

    // Check for multiple tool calls
    if (result.mcpToolCalls && Array.isArray(result.mcpToolCalls)) {
      const toolResults = [];
      const errors = [];
      
      for (const toolCall of result.mcpToolCalls) {
        try {
          const toolResult = await this.executeMCPTool(toolCall);
          toolResults.push({ call: toolCall, result: toolResult, success: true });
        } catch (error) {
          errors.push({ call: toolCall, error: error instanceof Error ? error.message : String(error), success: false });
        }
      }
      
      return {
        ...result,
        mcpToolResults: toolResults,
        mcpToolErrors: errors
      };
    }

    return result;
  }

  private async executeMCPTool(toolCall: MCPToolCall): Promise<any> {
    // Find which server has this tool
    const connectedServers = mcpClientManager.getConnectedServers();
    
    for (const serverName of connectedServers) {
      try {
        const tools = await mcpClientManager.listTools(serverName);
        const tool = tools.find(t => t.name === toolCall.name);
        
        if (tool) {
          return await mcpClientManager.callTool(serverName, toolCall);
        }
      } catch (error) {
        // Tool not found on this server, continue searching
        continue;
      }
    }
    
    throw new Error(`MCP tool '${toolCall.name}' not found on any connected server`);
  }

  // Public methods for MCP capabilities
  getAvailableTools(): any[] {
    return [...this.availableTools];
  }

  getAvailableResources(): any[] {
    return [...this.availableResources];
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const toolCall: MCPToolCall = {
      name: toolName,
      arguments: args
    };
    
    return await this.executeMCPTool(toolCall);
  }
}