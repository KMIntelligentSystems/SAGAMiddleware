/**
 * DAG (Directed Acyclic Graph) Type Definitions
 *
 * Explicit graph structure for agent orchestration
 */

export type FlowType =
    | 'llm_call'           // GenericAgent LLM execution
    | 'context_pass'       // Pass data between agents
    | 'execute_agents'     // Execute tool agents via MCP
    | 'sdk_agent'          // Execute SDK agent
    | 'validation'         // Validation flow
    | 'autonomous_decision'; // Agent makes internal decision

export type NodeType =
    | 'agent'              // GenericAgent (LLM-based)
    | 'sdk_agent'          // BaseSDKAgent (Claude SDK agent)
    | 'tool_agent'         // Tool-calling agent
    | 'entry'              // Entry point
    | 'exit';              // Exit point

/**
 * DAG Node - Represents an agent in the graph
 */
export interface DAGNode {
    id: string;                    // Unique node identifier (e.g., "node_1", "d3_validator")
    type: NodeType;                // Type of node
    agentName: string;             // Agent name from registry
    prompt?: string;               // Optional prompt override

    // SDK Agent step configuration (for sdk_agent nodes)
    stepConfig?: {
        transactionType?: string;  // For SDK agents (DataProfiler, D3JSCodeGenerator, etc.)
        processConfig?: {
            processType: string;   // 'agent' | 'subAgent'
            isExecutable: boolean;
            prompts: { agent: string; prompt: string }[];
            renderVisualization?: boolean;
            testWithPlaywright?: boolean;
        };
    };

    metadata?: {
        description?: string;
        tags?: string[];
        estimatedDuration?: number; // Estimated execution time in ms
    };
}

/**
 * DAG Edge - Represents flow between agents
 */
export interface DAGEdge {
    id: string;                    // Unique edge identifier
    from: string;                  // Source node ID
    to: string;                    // Target node ID
    flowType: FlowType;            // Type of flow strategy to use
    condition?: {
        type: 'result' | 'context' | 'custom';
        expression: string;        // Conditional expression (e.g., "validation_passed")
    };

    // Execution hints
    executionHint?: 'sequential' | 'parallel';  // Hint for parallel vs sequential execution
    priority?: number;                          // Execution priority (higher = first)

    metadata?: {
        description?: string;
        weight?: number;           // Edge weight for optimization
        promptOverride?: string;   // Optional prompt override for this edge
    };
}

/**
 * DAG Definition - Complete graph structure
 */
export interface DAGDefinition {
    id: string;                    // Unique DAG identifier
    name: string;                  // Human-readable name
    description: string;           // DAG purpose
    version: string;               // Semantic version (e.g., "1.0.0")

    nodes: DAGNode[];              // All nodes in the graph
    edges: DAGEdge[];              // All edges in the graph

    entryNode: string;             // Starting node ID
    exitNodes: string[];           // Terminal node IDs (can be multiple)

    metadata?: {
        author?: string;
        created?: Date;
        tags?: string[];
        complexity?: DAGComplexity;
    };
}

/**
 * DAG Complexity Metrics
 */
export interface DAGComplexity {
    nodeCount: number;
    edgeCount: number;
    maxDepth: number;              // Longest path from entry to exit
    branchingFactor: number;       // Average outgoing edges per node
    parallelPaths: number;         // Number of parallel execution paths
    cyclomaticComplexity: number;  // Measure of decision complexity
}

/**
 * DAG Validation Result
 */
export interface DAGValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    metrics?: DAGComplexity;
}

/**
 * Available Agent Info - For DAG Designer
 */
export interface AvailableAgent {
    name: string;
    type: 'generic' | 'sdk' | 'tool';
    description: string;
    capabilities: string[];        // What the agent can do
    inputRequirements: string[];   // What context/data it needs
    outputProvides: string[];      // What it produces
    estimatedDuration?: number;    // Average execution time
    tools?: string[];              // Available tools (for SDK agents)
}

/**
 * Workflow Requirements - Input to DAG Designer
 */
export interface WorkflowRequirements {
    objective: string;             // High-level goal (e.g., "Create D3 histogram from CSV")
    inputData: {
        type: string;              // Data type (e.g., "csv_file", "user_query")
        source: string;            // Source location or description
        schema?: any;              // Optional data schema
    };
    outputExpectation: {
        type: string;              // Expected output type (e.g., "html_visualization")
        format?: string;           // Output format details
        quality?: string[];        // Quality requirements (e.g., ["validated", "optimized"])
    };
    agents?: FrontendAgentSpec[];  // Optional: Frontend-specified Python agents for DataProfiler
    constraints?: {
        maxExecutionTime?: number;
        mustIncludeAgents?: string[];  // Required agents
        mustExcludeAgents?: string[];  // Forbidden agents
        parallelismAllowed?: boolean;
        executionOrder?: 'sequential' | 'parallel'; // Optional execution order hint
    };
}

/**
 * Frontend Agent Specification
 * Detailed agent specifications from frontend Claude for Python execution
 */
export interface FrontendAgentSpec {
    name: string;                  // Agent name (e.g., "DataProfiler", "HistogramParametersOptimizer")
    agentType: 'python_coding' | 'functional' | string;  // Agent type (python_coding for code execution, functional for LLM-based)
    task: string;                  // Detailed task description (will be converted to Python code)
    inputFrom: string | null;      // Name of previous agent or null for first agent
    outputSchema?: any;            // Expected output structure
}

/**
 * DAG Design Result - Output from DAG Designer
 */
export interface DAGDesignResult {
    success: boolean;
    dag?: DAGDefinition;
    reasoning: string;             // Explanation of design decisions
    alternatives?: {
        description: string;
        tradeoffs: string;
    }[];
    warnings?: string[];
}
