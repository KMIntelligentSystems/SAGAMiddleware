/**
 * Workflow Requirements Builder Tool
 *
 * LOCAL tool (not MCP server) that transforms conversational inputs into structured WorkflowRequirements
 * for the DAG Designer. Used by conversational agents during natural language interactions with users.
 *
 * Pattern: Similar to D3JSCodeValidator's triggerConversationTool
 * Purpose: Simple text-to-structured-data transformation
 * Input: Structured parameters gathered from conversation
 * Output: WorkflowRequirements JSON object
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { WorkflowRequirements, FrontendAgentSpec } from '../types/dag.js';

/**
 * Build Workflow Requirements Tool (Local Tool Definition)
 *
 * Converts conversational inputs into a structured WorkflowRequirements object
 * that can be passed to the DAG Designer for autonomous workflow creation.
 *
 * This is a LOCAL tool definition - use createWorkflowRequirementsToolServer()
 * to create the MCP server for an agent.
 */
export const buildWorkflowRequirementsTool = tool(
    'build_workflow_requirements',
    'Transforms conversational inputs into structured WorkflowRequirements for DAG Designer. Use after gathering workflow details from user.',
    {
        // Required: Core workflow information
        objective: z.string()
            .min(10)
            .describe('Clear statement of what the user wants to accomplish. Example: "Create validated D3 histogram from CSV data"'),

        // Required: Input data specification
        inputDataType: z.string()
            .describe('Type of input data: csv_file, json_file, api_endpoint, database_query, text_input, xml_file, etc.'),

        inputDataSource: z.string()
            .describe('Location or description of input data. Examples: "./data/prices.csv", "https://api.example.com/data", "SELECT * FROM users"'),

        // Optional: Input schema details
        inputSchema: z.any()
            .optional()
            .describe('Optional schema information. For CSV: {columns: ["price", "date"], rowCount: 10000}. For JSON: structure description.'),

        // Required: Output specification
        outputType: z.string()
            .describe('Type of output to produce: html_visualization, json_report, csv_export, statistical_report, dashboard, pdf_document, etc.'),

        // Optional: Output format details
        outputFormat: z.string()
            .optional()
            .describe('Specific output format. For visualizations: d3_histogram, d3_bar_chart, d3_line_chart, d3_scatter_plot, d3_heatmap. For reports: summary_table, detailed_analysis, comparison_matrix.'),

        // Optional: Quality requirements
        outputQuality: z.array(z.string())
            .optional()
            .describe('Quality requirements as array. Options: validated, data_accurate, production_ready, accessible, responsive, optimized, error_handled, tested.'),

        // Optional: Execution constraints
        maxExecutionTime: z.number()
            .optional()
            .describe('Maximum execution time in milliseconds. Default: 60000 (60 seconds). Example: 120000 for 2 minutes.'),

        mustIncludeAgents: z.array(z.string())
            .optional()
            .describe('Required agents that must be included in workflow. Examples: ["D3JSCodeValidator", "DataProfiler", "ConversationAgent"]'),

        mustExcludeAgents: z.array(z.string())
            .optional()
            .describe('Agents to exclude from workflow. Examples: ["ToolCallingAgent", "D3JSCodingAgent"]'),

        parallelismAllowed: z.boolean()
            .optional()
            .default(true)
            .describe('Whether parallel execution is allowed. Default: true. Set false for sequential-only workflows.'),

        // Optional: Frontend agent specifications
        agents: z.array(z.object({
            name: z.string(),
            description: z.string(),
            task: z.string(),
            inputFrom: z.string().nullable(),
            outputSchema: z.any().optional()
        }))
            .optional()
            .describe('Optional array of frontend-specified Python agents with detailed task descriptions. Used by ExecuteAgentsStrategy.')
    },
    async (args: {
        objective: string;
        inputDataType: string;
        inputDataSource: string;
        inputSchema?: any;
        outputType: string;
        outputFormat?: string;
        outputQuality?: string[];
        maxExecutionTime?: number;
        mustIncludeAgents?: string[];
        mustExcludeAgents?: string[];
        parallelismAllowed?: boolean;
        agents?: FrontendAgentSpec[];
    }) => {
        try {
            // Construct WorkflowRequirements object
            const requirements: WorkflowRequirements = {
                objective: args.objective,

                inputData: {
                    type: args.inputDataType,
                    source: args.inputDataSource,
                    schema: args.inputSchema
                },

                outputExpectation: {
                    type: args.outputType,
                    format: args.outputFormat,
                    quality: args.outputQuality
                },

                agents: args.agents, // Preserve frontend agent specifications

                constraints: {
                    maxExecutionTime: args.maxExecutionTime,
                    mustIncludeAgents: args.mustIncludeAgents || [],
                    mustExcludeAgents: args.mustExcludeAgents || [],
                    parallelismAllowed: args.parallelismAllowed
                }
            };

            // Return as formatted JSON for DAG Designer
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(requirements, null, 2)
                }]
            };

        } catch (error) {
            // Handle errors gracefully
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        error: 'Failed to build workflow requirements',
                        message: error instanceof Error ? error.message : String(error),
                        receivedArgs: args
                    }, null, 2)
                }],
                isError: true
            };
        }
    }
);

