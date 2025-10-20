/**
 * Agent Structure Generator
 *
 * Uses Claude SDK to generate AgentDefinition structures, prompts, and context
 * that can be executed by SagaWorkflow with cheaper models (gpt-4o-mini)
 *
 * Flow:
 * 1. User describes task at high level
 * 2. Main agent (Sonnet) generates complete agent structures
 * 3. Output: JSON file with AgentDefinitions ready for SagaWorkflow
 * 4. SagaWorkflow executes with cheap models + MCP tools
 *
 * Benefits:
 * - Expensive model only for planning/structure generation
 * - Cheap models for actual execution
 * - Full control over execution flow
 * - Reusable agent definitions
 */

import {
    query,
    type AgentDefinition as SDKAgentDefinition,
    type Options,
    type SDKMessage
} from '@anthropic-ai/claude-agent-sdk';
import { AgentDefinition, LLMConfig } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generated agent structure ready for SagaWorkflow
 */
interface GeneratedAgentStructure {
    // Agent definition for SagaWorkflow
    agentDefinition: AgentDefinition;

    // Additional metadata
    purpose: string;
    expectedInput: string;
    expectedOutput: string;
    executionOrder?: number;
}

/**
 * Complete workflow specification
 */
interface WorkflowSpec {
    name: string;
    description: string;
    agents: GeneratedAgentStructure[];
    executionFlow: string[];
    context: Record<string, any>;
}

/**
 * Agent Structure Generator using Claude SDK
 */
export class AgentStructureGenerator {
    private options: Options;

    constructor() {
        // Simple agent for structure generation - no subagents needed
        this.options = {
            permissionMode: 'bypassPermissions',
            maxTurns: 10,
            cwd: process.cwd(),
            model: 'sonnet' // Use expensive model only for this planning step
        };
    }

    /**
     * Generate agent structures for a given task description
     */
    async generateAgentStructures(taskDescription: string): Promise<WorkflowSpec> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║          Agent Structure Generator - Planning Phase           ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        const prompt = this.buildPrompt(taskDescription);

        const q = query({
            prompt,
            options: this.options,
        });

        let workflowSpec: WorkflowSpec | null = null;
        let turnCount = 0;

        for await (const message of q) {
            turnCount++;

            if (message.type === 'result' && message.subtype === 'success') {
                console.log('\n[RESULT] Parsing generated workflow specification...\n');
                workflowSpec = this.parseWorkflowSpec(message.result);
            } else if (message.type === 'assistant') {
                console.log(`[TURN ${turnCount}] Agent generating structures...`);
            }
        }

        if (!workflowSpec) {
            throw new Error('Failed to generate workflow specification');
        }

