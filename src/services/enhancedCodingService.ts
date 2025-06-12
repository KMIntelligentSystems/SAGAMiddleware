import { 
  CodeArtifacts,
  RequirementsArtifact,
  DataAnalysisArtifact,
  InteractiveDemo,
  ControlDefinition
} from '../types/humanInLoopSaga.js';

/**
 * Enhanced Coding Service - Generates sophisticated React visualization components
 */
export class EnhancedCodingService {
  
  /**
   * Generate comprehensive visualization code based on requirements and data analysis
   */
  async generateVisualizationCode(
    requirements: RequirementsArtifact,
    dataAnalysis: DataAnalysisArtifact
  ): Promise<CodeArtifacts> {
    console.log(`💻 Generating enhanced visualization code...`);

    const chartType = dataAnalysis.recommendedVisualization.recommendedType;
    const componentName = this.generateComponentName(requirements.processedQuery);

    // Generate React component with advanced features
    const reactComponent = this.generateAdvancedReactComponent(
      componentName,
      chartType,
      dataAnalysis,
      requirements
    );

    // Generate TypeScript interfaces
    const typeDefinitions = this.generateTypeDefinitions(dataAnalysis);

    // Generate test data based on analysis
    const testData = dataAnalysis.sampleData.slice(0, 20); // Use first 20 sample records

    // Generate component preview
    const preview = await this.generateComponentPreview(reactComponent, testData);

    // Determine dependencies based on chart type and features
    const dependencies = this.determineDependencies(chartType, dataAnalysis);

    const codeArtifacts: CodeArtifacts = {
      reactComponent: reactComponent + '\n\n' + typeDefinitions,
      chartLibrary: 'recharts',
      dependencies,
      preview,
      testData
    };

    console.log(`✅ Enhanced code generated: ${componentName} component with ${dependencies.length} dependencies`);
    return codeArtifacts;
  }

  /**
   * Create interactive demo with live preview and controls
   */
  async createInteractiveDemo(
    codeArtifacts: CodeArtifacts,
    dataAnalysis: DataAnalysisArtifact
  ): Promise<InteractiveDemo> {
    console.log(`🎮 Creating interactive demo...`);

    // Generate control definitions based on data analysis
    const controls = this.generateInteractiveControls(dataAnalysis);

    // Create demo URL (in real implementation, this would deploy to a sandbox)
    const previewUrl = `http://localhost:3000/demo/${Date.now()}`;

    // Generate embed code
    const embedCode = this.generateEmbedCode(codeArtifacts);

    const demo: InteractiveDemo = {
      previewUrl,
      interactiveControls: controls,
      exportOptions: ['PNG', 'SVG', 'PDF', 'CSV', 'JSON'],
      embedCode
    };

    console.log(`✅ Interactive demo created with ${controls.length} controls`);
    return demo;
  }

