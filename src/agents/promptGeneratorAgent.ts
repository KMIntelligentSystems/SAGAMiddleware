/**
 * PromptGeneratorAgent
 *
 * SDK agent that pre-processes the DAG and workflow requirements to generate
 * specific prompts for each agent before execution begins.
 *
 * This agent:
 * 1. Receives DAGDefinition and workflowRequirements as constructor parameters
 * 2. Identifies which agents need prompts (all 'agent' and 'sdk_agent' node types)
 * 3. Uses an LLM to generate contextually appropriate prompts for each agent
 * 4. The LLM calls a LOCAL TOOL to store each agent-name-to-prompt mapping
 * 5. Returns the complete mapping
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { DAGDefinition } from '../types/dag.js';
import { AgentResult } from '../types/index.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { createPrompt } from '../types/visualizationSaga.js';
import {  prompGeneratorAgent_DataProfiler, prompGeneratorAgent_D3JSCodingAgent, prompGeneratorAgent_D3JSCodeValidator, prompGeneratorAgent_DataAnalyzer_Simple,
     prompGeneratorAgent_D3JSCodingAgent_simple, promptGenerztorAgent_D3JSValidating_simple,  prompGeneratorAgent_DataAnalyzer_Simple_endo,
      promptGeneratorAgent_Report_Writer_endo } from '../test/histogramData.js'
import * as fs from 'fs';
import * as path from 'path';

export interface AgentPromptMapping {
       
          [agentId: string]: {
        agentName: string;
        prompt: string;
    };

}

export type AgentPromptArray = Array<{agentName: string, id: string, prompt: string}>; // Array of prompt objects

export class PromptGeneratorAgent extends BaseSDKAgent {
    private promptMapping: AgentPromptMapping = {};
    private dag: DAGDefinition;
    private workflowRequirements: any;
    private workflowPlan: string | null = null;

    constructor(dag: DAGDefinition, workflowRequirements: any, contextManager?: any, csvAnalysis?: string) {
        super('PromptGeneratorAgent', 25, contextManager);

        this.dag = dag;
        this.workflowRequirements = workflowRequirements;
        this.workflowPlan = csvAnalysis || null;

        // No tools needed - CSV analysis provided by separate agent
        this.setupTools();

        // Setup the local tool for storing agent-prompt mappings
        try {
            this.setupPromptStoreTool();
        } catch (error) {
            console.error('⚠️  Warning: Failed to setup Prompt Generator tools:', error);
            console.log('   Prompt Generator will run without custom tools');
        }
    }

    /**
     * Setup tools - no tools needed (CSV analysis provided by separate CSVAnalyzerAgent)
     */
    private setupTools(): void {
        // No tools needed - CSV analysis is pre-computed and passed in constructor
        console.log('✅ PromptGeneratorAgent configured (CSV analysis mode)');
    }

    /**
     * Setup local tool for storing agent-to-prompt mappings
     */
    private setupPromptStoreTool(): void {
        // Tool: Store agent-to-prompt mapping
        const storePromptTool = tool(
            'store_agent_prompt',
            'Store a mapping of agent name to its generated prompt. Call this tool for each agent that needs a prompt.',
            {
                agent_name: z.string().describe('The name of the agent'),
                agent_id: z.string().describe('The unique id of the agent'),
                prompt: z.string().describe('The generated prompt for this agent')
            },
            async (args) => {
                return this.handleStorePrompt(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'prompt-store',
            tools: [storePromptTool]
        });

        // Add MCP server to options
        this.options.mcpServers = {
            ...this.options.mcpServers,
            'prompt-store': mcpServer
        } as any;

        console.log('✅ Prompt Generator tool setup complete');
    }

    /**
     * Handler for store_agent_prompt tool
     * Called when LLM invokes the tool
     */
    private async handleStorePrompt(args: any) {
        try {
            console.log(`   💾 Storing prompt for ${args.agent_name} (ID: ${args.agent_id})`);

            // Use agentId as the key to prevent overwrites
            this.promptMapping[args.agent_id] = {
                agentName: args.agent_name,
                prompt: args.prompt
            };

            console.log(`   ✅ Stored prompt for ${args.agent_name} (${args.prompt.length} chars)`);

            return {
                content: [{
                    type: 'text' as const,
                    text: `Successfully stored prompt for "${args.agent_name}" with ID "${args.agent_id}"`
                }]
            };
        } catch (error) {
            console.error(`   ❌ Error storing prompt for ${args.agent_name}:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error storing prompt: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }


    /**
     * Execute prompt generation
     */
    async execute(_input?: any): Promise<AgentResult> {
        try {
            console.log('\n🎯 PromptGeneratorAgent: Starting prompt generation...');
            console.log(`   DAG: ${this.dag.name}`);

            // Clear previous mapping
           // this.promptMapping = {agentId: '',agentName: '', prompt: ''};

            const dataProfilerPrompt = this.contextManager.getContext('CSVAnalyzerAgent')

            // Build prompt with embedded requirements and DAG
            // The LLM will autonomously decide whether to invoke the data-analysis-advisor subagent
            const prompt = this.buildPrompt(dataProfilerPrompt);

            // Execute - the SDK agent will call tools (including Task tool for subagent invocation)
            console.log(`\n   📝 Generating prompts with LLM...`, prompt);
          /* await this.executeQuery(prompt);
            // Convert mapping to array format: {agentName, id, prompt}
            // Note: agentId is now the key, data contains agentName and prompt
            // Write promptArray to file
             console.log(`\n✅ PromptGeneratorAgent: Generated ${Object.keys(this.promptMapping).length} prompts`);
              const promptArray = Object.entries(this.promptMapping).map(
                ([agentId, data]) => ({agentName: data.agentName, id: agentId, prompt:data.prompt})
                );

            try {
               
                const filePath = 'c:/repos/sagaMiddleware/data/promptArray.txt';
                const fileContent = JSON.stringify(promptArray, null, 2);
                fs.writeFileSync(filePath, fileContent, 'utf-8');
                console.log(`📝 Prompt array written to ${filePath}`);
            } catch (writeError) {
                console.error('⚠️  Warning: Failed to write promptArray to file:', writeError);
            }*/

           //test
            const promptArray_ = PromptGeneratorAgent.loadPromptArrayFromFile();
            console.log('PROMPT', promptArray_)
          
            // Store the array in context
            this.setContext(promptArray_);

            return {
                agentName: 'PromptGeneratorAgent',
                success: true,
                result: promptArray_,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ Prompt Generator error:', error);
            return {
                agentName: 'PromptGeneratorAgent',
                result: {},
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Build prompt for the SDK agent
     * Embeds workflow requirements and DAG directly in the prompt
     */
    protected buildPrompt(_input: any): string {
        // Check if we have CSV data that needs analysis
        const hasCSVData = this.workflowRequirements.inputData?.source;
        const needsDataContext = this.workflowRequirements.agents?.some((agent: any) =>
            agent.name === 'DataProfiler' ||
            agent.name === 'WorkflowInterpreter' ||
            agent.agentType === 'python_coding'
        );

        // Include CSV analysis if provided
        let dataAnalysisSection = '';
        if (this.workflowPlan && hasCSVData && needsDataContext) {
            dataAnalysisSection = `

# CSV DATA ANALYSIS:
${this.workflowPlan}

Use this analysis when generating prompts for data-related agents (DataProfiler, WorkflowInterpreter, etc.).
Include specific statistics (row counts, ranges, distribution characteristics) in their prompts.
`;
        }

        return `You are a prompt generator that maps DAG nodes to workflow tasks.

# DAG DEFINITION (READ THIS FIRST - SOURCE OF TRUTH FOR AGENT NAMES):
${JSON.stringify(this.dag, null, 2)}

# WORKFLOW REQUIREMENTS (USE FOR PROMPT CONTENT ONLY):
${JSON.stringify(this.workflowRequirements, null, 2)}


# CRITICAL RULE - READ CAREFULLY:

**The tool call agent_name parameter MUST be the DAG node's \`agentName\` field.**

DO NOT use the workflow requirements agent name. The DAG node agentName is what the system will look up.

Examples:
- DAG node with agentName: "DataProfiler" → call store_agent_prompt(agent_name="DataProfiler", ...)
- DAG node with agentName: "D3JSCodingAgent" → call store_agent_prompt(agent_name="D3JSCodingAgent", ...)
- DAG node with agentName: "D3JSCodeValidator" → call store_agent_prompt(agent_name="D3JSCodeValidator", ...)

## STEP-BY-STEP PROCESS:

**STEP 1: LIST DAG NODES**
Go through the DAG nodes array. For each node where type is "agent" or "sdk_agent", extract:
- node.agentName ← THIS IS THE KEY
- outgoing edge flowType (for DataProfiler path detection)

**STEP 2: MATCH TO WORKFLOW TASK**
For each DAG node agentName, find the workflow agent whose task description matches.

**STEP 3: DETECT DATA ANALYSIS PATH** (for DataProfiler only):
   - Check the outgoing edge flowType from this node:
     - If flowType is \`"execute_agents"\` → Complex path (Python analysis needed)
     - If flowType is \`"sdk_agent"\` → Simple path (just read file, no Python)

4. **GENERATE THE PROMPT**:
   - **KEY** (agent_name parameter): Use the DAG node's \`agentName\` exactly as written
   - **CONTENT** (prompt parameter): Use this template:

${createPrompt}

   Replace placeholders with values from the matched WORKFLOW agent:
   - [AgentRole] = agentName
   - [TaskDescription] = task
   - [WorkflowObjective] = workflowRequirements.objective
   - [InputSource] = inputFrom (or "None" if null)
   - [OutputSchema] = outputSchema fields

   **SPECIAL CASES:**

   **A) SimpleDataAnalyzer (agentName = "SimpleDataAnalyzer"):**
   - Task: "Read the CSV file and provide basic structure information: column names, row count, min/max value ranges. Do NOT perform statistical analysis or create Python agents."
   - Remove any mentions of: mean, median, std deviation, quartiles, IQR, outlier detection, binning algorithms
   - Add: "You can directly read the file using your file access capabilities. Provide a simple data summary for the visualization agent."
   - This agent has NO create_generic_agent tool

   **B) DataProfiler (agentName = "DataProfiler"):**
   - In ${_input} is a complete analysis of the the Python coding agents and their tasks. Use this to develop the prompt for this agent
   - Keep the full task description from workflow requirements
   - CRITICAL: Add detailed Python agent creation instructions:
       * "You must call the create_generic_agent tool to create Python tool agents with executable code"
       * "These agents will be executed by ToolCallingAgent via the execute_python MCP tool"
       * "Agent taskDescription field must contain EXECUTABLE PYTHON CODE (not instructions)"
       * "Python code requirements:"
         - Import json at the top: import json
         - Use pandas for data manipulation: pd.read_csv() for loading
         - Calculate statistics as specified in workflow plan
         - Convert numpy/pandas types to native Python: float(), int(), .tolist()
         - Must end with: print(json.dumps(result))
       * "All created agents must use agentType: 'tool' (NEVER 'processing')"
       * "Never simulate data - work with actual CSV data only"

   **C) D3JSCodeValidator:**
   - Add autonomous decision framework:
       * Call analyze_d3_output tool ONCE to render and validate visualization
       * IF VALIDATION PASSES: Call trigger_conversation tool with code and success message
       * IF VALIDATION FAILS: Call trigger_code_correction tool with originalCode, validationErrors, validationReport
       * CRITICAL: Must call ONE decision tool - do not just report results, TAKE ACTION

   **D) D3JSCodingAgent or any coding agent:**
   - Add: "Output must be raw, executable code. Do NOT wrap in markdown code fences or JSON."
   - Add: "Convert absolute paths to relative paths (e.g., C:/repos/data/file.csv → ./data/file.csv)"

5. **CALL THE TOOL**: \`store_agent_prompt(agent_name='[DAG agentName]', agent_id = '[DAG id] prompt='[generated prompt]')\`



## PROCESS EVERY NODE:

Go through ALL nodes where type is "agent" or "sdk_agent" and call store_agent_prompt for each unique agentName. Every agent in the workflow MUST have a unique set of tasks`;
    }

    /**
     * Get the current prompt mapping
     */
    public getPromptMapping(): AgentPromptMapping {
        return { ...this.promptMapping };
    }

    /**
     * Load prompt array from file and convert to AgentPromptMapping
     * @param filePath - Path to the promptArray.txt file (default: c:/repos/sagaMiddleware/data/promptArray.txt)
     * @returns AgentPromptMapping object
     */
    public static loadPromptArrayFromFile(filePath: string = 'c:/repos/sagaMiddleware/data/promptArray.txt'): AgentPromptArray {
        try {
            console.log(`📖 Loading prompt array from ${filePath}...`);

            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            // Parse JSON array: [{agentName, id, prompt}, ...]
            const promptArray: AgentPromptArray = JSON.parse(fileContent);

            // Convert array back to mapping using id as key
            const promptMapping: AgentPromptMapping = {};

            for (const item of promptArray) {
                promptMapping[item.id] = {
                    agentName: item.agentName,
                    prompt: item.prompt
                };
            }

            console.log(`✅ Loaded ${Object.keys(promptMapping).length} prompts from file`);

            return promptArray;

        } catch (error) {
            console.error('❌ Error loading prompt array from file:', error);
            throw new Error(`Failed to load prompt array: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Set the prompt mapping (useful for testing with loaded data)
     * @param mapping - AgentPromptMapping to set
     */
    public setPromptMapping(mapping: AgentPromptMapping): void {
        this.promptMapping = mapping;
        console.log(`✅ Prompt mapping set with ${Object.keys(mapping).length} entries`);
    }

    /**
     * Validate input (optional for this agent)
     */
    protected validateInput(_input: any): boolean {
        return true; // Input is provided via constructor
    }

    /**
     * Get input from context (not used for this agent)
     */
    protected getInput(): any {
        return null;
    }

    /**
     * Set context with the prompt mapping
     */
    public setContext(data: any): void {
        this.contextManager.updateContext(this.agentName, {
            lastTransactionResult: data,
            timestamp: new Date()
        });
    }
}
