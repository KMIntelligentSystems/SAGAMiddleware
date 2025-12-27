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
import { trigger_conversation, trigger_code_correction, ValidatorToolContext } from '../tools/validatorTools.js';

export interface D3ValidationInput {
    d3jsCode: string;
    userRequirements: string;
    pythonAnalysis: any;
    svgFilePath?: string;
}

export class D3JSCodeValidator extends BaseSDKAgent {
    private d3Client: D3VisualizationClient | null = null;
    private coordinator: any; // Reference to SagaCoordinator for local tools

    constructor(contextManager?: any, coordinator?: any) {
        super('D3JSCodeValidator', 20, contextManager);
        this.coordinator = coordinator;

        // Setup MCP tools for D3 visualization analysis and decision making
        this.setupValidatorTools();
    }

    /**
     * Setup MCP tools for validation and autonomous decision making
     */
    private setupValidatorTools(): void {
        // Tool 1: Render and analyze D3 output
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

        // Tool 2: Trigger conversation (validation PASSED)
        const triggerConversationTool = tool(
            'trigger_conversation',
            'Pass validated D3.js code to ConversationAgent for user output. Use when validation PASSES.',
            {
                code: z.string().describe('The validated D3.js code to send to user'),
                message: z.string().optional().describe('Optional success message to include with the code')
            },
            async (args) => {
                return this.handleTriggerConversation(args);
            }
        );

        // Tool 3: Trigger code correction (validation FAILED)
        const triggerCodeCorrectionTool = tool(
            'trigger_code_correction',
            'Request D3JSCodingAgent to fix validation errors. Use when validation FAILS.',
            {
                originalCode: z.string().describe('The original D3.js code that failed validation'),
                validationErrors: z.array(z.string()).describe('List of specific validation errors to fix'),
                validationReport: z.any().describe('Complete validation report with details')
            },
            async (args) => {
                return this.handleTriggerCodeCorrection(args);
            }
        );

        // Create MCP server with all tools
        const mcpServer = createSdkMcpServer({
            name: 'd3-validator',
            tools: [analyzeD3OutputTool, triggerConversationTool, triggerCodeCorrectionTool]
        });

        // Add MCP server to options - merge with existing servers (like Railway HTTP servers)
        this.options.mcpServers = {
            ...this.options.mcpServers,  // Keep existing servers (Railway HTTP MCP servers)
            'd3-validator': mcpServer     // Add local tool server
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
     * Handler for trigger_conversation tool
     * Called when validation PASSES - sends code to ConversationAgent
     */
    private async handleTriggerConversation(args: any) {
        try {
            console.log('🎯 trigger_conversation tool called - validation PASSED');

            if (!this.coordinator) {
                throw new Error('Coordinator not available - cannot trigger conversation');
            }

            // Get current validation context
            const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;
            const validationReport = ctx?.lastTransactionResult;

            // Create tool context
            const toolContext: ValidatorToolContext = {
                coordinator: this.coordinator,
                validationReport: validationReport,
                originalCode: args.code
            };

            // Call the local tool function
            const result = await trigger_conversation(toolContext, args);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        } catch (error) {
            console.error('❌ Error in handleTriggerConversation:', error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error triggering conversation: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Handler for trigger_code_correction tool
     * Called when validation FAILS - requests D3JSCodingAgent to fix errors
     */
    private async handleTriggerCodeCorrection(args: any) {
        try {
            console.log('🔧 trigger_code_correction tool called - validation FAILED');

            if (!this.coordinator) {
                throw new Error('Coordinator not available - cannot trigger code correction');
            }

            // Get current validation context
            const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;
            const validationReport = ctx?.lastTransactionResult;

            // Create tool context
            const toolContext: ValidatorToolContext = {
                coordinator: this.coordinator,
                validationReport: validationReport,
                originalCode: args.originalCode
            };

            // Call the local tool function
            const result = await trigger_code_correction(toolContext, args);

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2)
                }]
            };
        } catch (error) {
            console.error('❌ Error in handleTriggerCodeCorrection:', error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error triggering code correction: ${error instanceof Error ? error.message : String(error)}`
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
            const output = await this.executeQuery(prompt); //opusCodeValidatorResult //openai3Issues//

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
        return `Validate D3.js visualization and autonomously decide the next action.

DATA ANALYSIS:
${JSON.stringify(input.pythonAnalysis, null, 2)}

D3 JS CODE:
${input.d3jsCode}

YOUR TASK:
1. Call analyze_d3_output tool ONCE with the complete d3Code shown above to render the visualization
2. The tool will return file paths to the rendered SVG and PNG files
3. Analyze the SVG output to validate whether the visualization accurately represents the data analysis
4. Make an AUTONOMOUS DECISION about what happens next:

**IF VALIDATION PASSES:**
   - Call trigger_conversation tool with:
     - code: the validated D3.js code
     - message: brief success message
   - This sends the code directly to the user via ConversationAgent

**IF VALIDATION FAILS:**
   - Call trigger_code_correction tool with:
     - originalCode: the D3.js code that failed
     - validationErrors: array of specific error descriptions
     - validationReport: complete validation details
   - This triggers D3JSCodingAgent to generate corrected code

CRITICAL: You must call ONE of the two decision tools (trigger_conversation OR trigger_code_correction) based on your validation assessment. Do not just report the result - take action by calling the appropriate tool.`;
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