/**
 * Helper function to validate WorkflowRequirements completeness
 */
export function validateWorkflowRequirements(req: WorkflowRequirements): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!req.objective || req.objective.length < 10) {
        errors.push('Objective must be at least 10 characters and clearly describe the goal');
    }

    if (!req.inputData.type) {
        errors.push('Input data type is required');
    }

    if (!req.inputData.source) {
        errors.push('Input data source is required');
    }

    if (!req.outputExpectation.type) {
        errors.push('Output type is required');
    }

    // Warnings for optional but recommended fields
    if (!req.outputExpectation.format) {
        warnings.push('Output format not specified - DAG Designer will choose automatically');
    }

    if (!req.outputExpectation.quality || req.outputExpectation.quality.length === 0) {
        warnings.push('No quality requirements specified - workflow may not include validation');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Common input types reference
 */
export const COMMON_INPUT_TYPES = {
    'csv_file': 'Comma-separated values file',
    'json_file': 'JSON data file',
    'api_endpoint': 'REST API endpoint',
    'database_query': 'SQL database query',
    'text_input': 'Direct text or string input',
    'xml_file': 'XML data file',
    'excel_file': 'Excel spreadsheet',
    'parquet_file': 'Apache Parquet file'
} as const;

/**
 * Common output types reference
 */
export const COMMON_OUTPUT_TYPES = {
    'html_visualization': 'HTML-based visualization (D3.js, etc.)',
    'json_report': 'Structured JSON report',
    'csv_export': 'CSV data export',
    'statistical_report': 'Statistical analysis report',
    'dashboard': 'Interactive dashboard',
    'pdf_document': 'PDF document',
    'markdown_report': 'Markdown-formatted report'
} as const;

/**
 * Common visualization formats
 */
export const VISUALIZATION_FORMATS = {
    'd3_histogram': 'D3.js histogram',
    'd3_bar_chart': 'D3.js bar chart',
    'd3_line_chart': 'D3.js line chart',
    'd3_scatter_plot': 'D3.js scatter plot',
    'd3_heatmap': 'D3.js heatmap',
    'd3_pie_chart': 'D3.js pie chart',
    'd3_area_chart': 'D3.js area chart'
} as const;

/**
 * Quality requirement options
 */
export const QUALITY_OPTIONS = {
    'validated': 'Includes validation checks',
    'data_accurate': 'Data integrity verified',
    'production_ready': 'Robust error handling',
    'accessible': 'WCAG compliant',
    'responsive': 'Mobile-friendly',
    'optimized': 'Performance optimized',
    'error_handled': 'Comprehensive error handling',
    'tested': 'Includes automated tests'
} as const;

/**
 * Simple function for ConversationAgent to call directly
 *
 * @param params - Workflow parameters gathered from conversation
 * @returns WorkflowRequirements object ready for DAG Designer
 */
export async function buildWorkflowRequirements(params: {
    objective: string;
    inputDataType: string;
    inputDataSource: string;
    inputSchema?: any;
    outputType: string;
    outputFormat?: string;
    outputQuality?: string[];
    maxExecutionTime?: number;
    mustIncludeAgents?: string[];
    mustExcludeAgents?: string[];
    parallelismAllowed?: boolean;
    agents?: FrontendAgentSpec[];
}): Promise<WorkflowRequirements> {
    const requirements: WorkflowRequirements = {
        objective: params.objective,

        inputData: {
            type: params.inputDataType,
            source: params.inputDataSource,
            schema: params.inputSchema
        },

        outputExpectation: {
            type: params.outputType,
            format: params.outputFormat,
            quality: params.outputQuality
        },

        agents: params.agents, // Preserve frontend agent specifications

        constraints: {
            maxExecutionTime: params.maxExecutionTime,
            mustIncludeAgents: params.mustIncludeAgents || [],
            mustExcludeAgents: params.mustExcludeAgents || [],
            parallelismAllowed: params.parallelismAllowed ?? true
        }
    };

    return requirements;
}
