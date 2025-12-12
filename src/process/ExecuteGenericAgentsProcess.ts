// ExecuteGenericAgentsProcess - Modified to use AgentDefinition[] instead of SagaTransaction[]
// This version shows how to replace SagaTransaction with AgentDefinition array from DataProfiler

import { GenericAgent } from '../agents/genericAgent.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AgentResult, WorkingMemory, AgentDefinition, MCPServerConfig } from '../types/index.js';
import { CreatedAgentInfo } from '../agents/dataProfiler.js';
import { dataProfilerError, pythonSuccessResult } from '../test/histogramData.js';
import { ContextManager } from '../sublayers/contextManager.js';
import * as fs from 'fs';

/**
 * ExecuteGenericAgentsProcess - Modified Version
 *
 * This version accepts AgentDefinition[] (from DataProfiler's CreatedAgentInfo[])
 * instead of SagaTransaction[]
 *
 * Key Changes:
 * 1. Input: Array of AgentDefinition instead of TransactionSetCollection
 * 2. Uses AgentDefinition.name instead of SagaTransaction.agentName
 * 3. Uses AgentDefinition.agentType instead of SagaTransaction.agentType
 * 4. Uses AgentDefinition.taskDescription instead of SagaTransaction.transactionPrompt
 */
export class ExecuteGenericAgentsProcess {
  private agent: string;
  private contextManager: ContextManager;//coordinator: SagaCoordinator;
  private targetAgent: string;
  private mcpServers: Record<string, MCPServerConfig>;

  constructor(
    agent: string,
    contextManager: ContextManager,//coordinator: SagaCoordinator,
    targetAgent: string,
    mcpServers?: Record<string, MCPServerConfig>
  ) {
   this.agent = agent; // FlowDefiningAgent
    this.contextManager = contextManager;
    this.targetAgent = targetAgent;
    this.mcpServers = mcpServers || this.getDefaultMCPServers();
  }

  /**
   * Get default MCP servers configuration
   * This matches the configuration used in sagaCoordinator
   */
  private getDefaultMCPServers(): Record<string, MCPServerConfig> {
    return {
      execution: {
        name: 'execution',
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-server-execution'],
        transport: 'stdio' as const
      }
    };
  }

  /**
   * Intelligently determine which MCP servers are needed based on the tools an agent requires
   * This mirrors the logic in sagaCoordinator.getServersForTools()
   */
  private getServersForTools(tools: string[]): MCPServerConfig[] {
    const serverMap: Record<string, keyof typeof this.mcpServers> = {
      'execute_python': 'execution',
      'execute_typescript': 'execution'
    };

    const requiredServers = new Set<keyof typeof this.mcpServers>();
    tools.forEach(tool => {
      const server = serverMap[tool];
      if (server && this.mcpServers[server]) {
        requiredServers.add(server);
      }
    });

    // If no specific mapping found, provide all available servers as fallback
    if (requiredServers.size === 0) {
      console.log(`⚠️ No server mapping found for tools: ${tools.join(', ')}. Providing all available servers.`);
      return Object.values(this.mcpServers);
    }

    const selectedServers = Array.from(requiredServers).map(key => this.mcpServers[key]).filter(Boolean);
    console.log(`🎯 Selected MCP servers for tools [${tools.join(', ')}]: ${selectedServers.map(s => s.name).join(', ')}`);

    return selectedServers;
  }

