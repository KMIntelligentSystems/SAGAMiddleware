import { AgentDefinition, AgentResult, LLMConfig, MCPToolCall } from '../types/index.js';
import { mcpClientManager } from '../mcp/mcpClient.js';
import { OpenAI } from 'openai';

export class GenericAgent {
  private availableTools: any[] = [];
  private availableResources: any[] = [];
  private context: string = '';
  
  constructor(private definition: AgentDefinition) {
    this.initializeMCPConnections();
  }

  /* addDependency(other: Agent | Agent[]) {
        if (Array.isArray(other) && other.every(item => item instanceof Agent)) {
            other.forEach(item => {
                this.dependencies.push(item);
                item.dependents.push(this);
            });
        } else if (other instanceof Agent) {
            this.dependencies.push(other);
            other.dependents.push(this);
        } else {
            throw new TypeError("The dependency must be an instance or list of Agent.");
        }
    }

    addDependent(other: Agent | Agent[]) {
        if (Array.isArray(other) && other.every(item => item instanceof Agent)) {
            other.forEach(item => {
                item.dependencies.push(this);
                this.dependents.push(item);
            });
        } else if (other instanceof Agent) {
            other.dependencies.push(this);
            this.dependents.push(other);
        } else {
            throw new TypeError("The dependent must be an instance or list of Agent.");
        }
    }*/

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

