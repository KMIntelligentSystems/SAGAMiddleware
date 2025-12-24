/**
 * DAG Designer SDK Agent
 *
 * Autonomous agent that designs DAG workflows by:
 * 1. Following a step-by-step plan for the desired objective
 * 2. Concentrating on agent function interactions between steps
 * 3. Matching plan steps with available agent capabilities
 * 4. Distinguishing between Claude SDK Agents (powerful, terminal access) and Generic Agents (task-specific)
 * 5. Generating DAGDefinition configuration with proper flow types
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
    DAGDefinition,
    WorkflowRequirements,
    AvailableAgent,
    DAGDesignResult
} from '../types/dag.js';
import * as fs from 'fs';

export interface DAGDesignerInput {
    workflowRequirements: WorkflowRequirements;
    availableAgents: AvailableAgent[];
}

export class DAGDesigner extends BaseSDKAgent {
    private availableAgents: Map<string, AvailableAgent> = new Map();

    constructor(contextManager?: any) {
        super('DAGDesigner', 25, contextManager);

        // Setup tools for DAG design
        try {
            this.setupDesignTools();
        } catch (error) {
            console.error('⚠️  Warning: Failed to setup DAG Designer tools:', error);
            console.log('   DAG Designer will run without custom tools');
        }
    }

    /**
     * Setup tools for autonomous DAG design
     * Local tool to output validated DAG definition
     */
    private setupDesignTools(): void {
        // Tool: Output the designed DAG definition
        const outputDAGTool = tool(
            'output_dag_definition',
            'Output the final DAG definition as a validated DAGDefinition object. Use this tool to submit your designed DAG after validating it follows all the rules.',
            {
                dag: z.object({
                    id: z.string().describe('Unique DAG identifier'),
                    name: z.string().describe('DAG name'),
                    description: z.string().describe('Brief description of what this DAG does'),
                    version: z.string().describe('Version (e.g., "1.0.0")'),
                    nodes: z.array(z.object({
                        id: z.string(),
                        type: z.enum(['entry', 'agent', 'sdk_agent', 'tool_agent', 'exit']),
                        agentName: z.string(),
                        prompt: z.string().optional(),
                        metadata: z.record(z.any()).optional(),
                        stepConfig: z.any().optional()
                    })),
                    edges: z.array(z.object({
                        id: z.string(),
                        from: z.string(),
                        to: z.string(),
                        flowType: z.enum(['llm_call', 'context_pass', 'execute_agents', 'sdk_agent', 'validation', 'autonomous_decision']),
                        condition: z.object({
                            type: z.string(),
                            expression: z.string()
                        }).optional(),
                        metadata: z.record(z.any()).optional()
                    })),
                    entryNode: z.string(),
                    exitNodes: z.array(z.string())
                }).describe('The complete DAG definition object')
            },
            async (args) => {
                return this.handleOutputDAG(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'dag-designer',
            tools: [outputDAGTool]
        });

        // Add MCP server to options
        this.options.mcpServers = {
            'dag-designer': mcpServer
        } as any;

        console.log('✅ DAG Designer tools setup complete');
    }

    /**
     * Handler for output_dag_definition tool
     * Validates and stores the DAG definition in context
     */
    private async handleOutputDAG(args: any) {
        try {
            console.log('🎯 output_dag_definition tool called');

            const dag = args.dag as DAGDefinition;

            // Validate the DAG structure
            const validation = this.validateDAGStructure(dag);

            if (!validation.valid) {
                console.error('❌ DAG validation failed:');
                validation.errors.forEach(err => console.error(`   - ${err}`));

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            success: false,
                            errors: validation.errors,
                            message: 'DAG validation failed. Please fix the errors and try again.'
                        }, null, 2)
                    }],
                    isError: true
                };
            }

            console.log('✅ DAG validated successfully');
            console.log(`   Nodes: ${dag.nodes.length}`);
            console.log(`   Edges: ${dag.edges.length}`);

            // Store the validated DAG in context
            this.setContext({
                designedDAG: dag,
                validation: validation,
                timestamp: new Date()
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        message: 'DAG definition validated and stored successfully',
                        nodeCount: dag.nodes.length,
                        edgeCount: dag.edges.length,
                        warnings: validation.warnings
                    }, null, 2)
                }]
            };

        } catch (error) {
            console.error('❌ Error in handleOutputDAG:', error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error processing DAG: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Tool handlers (query_agent_capabilities, validate_dag_design, find_agents_by_capability, suggest_flow_type)
     * TEMPORARILY DISABLED - Will re-enable when SDK tool configuration is fixed
     *
     * These methods provided autonomous design capabilities but caused SDK subprocess crashes.
     * The agent now relies on comprehensive prompt instructions instead of interactive tools.
     */

    /**
     * Execute DAG design
     */
    async execute(input: DAGDesignerInput): Promise<AgentResult> {
        try {
            console.log('\n🎨 DAG Designer Agent Starting...');
            console.log(`   Objective: ${input.workflowRequirements.objective}`);
            console.log(`   Available Agents: ${input.availableAgents.length}`);

            // Store available agents
            input.availableAgents.forEach(agent => {
                this.availableAgents.set(agent.name, agent);
            });

            // Build design prompt
            const prompt = this.buildDesignPrompt(input.workflowRequirements, input.availableAgents);

            // Execute design query - agent will call output_dag_definition tool
            console.log('🤔 Analyzing requirements and formulating DAG plan...');
            try {
                await this.executeQuery(prompt);
            } catch (error) {
                // Agent may not return text if it only calls the tool
                // Check if the tool was called successfully by looking for the DAG in context
                const ctx = this.contextManager.getContext('DAGDesigner') as WorkingMemory;
                const designedDAG = (ctx?.lastTransactionResult as any)?.designedDAG;
                if (!designedDAG) {
                    // Tool wasn't called, re-throw the error
                    throw error;
                }
                // Tool was called successfully, continue
                console.log('✅ Tool called successfully (no text output expected)');
            }

            // Retrieve the DAG from context (stored by output_dag_definition tool)
            const ctx = this.contextManager.getContext('DAGDesigner') as WorkingMemory;
            const designedDAG = (ctx?.lastTransactionResult as any)?.designedDAG as DAGDefinition;

            if (!designedDAG) {
                return {
                    agentName: 'DAGDesigner',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Agent did not output a DAG definition using the output_dag_definition tool'
                };
            }

            console.log('✅ DAG design retrieved from context');
            console.log(`   Nodes: ${designedDAG.nodes.length}`);
            console.log(`   Edges: ${designedDAG.edges.length}`);

            const result: DAGDesignResult = {
                success: true,
                dag: designedDAG,
                reasoning: 'DAG designed autonomously based on workflow requirements',
                warnings: (ctx?.lastTransactionResult as any)?.validation?.warnings || []
            };

            return {
                agentName: 'DAGDesigner',
                result: result,
                success: true,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ DAG Designer error:', error);
            return {
                agentName: 'DAGDesigner',
                result: '',
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Build design prompt for the SDK agent
     */
    protected buildPrompt(input: any): string {
        return this.buildDesignPrompt(
            input.workflowRequirements,
            input.availableAgents
        );
    }

    /**
     * Build detailed design prompt
     */
    private buildDesignPrompt(
        requirements: WorkflowRequirements,
        availableAgents: AvailableAgent[]
    ): string {
        return ''
        
        `# YOUR ONLY TASK: CALL output_dag_definition TOOL

You will design a DAG workflow, but you MUST submit it by calling the output_dag_definition tool.

**CRITICAL:** Do NOT write explanations. Do NOT output JSON in text. ONLY call the tool.

The tool call IS your design submission. Nothing else counts.

---

# STEP 1: READ THESE CODEBASE FILES

Use your file reading tools to examine these files in order:

1. **/src/config/sdkAgentsGuide.md**
   - **READ THIS FIRST** - Critical guide for SDK agents behavior and branching
   - DataProfiler and D3JSCodeValidator special handling rules

2. **/src/config/agentDefinitions.ts**
   - AGENT_DEFINITIONS array = ALL Generic agents available
   - SDK_AGENTS list = ALL SDK agents available
   - DO NOT use agents not in these lists

3. **/src/workflows/dagExecutor.ts** (lines 46-53, 192-212, 218-276)
   - strategyMap: valid flowTypes
   - instantiateSDKAgent: which SDK agents exist
   - executeNodeWithStrategy: how flowTypes map to strategies

4. **/src/process/FlowStrategies.ts** (lines 33-370)
   - LLMCallStrategy: Generic agent LLM execution
   - ContextPassStrategy: Pass context without execution
   - ExecuteAgentsStrategy: Python agents via MCP
   - SDKAgentStrategy: SDK agent execution
   - ValidationStrategy: Validation with merge

---

# STEP 2: UNDERSTAND REQUIREMENTS

${JSON.stringify(requirements, null, 2)}

**Agent Type Mapping:**
- \`agentType: "python_coding"\` → These agents must be created by DataProfiler SDK agent. Create ONE DataProfiler node. DataProfiler output uses \`execute_agents\` flowType (ExecuteAgentsStrategy).
- \`agentType: "functional"\` → Use existing Generic agents from agentDefinitions.ts with \`llm_call\` flowType (LLMCallStrategy)

**Flow Type Rules:**
- Entry → first agent: \`context_pass\`
- SDK agent → next: \`sdk_agent\`
- Generic agent → next: \`llm_call\`
- Python execution: \`execute_agents\`
- Branching (no cycles): \`autonomous_decision\`

**Agent Types:**
- **SDK Agents**: DataProfiler, D3JSCodeValidator (in dagExecutor.ts instantiateSDKAgent)
- **Generic Agents**: From agentDefinitions.ts AGENT_DEFINITIONS array

---

# STEP 3: CALL THE TOOL

After reading the files and understanding requirements, call output_dag_definition with your complete DAG:

output_dag_definition({ dag: { id, name, description, version, nodes, edges, entryNode, exitNodes } })

Do it now. No explanations. Just call the tool.`;
    
}


    /**
     * Validate DAG structure
     */
    private validateDAGStructure(dag: DAGDefinition): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check nodes
        if (!dag.nodes || dag.nodes.length === 0) {
            errors.push('DAG has no nodes');
        }

        // Check entry node
        if (!dag.nodes.find(n => n.id === dag.entryNode)) {
            errors.push(`Entry node not found: ${dag.entryNode}`);
        }

        // Check exit nodes
        if (!dag.exitNodes || dag.exitNodes.length === 0) {
            errors.push('DAG has no exit nodes');
        } else {
            dag.exitNodes.forEach(exitNode => {
                if (!dag.nodes.find(n => n.id === exitNode)) {
                    errors.push(`Exit node not found: ${exitNode}`);
                }
            });
        }

        // Check edges reference valid nodes
        dag.edges.forEach((edge, idx) => {
            if (!dag.nodes.find(n => n.id === edge.from)) {
                errors.push(`Edge ${idx} references invalid source: ${edge.from}`);
            }
            if (!dag.nodes.find(n => n.id === edge.to)) {
                errors.push(`Edge ${idx} references invalid target: ${edge.to}`);
            }
        });

        // Check for cycles (basic check)
        const hasCycles = this.detectCycles(dag);
        if (hasCycles) {
            errors.push('DAG contains cycles');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Simple cycle detection
     */
    private detectCycles(dag: DAGDefinition): boolean {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (nodeId: string): boolean => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const outgoing = dag.edges.filter(e => e.from === nodeId);
            for (const edge of outgoing) {
                if (!visited.has(edge.to)) {
                    if (dfs(edge.to)) return true;
                } else if (recursionStack.has(edge.to)) {
                    return true; // Cycle detected
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        return dfs(dag.entryNode);
    }

    /**
     * Validate input
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            input.workflowRequirements &&
            input.availableAgents &&
            Array.isArray(input.availableAgents)
        );
    }

    /**
     * Get input from context
     */
    protected getInput(): DAGDesignerInput {
        const ctx = this.contextManager.getContext('DAGDesigner') as WorkingMemory;
        return ctx?.lastTransactionResult || {
            workflowRequirements: {} as WorkflowRequirements,
            availableAgents: []
        };
    }
}
