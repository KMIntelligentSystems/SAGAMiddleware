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

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

export class DataProfiler {
    private options: Options;

    constructor() {
        this.options = {
            permissionMode: 'bypassPermissions',
            maxTurns: 15,
            cwd: process.cwd(),
            model: 'sonnet'
        };
    }

    /**
     * Analyze file and generate prompt for agent generation
     *
     * @param filepath - Path to CSV file to analyze
     * @param userRequirements - Plain text description of what to do with the data
     * @returns Comprehensive prompt for AgentStructureGenerator
     */
    async analyzeAndGeneratePrompt(filepath: string, userRequirements: string): Promise<string> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                    DataProfiler - Analyzing                    ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');
        console.log(`File: ${filepath}`);
        console.log(`Requirements: ${userRequirements.substring(0, 100)}...\n`);

        const prompt = `You are analyzing a data processing task to generate specifications for agent creation.

FILE TO ANALYZE: ${filepath}

USER REQUIREMENTS:
${userRequirements}

YOUR TASK:

1. **Read and analyze the file** at ${filepath}:
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

        const q = query({ prompt, options: this.options });

        let result = '';
        let turnCount = 0;

        for await (const message of q) {
            turnCount++;

            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
                console.log(`[RESULT] Prompt generated (${result.length} chars)\n`);
            } else if (message.type === 'assistant') {
                console.log(`[TURN ${turnCount}] Analyzing...`);
            }
        }

        if (!result) {
            throw new Error('Failed to generate prompt from file analysis');
        }

        console.log('═'.repeat(67));
        console.log('✅ DataProfiler complete');
        console.log('═'.repeat(67));
        console.log('\nNext step: Pass this prompt to AgentStructureGenerator\n');

        return result;
    }
}
