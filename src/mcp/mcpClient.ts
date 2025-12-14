//import { Client } from '@modelcontextprotocol/sdk/client/index';
//import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { MCPServerConfig, MCPToolCall, MCPResource } from '../types/index.js';
import { globalDataProcessor, ProcessedDataWithKey } from '../processing/dataResultProcessor.js';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface ToolCallEnhancementRule {
  toolName: string;
  requiredParameters: string[];
  enhancer: (originalArgs: any, context: ToolCallContext) => any;
}

export interface ToolCallContext {
  currentChunk?: ProcessedDataWithKey[];
  allStoredData?: Map<string, any>;
  outputPath?: string;
  iteration?: number;
  totalChunks?: number;
}

export interface MCPClientManager {
  connect(serverConfig: MCPServerConfig): Promise<void>;
  disconnect(serverName: string): Promise<void>;
  listTools(serverName?: string): Promise<any[]>;
  callTool(serverName: string, toolCall: MCPToolCall, context?: ToolCallContext): Promise<any>;
  getResource(serverName: string, resourceUri: string): Promise<any>;
  listResources(serverName?: string): Promise<MCPResource[]>;
  isConnected(serverName: string): boolean;
  getConnectedServers(): string[];
  addToolEnhancementRule(rule: ToolCallEnhancementRule): void;
  removeToolEnhancementRule(toolName: string): boolean;
}

export class MCPClientManagerImpl implements MCPClientManager {
  private clients = new Map<string, any>();
  private transports = new Map<string, any>();
  private serverConfigs = new Map<string, MCPServerConfig>();
  private enhancementRules = new Map<string, ToolCallEnhancementRule>();

  constructor() {
    this.initializeDefaultEnhancementRules();
  }

  /**
   * Initialize default enhancement rules for common tools
   */
  private initializeDefaultEnhancementRules(): void {
    // Rule for calculate_energy_totals tool
    this.addToolEnhancementRule({
      toolName: 'calculate_energy_totals',
      requiredParameters: ['energyData', 'filePath'],
      enhancer: (originalArgs, context) => {
        // For calculate_energy_totals, always use ALL stored data (up to 1000 records)
        const energyData = this.extractAllEnergyData(context);
        const filePath = this.generateFilePath('energy_totals', context);
        
        console.log(`🔧 Enhanced calculate_energy_totals with ${energyData.length} total records (all data), output: ${filePath}`);
        console.log(`🔍 First few energy records:`, JSON.stringify(energyData.slice(0, 2), null, 2));
        
        return {
          ...originalArgs,
          energyData,
          filePath
        };
      }
    });

    // Rule for save_processed_data tool
    this.addToolEnhancementRule({
      toolName: 'save_processed_data',
      requiredParameters: ['data', 'filePath'],
      enhancer: (originalArgs, context) => {
        const data = this.extractProcessedData(context);
        const filePath = this.generateFilePath('processed_data', context);
        
        console.log(`🔧 Enhanced save_processed_data with ${data.length} records, output: ${filePath}`);
        
        return {
          ...originalArgs,
          data,
          filePath
        };
      }
    });

    // Rule for process_data_chunk tool
    this.addToolEnhancementRule({
      toolName: 'process_data_chunk',
      requiredParameters: ['chunkData', 'chunkIndex', 'totalChunks'],
      enhancer: (originalArgs, context) => {
        console.log(`🔧 Enhanced process_data_chunk with chunk ${(context.iteration || 0) + 1}/${context.totalChunks || 1}`);
        
        return {
          ...originalArgs,
          chunkData: context.currentChunk || [],
          chunkIndex: context.iteration || 0,
          totalChunks: context.totalChunks || 1
        };
      }
    });
  }

  /**
   * Add a new enhancement rule for a specific tool
   */
  addToolEnhancementRule(rule: ToolCallEnhancementRule): void {
    this.enhancementRules.set(rule.toolName, rule);
    console.log(`📋 Added enhancement rule for tool: ${rule.toolName}`);
  }

  /**
   * Remove an enhancement rule
   */
  removeToolEnhancementRule(toolName: string): boolean {
    const removed = this.enhancementRules.delete(toolName);
    if (removed) {
      console.log(`🗑️ Removed enhancement rule for tool: ${toolName}`);
    }
    return removed;
  }