  /**
   * Generate advanced React component with features
   */
  private generateAdvancedReactComponent(
    componentName: string,
    chartType: string,
    dataAnalysis: DataAnalysisArtifact,
    requirements: RequirementsArtifact
  ): string {
    const fields = dataAnalysis.dataSchema.fields;
    const timeField = fields.find(f => f.type === 'date')?.name || 'timestamp';
    const valueFields = fields.filter(f => f.type === 'number').map(f => f.name);
    const categoryField = fields.find(f => f.type === 'string')?.name;

    const imports = this.generateImports(chartType);
    const interfaces = this.generateDataInterface(fields);
    const chartComponent = this.generateChartComponent(chartType, timeField, valueFields, categoryField);
    const exportFeatures = this.generateExportFeatures();
    const errorHandling = this.generateErrorHandling();

    return `${imports}

${interfaces}

interface ${componentName}Props {
  data: DataPoint[];
  title?: string;
  height?: number;
  width?: number;
  showExports?: boolean;
  theme?: 'light' | 'dark';
  interactive?: boolean;
}

const ${componentName}: React.FC<${componentName}Props> = ({
  data,
  title = "${this.generateDefaultTitle(requirements)}",
  height = 400,
  width = 800,
  showExports = true,
  theme = 'light',
  interactive = true
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState(data);
  const chartRef = useRef<HTMLDivElement>(null);

  // Data validation and preprocessing
  useEffect(() => {
    try {
      ${this.generateDataValidation(fields)}
      setFilteredData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data validation failed');
    }
  }, [data]);

  // Export handlers
  ${exportFeatures}

  // Error boundary
  ${errorHandling}

  if (error) {
    return (
      <div className="chart-error" style={{ padding: '20px', border: '1px solid #ff6b6b', borderRadius: '4px' }}>
        <h3>⚠️ Chart Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="chart-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <div>Loading chart...</div>
      </div>
    );
  }

  return (
    <div 
      ref={chartRef}
      className={\`chart-container \${theme}\`}
      style={{ 
        width: '100%', 
        height: height + 60, 
        padding: '20px',
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        color: theme === 'dark' ? '#ffffff' : '#000000'
      }}
    >
      <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h2>
        {showExports && (
          <div className="export-buttons" style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportToPNG} style={buttonStyle}>📷 PNG</button>
            <button onClick={exportToCSV} style={buttonStyle}>📊 CSV</button>
            <button onClick={exportToJSON} style={buttonStyle}>📄 JSON</button>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        ${chartComponent}
      </ResponsiveContainer>

      {interactive && (
        <div className="chart-controls" style={{ marginTop: '20px', padding: '16px', backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', borderRadius: '4px' }}>
          <h4>Interactive Controls</h4>
          ${this.generateInteractiveControlsJSX(dataAnalysis)}
        </div>
      )}

      <div className="chart-metadata" style={{ marginTop: '16px', fontSize: '0.9rem', opacity: 0.7 }}>
        <p>Data points: {filteredData.length} | Quality score: {${Math.round(dataAnalysis.dataQualityMetrics.accuracy * 100)}%}</p>
        <p>Generated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  background: 'white',
  cursor: 'pointer',
  fontSize: '0.8rem'
};

export default ${componentName};`;
  }

  /**
   * Generate imports based on chart type
   */
  private generateImports(chartType: string): string {
    const baseImports = `import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, Tooltip, Legend, CartesianGrid, XAxis, YAxis } from 'recharts';`;

    const chartSpecificImports = {
      line: "import { LineChart, Line } from 'recharts';",
      bar: "import { BarChart, Bar } from 'recharts';",
      pie: "import { PieChart, Pie, Cell } from 'recharts';",
      scatter: "import { ScatterChart, Scatter } from 'recharts';"
    };

    return `${baseImports}
${chartSpecificImports[chartType as keyof typeof chartSpecificImports] || chartSpecificImports.line}`;
  }

  /**
   * Generate TypeScript interfaces
   */
  private generateDataInterface(fields: any[]): string {
    const interfaceFields = fields.map(field => {
      const typeMap: Record<string, string> = {
        'string': 'string',
        'number': 'number',
        'date': 'Date | string',
        'boolean': 'boolean'
      };
      const tsType = typeMap[field.type] || 'any';

      return `  ${field.name}${field.nullable ? '?' : ''}: ${tsType};`;
    }).join('\n');

    return `interface DataPoint {
${interfaceFields}
}`;
  }