  /**
   * Execute generic agent using AgentDefinition array
   */
  async execute(): Promise<AgentResult> {
    const ctx = this.contextManager.getContext(this.agent) as WorkingMemory;

    // Parse the CreatedAgentInfo array (contains AgentDefinition objects)
    let agentDefinitions: AgentDefinition[];
    try {
      // DataProfiler stores CreatedAgentInfo[] which has structure: { definition: AgentDefinition, order: number }
      const createdAgentInfos: CreatedAgentInfo[] = JSON.parse(ctx.lastTransactionResult);

      // Extract and sort AgentDefinition objects by order
      agentDefinitions = createdAgentInfos
        .sort((a, b) => a.order - b.order)
        .map(info => info.definition);

      console.log('AGENT DEFINITIONS FROM DATAPROFILER', JSON.stringify(agentDefinitions, null, 2));
    } catch (error) {
      console.error('Failed to parse agent definitions:', error);
      console.error('Raw data:', ctx.lastTransactionResult);
      throw new Error('Invalid agent definition data');
    }

    // Get error state from context
    let hasError = false;
    let correctedCode = '';
    let agentInError = '';
    if (ctx.hasError) {
      hasError = true;
      correctedCode = ctx.codeInErrorResult;
      agentInError = ctx.agentInError;
    }

    console.log('AGENT IN ERROR ', agentInError);

    // Execute agents
    let result: AgentResult = {
      agentName: '',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };

    agentDefinitions.forEach(def => {
      console.log('EXEC NAME ', def.name);
    });

    if (agentDefinitions.length > 1) {
      result = await this.executeAgentsWithLinearContext(agentDefinitions, hasError, correctedCode, agentInError);
    }

    return result;
  }

  /**
   * Execute a single agent (singleton pattern)
   *
   * CHANGES FROM ORIGINAL:
   * - Parameter: AgentDefinition instead of SagaTransaction
   * - Uses: definition.name instead of transaction.agentName
   */
 /* private async executeAgentWithSingletonContext(
    definition: AgentDefinition
  ): Promise<AgentResult> {
    console.log('SINGLETON ', definition.name);

    // Look up the agent by name
    const agent = this.agent;//coordinator.agents.get(definition.name);

    if (!agent) {
      throw new Error(`Agent ${definition.name} not found`);
    }

    // Execute the agent
    const result =await  agent.execute({});

    console.log('🔍 Singleton execution result:', JSON.stringify(result, null, 2).substring(0, 300));

    // Store result in both agent's own context and target agent context
    this.contextManager.updateContext(this.agent.getName(), {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    console.log('target agent 1', this.targetAgent);
    this.contextManager.updateContext(this.targetAgent, {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    return result;
  }*/

