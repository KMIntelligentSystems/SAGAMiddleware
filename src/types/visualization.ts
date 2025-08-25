export interface VisualizationRequest {
  // User query for natural language processing
  userQuery: string;
  
  // Data filtering criteria
  filters: {
    suppliers?: string[];           // Specific suppliers or empty for all
    energyTypes?: ('coal' | 'gas' | 'green')[];
    timeRange?: {
      start: string;               // ISO date string
      end: string;                 // ISO date string
    };
    aggregation?: 'raw' | '15min' | 'hourly' | 'daily';
    metrics?: ('output' | 'efficiency' | 'cost' | 'peak_demand')[];
  };
  
  // Chart specifications (can be inferred from user query)
  chartPreferences?: {
    type?: 'line' | 'bar' | 'scatter' | 'area' | 'heatmap' | 'auto';
    xAxis?: {
      field: 'time' | 'supplier' | 'energyType' | 'hour_of_day';
      label?: string;
      scale?: 'linear' | 'time' | 'category';
    };
    yAxis?: {
      field: 'output' | 'efficiency' | 'cost' | 'average' | 'total';
      label?: string;
      unit?: string;
      scale?: 'linear' | 'log';
    };
    groupBy?: 'supplier' | 'energyType' | 'hour' | 'day' | 'none';
    compareBy?: 'supplier' | 'energyType' | 'timeOfDay';
  };
}

export interface FilteredDataResult {
  data: DataPoint[];
  metadata: {
    totalRecords: number;
    timeRange: { start: string; end: string };
    suppliers: string[];
    energyTypes: string[];
    aggregationLevel: string;
  };
  queryInfo: {
    originalQuery: string;
    filtersApplied: Record<string, any>;
    processingTime: number;
  };
}

export interface DataPoint {
  timestamp: string;
  supplier: string;
  energyType: 'coal' | 'gas' | 'green';
  output: number;
  efficiency?: number;
  cost?: number;
  hour_of_day: number;
  day_of_week: number;
  [key: string]: any;
}

export interface ChartSpecification {
  chartType: 'line' | 'bar' | 'scatter' | 'area' | 'heatmap';
  title: string;
  subtitle?: string;
  
  xAxis: {
    field: string;
    label: string;
    type: 'time' | 'category' | 'linear';
    range?: [number | string, number | string];
    tickInterval?: number | string;
    format?: string;
  };
  yAxis: {
    field: string;
    label: string;
    type: 'linear' | 'log';
    range?: [number, number];
    unit?: string;
    format?: string;
  };
  
  series: ChartSeries[];
  
  layout: {
    showLegend: boolean;
    showGrid: boolean;
    colors?: string[];
    dimensions: { width: number; height: number };
  };
  
  interactivity: {
    zoom: boolean;
    pan: boolean;
    tooltip: boolean;
    crossfilter?: boolean;
  };

  // D3-specific configuration
  d3Config?: {
    xScale: string;
    yScale: string;
    dataFormat: string;
    transitions: {
      duration: number;
      ease: string;
    };
    responsive: boolean;
    colorScheme: Record<string, string>;
    interactions: {
      tooltip: boolean;
      zoom: boolean;
      brush: boolean;
      legend: boolean;
    };
  };
}

export interface ChartSeries {
  name: string;
  data: { x: any; y: any; [key: string]: any }[];
  color?: string;
  type?: 'line' | 'bar' | 'scatter' | 'area';
  marker?: {
    enabled: boolean;
    size?: number;
    symbol?: string;
  };
}

export interface VisualizationOutput {
  narrative: {
    summary: string;
    keyInsights: string[];
    dataQuality: {
      completeness: number;
      timeGaps: string[];
      outliers: number;
    };
    recommendations: string[];
  };
  
  chartSpec: ChartSpecification;
  
  rawData: {
    processedData: DataPoint[];
    aggregatedData?: any[];
    d3Data?: any[]; // D3-formatted data
    statisticalSummary: {
      mean: number;
      median: number;
      stdDev: number;
      min: number;
      max: number;
      trend?: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    };
  };
  
  metadata: {
    queryProcessingTime: number;
    dataPoints: number;
    dateRange: string;
    generatedAt: string;
  };
}

// Example user queries that the system should handle:
export const EXAMPLE_QUERIES = [
  "Show me coal energy output over the last 3 days",
  "Compare green energy vs gas efficiency by hour of day",
  "Which suppliers had peak output during business hours?",
  "Show daily trends for all energy types",
  "Heatmap of supplier performance by time and energy type",
  "Cost comparison between energy types over the full period"
];