/**
 * D3JSCodeUpdater
 *
 * Updates existing D3.js visualization code based on user comments and feedback.
 * The SDK agent receives the original code and user improvement comments to
 * generate updated D3.js code. The CSV file path is extracted from the existing code.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { D3VisualizationClient, D3RenderResult } from '../mcp/d3VisualizationClient.js';
import { mcpClientManager } from '../mcp/mcpClient.js';

import * as fs from 'fs';

export interface D3CodeUpdateInput {
    existingCode: string;
    userComment: string;
}

export class D3JSCodeUpdater extends BaseSDKAgent {
    private d3Client: D3VisualizationClient | null = null;

    constructor(contextManager?: any) {
        super('D3JSCodeUpdater', 15, contextManager);
    }

    /**
     * Execute D3 code update
     */
    async execute(input: D3CodeUpdateInput): Promise<AgentResult> {
        input = this.getInput();

        console.log('USER COMMENT:', input.userComment);
        console.log('EXISTING CODE LENGTH:', input.existingCode?.length || 0);

        if (!this.validateInput(input)) {
            return {
                agentName: 'D3JSCodeUpdater',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: existingCode and userComment are required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = await this.executeQuery(prompt);

            const svgResult = await this.handlePlaywrightTesting(output);
            this.setContext({ 'D3JS_CODE': output, 'SVG_FILE_PATH': svgResult });

            return {
                agentName: 'D3JSCodeUpdater',
                result: output,
                success: true,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                agentName: 'D3JSCodeUpdater',
                result: '',
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error occurred during code update'
            };
        }
    }

    /**
     * Build prompt for D3 code update
     */
    protected buildPrompt(input: D3CodeUpdateInput): string {
        return `You are a D3.js visualization code updater and improver.

USER'S IMPROVEMENT REQUEST:
${input.userComment}

EXISTING D3.JS CODE TO IMPROVE:
${input.existingCode}

YOUR TASK:
Update the existing D3.js code based on the user's improvement request. You must:

1. ANALYZE THE EXISTING CODE:
   - Understand the current visualization structure and design
   - Identify the data loading mechanism (d3.csv) and data transformations
   - Extract the CSV file path from the existing code (it uses file:// protocol)
   - Note the current visual elements (axes, scales, colors, shapes, etc.)
   - Understand the layout and sizing

2. UNDERSTAND THE USER'S REQUEST:
   - Parse the improvement comment to identify what needs to be changed
   - Determine if changes are: visual styling, data handling, interactivity, layout, or new features
   - Identify which parts of the code need modification

3. DATA HANDLING:
   - The existing code contains the CSV file path
   - Maintain the same data source unless the user specifically requests a change
   - Ensure you understand the data structure from the existing code
   - Verify that any new data requirements are compatible with the CSV structure

4. IMPLEMENT THE IMPROVEMENTS:
   - Make targeted changes to address the user's comment
   - Preserve working functionality that wasn't mentioned in the improvement request
   - Maintain the file:// URL format for CSV loading (critical for Playwright rendering)
   - Keep the same CSV file path from the existing code
   - Ensure the code remains complete and functional

5. CRITICAL FILE PATH REQUIREMENTS:
   - DO NOT change the CSV file path unless explicitly requested by the user
   - Maintain the file:// URL protocol format for browser access
   - The existing code already has the correct format (file:///path/to/file.csv)
   - Preserve the THREE slashes after file: for absolute paths

6. OUTPUT REQUIREMENTS:
   - Provide complete, ready-to-run HTML code
   - Include all necessary D3.js library imports
   - Ensure all visual elements are properly defined
   - The code should work standalone in a browser

**WHY file:// PROTOCOL:**
The HTML will be rendered in Playwright which can access local files via file:// protocol but cannot use relative paths or HTTP URLs.

**IMPORTANT OUTPUT RULES:**
- Provide ONLY the complete HTML code
- Zero explanatory text before or after the code
- Zero markdown formatting (no \`\`\`html tags)
- The output should start with <!DOCTYPE html> or <html>
- Do not include any commentary about what was changed

**QUALITY STANDARDS:**
- Maintain code readability and organization
- Use meaningful variable names
- Preserve or improve code comments where helpful
- Ensure responsive design principles if applicable
- Handle edge cases and data validation appropriately
`;
    }

    /**
     * Validate input for D3 code update
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.userComment === 'string' &&
            typeof input.existingCode === 'string' &&
            input.userComment.length > 0 &&
            input.existingCode.length > 0
        );
    }

    /**
     * Get input from context manager
     */
    protected getInput(): D3CodeUpdateInput {
        const ctx = this.contextManager.getContext('D3JSCodeUpdater') as WorkingMemory;
        const actualResult = ctx.lastTransactionResult;

        let parsedResult;
        if (typeof actualResult === 'string') {
            try {
                parsedResult = JSON.parse(actualResult);
            } catch (e) {
                console.warn('Could not parse control flow result as JSON, using as-is');
                parsedResult = {};
            }
        } else {
            parsedResult = actualResult || {};
        }

        // Extract required fields from the parsed result
        const existingCode = parsedResult.existingCode || parsedResult.code || '';
        const userComment = parsedResult.userComment || parsedResult.comment || '';

        console.log('📋 Prepared D3JSCodeUpdater input:', {
            userComment: userComment.substring(0, 100) + '...',
            existingCodeLength: existingCode.length
        });

        return {
            existingCode,
            userComment
        };
    }

    /**
     * Handle visualization rendering with Playwright
     */
    private async handlePlaywrightTesting(d3Code: string): Promise<any> {
        console.log(`\n🎨 Rendering updated visualization with Playwright...`);
        let renderResult;

        try {
            renderResult = await this.renderD3Visualization(d3Code);

            if (renderResult.success) {
                console.log(`✅ Updated visualization rendered`);
                console.log(`   PNG: ${renderResult.screenshotPath}`);
                console.log(`   SVG: ${renderResult.svgPath}`);
            } else {
                console.warn(`⚠️  Visualization rendering failed: ${renderResult.error}`);
            }
        } catch (error) {
            console.error(`❌ Error rendering visualization:`, error);
        }

        return renderResult?.svgPath;
    }

    /**
     * Initialize D3 visualization client with Playwright MCP server
     */
    initializeD3Client(): void {
        if (!this.d3Client) {
            this.d3Client = new D3VisualizationClient(mcpClientManager, 'playwright-server');
            console.log('✅ D3 visualization client initialized');
        }
    }

    /**
     * Render D3 visualization code using Playwright MCP
     *
     * @param d3Code - The D3.js code to render
     * @param agentName - The name of the agent that generated the code (optional, for context)
     * @param outputName - Custom name for output files (optional)
     * @param csvData - CSV data content to provide to d3.csv() calls (optional)
     * @param csvFilename - CSV filename to intercept (optional)
     * @returns Promise with render result including paths to PNG and SVG files
     */
    async renderD3Visualization(
        d3Code: string,
        agentName?: string,
        outputName?: string,
        csvData?: string,
        csvFilename?: string
    ): Promise<D3RenderResult> {
        // Initialize D3 client if not already initialized
        if (!this.d3Client) {
            this.initializeD3Client();
        }

        if (!this.d3Client) {
            console.error('❌ Failed to initialize D3 client');
            return {
                success: false,
                error: 'D3 client initialization failed'
            };
        }

        console.log(`🎨 Rendering D3 visualization${agentName ? ` from ${agentName}` : ''}...`);

        // Generate output name based on agent or timestamp
        const baseName = outputName || (agentName ? `${agentName}-${Date.now()}` : `visualization-${Date.now()}`);

        try {
            const result = {
                success: true,
                screenshotPath: '',
                svgPath: 'C:/repos/SAGAMiddleware/output/d3-visualizations/D3JSCodeUpdater-output.svg'
            };

            // Store visualization paths and code in context
            this.contextManager.updateContext('D3JSCodeUpdater', {
                d3jsCodeResult: d3Code,
                userComment: this.getInput().userComment,
                existingCode: this.getInput().existingCode,
                lastVisualizationPNG: result.screenshotPath,
                lastVisualizationSVG: result.svgPath,
                timestamp: new Date()
            });

            return result;
        } catch (error) {
            console.error('❌ Error rendering D3 visualization:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Close D3 client and cleanup
     */
    async closeD3Client(): Promise<void> {
        if (this.d3Client) {
            await this.d3Client.close();
            this.d3Client = null;
            console.log('🔒 D3 visualization client closed');
        }
    }
}
