/**
 * D3 Visualization Workflow using Claude SDK Agents
 *
 * Complete pipeline:
 * 1. Data Aggregation (Python) - Hourly averaging
 * 2. D3 Code Generation - Schema-guided HTML generation
 * 3. Rendering (Playwright MCP) - PNG + SVG output
 * 4. Validation - SVG parsing for error detection
 * 5. Iteration - Retry with feedback if needed
 */

import {
    query,
    type AgentDefinition,
    type Options
} from '@anthropic-ai/claude-agent-sdk';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { type MCPServerConfig, connectToMCPServer } from '../index.js';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// SUBAGENT DEFINITIONS
// =============================================================================

/**
 * Data Aggregation Subagent
 * Uses Python to process CSV and create hourly averages
 */
const dataAggregationSubagent: AgentDefinition = {
    description: `Data aggregation specialist for time-series CSV processing.
Use for: hourly/daily averaging, filtering date ranges, time-based grouping.`,

    tools: ['mcp__execution__execute_python', 'Read'],
    model: 'sonnet',

    prompt: `You are a data processing expert specializing in time-series aggregation.

YOUR MISSION:
Generate and EXECUTE Python code to aggregate energy data by hour.

WORKFLOW:
1. Read the input CSV file
2. Parse date/time to datetime objects
3. Filter to specified date/time range (if provided)
4. Group by: hour + installation + energy_source
5. Calculate: mean(MW) per group
6. Output: CSV with columns [date_hour, installation, energy_source, MW_avg]
7. ALSO output: JSON schema describing the output structure

CRITICAL REQUIREMENTS:
- Use pandas for efficient processing
- Handle missing values (skip or fill with 0)
- Round MW_avg to 2 decimal places
- Date format: "YYYY-MM-DD HH:00" (ISO 8601 hour precision)
- MUST execute code using mcp__execution__execute_python tool
- Return BOTH: CSV data as string AND schema as JSON

OUTPUT FORMAT:
Return a JSON object:
{
  "csvData": "date_hour,installation,energy_source,MW_avg\\n2023-02-11 04:00,BARCSF1,Solar,0.10\\n...",
  "schema": {
    "columns": {
      "date_hour": {"type": "datetime", "format": "YYYY-MM-DD HH:00"},
      "installation": {"type": "string", "unique_count": 28},
      "energy_source": {"type": "categorical", "values": ["Solar", "Wind", ...]},
      "MW_avg": {"type": "float", "range": [0, 200], "unit": "megawatts"}
    },
    "row_count": 240,
    "time_range": ["2023-02-11 04:00", "2023-02-12 03:00"],
    "installations": ["BARCSF1", "CAPTL_WF", ...],
    "energy_sources": ["Solar", "Wind", "Hydro", "Natural Gas", "Coal", "Battery", "Diesel"]
  },
  "sample_rows": [/* first 20 rows */]
}

PYTHON CODE TEMPLATE (FOLLOW EXACTLY):
import pandas as pd
import json

# 1. Read CSV
df = pd.read_csv('INPUT_FILE_PATH_HERE')

# 2. Parse datetime
df['datetime'] = pd.to_datetime(df['date/time'], format='%d/%m/%Y %H:%M')

# 3. Create hour column
df['date_hour'] = df['datetime'].dt.strftime('%Y-%m-%d %H:00')

# 4. Group and aggregate - HANDLE NaN VALUES
hourly = df.groupby(['date_hour', 'installation', 'energy_source'])['MW'].mean().reset_index()
hourly.columns = ['date_hour', 'installation', 'energy_source', 'MW_avg']

# CRITICAL: Replace NaN with 0 and round
hourly['MW_avg'] = hourly['MW_avg'].fillna(0).round(2)

# 5. Generate schema
schema = {
    "columns": {
        "date_hour": {"type": "datetime"},
        "installation": {"type": "string"},
        "energy_source": {"type": "categorical"},
        "MW_avg": {"type": "float"}
    },
    "row_count": int(len(hourly)),
    "time_range": [str(hourly['date_hour'].min()), str(hourly['date_hour'].max())],
    "installations": sorted(hourly['installation'].unique().tolist()),
    "energy_sources": sorted(hourly['energy_source'].unique().tolist())
}

# 6. CRITICAL: csvData must be CSV STRING (not JSON array)
csv_string = hourly.to_csv(index=False, line_terminator='\\n')

# 7. Sample rows
sample_rows = hourly.head(20).to_dict(orient='records')

# 8. Output - csvData is STRING, not array
output = {
    "csvData": csv_string,
    "schema": schema,
    "sample_rows": sample_rows
}

# 9. Print ONLY the JSON
print(json.dumps(output))

REMEMBER: EXECUTE the code and return the JSON output!`
};

