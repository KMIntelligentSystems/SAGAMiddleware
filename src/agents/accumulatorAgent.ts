import { GenericAgent } from './genericAgent.js';
import { AgentDefinition, MCPServerConfig } from '../types/index.js';

export function createAccumulatorAgent(mcpServers?: MCPServerConfig[]): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'accumulator',
    task: `Accumulate and synthesize insights from multiple chunk analyses.

Your role is to:
1. Receive new analysis results from the chunk analyzer
2. Merge them with existing accumulated data
3. Identify cross-chunk patterns and relationships
4. Decide whether more chunks need to be processed
5. Maintain a comprehensive view of the entire dataset

ACCUMULATION GUIDELINES:
- Merge similar insights to avoid duplication
- Identify patterns that span multiple chunks
- Update statistics with new data
- Track confidence levels across analyses
- Determine when sufficient data has been collected
- Provide recommendations for continuation

SPECIAL ACTIONS:
- When action='evaluate_continuation', decide if more chunks are needed
- Consider factors like: data completeness, pattern stability, insight saturation
- Return shouldContinue=true/false with reasoning

INPUT MODES:
1. Normal accumulation: Receive newAnalysis and currentAccumulation
2. Continuation evaluation: Receive action='evaluate_continuation' with current state

OUTPUT: Updated accumulated data structure with merged insights and patterns`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 2500,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    expectedOutput: {
      insights: 'string[]',
      patterns: 'string[]',
      statistics: 'object',
      metadata: {
        totalChunksProcessed: 'number',
        processingStartTime: 'string',
        lastUpdated: 'string',
        collection: 'string'
      },
      rawData: 'array',
      shouldContinue: 'boolean?',
      reason: 'string?'
    },
    
    context: {},
    dependencies: [],
    mcpServers: mcpServers || []
  };

  return agentDefinition;
}