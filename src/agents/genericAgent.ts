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
      
      const result = llmResult;
      
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

    // Note: MCP tools are provided directly to the LLM via native tool calling
    // No need to include tool descriptions in prompt as they're handled by the LLM provider

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
    const { OpenAI } = await import('openai');
    console.log("key", config.apiKey);
    
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // If MCP tools are available, use native tool calling with MCP integration
    if (this.availableTools.length > 0) {
      const tools = this.availableTools.map(tool => {
        // Fix schema for index_file tool to use correct parameter names
        if (tool.name === 'index_file') {
          return {
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description || 'Add or update a file in the vector store',
              parameters: {
                type: "object",
                properties: {
                  filePath: { 
                    type: "string", 
                    description: "Path to document to be embedded" 
                  },
                  collection: { 
                    type: "string", 
                    description: "Collection name" 
                  },
                  metadata: { 
                    type: "object", 
                    description: "Document metadata" 
                  },
                  id: { 
                    type: "string", 
                    description: "Document ID (optional)" 
                  }
                },
                required: ["filePath", "collection"]
              }
            }
          };
        }
        
        return {
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description || `Execute ${tool.name} tool`,
            parameters: tool.inputSchema || {
              type: "object",
              properties: {},
              required: []
            }
          }
        };
      });
      
   //   console.log('Tools being sent to OpenAI:', JSON.stringify(tools, null, 2));
      
      return await this.handleLLMWithMCPTools(client, prompt, config, tools, 'openai');
    }

    // No tools available, use regular completion
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000
    });

    return response.choices[0].message.content || "";
  }

  private async invokeAnthropic(prompt: string, config: LLMConfig): Promise<string> {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    
    const client = new Anthropic({
      apiKey: config.apiKey
    });

    // If MCP tools are available, use native tool calling with MCP integration
    if (this.availableTools.length > 0) {
      const tools = this.availableTools.map(tool => {
        // Fix schema for index_file tool to use correct parameter names
        if (tool.name === 'index_file') {
          return {
            name: tool.name,
            description: tool.description || 'Add or update a file in the vector store',
            input_schema: {
              type: "object",
              properties: {
                filePath: { 
                  type: "string", 
                  description: "Path to document to be embedded" 
                },
                collection: { 
                  type: "string", 
                  description: "Collection name" 
                },
                metadata: { 
                  type: "object", 
                  description: "Document metadata" 
                },
                id: { 
                  type: "string", 
                  description: "Document ID (optional)" 
                }
              },
              required: ["filePath", "collection"]
            }
          };
        }
        
        return {
          name: tool.name,
          description: tool.description || `Execute ${tool.name} tool`,
          input_schema: tool.inputSchema || {
            type: "object",
            properties: {},
            required: []
          }
        };
      });
      
     // console.log('Tools being sent to Anthropic:', JSON.stringify(tools, null, 2));
      
      return await this.handleLLMWithMCPTools(client, prompt, config, tools, 'anthropic');
    }

    // No tools available, use regular completion
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    return response.content
      .filter(content => content.type === 'text')
      .map(content => content.type === 'text' ? content.text : '')
      .join('');
  }

  private async handleLLMWithMCPTools(client: any, prompt: string, config: LLMConfig, tools: any[], provider: 'openai' | 'anthropic'): Promise<string> {
    // Create conversation loop to handle multiple tool calls
    let conversationHistory: any[] = [{ role: "user", content: prompt }];
    let maxIterations = 5; // Prevent infinite loops
    
    while (maxIterations > 0) {
      let response;
      
      if (provider === 'openai') {
        response = await client.chat.completions.create({
          model: config.model,
          messages: conversationHistory,
          tools: tools,
          tool_choice: "auto",
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 1000
        });
        
        const message = response.choices[0].message;
        conversationHistory.push(message);
        
        // If no tool calls, return the content
        if (!message.tool_calls || message.tool_calls.length === 0) {
          return message.content || "";
        }
        
        // Execute tool calls via MCP
        for (const toolCall of message.tool_calls) {
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            console.log(`Executing tool ${toolCall.function.name} with arguments:`, parsedArgs);
            const toolResult = await this.executeMCPToolCall({
              name: toolCall.function.name,
              arguments: parsedArgs
            });
            
            conversationHistory.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });
          } catch (error) {
            conversationHistory.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`
            });
          }
        }
      } else { // anthropic
        response = await client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens || 1000,
          temperature: config.temperature || 0.7,
          messages: conversationHistory,
          tools: tools,
          tool_choice: { type: "auto" }
        });
        
        // Check for tool use
        const toolUseContent = response.content.find((content: any) => content.type === 'tool_use');
        if (!toolUseContent) {
          // No tool calls, return text content
          return response.content
            .filter((content: any) => content.type === 'text')
            .map((content: any) => content.text)
            .join('');
        }
        
        // Add assistant message to history
        conversationHistory.push({
          role: "assistant",
          content: response.content
        });
        
        // Execute tool call via MCP
        try {
          console.log(`Executing tool ${toolUseContent.name} with arguments:`, toolUseContent.input);
          const toolResult = await this.executeMCPToolCall({
            name: toolUseContent.name,
            arguments: toolUseContent.input
          });
          
          conversationHistory.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUseContent.id,
              content: JSON.stringify(toolResult)
            }]
          });
        } catch (error) {
          conversationHistory.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUseContent.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`
            }]
          });
        }
      }
      
      maxIterations--;
    }
    
    throw new Error("Maximum tool call iterations reached");
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
   /*   console.log('Available MCP tools during initialization:');
      this.availableTools.forEach(tool => {
        console.log(`- ${tool.name} (server: ${tool.serverName}):`, JSON.stringify(tool.inputSchema, null, 2));
      });*/
      
      // Filter tools if specific tools are requested
      if (this.definition.mcpTools && this.definition.mcpTools.length > 0) {
        this.availableTools = this.availableTools.filter(tool => 
          this.definition.mcpTools!.includes(tool.name)
        );
      /*  console.log('Filtered MCP tools:');
        this.availableTools.forEach(tool => {
          console.log(`- ${tool.name}:`, JSON.stringify(tool.inputSchema, null, 2));
        });*/
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


  private async executeMCPToolCall(toolCall: MCPToolCall): Promise<any> {
    // Find which server has this tool
    const connectedServers = mcpClientManager.getConnectedServers();
    console.log('Connected servers:', connectedServers);
    
    for (const serverName of connectedServers) {
      try {
        const tools = await mcpClientManager.listTools(serverName);
        console.log(`Tools on server ${serverName}:`, tools.map(t => t.name));
        const tool = tools.find(t => t.name === toolCall.name);
        
        if (tool) {
          console.log(`Found tool ${toolCall.name} on server ${serverName}`);
          try {
            return await mcpClientManager.callTool(serverName, toolCall);
          } catch (error) {
            if (error instanceof Error && error.message.includes('timed out')) {
              throw new Error(`Tool ${toolCall.name} timed out. This operation may take longer than expected. Consider increasing the timeout or checking if the file exists and is accessible.`);
            }
            throw error;
          }
        }
      } catch (error) {
        console.log(`Error checking tools on server ${serverName}:`, error);
        // Tool not found on this server, continue searching
        continue;
      }
    }
    
    console.log(`Tool ${toolCall.name} not found on any server. Available servers:`, connectedServers);
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
    
    return await this.executeMCPToolCall(toolCall);
  }
}