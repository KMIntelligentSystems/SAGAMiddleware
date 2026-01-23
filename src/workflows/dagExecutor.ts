import { EventEmitter } from 'events';
import { DataProfiler } from '../agents/dataProfiler.js';
import { SimpleDataAnalyzer } from '../agents/simpleDataAnalyzer.js';
import { D3JSCodeValidator } from '../agents/d3jsCodeValidator.js';
import {
    LLMCallStrategy,
    ContextPassStrategy,
    ExecuteAgentsStrategy,
    SDKAgentStrategy,
    ValidationStrategy
} from '../process/flowStrategies.js';


import { AgentPromptArray } from '../agents/promptGeneratorAgent.js'

// Types matching your DAG structure
interface DAGNode {
    id: string;
    type: string;
    agentName: string;
    metadata: Record<string, any>;
}

interface EdgeCondition {
    type: string;
    expression: string;
}

interface DAGEdge {
    id: string;
    from: string;
    to: string;
    flowType: 'llm_call' | 'context_pass' | 'sdk_agent' | 'autonomous_decision';
    condition?: string; // JSON string that needs to be parsed
}

interface DAGDefinition {
    id: string;
    name: string;
    description: string;
    version: string;
    nodes: DAGNode[];
    edges: DAGEdge[];
    entryNode: string;
    exitNodes: string[];
}

interface ExecutionContext {
    [key: string]: any;
}

interface NodeExecutionResult {
    nodeId: string;
    agentName: string;
    agentType: string;
    success: boolean;
    output: any;
    error?: Error;
    timestamp: Date;
    duration: number;
}

interface ExecutionResult {
    dagId: string;
    dagName: string;
    success: boolean;
    startTime: Date;
    endTime: Date;
    duration: number;
    nodeResults: NodeExecutionResult[];
    finalContext: ExecutionContext;
    error?: Error;
}

// Simple executor interface - you provide the implementation
export interface NodeExecutor {
    /**
     * Execute a node - you handle the agent execution logic
     * @param nodeId - The ID of the node
     * @param agentName - The name of the agent to execute
     * @param agentType - Type of agent ('sdk_agent' or 'agent')
     * @param flowType - The type of flow that led to this node
     * @param context - Current execution context
     * @param targetAgents - Array of target agent names (from outgoing edges)
     * @param sourceAgentName - Source agent name for context retrieval
     * @returns Promise with the execution result
     */
    executeNode(
        nodeId: string,
        agentName: string,
        agentType: string,
        flowType: string,
        context: ExecutionContext,
        targetAgents: string[],
        sourceAgentName: string
    ): Promise<any>;
}

/**
 * DAG Executor - handles only the flow control
 */
export class DAGExecutor extends EventEmitter {
    private dag: DAGDefinition;
    private nodeExecutor: NodeExecutor;
    private executionResults: NodeExecutionResult[] = [];
    private context: ExecutionContext = {};
    private executedNodes: Set<string> = new Set();
    private pendingNodes: Map<string, Set<string>> = new Map(); // nodeId -> set of predecessor nodes
    
    constructor(dag: DAGDefinition, nodeExecutor: NodeExecutor) {
        super();
        this.dag = dag;
        this.nodeExecutor = nodeExecutor;
        this.validateDAG();
        this.buildDependencyMap();
    }

    /**
     * Validate DAG structure
     */
    private validateDAG(): void {
        const entryNode = this.dag.nodes.find(n => n.id === this.dag.entryNode);
        if (!entryNode) {
            throw new Error(`Entry node ${this.dag.entryNode} not found`);
        }

        for (const exitNodeId of this.dag.exitNodes) {
            const exitNode = this.dag.nodes.find(n => n.id === exitNodeId);
            if (!exitNode) {
                throw new Error(`Exit node ${exitNodeId} not found`);
            }
        }

        // Validate all edge references
        for (const edge of this.dag.edges) {
            const fromNode = this.dag.nodes.find(n => n.id === edge.from);
            const toNode = this.dag.nodes.find(n => n.id === edge.to);
            
            if (!fromNode) {
                throw new Error(`Edge ${edge.id}: source node ${edge.from} not found`);
            }
            if (!toNode) {
                throw new Error(`Edge ${edge.id}: target node ${edge.to} not found`);
            }
        }
    }

