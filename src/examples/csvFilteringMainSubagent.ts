/**
 * Main Agent and Subagent for CSV Filtering Task
 *
 * Architecture:
 * - Main Agent: Coordinates the CSV filtering workflow
 * - Code Generation Subagent: Generates Python code to process CSV
 * - Uses execution-server (codeGen MCP server) as the tool
 *
 * User Request → Main Agent → Delegates to Code-Gen Subagent → Subagent uses MCP Tool → Returns Python code
 */

import {
    query,
    type AgentDefinition,
    type Options,
    type SDKMessage
} from '@anthropic-ai/claude-agent-sdk';

/**
 * Define the Code Generation Subagent
 * Specializes in generating Python code for data processing
 */
const codeGenerationSubagent: AgentDefinition = {
    description: `Python code generation specialist for data processing tasks.
Use PROACTIVELY when the user needs:
- Python code generation
- CSV file processing
- Data filtering and transformation
- Code for reading and manipulating files`,

    // This subagent has access to the execution-server MCP tools
    tools: undefined, // Allow all tools including MCP server tools

    model: 'sonnet',

    prompt: `You are a Python code generation specialist focused on data processing.

Your primary responsibility is to generate clean, efficient Python code for data processing tasks.

CRITICAL REQUIREMENTS FOR CODE OUTPUT:
- Output ONLY Python code
- First character must be Python code (import, def, or variable)
- Last character must be Python code
- Zero explanatory text before or after the code
- Zero markdown formatting (no \`\`\`python or \`\`\`)
- Zero comments explaining what you're doing
- The code must be complete and immediately executable

When you receive a data processing request:
1. Understand the data structure and requirements
2. Generate Python code that solves the problem
3. Use appropriate libraries (pandas, csv, etc.)
4. Handle edge cases and errors in the code
5. Output ONLY the Python code with no additional text

Code quality standards:
- Clean, readable code
- Efficient algorithms
- Proper error handling within the code
- Follow Python best practices
- Use type hints where appropriate

Remember: Your output will be executed directly. No text, no markdown, just pure Python code.`
};

/**
 * Main Agent Configuration
 */
const AGENTS: Record<string, AgentDefinition> = {
    'code-generator': codeGenerationSubagent
};

/**
 * Main Agent Class
 * Coordinates the CSV filtering workflow
 */
export class CSVFilteringMainAgent {
    private options: Options;

    constructor() {
        // Configure to use your existing execution-server (codeGen MCP server)
        this.options = {
            agents: AGENTS,
            permissionMode: 'acceptEdits',
            maxTurns: 15,
            cwd: process.cwd(),

            // Use your existing MCP server configuration
            mcpServers: {
                'execution': {
                    type: 'stdio',
                    command: 'node',
                    args: ['C:/repos/codeGen-mcp-server/dist/server.js', '--stdio'],
                }
            },
        };
    }

    /**
     * Execute the CSV filtering task
     */
    async executeCSVFilteringTask(): Promise<void> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║       CSV Energy Data Filtering - Main Agent Task             ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        const mainAgentPrompt = this.buildMainAgentPrompt();

        const q = query({
            prompt: mainAgentPrompt,
            options: this.options,
        });

        let turnCount = 0;

