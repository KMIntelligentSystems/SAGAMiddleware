import { 
  DataAnalysisArtifact, 
  RequirementsArtifact, 
  DatabaseQuery,
  DataSchema,
  QualityMetrics,
  QualityIssue,
  VisualizationRecommendation,
  FieldDefinition
} from '../types/humanInLoopSaga.js';
import { BrowserGraphRequest } from '../eventBus/types.js';

/**
 * Data Analysis Service - Analyzes data sources and generates optimal queries
 */
export class DataAnalysisService {
  private sampleDataCache: Map<string, any[]> = new Map();

  /**
   * Analyze data source and generate comprehensive analysis artifact
   */
  async analyzeDataSource(
    requirements: RequirementsArtifact,
    browserRequest: BrowserGraphRequest
  ): Promise<DataAnalysisArtifact> {
    console.log(`📊 Analyzing data source: ${browserRequest.dataSource.collection}`);

    // Generate optimized database query
    const queryPlan = await this.generateQueryPlan(requirements, browserRequest);
    
    // Analyze data schema
    const dataSchema = await this.analyzeDataSchema(browserRequest.dataSource.collection);
    
    // Generate sample data
    const sampleData = await this.generateSampleData(queryPlan, dataSchema);
    
    // Calculate data quality metrics
    const dataQualityMetrics = await this.calculateDataQuality(sampleData, dataSchema);
    
    // Generate visualization recommendation
    const recommendedVisualization = this.generateVisualizationRecommendation(
      browserRequest,
      dataSchema,
      sampleData
    );

    const artifact: DataAnalysisArtifact = {
      queryPlan,
      dataSchema,
      sampleData,
      dataQualityMetrics,
      recommendedVisualization
    };

    console.log(`✅ Data analysis completed: ${sampleData.length} sample records, quality score ${Math.round(dataQualityMetrics.accuracy * 100)}%`);
    return artifact;
  }

  /**
   * Generate optimized database query plan
   */
  async generateQueryPlan(
    requirements: RequirementsArtifact,
    browserRequest: BrowserGraphRequest
  ): Promise<DatabaseQuery> {
    console.log(`🔧 Generating query plan for ${browserRequest.dataSource.collection}`);

    const filters: Record<string, any> = {
      timestamp: {
        $gte: new Date(browserRequest.dataRequirements.dateRange.start),
        $lte: new Date(browserRequest.dataRequirements.dateRange.end)
      }
    };

    // Add energy type filters from extracted entities
    const energyTypeEntities = requirements.extractedEntities.filter(e => e.type === 'energy_type');
    if (energyTypeEntities.length > 0) {
      filters.type = { $in: energyTypeEntities.map(e => e.value.toLowerCase()) };
    }

    // Add custom filters from browser request
    if (browserRequest.dataSource.filters) {
      Object.assign(filters, browserRequest.dataSource.filters);
    }

    // Build aggregation pipeline
    const aggregation = [];

    // Match stage
    aggregation.push({ $match: filters });

    // Aggregation stage based on requirements
    if (browserRequest.dataRequirements.aggregation) {
      const groupBy = this.buildGroupByStage(browserRequest.dataRequirements.aggregation);
      aggregation.push(groupBy);
    }

    // Sort stage
    aggregation.push({ $sort: { timestamp: 1 } });

    // Project stage - only include requested fields
    const projections = browserRequest.dataRequirements.outputFields.reduce((acc, field) => {
      acc[field] = 1;
      return acc;
    }, {} as Record<string, number>);

    // Estimate result size
    const estimatedResultSize = this.estimateResultSize(filters, browserRequest);

    const queryPlan: DatabaseQuery = {
      collection: browserRequest.dataSource.collection,
      filters,
      aggregation,
      projections: Object.keys(projections),
      estimatedResultSize
    };

    console.log(`✅ Query plan generated: estimated ${estimatedResultSize} records`);
    return queryPlan;
  }

