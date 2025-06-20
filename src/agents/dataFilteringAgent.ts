import { AgentDefinition, MCPServerConfig } from '../types/index.js';
import { VisualizationRequest, FilteredDataResult } from '../types/visualization.js';

export function createDataFilteringAgent(mcpServers: MCPServerConfig[]): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'data_filtering',
    backstory: '',
    agentType: 'tool',
    taskDescription: `You are a data filtering agent that processes user visualization requests and retrieves relevant energy supply data.

MANDATORY PROCESS:
1. PARSE USER QUERY: Analyze the user's natural language request to extract:
   - Time range (if specified, otherwise use full dataset)
   - Energy types of interest (coal, gas, green, or all)
   - Specific suppliers (if mentioned, otherwise all)
   - Metrics of interest (output, efficiency, cost)
   - Aggregation level needed (raw 5-min data vs hourly/daily summaries)

2. CONSTRUCT SEMANTIC SEARCH: Use semantic_search tool with query AND collection parameters:
   - Create a single search query string combining energy type keywords, time terms, and performance keywords
   - Example: "coal energy output trends November 2023"
   - CRITICAL: ALWAYS pass the collection parameter from context.collection
   - semantic_search requires: {"query": "search string", "collection": "supply_analysis"}
   - DO NOT use complex objects, filters, or timeRange parameters beyond query and collection

3. GET TARGETED CHUNKS: Use get_chunks tool with these EXACT parameters:
   - collection: "supply_analysis" (LOOK IN attached record: context.collection)
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
- MANDATORY: Only use semantic_search and get_chunks tools
- ALWAYS start with semantic_search to understand data relevance
- Follow with get_chunks for targeted data retrieval using collection "supply_analysis"
- NEVER use search_documents, query_database, or any other tools not listed
- Use the actual tool responses - never generate mock data

AVAILABLE TOOLS ONLY:
1. semantic_search(query: string, collection: string) - requires query and collection parameters
2. get_chunks(collection: "supply_analysis", limit: number) - for retrieving data chunks

CORRECT TOOL CALL EXAMPLES:
✅ semantic_search({"query": "coal energy output trends November 2023", "collection": "supply_analysis"})
✅ get_chunks({"collection": "supply_analysis", "limit": 50})

DO NOT use any other tools. These are the only two tools available.
CRITICAL REMINDERS:
- semantic_search: requires both query and collection parameters, no complex objects
- get_chunks: collection must ALWAYS be "supply_analysis"

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
    
    taskExpectedOutput: '',/* {
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
    },*/
    
    context: {
      collection: 'supply_analysis',
      maxChunks: 50
    },
    dependencies: [],
    mcpServers,
    mcpTools: ['semantic_search']
  };

  return agentDefinition;
}

export function createChartSpecificationAgent(): AgentDefinition {
  const agentDefinition: AgentDefinition = {
    name: 'chart_specification',
    backstory: '',
    agentType: 'processing',
    taskDescription: `You are a chart specification agent that analyzes filtered energy data and user requirements to create detailed, optimal visualization specifications.

MANDATORY PROCESS:
1. ANALYZE FILTERED DATA: Examine the data structure, patterns, and scope:
   - Time range and granularity (hourly/5-min intervals)
   - Number of suppliers and energy types
   - Data density and completeness
   - Value ranges and distributions
   - Temporal patterns (daily cycles, peak hours, trends)

2. INFER CHART REQUIREMENTS: Based on user query and data characteristics:
   - Determine best chart type (line for time series, bar for comparisons, heatmap for patterns)
   - Identify optimal X and Y axes with appropriate time formatting
   - Determine if grouping/series are needed for multiple suppliers/energy types
   - Calculate appropriate axis ranges with proper margins
   - Consider temporal aggregation needs (5-min, hourly, daily)

3. OPTIMIZE FOR READABILITY: Ensure the chart will be:
   - Clear and not overcrowded (aggregate if >100 points)
   - Properly scaled for the data range with 10% margins
   - Time axis formatted appropriately (hours for <7 days, days for longer periods)
   - Color-coded logically (consistent colors for energy types)
   - Interactive features for detailed exploration

4. GENERATE SPECIFICATIONS: Create complete ChartSpecification object with:
   - Chart type and layout optimized for data density
   - X-axis with proper time formatting and tick intervals
   - Y-axis with appropriate scales, units, and ranges based on actual data
   - Series configuration for multi-dimensional data with proper labels
   - Interactive features (tooltips, zoom, hover) appropriate for the temporal data
   - Aggregation rules if data is too dense

CONTEXT PROVIDED:
- filteredData: The processed data from the filtering agent
- userQuery: Original user visualization request
- dataMetadata: Information about data scope and characteristics

INPUT EXPECTATIONS:
- FilteredDataResult from data_filtering agent containing 50+ hourly records
- Original user query for context

OUTPUT FORMAT:
Return a complete ChartSpecification object ready for rendering.

CHART TYPE SELECTION LOGIC:
- Time series data → line chart with temporal aggregation
- Categorical comparisons → bar chart  
- Correlation analysis → scatter plot
- Multi-dimensional patterns → heatmap
- Cumulative data → area chart

TEMPORAL HANDLING:
- For hourly data over 3+ days: Show daily patterns with hourly granularity
- For high-density data: Consider aggregation to prevent overcrowding
- X-axis should show meaningful time intervals (every 6 hours, daily ticks)
- Y-axis should reflect actual min/max values with 10% padding

CRITICAL: Base all specifications on actual data characteristics. For hourly coal output over 3 days, ensure the chart spec captures the temporal patterns, proper axis ranges based on actual data values, and appropriate time formatting for readability.`,
    
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      temperature: 0.1,
      maxTokens: 2000,
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    
    taskExpectedOutput: '',/*{
      chartType: 'string',
      title: 'string',
      xAxis: {
        field: 'string',
        label: 'string',
        type: 'string',
        range: 'array',
        tickInterval: 'string',
        format: 'string'
      },
      yAxis: {
        field: 'string',  
        label: 'string',
        type: 'string',
        range: 'array',
        unit: 'string',
        tickCount: 'number'
      },
      series: 'array',
      layout: 'object',
      interactivity: 'object',
      aggregation: {
        type: 'string',
        interval: 'string',
        method: 'string'
      }
    },*/
    
    context: {},
    dependencies: [
      { agentName: 'data_filtering', required: true }
    ],
    mcpServers: [],
    mcpTools: []
  };

  return agentDefinition;
}