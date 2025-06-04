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

    // Add MCP tools information to prompt so LLM knows what tools are available
    if (this.availableTools.length > 0) {
      prompt += `Available Tools:\n`;
      for (const tool of this.availableTools) {
        prompt += `- ${tool.name}: ${tool.description || 'No description'}\n`;
        if (tool.inputSchema && tool.inputSchema.properties) {
          const params = Object.keys(tool.inputSchema.properties).join(', ');
          prompt += `  Parameters: ${params}\n`;
        }
      }
      prompt += '\nYou MUST use these tools to complete your task. Do not provide any analysis or response without first calling the required tools. Always start by calling the appropriate tool to retrieve data.\n\n';
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
    
    console.log('=== FULL PROMPT ===');
    console.log(prompt);
    console.log('===================');
    
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
    
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // If MCP tools are available, use native tool calling with MCP integration
    if (this.availableTools.length > 0) {
      const tools = this.availableTools.map(tool => {
        // Fix schema for get_chunks tool
        if (tool.name === 'get_chunks') {
          return {
            type: "function" as const,
            function: {
              name: tool.name,
              description: "Retrieve chunks from a collection",
              parameters: {
                type: "object",
                properties: {
                  collection: { 
                    type: "string", 
                    description: "Collection name to retrieve chunks from" 
                  },
                  limit: { 
                    type: "integer", 
                    description: "Maximum number of chunks to retrieve",
                    default: 10
                  },
                  ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional array of specific chunk IDs to retrieve"
                  }
                },
                required: ["collection"]
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
      
      // For chunk_requester agent, ALWAYS force tool calls
      const isChunkRequester = this.definition.name === 'chunk_requester';
      console.log(`Agent ${this.definition.name}: forceToolUse=${isChunkRequester}, tools count=${tools.length}`);
      
      return await this.handleLLMWithMCPTools(client, prompt, config, tools, 'openai', isChunkRequester);
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
        // Fix schema for get_chunks tool
        if (tool.name === 'get_chunks') {
          return {
            name: tool.name,
            description: "Retrieve chunks from a collection",
            input_schema: {
              type: "object",
              properties: {
                collection: { 
                  type: "string", 
                  description: "Collection name to retrieve chunks from" 
                },
                limit: { 
                  type: "integer", 
                  description: "Maximum number of chunks to retrieve",
                  default: 10
                },
                ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional array of specific chunk IDs to retrieve"
                }
              },
              required: ["collection"]
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
      
    //  console.log('Tools being sent to Anthropic:', JSON.stringify(tools, null, 2));
      
      // For chunk_requester agent, ALWAYS force tool calls
      const isChunkRequester = this.definition.name === 'chunk_requester';
      
      return await this.handleLLMWithMCPTools(client, prompt, config, tools, 'anthropic', isChunkRequester);
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

  private async handleLLMWithMCPTools(client: any, prompt: string, config: LLMConfig, tools: any[], provider: 'openai' | 'anthropic', forceToolUse: boolean = false): Promise<string> {
    // Create conversation loop to handle multiple tool calls
    let conversationHistory: any[] = [{ role: "user", content: prompt }];
    let maxIterations = 5; // Allow more iterations for finding data
    
    while (maxIterations > 0) {
    //  console.log("TOOLS ", tools);
      let response;
      
      if (provider === 'openai') {
        const toolChoice = forceToolUse ? "required" : "auto";
        console.log(`Making OpenAI call with tool_choice=${toolChoice}, forceToolUse=${forceToolUse}`);
        
        response = await client.chat.completions.create({
          model: config.model,
          messages: conversationHistory,
          tools: tools,
          tool_choice: toolChoice,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 1000
        });
        
        const message = response.choices[0].message;
        conversationHistory.push(message);
        
        // If no tool calls, return the content (conversation complete)
        if (!message.tool_calls || message.tool_calls.length === 0) {
          console.log('No tool calls made by OpenAI. Analysis complete. Message content:', message.content?.substring(0, 200) + '...');
          
          // For chunk_requester, reject responses without tool calls
          if (forceToolUse) {
            console.log('ERROR: chunk_requester failed to call required tools - this should not happen with tool_choice=required');
            throw new Error('Required tool call was not made by the LLM');
          }
          
          return message.content || "";
        }
        
     //   console.log('OpenAI made tool calls:', message.tool_calls.length);
        
        // Execute tool calls via MCP
       for (const toolCall of message.tool_calls) {
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
         //   console.log(`Executing tool ${toolCall.function.name} with arguments:`, parsedArgs);
            const toolResult = await this.executeMCPToolCall({
              name: toolCall.function.name,
              arguments: parsedArgs
            });
            
            const resultContent = JSON.stringify(toolResult);
            console.log(`Tool result length: ${resultContent.length} characters`);
            
            // Truncate large results to prevent context overflow
            const maxResultLength = 10000; // Limit to ~10k chars
            const truncatedContent = resultContent.length > maxResultLength 
              ? resultContent.substring(0, maxResultLength) + `\n\n[TRUNCATED - Original length: ${resultContent.length} chars]`
              : resultContent;
            
            conversationHistory.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: truncatedContent
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
          tool_choice: forceToolUse ? { type: "any" } : { type: "auto" }
        });
        
        // Check for tool use
        const toolUseContent = response.content.find((content: any) => content.type === 'tool_use');
        if (!toolUseContent) {
          // No tool calls, return text content
          const textContent = response.content
            .filter((content: any) => content.type === 'text')
            .map((content: any) => content.text)
            .join('');
          console.log('No tool calls made by Anthropic. Text content:', textContent);
          
          // For chunk_requester, reject responses without tool calls
          if (forceToolUse) {
            console.log('ERROR: chunk_requester failed to call required tools - this should not happen with tool_choice=required');
            throw new Error('Required tool call was not made by the LLM');
          }
          
          return textContent;
        }
        
        console.log('Anthropic made tool call:', toolUseContent.name);
        
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
          
          const resultContent = JSON.stringify(toolResult);
          // Truncate large results to prevent context overflow
          const maxResultLength = 10000; // Limit to ~10k chars
          const truncatedContent = resultContent.length > maxResultLength 
            ? resultContent.substring(0, maxResultLength) + `\n\n[TRUNCATED - Original length: ${resultContent.length} chars]`
            : resultContent;
          
          conversationHistory.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUseContent.id,
              content: truncatedContent
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
    
    console.log("Reached maximum iterations, returning last conversation state");
    // If we reach here, return the last response instead of throwing error
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (lastMessage && lastMessage.content) {
      return typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
    }
    
    throw new Error("Maximum tool call iterations reached and no valid response found");
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
    //  if (this.definition.mcpTools && this.definition.mcpTools.length > 0) {
      /*  this.availableTools = this.availableTools.filter(tool => 
          this.definition.mcpTools!.includes(tool.name)
        );*/
      /*  console.log('Filtered MCP tools:');
        this.availableTools.forEach(tool => {
          console.log(`- ${tool.name}:`, JSON.stringify(tool.inputSchema, null, 2));
        });*/
     // }

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
      //  console.log(`Tools on server ${serverName}:`, tools.map(t => t.name));
        const tool = tools.find(t => t.name === toolCall.name);
        
        if (tool) {
       //   console.log(`Found tool ${toolCall.name} on server ${serverName}`);
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

  async refreshCapabilities(): Promise<void> {
    await this.refreshMCPCapabilities();
  }
}