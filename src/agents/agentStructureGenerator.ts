/**
 * Agent Structure Generator - Tag Format
 *
 * Generates agent structures in the [AGENT: name, id]...[/AGENT] format
 * that the existing SagaWorkflow system expects.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult } from '../types/index.js';
import * as fs from 'fs';

export interface AgentStructureInput {
    prompt: string;
}

export class AgentStructureGenerator extends BaseSDKAgent {
    constructor(contextManager?: any) {
        super('AgentStructureGenerator', 10, contextManager);
    }

    /**
     * Execute agent structure generation
     */
    async execute(input: string): Promise<AgentResult> {
      
        try {
            const prompt = this.buildPrompt(input);
     console.log('AGENT STRUCTURE ', input)
            const output =  await this.executeQuery(prompt);//fs.readFileSync('C:/repos/SAGAMiddleware/data/histoAgentGenResult.txt', 'utf-8');/ TransactionGroupingFormProfileResult
            this.setContext(output);
             return {
                agentName: ' AgentStructureGenerator',
                result: output,
                success: true,
                timestamp: new Date(),
               
            };
        } catch (error) {
                  return {
                agentName: 'AgentStructureGenerator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }
    }

    /**
     * Build prompt for agent structure generation
     */
    protected buildPrompt(input: string): string {
        return `You are generating agent structures for a SAGA workflow system.

USER REQUEST:
${input}

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
        const result = await this.execute(userRequest );
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate agent structures');
        }
        result.result  =  fs.readFileSync('C:/repos/SAGAMiddleware/data/TransactionGroupingFormProfileResult.txt', 'utf-8');
        return result.result
    }
}