    /**
     * Build dependency map for each node
     */
    private buildDependencyMap(): void {
        for (const node of this.dag.nodes) {
            const incomingEdges = this.getIncomingEdges(node.id);
            const predecessors = new Set(incomingEdges.map(e => e.from));
            this.pendingNodes.set(node.id, predecessors);
        }
    }

    /**
     * Get all outgoing edges from a node
     */
    private getOutgoingEdges(nodeId: string): DAGEdge[] {
        return this.dag.edges.filter(edge => edge.from === nodeId);
    }

    /**
     * Get all incoming edges to a node
     */
    private getIncomingEdges(nodeId: string): DAGEdge[] {
        return this.dag.edges.filter(edge => edge.to === nodeId);
    }

    /**
     * Get node by ID
     */
    private getNode(nodeId: string): DAGNode | undefined {
        return this.dag.nodes.find(n => n.id === nodeId);
    }

    /**
     * Evaluate edge condition based on context
     */
    private evaluateCondition(edge: DAGEdge, context: ExecutionContext): boolean {
        if (!edge.condition) return true;

        try {
            const conditionObj: EdgeCondition = JSON.parse(edge.condition);
            const expression = conditionObj.expression;

            // Simple evaluation - check for success patterns
            if (expression.includes('success === true') || expression.includes('success==true')) {
                return context.success === true || context.lastNodeOutput?.success === true;
            } else if (expression.includes('success === false') || expression.includes('success==false')) {
                return context.success === false || context.lastNodeOutput?.success === false;
            }

            // For more complex expressions, you can extend this
            console.warn(`Complex condition detected: ${expression}, defaulting to true`);
            return true;
        } catch (error) {
            console.warn(`Failed to evaluate condition for edge ${edge.id}:`, error);
            return true;
        }
    }

    /**
     * Get edges to follow from current node based on flow type and conditions
     */
    private getNextEdges(currentNodeId: string): DAGEdge[] {
        const outgoingEdges = this.getOutgoingEdges(currentNodeId);
        const validEdges: DAGEdge[] = [];

        for (const edge of outgoingEdges) {
            // For autonomous_decision, evaluate condition
            if (edge.flowType === 'autonomous_decision') {
                if (this.evaluateCondition(edge, this.context)) {
                    validEdges.push(edge);
                }
            } else {
                // For other flow types, always include
                validEdges.push(edge);
            }
        }

        return validEdges;
    }

