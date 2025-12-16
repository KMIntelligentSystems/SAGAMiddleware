/**
 * D3JSCodeValidator
 *
 * Validates D3.js visualization code by rendering it with Playwright MCP and analyzing
 * the visual output against user requirements and python data analysis.
 * Uses Claude Agent SDK tools to call Playwright MCP for rendering.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { D3VisualizationClient } from '../mcp/d3VisualizationClient.js';
import { mcpClientManager } from '../mcp/mcpClient.js';
import { opusCodeValidatorResult, openai3Issues } from '../test/histogramData.js'
import * as fs from 'fs';

export interface D3ValidationInput {
    d3jsCode: string;
    userRequirements: string;
    pythonAnalysis: any;
    svgFilePath?: string;
}

export class D3JSCodeValidator extends BaseSDKAgent {
    private d3Client: D3VisualizationClient | null = null;

    constructor(contextManager?: any) {
        super('D3JSCodeValidator', 20, contextManager);

        // Setup MCP tool for D3 visualization analysis
        this.setupAnalyzeD3OutputTool();
    }

    /**
     * Setup custom MCP tool for analyzing D3 visualization output
     */
    private setupAnalyzeD3OutputTool(): void {
        const analyzeD3OutputTool = tool(
            'analyze_d3_output',
            'Renders D3.js code via Playwright and returns paths to SVG/PNG files for analysis',
            {
                d3Code: z.string().describe('Complete D3.js HTML code to render'),
                csvData: z.string().optional().describe('CSV data content if needed by visualization'),
                csvFilename: z.string().optional().describe('CSV filename to intercept (e.g., "data.csv")')
            },
            async (args) => {
                return this.handleAnalyzeD3Output(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'd3-validator',
            tools: [analyzeD3OutputTool]
        });

        // Add MCP server to options
        this.options.mcpServers = {
            'd3-validator': mcpServer
        } as any;
    }

    /**
     * Handler for analyze_d3_output tool
     */
    private async handleAnalyzeD3Output(args: any) {
        try {
            console.log(`\n🎨 Rendering D3 visualization for validation...`);

            // Initialize D3 client if needed
            if (!this.d3Client) {
                this.d3Client = new D3VisualizationClient(mcpClientManager, 'playwright-server');
            }

            // Render the D3 code
            const result = await this.d3Client.renderD3({
                d3Code: args.d3Code,
                csvData: args.csvData,
                csvFilename: args.csvFilename,
                screenshotName: `validation-${Date.now()}.png`,
                svgName: `validation-${Date.now()}.svg`,
                outputPath: 'C:/repos/SAGAMiddleware/output/d3-visualizations'
            });

            if (result.success) {
                console.log(`✅ D3 visualization rendered for validation`);
                console.log(`   PNG: ${result.screenshotPath}`);
                console.log(`   SVG: ${result.svgPath}`);

                // Return success with paths
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: true,
                            svg_path: result.svgPath,
                            png_path: result.screenshotPath,
                            message: 'Visualization rendered successfully. Analyze the SVG output.'
                        }, null, 2)
                    }]
                };
            } else {
                console.error(`❌ Failed to render visualization: ${result.error}`);
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            error: result.error
                        }, null, 2)
                    }],
                    isError: true
                };
            }
        } catch (error) {
            console.error(`❌ Error in analyze_d3_output:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error rendering visualization: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Execute validation
     */
    async execute(input: D3ValidationInput): Promise<AgentResult> {
        try {
            const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;

            if (!ctx || !ctx.lastTransactionResult) {
                return {
                    agentName: 'D3JSCodeValidator',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Context not initialized: D3JSCodeValidator context must be set before execution'
                };
            }
//USER_QUERY: this.userQuery, ANALYSIS: analysis, CODE
            const userQuery = `Visualization: Create D3 js histogram of prices from the csv file . 
            You must use d3.csv() method to handle the input file. The data represents prices.
              RELATIVE PATH: ./data/prices.csv **NOTE** Use relative path in html 
              Outputs: Complete D3.js HTML histogram visualization`

            input.pythonAnalysis = ctx.lastTransactionResult.ANALYSIS;
            input.d3jsCode = ctx.lastTransactionResult.CODE;
            
            const prompt = this.buildPrompt(input);
        //    console.log('VALIDATOR PROMPT', prompt)
            const output = openai3Issues//await this.executeQuery(prompt); //opusCodeValidatorResult //

            this.setContext({ APPRAISAL: output, ANALYSIS: input.pythonAnalysis, CODE: input.d3jsCode });//CODE: input.d3jsCode,USER_REQUIREMENT: userQuery, ANALYSIS: input.pythonAnalysis,
            

            return {
                agentName: 'D3JSCodeValidator',
                result: output,
                success: true,
                timestamp: new Date()
            };

        } catch (error) {
            return {
                agentName: 'D3JSCodeValidator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: `Validation error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Build prompt for validation
     */
    protected buildPrompt(input: D3ValidationInput): string {
        return `Validate visualization output against data analysis.

DATA ANALYSIS:
${JSON.stringify(input.pythonAnalysis, null, 2)}

D3 JS CODE
${input.d3jsCode}
TASK:
1. Call analyze_d3_output tool ONCE with the complete d3Code shown above to render visualization
2. The tool will return file paths to the rendered SVG and PNG
3. Analyze the returned SVG file path information to validate the visualization
4. Compare the visualization against the data analysis requirements
5. Report validation result

Does the rendered visualization accurately represent the data analysis?

If accurate: Return "VALIDATION PASSED"
If issues found: Return "VALIDATION FAILED: [describe specific issues]"`;
    }

    /**
     * Get input from context manager
     */
    protected getInput(): D3ValidationInput {
        const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;
        const actualResult = ctx?.lastTransactionResult;

        if (!actualResult) {
            throw new Error('D3JSCodeValidator context not initialized.');
        }

        // Extract from context - structure depends on what was set by previous agents
        const d3jsCode = actualResult.d3jsCode || actualResult.D3JS_CODE || '';
        const userRequirements = actualResult.userRequirements || actualResult.USER_REQUIREMENTS || '';
        const pythonAnalysis = actualResult.pythonAnalysis || actualResult.DATA_ANALYSIS || actualResult.data || {};
        const svgFilePath = actualResult.svgFilePath || actualResult.SVG_FILE_PATH;

        return {
            d3jsCode,
            userRequirements,
            pythonAnalysis,
            svgFilePath
        };
    }

    /**
     * Validate input
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.d3jsCode === 'string' &&
            input.d3jsCode.length > 0 &&
            typeof input.userRequirements === 'string' &&
            input.userRequirements.length > 0 &&
            input.pythonAnalysis !== null &&
            typeof input.pythonAnalysis === 'object'
        );
    }

    /**
     * Close D3 client and cleanup
     */
    async close(): Promise<void> {
        if (this.d3Client) {
            await this.d3Client.close();
            this.d3Client = null;
        }
    }
}

/*
opus.html 

Based on my validation of the rendered D3.js visualization against the data analysis requirements, I can now provide the validation result:

## VALIDATION PASSED

The rendered visualization accurately represents all the data analysis requirements:

### ✅ Key Validation Points Confirmed:

1. **Data Integrity**
   - Total records: 9,995 (shown in title "n=9,995")
   - 100 values capped at threshold (orange bar at end shows exactly 100 capped values)
   - No records removed from dataset

2. **Distribution Characteristics**
   - Right-skewed distribution clearly visible with peak in lower price ranges
   - Outliers properly capped and displayed as distinct orange bar at ≥1187.84

3. **Statistical Measures**
   - Mean: 162 (red dashed line correctly positioned at 162.02)
   - Median: 103 (blue dashed line correctly positioned)
   - Mean > Median confirms right-skewed distribution

4. **Histogram Peaks**
   - Primary peak: Range [78.25, 111.87] with count 2537 (25.38%) - correctly shown as tallest bar
   - Secondary peak: Range [44.62, 78.25] with count 2466 (24.67%) - correctly shown as second tallest bar

5. **Axes Configuration**
   - X-axis: "Price" with range [11, 1187.84] extended to 1250 for capped values display
   - Y-axis: "Count" with appropriate range [0, 2700] to accommodate peak frequency of 2537

6. **Visualization Dimensions**
   - Width: 800px with margins (60 left, 30 right)
   - Height: 400px with margins (40 top, 60 bottom)
   - Matches specified dimensions exactly

7. **Special Features**
   - Capped outliers clearly distinguished with orange color
   - Legend properly identifies regular bins vs capped outliers
   - Statistical lines (mean/median) with appropriate labels
   - Bin count appears to be 36 regular bins + special capped bin

The visualization successfully communicates the right-skewed price distribution with appropriate handling of outliers through capping, maintaining data integrity while providing clear visual distinction between regular and capped values.


*/

/*
openai_3_issues.html

 ## Validation Analysis

After rendering and analyzing the D3.js visualization, I've identified a critical issue:

**VALIDATION FAILED: The visualization appears to be empty - no histogram bars are rendered**

### Specific Issues Found:

1. **Missing Data**: The histogram bars that should show the price distribution are not visible in the rendered output. The chart only shows:
   - The axes and grid lines
   - The title "Price Distribution (n=9,995) with Capped Outliers"
   - X-axis labeled "Price" (0-1200 range)
   - Y-axis labeled "Count" (0-2600 range)
   - But NO actual histogram bars

2. **Data Loading Problem**: The D3.js code attempts to load data from `./data/prices.csv`, but the provided sample CSV data appears to be insufficient test data (only ~140 values) instead of the actual 9,995 records mentioned in the analysis.

3. **Missing Visual Elements**: According to the data analysis, the visualization should display:
   - 39 histogram bins
   - A primary peak at range [78.25, 111.87] with 2,537 count
   - A secondary peak at range [44.62, 78.25] with 2,466 count
   - Reference lines for mean (162.02), median (103), and cap threshold (1187.84)
   - A special colored bar for capped outliers
   - None of these elements are visible in the rendered output

4. **Critical Mismatch**: The data analysis indicates 9,995 total records with specific distribution characteristics, but the visualization failed to render this data properly.

**VALIDATION FAILED: The histogram bars and reference lines are not rendered. The visualization is missing all data points and only shows empty axes framework.**
SDK NAME D3JSCodeValidator
SDK VALUE {
  APPRAISAL: '## Validation Analysis\n' +
    '\n' +
    "After rendering and analyzing the D3.js visualization, I've identified a critical issue:\n" +
    '\n' +
    '**VALIDATION FAILED: The visualization appears to be empty - no histogram bars are rendered**\n' +
    '\n' +
    '### Specific Issues Found:\n' +
    '\n' +
    '1. **Missing Data**: The histogram bars that should show the price distribution are not visible in the rendered output. The chart only shows:\n' +
    '   - The axes and grid lines\n' +
    '   - The title "Price Distribution (n=9,995) with Capped Outliers"\n' +
    '   - X-axis labeled "Price" (0-1200 range)\n' +
    '   - Y-axis labeled "Count" (0-2600 range)\n' +
    '   - But NO actual histogram bars\n' +
    '\n' +
    '2. **Data Loading Problem**: The D3.js code attempts to load data from `./data/prices.csv`, but the provided sample CSV data appears to be insufficient test data (only ~140 values) instead of the actual 9,995 records mentioned in the analysis.\n' +
    '\n' +
    '3. **Missing Visual Elements**: According to the data analysis, the visualization should display:\n' +
    '   - 39 histogram bins\n' +
    '   - A primary peak at range [78.25, 111.87] with 2,537 count\n' +
    '   - A secondary peak at range [44.62, 78.25] with 2,466 count\n' +
    '   - Reference lines for mean (162.02), median (103), and cap threshold (1187.84)\n' +
    '   - A special colored bar for capped outliers\n' +
    '   - None of these elements are visible in the rendered output\n' +
    '\n' +
    '4. **Critical Mismatch**: The data analysis indicates 9,995 total records with specific distribution characteristics, but the visualization failed to render this data properly.\n' +
    '\n' +
    '**VALIDATION FAILED: The histogram bars and reference lines are not rendered. The visualization is missing all data points and only shows empty axes framework.**',

*/