  /**
   * Execute multiple agents in linear sequence
   *
   * CHANGES FROM ORIGINAL:
   * - Parameter: AgentDefinition[] instead of SagaTransaction[]
   * - Uses: definition.name instead of transaction.agentName
   * - Uses: definition.agentType instead of transaction.agentType
   * - Uses: definition.taskDescription for code extraction
   */
  private async executeAgentsWithLinearContext(
    agentDefinitions: AgentDefinition[],
    inError: boolean,
    correctedCode: string,
    inErrorAgent: string
  ): Promise<AgentResult> {
    const firstAgent = agentDefinitions[0].name;
    let result: AgentResult = {
      agentName: '',
      result: '',
      success: true,
      timestamp: new Date()
    };

  
    for (const definition of agentDefinitions) {
      console.log('LINEAR AGENT DEFINITION ', definition);
      console.log('LINEAR AGENT NAME', definition.name);
      console.log('LINEAR AGENT TYPE', definition.agentType);

      // CHANGE: Use definition.agentType instead of transaction.agentType
      if (definition.agentType === 'tool') {
        console.log(`🔧 Executing tool agent: ${definition.name}`);

        // Configure MCP servers for tool agent (mirrors sagaCoordinator.registerAgent logic)
        if (definition.mcpTools && definition.mcpTools.length > 0) {
          // Use getServersForTools to determine which servers this agent needs
          definition.mcpServers = this.getServersForTools(definition.mcpTools);
        } else if (!definition.mcpServers || definition.mcpServers.length === 0) {
          // Fallback: if it's a tool agent but no tools specified, provide execution server
          definition.mcpServers = this.getServersForTools(['execute_python']);
          console.log(`🔧 Tool agent ${definition.name} has no specific tools defined, providing execution server`);
        }

        // Configure LLM for this agent if not already set
        if (!definition.llmConfig) {
          definition.llmConfig = {
            provider: 'openai',
            model: 'gpt-5',
            temperature: 1,
            maxTokens: 2000,
            apiKey: process.env.OPENAI_API_KEY
          };
        }

        console.log(`🔧 Agent: ${definition.name}`);
        console.log(`🔧 MCP servers: ${definition.mcpServers?.map(s => s.name).join(', ') || 'none'}`);
        console.log(`🔧 MCP tools: ${definition.mcpTools?.join(', ') || 'none'}`);

        const toolCallingAgent = new GenericAgent(definition);
        toolCallingAgent.deleteContext();

        let cleanCode = '';

        // CHANGE: Check error using definition.name instead of transaction.agentName
        if (inError && inErrorAgent === definition.name) {
          cleanCode = this.cleanPythonCode(correctedCode).trim();
          console.log('CLEAN CODE EXEC (corrected)', cleanCode);
        } else {
          // CHANGE: Extract Python code from definition.taskDescription
          // DataProfiler stores Python code in taskDescription field
          cleanCode = this.cleanPythonCode(definition.taskDescription).trim();
          console.log('CLEAN CODE EXEC (from definition)', cleanCode);
        }

        try {
          // Execute the tool calling agent with the Python code
          result.result =  //await toolCallingAgent.execute({'CODE:': cleanCode}) as AgentResult;

          console.log('TOOL CALL ' + definition.name, result);
          console.log('TOOL CALL SUCCESS FLAG: ', result.success);

          // Interpret and enrich the result for downstream agents
          if (result.success && result.result) {
            result.result = this.interpretToolResult(result.result, definition.name);
          }

          if (!result.success) {
            // CHANGE: Store definition instead of transaction in error context
            this.contextManager.updateContext(this.targetAgent, {
              lastTransactionResult: result.result,
              codeInErrorResult: definition.taskDescription, // Store the task description (Python code)
              agentInError: definition.name, // Store agent name
              hasError: true,
              success: false,
              transactionId: '',
              timestamp: new Date()
            });
            result.error = result.result;
            break;
          }
        } catch (error) {
          console.error(`❌ Tool execution failed:`, error);
          result = {
            agentName: 'ToolCallingAgent',
            result: `Error: ${error}`,
            success: false,
            timestamp: new Date()
          };
          break;
        }
      }
    }

    console.log('RESULT_2', result.result);
    console.log('RESULT_2_1', result.success);
 //result.result =  fs.readFileSync('C:/repos/SAGAMiddleware/data/histogramMCPResponse_1.txt', 'utf-8');
    // After all agents complete, retrieve persisted data
    if (result.success) {
      const persistedData = result.result//fs.readFileSync('C:/repos/SAGAMiddleware/data/histogramMCPResponse.txt', 'utf-8');
      if (persistedData) {
        console.log('📊 Persisted dictionary retrieved successfully');
        this.contextManager.updateContext(this.targetAgent, {
          lastTransactionResult: persistedData,
          hasError: false,
          success: true,
          transactionId: '',
          timestamp: new Date()
        });
        
      }
    }

    return result;
  }

  /**
   * Interpret and enrich tool execution results for downstream agents
   * Handles cases where the result is a schema, partial data, or needs context
   */
  private interpretToolResult(rawResult: any, agentName: string): any {
    try {
      // If result is a string, try to parse it
      let parsedResult = rawResult;
      if (typeof rawResult === 'string') {
        try {
          parsedResult = JSON.parse(rawResult);
        } catch (e) {
          // Not JSON, return as-is
          return rawResult;
        }
      }

      // Check if this is a JSON Schema (has "type", "properties", "required")
      if (parsedResult &&
          typeof parsedResult === 'object' &&
          parsedResult.type === 'object' &&
          parsedResult.properties &&
          parsedResult.required) {

        console.log(`⚠️ Agent ${agentName} returned a JSON Schema instead of data`);

        // Create a helpful wrapper for the coding agent
        return {
          dataType: 'schema',
          schemaDescription: this.generateSchemaDescription(parsedResult),
          originalSchema: parsedResult,
          message: `This is a data structure schema. The actual data should follow this format. Use this schema to understand the expected data structure for visualization.`
        };
      }

      // If it looks like actual data with bins, enhance it
      if (parsedResult && parsedResult.bins && Array.isArray(parsedResult.bins)) {
        console.log(`✅ Agent ${agentName} returned histogram data with ${parsedResult.bins.length} bins`);
        return {
          dataType: 'histogram_data',
          data: parsedResult,
          message: `Histogram data with ${parsedResult.bins.length} bins. Use this data directly for D3.js visualization.`
        };
      }

      // Return as-is if we can't interpret it
      return parsedResult;
    } catch (error) {
      console.error(`Error interpreting tool result from ${agentName}:`, error);
      return rawResult;
    }
  }