    /**
     * Check if all required predecessors of a node have been executed
     */
    private canExecuteNode(nodeId: string): boolean {
        const predecessors = this.pendingNodes.get(nodeId);
        if (!predecessors || predecessors.size === 0) return true;

        // Check if all predecessors are executed
        for (const pred of predecessors) {
            if (!this.executedNodes.has(pred)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get target agent names from outgoing edges
     */
    private getTargetAgentsForNode(nodeId: string): string[] {
        const outgoingEdges = this.getOutgoingEdges(nodeId);
        return outgoingEdges.map(edge => {
            const targetNode = this.dag.nodes.find(n => n.id === edge.to);
            return targetNode?.agentName || edge.to;
        });
    }

    /**
     * Execute a single node
     */
    private async executeNodeInternal(nodeId: string, incomingFlowType: string): Promise<NodeExecutionResult> {
        // Skip if already executed
        if (this.executedNodes.has(nodeId)) {
            const existingResult = this.executionResults.find(r => r.nodeId === nodeId);
            if (existingResult) {
                return existingResult;
            }
        }

        const node = this.getNode(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }

        this.emit('nodeStart', {
            nodeId,
            agentName: node.agentName,
            agentType: node.type,
            flowType: incomingFlowType
        });

        const startTime = Date.now();

        try {
            // Get source agent name from previous node
            const sourceNodeId = this.context.lastExecutedNode || nodeId;
            const sourceNode = this.getNode(sourceNodeId);
            const sourceAgentName = sourceNode?.agentName || sourceNodeId;

            // Get target agents from outgoing edges
            const targetAgents = this.getTargetAgentsForNode(nodeId);

            // Call the external executor - it handles the actual agent execution
            const output = await this.nodeExecutor.executeNode(
                nodeId,
                node.agentName,
                node.type,
                incomingFlowType,
                this.context,
                targetAgents,
                sourceAgentName
            );
            
            const duration = Date.now() - startTime;

            // Update context with node output
            this.context[nodeId] = output;
            this.context.lastNodeOutput = output;
            this.context.lastExecutedNode = nodeId;
            
            // Merge output into context if it's an object
            if (output && typeof output === 'object') {
                this.context = { ...this.context, ...output };
            }

            const result: NodeExecutionResult = {
                nodeId,
                agentName: node.agentName,
                agentType: node.type,
                success: true,
                output,
                timestamp: new Date(),
                duration
            };

            this.executedNodes.add(nodeId);
            this.executionResults.push(result);
            
            this.emit('nodeComplete', { 
                nodeId, 
                agentName: node.agentName,
                agentType: node.type,
                flowType: incomingFlowType,
                duration,
                output 
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            const result: NodeExecutionResult = {
                nodeId,
                agentName: node.agentName,
                agentType: node.type,
                success: false,
                output: null,
                error: error as Error,
                timestamp: new Date(),
                duration
            };

            this.executedNodes.add(nodeId);
            this.executionResults.push(result);
            
            this.emit('nodeError', { 
                nodeId, 
                agentName: node.agentName,
                agentType: node.type,
                flowType: incomingFlowType,
                error,
                duration
            });

            throw error;
        }
    }

    /**
     * Process a node and its downstream path
     */
    private async processNode(nodeId: string, incomingFlowType: string): Promise<void> {
        console.log('PROCESS NODE ', nodeId)
        console.log('INCOMING ',incomingFlowType)
        // Check if node can be executed (all predecessors done)
        if (!this.canExecuteNode(nodeId)) {
            return; // Will be executed later when all predecessors are done
        }

        // Skip if already executed
        if (this.executedNodes.has(nodeId)) {
            return;
        }

        // Execute the node
        await this.executeNodeInternal(nodeId, incomingFlowType);

        // If this is an exit node, we're done with this path
        if (this.dag.exitNodes.includes(nodeId)) {
            return;
        }

        // Get next edges based on flow type and conditions
        const nextEdges = this.getNextEdges(nodeId);

        if (nextEdges.length === 0) {
            return; // Dead end
        }

        if (nextEdges.length === 1) {
            // Sequential execution
            const edge = nextEdges[0];
            await this.processNode(edge.to, edge.flowType);
        } else {
            // Parallel execution - multiple outgoing edges
            await this.executeParallelBranches(nextEdges);
        }
    }

    /**
     * Execute parallel branches
     */
    private async executeParallelBranches(edges: DAGEdge[]): Promise<void> {
        const branchNodes = edges.map(e => e.to);
        
        this.emit('parallelStart', { 
            branches: edges.map(e => ({
                from: e.from,
                to: e.to,
                flowType: e.flowType
            }))
        });

        // Execute all branches in parallel
        const branchPromises = edges.map(edge => 
            this.executeBranch(edge.to, edge.flowType)
        );

        await Promise.all(branchPromises);

        this.emit('parallelComplete', { nodeIds: branchNodes });

        // After parallel branches complete, find and execute convergence point
        await this.executeConvergencePoint(branchNodes);
    }

    /**
     * Execute a single branch (may contain multiple sequential nodes)
     */
    private async executeBranch(startNodeId: string, incomingFlowType: string): Promise<void> {
        let currentNodeId = startNodeId;
        let currentFlowType = incomingFlowType;

        while (currentNodeId) {
            // Check if we can execute this node
            if (!this.canExecuteNode(currentNodeId)) {
                break; // Wait for other branches to complete
            }

            // Skip if already executed
            if (this.executedNodes.has(currentNodeId)) {
                break;
            }

            // Execute the node
            await this.executeNodeInternal(currentNodeId, currentFlowType);

            // Get next edges
            const nextEdges = this.getNextEdges(currentNodeId);

            if (nextEdges.length === 0) {
                break; // End of branch
            }

            if (nextEdges.length === 1) {
                // Continue in this branch
                const edge = nextEdges[0];
                currentNodeId = edge.to;
                currentFlowType = edge.flowType;

                // Check if this node has multiple incoming edges (convergence point)
                const incomingEdges = this.getIncomingEdges(currentNodeId);
                if (incomingEdges.length > 1) {
                    // This is a convergence point, stop here
                    break;
                }
            } else {
                // Nested parallel branches - handle recursively
                await this.executeParallelBranches(nextEdges);
                break;
            }
        }
    }

    /**
     * Find and execute the convergence point where parallel branches meet
     */
    private async executeConvergencePoint(branchNodes: string[]): Promise<void> {
        // Find nodes that have all branch nodes as predecessors
        const convergenceNodes = new Set<string>();

        for (const node of this.dag.nodes) {
            if (this.executedNodes.has(node.id)) continue;

            const incomingEdges = this.getIncomingEdges(node.id);
            const predecessors = new Set(incomingEdges.map(e => e.from));

            // Check if this node has edges from all branch nodes (or their descendants)
            let hasAllBranches = true;
            for (const branchNode of branchNodes) {
                if (!this.isAncestor(branchNode, node.id)) {
                    hasAllBranches = false;
                    break;
                }
            }

            if (hasAllBranches && this.canExecuteNode(node.id)) {
                convergenceNodes.add(node.id);
            }
        }

        // Execute convergence nodes
        for (const nodeId of convergenceNodes) {
            const incomingEdges = this.getIncomingEdges(nodeId);
            const flowType = incomingEdges[0]?.flowType || 'context_pass';
            await this.processNode(nodeId, flowType);
        }
    }

    /**
     * Check if ancestorId is an ancestor of descendantId
     */
    private isAncestor(ancestorId: string, descendantId: string): boolean {
        const visited = new Set<string>();
        const queue: string[] = [ancestorId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === descendantId) return true;
            if (visited.has(current)) continue;
            visited.add(current);

            const outgoingEdges = this.getOutgoingEdges(current);
            for (const edge of outgoingEdges) {
                queue.push(edge.to);
            }
        }

        return false;
    }

    /**
     * Execute the entire DAG
     */
    async execute(initialContext: ExecutionContext = {}): Promise<ExecutionResult> {
        const startTime = new Date();
        this.context = { ...initialContext };
        this.executionResults = [];
        this.executedNodes.clear();

        this.emit('executionStart', { 
            dagId: this.dag.id, 
            dagName: this.dag.name,
            version: this.dag.version
        });

        try {
            // Start from entry node
            await this.processNode(this.dag.entryNode, 'context_pass');

            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();

            const result: ExecutionResult = {
                dagId: this.dag.id,
                dagName: this.dag.name,
                success: true,
                startTime,
                endTime,
                duration,
                nodeResults: this.executionResults,
                finalContext: this.context
            };

            this.emit('executionComplete', result);

            return result;
        } catch (error) {
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();

            const result: ExecutionResult = {
                dagId: this.dag.id,
                dagName: this.dag.name,
                success: false,
                startTime,
                endTime,
                duration,
                nodeResults: this.executionResults,
                finalContext: this.context,
                error: error as Error
            };

            this.emit('executionError', result);

            return result;
        }
    }

    /**
     * Get execution statistics
     */
    getStatistics() {
        const totalNodes = this.executionResults.length;
        const successfulNodes = this.executionResults.filter(r => r.success).length;
        const failedNodes = this.executionResults.filter(r => !r.success).length;
        const totalDuration = this.executionResults.reduce((sum, r) => sum + r.duration, 0);
        const avgDuration = totalNodes > 0 ? totalDuration / totalNodes : 0;

        const sdkAgents = this.executionResults.filter(r => r.agentType === 'sdk_agent').length;
        const regularAgents = this.executionResults.filter(r => r.agentType === 'agent').length;

        return {
            totalNodes,
            successfulNodes,
            failedNodes,
            successRate: totalNodes > 0 ? (successfulNodes / totalNodes) * 100 : 0,
            totalDuration,
            avgDuration,
            sdkAgents,
            regularAgents,
            nodeBreakdown: this.executionResults.map(r => ({
                nodeId: r.nodeId,
                agentName: r.agentName,
                agentType: r.agentType,
                duration: r.duration,
                success: r.success
            }))
        };
    }

    /**
     * Get execution path
     */
    getExecutionPath(): string[] {
        return this.executionResults
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .map(r => `${r.nodeId} (${r.agentName})`);
    }
}

/**
 * Example implementation of NodeExecutor
 */
export class ExampleNodeExecutor implements NodeExecutor {
    async executeNode(
        nodeId: string,
        agentName: string,
        agentType: string,
        flowType: string,
        context: ExecutionContext,
        targetAgents: string[],
        sourceAgentName: string
    ): Promise<any> {
        console.log(`  Executing: ${agentName} [${agentType}] via ${flowType}`);

        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 100));

        // Your actual agent execution logic goes here
        // This is just a placeholder that returns mock data

        if (agentType === 'sdk_agent') {
            return {
                success: true,
                data: `Output from SDK agent: ${agentName}`,
                type: 'sdk_agent'
            };
        } else if (agentType === 'agent') {
            return {
                success: Math.random() > 0.1, // 90% success rate
                data: `Output from agent: ${agentName}`,
                type: 'agent'
            };
        } else if (agentType === 'entry' || agentType === 'exit') {
            return context;
        }

        return { success: true, data: `Output from ${agentName}` };
    }
}

/**
 * Strategy-based NodeExecutor implementation
 * Integrates with FlowStrategies from flowStrategies.ts
 */
export class StrategyBasedNodeExecutor implements NodeExecutor {
    private coordinator: any; // SagaCoordinator
    private strategyMap: Map<string, any>;
    private prompts: any; // AgentPromptArray

    constructor(coordinator: any, prompts?: any) {
        this.coordinator = coordinator;
        this.prompts = prompts;

        // Map agentType to strategies (not flowType!)
        // agentType determines which strategy to use for execution
        this.strategyMap = new Map([
            ['agent', LLMCallStrategy],              // GenericAgents use LLM calls
            ['sdk_agent', SDKAgentStrategy],         // SDK agents use SDK strategy
            ['entry', ContextPassStrategy],          // Entry nodes just pass context
            ['exit', ContextPassStrategy],           // Exit nodes just pass context
            ['execute_agents', ExecuteAgentsStrategy] // Special case for DataProfiler workflow
        ]);
    }

    async executeNode(
        nodeId: string,
        agentName: string,
        agentType: string,
        flowType: string,
        context: ExecutionContext,
        targetAgents: string[],
        sourceAgentName: string
    ): Promise<any> {
        console.log(`\n▶️  Executing Node: ${nodeId} (${agentName})`);
        console.log(`   Type: ${agentType}, FlowType: ${flowType}`);
        console.log(`   Targets: ${targetAgents.join(', ')}, Source: ${sourceAgentName}`);

        // Handle entry/exit nodes
        if (agentType === 'entry') {
            const conversationCtx = this.coordinator.contextManager.getContext('ConversationAgent');
            if (agentName !== 'ConversationAgent') {
                this.coordinator.contextManager.updateContext(agentName, {
                    lastTransactionResult: conversationCtx.lastTransactionResult,
                    userQuery: conversationCtx.userQuery
                });
            }
            return context;
        }

        if (agentType === 'exit') {
            console.log(`🏁 Reached exit node: ${nodeId}`);
            return context;
        }

        // Get the strategy based on current node's agentType
        const strategy = this.strategyMap.get(agentType);
        if (!strategy) {
            throw new Error(`No strategy found for agentType: ${agentType}`);
        }

        // Get or instantiate the CURRENT node's agent
        let agent: any;
        if (agentType === 'sdk_agent') {
            agent = this.instantiateSDKAgent(agentName);
        } else if (agentType === 'agent') {
            agent = this.coordinator.agents.get(agentName);
            if (!agent) {
                throw new Error(`GenericAgent not found in registry: ${agentName}`);
            }
        } else {
            // For special cases like context_pass
            agent = {
                getName: () => agentName
            };
        }

        // Execute using strategy
        const result = await strategy.execute(
            agent,
            targetAgents,
            this.coordinator.contextManager,
            sourceAgentName,
            context.userQuery,
            this.coordinator.agents,
            {},
            this.prompts
        );

        return {
            success: result.success,
            data: result.result,
            agentName: result.agentName
        };
    }

    private instantiateSDKAgent(agentName: string): any {
        const contextManager = this.coordinator.contextManager;

        switch (agentName) {
            case 'DataProfiler':
                return new DataProfiler(contextManager);
            case 'SimpleDataAnalyzer':
                return new SimpleDataAnalyzer(contextManager);
            case 'D3JSCodeValidator':
                return new D3JSCodeValidator(contextManager, this.coordinator);
            default:
                throw new Error(`Unknown SDK agent: ${agentName}`);
        }
    }
}

/**
 * Usage Example
 */
export async function main() {
    const dagDefinition: DAGDefinition = {
        "id": "medical-viz-dag-v1",
        "name": "Medical Visualization Dashboard",
        "description": "Creates comprehensive medical visualization dashboard from endoscopic trials CSV data",
        "version": "1.0.0",
        "nodes": [
            { "id": "entry", "type": "entry", "agentName": "ConversationAgent", "metadata": {} },
            { "id": "csv-reader", "type": "sdk_agent", "agentName": "SimpleDataAnalyzer", "metadata": {} },
            { "id": "doc-builder", "type": "agent", "agentName": "DocumentBuildingAgent", "metadata": {} },
            { "id": "report-writer", "type": "agent", "agentName": "ReportWritingAgent", "metadata": {} },
            { "id": "meta-viz", "type": "agent", "agentName": "D3JSCodingAgent", "metadata": {} },
            { "id": "meta-viz-validator", "type": "sdk_agent", "agentName": "D3JSCodeValidator", "metadata": {} },
            { "id": "meta-viz-retry", "type": "agent", "agentName": "D3JSCodingAgent", "metadata": {} },
            { "id": "needle-analyzer", "type": "sdk_agent", "agentName": "SimpleDataAnalyzer", "metadata": {} },
            { "id": "needle-viz", "type": "agent", "agentName": "D3JSCodingAgent", "metadata": {} },
            { "id": "needle-viz-validator", "type": "sdk_agent", "agentName": "D3JSCodeValidator", "metadata": {} },
            { "id": "needle-viz-retry", "type": "agent", "agentName": "D3JSCodingAgent", "metadata": {} },
            { "id": "html-builder", "type": "agent", "agentName": "HTMLLayoutDesignAgent", "metadata": {} },
            { "id": "html-validator", "type": "agent", "agentName": "ValidatingAgent", "metadata": {} },
            { "id": "conversation-final", "type": "agent", "agentName": "ConversationAgent", "metadata": {} },
            { "id": "exit", "type": "exit", "agentName": "exit", "metadata": {} }
        ],
        "edges": [
            { "id": "edge-1", "from": "entry", "to": "csv-reader", "flowType": "context_pass" },
            { "id": "edge-2", "from": "csv-reader", "to": "doc-builder", "flowType": "sdk_agent" },
            { "id": "edge-3a", "from": "doc-builder", "to": "report-writer", "flowType": "llm_call" },
            { "id": "edge-3b", "from": "doc-builder", "to": "meta-viz", "flowType": "llm_call" },
            { "id": "edge-3c", "from": "doc-builder", "to": "needle-analyzer", "flowType": "llm_call" },
            { "id": "edge-4", "from": "meta-viz", "to": "meta-viz-validator", "flowType": "llm_call" },
            { "id": "edge-5a", "from": "meta-viz-validator", "to": "html-builder", "flowType": "autonomous_decision", "condition": "{\"type\":\"result\",\"expression\":\"success === true\"}" },
            { "id": "edge-5b", "from": "meta-viz-validator", "to": "meta-viz-retry", "flowType": "autonomous_decision", "condition": "{\"type\":\"result\",\"expression\":\"success === false\"}" },
            { "id": "edge-6", "from": "meta-viz-retry", "to": "html-builder", "flowType": "llm_call" },
            { "id": "edge-7", "from": "needle-analyzer", "to": "needle-viz", "flowType": "sdk_agent" },
            { "id": "edge-8", "from": "needle-viz", "to": "needle-viz-validator", "flowType": "llm_call" },
            { "id": "edge-9a", "from": "needle-viz-validator", "to": "html-builder", "flowType": "autonomous_decision", "condition": "{\"type\":\"result\",\"expression\":\"success === true\"}" },
            { "id": "edge-9b", "from": "needle-viz-validator", "to": "needle-viz-retry", "flowType": "autonomous_decision", "condition": "{\"type\":\"result\",\"expression\":\"success === false\"}" },
            { "id": "edge-10", "from": "needle-viz-retry", "to": "html-builder", "flowType": "llm_call" },
            { "id": "edge-11", "from": "report-writer", "to": "html-builder", "flowType": "llm_call" },
            { "id": "edge-12", "from": "html-builder", "to": "html-validator", "flowType": "llm_call" },
            { "id": "edge-13", "from": "html-validator", "to": "conversation-final", "flowType": "llm_call" },
            { "id": "edge-14", "from": "conversation-final", "to": "exit", "flowType": "context_pass" }
        ],
        "entryNode": "entry",
        "exitNodes": ["exit"]
    };

    // Create your node executor implementation
    const nodeExecutor = new ExampleNodeExecutor();

    // Create DAG executor
    const executor = new DAGExecutor(dagDefinition, nodeExecutor);

    // Listen to events
    executor.on('executionStart', (data) => {
        console.log(`\nStarting: ${data.dagName} v${data.version}`);
        console.log('='.repeat(60));
    });

    executor.on('nodeStart', (data) => {
        console.log(`\n[${data.nodeId}] ${data.agentName} (${data.agentType}) via ${data.flowType}`);
    });

    executor.on('nodeComplete', (data) => {
        console.log(`  ✓ Completed in ${data.duration}ms`);
    });

    executor.on('parallelStart', (data) => {
        console.log(`\n⚡ Parallel execution starting:`);
        data.branches.forEach((b: any) => {
            console.log(`   ${b.from} → ${b.to} [${b.flowType}]`);
        });
    });

    executor.on('parallelComplete', () => {
        console.log(`⚡ Parallel branches completed\n`);
    });

    // Execute
    const result = await executor.execute({ source: 'test' });

    console.log('\n' + '='.repeat(60));
    console.log('Execution Statistics:');
    const stats = executor.getStatistics();
    console.log(`  Total Nodes: ${stats.totalNodes}`);
    console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`  SDK Agents: ${stats.sdkAgents}`);
    console.log(`  Regular Agents: ${stats.regularAgents}`);
    console.log(`  Duration: ${stats.totalDuration}ms`);

    console.log('\nExecution Path:');
    executor.getExecutionPath().forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
    });

    return result;
}

// Run main when executed directly
main().catch(console.error);