  /**
   * Generate chart component JSX
   */
  private generateChartComponent(
    chartType: string,
    timeField: string,
    valueFields: string[],
    categoryField?: string
  ): string {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

    switch (chartType) {
      case 'line':
        const lines = valueFields.map((field, index) => 
          `<Line type="monotone" dataKey="${field}" stroke="${colors[index % colors.length]}" strokeWidth={2} />`
        ).join('\n        ');

        return `<LineChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="${timeField}" />
          <YAxis />
          <Tooltip />
          <Legend />
          ${lines}
        </LineChart>`;

      case 'bar':
        const bars = valueFields.map((field, index) => 
          `<Bar dataKey="${field}" fill="${colors[index % colors.length]}" />`
        ).join('\n        ');

        return `<BarChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="${categoryField || timeField}" />
          <YAxis />
          <Tooltip />
          <Legend />
          ${bars}
        </BarChart>`;

      case 'pie':
        return `<PieChart>
          <Pie
            data={filteredData}
            dataKey="${valueFields[0]}"
            nameKey="${categoryField || 'name'}"
            cx="50%"
            cy="50%"
            outerRadius={120}
            label
          >
            {filteredData.map((entry, index) => (
              <Cell key={\`cell-\${index}\`} fill={["${colors.join('", "')}"][index % ${colors.length}]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>`;

      case 'scatter':
        return `<ScatterChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="${valueFields[0]}" type="number" />
          <YAxis dataKey="${valueFields[1] || valueFields[0]}" type="number" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter fill="${colors[0]}" />
        </ScatterChart>`;

      default:
        return this.generateChartComponent('line', timeField, valueFields, categoryField);
    }
  }

  /**
   * Generate export features
   */
  private generateExportFeatures(): string {
    return `const exportToPNG = () => {
    if (chartRef.current) {
      // Implementation would use html2canvas or similar
      console.log('Exporting to PNG...');
    }
  };

  const exportToCSV = () => {
    const csv = filteredData.map(row => Object.values(row).join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart-data.csv';
    a.click();
  };

  const exportToJSON = () => {
    const json = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart-data.json';
    a.click();
  };`;
  }

  /**
   * Generate error handling
   */
  private generateErrorHandling(): string {
    return `if (!data || data.length === 0) {
    return (
      <div className="chart-empty" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>📊 No Data Available</h3>
        <p>No data matches the current criteria</p>
      </div>
    );
  }`;
  }

  /**
   * Generate data validation
   */
  private generateDataValidation(fields: any[]): string {
    const validations = fields.map(field => {
      switch (field.type) {
        case 'number':
          return `if (data.some(d => typeof d.${field.name} !== 'number' && d.${field.name} !== null)) {
            throw new Error('Invalid number data in field ${field.name}');
          }`;
        case 'date':
          return `if (data.some(d => d.${field.name} && isNaN(new Date(d.${field.name}).getTime()))) {
            throw new Error('Invalid date data in field ${field.name}');
          }`;
        default:
          return '';
      }
    }).filter(v => v).join('\n      ');

    return validations || '// No specific validation required';
  }

  /**
   * Generate interactive controls JSX
   */
  private generateInteractiveControlsJSX(dataAnalysis: DataAnalysisArtifact): string {
    const controls = [];

    // Add date range control if time data exists
    const hasTimeField = dataAnalysis.dataSchema.fields.some(f => f.type === 'date');
    if (hasTimeField) {
      controls.push(`<div style={{ marginBottom: '12px' }}>
            <label>Date Range: </label>
            <input type="date" onChange={(e) => console.log('Date filter:', e.target.value)} />
            <span> to </span>
            <input type="date" onChange={(e) => console.log('Date filter:', e.target.value)} />
          </div>`);
    }

    // Add category filter if categorical data exists
    const categoricalFields = dataAnalysis.dataSchema.fields.filter(f => f.type === 'string');
    if (categoricalFields.length > 0) {
      controls.push(`<div style={{ marginBottom: '12px' }}>
            <label>Filter by ${categoricalFields[0].name}: </label>
            <select onChange={(e) => console.log('Category filter:', e.target.value)}>
              <option value="">All</option>
              {/* Options would be dynamically generated */}
            </select>
          </div>`);
    }

    return controls.join('\n          ') || '<p>No interactive controls available</p>';
  }

