/**
 * DataProfiler
 *
 * Analyzes CSV files and generates detailed prompts for agent structure generation.
 *
 * Flow:
 * 1. User sends: file path + plain text requirements via socket
 * 2. SDK Claude (Sonnet) analyzes actual file + interprets requirements
 * 3. Outputs: Comprehensive prompt for AgentStructureGenerator
 *
 * The SDK agent figures out:
 * - File encoding, structure, headers
 * - DateTime formats, data mappings
 * - Transformation requirements
 * - Technical specifications for code generation
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory, AgentDefinition, LLMConfig } from '../types/index.js';
import { GenericAgent } from './genericAgent.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as fs from 'fs'
import { claudeBackendResult_1, claudeBackendResult_2, claudeBackendResult_3} from '../test/histogramData.js'
import { agentConstructorPythonExecutionError } from '../test/testData.js';

export interface DataProfileInput {
    workflowDescription: string;  // Complete workflow plan including filepath and requirements
}

export interface SubAgentSpec {
    name: string;
    description: string;
    expectedOutput: string;
}

export interface CreatedAgentInfo {
    agent?: GenericAgent;  // Optional - only created when needed
    definition: AgentDefinition;
    order: number;
}

export class DataProfiler extends BaseSDKAgent {
    private createdAgents: CreatedAgentInfo[] = [];
    private agentCreationOrder: number = 0;

    constructor(contextManager?: any) {
        super('DataProfiler', 15, contextManager);

        // Add custom tool for creating GenericAgents
       // this.createTestAgents();
     //   this.setupCreateAgentTool();
    }

    /**
     * Setup custom MCP tool for creating GenericAgent instances
     */
    private setupCreateAgentTool(): void {
        const createAgentTool = tool(
            'create_generic_agent',
            'Creates a GenericAgent instance for data processing. Call this tool for each agent you want to create in the processing pipeline.',
            {
                name: z.string().describe('Agent name (e.g., "DataLoaderAgent", "StatisticsAgent")'),
                taskDescription: z.string().describe('Detailed task description - what this agent should do'),
                taskExpectedOutput: z.string().describe('Expected output format and structure'),
                agentType: z.enum(['tool', 'processing']).describe('Agent type: "tool" for agents using MCP tools, "processing" for pure text processing'),
                llmProvider: z.enum(['openai', 'anthropic', 'gemini']).optional().describe('LLM provider. Default: "openai"'),
                llmModel: z.string().optional().describe('Model name. Default: "gpt-4o-mini"'),
                dependencies: z.array(z.string()).optional().describe('Names of other agents this agent depends on'),
                mcpTools: z.array(z.string()).optional().describe('MCP tools this agent can use (e.g., ["execute_python"])')
            },
            async (args) => {
                return this.handleCreateAgent(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'agent-creator',
            tools: [createAgentTool]
        });

        // Add MCP server to options - SDK expects the server instance directly
        this.options.mcpServers = {
            'agent-creator': mcpServer
        } as any;
    }

    /**
     * Handler for create_generic_agent tool
     */
    private async handleCreateAgent(args: any) {
        try {
            console.log(`\n🔧 Creating GenericAgent: ${args.name}`);

            // Generate unique ID
            const agentId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

            // Build LLM config
            const llmConfig: LLMConfig = {
                provider: args.llmProvider || 'openai',
                model: args.llmModel || 'gpt-4o-mini',
                temperature: 0.3,
                maxTokens: 4000
            };

            // Build dependencies
            const dependencies = (args.dependencies || []).map((depName: string) => ({
                agentName: depName,
                required: true
            }));

            // Create AgentDefinition
            const agentDefinition: AgentDefinition = {
                id: agentId,
                name: args.name,
                backstory: `Agent created by DataProfiler for: ${args.taskDescription.substring(0, 100)}`,
                taskDescription: args.taskDescription,
                taskExpectedOutput: args.taskExpectedOutput,
                llmConfig,
                dependencies,
                agentType: args.agentType,
                mcpServers: args.agentType === 'tool' ? [
                    {
                        name: 'execution',
                        command: 'npx',
                        args: ['-y', '@anthropic-ai/mcp-server-execution'],
                        transport: 'stdio' as const
                    }
                ] : undefined,
                mcpTools: args.mcpTools || (args.agentType === 'tool' ? ['execute_python'] : undefined)
            };

            // Store agent definition in registry (don't instantiate GenericAgent yet to avoid MCP connection errors)
            const agentInfo: CreatedAgentInfo = {
                definition: agentDefinition,
                order: this.agentCreationOrder++
            };

            this.createdAgents.push(agentInfo);

            console.log(`✅ Created agent definition: ${args.name} (Order: ${agentInfo.order})`);

            // Return success message to Claude
            return {
                content: [{
                    type: 'text' as const,
                    text: `Successfully created agent "${args.name}" (ID: ${agentId}, Order: ${agentInfo.order})`
                }]
            };
        } catch (error) {
            console.error(`❌ Error creating agent ${args.name}:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error creating agent: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Get all created agents
     */
    public getCreatedAgents(): CreatedAgentInfo[] {
        return [...this.createdAgents].sort((a, b) => a.order - b.order);
    }

    private createTestAgents(): void{
         const agentDefinition_1: AgentDefinition = {
        id: 'tx-ag_1',
        name: 'DataFilter',
        backstory: `Dynamic agent created from SAGA transaction with ID`,
        taskDescription: claudeBackendResult_1,
        taskExpectedOutput: 'Structured response based on task requirements',
        llmConfig: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000,  provider: 'openai' },
        dependencies: [],
        agentType: 'tool'
      };
      const agentInfo_1: CreatedAgentInfo = {
                definition: agentDefinition_1,
                order: this.agentCreationOrder++
            };

            this.createdAgents.push(agentInfo_1);
    
      const agentDefinition_2: AgentDefinition = {
        id: 'tx-ag_1',
        name: 'HistogramParametersCalculatorAgent',
        backstory: `Dynamic agent created from SAGA transaction with ID`,
        taskDescription: claudeBackendResult_2,
        taskExpectedOutput: 'Structured response based on task requirements',
        llmConfig: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000,  provider: 'openai' },
        dependencies: [],
        agentType: 'tool'
      };
      const agentInfo_2: CreatedAgentInfo = {
                definition: agentDefinition_2,
                order: this.agentCreationOrder++
            };

            this.createdAgents.push(agentInfo_2);

    const agentDefinition_3: AgentDefinition = {
        id: 'tx-ag_1',
        name: ' DataPreprocessorAgent',
        backstory: `Dynamic agent created from SAGA transaction with ID`,
        taskDescription: claudeBackendResult_3,
        taskExpectedOutput: 'Structured response based on task requirements',
        llmConfig: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000,  provider: 'openai' },
        dependencies: [],
        agentType: 'tool'
      };
      const agentInfo_3: CreatedAgentInfo = {
                definition: agentDefinition_3,
                order: this.agentCreationOrder++
            };

            this.createdAgents.push(agentInfo_3);
    }
    /**
     * Clear created agents
     */
    public clearCreatedAgents(): void {
        this.createdAgents = [];
        this.agentCreationOrder = 0;
    }

    /**
     * Execute data profiling
     */
    async execute(input: DataProfileInput): Promise<AgentResult> {
        // Get input from context manager
     //   input = this.getInput();

      /*  if (!this.validateInput(input)) {
            return {
                agentName: 'DataProfiler',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: workflowDescription is required'
            };
        }*/

        try {
            const ctx = this.contextManager.getContext('DataProfiler') as WorkingMemory;
            const prompt = this.buildPrompt(ctx.lastTransactionResult);
        //    try{
           
            this.createTestAgents();//await this.executeQuery(prompt); //dataProfileHistogramResponse  fs.readFileSync('C:/repos/SAGAMiddleware/data/dataProfileHistogramResponse.txt', 'utf-8'); //fs.readFileSync('C:/repos/SAGAMiddleware/data/dataProfiler_PythonEnvResponse.txt', 'utf-8');//
            
            const agents = JSON.stringify(this.createdAgents)

            console.log('🔵 DataProfiler: About to setContext with agents:', agents);
           
            this.setContext(agents);

// } catch(error: any){
    //            console.log('ERROR ', error)
  //          }
            return {
               agentName: 'DataProfiler',
                result: agents,
                success: true,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
              agentName: 'DataProfiler',
                result: '',
                success: false,
                timestamp: new Date(), 
                error: ''
            };
        }
    }

    /**
     * Build prompt for data profiling
     * Generic prompt that wraps around user requirements without hardcoded assumptions
     */
    protected buildPrompt(input: DataProfileInput): string {
        return this.getGenericDataAnalysisPrompt(input);
    }

    /**
     * Validate input for data profiling
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.workflowDescription === 'string' &&
            input.workflowDescription.length > 0
        );
    }

    /**
     * Get input from context manager
     */
    protected getInput(): DataProfileInput {
        const ctx = this.contextManager.getContext('DataProfiler') as WorkingMemory;
        const actualResult = ctx?.lastTransactionResult;
console.log('INPUT DATAPROFILER ', actualResult)
        if (!actualResult) {
            throw new Error('DataProfiler context not initialized. Ensure DefineUserRequirementsProcess has run first.');
        }

        // The context should already contain the properly structured DataProfileInput
        return actualResult as DataProfileInput;
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
    async analyzeAndGeneratePrompt(workflowDescription: string): Promise<string> {
        const result = await this.execute({ workflowDescription });
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate prompt from file analysis');
        }
        return result.result;
    }

    /**
     * Legacy file analysis prompt (deprecated)
     * @deprecated This method used the old two-parameter interface. Use getGenericDataAnalysisPrompt instead.
     */
    getFileAnalysisPrompt(input: DataProfileInput): string {
        console.log('⚠️ WARNING: getFileAnalysisPrompt is deprecated. Use getGenericDataAnalysisPrompt instead.');
        console.log('WORKFLOW DESCRIPTION', input.workflowDescription);

        // This legacy method is no longer functional with the new interface
        // Redirecting to the new generic prompt
        return this.getGenericDataAnalysisPrompt(input);
    }

    /**
     * Generic data analysis prompt - wraps around user requirements
     * Instructs Claude to use create_generic_agent tool to create agents
     */
    getGenericDataAnalysisPrompt(input: DataProfileInput): string {
        console.log('WORKFLOW DESCRIPTION', input.workflowDescription);

        return `You are creating GenericAgent instances for a data processing pipeline using the create_generic_agent tool.

WORKFLOW PLAN:
${input.workflowDescription}

YOUR TASK:

1. First, use read_file ONCE to examine the data file mentioned in the workflow plan.
   - Identify the exact file path
   - Note column names (case-sensitive)
   - Understand data structure

2. Then, for EACH agent in the workflow plan, call create_generic_agent tool ONCE per agent:

   **name**: Agent name in CamelCase with "Agent" suffix (e.g., "DataProfilerAgent")

   **taskDescription**:
   - FOR TOOL AGENTS (agentType="tool"): COMPLETE, EXECUTABLE Python code (not instructions). Write the actual Python code string with \\n for newlines. Include all imports, exact file paths, error handling, and print JSON output.
   - FOR PROCESSING AGENTS (agentType="processing"): Clear instructions for text/code generation tasks (like D3.js visualization, HTML, etc.)

   Example taskDescription for TOOL agent (Python code as string):
   "import pandas as pd\\nimport numpy as np\\nimport json\\n\\ndf = pd.read_csv('C:/exact/path/to/prices.csv')\\nprices = df['price']\\nresult = {'mean': float(np.mean(prices)), 'std': float(np.std(prices, ddof=1))}\\nprint(json.dumps(result))"

   Example taskDescription for PROCESSING agent (instructions):
   "Generate a complete HTML file with D3.js histogram. Use the preprocessed data from the previous agent. Include proper D3 scales, axes, and tooltips."

   **taskExpectedOutput**: Describe the exact output format (JSON keys, data types for tool agents; HTML/text structure for processing agents)

   **agentType**: "tool" for Python execution with execute_python, "processing" for text/HTML/D3.js generation (NO execute_python)

   **dependencies**: [] for first agent, ["PreviousAgentName"] for others

   **llmProvider**: "openai"

   **llmModel**: "gpt-4o-mini"

   **mcpTools**: ["execute_python"] for tool agents, [] for processing agents

3. Create agents IN ORDER (Agent 1, then Agent 2, then Agent 3, etc.)

4. Infer what each agent needs based on task keywords:

   - If task mentions "statistical profile" or "analyze": include mean, median, std, quartiles, skewness, kurtosis, outlier detection
   - If task mentions "bin" or "histogram parameters": include Sturges, Scott, Freedman-Diaconis calculations
   - If task mentions "preprocess" or "format": include numpy.histogram() and bin structure generation
   - If task mentions "visualization" or "D3.js": include complete HTML generation with d3.csv()

5. After calling create_generic_agent for ALL agents in the workflow, output a summary:
   "Created N agents: [list names]. Pipeline complete."

6. STOP - Do not call any more tools after creating all agents.

CRITICAL REQUIREMENTS:
- Use read_file tool ONLY ONCE at the beginning
- Call create_generic_agent ONCE per agent (do NOT call it multiple times for the same agent)
- After creating all agents, output a summary message and STOP
- Use EXACT file paths from the workflow (no placeholders)
- Use EXACT column names from file inspection (case-sensitive)
- Include complete Python instructions in taskDescription
- Specify exact output format in taskExpectedOutput

WORKFLOW:
1. Read file ONCE with read_file tool
2. For each agent in workflow plan: call create_generic_agent tool ONCE
3. After creating all agents, output summary: "Created N agents: [names]. Pipeline complete."
4. STOP - do not call any more tools`;
    }

    /**
     * Legacy histogram-specific prompt (deprecated)
     * @deprecated This method used the old two-parameter interface and hardcoded histogram assumptions. Use getGenericDataAnalysisPrompt instead.
     */
    getHistogramPrompt(input: DataProfileInput): string {
        console.log('⚠️ WARNING: getHistogramPrompt is deprecated. Use getGenericDataAnalysisPrompt instead.');
        console.log('WORKFLOW DESCRIPTION', input.workflowDescription);

        // This legacy method is no longer functional with the new interface
        // Redirecting to the new generic prompt which handles all visualization types
        return this.getGenericDataAnalysisPrompt(input);
    }
}