        return workflowSpec;
    }

    /**
     * Build prompt for structure generation
     */
    private buildPrompt(taskDescription: string): string {
        return `You are an expert at designing agent-based workflows for data processing tasks.

Your job is to analyze a task and generate complete AgentDefinition structures that can be executed by the SagaWorkflow system.

═══════════════════════════════════════════════════════════════════════════
TASK DESCRIPTION:
═══════════════════════════════════════════════════════════════════════════

${taskDescription}

═══════════════════════════════════════════════════════════════════════════
YOUR TASK: Generate Agent Structures
═══════════════════════════════════════════════════════════════════════════

Analyze the task and create:

1. **Agent Definitions** - For each distinct role/responsibility, create an agent with:
   - Unique ID and name
   - Backstory (who they are, what they specialize in)
   - Task description (what they need to do)
   - Expected output (what they should produce)
   - Agent type: 'tool' (if using MCP tools like execute_python) or 'processing' (if pure reasoning)
   - LLM config (use gpt-4o-mini for cost efficiency)
   - Context (any data they need)

2. **Execution Flow** - The order agents should execute in

3. **Context** - Any shared data, file paths, configurations

═══════════════════════════════════════════════════════════════════════════
AGENT DEFINITION TEMPLATE:
═══════════════════════════════════════════════════════════════════════════

For each agent, create a structure like this:

\`\`\`json
{
  "agentDefinition": {
    "id": "UNIQUE-ID-01",
    "name": "DescriptiveAgentName",
    "backstory": "Clear description of the agent's expertise and role",
    "taskDescription": "Specific, detailed instructions for what this agent must do. Include:
      - Input data/files
      - Processing steps
      - Output format
      - Error handling
      - Tool usage (if agentType is 'tool')",
    "taskExpectedOutput": "Clear description of expected output format and content",
    "llmConfig": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "temperature": 0.2,
      "maxTokens": 2000
    },
    "context": {},
    "dependencies": [],
    "agentType": "tool"
  },
  "purpose": "High-level purpose of this agent",
  "expectedInput": "What data/files this agent receives",
  "expectedOutput": "What data/files this agent produces",
  "executionOrder": 1
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════
IMPORTANT GUIDELINES:
═══════════════════════════════════════════════════════════════════════════

**For Tool Agents (agentType: 'tool'):**
- These agents use MCP tools like execute_python
- taskDescription should include: "Use the execute_python MCP tool to run the code"
- Include complete code examples in the taskDescription
- Specify input/output file paths

**For Processing Agents (agentType: 'processing'):**
- These agents do analysis, validation, or planning
- No MCP tools needed
- Focus on reasoning and decision-making

**Task Descriptions:**
- Be VERY specific and detailed
- Include complete code templates if using execute_python
- Specify all file paths as absolute paths
- Include error handling instructions
- Give examples of expected outputs

**Cost Optimization:**
- Use gpt-4o-mini (cheap model) for all agents
- Keep temperature low (0.2) for consistent results
- Set reasonable maxTokens limits

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════════════════

Return your response as a JSON object with this structure:

\`\`\`json
{
  "name": "WorkflowName",
  "description": "Brief description of the workflow",
  "agents": [
    // Array of agent structures as shown in template above
  ],
  "executionFlow": ["agent-name-1", "agent-name-2", "agent-name-3"],
  "context": {
    "inputFile": "path/to/input",
    "outputFile": "path/to/output",
    // Any other shared context
  }
}
\`\`\`

Generate the complete workflow specification now.`;
    }

    /**
     * Parse the workflow specification from agent's response
     */
    private parseWorkflowSpec(result: string): WorkflowSpec {
        // Extract JSON from the response (might be wrapped in markdown)
        let jsonStr = result;

        // Try to find JSON in code blocks
        const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        try {
            const spec = JSON.parse(jsonStr);
            console.log(`✅ Parsed workflow: ${spec.name}`);
            console.log(`   Agents: ${spec.agents?.length || 0}`);
            console.log(`   Execution flow: ${spec.executionFlow?.join(' → ')}`);
            return spec;
        } catch (error) {
            console.error('❌ Failed to parse JSON:', error);
            console.error('Raw result:', result.substring(0, 500));
            throw new Error('Failed to parse workflow specification JSON');
        }
    }

    /**
     * Save workflow specification to file
     */
    async saveWorkflowSpec(spec: WorkflowSpec, outputPath: string): Promise<void> {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
        console.log(`\n✅ Workflow specification saved to: ${outputPath}`);
    }

    /**
     * Display workflow summary
     */
    displayWorkflowSummary(spec: WorkflowSpec): void {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                    Workflow Specification                      ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        console.log(`Name: ${spec.name}`);
        console.log(`Description: ${spec.description}\n`);

        console.log('Agents:');
        spec.agents.forEach((agent, idx) => {
            console.log(`  ${idx + 1}. ${agent.agentDefinition.name} (${agent.agentDefinition.agentType})`);
            console.log(`     Purpose: ${agent.purpose}`);
            console.log(`     Model: ${agent.agentDefinition.llmConfig.model}`);
        });

        console.log(`\nExecution Flow:`);
        console.log(`  ${spec.executionFlow.join(' → ')}`);

        console.log(`\nContext:`);
        console.log(`  ${JSON.stringify(spec.context, null, 2)}`);
    }
}

/**
 * Example usage
 */
export async function main() {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY environment variable is not set');
        process.exit(1);
    }

    // Example task: Hourly energy data aggregation
    const taskDescription = `
Process energy data from CSV files in two steps:

1. Data Normalization:
   - Input: C:/repos/SAGAMiddleware/data/two_days.csv (wide format with multi-row header)
   - Transform from wide format to long format
   - Output columns: date/time, installation, energy_source, MW
   - Energy source mapping:
     * Solar: BARCSF1, GRIFSF1, HUGSF1, LRSF1, MLSP1, ROTALLA1
     * Wind: CAPTL_WF, CHALLHWF, CULLRGWF, DIAPURWF1, MLWF1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1
     * Natural Gas: SHOAL1
     * Hydro: BUTLERSG, CLOVER, CLUNY, PALOONA, REPULSE, ROWALLAN, RUBICON
     * Diesel: ERGT01, GBO1
     * Battery: KEPBG1
     * Coal: ERGTO1, RPCG
   - Output: C:/repos/SAGAMiddleware/data/filtered_energy_data.csv

2. Hourly Aggregation:
   - Input: filtered_energy_data.csv (~14,785 rows, 5-minute intervals)
   - Parse date/time (format: '%d/%m/%Y %H:%M')
   - Group by hour: date_hour, installation, energy_source
   - Calculate mean MW → MW_avg
   - Handle NaN values, round to 2 decimals
   - Output: C:/repos/SAGAMiddleware/data/hourly_energy_data.csv

Both steps should use Python with pandas and execute via the execute_python MCP tool.
`;

    try {
        const generator = new AgentStructureGenerator();

        console.log('Generating agent structures for task...\n');
        const workflowSpec = await generator.generateAgentStructures(taskDescription);

        generator.displayWorkflowSummary(workflowSpec);

        // Save to file
        const outputPath = './generated_workflows/energy_data_processing.json';
        await generator.saveWorkflowSpec(workflowSpec, outputPath);

        console.log('\n' + '═'.repeat(70));
        console.log('✅ Agent structures generated successfully!');
        console.log('═'.repeat(70));
        console.log('\nNext steps:');
        console.log('  1. Review the generated workflow in:', outputPath);
        console.log('  2. Load and execute via SagaWorkflow with cheap models');
        console.log('  3. Cost: Planning ($0.30) + Execution (~$0.05) = Total ~$0.35\n');

    } catch (error) {
        console.error('\n✗ Error generating agent structures:', error);
        process.exit(1);
    }
}

// Auto-run main when executed directly
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(console.error);
}
