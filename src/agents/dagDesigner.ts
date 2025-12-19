/**
 * DAG Designer SDK Agent
 *
 * Autonomous agent that designs DAG workflows by:
 * 1. Reading workflow requirements
 * 2. Understanding available agents and their capabilities
 * 3. Formulating an optimal DAG plan
 * 4. Generating DAGDefinition configuration
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
// import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
// import { z } from 'zod';
import {
    DAGDefinition,
    WorkflowRequirements,
    AvailableAgent,
    DAGDesignResult
} from '../types/dag.js';

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
     * TEMPORARILY DISABLED - SDK subprocess crashes with custom tools
     * Will add tools back after debugging SDK configuration
     */
    private setupDesignTools(): void {
        // TODO: Re-enable custom tools once SDK configuration is fixed
        // The Claude SDK subprocess crashes when creating custom MCP servers
        // For now, the agent will work without the helper tools
        console.log('ℹ️  DAG Designer running without custom tools (to avoid SDK crash)');
        console.log('   Agent will design DAGs based on prompt instructions only');
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

            // Execute design query
            console.log('🤔 Analyzing requirements and formulating DAG plan...');
            const output = await this.executeQuery(prompt);

            // Parse the DAG design from output
            const dagDesign = this.parseDAGFromOutput(output);

            if (!dagDesign) {
                return {
                    agentName: 'DAGDesigner',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: 'Failed to parse DAG design from agent output'
                };
            }

            // Validate the designed DAG
            const validation = this.validateDAGStructure(dagDesign);

            if (!validation.valid) {
                console.error('❌ Designed DAG failed validation:');
                validation.errors.forEach(err => console.error(`   - ${err}`));
                return {
                    agentName: 'DAGDesigner',
                    result: '',
                    success: false,
                    timestamp: new Date(),
                    error: `DAG validation failed: ${validation.errors.join(', ')}`
                };
            }

            console.log('✅ DAG design validated successfully');
            console.log(`   Nodes: ${dagDesign.nodes.length}`);
            console.log(`   Edges: ${dagDesign.edges.length}`);

            const result: DAGDesignResult = {
                success: true,
                dag: dagDesign,
                reasoning: 'DAG designed autonomously based on workflow requirements',
                warnings: validation.warnings
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
        return `You are a DAG Designer agent. Your task is to design an optimal Directed Acyclic Graph (DAG) workflow based on the requirements and available agents.

# WORKFLOW REQUIREMENTS

**Objective:** ${requirements.objective}

**Input Data:**
- Type: ${requirements.inputData.type}
- Source: ${requirements.inputData.source}
${requirements.inputData.schema ? `- Schema: ${JSON.stringify(requirements.inputData.schema)}` : ''}

**Output Expectation:**
- Type: ${requirements.outputExpectation.type}
${requirements.outputExpectation.format ? `- Format: ${requirements.outputExpectation.format}` : ''}
${requirements.outputExpectation.quality ? `- Quality: ${requirements.outputExpectation.quality.join(', ')}` : ''}

**Constraints:**
${requirements.constraints?.maxExecutionTime ? `- Max execution time: ${requirements.constraints.maxExecutionTime}ms` : ''}
${requirements.constraints?.mustIncludeAgents ? `- Must include: ${requirements.constraints.mustIncludeAgents.join(', ')}` : ''}
${requirements.constraints?.mustExcludeAgents ? `- Must exclude: ${requirements.constraints.mustExcludeAgents.join(', ')}` : ''}
${requirements.constraints?.parallelismAllowed !== undefined ? `- Parallelism allowed: ${requirements.constraints.parallelismAllowed}` : ''}
${requirements.constraints?.executionOrder ? `- Execution order: ${requirements.constraints.executionOrder}` : ''}

${requirements.agents && requirements.agents.length > 0 ? `
# FRONTEND-SPECIFIED PYTHON AGENTS (CRITICAL)

The frontend has specified ${requirements.agents.length} Python agents that MUST be executed using the execute_agents flow type.
These agents form a sequential data processing pipeline that must be incorporated into your DAG design.

${requirements.agents.map((agent, idx) => `
## Agent ${idx + 1}: ${agent.name}
- **Description:** ${agent.description}
- **Task:** ${agent.task}
- **Input From:** ${agent.inputFrom || 'Entry (first agent)'}
- **Output Schema:** ${JSON.stringify(agent.outputSchema)}
`).join('\n')}

**CRITICAL INSTRUCTIONS FOR FRONTEND AGENTS:**
1. You MUST create nodes for each of these ${requirements.agents.length} Python agents
2. Connect them using "execute_agents" flow type
3. The task descriptions will be converted to Python code by ExecuteAgentsStrategy
4. These agents run sequentially (each depends on previous agent's output via _prev_result)
5. After the Python agents complete, route their output to D3 visualization/validation agents
6. Include these agents as "agent" type nodes with agentName matching the frontend agent name
` : ''}

# AVAILABLE AGENTS

${availableAgents.map(agent => `
## ${agent.name} (${agent.type})
- **Description:** ${agent.description}
- **Capabilities:** ${agent.capabilities.join(', ')}
- **Requires:** ${agent.inputRequirements.join(', ')}
- **Provides:** ${agent.outputProvides.join(', ')}
${agent.tools ? `- **Tools:** ${agent.tools.join(', ')}` : ''}
${agent.estimatedDuration ? `- **Est. Duration:** ${agent.estimatedDuration}ms` : ''}
`).join('\n')}

# YOUR TASK

Design an optimal DAG that fulfills the workflow requirements using the available agents.

**Design Process:**
1. Analyze the workflow objective and break it down into steps
2. Review the available agents list above and select suitable agents
3. Determine the optimal sequence and flow between agents
4. Consider parallel execution opportunities where applicable
5. Ensure your design is a valid DAG (acyclic, all nodes reachable from entry)

**Output Format:**
You MUST output a valid JSON object with this exact structure:

\`\`\`json
{
  "id": "unique_dag_id",
  "name": "DAGName",
  "description": "What this DAG does",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node_1",
      "type": "entry",
      "agentName": "UserInput",
      "metadata": {
        "description": "Entry point"
      }
    },
    {
      "id": "node_2",
      "type": "agent",
      "agentName": "AgentName",
      "prompt": "Optional prompt override",
      "metadata": {
        "description": "What this node does"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "from": "node_1",
      "to": "node_2",
      "flowType": "llm_call",
      "metadata": {
        "description": "What flows through this edge"
      }
    }
  ],
  "entryNode": "node_1",
  "exitNodes": ["final_node_id"]
}
\`\`\`

**Flow Types Available:**
- **llm_call**: GenericAgent LLM execution
- **context_pass**: Pass data between agents without execution
- **execute_agents**: CRITICAL - Execute Python agents sequentially (use for frontend-specified agents)
- **sdk_agent**: SDK agent execution (DataProfiler, D3JSDataAnalyzer, etc.)
- **validation**: Validation flow
- **autonomous_decision**: Agent makes internal decision (e.g., D3JSCodeValidator chooses success/error path)

**Node Types:**
- **entry**: Entry point (UserInput)
- **agent**: GenericAgent (LLM-based)
- **sdk_agent**: BaseSDKAgent (Claude SDK)
- **tool_agent**: Tool-calling agent
- **exit**: Exit point (UserOutput)

**CRITICAL REQUIREMENTS:**
1. The DAG must be acyclic (no loops)
2. All nodes must be reachable from the entry node
3. There must be at least one exit node
4. Use appropriate flow types between agents
5. Consider parallel paths where beneficial
6. Output ONLY valid JSON, no explanations outside the JSON
${requirements.agents && requirements.agents.length > 0 ? `
7. **MUST include frontend Python agents with execute_agents flow type**
8. Store frontend agent specs in a node's context so ExecuteAgentsStrategy can access them
` : ''}

${requirements.agents && requirements.agents.length > 0 ? `
**EXAMPLE STRUCTURE FOR FRONTEND AGENTS:**

\`\`\`json
{
  "nodes": [
    {
      "id": "entry",
      "type": "entry",
      "agentName": "UserInput"
    },
    {
      "id": "frontend_agents_executor",
      "type": "agent",
      "agentName": "FrontendAgentsExecutor",
      "metadata": {
        "description": "Executes ${requirements.agents.length} frontend-specified Python agents",
        "frontendAgents": ${JSON.stringify(requirements.agents)}
      }
    },
    {
      "id": "d3_validator",
      "type": "sdk_agent",
      "agentName": "D3JSCodeValidator"
    },
    {
      "id": "exit",
      "type": "exit",
      "agentName": "UserOutput"
    }
  ],
  "edges": [
    {
      "from": "entry",
      "to": "frontend_agents_executor",
      "flowType": "context_pass"
    },
    {
      "from": "frontend_agents_executor",
      "to": "d3_validator",
      "flowType": "execute_agents"
    },
    {
      "from": "d3_validator",
      "to": "exit",
      "flowType": "autonomous_decision"
    }
  ]
}
\`\`\`

The frontendAgents metadata will be read by ExecuteAgentsStrategy to execute each Python agent.
` : ''}

Begin your design process now.`;
    }

    /**
     * Parse DAG definition from agent output
     */
    private parseDAGFromOutput(output: string): DAGDefinition | null {
        try {
            // Extract JSON from output (may be wrapped in markdown code blocks)
            const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                             output.match(/```\s*([\s\S]*?)\s*```/) ||
                             [null, output];

            const jsonStr = jsonMatch[1] || output;
            const dag = JSON.parse(jsonStr.trim());

            // Validate basic structure
            if (!dag.nodes || !dag.edges || !dag.entryNode || !dag.exitNodes) {
                console.error('Invalid DAG structure: missing required fields');
                return null;
            }

            return dag as DAGDefinition;

        } catch (error) {
            console.error('Failed to parse DAG from output:', error);
            console.error('Output was:', output);
            return null;
        }
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
