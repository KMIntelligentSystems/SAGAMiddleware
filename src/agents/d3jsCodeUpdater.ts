/**
 * D3JSCodeUpdater
 *
 * Updates D3.js visualization code based on validation feedback.
 * Uses Claude Agent SDK tools to read files and access validation results.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';

export interface D3CodeUpdateInput {
    existingCode?: string;
    userComment?: string;
}

export class D3JSCodeUpdater extends BaseSDKAgent {
    constructor(contextManager?: any) {
        super('D3JSCodeUpdater', 15, contextManager);

        // Setup custom tools for reading files
        this.setupFileReadingTools();
    }

    /**
     * Setup custom MCP tool for reading analysis file
     */
    private setupFileReadingTools(): void {
        const readAnalysisTool = tool(
            'read_analysis',
            'Reads the histogramMCPResponse_1.txt file containing the comprehensive data analysis with histogram bins, statistics, and processed values',
            {},
            async () => {
                return this.handleReadAnalysis();
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'd3-updater',
            tools: [readAnalysisTool]
        });

        // Add MCP server to options
        this.options.mcpServers = {
            'd3-updater': mcpServer
        } as any;
    }

    /**
     * Handler for read_analysis tool
     */
    private async handleReadAnalysis() {
        try {
            const analysisPath = 'c:/repos/SAGAMiddleware/data/histogramMCPResponse_1.txt';
            const content = fs.readFileSync(analysisPath, 'utf-8');

            return {
                content: [{
                    type: 'text' as const,
                    text: content
                }]
            };
        } catch (error) {
            console.error(`❌ Error reading analysis:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error reading analysis: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Execute D3 code update
     */
    async execute(_input: D3CodeUpdateInput): Promise<AgentResult> {
        try {
            const ctx = this.contextManager.getContext('D3JSCodeUpdater') as WorkingMemory;

            if (!ctx || !ctx.lastTransactionResult) {
                return {
                    agentName: 'D3JSCodeUpdater',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Context not initialized: D3JSCodeUpdater context must be set before execution'
                };
            }

            // Get data from context (set by D3JSCodeValidator)
            const userQuery = `Visualization: Create D3 js histogram of prices from the csv file . 
            You must use d3.csv() method to handle the input file. The data represents prices.
              RELATIVE PATH: ./data/prices.csv **NOTE** Use relative path in html 
              Outputs: Complete D3.js HTML histogram visualization` //ctx.lastTransactionResult.USER_QUERY;
            const code = ctx.lastTransactionResult.CODE;
            const appraisal = ctx.lastTransactionResult.APPRAISAL;
          
            const prompt = this.buildPrompt({ userQuery, code, appraisal });
            const output = await this.executeQuery(prompt);
            console.log('OUTPUT ', output)

            this.setContext({ 'D3JS_CODE': output });

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
     * Instructs Claude to use tool to read analysis file
     */
    protected buildPrompt(contextData: any): string {
        const { userQuery, code, appraisal } = contextData;

        return `Fix D3.js visualization code based on validation issues.

USER_QUERY (original requirements):
${userQuery}

EXISTING CODE:
${code}

APPRAISAL (validation issues):
${appraisal}

CRITICAL INSTRUCTIONS:
1. Review USER_QUERY to understand original requirements: visualization type, data loading method (e.g., d3.csv()), file path (relative/absolute), and any specific constraints
2. Call read_analysis tool to understand HOW to build the visualization, not to get the data itself.
   The ANALYSIS tells you:
   - "Here's where the data is located" (source path)
   - "Here's what the data looks like" (structure, statistics)
   - "Here's how to configure the visualization" (bins, scales, parameters)
3. Review APPRAISAL and identify all issues to fix (empty bars, y-axis scale problems, calculation errors, etc.)
4. Update EXISTING_CODE to fix APPRAISAL issues while maintaining USER_QUERY requirements and using ANALYSIS as configuration guide

REQUIRED OUTPUT FORMAT:
You MUST respond with ONLY the complete, fixed HTML code. Do NOT include:
- Explanations
- Summaries
- Markdown code fences
- Commentary

Start your response with "<!DOCTYPE html>" and end with "</html>".
Your entire response must be valid, runnable HTML code that can be saved directly to a file.

The fixed code must address ALL issues identified in the APPRAISAL while maintaining all USER_QUERY requirements.
`;
    }

    /**
     * Validate input for D3 code update
     */
    protected validateInput(_input: any): boolean {
        // For SDK agent, validation is less strict since tools handle the data
        return true;
    }

    /**
     * Get input from context manager
     */
    protected getInput(): D3CodeUpdateInput {
        const ctx = this.contextManager.getContext('D3JSCodeUpdater') as WorkingMemory;
        const actualResult = ctx?.lastTransactionResult;

        if (!actualResult) {
            return {};
        }

        return actualResult;
    }

}
