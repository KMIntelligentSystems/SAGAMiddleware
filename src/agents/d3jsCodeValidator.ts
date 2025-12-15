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
import { opusCodeValidatorResult } from '../test/histogramData.js'
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
            const output = ''//await this.executeQuery(prompt); //opusCodeValidatorResult //

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

TASK:
1. Call analyze_d3_output tool with the d3Code to render visualization
2. Examine the SVG output elements
3. Compare SVG visual representation against data analysis
4. Report validation result

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
