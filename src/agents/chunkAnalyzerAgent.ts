import { GenericAgent } from './genericAgent.js';
import { AgentDefinition, MCPServerConfig } from '../types/index.js';

export function createChunkAnalyzerAgent(mcpServers?: MCPServerConfig[]): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'chunk_analyzer',
    agentType: 'processing',
    backstory: '',
   taskDescription: `Analyze individual chunks of data and extract insights.

Your role is to:
1. Receive a chunk of data from the chunk requester
2. Analyze the content for patterns, insights, and statistics
3. Consider the accumulated context from previous chunks
4. Extract meaningful information without duplication
5. Return structured analysis results

ANALYSIS GUIDELINES:
- Look for patterns, trends, and anomalies
- Extract key statistics and metrics
- Identify relationships and correlations
- Note any quality issues or data inconsistencies
- Consider how this chunk relates to previously processed data
- Provide confidence scores for your insights

INPUT: You will receive:
- chunk: The raw data chunk to analyze
- accumulatedContext: Previous insights and patterns found
- chunkState: Metadata about this chunk's processing

OUTPUT: Return structured analysis with:
- insights: New insights discovered in this chunk
- patterns: Patterns or trends identified
- statistics: Numerical metrics and measurements
- confidence: How confident you are in the analysis (0-1)
- metadata: Additional context about the analysis`,
    
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.4,
      maxTokens: 2000,
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    
    taskExpectedOutput: '',/*{
      chunkId: 'string',
      insights: 'string[]',
      patterns: 'string[]',
      statistics: 'object',
      confidence: 'number',
      metadata: {
        analysisType: 'string',
        dataQuality: 'string',
        processingTime: 'number',
        uniqueElements: 'number'
      }
    },*/
    
    context: {},
    dependencies: [],
    mcpServers: mcpServers || []
  };

  return agentDefinition;
}