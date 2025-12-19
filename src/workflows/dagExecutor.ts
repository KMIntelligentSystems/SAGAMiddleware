/**
 * DAG Executor
 *
 * Executes a DAG (Directed Acyclic Graph) of agents
 * Replaces/augments PipelineExecutor with graph-based execution
 */

import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import {
    DAGDefinition,
    DAGNode,
    DAGEdge,
    DAGExecutionContext,
    DAGValidationResult,
    DAGComplexity
} from '../types/dag.js';
import { AgentResult } from '../types/index.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { BaseSDKAgent } from '../agents/baseSDKAgent.js';
import {
    LLMCallStrategy,
    ContextPassStrategy,
    ExecuteAgentsStrategy,
    SDKAgentStrategy,
    ValidationStrategy
} from '../process/FlowStrategies.js';

export class DAGExecutor {
    private coordinator: SagaCoordinator;
    private context: DAGExecutionContext;
    private strategyMap: Map<string, any>;

    constructor(coordinator: SagaCoordinator) {
        this.coordinator = coordinator;

        // Initialize execution context
        this.context = {
            dagId: '',
            executionId: this.generateExecutionId(),
            startTime: new Date(),
            executedNodes: new Set(),
            nodeResults: new Map(),
            errors: []
        };

        // Map flow types to strategies
        this.strategyMap = new Map([
            ['llm_call', LLMCallStrategy],
            ['context_pass', ContextPassStrategy],
            ['execute_agents', ExecuteAgentsStrategy],
            ['sdk_agent', SDKAgentStrategy],
            ['validation', ValidationStrategy]
        ]);
    }

