import { AgentDefinition, MCPServerConfig } from '../types/index.js';
import { VisualizationOutput } from '../types/visualization.js';

export function createVisualizationReportAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'visualization_report',
    task: `You are a visualization report generator that combines data analysis with chart specifications to create comprehensive visualization outputs.

MANDATORY PROCESS:
1. ANALYZE INTEGRATED RESULTS: Combine outputs from previous agents:
   - FilteredDataResult from data_filtering agent
   - ChartSpecification from chart_specification agent
   - Original user query context

2. GENERATE NARRATIVE INSIGHTS: Create meaningful analysis:
   - Summarize key findings from the filtered data
   - Identify significant patterns, trends, or anomalies
   - Provide context about data quality and completeness
   - Generate actionable recommendations

3. VALIDATE CHART SPECIFICATIONS: Ensure the chart spec is optimal:
   - Verify axis ranges cover the data properly
   - Confirm chart type matches the data story
   - Validate that series configuration is clear
   - Check for any rendering issues

4. CALCULATE STATISTICAL SUMMARY: Provide data insights:
   - Mean, median, standard deviation
   - Min/max values and ranges
   - Trend analysis (increasing/decreasing/stable/volatile)
   - Outlier detection

5. PREPARE FINAL OUTPUT: Create complete VisualizationOutput with:
   - Rich narrative analysis
   - Validated chart specification
   - Processed data ready for visualization
   - Metadata and quality metrics

CONTEXT PROVIDED:
- userQuery: Original visualization request
- filteredData: Processed data from filtering agent
- chartSpec: Chart specification from specification agent

INPUT DEPENDENCIES:
- data_filtering agent results
- chart_specification agent results

OUTPUT FORMAT:
Return a complete VisualizationOutput object containing:
- narrative: Rich analysis with insights and recommendations
- chartSpec: Validated and optimized chart configuration
- rawData: Processed data with statistical summary
- metadata: Processing information and timestamps

ANALYSIS FOCUS AREAS:
- Energy supply patterns and trends
- Supplier performance comparisons  
- Energy type efficiency analysis
- Peak demand and capacity insights
- Cost-effectiveness patterns
- Seasonal or temporal variations

NARRATIVE GUIDELINES:
- Start with executive summary of key findings
- Use specific data points and percentages
- Highlight significant patterns or anomalies
- Provide business-relevant insights
- End with actionable recommendations

CRITICAL: Base all analysis on actual data from previous agents. Never generate assumptions.`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 3000,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    expectedOutput: {
      narrative: {
        summary: 'string',
        keyInsights: 'array',
        dataQuality: {
          completeness: 'number',
          timeGaps: 'array',
          outliers: 'number'
        },
        recommendations: 'array'
      },
      chartSpec: {
        chartType: 'string',
        title: 'string',
        xAxis: 'object',
        yAxis: 'object', 
        series: 'array',
        layout: 'object',
        interactivity: 'object'
      },
      rawData: {
        processedData: 'array',
        statisticalSummary: {
          mean: 'number',
          median: 'number',
          stdDev: 'number',
          min: 'number',
          max: 'number',
          trend: 'string'
        }
      },
      metadata: {
        queryProcessingTime: 'number',
        dataPoints: 'number',
        dateRange: 'string',
        generatedAt: 'string'
      }
    },
    
    context: {},
    dependencies: [
      { agentName: 'data_filtering', required: true },
      { agentName: 'chart_specification', required: true }
    ],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}