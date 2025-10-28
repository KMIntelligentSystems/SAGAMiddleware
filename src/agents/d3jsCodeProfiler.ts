/**
 * D3JSCodeProfiler
 *
 * Generates D3.js visualization code based on user requirements and context data.
 * The SDK agent interprets both inputs and generates appropriate D3.js code.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

export class D3JSCodeProfiler {
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
     * Generate D3.js visualization code
     *
     * @param userRequirements - User's visualization requirements
     * @param contextData - Context from previous agent (contains data file path)
     * @returns Complete D3.js visualization code
     */
    async generateD3Code(userRequirements: string, contextData: string): Promise<string> {
        console.log('D3 JS REQ', userRequirements);
        console.log('CTX', contextData);


        const prompt = `You are a D3.js visualization code generator.

USER REQUIREMENTS:
${userRequirements}

CONTEXT DATA (contains CSV file path from MCP server):
${contextData}

YOUR TASK:
Generate complete D3.js code based on the user requirements. You must:
1. Extract the CSV file path from the context data
2. Read and inspect the CSV file to understand its structure (columns, data types, etc.)
3. Use d3.csv() method to load the file in the generated code
4. Create the visualization as specified in the requirements
5. Output complete HTML code ready to run in a browser

**IMPORTANT**
- Provide only code
- Zero explanatory text
- Zero markdown
`;

        const q = query({ prompt, options: this.options });

        let result = '';
        let turnCount = 0;

     /*   for await (const message of q) {
            turnCount++;

            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
                console.log(`[RESULT] Code generated (${result.length} chars)\n`);
            } else if (message.type === 'assistant') {
                console.log(`[TURN ${turnCount}] Generating...`);
            }
        }

        if (!result) {
            throw new Error('Failed to generate D3.js code');
        }*/

        console.log('✅ D3JSCodeProfiler complete\n', prompt);
        return result;
    }
}