  /**
   * Intercept and enhance a tool call if needed
   */
  private async interceptAndEnhance(
    toolCall: MCPToolCall, 
    context: ToolCallContext = {}
  ): Promise<MCPToolCall> {
    const rule = this.enhancementRules.get(toolCall.name);
    
    if (!rule) {
      console.log(`📤 No enhancement rule for ${toolCall.name} - forwarding as-is`);
      return toolCall;
    }

    console.log(`🔧 Enhancing tool call: ${toolCall.name}`);
    
    try {
      // Parse original arguments
      const originalArgs = typeof toolCall.arguments === 'string' 
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;

      // Check if enhancement is needed
      const missingParams = this.findMissingParameters(originalArgs, rule.requiredParameters);
      
      if (missingParams.length === 0) {
        console.log(`✅ Tool call ${toolCall.name} already has all required parameters`);
        return toolCall;
      }

      console.log(`🔍 Missing parameters for ${toolCall.name}:`, missingParams);

      // Enhance the arguments
      const enhancedArgs = rule.enhancer(originalArgs, context);

      console.log(`✨ Enhanced tool call ${toolCall.name} with:`, {
        original: Object.keys(originalArgs),
        enhanced: Object.keys(enhancedArgs)
      });

      return {
        name: toolCall.name,
        arguments: enhancedArgs
      };

    } catch (error) {
      console.error(`❌ Failed to enhance tool call ${toolCall.name}:`, error);
      return toolCall; // Return original if enhancement fails
    }
  }

  async connect(serverConfig: MCPServerConfig): Promise<void> {
    if (this.clients.has(serverConfig.name)) {
      throw new Error(`MCP server ${serverConfig.name} is already connected`);
    }

    try {
      let transport;
      
      if (serverConfig.transport === 'stdio') {
        if (!serverConfig.command) {
          throw new Error(`stdio transport requires command for server ${serverConfig.name}`);
        }
      
        transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env
        });
      } else if (serverConfig.transport === 'http') {
        // HTTP transport implementation would go here
        // For now, we'll throw an error as it's not implemented
        throw new Error('HTTP transport not yet implemented');
      } else {
        throw new Error(`Unsupported transport type: ${serverConfig.transport}`);
      }

      const client = new Client({
        name: 'saga-middleware',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });
/*1. ChromaDB connection established
RAG MCP Server started in stdio mode
Connected to MCP server: rag-server
ChromaDB connection established
RAG MCP Server started in stdio mode*/ 
      await client.connect(transport);
      
