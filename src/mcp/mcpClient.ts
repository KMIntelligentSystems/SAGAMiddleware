//import { Client } from '@modelcontextprotocol/sdk/client/index';
//import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { MCPServerConfig, MCPToolCall, MCPResource } from '../types/index.js';

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface MCPClientManager {
  connect(serverConfig: MCPServerConfig): Promise<void>;
  disconnect(serverName: string): Promise<void>;
  listTools(serverName?: string): Promise<any[]>;
  callTool(serverName: string, toolCall: MCPToolCall): Promise<any>;
  getResource(serverName: string, resourceUri: string): Promise<any>;
  listResources(serverName?: string): Promise<MCPResource[]>;
  isConnected(serverName: string): boolean;
}

export class MCPClientManagerImpl implements MCPClientManager {
  private clients = new Map<string, any>();
  private transports = new Map<string, any>();
  private serverConfigs = new Map<string, MCPServerConfig>();

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

  async callTool(serverName: string, toolCall: MCPToolCall): Promise<any> {
    const client = this.getClient(serverName);
    const serverConfig = this.serverConfigs.get(serverName);
    const timeout = serverConfig?.timeout || 120000;
    
    try {
      console.log(`MCP Client calling tool ${toolCall.name} on server ${serverName} with arguments:`, toolCall.arguments);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tool call timed out after ${timeout}ms`)), timeout);
      });
      
      // Race between the tool call and timeout
      const response = await Promise.race([
        client.callTool({
          name: toolCall.name,
          arguments: toolCall.arguments
        }),
        timeoutPromise
      ]) as any;
      
      // Return the content directly, handling different content types
     console.log(`MCP tool ${toolCall.name} raw response:`, JSON.stringify(response, null, 2));
      
      if (Array.isArray(response.content)) {
        // Handle MCP response format: content is array of objects with type and text
        if (response.content.length > 0 && response.content[0].type === 'text') {
          try {
            // Try to parse the text content as JSON
            const textContent = response.content[0].text;
            const parsedContent = JSON.parse(textContent);
            console.log(`Parsed ${toolCall.name} content:`, Array.isArray(parsedContent) ? `Array with ${parsedContent.length} items` : typeof parsedContent);
            return parsedContent;
          } catch (parseError) {
            console.log(`Could not parse text content as JSON, returning as string:`, response.content[0].text);
            return response.content[0].text;
          }
        }
        return response.content;
      }
      return response.content;
    } catch (error) {
      throw new Error(`MCP tool call failed for ${toolCall.name} on server ${serverName}: ${error instanceof Error ? error.message : String(error)}`);
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
      } catch (error) {
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
}

// Singleton instance for global access
export const mcpClientManager = new MCPClientManagerImpl();