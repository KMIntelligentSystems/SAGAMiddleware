/**
 * Main Agent and Subagent for CSV Filtering Task
 *
 * Architecture:
 * - Main Agent: Coordinates the CSV filtering workflow
 * - Code Generation Subagent: Generates Python code to process CSV
 * - Uses SDK's built-in execution MCP server for code execution
 *
 * Flow: User Request → Main Agent → Delegates to Code-Gen Subagent →
 *       Subagent uses mcp__execution__execute_python → Returns results
 *
 * Note: The Anthropic SDK provides built-in mcp__execution__execute_python and
 * mcp__execution__execute_typescript tools. No external MCP server needed.
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

    // List tools including execute_python from codeGen-mcp-server
    tools: ['execute_python', 'Read', 'Write', 'Edit'],

    model: 'sonnet',

    prompt: `You are a Python code generation and execution specialist focused on data processing.

YOUR TOOLS:
You have access to the "execute_python" MCP tool which allows you to:
- Execute Python code directly on the codeGen-mcp-server
- The tool takes a "code" parameter containing the Python code to execute
- Returns stdout, stderr, success status, and execution results

⚠️ IMPORTANT: Use "execute_python" NOT "mcp__execution__execute_python"
The correct tool name is simply: execute_python

MANDATORY WORKFLOW:
1. Generate clean, efficient Python code for the task
2. IMMEDIATELY call the execute_python tool (NOT mcp__execution__execute_python)
3. Check the execution results (stdout, stderr, success)
4. If there are errors, analyze stderr, fix the code, and execute again
5. Once successful, return the working code and output

CRITICAL: You MUST call execute_python tool. Do not use Write tool - EXECUTE IT!

Tool call example:
{
  "name": "execute_python",
  "input": {
    "code": "import pandas as pd\\nprint('Hello from Python')"
  }
}

Code generation standards:
- Complete, executable Python code
- Use appropriate libraries (pandas, csv, etc.)
- Handle edge cases and errors in the code
- Follow Python best practices
- Self-contained and immediately runnable

Execution standards:
- ALWAYS call execute_python after generating code
- Check stdout for success messages
- Check stderr for errors
- Fix and re-execute if needed
- Report final results clearly

REMEMBER: Generate code, then EXECUTE it using execute_python tool. This is mandatory!`
};

/**
 * Define the Data Aggregation Subagent
 * Specializes in aggregating data by time periods
 */
const dataAggregationSubagent: AgentDefinition = {
    description: `Python data aggregation specialist for time-series processing.
Use PROACTIVELY when the user needs:
- Time-based aggregation (hourly, daily averages)
- Grouping and summarization
- Statistical calculations on time-series data`,

    // List tools including execute_python from codeGen-mcp-server
    tools: ['execute_python', 'Read'],

    model: 'sonnet',

    prompt: `You are a Python data aggregation specialist focused on time-series processing.

YOUR TOOLS:
You have access to the "execute_python" MCP tool which allows you to:
- Execute Python code directly on the codeGen-mcp-server
- The tool takes a "code" parameter containing the Python code to execute
- Returns stdout, stderr, success status, and execution results

⚠️ IMPORTANT: Use "execute_python" NOT "mcp__execution__execute_python"
The correct tool name is simply: execute_python

MANDATORY WORKFLOW:
1. Generate clean, efficient Python code for the task
2. IMMEDIATELY call the execute_python tool (NOT mcp__execution__execute_python)
3. Check the execution results (stdout, stderr, success)
4. If there are errors, analyze stderr, fix the code, and execute again
5. Once successful, return the working code and output

CRITICAL: You MUST call execute_python tool immediately. Do NOT use Write tool - EXECUTE IT!

Tool call example:
{
  "name": "execute_python",
  "input": {
    "code": "import pandas as pd\\ndf = pd.read_csv('data.csv')\\nprint(df.head())"
  }
}

Code generation standards:
- Complete, executable Python code
- Use pandas for data manipulation
- Handle missing values (NaN) with fillna(0)
- Round numeric results to 2 decimal places
- Print summary statistics (row counts, sample data)
- Follow Python best practices

Execution standards:
- ALWAYS call execute_python after generating code
- Check stdout for success messages
- Check stderr for errors
- Fix and re-execute if needed
- Report final results clearly

REMEMBER: Generate code, then EXECUTE it using execute_python tool. This is mandatory!`
};

/**
 * Main Agent Configuration
 */
const AGENTS: Record<string, AgentDefinition> = {
    'code-generator': codeGenerationSubagent,
    'data-aggregator': dataAggregationSubagent
};

