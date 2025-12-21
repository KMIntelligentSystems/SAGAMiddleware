/**
 * Agent Registry Utilities
 *
 * Extract and format agent information for DAG Designer
 */

import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AvailableAgent } from '../types/dag.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { BaseSDKAgent } from '../agents/baseSDKAgent.js';

/**
 * Extract available agents from coordinator
 */
export function extractAvailableAgents(coordinator: SagaCoordinator): AvailableAgent[] {
    const availableAgents: AvailableAgent[] = [];

    // Iterate through registered agents
    coordinator.agents.forEach((agent, name) => {
        const agentInfo = buildAgentInfo(name, agent);
        if (agentInfo) {
            availableAgents.push(agentInfo);
        }
    });

    console.log('AVAILABLE AGENTS', availableAgents)

    return availableAgents;
}

/**
 * Build agent info from agent instance
 */
function buildAgentInfo(name: string, agent: any): AvailableAgent | null {
    // Determine agent type
    let type: 'generic' | 'sdk' | 'tool' = 'generic';
    if (agent instanceof BaseSDKAgent) {
        type = 'sdk';
    } else if (agent instanceof GenericAgent) {
        const definition = (agent as any).definition;
        if (definition?.agentType === 'tool') {
            type = 'tool';
        } else {
            type = 'generic';
        }
    }

    // Build agent info based on known agents
    const agentInfo = AGENT_CATALOG[name];

    if (agentInfo) {
        return {
            name,
            type,
            ...agentInfo
        };
    }

    // Fallback: basic info
    return {
        name,
        type,
        description: `Agent: ${name}`,
        capabilities: ['general_processing'],
        inputRequirements: ['context'],
        outputProvides: ['result']
    };
}

/**
 * Agent Catalog - Detailed information about each agent
 * This serves as a knowledge base for the DAG Designer
 */
const AGENT_CATALOG: Record<string, Omit<AvailableAgent, 'name' | 'type'>> = {
    // Entry/Exit Agents
    'UserInput': {
        description: 'Entry point that receives user input/query',
        capabilities: ['user_input', 'query_parsing'],
        inputRequirements: [],
        outputProvides: ['user_query', 'user_requirements']
    },

    'UserOutput': {
        description: 'Exit point that delivers final results to user',
        capabilities: ['user_output', 'result_formatting'],
        inputRequirements: ['final_result'],
        outputProvides: []
    },

    'ConversationAgent': {
        description: 'Terminal agent that returns results to user and terminates process',
        capabilities: ['user_communication', 'result_delivery', 'conversation_management'],
        inputRequirements: ['validated_code', 'corrected_code', 'final_output'],
        outputProvides: ['user_output'],
        estimatedDuration: 500
    },

    // Data Analysis Agents
    'TransactionGroupingAgent': {
        description: 'Extracts and groups user requirements, particularly visualization specs',
        capabilities: ['requirement_extraction', 'query_parsing', 'json_formatting'],
        inputRequirements: ['user_query'],
        outputProvides: ['parsed_requirements', 'visualization_spec'],
        estimatedDuration: 2000
    },

    'DataProfiler': {
        description: 'SDK agent that analyzes CSV data and generates [AGENT:...] definitions with Python code',
        capabilities: ['csv_analysis', 'data_profiling', 'agent_generation', 'python_code_generation'],
        inputRequirements: ['csv_file_path', 'data_requirements'],
        outputProvides: ['[AGENT:...]', 'agent_definitions', 'python_analysis_code'],
        tools: ['data_analysis', 'statistical_profiling'],
        estimatedDuration: 5000
    },

    'D3JSDataAnalyzer': {
        description: 'SDK agent that performs D3-specific data analysis for visualization',
        capabilities: ['d3_data_analysis', 'visualization_planning', 'csv_analysis'],
        inputRequirements: ['csv_file_path', 'visualization_requirements'],
        outputProvides: ['d3_data_analysis', 'visualization_config'],
        tools: ['csv_reader', 'data_inspector'],
        estimatedDuration: 4000
    },

    // Code Generation Agents
    'D3JSCoordinatingAgent': {
        description: 'Synthesizes Python analysis results and coordinates D3 code generation',
        capabilities: ['result_synthesis', 'analysis_interpretation', 'coordination'],
        inputRequirements: ['python_analysis', 'data_analysis', 'user_requirements'],
        outputProvides: ['synthesized_analysis', 'code_generation_plan'],
        estimatedDuration: 3000
    },

    'D3JSCodingAgent': {
        description: 'Generates D3.js visualization code (HTML/JavaScript)',
        capabilities: ['d3_code_generation', 'html_generation', 'javascript_coding', 'code_correction'],
        inputRequirements: ['analysis_results', 'visualization_requirements', 'validation_errors?'],
        outputProvides: ['d3_html_code', 'corrected_code'],
        estimatedDuration: 8000
    },

    // Validation Agents
    'ValidatingAgent': {
        description: 'Stores original D3 code for validation comparison',
        capabilities: ['code_storage', 'context_preservation'],
        inputRequirements: ['d3_code'],
        outputProvides: ['stored_code'],
        estimatedDuration: 100
    },

    'D3JSCodeValidator': {
        description: 'SDK agent that validates D3 code via Playwright and makes AUTONOMOUS decisions (trigger_conversation or trigger_code_correction)',
        capabilities: [
            'd3_validation',
            'playwright_rendering',
            'svg_analysis',
            'autonomous_decision_making',
            'error_detection'
        ],
        inputRequirements: ['d3_code', 'python_analysis', 'user_requirements'],
        outputProvides: ['validation_report', 'autonomous_action'],
        tools: ['analyze_d3_output', 'trigger_conversation', 'trigger_code_correction'],
        estimatedDuration: 10000
    },

    'D3JSCodeUpdater': {
        description: 'Updates D3 code based on validation feedback or user comments',
        capabilities: ['code_correction', 'd3_code_update', 'error_fixing'],
        inputRequirements: ['existing_code', 'validation_report', 'user_comment'],
        outputProvides: ['updated_code'],
        tools: ['read_analysis'],
        estimatedDuration: 8000
    },

    // Tool Agents
    'ToolCallingAgent': {
        description: 'Executes Python code via MCP server',
        capabilities: ['python_execution', 'mcp_tool_calling', 'code_execution'],
        inputRequirements: ['python_code'],
        outputProvides: ['execution_result', 'python_output'],
        tools: ['execute_python'],
        estimatedDuration: 3000
    },

    // Structure Generation
    'AgentStructureGenerator': {
        description: 'SDK agent that generates agent structures and workflow plans',
        capabilities: ['agent_structure_generation', 'workflow_planning'],
        inputRequirements: ['user_requirements', 'data_analysis'],
        outputProvides: ['agent_structures', 'workflow_plan'],
        estimatedDuration: 5000
    },

    // DAG Designer
    'DAGDesigner': {
        description: 'SDK agent that autonomously designs DAG workflows based on requirements and available agents',
        capabilities: [
            'dag_design',
            'workflow_optimization',
            'agent_selection',
            'flow_planning',
            'autonomous_architecture'
        ],
        inputRequirements: ['workflow_requirements', 'available_agents'],
        outputProvides: ['dag_definition', 'execution_plan'],
        tools: ['query_agent_capabilities', 'find_agents_by_capability', 'suggest_flow_type', 'validate_dag_design'],
        estimatedDuration: 15000
    }
};

