/**
 * Agent Structure Generator - Tag Format
 *
 * Generates agent structures in the [AGENT: name, id]...[/AGENT] format
 * that the existing SagaWorkflow system expects.
 *
 * Flow:
 * 1. User request → AgentStructureGenerator (Sonnet 4)
 * 2. Generates: [AGENT: name, id]instructions[/AGENT] format
 * 3. Output sent to SagaWorkflow via socket
 * 4. DefineGenericAgentsProcess.parseConversationResultForAgent extracts instructions
 * 5. AgentParser.parseAndCreateSagaTransactions creates GenericAgents
 * 6. Agents execute with cheap models (gpt-4o-mini) via SagaCoordinator
 *
 * Benefits:
 * - Works with existing infrastructure
 * - Uses proven agent parsing
 * - Expensive model only for structure generation
 * - Cheap models for execution
 */

import {
    query,
    type AgentDefinition,
    type Options,
    type SDKMessage
} from '@anthropic-ai/claude-agent-sdk';

/**
 * Agent Structure Generator using Tag Format
 */
export class AgentStructureGenerator {
    private options: Options;

    constructor() {
        this.options = {
            permissionMode: 'bypassPermissions',
            maxTurns: 10,
            cwd: process.cwd(),
            model: 'sonnet' // Expensive model for planning
        };
    }

    /**
     * Generate agent structures in [AGENT...] tag format
     */
    async generateAgentStructures(userRequest: string): Promise<string> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║      Agent Structure Generator - Tag Format                    ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        const prompt = this.buildPrompt(userRequest);

        const q = query({
            prompt,
            options: this.options,
        });

        let generatedText = '';
        let turnCount = 0;

        for await (const message of q) {
            turnCount++;

            if (message.type === 'result' && message.subtype === 'success') {
                console.log('\n[RESULT] Agent structures generated\n');
                generatedText = message.result;
            } else if (message.type === 'assistant') {
                console.log(`[TURN ${turnCount}] Generating agent structures...`);
            }
        }

        if (!generatedText) {
            throw new Error('Failed to generate agent structures');
        }

        return generatedText;
    }

    /**
     * Build prompt for structure generation in tag format
     */
    private buildPrompt(userRequest: string): string {
        return `You are an expert at designing agent-based workflows using the SAGA pattern.

Your job is to analyze a user request and generate agent definitions in a specific tag format that will be parsed by the system.

═══════════════════════════════════════════════════════════════════════════
USER REQUEST:
═══════════════════════════════════════════════════════════════════════════

${userRequest}

═══════════════════════════════════════════════════════════════════════════
YOUR TASK: Generate Agent Definitions in Tag Format
═══════════════════════════════════════════════════════════════════════════

You MUST output agent definitions using this EXACT format:

[AGENT: AgentName, UNIQUE-ID]
Detailed instructions for this agent including:
- What the agent should do
- Input data/files
- Processing steps
- Expected output format
- Tool usage (if applicable)
[/AGENT]

═══════════════════════════════════════════════════════════════════════════
FORMAT RULES:
═══════════════════════════════════════════════════════════════════════════

1. **Opening Tag**: [AGENT: AgentName, UNIQUE-ID]
   - AgentName: Descriptive name (e.g., DataNormalizationAgent, HourlyAggregationAgent)
   - UNIQUE-ID: Short unique identifier (e.g., NORM-01, AGG-02)

2. **Instructions**: Between tags, write COMPLETE, DETAILED instructions:
   - Clear task description
   - Input files/data with ABSOLUTE paths
   - Step-by-step processing instructions
   - Output files/data with ABSOLUTE paths
   - For tool agents: Include complete Python code examples
   - Error handling instructions

3. **Closing Tag**: [/AGENT]


`;
    }

    /**
     * Display generated structures
     */
    displayGeneratedStructures(generatedText: string): void {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║              Generated Agent Structures                        ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        // Extract agent names
        const agentMatches = generatedText.match(/\[AGENT:\s*([^,]+),\s*([^\]]+)\]/g);
        if (agentMatches) {
            console.log('Agents Generated:');
            agentMatches.forEach((match, idx) => {
                const parts = match.match(/\[AGENT:\s*([^,]+),\s*([^\]]+)\]/);
                if (parts) {
                    console.log(`  ${idx + 1}. ${parts[1]} (ID: ${parts[2]})`);
                }
            });
        }

        // Extract flow
        const flowMatch = generatedText.match(/<flow>(.+?)<\/flow>/);
        if (flowMatch) {
            console.log(`\nExecution Flow:`);
            console.log(`  ${flowMatch[1]}`);
        }

        // Extract tool users
        const toolUsersMatch = generatedText.match(/\{"toolUsers":\s*(\[[^\]]+\])\}/);
        if (toolUsersMatch) {
            console.log(`\nTool Users:`);
            console.log(`  ${toolUsersMatch[1]}`);
        }

        console.log(`\nOutput Length: ${generatedText.length} characters\n`);
    }
}

/**
 * Main execution
 */
export async function main() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY not set');
        process.exit(1);
    }

    // Example user request
    const userRequest = `
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

        console.log('Generating agent structures in tag format...\n');
        const generatedText = await generator.generateAgentStructures(userRequest);

        generator.displayGeneratedStructures(generatedText);

        // Save to file
        const fs = await import('fs');
        const outputPath = './generated_workflows/agent_structures.txt';
        fs.writeFileSync(outputPath, generatedText, 'utf-8');

        console.log('═'.repeat(70));
        console.log('✅ Agent structures generated successfully!');
        console.log('═'.repeat(70));
        console.log(`\nSaved to: ${outputPath}`);
        console.log('\nNext steps:');
        console.log('  1. Review the generated agent structures');
        console.log('  2. Send to SagaWorkflow via socket with type: "create_code"');
        console.log('  3. DefineGenericAgentsProcess will parse and create GenericAgents');
        console.log('  4. Agents execute with cheap models (gpt-4o-mini)');
        console.log('\nCost: Planning ($0.30) + Execution (~$0.05) = Total ~$0.35\n');

    } catch (error) {
        console.error('\n✗ Error:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(console.error);
}