/**
 * Main Agent Class
 * Coordinates the CSV filtering workflow
 */
export class CSVFilteringMainAgent {
    private options: Options;

    constructor() {
        // Configure to use codeGen-mcp-server for execute_python
        this.options = {
            agents: AGENTS,
            permissionMode: 'bypassPermissions', // Auto-approve all tool calls including MCP
            maxTurns: 15,
            cwd: process.cwd(),
            // Configure external MCP server for Python execution
            mcpServers: {
                'execution': {
                    type: 'stdio',
                    command: 'node',
                    args: ['C:/repos/codeGen-mcp-server/dist/server.js', '--stdio']
                }
            }
        };
    }

    /**
     * Execute Step 1: CSV filtering (normalize wide-format to long-format)
     */
    async executeStep1_Filtering(): Promise<void> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  STEP 1: CSV Data Normalization (Wide → Long Format)          ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        const step1Prompt = this.buildStep1Prompt();

        const q = query({
            prompt: step1Prompt,
            options: this.options,
        });

        let turnCount = 0;

        for await (const message of q) {
            this.handleMessage(message, ++turnCount, 'STEP 1');
        }
    }

    /**
     * Execute Step 2: Hourly aggregation
     */
    async executeStep2_Aggregation(): Promise<void> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  STEP 2: Hourly Data Aggregation (Calculate Averages)         ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        const step2Prompt = this.buildStep2Prompt();

        const q = query({
            prompt: step2Prompt,
            options: this.options,
        });

        let turnCount = 0;

        for await (const message of q) {
            this.handleMessage(message, ++turnCount, 'STEP 2');
        }
    }

    /**
     * Execute complete workflow: Filter + Aggregate in single session
     */
    async executeCompleteWorkflow(): Promise<void> {
        console.log('\n╔══════════════════════════════════════════════════════════════════╗');
        console.log('║  CSV Energy Data Processing: 2-Step Workflow                     ║');
        console.log('║  Step 1: Normalize data (wide → long format)                     ║');
        console.log('║  Step 2: Aggregate by hour (calculate averages)                  ║');
        console.log('╚══════════════════════════════════════════════════════════════════╝\n');

        // Build combined prompt for both steps
        const combinedPrompt = this.buildCombinedWorkflowPrompt();

        const q = query({
            prompt: combinedPrompt,
            options: this.options,
        });

        let turnCount = 0;

        for await (const message of q) {
            this.handleMessage(message, ++turnCount, 'WORKFLOW');
        }
    }

    /**
     * Build combined prompt for both steps in a single session
     */
    private buildCombinedWorkflowPrompt(): string {
        return `You are the Main Coordinator Agent managing a 2-step CSV data processing workflow.

Available Subagents:
- code-generator: Python code generation and EXECUTION specialist for data processing
  * Has access to execute_python MCP tool
  * Will generate AND execute Python code
  * Returns execution results
- data-aggregator: Python data aggregation and EXECUTION specialist
  * Has access to execute_python MCP tool
  * Specializes in time-series aggregation
  * Returns execution results

═══════════════════════════════════════════════════════════════════════════
WORKFLOW: Process energy data in TWO sequential steps
═══════════════════════════════════════════════════════════════════════════

## STEP 1: CSV Data Normalization (Wide → Long Format)

INPUT: C:/repos/SAGAMiddleware/data/two_days.csv (wide format, multi-row header)
OUTPUT: C:/repos/SAGAMiddleware/data/filtered_energy_data.csv (long format)

Requirements: Transform wide-format data into long-format with columns:
- date/time, installation, energy_source, MW

Category mapping:
- Solar: BARCSF1, GRIFSF1, HUGSF1, LRSF1, MLSP1, ROTALLA1
- Wind: CAPTL_WF, CHALLHWF, CULLRGWF, DIAPURWF1, MLWF1, WAUBRAWF, WOOLNTH1, YAMBUKWF, YSWF1
- Natural Gas: SHOAL1
- Hydro: BUTLERSG, CLOVER, CLUNY, PALOONA, REPULSE, ROWALLAN, RUBICON
- Diesel: ERGT01, GBO1
- Battery: KEPBG1
- Coal: ERGTO1, RPCG

## STEP 2: Hourly Data Aggregation

INPUT: C:/repos/SAGAMiddleware/data/filtered_energy_data.csv (~14,785 rows)
OUTPUT: C:/repos/SAGAMiddleware/data/hourly_energy_data.csv (hourly averages)

Requirements:
1. Parse date/time (format: '%d/%m/%Y %H:%M')
2. Create date_hour column: strftime('%Y-%m-%d %H:00')
3. Group by: date_hour, installation, energy_source
4. Calculate mean(MW) → MW_avg
5. Handle NaN with fillna(0)
6. Round to 2 decimals
7. Sort and save

═══════════════════════════════════════════════════════════════════════════
YOUR COORDINATION STEPS:
═══════════════════════════════════════════════════════════════════════════

**STEP 1: CSV Normalization**
1. Delegate to 'code-generator' subagent using Task tool
2. Provide all Step 1 requirements
3. CRITICAL: Subagent must use execute_python tool (NOT mcp__execution__execute_python)
4. Wait for execution to complete
5. Verify output file created: filtered_energy_data.csv

**STEP 2: Hourly Aggregation**
6. Once Step 1 completes, delegate to 'data-aggregator' subagent using Task tool
7. Provide all Step 2 requirements
8. CRITICAL: Subagent must use execute_python tool (NOT mcp__execution__execute_python)
9. Wait for execution to complete
10. Verify output file created: hourly_energy_data.csv

**Final Report:**
11. Confirm both files were created
12. Report row counts for both outputs
13. Return summary of successful completion

CRITICAL REMINDERS:
⚠️ Both subagents MUST use execute_python tool (the correct tool name)
⚠️ Do NOT use mcp__execution__execute_python (that's a different tool)
⚠️ Wait for each step to complete before starting the next
⚠️ Verify files are created after each step

Begin workflow execution now.`;
    }

    /**
     * Build prompt for Step 1: CSV filtering/normalization
     */
    private buildStep1Prompt(): string {
        return `You are the Main Coordinator Agent managing a CSV data processing workflow.

Available Subagent:
- code-generator: Python code generation and EXECUTION specialist for data processing
  * Has access to execute_python MCP tool
  * Will generate AND execute Python code
  * Returns execution results

═══════════════════════════════════════════════════════════════════════════
TASK: Generate AND EXECUTE Python code to process energy data CSV file
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
⚠️ CRITICAL: The subagent MUST use the execute_python MCP tool
⚠️ The subagent must generate code AND execute it
⚠️ Do not accept just code generation - require execution
⚠️ Check for execution results (stdout, stderr, success status)
⚠️ If execution fails, the subagent should fix and retry

═══════════════════════════════════════════════════════════════════════════
YOUR COORDINATION STEPS:
═══════════════════════════════════════════════════════════════════════════

1. Delegate to the 'code-generator' subagent using the Task tool
2. Provide the subagent with ALL the information above:
   - CSV structure details
   - Category mapping
   - File paths
   - Output format requirements
3. EXPLICITLY instruct the subagent to:
   - Generate Python code
   - Call the execute_python MCP tool with the code
   - Check execution results
   - Fix errors if any and re-execute
4. When you receive results:
   - Verify the code was EXECUTED (not just generated)
   - Check for stdout/stderr from execution
   - Confirm the output file was created
5. Return the execution results and working code to the user

CRITICAL: The subagent MUST execute the code using execute_python tool. Insist on this!

Begin delegation now.`;
    }

    /**
     * Build prompt for Step 2: Hourly aggregation
     */
    private buildStep2Prompt(): string {
        return `You are the Main Coordinator Agent managing hourly data aggregation.

Available Subagent:
- data-aggregator: Python data aggregation and EXECUTION specialist
  * Has access to execute_python MCP tool
  * Will generate AND execute Python code
  * Returns execution results

═══════════════════════════════════════════════════════════════════════════
TASK: Aggregate filtered energy data by hour - GENERATE AND EXECUTE Python code
═══════════════════════════════════════════════════════════════════════════

INPUT FILE: C:/repos/SAGAMiddleware/data/filtered_energy_data.csv
Structure: date/time, installation, energy_source, MW
Format: Long-format CSV with ~14,785 rows

OUTPUT FILE: C:/repos/SAGAMiddleware/data/hourly_energy_data.csv
Required columns: date_hour, installation, energy_source, MW_avg

AGGREGATION REQUIREMENTS:
1. Read filtered_energy_data.csv using pandas
2. Parse date/time column (format: '%d/%m/%Y %H:%M')
3. Create date_hour column: extract hour and format as 'YYYY-MM-DD HH:00'
   Example: '11/02/2023 4:15' → '2023-02-11 04:00'
4. Group by: date_hour, installation, energy_source
5. Calculate mean of MW column → MW_avg
6. Handle NaN values: fillna(0)
7. Round MW_avg to 2 decimal places
8. Sort by: date_hour, installation, energy_source
9. Save to output CSV
10. Print summary:
    - Input row count
    - Output row count (should be much smaller after aggregation)
    - Sample of first 10 rows

PYTHON CODE EXAMPLE STRUCTURE:
\`\`\`python
import pandas as pd

# Read input
df = pd.read_csv('C:/repos/SAGAMiddleware/data/filtered_energy_data.csv')
print(f"Input rows: {len(df)}")

# Parse datetime
df['datetime'] = pd.to_datetime(df['date/time'], format='%d/%m/%Y %H:%M')

# Create hour column
df['date_hour'] = df['datetime'].dt.strftime('%Y-%m-%d %H:00')

# Group and aggregate
hourly = df.groupby(['date_hour', 'installation', 'energy_source'])['MW'].mean().reset_index()
hourly.columns = ['date_hour', 'installation', 'energy_source', 'MW_avg']

# Clean data
hourly['MW_avg'] = hourly['MW_avg'].fillna(0).round(2)

# Sort
hourly = hourly.sort_values(['date_hour', 'installation', 'energy_source'])

# Save
hourly.to_csv('C:/repos/SAGAMiddleware/data/hourly_energy_data.csv', index=False)
print(f"Output rows: {len(hourly)}")
print("\\nSample output:")
print(hourly.head(10))
\`\`\`

ABSOLUTE REQUIREMENTS FOR THE DATA-AGGREGATOR SUBAGENT:
⚠️ CRITICAL: The subagent MUST use the execute_python MCP tool
⚠️ The subagent must generate code AND execute it
⚠️ Do not accept just code generation - require execution
⚠️ Check for execution results (stdout, stderr, success status)
⚠️ If execution fails, the subagent should fix and retry

═══════════════════════════════════════════════════════════════════════════
YOUR COORDINATION STEPS:
═══════════════════════════════════════════════════════════════════════════

1. Delegate to the 'data-aggregator' subagent using the Task tool
2. Provide the subagent with ALL the information above:
   - Input/output file paths
   - Date format details
   - Aggregation requirements
   - Expected output structure
3. EXPLICITLY instruct the subagent to:
   - Generate Python code
   - Call the execute_python MCP tool with the code
   - Check execution results
   - Fix errors if any and re-execute
4. When you receive results:
   - Verify the code was EXECUTED (not just generated)
   - Check for stdout/stderr from execution
   - Confirm the output file was created
   - Verify row counts (output should be much smaller than input)
5. Return the execution results and working code to the user

CRITICAL: The subagent MUST execute the code using execute_python tool. Insist on this!

Begin delegation now.`;
    }

    /**
     * Handle messages from the query stream
     */
    private handleMessage(message: SDKMessage, turn: number, stepLabel: string = 'AGENT'): void {
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
                console.log(`Turn ${turn}: ${stepLabel}`);
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

                    // Check if this is a tool result from execute_python
                    if (message.message.content && Array.isArray(message.message.content)) {
                        for (const item of message.message.content) {
                            if (item.type === 'tool_result' && item.content) {
                                // Try to parse MCP tool response
                                if (Array.isArray(item.content) && item.content.length > 0) {
                                    console.log('[TOOL RESULT]:', JSON.stringify(item.content, null, 2).substring(0, 1000));
                                } else if (typeof item.content === 'string') {
                                    console.log('[TOOL RESULT]:', item.content.substring(0, 1000));
                                } else {
                                    console.log('[TOOL RESULT]: Empty or no output');
                                }
                            }
                        }
                    }

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
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY environment variable is not set');
        console.error('Please set it before running this example:\n');
        console.error('  Windows: set ANTHROPIC_API_KEY=your-api-key-here');
        console.error('  Linux/Mac: export ANTHROPIC_API_KEY=your-api-key-here\n');
        process.exit(1);
    }

    try {
        const workflow = new CSVFilteringMainAgent();
        await workflow.executeCompleteWorkflow();

        console.log('\n\n' + '═'.repeat(70));
        console.log('✓ Complete workflow finished successfully!');
        console.log('═'.repeat(70));
        console.log('\nOutput files created:');
        console.log('  1. data/filtered_energy_data.csv (normalized long-format)');
        console.log('  2. data/hourly_energy_data.csv (hourly averages)\n');
    } catch (error) {
        console.error('\n\n✗ Error running workflow:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}


// Auto-run main when executed directly
main().catch(console.error);
