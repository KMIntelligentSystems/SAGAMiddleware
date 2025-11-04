/**
 * D3JSCodeValidator
 *
 * Validates D3.js visualization code against requirements and rendered output.
 * Returns either: success message OR corrected code.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult } from '../types/index.js';

export interface D3ValidationInput {
    requirements: string;
    codePath?: string;
    svgPath?: string;
}

export class D3JSCodeValidator extends BaseSDKAgent {
    constructor() {
        super('D3JSCodeValidator', 20);
    }

    /**
     * Execute validation
     */
    async execute(input: D3ValidationInput): Promise<AgentResult> {

        if (!this.validateInput(input)) {
            return {
                agentName: 'D3JSCodeValidator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = await this.executeQuery(prompt);

            const isValid = output.includes('Requirements achieved');

             return {
                agentName: 'D3JSCodeValidator',
                result: output,
                success: true,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
            
        } catch (error) {
             return {
                agentName: 'D3JSCodeValidator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }
    }

    /**
     * Build prompt for validation
     */
    protected buildPrompt(input: D3ValidationInput): string {
        const codePath = input.codePath || 'c:/repos/SAGAMiddleware/data/d3jsCodeResult.txt';
        const svgPath = input.svgPath || 'c:/repos/SAGAMiddleware/output/d3-visualizations/D3JSCodingAgent-output.svg';

        return `You are a D3.js code validation and correction expert.

USER REQUIREMENTS:
${input.requirements}

YOUR TASK:
Validate the D3.js code against the requirements and rendered output. You must:

1. Read the generated D3 code from: ${codePath}
2. Read the rendered SVG output from: ${svgPath}
3. Analyze if the code meets ALL user requirements
4. Check for any runtime errors or issues visible in the SVG
5. Verify the visualization renders correctly

VALIDATION CRITERIA:
- Does the code fulfill all requirements?
- Are there any JavaScript errors or bugs?
- Does the rendered SVG show the expected visualization?
- Are all interactive features working (legend, tooltips, etc.)?
- Is the data displayed correctly?
- Are axes, labels, and titles present and correct?

OUTPUT RULES:
1. If NO issues found:
   Return ONLY the text: "Requirements achieved. Visualization is correct."

2. If issues found:
   Return ONLY the complete corrected D3.js HTML code with ALL issues fixed.
   Do NOT include any explanations, markdown, or additional text.
   Just the clean HTML code ready to run.`;
    }

    /**
     * Validate input
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.requirements === 'string' &&
            input.requirements.length > 0
        );
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
    async validateD3Code(
        requirements: string,
        codePath?: string,
        svgPath?: string
    ): Promise<string> {
        const result = await this.execute({ requirements, codePath, svgPath });
        if (!result.success) {
            throw new Error(result.error || 'Failed to validate D3.js code');
        }
        return result.result;
    }
}
