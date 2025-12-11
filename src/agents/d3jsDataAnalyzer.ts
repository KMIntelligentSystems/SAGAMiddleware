/**
 * D3JSDataAnalyzer
 *
 * Analyzes data files to understand their structure and provide recommendations
 * for D3.js visualization based on user query requirements.
 * Uses Claude Agent SDK tools to read files from local directory.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';

export interface D3DataAnalyzerInput {
    userQuery: string;
    filePath: string;
}

export class D3JSDataAnalyzer extends BaseSDKAgent {
    constructor(contextManager?: any) {
        super('D3JSDataAnalyzer', 15, contextManager);
        // No custom MCP tools needed - Claude SDK has built-in Read tool
    }

    /**
     * Execute data analysis
     */
    async execute(input: D3DataAnalyzerInput): Promise<AgentResult> {
        try {
            const ctx = this.contextManager.getContext('D3JSDataAnalyzer') as WorkingMemory;

            if (!ctx || !ctx.lastTransactionResult) {
                return {
                    agentName: 'D3JSDataAnalyzer',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Context not initialized: D3JSCodeValidator context must be set before execution'
                };
            }

            // Build prompt and execute query
            // The Claude SDK will automatically use its built-in Read tool when prompted
            const prompt = this.buildPrompt(input);
            const output = ''//await this.executeQuery(prompt);
            console.log('DATA ANALYZER ', JSON.stringify(ctx.lastTransactionResult))

            // Store analysis result in context for downstream agents
            this.setContext({
                'DATA_ANALYSIS': output,
                'USER_QUERY': input.userQuery,
                'FILE_PATH': input.filePath
            });

            return {
                agentName: 'D3JSDataAnalyzer',
                result: output,
                success: true,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                agentName: 'D3JSDataAnalyzer',
                result: '',
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error occurred during data analysis'
            };
        }
    }

    /**
     * Build prompt for data analysis
     * Instructs Claude to read the data file and analyze structure
     */
    protected buildPrompt(input: D3DataAnalyzerInput): string {
        const { userQuery, filePath } = input;

        return `Analyze a CSV data file to understand its structure for D3.js visualization.

USER QUERY (visualization requirements):
${userQuery}

FILE PATH:
${filePath}

INSTRUCTIONS:
1. Read the CSV file at the specified path: ${filePath}
2. Examine the CSV file structure carefully:
   - Identify column names (from the header row)
   - Determine data types for each column (numeric, string, date, etc.)
   - Identify which columns are numeric vs categorical
   - Review sample data values from the first several rows
   - Count total number of rows
3. Analyze the data as it pertains to the USER QUERY requirements:
   - What type of graph is requested (histogram, bar chart, line chart, scatter plot, etc.)?
   - Which CSV columns are relevant for this visualization?
   - What data transformations might be needed?
   - Are there any data quality issues (missing values, inconsistent formats, empty cells)?

REQUIRED OUTPUT:
Provide a structured report with the following sections:

1. FILE INFORMATION:
   - File name: [Extract the actual file name from the path]
   - Full file path: ${filePath} (output the EXACT path provided - this will be used with d3.csv())
   - Relative path from project root (if applicable)

2. CSV FILE STRUCTURE:
   - Column names and their data types
   - Sample data values (first 5-10 rows)
   - Total number of data rows
   - Delimiter used (comma, semicolon, etc.)

3. RELEVANCE TO VISUALIZATION:
   - Which columns match the visualization requirements from USER QUERY
   - Recommended column mappings for the graph (e.g., "use 'price' column for histogram values")
   - Data range for numeric columns (min, max, typical values)
   - Distribution characteristics (if applicable)

4. D3.JS RECOMMENDATIONS:
   - Use d3.csv() method to load the data with the file path from section 1
   - Specify which column(s) to use for the visualization
   - Recommended data type conversions (e.g., convert string to number using +d.columnName)
   - Suggested scale types (linear, log, time, etc.)
   - Recommended bin counts or axis configurations for the specific graph type

5. DATA QUALITY NOTES:
   - Any missing, null, or empty values in relevant columns
   - Data type inconsistencies (e.g., numbers stored as strings)
   - Outliers or unusual patterns that might affect visualization
   - Any rows that should be filtered or cleaned

Be thorough and specific in your analysis to help the D3.js code generator create accurate CSV-based visualizations.`;
    }

    /**
     * Validate input for data analysis
     */
    protected validateInput(input: any): boolean {
        if (!input || typeof input !== 'object') {
            return false;
        }

        const { userQuery, filePath } = input as D3DataAnalyzerInput;

        return (
            typeof userQuery === 'string' &&
            userQuery.trim().length > 0 &&
            typeof filePath === 'string' &&
            filePath.trim().length > 0
        );
    }

    /**
     * Get input from context manager (if needed)
     */
    protected getInput(): D3DataAnalyzerInput {
        const ctx = this.contextManager.getContext('D3JSDataAnalyzer') as WorkingMemory;
        const actualResult = ctx?.lastTransactionResult;

        if (!actualResult) {
            return {
                userQuery: '',
                filePath: ''
            };
        }

        return {
            userQuery: actualResult.USER_QUERY || '',
            filePath: actualResult.FILE_PATH || ''
        };
    }
}
