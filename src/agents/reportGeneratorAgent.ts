import { GenericAgent } from './genericAgent.js';
import { AgentDefinition, MCPServerConfig } from '../types/index.js';

export function createReportGeneratorAgent(mcpServers?: MCPServerConfig[]): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'report_generator',
    task: `Generate a comprehensive final report from accumulated data analysis.

Your role is to:
1. Receive all accumulated insights, patterns, and statistics
2. Synthesize findings into a coherent narrative
3. Create executive summary with key findings
4. Provide actionable recommendations
5. Include supporting data and visualizations
6. Structure the report professionally

REPORT STRUCTURE:
1. Executive Summary
   - Key findings overview
   - Critical insights
   - Main recommendations

2. Data Analysis Overview
   - Dataset characteristics
   - Processing summary
   - Quality assessment

3. Detailed Findings
   - Primary insights with evidence
   - Pattern analysis
   - Statistical highlights
   - Trend identification

4. Recommendations
   - Actionable next steps
   - Areas for further investigation
   - Risk considerations

5. Appendices
   - Detailed statistics
   - Processing metadata
   - Technical notes

INPUT: You will receive:
- accumulatedData: All insights, patterns, and statistics
- workflowSummary: Processing metrics and metadata

OUTPUT: Comprehensive structured report with clear sections and actionable insights`,
    
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.3,
      maxTokens: 4000,
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    
    expectedOutput: {
      title: 'string',
      executiveSummary: 'string',
      keyFindings: 'string[]',
      detailedAnalysis: 'string',
      recommendations: 'string[]',
      supportingData: {
        totalChunksAnalyzed: 'number',
        processingTimeMs: 'number',
        insightCount: 'number',
        patternCount: 'number',
        confidenceScore: 'number'
      },
      appendices: {
        statisticalSummary: 'object',
        processingMetadata: 'object',
        rawInsights: 'string[]'
      },
      generatedAt: 'string'
    },
    
    context: {},
    dependencies: [],
    mcpServers: mcpServers || []
  };

  return agentDefinition;
}