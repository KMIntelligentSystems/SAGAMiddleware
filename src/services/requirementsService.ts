import { RequirementsArtifact, ValidationResult, FieldDefinition } from '../types/humanInLoopSaga.js';
import { BrowserGraphRequest } from '../eventBus/types.js';

export interface DataSource {
  collection: string;
  database?: string;
  availableFields: FieldDefinition[];
  dateRange: { min: Date; max: Date };
  recordCount: number;
}

/**
 * Requirements Service - Processes user queries and validates requirements
 */
export class RequirementsService {
  private knownDataSources: Map<string, DataSource> = new Map();

  constructor() {
    this.initializeKnownDataSources();
  }

  /**
   * Process user query and browser request into structured requirements
   */
  async processUserQuery(
    query: string, 
    browserRequest: BrowserGraphRequest
  ): Promise<RequirementsArtifact> {
    console.log(`🔍 Processing user query: "${query}"`);

    // Extract entities from the query using NLP-like processing
    const extractedEntities = this.extractEntities(query);
    
    // Determine analysis scope
    const analysisScope = this.determineAnalysisScope(query, browserRequest);
    
    // Process and refine the query
    const processedQuery = this.processQuery(query, browserRequest);
    
    // Validate requirements against available data
    const validationResults = await this.validateRequirements(browserRequest, extractedEntities);

    const artifact: RequirementsArtifact = {
      processedQuery,
      extractedEntities,
      analysisScope,
      validationResults
    };

    console.log(`✅ Requirements processed: ${extractedEntities.length} entities extracted`);
    return artifact;
  }

  /**
   * Validate requirements against available data sources
   */
  async validateRequirements(
    browserRequest: BrowserGraphRequest,
    entities: any[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const dataSource = this.knownDataSources.get(browserRequest.dataSource.collection);

    if (!dataSource) {
      results.push({
        field: 'dataSource',
        status: 'error',
        message: `Unknown data source: ${browserRequest.dataSource.collection}`,
        suggestion: `Available sources: ${Array.from(this.knownDataSources.keys()).join(', ')}`
      });
      return results;
    }

    // Validate date range
    const requestStart = new Date(browserRequest.dataRequirements.dateRange.start);
    const requestEnd = new Date(browserRequest.dataRequirements.dateRange.end);

    if (requestStart < dataSource.dateRange.min || requestEnd > dataSource.dateRange.max) {
      results.push({
        field: 'dateRange',
        status: 'warning',
        message: `Requested date range extends beyond available data (${dataSource.dateRange.min.toISOString()} to ${dataSource.dateRange.max.toISOString()})`,
        suggestion: 'Adjust date range or expect limited results'
      });
    }

    // Validate output fields
    const availableFieldNames = dataSource.availableFields.map(f => f.name);
    for (const field of browserRequest.dataRequirements.outputFields) {
      if (!availableFieldNames.includes(field)) {
        results.push({
          field: 'outputFields',
          status: 'error',
          message: `Field '${field}' not available in ${browserRequest.dataSource.collection}`,
          suggestion: `Available fields: ${availableFieldNames.join(', ')}`
        });
      }
    }

    // Validate graph type compatibility
    const graphTypeValidation = this.validateGraphType(
      browserRequest.dataRequirements.graphType,
      browserRequest.dataRequirements.outputFields,
      dataSource
    );
    if (graphTypeValidation) {
      results.push(graphTypeValidation);
    }

    if (results.length === 0) {
      results.push({
        field: 'overall',
        status: 'valid',
        message: 'All requirements are valid and compatible with the data source'
      });
    }

    return results;
  }

  /**
   * Refine requirements based on human feedback
   */
  async refineRequirements(
    originalArtifact: RequirementsArtifact,
    feedback: string,
    modifications: any
  ): Promise<RequirementsArtifact> {
    console.log(`🔄 Refining requirements based on feedback: ${feedback}`);

    const refined: RequirementsArtifact = {
      ...originalArtifact,
      refinedRequirements: feedback,
      processedQuery: modifications?.processedQuery || originalArtifact.processedQuery,
      extractedEntities: [...originalArtifact.extractedEntities, ...(modifications?.additionalEntities || [])],
      analysisScope: modifications?.analysisScope || originalArtifact.analysisScope
    };

    // Re-validate with new requirements
    if (modifications?.browserRequest) {
      refined.validationResults = await this.validateRequirements(
        modifications.browserRequest,
        refined.extractedEntities
      );
    }

    console.log(`✅ Requirements refined successfully`);
    return refined;
  }

  /**
   * Extract entities from user query using pattern matching
   */
  private extractEntities(query: string): any[] {
    const entities: any[] = [];

    // Time entities
    const timePatterns = [
      { pattern: /last (\d+) (day|week|month|year)s?/i, type: 'time_range' },
      { pattern: /past (\d+) (day|week|month|year)s?/i, type: 'time_range' },
      { pattern: /(yesterday|today|this week|this month)/i, type: 'time_reference' }
    ];

    // Energy type entities
    const energyPatterns = [
      { pattern: /(coal|gas|solar|wind|nuclear|hydro|oil)/i, type: 'energy_type' },
      { pattern: /(renewable|fossil|clean)/i, type: 'energy_category' }
    ];

    // Metric entities  
    const metricPatterns = [
      { pattern: /(output|production|consumption|capacity|efficiency)/i, type: 'metric' },
      { pattern: /(trend|pattern|analysis|comparison)/i, type: 'analysis_type' }
    ];

    // Chart type entities
    const chartPatterns = [
      { pattern: /(line chart|bar chart|pie chart|scatter plot|graph)/i, type: 'chart_type' }
    ];

    const allPatterns = [...timePatterns, ...energyPatterns, ...metricPatterns, ...chartPatterns];

    for (const { pattern, type } of allPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        entities.push({
          type,
          value: matches[0],
          confidence: 0.8 + Math.random() * 0.2, // Simulate confidence
          position: query.indexOf(matches[0])
        });
      }
    }

    return entities;
  }