  /**
   * Analyze data schema for the collection
   */
  async analyzeDataSchema(collection: string): Promise<DataSchema> {
    console.log(`🔍 Analyzing schema for ${collection}`);

    // Simulate schema analysis - in real implementation would query database
    const schemas: Record<string, DataSchema> = {
      'supply_analysis': {
        fields: [
          { name: 'timestamp', type: 'date', nullable: false, description: 'Record timestamp' },
          { name: 'output', type: 'number', nullable: false, description: 'Energy output in MW' },
          { name: 'type', type: 'string', nullable: false, description: 'Energy source type' },
          { name: 'region', type: 'string', nullable: true, description: 'Geographical region' },
          { name: 'capacity', type: 'number', nullable: true, description: 'Total capacity in MW' },
          { name: 'efficiency', type: 'number', nullable: true, description: 'Efficiency percentage' }
        ],
        totalRecords: 50000,
        dateRange: {
          min: new Date('2023-01-01'),
          max: new Date()
        },
        uniqueValues: {
          type: ['coal', 'gas', 'solar', 'wind', 'nuclear', 'hydro'],
          region: ['north', 'south', 'east', 'west', 'central']
        }
      },
      'energy_consumption': {
        fields: [
          { name: 'timestamp', type: 'date', nullable: false },
          { name: 'consumption', type: 'number', nullable: false },
          { name: 'sector', type: 'string', nullable: false },
          { name: 'cost', type: 'number', nullable: true }
        ],
        totalRecords: 75000,
        dateRange: {
          min: new Date('2022-01-01'),
          max: new Date()
        },
        uniqueValues: {
          sector: ['residential', 'commercial', 'industrial', 'transportation']
        }
      }
    };

    const schema = schemas[collection] || {
      fields: [],
      totalRecords: 0,
      dateRange: { min: new Date(), max: new Date() },
      uniqueValues: {}
    };

    console.log(`✅ Schema analyzed: ${schema.fields.length} fields, ${schema.totalRecords} total records`);
    return schema;
  }

  /**
   * Generate sample data based on query plan
   */
  async generateSampleData(queryPlan: DatabaseQuery, schema: DataSchema): Promise<any[]> {
    console.log(`🎲 Generating sample data for ${queryPlan.collection}`);

    const cacheKey = `${queryPlan.collection}_${JSON.stringify(queryPlan.filters)}`;
    
    if (this.sampleDataCache.has(cacheKey)) {
      console.log(`📋 Using cached sample data`);
      return this.sampleDataCache.get(cacheKey)!;
    }

    const sampleSize = Math.min(100, queryPlan.estimatedResultSize);
    const sampleData: any[] = [];

    // Generate realistic sample data based on collection type
    if (queryPlan.collection === 'supply_analysis') {
      sampleData.push(...this.generateSupplyAnalysisSample(sampleSize, queryPlan));
    } else if (queryPlan.collection === 'energy_consumption') {
      sampleData.push(...this.generateConsumptionSample(sampleSize, queryPlan));
    } else {
      // Generic sample data
      sampleData.push(...this.generateGenericSample(sampleSize, schema));
    }

    this.sampleDataCache.set(cacheKey, sampleData);
    console.log(`✅ Generated ${sampleData.length} sample records`);
    return sampleData;
  }

