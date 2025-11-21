/**
 * Agent Structure Generator - Tag Format
 *
 * Generates agent structures in the [AGENT: name, id]...[/AGENT] format
 * that the existing SagaWorkflow system expects.
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
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
        // Get input from context manager
        input = this.getInput();

        try {
            const prompt = this.buildPrompt(input);
            console.log('AGENT STRUCTURE ', input)
            const output = fs.readFileSync('C:/repos/SAGAMiddleware/data/agentGeneratorResult.txt', 'utf-8');//await this.executeQuery(prompt);// TransactionGroupingFormProfileResult  fs.readFileSync('C:/repos/SAGAMiddleware/data/agentGeneratorResult.txt', 'utf-8');//
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
        return `You are generating agent structures for a SAGA workflow system that executes Python code.

USER REQUEST:
${input}

EXECUTION ENVIRONMENT:
The agents you generate will execute in an MCP Python Server with auto-persistence:
- Dictionaries named 'output', 'result', or 'results' are automatically saved after each agent completes
- Dictionary keys become available as global variables in the next agent's execution
- Example: If Agent1 creates output = {'prices': [1,2,3], 'count': 100},
  then Agent2 can directly access 'prices' and 'count' as global variables

YOUR TASK:
Generate agent structures with COMPLETE, EXECUTABLE Python code in this exact format:

[AGENT: AgentName, unique-id]
**AVAILABLE GLOBAL VARIABLES** (if not first agent):
- variable1: description
- variable2: description

**TASK**: Brief description of what this agent does

**COMPLETE PYTHON CODE**:
\`\`\`python
import pandas as pd
import numpy as np
# ... all necessary imports

# Use global variables from previous agents (if applicable)
# Example: prices_array = np.array(prices)  # 'prices' is a global variable

# ... complete working Python code ...

# Create output dictionary for next agent
output = {
    'key1': value1,
    'key2': value2,
    # ... all outputs needed by next agents
}

# Final agent should also print JSON for D3.js
# import json
# print(json.dumps(output))
\`\`\`

**OUTPUT**: Describe what gets stored in the output dictionary
[/AGENT]

[FLOW: agent1-id -> agent2-id -> agent3-id]

[TOOL_USERS: agent-id1, agent-id2]

CRITICAL RULES:
1. Each [AGENT] block must contain COMPLETE, EXECUTABLE Python code, NOT just instructions
2. The Python code should be production-ready and run without modifications
3. First agent creates initial output dictionary
4. Subsequent agents use global variables and create their own output dictionary
5. Final agent must print JSON: print(json.dumps(output))
6. Include all necessary imports in each agent
7. Handle errors appropriately with try/except blocks
8. Convert numpy/pandas types to native Python types (float(), int(), .tolist())
9. TOOL_USERS lists ALL agents that execute Python code

Generate the agent structures with COMPLETE EXECUTABLE CODE now.`;
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
     * Get input from context manager
     */
    protected getInput(): string {
        const ctx = this.contextManager.getContext('AgentStructureGenerator') as WorkingMemory;
        const actualResult = ctx?.lastTransactionResult;

        if (!actualResult) {
            throw new Error('AgentStructureGenerator context not initialized. Ensure DefineUserRequirementsProcess has run first.');
        }

        // The context should contain the structured prompt as a string
        return typeof actualResult === 'string' ? actualResult : JSON.stringify(actualResult);
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
