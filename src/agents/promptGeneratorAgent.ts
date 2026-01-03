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
import {  prompGeneratorAgent_DataProfiler, prompGeneratorAgent_D3JSCodingAgent, prompGeneratorAgent_D3JSCodeValidator } from '../test/histogramData.js'

export interface AgentPromptMapping {
    [agentName: string]: string;
}

export type AgentPromptArray = Array<[string, string]>;

export class PromptGeneratorAgent extends BaseSDKAgent {
    private promptMapping: AgentPromptMapping = {};
    private dag: DAGDefinition;
    private workflowRequirements: any;

    constructor(dag: DAGDefinition, workflowRequirements: any, contextManager?: any) {
        super('PromptGeneratorAgent', 25, contextManager);

        this.dag = dag;
        this.workflowRequirements = workflowRequirements;

        // Setup the local tool for storing agent-prompt mappings
        try {
            this.setupPromptStoreTool();
        } catch (error) {
            console.error('⚠️  Warning: Failed to setup Prompt Generator tools:', error);
            console.log('   Prompt Generator will run without custom tools');
        }
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
            console.log(`   💾 Storing prompt for ${args.agent_name}`);

            this.promptMapping[args.agent_name] = args.prompt;

            console.log(`   ✅ Stored prompt for ${args.agent_name} (${args.prompt.length} chars)`);

            return {
                content: [{
                    type: 'text' as const,
                    text: `Successfully stored prompt for "${args.agent_name}"`
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
            this.promptMapping = {};

            // Build prompt with embedded requirements and DAG
            const prompt = this.buildPrompt(null);

            // Execute - the SDK agent will call the tool for each agent
            console.log(`\n   📝 Executing prompt generation...`);
            await this.executeQuery(prompt);

            console.log(`\n✅ PromptGeneratorAgent: Generated ${Object.keys(this.promptMapping).length} prompts`);

            // Convert mapping to array format: [agentName, prompt]
            const promptArray: AgentPromptArray = Object.entries(this.promptMapping);

            // Store the array in context
            this.setContext(promptArray);

            return {
                agentName: 'PromptGeneratorAgent',
                success: true,
                result: promptArray,
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
        return `You are a prompt generator for LLM and SDK agents in a workflow.

# WORKFLOW REQUIREMENTS:
${JSON.stringify(this.workflowRequirements, null, 2)}

# DAG DEFINITION:
${JSON.stringify(this.dag, null, 2)}

# YOUR TASK:

You must generate prompts for EVERY "agent" and "sdk_agent" node in the DAG. Here's how:

1. IDENTIFY ALL NODES: List every node in DAG DEFINITION where type is "agent" or "sdk_agent" (skip entry and exit)

2. UNDERSTAND TEMPORAL CONTEXT: For each node, examine the DAG edges to understand its position:
   - What node provides input? (look at incoming edges)
   - What happens after? (look at outgoing edges)
   - Is this a retry/correction path? (check if it follows a validation failure condition)
   - Is this the initial attempt or a subsequent retry?

3. MATCH TO WORKFLOW REQUIREMENTS:
   - Each DAG node has an agentName field - this is what you'll use as the KEY
   - Find the WORKFLOW REQUIREMENTS agent whose task matches what this DAG node does at this point in the flow
   - Example pattern: If two DAG nodes share the same agentName but one follows a validation success path and another follows a validation failure path, they're doing different tasks (e.g., initial code generation vs. code correction)
   - Match by understanding the workflow purpose, not by name matching

4. GENERATE DISTINCT PROMPTS:
   - If an agentName appears MULTIPLE times, it's serving DIFFERENT purposes - generate appropriate prompts
   - Use the DAG node's agentName as the KEY for store_agent_prompt tool
   - Use the matched WORKFLOW agent's task, inputFrom, outputSchema for prompt CONTENT
   - Adjust the prompt based on whether it's initial generation or retry/correction
   - Use this template:

${createPrompt}

   - **FOR GENERIC AGENTS (node type is "agent"):**
     - Keep the prompt simple and focused on the task
     - Use ONLY the information from WORKFLOW REQUIREMENTS (task, inputFrom, outputSchema)
     - DO NOT add technical implementation details or tool usage instructions
     - The agent should receive clear input→output expectations with minimal complexity
     - Examples: D3JSCodingAgent (generate code), ValidatingAgent (validate results), ConversationAgent (format output)

   - **SPECIAL ENHANCEMENTS FOR SDK AGENTS (node type is "sdk_agent"):**

     When the DAG node type is "sdk_agent", examine the agent's agentType and task in WORKFLOW REQUIREMENTS to add technical details:

     **If agentType is "python_coding" OR task mentions "Python" or "data analysis":**
     - Specify Python libraries to use: pandas for data manipulation, numpy for numerical operations, scipy for statistics
     - Detail statistical methods: mean, median, std deviation, quartiles, IQR for outlier detection
     - For histogram/binning tasks: mention Sturges, Scott, and Freedman-Diaconis binning rules
     - Clarify that "dynamic agent definitions" or "code generation" means calling the create_generic_agent tool to create sub-agents with executable Python code
     - **CRITICAL:** Explain the agent design decision pattern:
       * Use ONE agent when task is straightforward and sequential
       * Use MULTIPLE agents when task is complex with distinct logical phases
       * Assess complexity and identify natural breakpoints
     - **Data flow pattern:** First agent loads CSV with pd.read_csv(), subsequent agents use _prev_result dictionary from previous agent
     - **Python code requirements for taskDescription field:**
       * Must be EXECUTABLE PYTHON CODE, not instructions
       * Import json at top: import json
       * Never simulate data (no np.random, no fake data)
       * Never reload CSV in dependent agents (use _prev_result)
       * Use safe variable names (count_val, mean_val, not reserved words)
       * Convert numpy/pandas types to native Python: float(), int(), .tolist()
       * Must end with: print(json.dumps(result))
     - All created agents must use agentType: 'tool' (NEVER 'processing')
     - Ignore any visualization agents in workflow - ONLY create data processing/analysis agents

     **If task mentions "validate", "test", "Playwright", or "browser":**
     - **CRITICAL:** Explain this is an autonomous validation agent that must TAKE ACTION, not just report
     - **Validation workflow:**
       1. Call analyze_d3_output tool ONCE with the complete D3.js code to render visualization
       2. Tool returns file paths to rendered SVG and PNG files
       3. Analyze the SVG output to validate accuracy against data analysis requirements
     - **AUTONOMOUS DECISION FRAMEWORK - Must choose ONE:**
       * **IF VALIDATION PASSES:**
         - Call trigger_conversation tool with validated code and success message
         - This sends code directly to user via ConversationAgent
       * **IF VALIDATION FAILS:**
         - Call trigger_code_correction tool with originalCode, validationErrors array, validationReport
         - This triggers coding agent to generate corrected code with specific errors
     - **Validation specifics:**
       * Playwright commands: page.goto() for loading, page.waitForSelector() for elements, page.evaluate() for DOM inspection
       * SVG elements to check: <svg>, <g>, <rect> for bars, <path> for axes, <text> for labels
       * Validate element counts match expected values (e.g., histogram bar count matches bin count)
       * Accessibility checks: ARIA labels, roles, keyboard navigation, color contrast
       * For failures: provide specific element selectors or line numbers for targeted fixes
       * Capture screenshots on failure for debugging
     - **CRITICAL:** Must call ONE decision tool - do not just report results, TAKE ACTION

     **If task mentions "coding" or "generate code":**
     - Add instruction to avoid wrapping output in markdown code fences or JSON
     - Include path normalization: convert absolute paths to relative paths (e.g., C:/repos/... → ./...)
     - Specify output must be raw, executable code

   - Call the store_agent_prompt tool with the agent_name and the generated prompt

5. IMPORTANT - PROCESS ALL NODES:
   - Go through the complete list from step 1
   - Generate a prompt for EACH node in the DAG (even if the agentName repeats)
   - Call store_agent_prompt tool for each unique agentName you encounter
   - If the same agentName serves different purposes (e.g., initial vs retry), generate a comprehensive prompt that covers all use cases`;
    }

    /**
     * Get the current prompt mapping
     */
    public getPromptMapping(): AgentPromptMapping {
        return { ...this.promptMapping };
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