  /**
   * Determine the scope of analysis based on query and request
   */
  private determineAnalysisScope(query: string, browserRequest: BrowserGraphRequest): string {
    const scopes = [];

    // Temporal scope
    const days = this.calculateDaysBetween(
      new Date(browserRequest.dataRequirements.dateRange.start),
      new Date(browserRequest.dataRequirements.dateRange.end)
    );
    scopes.push(`${days}-day analysis`);

    // Data scope
    scopes.push(`${browserRequest.dataSource.collection} dataset`);

    // Metric scope
    scopes.push(`${browserRequest.dataRequirements.outputFields.join(', ')} metrics`);

    // Aggregation scope
    if (browserRequest.dataRequirements.aggregation) {
      scopes.push(`${browserRequest.dataRequirements.aggregation} aggregation`);
    }

    return scopes.join(' | ');
  }

  /**
   * Process and standardize the query
   */
  private processQuery(query: string, browserRequest: BrowserGraphRequest): string {
    let processed = query.trim();

    // Add context from browser request
    const context = [];
    context.push(`Data source: ${browserRequest.dataSource.collection}`);
    context.push(`Time range: ${browserRequest.dataRequirements.dateRange.start} to ${browserRequest.dataRequirements.dateRange.end}`);
    context.push(`Chart type: ${browserRequest.dataRequirements.graphType}`);

    processed += ` [Context: ${context.join(', ')}]`;

    return processed;
  }

  /**
   * Validate graph type compatibility with data
   */
  private validateGraphType(
    graphType: string,
    outputFields: string[],
    dataSource: DataSource
  ): ValidationResult | null {
    const fieldTypes = dataSource.availableFields.reduce((acc, field) => {
      acc[field.name] = field.type;
      return acc;
    }, {} as Record<string, string>);

    switch (graphType) {
      case 'pie':
        if (outputFields.length < 2) {
          return {
            field: 'graphType',
            status: 'error',
            message: 'Pie charts require at least 2 fields (category and value)',
            suggestion: 'Add more output fields or choose a different chart type'
          };
        }
        break;

      case 'scatter':
        if (outputFields.length < 2) {
          return {
            field: 'graphType',
            status: 'error',
            message: 'Scatter plots require at least 2 numeric fields',
            suggestion: 'Add more numeric fields or choose a different chart type'
          };
        }
        break;

      case 'line':
        const hasTimeField = outputFields.some(field => fieldTypes[field] === 'date');
        if (!hasTimeField) {
          return {
            field: 'graphType',
            status: 'warning',
            message: 'Line charts work best with time-series data',
            suggestion: 'Consider including a date/time field or use a bar chart'
          };
        }
        break;
    }

    return null;
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysBetween(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Initialize known data sources for validation
   */
  private initializeKnownDataSources(): void {
    // Supply analysis data source
    this.knownDataSources.set('supply_analysis', {
      collection: 'supply_analysis',
      availableFields: [
        { name: 'timestamp', type: 'date', nullable: false, description: 'Record timestamp' },
        { name: 'output', type: 'number', nullable: false, description: 'Energy output in MW' },
        { name: 'type', type: 'string', nullable: false, description: 'Energy source type' },
        { name: 'region', type: 'string', nullable: true, description: 'Geographical region' },
        { name: 'capacity', type: 'number', nullable: true, description: 'Total capacity in MW' },
        { name: 'efficiency', type: 'number', nullable: true, description: 'Efficiency percentage' }
      ],
      dateRange: {
        min: new Date('2023-01-01'),
        max: new Date()
      },
      recordCount: 50000
    });

    // Energy consumption data source
    this.knownDataSources.set('energy_consumption', {
      collection: 'energy_consumption',
      availableFields: [
        { name: 'timestamp', type: 'date', nullable: false },
        { name: 'consumption', type: 'number', nullable: false },
        { name: 'sector', type: 'string', nullable: false },
        { name: 'cost', type: 'number', nullable: true }
      ],
      dateRange: {
        min: new Date('2022-01-01'),
        max: new Date()
      },
      recordCount: 75000
    });

    console.log(`📚 Initialized ${this.knownDataSources.size} known data sources`);
  }

  /**
   * Get available data sources
   */
  getAvailableDataSources(): string[] {
    return Array.from(this.knownDataSources.keys());
  }

  /**
   * Get data source schema
   */
  getDataSourceSchema(collection: string): DataSource | undefined {
    return this.knownDataSources.get(collection);
  }
}