    /**
     * Execute a DAG
     */
    async executeDAG(dag: DAGDefinition, input: any): Promise<any> {
        console.log(`\n🔀 ============================================`);
        console.log(`🔀 Executing DAG: ${dag.name}`);
        console.log(`🔀 Description: ${dag.description}`);
        console.log(`🔀 Nodes: ${dag.nodes.length}, Edges: ${dag.edges.length}`);
        console.log(`🔀 ============================================\n`);

        // Initialize context
        this.context.dagId = dag.id;
        this.context.startTime = new Date();

        try {
            // Phase 1: Validate DAG
            console.log('📋 Phase 1: Validating DAG structure...');
            const validation = this.validateDAG(dag);
            if (!validation.valid) {
                throw new Error(`DAG validation failed:\n${validation.errors.join('\n')}`);
            }
            console.log(`✅ DAG validation passed`);
            if (validation.warnings.length > 0) {
                console.log(`⚠️  Warnings:\n${validation.warnings.join('\n')}`);
            }

            // Phase 2: Display DAG topology
            console.log('\n📊 DAG Topology:');
            this.displayTopology(dag);

            // Phase 3: Execute from entry node
            console.log('\n🚀 Phase 2: Executing DAG...\n');
            const result = await this.executeNode(dag, dag.entryNode, input);

            // Phase 4: Summary
            const duration = Date.now() - this.context.startTime.getTime();
            console.log(`\n✅ DAG execution completed in ${duration}ms`);
            console.log(`   Nodes executed: ${this.context.executedNodes.size}/${dag.nodes.length}`);
            console.log(`   Errors: ${this.context.errors.length}`);

            return result;

        } catch (error) {
            const duration = Date.now() - this.context.startTime.getTime();
            console.error(`\n❌ DAG execution failed after ${duration}ms`);
            console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Execute a single node in the DAG
     */
    private async executeNode(
        dag: DAGDefinition,
        nodeId: string,
        input: any
    ): Promise<any> {
        // Check if already executed
        if (this.context.executedNodes.has(nodeId)) {
            console.log(`⏭️  Node ${nodeId} already executed, skipping...`);
            return this.context.nodeResults.get(nodeId);
        }

        // Get node definition
        const node = dag.nodes.find(n => n.id === nodeId);
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }

        // Update current node
        this.context.currentNode = nodeId;

        // Check if all incoming edges are satisfied
        const incomingEdges = dag.edges.filter(e => e.to === nodeId);
        const unsatisfiedDeps = incomingEdges.filter(
            edge => !this.context.executedNodes.has(edge.from)
        );

        if (unsatisfiedDeps.length > 0) {
            // Execute dependencies first
            console.log(`⏸️  Node ${nodeId} waiting for dependencies: ${unsatisfiedDeps.map(e => e.from).join(', ')}`);
            for (const edge of unsatisfiedDeps) {
                await this.executeNode(dag, edge.from, input);
            }
        }

        try {
            console.log(`\n▶️  Executing Node: ${nodeId} (${node.agentName})`);
            console.log(`   Type: ${node.type}`);

            // Execute the node based on incoming edges
            let result: any;

            if (node.type === 'entry') {
                // Entry node just passes input
                result = input;
            } else if (node.type === 'exit') {
                // Exit node returns accumulated result
                result = this.getAccumulatedResult(dag, nodeId);
            } else {
                // Execute based on incoming edges
                result = await this.executeNodeWithStrategy(dag, node, incomingEdges);
            }

            // Mark as executed and store result
            this.context.executedNodes.add(nodeId);
            this.context.nodeResults.set(nodeId, result);

            console.log(`✅ Node ${nodeId} completed`);

            // Find outgoing edges
            const outgoingEdges = dag.edges.filter(e => e.from === nodeId);

            // Check if we're at an exit node
            if (dag.exitNodes.includes(nodeId)) {
                console.log(`🏁 Reached exit node: ${nodeId}`);
                return result;
            }

            // Execute downstream nodes
            if (outgoingEdges.length === 0) {
                console.log(`⚠️  Node ${nodeId} has no outgoing edges but is not marked as exit node`);
                return result;
            }

            // Check for parallel paths
            if (outgoingEdges.length > 1) {
                console.log(`🔀 Node ${nodeId} has ${outgoingEdges.length} outgoing edges - executing in parallel`);
                const downstreamResults = await Promise.all(
                    outgoingEdges.map(edge => this.executeEdge(dag, edge, result))
                );
                // Return the first non-null result
                return downstreamResults.find(r => r !== null) || result;
            } else {
                // Single outgoing edge
                return await this.executeEdge(dag, outgoingEdges[0], result);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error executing node ${nodeId}: ${errorMsg}`);

            this.context.errors.push({
                nodeId,
                error: errorMsg,
                timestamp: new Date()
            });

            throw error;
        }
    }

    /**
     * Execute node using appropriate flow strategy
     */
    private async executeNodeWithStrategy(
        dag: DAGDefinition,
        node: DAGNode,
        incomingEdges: DAGEdge[]
    ): Promise<any> {
        // Get the agent
        const agent = this.coordinator.agents.get(node.agentName);
        if (!agent) {
            throw new Error(`Agent not found in registry: ${node.agentName}`);
        }

        // Determine strategy from incoming edge
        const primaryEdge = incomingEdges[0]; // Use first edge to determine strategy
        if (!primaryEdge) {
            throw new Error(`Node ${node.id} has no incoming edges`);
        }

        const strategy = this.strategyMap.get(primaryEdge.flowType);
        if (!strategy) {
            throw new Error(`Unknown flow type: ${primaryEdge.flowType}`);
        }

        // Get source agent/node name for strategy
        const sourceNode = dag.nodes.find(n => n.id === primaryEdge.from);
        const sourceAgentName = sourceNode?.agentName || primaryEdge.from;

        // Execute using strategy
        console.log(`   Strategy: ${primaryEdge.flowType}`);
        console.log(`   Source: ${sourceAgentName} → ${node.agentName}`);

        const result = await strategy.execute(
            agent,
            node.agentName,
            this.coordinator.contextManager,
            undefined, // userQuery - can be passed if needed
            this.coordinator.agents // agents registry for ExecuteAgentsStrategy
        );

        return result;
    }

    /**
     * Execute an edge (transition to next node)
     */
    private async executeEdge(
        dag: DAGDefinition,
        edge: DAGEdge,
        currentResult: any
    ): Promise<any> {
        // Check edge condition if present
        if (edge.condition) {
            const conditionMet = this.evaluateCondition(edge.condition, currentResult);
            if (!conditionMet) {
                console.log(`⏭️  Edge ${edge.id} condition not met, skipping target ${edge.to}`);
                return null;
            }
        }

        // Execute target node
        return await this.executeNode(dag, edge.to, currentResult);
    }

    /**
     * Evaluate edge condition
     */
    private evaluateCondition(
        condition: { type: string; expression: string },
        result: any
    ): boolean {
        // Simple condition evaluation
        // Can be extended with more sophisticated expression parsing
        switch (condition.type) {
            case 'result':
                return result && result.success === true;
            case 'context':
                // Check context for condition
                return true; // Placeholder
            case 'custom':
                // Custom expression evaluation
                return true; // Placeholder
            default:
                return true;
        }
    }

    /**
     * Get accumulated result from all incoming edges
     */
    private getAccumulatedResult(dag: DAGDefinition, nodeId: string): any {
        const incomingEdges = dag.edges.filter(e => e.to === nodeId);
        const results = incomingEdges.map(edge => this.context.nodeResults.get(edge.from));

        // Return the last non-null result
        return results.reverse().find(r => r !== null && r !== undefined);
    }

    /**
     * Validate DAG structure
     */
    private validateDAG(dag: DAGDefinition): DAGValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for empty DAG
        if (dag.nodes.length === 0) {
            errors.push('DAG has no nodes');
        }

        // Check entry node exists
        if (!dag.nodes.find(n => n.id === dag.entryNode)) {
            errors.push(`Entry node not found: ${dag.entryNode}`);
        }

        // Check exit nodes exist
        dag.exitNodes.forEach(exitNode => {
            if (!dag.nodes.find(n => n.id === exitNode)) {
                errors.push(`Exit node not found: ${exitNode}`);
            }
        });

        // Check for cycles
        const cycles = this.detectCycles(dag);
        if (cycles.length > 0) {
            errors.push(`Cycles detected:\n${cycles.join('\n')}`);
        }

        // Check for unreachable nodes
        const unreachable = this.findUnreachableNodes(dag);
        if (unreachable.length > 0) {
            warnings.push(`Unreachable nodes: ${unreachable.join(', ')}`);
        }

        // Check edge validity
        dag.edges.forEach(edge => {
            if (!dag.nodes.find(n => n.id === edge.from)) {
                errors.push(`Edge ${edge.id} references non-existent source node: ${edge.from}`);
            }
            if (!dag.nodes.find(n => n.id === edge.to)) {
                errors.push(`Edge ${edge.id} references non-existent target node: ${edge.to}`);
            }
        });

        // Calculate complexity metrics
        const metrics = this.calculateComplexity(dag);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            metrics
        };
    }

    /**
     * Detect cycles using DFS
     */
    private detectCycles(dag: DAGDefinition): string[] {
        const cycles: string[] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (nodeId: string, path: string[]) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const outgoing = dag.edges.filter(e => e.from === nodeId);
            for (const edge of outgoing) {
                if (!visited.has(edge.to)) {
                    dfs(edge.to, [...path]);
                } else if (recursionStack.has(edge.to)) {
                    cycles.push(`${[...path, edge.to].join(' → ')}`);
                }
            }

            recursionStack.delete(nodeId);
        };

        if (dag.entryNode) {
            dfs(dag.entryNode, []);
        }

        return cycles;
    }

    /**
     * Find unreachable nodes
     */
    private findUnreachableNodes(dag: DAGDefinition): string[] {
        const reachable = new Set<string>();

        const dfs = (nodeId: string) => {
            reachable.add(nodeId);
            const outgoing = dag.edges.filter(e => e.from === nodeId);
            outgoing.forEach(edge => {
                if (!reachable.has(edge.to)) {
                    dfs(edge.to);
                }
            });
        };

        if (dag.entryNode) {
            dfs(dag.entryNode);
        }

        return dag.nodes
            .map(n => n.id)
            .filter(id => !reachable.has(id));
    }

    /**
     * Calculate DAG complexity metrics
     */
    private calculateComplexity(dag: DAGDefinition): DAGComplexity {
        const maxDepth = this.calculateMaxDepth(dag);
        const branchingFactor = dag.nodes.length > 0
            ? dag.edges.length / dag.nodes.length
            : 0;
        const parallelPaths = this.countParallelPaths(dag);

        return {
            nodeCount: dag.nodes.length,
            edgeCount: dag.edges.length,
            maxDepth,
            branchingFactor,
            parallelPaths,
            cyclomaticComplexity: dag.edges.length - dag.nodes.length + 2
        };
    }

    /**
     * Calculate maximum depth (longest path)
     */
    private calculateMaxDepth(dag: DAGDefinition): number {
        const depths = new Map<string, number>();

        const dfs = (nodeId: string): number => {
            if (depths.has(nodeId)) {
                return depths.get(nodeId)!;
            }

            const outgoing = dag.edges.filter(e => e.from === nodeId);
            if (outgoing.length === 0) {
                depths.set(nodeId, 1);
                return 1;
            }

            const maxChildDepth = Math.max(...outgoing.map(e => dfs(e.to)));
            const depth = maxChildDepth + 1;
            depths.set(nodeId, depth);
            return depth;
        };

        return dag.entryNode ? dfs(dag.entryNode) : 0;
    }

    /**
     * Count parallel execution paths
     */
    private countParallelPaths(dag: DAGDefinition): number {
        let parallelPaths = 0;

        dag.nodes.forEach(node => {
            const outgoing = dag.edges.filter(e => e.from === node.id);
            if (outgoing.length > 1) {
                parallelPaths += outgoing.length;
            }
        });

        return parallelPaths;
    }

    /**
     * Display DAG topology
     */
    private displayTopology(dag: DAGDefinition): void {
        console.log(`   Entry: ${dag.entryNode}`);
        console.log(`   Exit: ${dag.exitNodes.join(', ')}`);
        console.log(`   Nodes (${dag.nodes.length}):`);
        dag.nodes.forEach(node => {
            console.log(`      - ${node.id}: ${node.agentName} (${node.type})`);
        });
        console.log(`   Edges (${dag.edges.length}):`);
        dag.edges.forEach(edge => {
            console.log(`      - ${edge.from} →[${edge.flowType}]→ ${edge.to}`);
        });
    }

    /**
     * Generate unique execution ID
     */
    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get execution context (for debugging/monitoring)
     */
    getExecutionContext(): DAGExecutionContext {
        return this.context;
    }
}