  /**
   * Calculate data quality metrics
   */
  async calculateDataQuality(sampleData: any[], schema: DataSchema): Promise<QualityMetrics> {
    console.log(`🔍 Calculating data quality metrics`);

    const issues: QualityIssue[] = [];
    let completenessScore = 0;
    let accuracyScore = 0;
    let consistencyScore = 0;

    if (sampleData.length === 0) {
      return {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        issues: [{
          type: 'missing_data',
          severity: 'high',
          affectedRecords: 0,
          description: 'No data available for the specified criteria'
        }]
      };
    }

    // Calculate completeness
    const totalFields = schema.fields.length;
    let completeRecords = 0;

    sampleData.forEach(record => {
      let completeFields = 0;
      schema.fields.forEach(field => {
        if (record[field.name] !== null && record[field.name] !== undefined) {
          completeFields++;
        }
      });
      if (completeFields === totalFields) {
        completeRecords++;
      }
    });

    completenessScore = completeRecords / sampleData.length;

    // Check for missing data
    if (completenessScore < 0.9) {
      issues.push({
        type: 'missing_data',
        severity: completenessScore < 0.5 ? 'high' : 'medium',
        affectedRecords: sampleData.length - completeRecords,
        description: `${Math.round((1 - completenessScore) * 100)}% of records have missing fields`
      });
    }

    // Calculate accuracy (simulate data validation)
    accuracyScore = 0.95 - Math.random() * 0.1; // Simulate accuracy between 85-95%

    // Check for outliers
    const numericFields = schema.fields.filter(f => f.type === 'number');
    numericFields.forEach(field => {
      const values = sampleData.map(r => r[field.name]).filter(v => v !== null);
      if (values.length > 0) {
        const outliers = this.detectOutliers(values);
        if (outliers.length > values.length * 0.05) { // More than 5% outliers
          issues.push({
            type: 'outlier',
            severity: 'medium',
            affectedRecords: outliers.length,
            description: `Field '${field.name}' has ${outliers.length} potential outliers`
          });
        }
      }
    });

    // Calculate consistency
    consistencyScore = 0.92 - Math.random() * 0.05; // Simulate consistency between 87-92%

    console.log(`✅ Quality metrics calculated: completeness ${Math.round(completenessScore * 100)}%, accuracy ${Math.round(accuracyScore * 100)}%`);

    return {
      completeness: completenessScore,
      accuracy: accuracyScore,
      consistency: consistencyScore,
      issues
    };
  }

  /**
   * Generate visualization recommendation based on analysis
   */
  generateVisualizationRecommendation(
    browserRequest: BrowserGraphRequest,
    schema: DataSchema,
    sampleData: any[]
  ): VisualizationRecommendation {
    console.log(`💡 Generating visualization recommendation`);

    const outputFields = browserRequest.dataRequirements.outputFields;
    const requestedType = browserRequest.dataRequirements.graphType;

    // Analyze field types
    const fieldTypes = schema.fields.reduce((acc, field) => {
      acc[field.name] = field.type;
      return acc;
    }, {} as Record<string, string>);

    const hasTimeField = outputFields.some(field => fieldTypes[field] === 'date');
    const numericFields = outputFields.filter(field => fieldTypes[field] === 'number');
    const categoricalFields = outputFields.filter(field => fieldTypes[field] === 'string');

    // Generate recommendation
    let recommendedType: 'line' | 'bar' | 'pie' | 'scatter' = requestedType;
    let confidence = 0.8;
    let reasoning = `User requested ${requestedType} chart`;

    // Override with better recommendation if needed
    if (hasTimeField && numericFields.length >= 1) {
      recommendedType = 'line';
      confidence = 0.95;
      reasoning = 'Time-series data is best visualized with line charts';
    } else if (categoricalFields.length >= 1 && numericFields.length >= 1) {
      recommendedType = 'bar';
      confidence = 0.9;
      reasoning = 'Categorical data with numeric values work well with bar charts';
    } else if (numericFields.length >= 2) {
      recommendedType = 'scatter';
      confidence = 0.85;
      reasoning = 'Multiple numeric fields can show correlations in scatter plots';
    }

    // Generate alternatives
    const alternatives = [];

    if (recommendedType !== 'line' && hasTimeField) {
      alternatives.push({
        type: 'line',
        confidence: 0.8,
        pros: ['Shows trends over time', 'Easy to interpret'],
        cons: ['May not show individual data points clearly']
      });
    }

    if (recommendedType !== 'bar' && categoricalFields.length > 0) {
      alternatives.push({
        type: 'bar',
        confidence: 0.75,
        pros: ['Good for comparing categories', 'Clear value differences'],
        cons: ['Limited to categorical breakdowns']
      });
    }

    if (recommendedType !== 'scatter' && numericFields.length >= 2) {
      alternatives.push({
        type: 'scatter',
        confidence: 0.7,
        pros: ['Shows correlations', 'Reveals patterns'],
        cons: ['Can be cluttered with many points']
      });
    }

    console.log(`✅ Recommended ${recommendedType} chart with ${Math.round(confidence * 100)}% confidence`);

    return {
      recommendedType,
      confidence,
      reasoning,
      alternatives
    };
  }

