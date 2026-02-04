import { EventEmitter } from 'events';
import { DataProfiler } from '../agents/dataProfiler.js';
import { SimpleDataAnalyzer } from '../agents/simpleDataAnalyzer.js';
import { D3JSCodeValidator } from '../agents/d3jsCodeValidator.js';
import { GenericAgent } from '../agents/genericAgent.js';
import {
    LLMCallStrategy,
    ContextPassStrategy,
    ExecuteAgentsStrategy,
    SDKAgentStrategy,
    ValidationStrategy
} from '../process/flowStrategies.js';

import { AgentPromptArray } from '../agents/promptGeneratorAgent.js'

/**
 * Clean context data by removing redundant metadata and normalizing strings
 * Preserves all actual data content needed for agent reasoning
 */
function cleanContextData(data: any): any {
    if (!data || typeof data !== 'object') {
        // Clean strings: detect and parse JSON strings, then normalize
        if (typeof data === 'string') {
            // Try to detect and parse JSON-stringified data
            let parsed = data;
            if ((data.startsWith('{') && data.endsWith('}')) ||
                (data.startsWith('[') && data.endsWith(']')) ||
                (data.startsWith('"') && data.endsWith('"'))) {
                try {
                    parsed = JSON.parse(data);
                    // If parsed successfully and it's a string, recursively clean it
                    if (typeof parsed === 'string') {
                        return cleanContextData(parsed);
                    }
                    // If it's an object or array, recursively clean it
                    if (typeof parsed === 'object') {
                        return cleanContextData(parsed);
                    }
                } catch (e) {
                    // Not valid JSON, continue with string cleaning
                    parsed = data;
                }
            }

            // Clean the string by removing escape characters
            // Apply replacements multiple times to handle nested escaping
            let cleaned = parsed;
            let prevCleaned = '';

            // Keep cleaning until no more changes occur (handles multiple levels of escaping)
            while (cleaned !== prevCleaned) {
                prevCleaned = cleaned;
                cleaned = cleaned
                    .replace(/\\\\/g, '\\')          // Convert \\ to single \ (do first to prevent double-unescaping)
                    .replace(/\\n/g, '\n')           // Convert \n to actual newlines
                    .replace(/\\t/g, '\t')           // Convert \t to actual tabs
                    .replace(/\\"/g, '"')            // Convert \" to "
                    .replace(/\\'/g, "'");           // Convert \' to '
            }

            // Don't collapse newlines and tabs - only trim whitespace
            return cleaned.trim();
        }
        return data;
    }

    // If it's an array, clean each item
    if (Array.isArray(data)) {
        return data.map(item => cleanContextData(item));
    }

    const cleaned: any = {};

    for (const [key, value] of Object.entries(data)) {
        // Only skip timestamp metadata (not useful for agent reasoning)
        if (key === 'timestamp') {
            continue;
        }

        // Recursively clean nested objects and strings
        if (typeof value === 'object' && value !== null) {
            cleaned[key] = cleanContextData(value);
        } else if (typeof value === 'string') {
            cleaned[key] = cleanContextData(value);
        } else {
            cleaned[key] = value;
        }
    }

    return cleaned;
}

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

    /**
     * Distribute execution results to target agents (for decision nodes)
     * @param sourceAgentName - Name of the agent that produced the result
     * @param targetAgents - Array of target agent names to receive the result
     * @param result - The result to distribute
     * @param nodeId - The ID of the node
     * @param agentType - Type of the agent that produced the result
     */
    distributeResultsToTargets(
        sourceAgentName: string,
        targetAgents: string[],
        result: any,
        nodeId: string,
        agentType: string
    ): Promise<void>;
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
        console.log('DEPENDENCY ', this.pendingNodes)
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
            console.log('CONDITION ', conditionObj)

            // Simple evaluation - check for success patterns
            if (expression.includes('success === true') || expression.includes('success==true')) {
                if(!context.data.includes('"success": false')){
                    return true;
                } 
               // return context.success === true || context.lastNodeOutput?.success === true;
            } else if (expression.includes('success === false') || expression.includes('success==false')) {
                   if(context.data.includes('"success": false')){
                    return false;
                } 
               // return context.success === false || context.lastNodeOutput?.success === false;
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
        const autonomousEdges: DAGEdge[] = [];

        for (const edge of outgoingEdges) {
            console.log('AUTO ', edge.flowType)
            // For autonomous_decision, evaluate condition
            if (edge.flowType === 'autonomous_decision') {
                autonomousEdges.push(edge);
            //    console.log('AUTO CONTEXT ', this.context)
                if (this.evaluateCondition(edge, this.context)) {
                    validEdges.push(edge);
                }
            } else {
                // For other flow types, always include
                validEdges.push(edge);
            }
        }

        // Prune unreachable autonomous decision paths from dependencies
        if (autonomousEdges.length > 0) {
            this.pruneUnreachablePaths(currentNodeId, autonomousEdges, validEdges);
        }
console.log('AUTO VALID ', validEdges)
        return validEdges;
    }

    /**
     * Prune unreachable autonomous decision paths from dependency map
     * When an autonomous decision is made, remove the unchosen paths from downstream dependencies
     */
    private pruneUnreachablePaths(currentNodeId: string, allAutonomousEdges: DAGEdge[], selectedEdges: DAGEdge[]): void {
        // Find which autonomous edges were NOT selected
        const unselectedEdges = allAutonomousEdges.filter(edge => !selectedEdges.includes(edge));

        if (unselectedEdges.length === 0) return;

        console.log(`🔪 Pruning unreachable paths from ${currentNodeId}:`);

        // For each unselected edge, remove its target from all downstream dependency maps
        for (const unselectedEdge of unselectedEdges) {
            const unreachableNode = unselectedEdge.to;
            console.log(`  ❌ Removing unreachable node: ${unreachableNode}`);

            // Remove this unreachable node from all pending dependency sets
            for (const [nodeId, predecessors] of this.pendingNodes.entries()) {
                if (predecessors.has(unreachableNode)) {
                    console.log(`    🔧 Removing ${unreachableNode} from ${nodeId}'s dependencies`);
                    predecessors.delete(unreachableNode);
                }
            }
        }
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
     * For decision nodes, only returns targets for edges that will be followed
     */
    private getTargetAgentsForNode(nodeId: string, evaluateConditions: boolean = false): string[] {
        let edges: DAGEdge[];

        if (evaluateConditions) {
            // Use getNextEdges to filter based on conditions (for decision nodes)
            edges = this.getNextEdges(nodeId);
        } else {
            // Get all outgoing edges (for normal nodes)
            edges = this.getOutgoingEdges(nodeId);
        }

        return edges.map(edge => {
            const targetNode = this.dag.nodes.find(n => n.id === edge.to);
            return targetNode?.agentName || edge.to;
        });
    }

    /**
     * Check if a node has autonomous decision edges
     */
    private hasAutonomousDecisionEdges(nodeId: string): boolean {
        const outgoingEdges = this.getOutgoingEdges(nodeId);
        return outgoingEdges.some(edge => edge.flowType === 'autonomous_decision');
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

            // Check if this node has autonomous decision edges
            const hasDecisionEdges = this.hasAutonomousDecisionEdges(nodeId);

            // For decision nodes, we'll determine targets AFTER execution
            // For normal nodes, get all target agents now
            const targetAgents = hasDecisionEdges ? [] : this.getTargetAgentsForNode(nodeId);

            console.log(`🔍 Node ${nodeId} has decision edges: ${hasDecisionEdges}, initial targets: ${targetAgents.join(', ')}`);

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

            // Update context with node output BEFORE evaluating conditions
            this.context[nodeId] = output;
            this.context.lastNodeOutput = output;
            this.context.lastExecutedNode = nodeId;

            // Merge output into context if it's an object
            if (output && typeof output === 'object') {
                this.context = { ...this.context, ...output };
            }

            // For decision nodes, NOW evaluate conditions and update only valid targets
            if (hasDecisionEdges) {
                const validTargets = this.getTargetAgentsForNode(nodeId, true);
                console.log(`✅ Decision node ${nodeId}: Valid targets after condition evaluation: ${validTargets.join(', ')}`);

                // Manually update contexts for valid targets only
                // This is done by calling a method on the nodeExecutor to distribute results
                await this.nodeExecutor.distributeResultsToTargets(node.agentName, validTargets, output, nodeId, node.type);
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

        // Execute branches sequentially (parallel execution causes OpenAI SDK to hang)
        // Issue: When using Promise.all with OpenAI calls, the await hangs even with semaphore
        console.log(`⚡ Executing ${edges.length} branches sequentially`);
        for (const edge of edges) {
            console.log(`  📌 Starting branch: ${edge.to}`);
            await this.executeBranch(edge.to, edge.flowType);
            console.log(`  ✅ Completed branch: ${edge.to}`);
        }
        console.log(`✅ All ${edges.length} branches completed`);

        this.emit('parallelComplete', { nodeIds: branchNodes });

        // After parallel branches complete, find and execute convergence point
        await this.executeConvergencePoint(branchNodes);
    }

    /**
     * Execute a single branch (may contain multiple sequential nodes)
     */
    private async executeBranch(startNodeId: string, incomingFlowType: string): Promise<void> {
        console.log(`🌿 executeBranch START - Node: ${startNodeId}, FlowType: ${incomingFlowType}`);
        let currentNodeId = startNodeId;
        let currentFlowType = incomingFlowType;

        while (currentNodeId) {
            // Check if we can execute this node
            if (!this.canExecuteNode(currentNodeId)) {
                console.log(`⏸️  Cannot execute node ${currentNodeId} yet - waiting for predecessors`);
                break; // Wait for other branches to complete
            }

            // Skip if already executed
            if (this.executedNodes.has(currentNodeId)) {
                console.log(`⏭️  Node ${currentNodeId} already executed - skipping`);
                break;
            }

            // Execute the node
            console.log(`▶️  executeBranch: Executing node ${currentNodeId}`);
            await this.executeNodeInternal(currentNodeId, currentFlowType);
            console.log(`✅ executeBranch: Completed node ${currentNodeId}`);

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

    async distributeResultsToTargets(
        sourceAgentName: string,
        targetAgents: string[],
        result: any,
        nodeId: string,
        agentType: string
    ): Promise<void> {
        console.log(`📤 ExampleNodeExecutor: Distributing results from ${sourceAgentName} (${agentType}) to ${targetAgents.join(', ')}`);
        // In a real implementation, this would update the context manager or storage
        // For the example executor, this is a no-op since it doesn't maintain state
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
        console.log(`\n▶️  StrategyBasedNodeExecutor.executeNode ENTRY: ${nodeId} (${agentName})`);
        console.log(`   Type: ${agentType}, FlowType: ${flowType}`);
        console.log(`   Targets: ${targetAgents.join(', ')}, Source: ${sourceAgentName}`);

        // Handle entry/exit nodes
        if (agentType === 'entry') {
            
                const conversationCtx = this.coordinator.contextManager.getContext('ConversationAgent');
                this.coordinator.contextManager.updateContext(agentName, {
                    lastTransactionResult: conversationCtx.lastTransactionResult,
                    userQuery: conversationCtx.userQuery
                });

                  this.coordinator.contextManager.updateContext('ReportWritingAgent', {
                    userQuery: conversationCtx.userQuery
                });
             
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
            agent = this.instantiateSDKAgent(agentName, nodeId);
        } else if (agentType === 'agent') {
            // CRITICAL: Instantiate a NEW GenericAgent for each node execution
            // to prevent race conditions when the same agent is used in parallel branches
            agent = this.instantiateGenericAgent(agentName, nodeId);


        } else {
            // For special cases like context_pass
            agent = {
                getName: () => agentName
            };
        }

        // Execute using strategy
        console.log(`🎬 StrategyBasedNodeExecutor: About to call strategy.execute for ${agentName}`);
        const result = await strategy.execute(
            agent,
            targetAgents,
            this.coordinator.contextManager,
            sourceAgentName,
            context.userQuery,
            this.coordinator.agents,
            {},
            this.prompts,
            nodeId
        );
        console.log(`🏁 StrategyBasedNodeExecutor: strategy.execute completed for ${agentName}, success: ${result.success}`);

        return {
            success: result.success,
            data: result.result,
            agentName: result.agentName
        };
    }

    private instantiateSDKAgent(agentName: string, nodeId: string): any {
        const contextManager = this.coordinator.contextManager;

        switch (agentName) {
            case 'DataProfiler':
                return new DataProfiler(contextManager);
            case 'SimpleDataAnalyzer':
                return new SimpleDataAnalyzer(contextManager,nodeId);
            case 'D3JSCodeValidator':
                return new D3JSCodeValidator(contextManager, this.coordinator, nodeId);
            default:
                throw new Error(`Unknown SDK agent: ${agentName}`);
        }
    }

    private instantiateGenericAgent(agentName: string, nodeId: string): GenericAgent {
        // Get the template agent from registry
        const templateAgent = this.coordinator.agents.get(agentName);
        if (!templateAgent) {
            throw new Error(`GenericAgent not found in registry: ${agentName}`);
        }
        const agentDefinition = templateAgent.getAgentDefinition();

   
        agentDefinition.id = nodeId;
        // Create a NEW instance to prevent race conditions in parallel execution
        return new GenericAgent(templateAgent.getAgentDefinition());
    }

    async distributeResultsToTargets(
        sourceAgentName: string,
        targetAgents: string[],
        result: any,
        nodeId: string,
        agentType: string
    ): Promise<void> {
        console.log(`\n📤 StrategyBasedNodeExecutor: Distributing results from ${sourceAgentName} (${agentType}) to ${targetAgents.join(', ')}`);

        // Replicate the context distribution logic from the strategies
        // This mimics what LLMCallStrategy and SDKAgentStrategy do when writing to target contexts

        if (agentType === 'agent') {
            // For GenericAgent (LLM-based), replicate LLMCallStrategy context distribution
            let prevCtx;
            let preCtxRes;
            for (const targetAgent of targetAgents) {
                prevCtx = this.coordinator.contextManager.getContext(targetAgent);
                preCtxRes = prevCtx?.lastTransactionResult;

                if (preCtxRes) {
                    this.coordinator.contextManager.updateContext(targetAgent, {
                        lastTransactionResult: result.data,
                        prevResult: prevCtx?.lastTransactionResult,
                        transactionId: nodeId,
                        timestamp: new Date()
                    });
                } else {
                    this.coordinator.contextManager.updateContext(targetAgent, {
                        lastTransactionResult: result.data,
                        transactionId: nodeId,
                        timestamp: new Date()
                    });
                }

                console.log(`✅ Distributed GenericAgent result to ${targetAgent}`);
            }
        } else if (agentType === 'sdk_agent') {
            // For SDK Agent, replicate SDKAgentStrategy context distribution
            const ctx = this.coordinator.contextManager.getContext(sourceAgentName);


            for (const targetAgent of targetAgents) {
                let sdkPrevRes;
                let prevCtx = this.coordinator.contextManager.getContext(targetAgent);

                if(prevCtx.sdkInput){
                    // Clean both the existing sdkInput and the new lastTransactionResult
                    const cleanedPrevInput = cleanContextData(prevCtx.sdkInput);
                    const cleanedNewResult = cleanContextData(ctx?.lastTransactionResult);
                    // Pass as structured object without stringifying to preserve D3.js/HTML code
                    sdkPrevRes = {
                        previous: cleanedPrevInput,
                        current: cleanedNewResult
                    };
                } else{
                    // Clean the lastTransactionResult before using it
                    sdkPrevRes = cleanContextData(ctx?.lastTransactionResult);
                }

                this.coordinator.contextManager.updateContext(targetAgent, {

                 //   sdkResult: result.data, do not add result of validator
                    sdkInput: sdkPrevRes,
                 //   userQuery: ctx?.userQuery,
                    transactionId: sourceAgentName,
                    timestamp: new Date()
                });

                if(targetAgent === 'HTMLLayoutDesignAgent'){
                  //  console.log('DISTRIBUTE ', JSON.stringify(ctx))
                }

                console.log(`✅ Distributed SDK Agent result to ${targetAgent}`);
            }
        } else {
            console.warn(`⚠️ Unknown agentType for distribution: ${agentType}, using generic distribution`);
            // Fallback: generic distribution
            for (const targetAgent of targetAgents) {
                this.coordinator.contextManager.updateContext(targetAgent, {
                    lastTransactionResult: result,
                    transactionId: sourceAgentName,
                    timestamp: new Date()
                });
            }
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