/**
 * D3 Code Generation Subagent
 * Generates complete HTML with D3.js visualization
 */
const d3CodeGenerationSubagent: AgentDefinition = {
    description: `D3.js visualization code generator.
Use for: creating line charts, bar charts, scatter plots with D3.js v7.`,

    tools: ['Write', 'Edit', 'Read'],
    model: 'sonnet',

    prompt: `You are a D3.js visualization expert (D3 v7).

YOUR MISSION:
Generate a complete, self-contained HTML document with D3.js visualization.

INPUT YOU WILL RECEIVE:
- Data schema (column types, value ranges, sample rows)
- Chart type request (line chart, bar chart, etc.)
- 20 sample rows of actual data
- CSV filename to load via d3.csv()

OUTPUT YOU MUST CREATE:
A complete HTML file with:
1. D3.js library loaded from CDN (v7)
2. Responsive SVG container
3. Proper margins (top: 20, right: 120, bottom: 30, left: 50)
4. Axis with labels and units
5. Legend (if multiple series)
6. Data loaded via d3.csv("filename.csv")
7. Error handling for d3.csv() failures
8. Tooltips (optional but recommended)

CRITICAL REQUIREMENTS:
- DO NOT embed data in JavaScript - use d3.csv()
- Use the EXACT filename provided (e.g., "hourly_data.csv")
- Wait for d3.csv() promise before rendering
- Handle missing/null values gracefully
- Use semantic HTML structure
- Add comments explaining D3 code sections

CODE TEMPLATE:
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Energy Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        svg { background: white; }
        .axis { font-size: 12px; }
        .legend { font-size: 11px; }
        .line { fill: none; stroke-width: 2px; }
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        // Dimensions
        const margin = {top: 20, right: 120, bottom: 30, left: 50};
        const width = 960 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

        // Load data
        d3.csv("FILENAME_HERE.csv").then(data => {
            // Parse data
            data.forEach(d => {
                d.date_hour = new Date(d.date_hour);
                d.MW_avg = +d.MW_avg;
            });

            // Create scales
            const x = d3.scaleTime()
                .domain(d3.extent(data, d => d.date_hour))
                .range([0, width]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.MW_avg)])
                .nice()
                .range([height, 0]);

            // Create line generator
            const line = d3.line()
                .x(d => x(d.date_hour))
                .y(d => y(d.MW_avg));

            // Group data by series (e.g., by energy_source)
            const series = d3.group(data, d => d.energy_source);

            // Color scale
            const color = d3.scaleOrdinal(d3.schemeCategory10);

            // Draw lines
            series.forEach((values, key) => {
                svg.append("path")
                    .datum(values)
                    .attr("class", "line")
                    .attr("d", line)
                    .attr("stroke", color(key));
            });

            // Add axes
            svg.append("g")
                .attr("transform", \`translate(0,\${height})\`)
                .call(d3.axisBottom(x));

            svg.append("g")
                .call(d3.axisLeft(y));

            // Add legend
            const legend = svg.selectAll(".legend")
                .data(series.keys())
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", (d, i) => \`translate(\${width + 10},\${i * 20})\`);

            legend.append("rect")
                .attr("width", 18)
                .attr("height", 18)
                .attr("fill", color);

            legend.append("text")
                .attr("x", 24)
                .attr("y", 9)
                .attr("dy", ".35em")
                .text(d => d);

        }).catch(error => {
            console.error("Error loading CSV:", error);
            document.getElementById("chart").innerHTML =
                \`<p style="color: red;">Error loading data: \${error.message}</p>\`;
        });
    </script>
</body>
</html>

CUSTOMIZATION:
Adapt the template based on:
- Chart type requested (line, bar, scatter, area)
- Number of series (single vs multiple lines)
- Data schema (column names, value ranges)
- User requirements (colors, labels, etc.)

VALIDATION BEFORE RETURNING:
- Check: d3.csv() uses correct filename
- Check: All column names match schema
- Check: Scales use correct data domains
- Check: Legend reflects actual series

Return the complete HTML as a string.`
};

