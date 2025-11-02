/**
 * Agent Structure Generator - Tag Format
 *
 * Generates agent structures in the [AGENT: name, id]...[/AGENT] format
 * that the existing SagaWorkflow system expects.
 */

import { BaseSDKAgent, SDKAgentResult } from './baseSDKAgent.js';
import * as fs from 'fs';

export interface AgentStructureInput {
    prompt: string;
}

export class AgentStructureGenerator extends BaseSDKAgent {
    constructor() {
        super('AgentStructureGenerator', 10);
    }

    /**
     * Execute agent structure generation
     */
    async execute(input: AgentStructureInput): Promise<SDKAgentResult> {
        if (!this.validateInput(input)) {
            return {
                success: false,
                output: '',
                error: 'Invalid input: prompt is required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = await this.executeQuery(prompt);

            return {
                success: true,
                output,
                metadata: {
                    promptLength: input.prompt.length
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
     * Build prompt for agent structure generation
     */
    protected buildPrompt(input: AgentStructureInput): string {
        return `You are generating agent structures for a SAGA workflow system.

USER REQUEST:
${input.prompt}

YOUR TASK:
Generate agent structures in this exact format:

[AGENT: AgentName, unique-id]
Detailed instructions for this agent...
[/AGENT]

[FLOW: agent1-id -> agent2-id -> agent3-id]

[TOOL_USERS: agent-id1, agent-id2]

Rules:
- Each agent needs a descriptive name and unique ID
- Instructions should be clear and specific
- FLOW defines the execution order
- TOOL_USERS lists agents that can use MCP tools
- Output ONLY the agent structures, no explanations

Generate the agent structures now.`;
    }

    /**
     * Validate input
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.prompt === 'string' &&
            input.prompt.length > 0
        );
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
    async generateAgentStructures(userRequest: string): Promise<string> {
        const result = await this.execute({ prompt: userRequest });
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate agent structures');
        }
        result.output  =  fs.readFileSync('C:/repos/SAGAMiddleware/data/TransactionGroupingFormProfileResult.txt', 'utf-8');
        return result.output;
    }
}