        for await (const message of q) {
            this.handleMessage(message, ++turnCount);
        }
    }

    /**
     * Build the comprehensive prompt for the main agent
     */
    private buildMainAgentPrompt(): string {
        return `You are the Main Coordinator Agent managing a CSV data processing workflow.

Available Subagent:
- code-generator: Python code generation specialist for data processing

═══════════════════════════════════════════════════════════════════════════
TASK: Generate Python code to process energy data CSV file
═══════════════════════════════════════════════════════════════════════════

CSV FILE STRUCTURE:
The file has an unusual multi-row header structure:
- Row 1: Energy source categories (Solar, Wind, Natural Gas, Hydro, Diesel, Battery, Coal) with commas spanning multiple columns
- Row 2: Installation names (BARCSF1, GRIFSF1, CAPTL_WF, etc.)
- Row 3+: Timestamp and MW values for each installation

Example first 3 rows:
,,,Solar,,,,,,,,Wind,,,,,Natural Gas,,,Hydro,,,,,Diseal,,Battry,Coal,
date/time,BARCSF1,GRIFSF1,HUGSF1,LRSF1,MLSP1,ROTALLA1,CAPTL_WF,CHALLHWF,CULLRGWF,DIAPURWF1,MLWF1,WAUBRAWF,WOOLNTH1,YAMBUKWF,YSWF1,SHOAL1,BUTLERSG,CLOVER,CLUNY,PALOONA,REPULSE,ROWALLAN,RUBICON,ERGT01,GBO1,KEPBG1,ERGTO1,RPCG
11/02/2023 4:00,0.1,0.001526,-0.176,0.005,0.037,0,6.685649,26.2,11.83,,1.335,0,55.12,2,1.8,22,9.399999,0,9.957885,0,15.1632,0,0,0,0,0,0,16.3

CATEGORY TO INSTALLATION MAPPING:
Solar: BARCSF1, GRIFSF1, HUGSF1, LRSF1, MLSP1, ROTALLA1
Wind: CAPTL_WF, CHALLHWF, CULLRGWF, DIAPURWF1, MLWF1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1
Natural Gas: SHOAL1
Hydro: BUTLERSG, CLOVER, CLUNY, PALOONA, REPULSE, ROWALLAN, RUBICON
Diesel: ERGT01, GBO1
Battery: KEPBG1
Coal: ERGTO1, RPCG

INPUT FILE LOCATION:
C:/repos/SAGAMiddleware/data/two_days.csv

REQUIRED OUTPUT FORMAT:
Transform the wide-format data into long-format with these columns:
- date/time: timestamp from the original data
- installation: installation name (e.g., BARCSF1, CAPTL_WF)
- energy_source: energy type (Solar, Wind, Natural Gas, Hydro, Diesel, Battery, Coal)
- MW: power output value

Example output rows:
date/time,installation,energy_source,MW
11/02/2023 4:00,BARCSF1,Solar,0.1
11/02/2023 4:00,GRIFSF1,Solar,0.001526
11/02/2023 4:00,CAPTL_WF,Wind,6.685649

CODE REQUIREMENTS:
1. Read the CSV file, handling the multi-row header properly
2. Use the category mapping to assign energy sources to installations
3. Transform from wide format to long format
4. Output a new CSV with the required columns
5. Handle missing/empty values appropriately
6. Save output to: C:/repos/SAGAMiddleware/data/filtered_energy_data.csv

ABSOLUTE REQUIREMENTS FOR THE CODE-GENERATOR SUBAGENT:
⚠️ CRITICAL: The subagent MUST output ONLY Python code
⚠️ First character must be Python code (import, def, or variable)
⚠️ Last character must be Python code
⚠️ Zero explanatory text
⚠️ Zero markdown (no \`\`\`python or \`\`\`)
⚠️ The code will be executed directly

═══════════════════════════════════════════════════════════════════════════
YOUR COORDINATION STEPS:
═══════════════════════════════════════════════════════════════════════════

1. Delegate to the 'code-generator' subagent using the Task tool
2. Provide the subagent with ALL the information above:
   - CSV structure details
   - Category mapping
   - File paths
   - Output format requirements
   - Critical code output requirements
3. Emphasize the ABSOLUTE REQUIREMENTS multiple times
4. When you receive the generated code, verify it:
   - Starts with Python code (no markdown)
   - Ends with Python code
   - Has no explanatory text
5. Return the clean Python code to the user

Begin delegation now.`;
    }

    /**
     * Handle messages from the query stream
     */
    private handleMessage(message: SDKMessage, turn: number): void {
        switch (message.type) {
            case 'system':
                if (message.subtype === 'init') {
                    console.log('═══════════════════════════════════════════════════');
                    console.log('[SYSTEM] Session Initialized');
                    console.log('  Model:', message.model);
                    console.log('  Permission Mode:', message.permissionMode);
                    console.log('  Available Agents:', message.agents?.join(', ') || 'none');
                    console.log('  MCP Servers:', message.mcp_servers.map(s => `${s.name} (${s.status})`).join(', '));
                    console.log('  Tools:', message.tools.join(', '));
                    console.log('═══════════════════════════════════════════════════\n');
                }
                break;

            case 'assistant':
                console.log(`\n${'─'.repeat(60)}`);
                console.log(`Turn ${turn}: MAIN AGENT`);
                console.log('─'.repeat(60));

                for (const content of message.message.content) {
                    if (content.type === 'text') {
                        console.log('[MAIN AGENT TEXT]:', content.text.substring(0, 500));
                        if (content.text.length > 500) {
                            console.log('[...truncated for display...]');
                        }
                    } else if (content.type === 'tool_use') {
                        console.log(`\n[TOOL CALL] ${content.name}`);

                        if (content.name === 'Task') {
                            const input = content.input as any;
                            console.log(`\n[DELEGATION EVENT]`);
                            console.log(`  → Delegating to subagent: ${input.subagent_type}`);
                            console.log(`  → Task description: ${input.description}`);
                            console.log(`\n[SUBAGENT PROMPT] (first 300 chars):`);
                            console.log(input.prompt.substring(0, 300) + '...');
                        } else {
                            console.log('[INPUT]:', JSON.stringify(content.input, null, 2).substring(0, 300));
                        }
                    }
                }
                break;

            case 'user':
                if (!message.isSynthetic) {
                    console.log('\n[USER MESSAGE]');
                    const content = JSON.stringify(message.message, null, 2);
                    console.log(content.substring(0, 500));
                    if (content.length > 500) {
                        console.log('[...truncated for display...]');
                    }
                }
                break;

            case 'result':
                console.log('\n');
                console.log('╔═══════════════════════════════════════════════════════════════╗');
                console.log('║                      FINAL RESULT                              ║');
                console.log('╚═══════════════════════════════════════════════════════════════╝');
                console.log('[STATUS]:', message.subtype);
                console.log('[DURATION]:', message.duration_ms, 'ms');
                console.log('[TURNS]:', message.num_turns);
                console.log('[COST]:', '$' + message.total_cost_usd.toFixed(4));

                if (message.subtype === 'success') {
                    console.log('\n[GENERATED CODE]:');
                    console.log('─'.repeat(60));
                    console.log(message.result);
                    console.log('─'.repeat(60));
                }

                console.log('\n[MODEL USAGE]:');
                for (const [model, usage] of Object.entries(message.modelUsage)) {
                    console.log(`  ${model}:`);
                    console.log(`    Input: ${usage.inputTokens} tokens`);
                    console.log(`    Output: ${usage.outputTokens} tokens`);
                    console.log(`    Cache read: ${usage.cacheReadInputTokens} tokens`);
                    console.log(`    Cost: $${usage.costUSD.toFixed(4)}`);
                }

                if (message.permission_denials.length > 0) {
                    console.log('\n[PERMISSION DENIALS]:', message.permission_denials.length);
                    message.permission_denials.forEach((denial, idx) => {
                        console.log(`  ${idx + 1}. Tool: ${denial.tool_name}`);
                    });
                }
                break;

            case 'stream_event':
                // Handle streaming if enabled
                break;
        }
    }
}

/**
 * Main execution function
 */
export async function main() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  CSV Energy Data Filtering: Main-Subagent Architecture Demo      ║');
    console.log('║  Main Agent → Code-Gen Subagent → Python Code Generation         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY environment variable is not set');
        console.error('Please set it before running this example:\n');
        console.error('  Windows: set ANTHROPIC_API_KEY=your-api-key-here');
        console.error('  Linux/Mac: export ANTHROPIC_API_KEY=your-api-key-here\n');
        process.exit(1);
    }

    try {
        const mainAgent = new CSVFilteringMainAgent();
        await mainAgent.executeCSVFilteringTask();

        console.log('\n\n✓ Task completed successfully!\n');
        console.log('The generated Python code can be saved and executed to process the CSV file.\n');
    } catch (error) {
        console.error('\n\n✗ Error running task:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