  /**
   * Build aggregation group stage based on aggregation type
   */
  private buildGroupByStage(aggregationType: string): any {
    switch (aggregationType) {
      case 'hourly':
        return {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' }
            },
            timestamp: { $first: '$timestamp' },
            output: { $avg: '$output' },
            type: { $first: '$type' }
          }
        };

      case 'daily':
        return {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' }
            },
            timestamp: { $first: '$timestamp' },
            output: { $avg: '$output' },
            type: { $first: '$type' }
          }
        };

      case 'weekly':
        return {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              week: { $week: '$timestamp' }
            },
            timestamp: { $first: '$timestamp' },
            output: { $avg: '$output' },
            type: { $first: '$type' }
          }
        };

      default:
        return { $group: { _id: null, count: { $sum: 1 } } };
    }
  }

  /**
   * Estimate result size based on filters
   */
  private estimateResultSize(filters: Record<string, any>, browserRequest: BrowserGraphRequest): number {
    // Simple estimation based on time range and aggregation
    const start = new Date(browserRequest.dataRequirements.dateRange.start);
    const end = new Date(browserRequest.dataRequirements.dateRange.end);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const aggregation = browserRequest.dataRequirements.aggregation;
    
    switch (aggregation) {
      case 'hourly': return days * 24;
      case 'daily': return days;
      case 'weekly': return Math.ceil(days / 7);
      default: return days * 100; // Assume ~100 records per day
    }
  }

  /**
   * Generate sample data for supply analysis
   */
  private generateSupplyAnalysisSample(size: number, queryPlan: DatabaseQuery): any[] {
    const data = [];
    const types = ['coal', 'gas', 'solar', 'wind', 'nuclear'];
    const startDate = new Date(queryPlan.filters.timestamp.$gte);
    const endDate = new Date(queryPlan.filters.timestamp.$lte);

    for (let i = 0; i < size; i++) {
      const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
      const type = types[Math.floor(Math.random() * types.length)];
      
      data.push({
        timestamp: randomDate,
        output: Math.round(800 + Math.random() * 600), // 800-1400 MW
        type,
        capacity: Math.round(1000 + Math.random() * 500),
        efficiency: Math.round(75 + Math.random() * 20) // 75-95%
      });
    }

    return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate sample data for consumption analysis
   */
  private generateConsumptionSample(size: number, queryPlan: DatabaseQuery): any[] {
    const data = [];
    const sectors = ['residential', 'commercial', 'industrial', 'transportation'];
    const startDate = new Date(queryPlan.filters.timestamp.$gte);
    const endDate = new Date(queryPlan.filters.timestamp.$lte);

    for (let i = 0; i < size; i++) {
      const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      
      data.push({
        timestamp: randomDate,
        consumption: Math.round(200 + Math.random() * 300), // 200-500 MW
        sector,
        cost: Math.round(50 + Math.random() * 100) // $50-150 per MWh
      });
    }

    return data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate generic sample data
   */
  private generateGenericSample(size: number, schema: DataSchema): any[] {
    const data = [];

    for (let i = 0; i < size; i++) {
      const record: any = {};
      
      schema.fields.forEach(field => {
        switch (field.type) {
          case 'date':
            record[field.name] = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30); // Last 30 days
            break;
          case 'number':
            record[field.name] = Math.round(Math.random() * 1000);
            break;
          case 'string':
            record[field.name] = `value_${Math.floor(Math.random() * 10)}`;
            break;
          case 'boolean':
            record[field.name] = Math.random() > 0.5;
            break;
        }
      });

      data.push(record);
    }

    return data;
  }

  /**
   * Detect outliers using simple statistical method
   */
  private detectOutliers(values: number[]): number[] {
    if (values.length < 4) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return values.filter(v => v < lowerBound || v > upperBound);
  }

  /**
   * Clear sample data cache
   */
  clearCache(): void {
    this.sampleDataCache.clear();
    console.log(`🧹 Sample data cache cleared`);
  }
}