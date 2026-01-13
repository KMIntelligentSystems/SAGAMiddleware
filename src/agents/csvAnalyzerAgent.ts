/**
 * CSVAnalyzerAgent
 *
 * Simple SDK agent that reads a CSV file and returns statistical analysis.
 * Runs BEFORE PromptGeneratorAgent to provide data context.
 *
 * Much more efficient than using a subagent (40 turns → ~5 turns)
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { WorkflowRequirements }  from '../types/dag.js'
import { csvAnalyzerAgentResult, csvDataAnalyzerAgentSimpleResult} from '../types/visualizationSaga.js'
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export class CSVAnalyzerAgent extends BaseSDKAgent {
    private requirements: WorkflowRequirements;
    private normalizedFilePath: string | null = null;

    constructor( requirements: WorkflowRequirements, contextManager: ContextManager) {
        super('CSVAnalyzerAgent', 10, contextManager);
        this.requirements = requirements;

        // Setup the CSV normalization tool
        try {
            this.setupNormalizationTool();
        } catch (error) {
            console.error('⚠️  Warning: Failed to setup CSV normalization tool:', error);
            console.log('   CSV Analyzer will run without normalization tool');
        }
    }

    /**
     * Execute CSV analysis
     */
    async execute(_input?: any): Promise<AgentResult> {
        try {
            console.log('\n📊 CSVAnalyzerAgent: Analyzing CSV file...');

        //    const result = this.contextManager.getContext('CSVAnalyzerAgent') as WorkingMemory
            const prompt = this.buildPrompt(null);
            const analysis = csvDataAnalyzerAgentSimpleResult//await this.executeQuery(prompt);// csvAnalyzerAgentResult// 

            // Store analysis in context
            this.setContext(analysis);

            return {
                agentName: 'CSVAnalyzerAgent',
                success: true,
                result: analysis,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ CSV Analyzer error:', error);
            return {
                agentName: 'CSVAnalyzerAgent',
                result: null,
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Setup local tool for CSV normalization
     */
    private setupNormalizationTool(): void {
        // Tool: Normalize CSV file (remove extra header rows, handle missing values)
        const normalizeCsvTool = tool(
            'normalize_csv',
            'Normalize a CSV file by removing extra header rows and converting it to a standard format with one header row. Use this when the CSV has metadata rows before the actual column headers.',
            {
                file_path: z.string().describe('The path to the CSV file to normalize'),
                header_row_index: z.number().describe('The zero-based index of the row containing the actual column headers (e.g., 1 if headers are on the second row)')
            },
            async (args) => {
                return this.handleNormalizeCSV(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'csv-normalizer',
            tools: [normalizeCsvTool]
        });

        // Add MCP server to options
        this.options.mcpServers = {
            ...this.options.mcpServers,
            'csv-normalizer': mcpServer
        } as any;

        console.log('✅ CSV normalization tool setup complete');
    }

    /**
     * Handler for normalize_csv tool
     * Removes extra header rows and creates a normalized CSV file
     */
    private async handleNormalizeCSV(args: any) {
        try {
            const { file_path, header_row_index } = args;
            console.log(`   🔧 Normalizing CSV: ${file_path}, header at row ${header_row_index}`);

            // Read the file
            const fileContent = fs.readFileSync(file_path, 'utf-8');
            const lines = fileContent.split('\n');

            // Skip rows before the header and take everything from header onwards
            const normalizedLines = lines.slice(header_row_index);

            // Create normalized file path (in same directory with _normalized suffix)
            const parsedPath = path.parse(file_path);
            const normalizedPath = path.join(
                parsedPath.dir,
                `${parsedPath.name}_normalized${parsedPath.ext}`
            );

            // Write normalized file
            fs.writeFileSync(normalizedPath, normalizedLines.join('\n'), 'utf-8');

            // Store the normalized file path
            this.normalizedFilePath = normalizedPath;

            console.log(`   ✅ Created normalized CSV: ${normalizedPath}`);

            return {
                content: [{
                    type: 'text' as const,
                    text: `Successfully normalized CSV file. Created: ${normalizedPath}\nRemoved ${header_row_index} row(s) before header. The normalized file has ${normalizedLines.length - 1} data rows.`
                }]
            };
        } catch (error) {
            console.error(`   ❌ Error normalizing CSV:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error normalizing CSV: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Build prompt for CSV analysis
     */
    protected buildPrompt(_input: any): string {
        return `You are a data analysis advisor. You determine whether CSV data analysis requires Python agents or can be handled by SDK agents.

**CONTEXT:**
Requirements: ${JSON.stringify(this.requirements)}

Examine the first agent's task description to understand the visualization requirements.

**IMPORTANT: CSV NORMALIZATION CHECK**

Before analyzing the CSV file, check if it has non-standard formatting:
1. Read the first few lines of the CSV file
2. Check if there are metadata/description rows before the actual column headers
3. Look for patterns like:
   - First row contains text description (e.g., "Land-Ocean: Global Means")
   - Actual column headers appear on row 2 or later
   - Missing values represented as "***" or similar non-numeric placeholders

If the CSV has extra header rows:
- Call the normalize_csv tool with:
  - file_path: the CSV file path from requirements.inputData.source
  - header_row_index: the zero-based index of the row with actual column headers (e.g., 1 for second row)
- After normalization, use the NORMALIZED file path for all subsequent analysis
- Mention the normalized file path in your recommendation output

**DECISION CRITERIA:**

Use **SDK agents** (simple flow) when ALL conditions are met:
- File size < 10,000 rows AND file size < 5MB
- Task requires only basic operations: data reading, simple reshaping, filtering, grouping
- Statistical needs limited to: min, max, mean, median, percentiles, standard deviation, counting
- No algorithmic complexity (no binning algorithms, distribution fitting, outlier detection algorithms)
- No specialized numerical libraries needed (scipy, statsmodels, scikit-learn)

Use **Python agents** (complex flow) when ANY condition is met:
- File size > 10,000 rows OR file size > 5MB (performance requirements)
- **Histogram**: Requires optimal binning algorithms (Freedman-Diaconis, Sturges, Scott's rule)
- **Heatmap/Correlation matrix**: Requires correlation coefficient calculations across multiple variables
- **Box plot/Violin plot**: Requires quartile calculations, IQR-based outlier detection, kernel density estimation
- **Time series with trend analysis**: Requires moving averages, seasonal decomposition, trend fitting
- **Density plots/Contour plots**: Requires kernel density estimation (KDE) algorithms
- **Statistical process control charts**: Requires control limit calculations, moving range computations
- **Distribution fitting**: Requires fitting data to normal, exponential, or other statistical distributions
- Advanced statistical computations (skewness, kurtosis, confidence intervals, hypothesis testing)
- Heavy numerical processing requiring pandas/numpy optimization
- Complex aggregations (rolling windows, exponential smoothing, weighted averages)
- Specialized domain calculations (financial models, scientific formulas, ML preprocessing)

**YOUR JOB:**
1. Read the CSV file to assess: row count, column count, data types, value ranges, missing values
2. If the CSV has extra header rows, call normalize_csv tool to create a clean version
3. Evaluate task complexity against the criteria above
4. Make recommendation based on ACTUAL complexity, not perceived sophistication
5. If you normalized the file, include the normalized file path in your output

**OUTPUT FORMATS:**

**Simple Flow** (SDK agent can handle):
"RECOMMENDATION: SDK Agent
File has [N] rows, [M] columns. Data characteristics: [brief description].
Task: [concise description for SDK agent including data structure, ranges, and required transformations].
Rationale: File size manageable, transformations straightforward, no specialized computation needed."

**Complex Flow** (Python agents required):
"RECOMMENDATION: Python Agents
File has [N] rows, [M] columns. Data characteristics: [brief description].
Workflow:

### Agent 1: [Name]
[Specific task description]
→ Outputs: [Expected outputs]

### Agent 2: [Name]
[Specific task description]
→ Outputs: [Expected outputs]

[Additional agents as needed...]

Rationale: [Specific reason why Python agents are necessary - file size, computation type, or performance requirements]"

**EXAMPLES:**

Example 1 - Simple (SDK handles):
"RECOMMENDATION: SDK Agent
File has 1000 rows, 1 column ('temperature'). Range: 15-35°C, no missing values.
Task: Calculate basic statistics (min, max, mean, median, std deviation) and provide data summary for simple line chart visualization.
Rationale: Small dataset, basic statistics only, simple visualization - no algorithmic complexity or specialized computation needed."

Example 2 - Complex due to file size (requires Python):
"RECOMMENDATION: Python Agents
File has 50,000 rows, 1 column ('price'). Range: $11-$850,000, heavily right-skewed with extreme outliers.
Workflow:

### Agent 1: Statistical Profiler
Compute comprehensive distribution statistics using scipy: quartiles, skewness, kurtosis, outlier detection via IQR and z-scores.
→ Outputs: Statistical profile with distribution parameters

### Agent 2: Bin Calculator
Apply Freedman-Diaconis rule for optimal histogram binning on large dataset, handle outliers via winsorization.
→ Outputs: Optimal bin edges and cleaned dataset

Rationale: Large file (50K rows) requires pandas efficiency for performance; histogram requires optimal binning algorithms; distribution analysis needs scipy."

Example 2b - Complex due to histogram task (requires Python even if small):
"RECOMMENDATION: Python Agents
File has 1,000 rows, 1 column ('price'). Range: $23-$9,502, right-skewed with outliers.
Workflow:

### Agent 1: Distribution Analyzer
Analyze price distribution characteristics, compute skewness, detect outliers using IQR method, calculate quartiles.
→ Outputs: Distribution profile with outlier thresholds

### Agent 2: Histogram Parameter Calculator
Apply Freedman-Diaconis rule to determine optimal bin count and bin edges, calculate appropriate axis scales.
→ Outputs: Optimal binning parameters for histogram

Rationale: Histogram visualization requires algorithmic binning calculation (Freedman-Diaconis rule) and outlier handling - these statistical algorithms are complex even for small datasets."

Example 3 - Simple despite multi-column (SDK handles):
"RECOMMENDATION: SDK Agent
File has 140 rows, 13 columns (Year + 12 monthly temperature values). Range: -0.73 to +1.35°C.
Task: Reshape from wide to long format (Year, Month, Value), calculate per-month statistics, identify min/max ranges for color scaling for bubble chart.
Rationale: Small dataset (140 rows), simple reshaping logic, basic calculations - well within SDK capabilities. Bubble chart only needs position/size/color mapping, no complex algorithms."

Example 3b - CSV with extra header rows (requires normalization):
"DETECTED: CSV file has metadata row before headers. Called normalize_csv tool.
NORMALIZED FILE: ./data/global_temperatures_normalized.csv

RECOMMENDATION: SDK Agent
File has 140 rows, 13 columns (Year + 12 monthly temperature values). Range: -0.73 to +1.35°C.
Task: Use the normalized file (./data/global_temperatures_normalized.csv) to reshape from wide to long format, calculate per-month statistics for bubble chart.
Rationale: After normalization, the file has clean headers. Small dataset (140 rows), simple reshaping logic, basic calculations - well within SDK capabilities."

Example 4 - Complex due to visualization type (requires Python):
"RECOMMENDATION: Python Agents
File has 500 rows, 5 columns (sensor readings: temp, humidity, pressure, time, location).
Workflow:

### Agent 1: Correlation Analyzer
Calculate Pearson correlation coefficients between all sensor variables, generate correlation matrix.
→ Outputs: Correlation matrix for heatmap visualization

### Agent 2: Heatmap Normalizer
Normalize correlation values for color mapping, determine optimal color scale breakpoints.
→ Outputs: Normalized data with color scale parameters

Rationale: Heatmap requires correlation coefficient calculations across multiple variables - statistical computation too complex for SDK agent."

Example 5 - Complex due to time series analysis (requires Python):
"RECOMMENDATION: Python Agents
File has 2,000 rows, 2 columns (timestamp, sales). Daily data over 5 years.
Workflow:

### Agent 1: Time Series Analyzer
Calculate 7-day and 30-day moving averages, identify seasonal patterns, compute trend line using linear regression.
→ Outputs: Smoothed series and trend parameters

### Agent 2: Anomaly Detector
Calculate 3-sigma control limits, identify outliers beyond control boundaries.
→ Outputs: Control limits and anomaly flags

Rationale: Time series visualization with trend lines requires moving average computations and regression fitting - algorithmic complexity requires Python."

Now read the CSV file and make your recommendation based on ACTUAL complexity metrics, not assumptions.
`;
    }


}
