import { AgentDefinition, MCPServerConfig } from '../types/index.js';
import { VisualizationRequest, FilteredDataResult } from '../types/visualization.js';

export function createDataFilteringAgent(mcpServers: MCPServerConfig[]): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'data_filtering',
    task: `You are a data filtering agent that processes user visualization requests and retrieves relevant energy supply data.

MANDATORY PROCESS:
1. PARSE USER QUERY: Analyze the user's natural language request to extract:
   - Time range (if specified, otherwise use full dataset)
   - Energy types of interest (coal, gas, green, or all)
   - Specific suppliers (if mentioned, otherwise all)
   - Metrics of interest (output, efficiency, cost)
   - Aggregation level needed (raw 5-min data vs hourly/daily summaries)

2. CONSTRUCT SEMANTIC SEARCH: Use semantic_search tool to find relevant data based on:
   - Energy type keywords from user query
   - Time-related terms
   - Performance/efficiency keywords
   - Supplier names if specified

3. GET TARGETED CHUNKS: Use get_chunks tool with:
   - collection: "supply_analysis" 
   - limit: Determine based on time range (more chunks for detailed analysis)
   - Apply intelligent chunking based on user's temporal scope

4. FILTER AND STRUCTURE: Process the retrieved data to:
   - Filter by time range if specified
   - Filter by energy types if specified  
   - Filter by suppliers if specified
   - Extract relevant metrics
   - Calculate basic statistics

CONTEXT PROVIDED:
- userQuery: The user's natural language visualization request
- collection: Always "supply_analysis"
- maxChunks: Maximum chunks to retrieve (default 50 for performance)

TOOL USAGE REQUIREMENTS:
- ALWAYS start with semantic_search to understand data relevance
- Follow with get_chunks for targeted data retrieval
- Use the actual tool responses - never generate mock data

OUTPUT FORMAT:
Return a FilteredDataResult with:
- data: Array of processed data points matching user criteria
- metadata: Summary of data scope and filtering applied
- queryInfo: Details about the query processing

CRITICAL: Always use tools before responding. The data must come from actual RAG server responses.`,
    
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 2000,
      apiKey: process.env.OPENAI_API_KEY
    },
    
    expectedOutput: {
      data: 'array',
      metadata: {
        totalRecords: 'number',
        timeRange: { start: 'string', end: 'string' },
        suppliers: 'array',
        energyTypes: 'array',
        aggregationLevel: 'string'
      },
      queryInfo: {
        originalQuery: 'string',
        filtersApplied: 'object',
        processingTime: 'number'
      }
    },
    
    context: {
      collection: 'supply_analysis',
      maxChunks: 50
    },
    dependencies: [],
    mcpServers,
    mcpTools: ['semantic_search', 'get_chunks']
  };

  return agentDefinition;
}

export function createChartSpecificationAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'chart_specification',
    task: `You are a chart specification agent that analyzes filtered energy data and user requirements to create optimal visualization specifications.

MANDATORY PROCESS:
1. ANALYZE FILTERED DATA: Examine the data structure, patterns, and scope:
   - Time range and granularity
   - Number of suppliers and energy types
   - Data density and completeness
   - Value ranges and distributions

2. INFER CHART REQUIREMENTS: Based on user query and data characteristics:
   - Determine best chart type (line for time series, bar for comparisons, heatmap for patterns)
   - Identify optimal X and Y axes
   - Determine if grouping/series are needed
   - Calculate appropriate axis ranges and scales

3. OPTIMIZE FOR READABILITY: Ensure the chart will be:
   - Clear and not overcrowded
   - Properly scaled for the data range
   - Appropriately aggregated if too many data points
   - Color-coded logically

4. GENERATE SPECIFICATIONS: Create complete ChartSpecification object with:
   - Chart type and layout
   - Axis definitions with proper scales and labels
   - Series configuration for multi-dimensional data
   - Interactive features appropriate for the data

CONTEXT PROVIDED:
- filteredData: The processed data from the filtering agent
- userQuery: Original user visualization request
- dataMetadata: Information about data scope and characteristics

INPUT EXPECTATIONS:
- FilteredDataResult from data_filtering agent
- Original user query for context

OUTPUT FORMAT:
Return a complete ChartSpecification object ready for rendering.

CHART TYPE SELECTION LOGIC:
- Time series data → line chart
- Categorical comparisons → bar chart  
- Correlation analysis → scatter plot
- Multi-dimensional patterns → heatmap
- Cumulative data → area chart

CRITICAL: Base all specifications on actual data characteristics, not assumptions.`,
    
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.1,
      maxTokens: 2000,
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    
    expectedOutput: {
      chartType: 'string',
      title: 'string',
      xAxis: {
        field: 'string',
        label: 'string',
        type: 'string',
        range: 'array'
      },
      yAxis: {
        field: 'string',  
        label: 'string',
        type: 'string',
        range: 'array',
        unit: 'string'
      },
      series: 'array',
      layout: 'object',
      interactivity: 'object'
    },
    
    context: {},
    dependencies: [
      { agentName: 'data_filtering', required: true }
    ],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}