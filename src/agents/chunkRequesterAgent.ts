import { GenericAgent } from './genericAgent.js';
import { AgentDefinition, MCPServerConfig } from '../types/index.js';

export function createChunkRequesterAgent(mcpServers: MCPServerConfig[]): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'chunk_requester',
    agentType: 'tool',
    task: `You MUST use the get_chunks tool to retrieve actual data. Do not generate any content without calling tools first.

MANDATORY TOOL USAGE:
1. FIRST: Call get_chunks tool with collection parameter from context
2. Use the exact tool response data - never generate mock data
3. Transform tool response into expected output format

CONTEXT PROVIDED:
- collection: The collection name to retrieve chunks from  
- limit: Number of chunks to retrieve (default: 10)
- offset: Starting position for pagination (default: 0)
- currentBatch: Current batch number being processed

TOOL CALL REQUIREMENTS:
- ALWAYS call get_chunks tool before responding
- Use collection from context (typically "supply_analysis")
- Include limit and offset if provided in context
- Return actual tool response data only

OUTPUT FORMAT:
Transform the actual tool response into:
- chunks: exact array returned by tool
- chunkCount: actual array length from tool
- hasMoreChunks: boolean based on returned count vs limit
- requestMetadata: with actual request parameters used

CRITICAL: You must call the get_chunks tool. Do not proceed without using tools.`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 1000,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    expectedOutput: {
      chunks: 'array',
      chunkCount: 'number',
      hasMoreChunks: 'boolean',
      requestMetadata: {
        collection: 'string',
        limit: 'number',
        offset: 'number',
        batchNumber: 'number'
      }
    },
    
    context: {},
    dependencies: [],
    mcpServers,
    mcpTools: ['get_chunks']
  };

  return agentDefinition;
}