      this.clients.set(serverConfig.name, client);
      this.transports.set(serverConfig.name, transport);
      this.serverConfigs.set(serverConfig.name, serverConfig);
//2.server name = rag
      console.log(`Connected to MCP server: ${serverConfig.name}`); 
    } catch (error) {
      throw new Error(`Failed to connect to MCP server ${serverConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    const transport = this.transports.get(serverName);

    if (client && transport) {
      try {
        await client.close();
        this.clients.delete(serverName);
        this.transports.delete(serverName);
        this.serverConfigs.delete(serverName);
        console.log(`Disconnected from MCP server: ${serverName}`);
      } catch (error) {
        console.error(`Error disconnecting from MCP server ${serverName}:`, error);
      }
    }
  }

  async listTools(serverName?: string): Promise<any[]> {
    if (serverName) {
      const client = this.getClient(serverName);
      const toolsResponse = await client.request(
      { method: "tools/list" },
      ListToolsResultSchema
    );
    const availableTools = toolsResponse.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
 //   console.log("AVAILABLE TOOLS ", availableTools)
      const response = await client.listTools();
      return response.tools || [];
    }

   
    // List tools from all connected servers
    const allTools: any[] = [];
    for (const [name, client] of this.clients.entries()) {
   
      try {
        const response = await client.listTools();
        const tools = (response.tools || []).map((tool: any) => ({
          ...tool,
          serverName: name
        }));
        allTools.push(...tools);
      } catch (error) {
        console.error(`Error listing tools from server ${name}:`, error);
      }
    }
    return allTools;
  }
/*
MCP tool execute_python raw response: {
  "content": [],
  "success": false,
  "stdout": "",
  "stderr": "File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1755927018024.py\", line 50\r\n    if cols[0] == 'date/time\r\n                  ^\r\nSyntaxError: unterminated string literal (detected at line 50)",
  "error": "Command failed: py \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1755927018024.py\"\n  File \"C:\\repos\\codeGen-mcp-server\\workspace\\script_1755927018024.py\", line 50\r\n    if cols[0] == 'date/time\r\n                  ^\r\nSyntaxError: unterminated string literal (detected at line 50)\r\n",
  "filename": "script_1755927018024.py"
}
*/
  async callTool(serverName: string, toolCall: MCPToolCall, context?: ToolCallContext): Promise<any> {
    // First, intercept and enhance the tool call if needed
    const enhancedToolCall = await this.interceptAndEnhance(toolCall, context || {});
    
    const client = this.getClient(serverName);
    const serverConfig = this.serverConfigs.get(serverName);
    
    // Operation-specific timeouts
    const OPERATION_TIMEOUTS: Record<string, number> = {
      'index_file': 1800000,   // 30 minutes for large file indexing
      'index-file': 1800000,   // 30 minutes (handle both naming conventions)
      'semantic_search': 60000, // 1 minute for searches
      'get_chunks': 30000,     // 30 seconds for chunk retrieval
      'structured_query': 120000, // 2 minutes for structured queries
      'default': 120000        // 2 minutes default
    };
    
    const timeout = OPERATION_TIMEOUTS[enhancedToolCall.name] ?? serverConfig?.timeout ?? OPERATION_TIMEOUTS['default'];
    
    try {
      console.log(`MCP Client calling tool ${enhancedToolCall.name} on server ${serverName} with arguments:`, enhancedToolCall.arguments);
      console.log(`Timeout set to ${timeout}ms (${Math.round(timeout/60000)} minutes)`);
      
      // Add progress logging for long-running operations
      let progressInterval: NodeJS.Timeout | null = null;
      const isLongRunningOperation = ['index_file', 'index-file'].includes(enhancedToolCall.name);
      
      if (isLongRunningOperation) {
        const startTime = Date.now();
        console.log(`🔄 Starting long-running operation: ${enhancedToolCall.name}. This may take several minutes...`);
        
        progressInterval = setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const remaining = Math.round((timeout - (Date.now() - startTime)) / 1000);
          console.log(`⏱️ ${enhancedToolCall.name} progress: ${elapsed}s elapsed, ~${remaining}s remaining (timeout: ${Math.round(timeout/60000)}min)`);
        }, 30000); // Log every 30 seconds
      }
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          if (progressInterval) clearInterval(progressInterval);
          reject(new Error(`Tool call timed out after ${timeout}ms`));
        }, timeout);
      });
      
      // Race between the tool call and timeout
      const response = await Promise.race([
        client.callTool({
          name: enhancedToolCall.name,
          arguments: enhancedToolCall.arguments
        }),
        timeoutPromise
      ]) as any;
      
      // Clear progress logging
      if (progressInterval) {
        clearInterval(progressInterval);
        if (isLongRunningOperation) {
          console.log(`✅ ${enhancedToolCall.name} completed successfully`);
        }
      }
      
      // Return the full response including success flag
      //MCP tool structured_query raw response
     console.log(`MCP tool ${enhancedToolCall.name} raw response:`, JSON.stringify(response, null, 2));

      // Always return the full response object to preserve success flag
      // The response format from MCP servers typically includes:
      // - content: array of content blocks
      // - success: boolean (for execute_python tool)
      // - error, stdout, stderr, filename (for execute_python tool)
      if (Array.isArray(response.content)) {
        // Handle MCP response format: content is array of objects with type and text
        if (response.content.length > 0 && response.content[0].type === 'text') {
          // Extract text content outside try block for error handling access
          const textContent = response.content[0].text;
          console.log(`Raw text content length: ${textContent.length} characters`);
          console.log(`Raw text content ends with: "${textContent.slice(-50)}"`);

          try {
            // Extract JSON from stdout that may contain MCP server status messages
            let jsonText = textContent;
            const lines = textContent.split(/\r?\n/);

            // Look for lines that start with { or [ (potential JSON)
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
                try {
                  JSON.parse(trimmedLine); // Test if it's valid JSON
                  jsonText = trimmedLine;
                  console.log(`Found JSON line in mixed output (length: ${trimmedLine.length})`);
                  break;
                } catch (e) {
                  // Not valid JSON, continue searching
                  continue;
                }
              }
            }

            // Try to parse the extracted JSON text
            const parsedContent = JSON.parse(jsonText);
            console.log(`Parsed ${enhancedToolCall.name} content:`, Array.isArray(parsedContent) ? `Array with ${parsedContent.length} items` : typeof parsedContent);
            // Return full response with parsed content
            return {
              ...response,
              parsedContent
            };
          } catch (parseError) {
            console.error(`JSON Parse Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            console.log(`Text content length: ${textContent.length}, last 100 chars:`, textContent.slice(-100));

            // Check if truncation occurred (incomplete JSON)
            const lastChar = textContent.trim().slice(-1);
            if (lastChar !== '}' && lastChar !== ']') {
              console.error('⚠️ JSON appears to be truncated - last character is not } or ]');
              console.error('This suggests MCP transport buffer limit exceeded');
            }

            // Return full response with text content
            return {
              ...response,
              parsedContent: textContent
            };
          }
        }
        return response;
      }
      return response;
    } catch (error) {
      throw new Error(`MCP tool call failed for ${enhancedToolCall.name} on server ${serverName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getResource(serverName: string, resourceUri: string): Promise<any> {
    const client = this.getClient(serverName);
    
    try {
      const response = await client.readResource({ uri: resourceUri });
      return response.contents;
    } catch (error) {
      throw new Error(`MCP resource read failed for ${resourceUri} on server ${serverName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listResources(serverName?: string): Promise<MCPResource[]> {
    if (serverName) {
      const client = this.getClient(serverName);
      const response = await client.listResources();
      return response.resources || [];
    }

    // List resources from all connected servers
    const allResources: MCPResource[] = [];
    for (const [name, client] of this.clients.entries()) {
      try {
        const response = await client.listResources();
        const resources = (response.resources || []).map((resource: any) => ({
          ...resource,
          serverName: name
        }));
        allResources.push(...resources);
      } catch (error: any) {
        // Silently skip servers that don't support resources (MCP error -32601: Method not found)
        if (error?.code === -32601) {
          // This is expected for servers that don't implement resources
          continue;
        }
        console.error(`Error listing resources from server ${name}:`, error);
      }
    }
    return allResources;
  }

  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  private getClient(serverName: string): any {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server ${serverName} is not connected`);
    }
    return client;
  }

  // Utility methods for managing connections
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  getServerConfig(serverName: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(serverName);
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map(serverName => 
      this.disconnect(serverName)
    );
    await Promise.allSettled(disconnectPromises);
  }

  /**
   * Helper method to find missing required parameters
   */
  private findMissingParameters(args: any, requiredParams: string[]): string[] {
    return requiredParams.filter(param => !(param in args) || args[param] === undefined);
  }

  /**
   * Extract ALL energy data from storage (for tools that need complete dataset)
   */
  private extractAllEnergyData(context: ToolCallContext): any[] {
    console.log(`🔍 Extracting ALL energy data from storage...`);
    
    // Debug: Check what's actually in storage
    const allResults = globalDataProcessor.getAllResults();
    console.log(`📊 Global storage contains ${allResults.size} total entries`);
    console.log(`📊 Storage keys:`, Array.from(allResults.keys()));
    
    // Priority: allStoredData > global storage > currentChunk (fallback)
    if (context.allStoredData && context.allStoredData.size > 0) {
      console.log(`📊 Context.allStoredData contains ${context.allStoredData.size} entries`);
      console.log(`📊 Context.allStoredData keys:`, Array.from(context.allStoredData.keys()));
      
      const extractedData = Array.from(context.allStoredData.values()).map(item => item.cleanedData).flat();
      const formattedData = this.formatEnergyData(extractedData);
      console.log(`🔍 Extracted and formatted ${formattedData.length} energy records from context.allStoredData`);
      return formattedData;
    }

    // Fallback: get from global storage
    if (allResults.size > 0) {
      console.log(`📊 Using global storage with ${allResults.size} entries`);
      const extractedData = Array.from(allResults.values()).map(item => item.cleanedData).flat();
      console.log(`📊 Sample storage entry:`, JSON.stringify(Array.from(allResults.values())[0], null, 2));
      const formattedData = this.formatEnergyData(extractedData);
      console.log(`🔍 Extracted and formatted ${formattedData.length} energy records from global storage`);
      return formattedData;
    }

    // Last resort: use current chunk if that's all we have
    if (context.currentChunk && context.currentChunk.length > 0) {
      console.log(`⚠️ Warning: Only current chunk available, using ${context.currentChunk.length} records`);
      const extractedData: any[] = [];
      for (const item of context.currentChunk) {
        if (item.cleanedData) {
          if (Array.isArray(item.cleanedData)) {
            extractedData.push(...item.cleanedData);
          } else {
            extractedData.push(item.cleanedData);
          }
        }
      }
      const formattedData = this.formatEnergyData(extractedData);
      return formattedData;
    }

    console.warn(`⚠️ No energy data found in any storage location`);
    return [];
  }

  /**
   * Extract energy data from context (chunk-based for other tools)
   */
  private extractEnergyData(context: ToolCallContext): any[] {
    if (context.currentChunk && context.currentChunk.length > 0) {
      // Extract and format data to match expected structure
      const extractedData: any[] = [];
      for (const item of context.currentChunk) {
        if (item.cleanedData) {
          // If cleanedData is an array, spread it; otherwise, add the item
          if (Array.isArray(item.cleanedData)) {
            extractedData.push(...item.cleanedData);
          } else {
            extractedData.push(item.cleanedData);
          }
        }
      }
      
      // Validate and format data to match expected structure
      const formattedData = this.formatEnergyData(extractedData);
      console.log(`🔍 Extracted and formatted ${formattedData.length} energy records from chunk`);
      console.log(`🔍 Sample data:`, JSON.stringify(formattedData.slice(0, 2), null, 2));
      return formattedData;
    }

    if (context.allStoredData) {
      // Extract from all stored data
      const extractedData = Array.from(context.allStoredData.values()).map(item => item.cleanedData).flat();
      const formattedData = this.formatEnergyData(extractedData);
      console.log(`🔍 Extracted and formatted ${formattedData.length} energy records from all stored data`);
      return formattedData;
    }

    // Fallback: get from global storage
    const allResults = globalDataProcessor.getAllResults();
    const extractedData = Array.from(allResults.values()).map(item => item.cleanedData).flat();
    const formattedData = this.formatEnergyData(extractedData);
    console.log(`🔍 Extracted and formatted ${formattedData.length} energy records from global storage`);
    return formattedData;
  }

  /**
   * Format data to match expected energy data structure
   */
  private formatEnergyData(rawData: any[]): any[] {
    return rawData.map(item => {
      // If the item already has the correct structure, return as-is
      if (item && typeof item === 'object' && item.date && item.installation && Array.isArray(item.values)) {
        return item;
      }
      
      // Try to extract or format the data to match expected structure
      // This might need adjustment based on your actual data structure
      if (item && typeof item === 'object') {
        return {
          date: item.date || item.Date || new Date().toISOString().split('T')[0],
          installation: item.installation || item.Installation || item.site || 'unknown',
          values: Array.isArray(item.values) ? item.values : 
                 Array.isArray(item.data) ? item.data :
                 (typeof item.value === 'number' ? [item.value] : [0])
        };
      }
      
      // Fallback for unexpected data format
      console.warn(`⚠️ Unexpected data format:`, item);
      return {
        date: new Date().toISOString().split('T')[0],
        installation: 'unknown',
        values: [0]
      };
    }).filter(item => item.values.length > 0); // Remove items with no values
  }

  /**
   * Extract processed data from context
   */
  private extractProcessedData(context: ToolCallContext): any[] {
    return this.extractEnergyData(context); // Same logic for now
  }

  /**
   * Generate appropriate file path based on context
   */
  private generateFilePath(baseName: string, context: ToolCallContext): string {
    let filePath: string;
    
    if (context.iteration !== undefined && context.totalChunks !== undefined) {
      // For chunked processing, use iteration-based naming
      filePath = `output/${baseName}_chunk_${context.iteration + 1}_of_${context.totalChunks}.csv`;
    } else {
      // For single calls, use simple predictable naming
      filePath = context.outputPath || `output/${baseName}_latest.csv`;
    }
    
    // Remove leading ./ if present for better MCP server compatibility
    filePath = filePath.replace(/^\.\//, '');
    
    console.log(`📁 Generated file path for ${baseName}: ${filePath}`);
    return filePath;
  }
}

// Singleton instance for global access
export const mcpClientManager = new MCPClientManagerImpl();

/*
How the MCP client connects to multiple stdio servers:

  Each MCP server runs as a separate process with its own stdio transport. Here's the connection flow:

  1. Agent Definition Configuration: Agents specify which MCP servers they need via mcpServers array in their AgentDefinition:
  mcpServers: [
    {
      name: "execution-server",
      transport: "stdio",
      command: "node",
      args: ["./your-execution-server.js"]
    },
    {
      name: "rag-server",
      transport: "stdio",
      command: "uvx",
      args: ["mcp-server-rag"]
    }
  ]
  2. Process Spawning: For each server config, the StdioClientTransport at mcpClient.ts:191-195 spawns a separate child process:
    - Server 1: Spawns node ./your-execution-server.js
    - Server 2: Spawns uvx mcp-server-rag
  3. Independent Communication: Each server has its own stdio channel:
    - Client maintains separate Client instances (line 220)
    - Each with dedicated StdioClientTransport (line 221)
    - Stored in Maps by server name (lines 220-222)
  4. Tool Routing: When executing tools, executeMCPToolCall at genericAgent.ts:874-915 searches all connected servers to find which one provides the requested tool.

  Key Point: Each stdio MCP server is a completely separate process. The client connects to multiple servers by spawning multiple processes and maintaining separate communication channels with each one. Your       
  execute_python and execute_typescript tools will be available once your execution server process is connected alongside your existing RAG server process.
*/