  async execute(contextData: Record<string, any>): Promise<AgentResult> {
    const startTime = new Date();
    
    try {
      // Refresh MCP capabilities if needed
      await this.refreshMCPCapabilities();

      this.receiveContext(contextData);
      const prompt = this.createPrompt();//buildPrompt(contextData);
      console.log("PROMPT ",prompt)
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

  private  receiveContext(contextData: Record<string, any>) {
    const baseContext: string = JSON.stringify(contextData);
        this.context = `${this.definition.name} received context: \n${baseContext}`;
        console.log("CONTEXT 1 ", this.context)
    }

   createPrompt(): string {
        const prompt = `
            You are an AI agent. You are part of a team of agents working together to complete a task.
            I'm going to give you the task description enclosed in <task_description></task_description> tags. I'll also give
            you the available context from the other agents in <context></context> tags. If the context
            is not available, the <context></context> tags will be empty. You'll also receive the task
            expected output enclosed in <task_expected_output></task_expected_output> tags. With all this information
            you need to create the best possible response, always respecting the format as described in
            <task_expected_output></task_expected_output> tags. If expected output is not available, just create
            a meaningful response to complete the task.
            <task_description>
            ${this.definition.taskDescription}
            </task_description>

            <task_expected_output>
            ${this.definition.taskExpectedOutput}
            </task_expected_output>
            <context>
            ${this.context}
            </context>
            Your response:
        `.trim();

        return prompt;
    }

  /* buildPrompt(contextData: Record<string, any>): string {
    const baseContext = contextData;
    
    let prompt = `Task: ${this.definition.taskDescription}\n\n`;
    
    if (Object.keys(baseContext).length > 0) {
      prompt += `IMPORTANT CONTEXT - USE THESE VALUES EXACTLY:\n`;
      for (const [key, value] of Object.entries(baseContext)) {
        prompt += `${key}: ${JSON.stringify(value)}\n`;
      }
      prompt += '\nYou MUST use the context values above. Do not substitute or change them.\n\n';
    }

    // Add tools information based on agent type
    if (this.definition.agentType === 'tool' && this.availableTools.length > 0) {
      prompt += `Available Tools:\n`;
      for (const tool of this.availableTools) {
        prompt += `- ${tool.name}: ${tool.description || 'No description'}\n`;
        if (tool.inputSchema && tool.inputSchema.properties) {
          const params = Object.keys(tool.inputSchema.properties).join(', ');
          prompt += `  Parameters: ${params}\n`;
        }
      }
      prompt += '\nUse the most appropriate tool for your task. Only call the tool that is necessary - do not call multiple tools unless specifically required by the task.\n\n';
    } else if (this.definition.agentType === 'processing') {
      prompt += `AGENT TYPE: PROCESSING AGENT\n`;
      prompt += `You are a text processing agent. NO external tools or data access are available.\n`;
      prompt += `Work ONLY with the context and data provided above. Do not attempt to call any tools or access external data.\n`;
      prompt += `Focus on analyzing, transforming, and structuring the provided information.\n\n`;
    }

    // Add MCP resources information
    if (this.availableResources.length > 0) {
      prompt += `Available Resources:\n`;
      for (const resource of this.availableResources) {
        prompt += `- ${resource.uri}: ${resource.description || 'No description'}\n`;
      }
      prompt += '\n';
    }

    if (this.definition.taskExpectedOutput) {
      prompt += `Expected Output Format:\n${JSON.stringify(this.definition.taskExpectedOutput, null, 2)}\n\n`;
    }

    prompt += `Please complete the task and provide the response in the expected format.`;
    
    console.log('=== FULL PROMPT ===');
    console.log(prompt);
    console.log('===================');
    
    return prompt;
  }*/

  private async invokeLLM(prompt: string): Promise<AgentResult> {
    const config = this.definition.llmConfig;
    
    switch (config.provider) {
      case 'openai':
        return await this.invokeOpenAI(prompt, config);
      case 'anthropic':
       // return await this.invokeAnthropic(prompt, config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  private async invokeOpenAI(prompt: string, config: LLMConfig): Promise<AgentResult> {
    const { OpenAI } = await import('openai');
    
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // If MCP tools are available AND this is a tool agent, use native tool calling with MCP integration
    if (this.definition.agentType === 'tool' && this.availableTools.length > 0) {
      const tools = this.availableTools.map(tool => {
        // Fix schema for get_chunks tool
        console.log("TOOL NAME ",tool.name)
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
        } else if (tool.name === 'index-file') {
          return {
            type: "function" as const,
            function: {
              name: tool.name,
              description: "Index a file into a vector collection",
              parameters: {
                type: "object",
                properties: {
                  filePath: { 
                    type: "string", 
                    description: "Path to the file to index" 
                  },
                  collection: { 
                    type: "string", 
                    description: "Name of the collection to store the indexed data" 
                  },
                  metadata: {
                    type: "object",
                    description: "Optional metadata for the indexed file",
                    properties: {
                      type: { type: "string" },
                      source: { type: "string" },
                      indexedAt: { type: "string" }
                    }
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
      
      // For chunk_requester agent, ALWAYS force tool calls
    //  const isChunkRequester = this.definition.name === 'chunk_requester';
   //   console.log(`Agent ${this.definition.name}: forceToolUse=${isChunkRequester}, tools count=${tools.length}`);
      
      // Set forceToolUse to false to allow more natural tool selection
      return await this.handleLLMWithMCPTools(client, prompt, config, tools, 'openai', false);
    }

   const userMessage: OpenAI.ChatCompletionMessageParam = {
    role: "user",
    content: prompt,
  };
    const response = await client.chat.completions.create({
       messages: [userMessage],
        model: config.model,
        temperature: 0.3,
     //   maxTokens: 3000,
    });
   return  {
     agentName: this.getName(),
     result: response.choices[0].message.content as string,
     success: true,
     timestamp: new Date()}
 
    // No tools available, use regular completion
  /*  const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000
    });

    return response.choices[0].message.content || "";*/
  
  }

  private async invokeAnthropic(prompt: string, config: LLMConfig): Promise<AgentResult> {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    
    const client = new Anthropic({
      apiKey: config.apiKey
    });

    // If MCP tools are available AND this is a tool agent, use native tool calling with MCP integration
    if (this.definition.agentType === 'tool' && this.availableTools.length > 0) {
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
        } else if (tool.name === 'index-file') {
          return {
            name: tool.name,
            description: "Index a file into a vector collection",
            input_schema: {
              type: "object",
              properties: {
                filePath: { 
                  type: "string", 
                  description: "Path to the file to index" 
                },
                collection: { 
                  type: "string", 
                  description: "Name of the collection to store the indexed data" 
                },
                metadata: {
                  type: "object",
                  description: "Optional metadata for the indexed file",
                  properties: {
                    type: { type: "string" },
                    source: { type: "string" },
                    indexedAt: { type: "string" }
                  }
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
      
    //  console.log('Tools being sent to Anthropic:', JSON.stringify(tools, null, 2));
      
      // For chunk_requester agent, ALWAYS force tool calls
      const isChunkRequester = this.definition.name === 'chunk_requester';
      
      // Set forceToolUse to false to allow more natural tool selection
      return await this.handleLLMWithMCPTools(client, prompt, config, tools, 'anthropic', false);
    }

    // No tools available, use regular completion
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const message = response.content
      .filter(content => content.type === 'text')
      .map(content => content.type === 'text' ? content.text : '')
      .join('');

     return  {
     agentName: this.getName(),
     result: message,
     success: true,
     timestamp: new Date()}
    

  /*  return response.content
      .filter(content => content.type === 'text')
      .map(content => content.type === 'text' ? content.text : '')
      .join('');*/
  }

  private async handleLLMWithMCPTools(client: any, prompt: string, config: LLMConfig, tools: any[], provider: 'openai' | 'anthropic', forceToolUse: boolean = true): Promise<AgentResult> {
    // Create conversation loop to handle multiple tool calls
    let conversationHistory: any[] = [{ role: "user", content: prompt }];
    let maxIterations = 5; // Allow more iterations for finding data
    let hasExecutedTool = false; // Track if any tool has been executed
    
    while (maxIterations > 0) {
    //  console.log("TOOLS ", tools);
      let response;
      
      if (provider === 'openai') {
        // Use "required" for forceToolUse=true, or for tool agents that haven't called tools yet
        const shouldForceToolUse = forceToolUse || (this.definition.agentType === 'tool' && !hasExecutedTool);
        const toolChoice = shouldForceToolUse ? "required" : "auto";
        console.log(`Making OpenAI call with tool_choice=${toolChoice}, forceToolUse=${forceToolUse}, hasExecutedTool=${hasExecutedTool}, shouldForceToolUse=${shouldForceToolUse}`);
        
        response = await client.chat.completions.create({
          model: config.model,
          messages: conversationHistory,
          tools: tools,
          tool_choice: toolChoice,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 1000
        });
        
        const message = response.choices[0].message;
        
        // Check if we've already made tool calls in previous iterations (before adding current message)
        const hasPreviousToolCalls = conversationHistory.some(msg => msg.role === 'tool');
        
        conversationHistory.push(message);
        
        // If no tool calls in current message, check if this is final analysis or first iteration
        if (!message.tool_calls || message.tool_calls.length === 0) {
          if (hasPreviousToolCalls) {
            console.log('✅ Analysis complete - OpenAI processed tool results and provided final answer');
            console.log('Final analysis content length:', message.content?.length || 0);
            return {
              agentName: this.getName(),
              result: message.content || "",
              success: true,
              timestamp: new Date()
            };
          } else {
            console.log('⚠️ No tool calls made in first iteration. Message content:', message.content?.substring(0, 200) + '...');
            
            // For tool agents, try forcing tool use on subsequent iterations
            if (this.definition.agentType === 'tool' && maxIterations > 1) {
              console.log(`🔄 Tool agent didn't call tools, retrying with tool_choice=required (${maxIterations - 1} attempts remaining)`);
              // Continue the loop with forced tool use
              maxIterations--;
              continue;
            }
            
            // For other cases or when out of retries
            if (forceToolUse) {
              console.log('ERROR: Failed to call required tools - this should not happen with tool_choice=required');
              throw new Error('Required tool call was not made by the LLM');
            }
            
            return {
              agentName: this.getName(),
              result: message.content || "",
              success: true,
              timestamp: new Date()
            };
          }
        }
        
        console.log('OpenAI made tool calls:', message.tool_calls[0].function);
        
        // Execute tool calls via MCP
       for (const toolCall of message.tool_calls) {
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            
            // Validate tool arguments before execution
            this.validateToolArguments(toolCall.function.name, parsedArgs);
            
         //   console.log(`Executing tool ${toolCall.function.name} with arguments:`, parsedArgs);
            const toolResult = await this.executeMCPToolCall({
              name: toolCall.function.name,
              arguments: parsedArgs
            });
            
            hasExecutedTool = true; // Mark that we've executed a tool
            
            // Check if this was an indexing operation - no additional verification needed
            if (toolCall.function.name === 'index_file' || toolCall.function.name === 'index-file') {
              const collection = parsedArgs.collection;
              if (collection) {
                console.log(`✅ Indexing operation completed for collection: ${collection}`);
                // For indexing operations, return immediately after successful completion
                return {
                  agentName: this.getName(),
                  result: `Successfully indexed file to collection: ${collection}`,
                  success: true,
                  timestamp: new Date()
                };
              }
            }
            
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
        // Use "any" for forceToolUse=true, or for tool agents that haven't called tools yet
        const shouldForceToolUse = forceToolUse || (this.definition.agentType === 'tool' && !hasExecutedTool);
        const toolChoice = shouldForceToolUse ? { type: "any" } : { type: "auto" };
        console.log(`Making Anthropic call with tool_choice=${JSON.stringify(toolChoice)}, forceToolUse=${forceToolUse}, hasExecutedTool=${hasExecutedTool}, shouldForceToolUse=${shouldForceToolUse}`);
        
        response = await client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens || 1000,
          temperature: config.temperature || 0.7,
          messages: conversationHistory,
          tools: tools,
          tool_choice: toolChoice
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
          
          // For tool agents, try forcing tool use on subsequent iterations
          if (this.definition.agentType === 'tool' && maxIterations > 1 && !hasExecutedTool) {
            console.log(`🔄 Tool agent didn't call tools, retrying with tool_choice=any (${maxIterations - 1} attempts remaining)`);
            maxIterations--;
            continue;
          }
          
          // For other cases or when out of retries
          if (forceToolUse) {
            console.log('ERROR: Failed to call required tools - this should not happen with tool_choice=any');
            throw new Error('Required tool call was not made by the LLM');
          }
          
          return {
            agentName: this.getName(),
            result: textContent,
            success: true,
            timestamp: new Date()
          };
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
          
          hasExecutedTool = true; // Mark that we've executed a tool
          
          // Check if this was an indexing operation - no additional verification needed
          if (toolUseContent.name === 'index_file' || toolUseContent.name === 'index-file') {
            const collection = toolUseContent.input.collection;
            if (collection) {
              console.log(`✅ Indexing operation completed for collection: ${collection}`);
              // For indexing operations, return immediately after successful completion
              return {
                agentName: this.getName(),
                result: `Successfully indexed file to collection: ${collection}`,
                success: true,
                timestamp: new Date()
              };
            }
          }
          
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
   //   return typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

    return  {
     agentName: this.getName(),
     result: lastMessage.content  as string,
     success: true,
     timestamp: new Date()}
    }
    
    throw new Error("Maximum tool call iterations reached and no valid response found");
  }

  // Tool argument validation
  private validateToolArguments(toolName: string, args: any): void {
    if (toolName === 'semantic_search') {
      if (!args.query || typeof args.query !== 'string') {
        throw new Error(`semantic_search requires a "query" string parameter, got: ${JSON.stringify(args)}`);
      }
      if (!args.collection || typeof args.collection !== 'string') {
        throw new Error(`semantic_search requires a "collection" string parameter, got: ${JSON.stringify(args)}`);
      }
      const allowedParams = ['query', 'collection'];
      const extraParams = Object.keys(args).filter(key => !allowedParams.includes(key));
      if (extraParams.length > 0) {
        throw new Error(`semantic_search only accepts "query" and "collection" parameters. Found extra parameters: ${extraParams.join(', ')}`);
      }
    }
    
    if (toolName === 'get_chunks') {
      if (!args.collection || args.collection !== 'supply_analysis') {
        throw new Error(`get_chunks collection must be "supply_analysis", got: ${args.collection || 'undefined'}`);
      }
      if (!args.limit || typeof args.limit !== 'number') {
        throw new Error(`get_chunks requires a numeric "limit" parameter, got: ${JSON.stringify(args)}`);
      }
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
//REDUNDANT
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

  private async waitForIndexingCompletion(collection: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 10000; // 10 seconds
    const startTime = Date.now();
    
    console.log(`⏳ Waiting for collection ${collection} to be ready for queries...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Try to query the collection to see if it exists and has data
        const testResult = await this.executeMCPToolCall({
          name: 'get_chunks',
          arguments: { collection, limit: 1 }
        });
        
        if (testResult && !testResult.error) {
          console.log(`✅ Collection ${collection} is ready for queries`);
          return;
        }
      } catch (error) {
        // Collection not ready yet, continue polling
        console.log(`⏳ Collection ${collection} not ready yet, continuing to poll...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Collection ${collection} was not ready within ${maxWaitTime}ms`);
  }
}