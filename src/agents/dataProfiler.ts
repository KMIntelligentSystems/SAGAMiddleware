/**
 * DataProfiler
 *
 * Analyzes CSV files and generates detailed prompts for agent structure generation.
 *
 * Flow:
 * 1. User sends: file path + plain text requirements via socket
 * 2. SDK Claude (Sonnet) analyzes actual file + interprets requirements
 * 3. Outputs: Comprehensive prompt for AgentStructureGenerator
 *
 * The SDK agent figures out:
 * - File encoding, structure, headers
 * - DateTime formats, data mappings
 * - Transformation requirements
 * - Technical specifications for code generation
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult } from '../types/index.js';
import * as fs from 'fs'

export interface DataProfileInput {
    filepath: string;
    userRequirements: string;
}

export class DataProfiler extends BaseSDKAgent {
    constructor(contextManager?: any) {
        super('DataProfiler', 15, contextManager);
    }

    /**
     * Execute data profiling
     */
    async execute(input: DataProfileInput): Promise<AgentResult> {
   
        if (!this.validateInput(input)) {
            return {
                agentName: 'DataProfiler',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = fs.readFileSync('C:/repos/SAGAMiddleware/data/dataProfileResponse.txt', 'utf-8');//await this.executeQuery(prompt);
            this.setContext('[AGENT: DataProfiler tx-2-2' + output + '[/AGENT]');

            return {
               agentName: 'DataProfiler',
                result: output,
                success: true,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
              agentName: 'DataProfiler',
                result: '',
                success: false,
                timestamp: new Date(), 
                error: ''
            };
        }
    }

    /**
     * Build prompt for data profiling
     */
    protected buildPrompt(input: DataProfileInput): string {
        console.log('FILEPATH', input.filepath)
        console.log('USER ',input.userRequirements)
        return `You are analyzing a data processing task to generate specifications for agent creation.

FILE TO ANALYZE: ${input.filepath}

USER REQUIREMENTS:
${input.userRequirements}

YOUR TASK:

1. **Read and analyze the file** at ${input.filepath}:
   - Detect encoding (check for BOM character at start)
   - Understand structure (header rows, columns, MultiIndex)
   - Identify datetime columns and infer their exact format strings
   - Detect any data mappings/categories in the header structure
   - Note data characteristics (missing values, negatives, data types)

2. **Interpret user requirements**:
   - What transformations are needed?
   - What filters, aggregations, or outputs are requested?
   - Infer implicit requirements from context

3. **Generate a comprehensive prompt** for an agent structure generator.

Your output should be a detailed prompt that will be used to create [AGENT: Name, ID] structures.

Include in your prompt:
- EXACT technical specifications from your file analysis (encoding, date format strings, column flattening methods)
- Clear transformation requirements derived from user's request
- Critical instructions for Python coding agents (grouping keys, output formats, error prevention)
- Specific examples of what to avoid (wrong date formats, wrong aggregation grouping, syntax errors)

The agent structure generator will use your prompt to create detailed instructions for cheap LLMs (gpt-4o-mini).
Be specific about technical details you discovered - don't make the next agent guess.

Output the complete prompt now.`;
    }

    /**
     * Validate input for data profiling
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.filepath === 'string' &&
            typeof input.userRequirements === 'string' &&
            input.filepath.length > 0 &&
            input.userRequirements.length > 0
        );
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
    async analyzeAndGeneratePrompt(filepath: string, userRequirements: string): Promise<string> {
        const result = await this.execute({ filepath, userRequirements });
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate prompt from file analysis');
        }
        return result.result;
    }
}
