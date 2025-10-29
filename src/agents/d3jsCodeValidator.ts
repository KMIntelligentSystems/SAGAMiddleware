/**
 * D3JSCodeValidator
 *
 * Validates D3.js visualization code against requirements and rendered output.
 * Returns either: success message OR corrected code.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

export class D3JSCodeValidator {
    private options: Options;

    constructor() {
        this.options = {
            permissionMode: 'bypassPermissions',
            maxTurns: 20,
            cwd: process.cwd(),
            model: 'sonnet'
        };
    }

    /**
     * Validate D3.js code against requirements and rendered output
     *
     * @param requirements - Original user requirements for the visualization
     * @param codePath - Path to the generated D3 code file
     * @param svgPath - Path to the rendered SVG output
     * @returns Either success message or corrected D3 code
     */
    async validateD3Code(
        requirements: string,
        codePath: string = 'c:/repos/SAGAMiddleware/data/d3jsCodeResult.txt',
        svgPath: string = 'c:/repos/SAGAMiddleware/output/d3-visualizations/D3JSCodingAgent-output.svg'
    ): Promise<string> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║              D3JSCodeValidator - Validating Code               ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        const prompt = `You are a D3.js code validation and correction expert.

USER REQUIREMENTS:
${requirements}

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

        const q = query({ prompt, options: this.options });

        let result = '';
        let turnCount = 0;

        for await (const message of q) {
            turnCount++;

            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
                console.log(`[RESULT] Validation complete\n`);
            } else if (message.type === 'assistant') {
                console.log(`[TURN ${turnCount}] Validating...`);
            }
        }

        if (!result) {
            throw new Error('Failed to validate D3.js code');
        }

        console.log('═'.repeat(67));
        if (result.includes('Requirements achieved')) {
            console.log('✅ Validation PASSED - Requirements achieved');
        } else {
            console.log('⚠️  Validation FAILED - Corrected code returned');
        }
        console.log('═'.repeat(67));
        console.log();

        return result;
    }
}