  /**
   * Generate a human-readable description from a JSON Schema
   */
  private generateSchemaDescription(schema: any): string {
    const descriptions: string[] = [];

    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop = value as any;
        if (prop.type === 'array') {
          descriptions.push(`- ${key}: Array of ${prop.items?.type || 'items'}`);
        } else if (prop.type === 'object') {
          descriptions.push(`- ${key}: Object with properties`);
        } else {
          descriptions.push(`- ${key}: ${prop.type}`);
        }
      }
    }

    return `Data structure contains:\n${descriptions.join('\n')}`;
  }

  /**
   * Clean Python code from string format
   * (Same as original - no changes needed)
   */
  private cleanPythonCode(rawCode: string): string {
    let cleaned = rawCode.trim();

    // Step 0: Check if the input is an object string (contains agentName, result, etc.)
    if (cleaned.includes('agentName:') && cleaned.includes('result:')) {
      const resultMatch = cleaned.match(/result:\s*(['"])([\s\S]*?)(?=,\s*(?:success|timestamp|\}))/);
      if (resultMatch) {
        cleaned = resultMatch[2];
        cleaned = resultMatch[1] + cleaned;
      }
    }

    // Step 1: Convert escaped newlines to actual newlines
    cleaned = cleaned.replace(/\\n/g, '\n');

    // Step 2: Remove string concatenation operators
    cleaned = cleaned.replace(/'\s*\+\s*\n\s*'/gm, '\n');
    cleaned = cleaned.replace(/"\s*\+\s*\n\s*"/gm, '\n');
    cleaned = cleaned.replace(/\s*\+\s*$/gm, '');

    // Step 3: Remove the first and last quotes
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^['"]/, '');
    cleaned = cleaned.replace(/['"]$/, '');

    // Step 4: Handle escaped quotes
    cleaned = cleaned.replace(/\\'/g, "'");
    cleaned = cleaned.replace(/\\"/g, '"');

    // Step 5: Convert backticks to single quotes
    cleaned = cleaned.replace(/`/g, "'");

    // Step 6: Clean up each line while preserving Python indentation
    const lines = cleaned.split('\n');
    const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
    cleaned = trimmedLines.join('\n').trim();

    return cleaned;
  }
}

/**
 * SUMMARY OF CHANGES:
 *
 * 1. INPUT FORMAT:
 *    OLD: TransactionSetCollection { sets: TransactionSet[] { transactions: SagaTransaction[] } }
 *    NEW: CreatedAgentInfo[] { definition: AgentDefinition, order: number }
 *
 * 2. FIELD MAPPINGS:
 *    - SagaTransaction.agentName     → AgentDefinition.name
 *    - SagaTransaction.agentType     → AgentDefinition.agentType
 *    - SagaTransaction.transactionPrompt → AgentDefinition.taskDescription
 *    - SagaTransaction.id            → AgentDefinition.id
 *
 * 3. BENEFITS:
 *    - Eliminates need for intermediate transformation
 *    - Direct use of DataProfiler output
 *    - Simpler data structure (no nested TransactionSetCollection)
 *    - Access to full AgentDefinition (llmConfig, mcpServers, etc.) if needed
 *
 * 4. USAGE:
 *    const process = new ExecuteGenericAgentsProcess(
 *      flowDefiningAgent,
 *      coordinator,
 *      'TargetAgent'
 *    );
 *    // Context should contain CreatedAgentInfo[] from DataProfiler
 *    const result = await process.execute();
 */