/**
 * Validation Subagent
 * Analyzes SVG output to detect rendering errors
 */
const validationSubagent: AgentDefinition = {
    description: `SVG validation specialist for D3 visualization quality assurance.
Use for: parsing SVG files, detecting rendering errors, validating chart structure.`,

    tools: ['Read', 'Bash'],
    model: 'sonnet',

    prompt: `You are a visualization QA specialist focused on SVG validation.

YOUR MISSION:
Analyze the rendered SVG file to determine if the D3 visualization succeeded.

INPUTS YOU WILL RECEIVE:
- Path to SVG file
- Path to PNG file (for size check)
- Expected data characteristics (row count, series names)

VALIDATION CHECKS:

1. FILE EXISTENCE:
   - SVG file exists and size > 1KB
   - PNG file exists and size > 10KB

2. SVG STRUCTURE ANALYSIS:
   Parse SVG and check for:
   - <svg> root element with valid dimensions
   - <g> groups for chart components
   - <path> elements (for lines/areas) - should have d="M..." with actual coordinates
   - <rect> elements (for bars/legend) - count > 0
   - <text> elements (for labels) - count > 5 (axes + legend)
   - <line> or <path> for axis ticks

3. DATA RENDERING VALIDATION:
   - Check if <path d="..."> contains valid coordinates (not empty, not "M0,0")
   - Count number of data series (paths or groups)
   - Verify legend has expected series names
   - Check for NaN or invalid values in path data

4. ERROR DETECTION:
   Common D3 errors to look for:
   - Empty paths: <path d=""/>
   - NaN in coordinates: <path d="M0,NaN..."/>
   - Missing scales: all points at (0,0)
   - No data rendered: only axes visible
   - CSV loading failure: empty visualization

5. OUTPUT FORMAT:
Return JSON:
{
  "status": "SUCCESS" | "RETRY_WITH_FIXES" | "FAIL",
  "validation_results": {
    "svg_size_bytes": 45678,
    "png_size_bytes": 123456,
    "path_count": 7,
    "text_count": 25,
    "has_valid_data": true,
    "series_detected": ["Solar", "Wind", "Hydro"]
  },
  "errors": [
    "Missing legend for Coal energy source",
    "Y-axis scale appears incorrect (all values near 0)"
  ],
  "fix_instructions": "The CSV data was not loaded correctly. Check that d3.csv() filename matches the intercepted route. Ensure date parsing is correct."
}

STATUS DEFINITIONS:
- SUCCESS: Visualization renders correctly, all expected data visible
- RETRY_WITH_FIXES: Errors detected but fixable (provide instructions)
- FAIL: Critical error, cannot be fixed with code changes (data issue?)

ANALYSIS APPROACH:
1. Use Read tool to load SVG file as text
2. Parse SVG using string analysis (look for patterns)
3. Count elements using regex or simple parsing
4. Check for error indicators
5. Compare against expected schema/sample data
6. Generate actionable fix instructions if issues found

BE SPECIFIC in fix instructions:
- BAD: "Fix the data loading"
- GOOD: "Change d3.csv('data.csv') to d3.csv('hourly_data.csv') - filename mismatch"

Return the JSON analysis.`
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract JSON from a string that may contain other text
 * Looks for the first { or [ and extracts valid JSON from there
 */
function extractJSON(text: string): any {
    // Try to find JSON in the text
    // Look for first { or [
    const jsonStart = Math.min(
        text.indexOf('{') !== -1 ? text.indexOf('{') : Infinity,
        text.indexOf('[') !== -1 ? text.indexOf('[') : Infinity
    );

    if (jsonStart === Infinity) {
        throw new Error('No JSON found in response');
    }

    // Extract from first brace/bracket to end
    const jsonText = text.substring(jsonStart);

    // Try to parse incrementally to find valid JSON
    // Start from the end and work backwards to find matching braces
    let lastError: any = null;

    // Try parsing the whole thing first
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        lastError = e;
    }

    // If that fails, try to find the end of the JSON by counting braces
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIndex = -1;

    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{' || char === '[') {
                depth++;
            } else if (char === '}' || char === ']') {
                depth--;
                if (depth === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }

    if (endIndex > 0) {
        try {
            return JSON.parse(jsonText.substring(0, endIndex));
        } catch (e) {
            lastError = e;
        }
    }

    throw new Error(`Failed to extract valid JSON: ${lastError}`);
}

// =============================================================================
// MAIN COORDINATOR CLASS
// =============================================================================

export class D3VisualizationWorkflow {
    private options: Options;
    private sagaCoordinator: SagaCoordinator;
    private dataDir: string;
    private outputDir: string;
    private mcpServerConfig: MCPServerConfig;
    private initialized: boolean = false;

    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.outputDir = path.join(process.cwd(), 'output', 'd3-visualizations');

        // Configure MCP server needed for D3 visualization
        this.mcpServerConfig = {
            name: "playwright-server",
            transport: "stdio",
            command: "node",
            args: ["C:/repos/playwright-mcp-server/dist/server.js"],
            timeout: 300000
        };

        // Initialize SAGA Coordinator for D3 rendering
        const mcpServers: Record<string, MCPServerConfig> = {
            playwright: this.mcpServerConfig
        };

        this.sagaCoordinator = new SagaCoordinator(mcpServers);

        // Configure Claude SDK agents
        this.options = {
            agents: {
                'data-aggregator': dataAggregationSubagent,
                'd3-generator': d3CodeGenerationSubagent,
                'validator': validationSubagent
            },
            permissionMode: 'bypassPermissions',
            maxTurns: 20,
            cwd: process.cwd(),
            settingSources: ['user', 'project', 'local']
        };

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Initialize the workflow by connecting to MCP servers
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        console.log('🚀 Initializing D3 Visualization Workflow...\n');

        try {
            // Connect to Playwright MCP server
            await connectToMCPServer(this.mcpServerConfig);
            console.log('✅ Connected to Playwright MCP server\n');
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to connect to Playwright MCP server: ${error}`);
        }
    }

    /**
     * Execute complete D3 visualization pipeline
     */
    async executeVisualizationPipeline(
        inputCsvPath: string,
        chartType: 'line' | 'bar' | 'area',
        dateRange?: { start: string; end: string }
    ): Promise<void> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║       D3 Visualization Pipeline - Agent Workflow              ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        // Initialize and connect to MCP servers
        await this.initialize();

        try {
            // =====================================================================
            // STEP 1: Data Aggregation
            // =====================================================================
            console.log('📊 Step 1: Aggregating data by hour...\n');

            const aggregationResult = await this.executeDataAggregation(
                inputCsvPath,
                dateRange
            );

            if (!aggregationResult.success) {
                throw new Error(`Data aggregation failed: ${aggregationResult.error}`);
            }

            console.log('✅ Data aggregated successfully');
            console.log(`   Rows: ${aggregationResult.schema.row_count}`);
            console.log(`   Time range: ${aggregationResult.schema.time_range[0]} → ${aggregationResult.schema.time_range[1]}`);
            console.log(`   Energy sources: ${aggregationResult.schema.energy_sources.join(', ')}\n`);

            // =====================================================================
            // STEP 2: D3 Code Generation (with retry logic)
            // =====================================================================
            let retryCount = 0;
            const maxRetries = 3;
            let validationResult: any = null;
            let d3Code: string = '';
            let renderResult: any = null;

            while (retryCount < maxRetries) {
                console.log(`🎨 Step 2: Generating D3 code (attempt ${retryCount + 1}/${maxRetries})...\n`);

                const codeGenResult = await this.executeD3CodeGeneration(
                    aggregationResult,
                    chartType,
                    validationResult?.fix_instructions // Pass fix instructions on retry
                );

                if (!codeGenResult.success) {
                    throw new Error(`D3 code generation failed: ${codeGenResult.error}`);
                }

                d3Code = codeGenResult.htmlCode;
                console.log('✅ D3 code generated\n');

                // =================================================================
                // STEP 3: Render with Playwright MCP
                // =================================================================
                console.log('🎭 Step 3: Rendering visualization with Playwright...\n');

                renderResult = await this.sagaCoordinator.renderD3Visualization(
                    d3Code,
                    'd3-generator',
                    `energy-viz-${Date.now()}`,
                    aggregationResult.csvData,
                    'hourly_data.csv'  // Filename to intercept
                );

                if (!renderResult.success) {
                    throw new Error(`Rendering failed: ${renderResult.error}`);
                }

                console.log('✅ Visualization rendered');
                console.log(`   PNG: ${renderResult.screenshotPath}`);
                console.log(`   SVG: ${renderResult.svgPath}\n`);

                // =================================================================
                // STEP 4: Validation
                // =================================================================
                console.log('🔍 Step 4: Validating SVG output...\n');

                validationResult = await this.executeValidation(
                    renderResult.svgPath!,
                    renderResult.screenshotPath!,
                    aggregationResult.schema
                );

                if (validationResult.status === 'SUCCESS') {
                    console.log('✅ Validation passed!\n');
                    break;
                } else if (validationResult.status === 'RETRY_WITH_FIXES') {
                    console.log('⚠️  Validation found issues, retrying with fixes...');
                    console.log(`   Errors: ${validationResult.errors.join(', ')}`);
                    console.log(`   Fix instructions: ${validationResult.fix_instructions}\n`);
                    retryCount++;
                } else {
                    throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
                }
            }

            if (validationResult.status !== 'SUCCESS') {
                throw new Error(`Failed after ${maxRetries} attempts`);
            }

            // =====================================================================
            // STEP 5: Display Result
            // =====================================================================
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║                   VISUALIZATION COMPLETE                       ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝\n');
            console.log(`📸 PNG Screenshot: ${renderResult.screenshotPath}`);
            console.log(`💾 SVG File: ${renderResult.svgPath}`);
            console.log(`📊 Data Points: ${aggregationResult.schema.row_count}`);
            console.log(`🎨 Chart Type: ${chartType}`);
            console.log(`✅ Status: ${validationResult.status}\n`);

        } catch (error) {
            console.error('\n❌ Pipeline failed:', error);
            throw error;
        } finally {
            // Cleanup
            await this.sagaCoordinator.closeD3Client();
        }
    }

    /**
     * Step 1: Execute data aggregation subagent
     */
    private async executeDataAggregation(
        inputPath: string,
        dateRange?: { start: string; end: string }
    ): Promise<any> {
        const prompt = `Execute data aggregation task:

INPUT FILE: ${inputPath}

TASK:
1. Read the CSV file with columns: date/time, installation, energy_source, MW
2. Parse date/time to datetime objects
3. ${dateRange ? `Filter to date range: ${dateRange.start} to ${dateRange.end}` : 'Use all available data'}
4. Group by hour (date_hour), installation, energy_source
5. Calculate mean MW per group → MW_avg
6. Generate comprehensive schema with:
   - Column definitions
   - Value ranges
   - Unique installations and energy sources
   - Row count and time range
7. Return JSON with: csvData, schema, sample_rows (first 20)

CRITICAL INSTRUCTIONS:
- Use mcp__execution__execute_python to execute Python code
- The Python code MUST print ONLY valid JSON using json.dumps()
- Your FINAL response must be EXACTLY the JSON output from Python - nothing else
- Do NOT add explanations, summaries, or markdown - ONLY the raw JSON
- Copy the exact stdout from the tool execution as your complete response

Execute now and return ONLY the JSON output.`;

        const q = query({
            prompt,
            options: {
                ...this.options,
                agents: { 'data-aggregator': dataAggregationSubagent }
            }
        });

        let result: any = null;
        let toolOutput: string | null = null;

        for await (const message of q) {
            // Capture tool results (Python execution output)
            if (message.type === 'user' && message.message.content) {
                for (const content of message.message.content) {
                    // Type guard: check if content is an object with type property
                    if (typeof content !== 'string' && 'type' in content && content.type === 'tool_result') {
                        const toolResult = content as any;
                        // Found tool result - this should be the raw Python output
                        if (typeof toolResult.content === 'string') {
                            toolOutput = toolResult.content;
                        } else if (Array.isArray(toolResult.content)) {
                            // Sometimes content is an array
                            const textContent = toolResult.content.find((c: any) => c.type === 'text');
                            if (textContent) {
                                toolOutput = textContent.text;
                            }
                        }
                    }
                }
            }

            if (message.type === 'result' && message.subtype === 'success') {
                // Try tool output first (raw Python stdout), fall back to agent response
                const textToParse = toolOutput || message.result;

                try {
                    result = extractJSON(textToParse);
                    result.success = true;
                } catch (error) {
                    result = {
                        success: false,
                        error: `Failed to parse aggregation result: ${error}\nRaw result: ${textToParse.substring(0, 200)}...`
                    };
                }
            } else if (message.type === 'result' && (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution')) {
                result = {
                    success: false,
                    error: 'Agent execution failed'
                };
            }
        }

        return result || { success: false, error: 'No result returned' };
    }

    /**
     * Step 2: Execute D3 code generation subagent
     */
    private async executeD3CodeGeneration(
        aggregationResult: any,
        chartType: string,
        fixInstructions?: string
    ): Promise<any> {
        const prompt = `Generate D3.js visualization code:

${fixInstructions ? `🔧 FIX INSTRUCTIONS FROM PREVIOUS ATTEMPT:\n${fixInstructions}\n\n` : ''}

CHART TYPE: ${chartType} chart

DATA SCHEMA:
${JSON.stringify(aggregationResult.schema, null, 2)}

SAMPLE DATA (first 20 rows):
${JSON.stringify(aggregationResult.sample_rows, null, 2)}

CSV FILENAME TO USE IN d3.csv(): "hourly_data.csv"
(This will be intercepted and served from memory - use this exact filename)

REQUIREMENTS:
1. Create a complete HTML document with embedded D3.js v7
2. Use d3.csv("hourly_data.csv") to load data
3. Create a ${chartType} chart showing:
   - X-axis: date_hour (time)
   - Y-axis: MW_avg (megawatts)
   - Multiple series by energy_source (different colors)
4. Include:
   - Proper margins and responsive sizing
   - Axis labels with units
   - Legend showing energy sources
   - Error handling for CSV loading
5. Style professionally with a clean design

Generate the complete HTML code now. Return ONLY the HTML code as a string.`;

        const q = query({
            prompt,
            options: {
                ...this.options,
                agents: { 'd3-generator': d3CodeGenerationSubagent }
            }
        });

        let result: any = null;

        for await (const message of q) {
            if (message.type === 'result' && message.subtype === 'success') {
                result = {
                    success: true,
                    htmlCode: message.result
                };
            } else if (message.type === 'result' && (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution')) {
                result = {
                    success: false,
                    error: 'Agent execution failed'
                };
            }
        }

        return result || { success: false, error: 'No result returned' };
    }

    /**
     * Step 4: Execute validation subagent
     */
    private async executeValidation(
        svgPath: string,
        pngPath: string,
        schema: any
    ): Promise<any> {
        const prompt = `Validate D3 visualization output:

SVG FILE: ${svgPath}
PNG FILE: ${pngPath}

EXPECTED DATA CHARACTERISTICS:
- Row count: ${schema.row_count}
- Energy sources: ${schema.energy_sources.join(', ')}
- Time range: ${schema.time_range[0]} to ${schema.time_range[1]}
- Installations: ${schema.installations.length} unique installations

VALIDATION TASKS:
1. Read the SVG file using the Read tool
2. Check file sizes (SVG > 1KB, PNG > 10KB)
3. Parse SVG structure:
   - Count <path> elements (should be >= ${schema.energy_sources.length})
   - Count <text> elements (axes + legend)
   - Validate path data (no empty d="" or NaN values)
4. Detect common errors:
   - Empty visualization
   - Data not loaded
   - Incorrect scales
   - Missing legend items
5. Return JSON with status and validation results

Execute validation now.`;

        const q = query({
            prompt,
            options: {
                ...this.options,
                agents: { 'validator': validationSubagent }
            }
        });

        let result: any = null;

        for await (const message of q) {
            if (message.type === 'result' && message.subtype === 'success') {
                try {
                    result = extractJSON(message.result);
                } catch (error) {
                    result = {
                        status: 'FAIL',
                        errors: [`Failed to parse validation result: ${error}`]
                    };
                }
            } else if (message.type === 'result' && (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution')) {
                result = {
                    status: 'FAIL',
                    errors: ['Agent execution failed']
                };
            }
        }

        return result || { status: 'FAIL', errors: ['No validation result returned'] };
    }
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

export async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║   D3 Visualization Workflow - Complete Agent Pipeline Demo       ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY environment variable is not set');
        process.exit(1);
    }

    const workflow = new D3VisualizationWorkflow();

    try {
        await workflow.executeVisualizationPipeline(
            'C:/repos/SAGAMiddleware/data/filtered_energy_data.csv',
            'line',
            // Optional: filter to specific date range
            // { start: '2023-02-11', end: '2023-02-12' }
        );

        console.log('\n✅ Workflow completed successfully!\n');
    } catch (error) {
        console.error('\n❌ Workflow failed:', error);
        process.exit(1);
    }
}

// Auto-run when executed directly
main().catch(console.error);
