/**
 * D3JSCodeProfiler
 *
 * Generates D3.js visualization code based on user requirements and context data.
 * The SDK agent interprets both inputs and generates appropriate D3.js code.
 */

import { BaseSDKAgent, SDKAgentResult } from './baseSDKAgent.js';

export interface D3CodeInput {
    userRequirements: string;
    contextData: string;
}

export class D3JSCodeProfiler extends BaseSDKAgent {
    constructor() {
        super('D3JSCodeProfiler', 15);
    }

    /**
     * Execute D3 code generation
     */
    async execute(input: D3CodeInput): Promise<SDKAgentResult> {
        if (!this.validateInput(input)) {
            return {
                success: false,
                output: '',
                error: 'Invalid input: userRequirements and contextData are required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = await this.executeQuery(prompt);

            return {
                success: true,
                output,
                metadata: {
                    requirements: input.userRequirements,
                    contextLength: input.contextData.length
                }
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Build prompt for D3 code generation
     */
    protected buildPrompt(input: D3CodeInput): string {
        return `You are a D3.js visualization code generator.

USER REQUIREMENTS:
${input.userRequirements}

CONTEXT DATA (contains CSV file path from MCP server):
${input.contextData}

YOUR TASK:
Generate complete D3.js code based on the user requirements. You must:
1. Extract the CSV file path from the context data
2. Read and inspect the CSV file to understand its structure (columns, data types, etc.)
3. Use d3.csv() method to load the file in the generated code
4. CRITICAL: Convert the file path to file:// URL format for browser access
   - Windows path: C:/repos/SAGAMiddleware/data/file.csv → file:///C:/repos/SAGAMiddleware/data/file.csv
   - Unix path: /home/user/data/file.csv → file:///home/user/data/file.csv
   - Note the THREE slashes after file: for absolute paths
5. Create the visualization as specified in the requirements
6. Output complete HTML code ready to run in a browser

**WHY file:// PROTOCOL:**
The HTML will be rendered in Playwright which can access local files via file:// protocol but cannot use relative paths or HTTP URLs.

**IMPORTANT**
- Provide only code
- Zero explanatory text
- Zero markdown
`;
    }

    /**
     * Validate input for D3 code generation
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.userRequirements === 'string' &&
            typeof input.contextData === 'string' &&
            input.userRequirements.length > 0 &&
            input.contextData.length > 0
        );
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
    async generateD3Code(userRequirements: string, contextData: string): Promise<string> {
        const result = await this.execute({ userRequirements, contextData });
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate D3.js code');
        }
        return result.output;
    }
}
