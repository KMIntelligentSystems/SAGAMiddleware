/**
 * D3JSCodeValidator
 *
 * Validates and improves D3.js visualization code based on data analysis recommendations.
 * Examines code against analysis requirements for data distribution, binning, scales, and rendering strategies.
 * Returns either: success message OR corrected code with all improvements applied.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import * as fs from 'fs'

export interface D3ValidationInput {
    d3jsCode: string;
    analysis: string;
}

export class D3JSCodeValidator extends BaseSDKAgent {
    constructor(contextManager?: any) {
        super('D3JSCodeValidator', 20, contextManager);
    }

    /**
     * Execute validation
     */
    async execute(input: D3ValidationInput): Promise<AgentResult> {

        let output;
        try {
            const ctx = this.contextManager.getContext('D3JSCodeValidator') as WorkingMemory;

            if (!ctx || !ctx.lastTransactionResult) {
                return {
                    agentName: 'D3JSCodeValidator',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Context not initialized: D3JSCodeValidator context must be set with d3jsCode and analysis before execution'
                };
            }

            input = ctx.lastTransactionResult as D3ValidationInput;
        
            if (!input.d3jsCode || typeof input.d3jsCode !== 'string' || input.d3jsCode.length === 0) {
                return {
                    agentName: 'D3JSCodeValidator',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Invalid input: d3jsCode field is missing or empty in context'
                };
            }

            if (!input.analysis || typeof input.analysis !== 'string' || input.analysis.length === 0) {
                return {
                    agentName: 'D3JSCodeValidator',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Invalid input: analysis field is missing or empty in context'
                };
            }

            const prompt = this.buildPrompt(input);
            output =fs.readFileSync('C:/repos/SAGAMiddleware/data/D3JSHistoCodeValidatedResult.txt', 'utf-8');//await this.executeQuery(prompt);//fs.readFileSync('C:/repos/main/chart5_2.html', 'utf-8');// fs.readFileSync('C:/repos/main/chart5_2.html', 'utf-8');//
         //   this.setContext(output)
            this.contextManager.updateContext('D3JSCodeValidator', {
                lastTransactionResult: output
            })

        } catch (error) {
             return {
                agentName: 'D3JSCodeValidator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: `Validation error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
          
        return {
                agentName: 'D3JSCodeValidator',
                result: output,
                success: true,
                timestamp: new Date()
            };
            
    }

    /**
     * Build prompt for validation
     */
    protected buildPrompt(input: D3ValidationInput): string {
        console.log('FINAL RESULT ', input)
        return `You are a D3.js code validation and improvement expert.

D3.JS CODE TO ANALYZE:
${input.d3jsCode}

ANALYSIS REPORT:
${input.analysis}

YOUR TASK:
Examine the D3.js code and apply the analysis to determine how the code needs to be improved. You must:

1. Carefully review the D3.js code structure and implementation
2. Study the analysis report which contains an assessment of the current implementation and specific recommendations for improvements
3. Identify all issues, gaps, or areas where the code does not meet the analysis requirements
4. Apply the recommended corrective actions to fix the code

OUTPUT RULES:
1. If NO issues found and code meets ALL analysis requirements:
   Return ONLY the text: "Code meets all analysis requirements. Visualization is correct."

2. If issues found or improvements needed:
   Return ONLY the complete corrected D3.js HTML code with ALL issues fixed according to the analysis.
   Do NOT include any explanations, markdown formatting, or additional text.
   Just the clean HTML code ready to run.`;
    }

    /**
     * Validate input
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.d3jsCode === 'string' &&
            input.d3jsCode.length > 0 &&
            typeof input.analysis === 'string' &&
            input.analysis.length > 0
        );
    }
}
