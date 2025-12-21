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
            await this.executeQuery(prompt);

            // Retrieve the DAG from context (stored by output_dag_definition tool)
            const ctx = this.contextManager.getContext('DAGDesigner') as WorkingMemory;
            const designedDAG = ctx?.designedDAG as DAGDefinition;

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
                warnings: ctx?.validation?.warnings || []
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
        return `You are a DAG Designer agent. Your task is to design an optimal Directed Acyclic Graph (DAG) workflow by following a step-by-step plan and mapping agent function interactions.

# CRITICAL: YOU MUST READ THE CODEBASE FILES FIRST

**STOP! Before designing anything, you MUST use your file reading tools to examine these files in this exact order:**

1. **FIRST: Read /src/config/agentDefinitions.ts**
   - See AGENT_DEFINITIONS array - these are ALL the Generic agents you can use
   - See SDK_AGENTS list - these are ALL the SDK agents available
   - DO NOT invent agent names not in these lists

2. **SECOND: Read /src/workflows/dagExecutor.ts** (focus on lines 40-54, 192-212, 218-276)
   - Line 46-53: strategyMap - shows which flowTypes are valid
   - Line 192-212: instantiateSDKAgent - shows which SDK agents can be instantiated
   - Line 218-276: executeNodeWithStrategy - shows how flowTypes map to strategies

3. **THIRD: Read /src/process/FlowStrategies.ts** (lines 1-398)
   - Each strategy implementation shows exactly how that flowType works
   - Line 33-82: LLMCallStrategy
   - Line 89-123: ContextPassStrategy
   - Line 134-244: ExecuteAgentsStrategy
   - Line 296-323: SDKAgentStrategy
   - Line 335-370: ValidationStrategy




# WORKFLOW REQUIREMENTS

${JSON.stringify(requirements, null, 2)}

**Agent Type Mapping:**
- \`agentType: "python_coding"\` → Use ExecuteAgentsStrategy with tool agents
- \`agentType: "functional"\` → Use LLMCallStrategy with Generic agents


# AVAILABLE AGENT TYPES

**Two Types of Agents:**

1. **SDK Agents** (e.g., DataProfiler, D3JSCodeValidator) - Claude SDK agents with terminal/file access
   - Instantiated in dagExecutor.ts via instantiateSDKAgent()
   - Use flowType: "sdk_agent" with node type: "sdk_agent"
   - Can read files, execute code, make complex decisions

2. **Generic Agents** (e.g., D3JSCodingAgent, ConversationAgent) - LLM-based agents from agentDefinitions.ts
   - Retrieved from coordinator.agents registry
   - Use flowType: "llm_call" with node type: "agent"
   - Process context and generate outputs via LLM calls

**CRITICAL RULES FROM THE CODE:**
- Entry node → first SDK agent: Use flowType "context_pass"
- SDK agent → next node: Use flowType "sdk_agent"
- Generic agent → next agent: Use flowType "llm_call"
- For Python execution: Use flowType "execute_agents"
- For branching (retry/success): Use flowType "autonomous_decision" WITHOUT creating cycles
- **NO CYCLES ALLOWED** - Use the branching pattern from the example, NOT loops


**YOUR TASK:** After your analysis of the execution environment and of the steps provided in the user's workflow plan, design a DAG that matches the workflow plan with the known and understood agents which can be rendered into flow strategies via the dagExecutor.

# CRITICAL: USE THE output_dag_definition TOOL

After designing your DAG based on the workflow requirements and codebase analysis, you MUST call the \`output_dag_definition\` tool to submit your design.

**DO NOT output JSON directly in your response. Instead, call the tool with your DAG object:**

\`\`\`
output_dag_definition({
  dag: {
    id: "unique_dag_id",
    name: "DAGName",
    description: "Brief description",
    version: "1.0.0",
    nodes: [
      {"id": "entry", "type": "entry", "agentName": "UserInput"},
      {"id": "step1", "type": "sdk_agent", "agentName": "DataProfiler", "metadata": {}},
      ...
    ],
    edges: [
      {"id": "e1", "from": "node_id", "to": "node_id", "flowType": "context_pass"},
      ...
    ],
    entryNode: "entry",
    exitNodes: ["exit"]
  }
})
\`\`\`

The tool will:
1. Validate your DAG structure (no cycles, valid nodes, valid edges)
2. Store the validated DAG as a proper DAGDefinition object
3. Return success/failure with any validation errors

Begin your design. After analyzing the codebase files and workflow requirements, call the output_dag_definition tool with your complete DAG design.`;
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
