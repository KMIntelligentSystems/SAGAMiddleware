import { WorkingMemory, MCPResource } from '../types/index.js';
import { mcpClientManager } from '../mcp/mcpClient.js';
import { ContextSetDefinition } from '../services/contextRegistry.js';

export class ContextManager {
  private workingMemory: Map<string, WorkingMemory> = new Map();
  private contextHistory: Map<string, WorkingMemory[]> = new Map();
  private mcpResourceCache: Map<string, any> = new Map();
  private cacheTimeout = 300000; // 5 minutes
  private currentContextSet: ContextSetDefinition | null = null;

  setContext(agentName: string, context: WorkingMemory): void {
    const history = this.contextHistory.get(agentName) || [];
    if (this.workingMemory.has(agentName)) {
      history.push(this.workingMemory.get(agentName)!);
    }
    
    this.workingMemory.set(agentName, { ...context });
    this.contextHistory.set(agentName, history);
  }

  getContext(agentName: string): WorkingMemory | undefined {
    return this.workingMemory.get(agentName);
  }

  setActiveContextSet(contextSet?:  ContextSetDefinition){
    this.currentContextSet = contextSet as  ContextSetDefinition;
  }

  updateContext(agentName: string, updates: Partial<WorkingMemory>): void {
    const current = this.workingMemory.get(agentName) || {};
    this.setContext(agentName, { ...current, ...updates });
  }

  clearContext(agentName: string): void {
    this.workingMemory.delete(agentName);
    this.contextHistory.delete(agentName);
  }

  getContextHistory(agentName: string): WorkingMemory[] {
    return this.contextHistory.get(agentName) || [];
  }

  rollbackContext(agentName: string, steps: number = 1): boolean {
    const history = this.contextHistory.get(agentName);
    if (!history || history.length < steps) {
      return false;
    }

    const targetContext = history[history.length - steps];
    this.workingMemory.set(agentName, targetContext);
    this.contextHistory.set(agentName, history.slice(0, -steps));
    return true;
  }

  // MCP-enhanced context methods
  async enrichContextWithMCPResources(agentName: string, resourceUris: string[]): Promise<void> {
    const enrichedData: Record<string, any> = {};
    
    for (const uri of resourceUris) {
      try {
        const resourceData = await this.getMCPResource(uri);
        if (resourceData) {
          const resourceKey = this.getResourceKey(uri);
          enrichedData[resourceKey] = resourceData;
        }
      } catch (error) {
        console.error(`Failed to fetch MCP resource ${uri}:`, error);
        // Continue with other resources even if one fails
      }
    }

    if (Object.keys(enrichedData).length > 0) {
      this.updateContext(agentName, { mcpResources: enrichedData });
    }
  }

  async getMCPResource(uri: string): Promise<any> {
    const cacheKey = `resource:${uri}`;
    const cached = this.mcpResourceCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Try to determine which server has this resource
      const connectedServers = mcpClientManager.getConnectedServers();
      
      for (const serverName of connectedServers) {
        try {
          const resourceData = await mcpClientManager.getResource(serverName, uri);
          
          // Cache the successful result
          this.mcpResourceCache.set(cacheKey, {
            data: resourceData,
            timestamp: Date.now()
          });
          
          return resourceData;
        } catch (error) {
          // Resource not found on this server, try next
          continue;
        }
      }
      
      throw new Error(`Resource ${uri} not found on any connected MCP server`);
    } catch (error) {
      console.error(`Error fetching MCP resource ${uri}:`, error);
      return null;
    }
  }

  async setMCPContext(agentName: string, serverName: string, resourceUris: string[]): Promise<void> {
    try {
      const mcpData: Record<string, any> = {};
      
      for (const uri of resourceUris) {
        const resourceData = await mcpClientManager.getResource(serverName, uri);
        const resourceKey = this.getResourceKey(uri);
        mcpData[resourceKey] = resourceData;
      }
      
      this.updateContext(agentName, {
        mcpData,
        mcpServer: serverName,
        mcpResourceUris: resourceUris
      });
    } catch (error) {
      console.error(`Failed to set MCP context for agent ${agentName}:`, error);
      throw error;
    }
  }

  async refreshMCPContext(agentName: string): Promise<void> {
    const context = this.getContext(agentName);
    if (!context?.mcpServer || !context?.mcpResourceUris) {
      return;
    }

    // Clear cache for these resources to force refresh
    for (const uri of context.mcpResourceUris) {
      const cacheKey = `resource:${uri}`;
      this.mcpResourceCache.delete(cacheKey);
    }

    await this.setMCPContext(agentName, context.mcpServer, context.mcpResourceUris);
  }

  private getResourceKey(uri: string): string {
    // Convert URI to a safe object key
    return uri.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
  }

  // Cache management
  clearMCPCache(): void {
    this.mcpResourceCache.clear();
  }

  getMCPCacheSize(): number {
    return this.mcpResourceCache.size;
  }

  // Cross-agent MCP context sharing
  async shareContextBetweenAgents(sourceAgent: string, targetAgent: string, keys?: string[]): Promise<void> {
    const sourceContext = this.getContext(sourceAgent);
    if (!sourceContext) {
      throw new Error(`Source agent ${sourceAgent} has no context`);
    }

    const targetContext = this.getContext(targetAgent) || {};
    
    if (keys) {
      // Share only specified keys
      const sharedData: Record<string, any> = {};
      for (const key of keys) {
        if (sourceContext.hasOwnProperty(key)) {
          sharedData[key] = sourceContext[key];
        }
      }
      this.updateContext(targetAgent, { [`shared_from_${sourceAgent}`]: sharedData });
    } else {
      // Share all MCP-related context
      const mcpContext: Record<string, any> = {};
      for (const [key, value] of Object.entries(sourceContext)) {
        if (key.startsWith('mcp') || key.includes('mcp')) {
          mcpContext[key] = value;
        }
      }
      if (Object.keys(mcpContext).length > 0) {
        this.updateContext(targetAgent, { [`mcp_shared_from_${sourceAgent}`]: mcpContext });
      }
    }
  }
}