/**
 * D3JSCodeGenerator
 *
 * Generates D3.js visualization code based on user requirements and context data.
 * The SDK agent interprets both inputs and generates appropriate D3.js code.
 */

import { BaseSDKAgent} from './baseSDKAgent.js';
import { AgentResult } from '../types/index.js';

import * as fs from 'fs'


export interface D3CodeInput {
    filepath: string;
    userRequirements: string;
}

export class D3JSCodeGenerator extends BaseSDKAgent {
    constructor() {
        super('D3JSCodeGenerator', 15);
    }

    /**
     * Execute D3 code generation
     */
    async execute(input: D3CodeInput): Promise<AgentResult> {
        console.log('FILE ', input.filepath)
        console.log(input.userRequirements)
        if (!this.validateInput(input)) {
             return {
                agentName: ' D3JSCodeGenerator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = fs.readFileSync('C:/repos/SAGAMiddleware/data/D3JSCodeResult.txt', 'utf-8');//await this.executeQuery(prompt);

           return {
                agentName: ' D3JSCodeGenerator',
                result: output,
                success: true,
                timestamp: new Date()
            };
            
        } catch (error) {
            return {
                agentName: ' D3JSCodeGenerator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
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
${input.filepath}

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
            typeof input.filepath === 'string' &&
            input.userRequirements.length > 0 &&
            input.filepath.length > 0
        );
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
  /*  async generateD3Code(userRequirements: string, contextData: string): Promise<string> {
        const result = await this.execute({ userRequirements, contextData });
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate D3.js code');
        }
        return result.result;
    }*/
}