  /**
   * Generate TypeScript type definitions
   */
  private generateTypeDefinitions(dataAnalysis: DataAnalysisArtifact): string {
    return `// Type definitions for ${dataAnalysis.queryPlan.collection}
export interface ChartConfig {
  theme: 'light' | 'dark';
  animations: boolean;
  responsive: boolean;
  exportFormats: string[];
}

export interface ChartMetadata {
  dataSource: string;
  lastUpdated: Date;
  recordCount: number;
  qualityScore: number;
}`;
  }

  /**
   * Generate component preview (base64 encoded image placeholder)
   */
  private async generateComponentPreview(component: string, testData: any[]): Promise<string> {
    // In a real implementation, this would render the component and generate a screenshot
    // For now, return a placeholder
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  }

  /**
   * Generate interactive controls based on data analysis
   */
  private generateInteractiveControls(dataAnalysis: DataAnalysisArtifact): ControlDefinition[] {
    const controls: ControlDefinition[] = [];

    // Date range controls
    const hasTimeField = dataAnalysis.dataSchema.fields.some(f => f.type === 'date');
    if (hasTimeField) {
      controls.push({
        type: 'date-picker',
        name: 'startDate',
        label: 'Start Date',
        defaultValue: dataAnalysis.dataSchema.dateRange.min
      });

      controls.push({
        type: 'date-picker',
        name: 'endDate',
        label: 'End Date',
        defaultValue: dataAnalysis.dataSchema.dateRange.max
      });
    }

    // Category filters
    Object.entries(dataAnalysis.dataSchema.uniqueValues).forEach(([field, values]) => {
      controls.push({
        type: 'dropdown',
        name: `${field}Filter`,
        label: `Filter by ${field}`,
        options: ['All', ...values],
        defaultValue: 'All'
      });
    });

    // Numeric range controls
    const numericFields = dataAnalysis.dataSchema.fields.filter(f => f.type === 'number');
    numericFields.forEach(field => {
      controls.push({
        type: 'slider',
        name: `${field.name}Range`,
        label: `${field.name} Range`,
        defaultValue: [0, 100]
      });
    });

    return controls;
  }

  /**
   * Generate embed code for the component
   */
  private generateEmbedCode(codeArtifacts: CodeArtifacts): string {
    return `<!-- Embed this chart in your application -->
<div id="chart-container"></div>
<script type="module">
  import Chart from './path/to/Chart.tsx';
  import { createRoot } from 'react-dom/client';
  
  const data = ${JSON.stringify(codeArtifacts.testData?.slice(0, 5), null, 2)};
  
  const root = createRoot(document.getElementById('chart-container'));
  root.render(<Chart data={data} />);
</script>`;
  }

  /**
   * Determine dependencies based on chart features
   */
  private determineDependencies(chartType: string, dataAnalysis: DataAnalysisArtifact): string[] {
    const baseDependencies = ['react', 'recharts'];
    const additionalDependencies = [];

    // Add dependencies based on features
    if (dataAnalysis.dataSchema.fields.some(f => f.type === 'date')) {
      additionalDependencies.push('date-fns'); // For date formatting
    }

    if (dataAnalysis.dataQualityMetrics.issues.length > 0) {
      additionalDependencies.push('lodash'); // For data validation utilities
    }

    // Chart-specific dependencies
    if (chartType === 'pie') {
      additionalDependencies.push('d3-scale-chromatic'); // For better color scales
    }

    return [...baseDependencies, ...additionalDependencies];
  }

  /**
   * Generate component name from query
   */
  private generateComponentName(query: string): string {
    // Extract key terms and convert to PascalCase
    const words = query
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3); // Take first 3 meaningful words

    const name = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    return name || 'DataVisualization';
  }

  /**
   * Generate default title from requirements
   */
  private generateDefaultTitle(requirements: RequirementsArtifact): string {
    return requirements.processedQuery.split('[Context:')[0].trim() || 'Data Visualization';
  }
}