/**
 * Get agent info by name
 */
export function getAgentInfo(agentName: string): AvailableAgent | null {
    const catalogEntry = AGENT_CATALOG[agentName];
    if (!catalogEntry) {
        return null;
    }

    // Determine type based on known SDK agents
    const sdkAgents = [
        'DataProfiler',
        'D3JSDataAnalyzer',
        'D3JSCodeValidator',
        'D3JSCodeUpdater',
        'AgentStructureGenerator',
        'DAGDesigner'
    ];

    const type = sdkAgents.includes(agentName) ? 'sdk' :
                 agentName === 'ToolCallingAgent' ? 'tool' :
                 'generic';

    return {
        name: agentName,
        type,
        ...catalogEntry
    };
}

/**
 * Get all agents with a specific capability
 */
export function findAgentsByCapability(
    coordinator: SagaCoordinator,
    capability: string
): AvailableAgent[] {
    const allAgents = extractAvailableAgents(coordinator);

    return allAgents.filter(agent =>
        agent.capabilities.some(cap =>
            cap.toLowerCase().includes(capability.toLowerCase())
        )
    );
}

/**
 * Export agent catalog as markdown documentation
 */
export function exportAgentCatalogMarkdown(): string {
    let md = '# Agent Catalog\n\n';
    md += 'Comprehensive list of available agents and their capabilities.\n\n';

    Object.entries(AGENT_CATALOG).forEach(([name, info]) => {
        md += `## ${name}\n\n`;
        md += `**Description:** ${info.description}\n\n`;
        md += `**Capabilities:**\n`;
        info.capabilities.forEach(cap => md += `- ${cap}\n`);
        md += `\n**Input Requirements:**\n`;
        info.inputRequirements.forEach(req => md += `- ${req}\n`);
        md += `\n**Output Provides:**\n`;
        info.outputProvides.forEach(out => md += `- ${out}\n`);

        if (info.tools && info.tools.length > 0) {
            md += `\n**Tools:**\n`;
            info.tools.forEach(tool => md += `- ${tool}\n`);
        }

        if (info.estimatedDuration) {
            md += `\n**Estimated Duration:** ${info.estimatedDuration}ms\n`;
        }

        md += '\n---\n\n';
    });

    return md;
}
