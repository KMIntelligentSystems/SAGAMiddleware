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
    DAGValidationResult,
    DAGComplexity
} from '../types/dag.js';
import { AgentResult } from '../types/index.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { BaseSDKAgent } from '../agents/baseSDKAgent.js';
import { DataProfiler } from '../agents/dataProfiler.js';
import { D3JSCodeValidator } from '../agents/d3jsCodeValidator.js';

import {
    LLMCallStrategy,
    ContextPassStrategy,
    ExecuteAgentsStrategy,
    SDKAgentStrategy,
    ValidationStrategy
} from '../process/FlowStrategies.js';



export class DAGExecutor {
    private coordinator: SagaCoordinator;
    private strategyMap: Map<string, any>;
    private executionPath: Set<string> = new Set(); // Track execution to prevent cycles

    // Execution metadata (just for logging/tracking)
    private currentDagId: string = '';
    private executionStartTime: Date = new Date();

    constructor(coordinator: SagaCoordinator) {
        this.coordinator = coordinator;

        // Map flow types to strategies
        this.strategyMap = new Map([
            ['llm_call', LLMCallStrategy],
            ['context_pass', ContextPassStrategy],
            ['execute_agents', ExecuteAgentsStrategy],
            ['sdk_agent', SDKAgentStrategy],
            ['validation', ValidationStrategy],
            ['autonomous_decision', ContextPassStrategy] // Uses existing strategy - routing via edge conditions
        ]);
    }

    /**
     * Execute a DAG
     * Results stored in ContextManager by FlowStrategies
     */
    async executeDAG(dag: DAGDefinition, input: any): Promise<void> {
        console.log(`\n🔀 ============================================`);
        console.log(`🔀 Executing DAG: ${dag.name}`);
        console.log(`🔀 Description: ${dag.description}`);
        console.log(`🔀 Nodes: ${dag.nodes.length}, Edges: ${dag.edges.length}`);
        console.log(`🔀 ============================================\n`);

        // Initialize execution metadata
        this.currentDagId = dag.id;
        this.executionStartTime = new Date();
        this.executionPath.clear();

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

            // Phase 3: Execute from entry node - results stored in ContextManager
            console.log('\n🚀 Phase 2: Executing DAG...\n');
            await this.executeNode(dag, dag.entryNode, input);

            // Phase 4: Summary
            const duration = Date.now() - this.executionStartTime.getTime();
            console.log(`\n✅ DAG execution completed in ${duration}ms`);
            console.log(`   Nodes executed: ${this.executionPath.size}/${dag.nodes.length}`);

        } catch (error) {
            const duration = Date.now() - this.executionStartTime.getTime();
            console.error(`\n❌ DAG execution failed after ${duration}ms`);
            console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Execute a single node in the DAG
     * Traverses graph, delegates to strategies for execution
     */
    private async executeNode(
        dag: DAGDefinition,
        nodeId: string,
        input: any
    ): Promise<void> {
        // Check if already executed (cycle detection)
        if (this.executionPath.has(nodeId)) {
            console.log(`⏭️  Node ${nodeId} already executed, skipping...`);
            return;
        }

        // Get node definition
        const node = dag.nodes.find(n => n.id === nodeId);
        if (!node) {
            throw new Error(`Node not found: ${nodeId}`);
        }

        // Check if all incoming edges are satisfied
        const incomingEdges = dag.edges.filter(e => e.to === nodeId);
        const unsatisfiedDeps = incomingEdges.filter(
            edge => !this.executionPath.has(edge.from)
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

            // Mark as executed (for cycle detection)
            this.executionPath.add(nodeId);

            // Execute the node based on type
            if (node.type === 'entry') {
                // Entry node - just log, no execution
                const conversationCtx = this.coordinator.contextManager.getContext('ConversationAgent')
                if(node.agentName !== 'ConversationAgent'){   
                    this.coordinator.contextManager.updateContext(node.agentName, {lastTransactionResult: conversationCtx.lastTransactionResult})
                    console.log(`   Entry node, continuing...`, node.agentName);
                }
               
                //   Entry node, continuing... conversation-agent
            } else if (node.type === 'exit') {
                // Exit node - results already in ContextManager
                console.log(`🏁 Reached exit node: ${nodeId}`);
                return;
            } else {
                // Execute node using strategy - strategy updates ContextManager
                await this.executeNodeWithStrategy(dag, node, incomingEdges);
            }

            console.log(`✅ Node ${nodeId} completed`);

            // Find outgoing edges
            const outgoingEdges = dag.edges.filter(e => e.from === nodeId);

            if (outgoingEdges.length === 0 && !dag.exitNodes.includes(nodeId)) {
                console.log(`⚠️  Node ${nodeId} has no outgoing edges but is not marked as exit node`);
                return;
            }

            // Execute downstream nodes
            if (outgoingEdges.length > 1) {
                console.log(`🔀 Node ${nodeId} has ${outgoingEdges.length} outgoing edges - executing in parallel`);
                await Promise.all(
                    outgoingEdges.map(edge => this.executeEdge(dag, edge))
                );
            } else if (outgoingEdges.length === 1) {
                // Single outgoing edge
                await this.executeEdge(dag, outgoingEdges[0]);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error executing node ${nodeId}: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * Instantiate SDK agent by transaction type
     * Injects the coordinator's context manager for shared context access
     */
    private instantiateSDKAgent(node: DAGNode): BaseSDKAgent {
        const transactionType = node.stepConfig?.transactionType || node.agentName;
        const contextManager = this.coordinator.contextManager;

        switch (transactionType) {
            case 'DataProfiler':
                return new DataProfiler(contextManager);
            case 'D3JSCodeValidator':
                return new D3JSCodeValidator(contextManager, this.coordinator);
            default:
                throw new Error(`Unknown SDK agent transaction type: ${transactionType}`);
        }
    }

    /**
     * Execute node using appropriate flow strategy
     * Strategy handles ContextManager updates
     */
    private async executeNodeWithStrategy(
        dag: DAGDefinition,
        node: DAGNode,
        incomingEdges: DAGEdge[]
    ): Promise<void> {
        // Determine strategy from incoming edge
        const primaryEdge = incomingEdges[0]; // Use first edge to determine strategy
        if (!primaryEdge) {
            throw new Error(`Node ${node.id} has no incoming edges`);
        }

        const strategy = this.strategyMap.get(primaryEdge.flowType);
        if (!strategy) {
            throw new Error(`Unknown flow type: ${primaryEdge.flowType}`);
        }

        // Get source agent/node name for context lookups
        const sourceNode = dag.nodes.find(n => n.id === primaryEdge.from);
        const sourceAgentName = sourceNode?.agentName || primaryEdge.from;

        console.log(`   Strategy: ${primaryEdge.flowType}`);
        console.log(`   Source: ${sourceAgentName} → ${node.agentName}`);

        // NEW: Get target node metadata for prompt injection
        // This allows strategies to inject prompts into the target agent's context
        const targetNodeMetadata = node.metadata;

        // Determine what to pass to strategy based on flowType (like SagaCoordinator does)
        let agentOrName: any;

        if (primaryEdge.flowType === 'context_pass' || primaryEdge.flowType === 'autonomous_decision') {
            // For context-based strategies, pass a name object to look up context in ContextManager
            // autonomous_decision uses ContextPassStrategy - routing determined by edge conditions
            agentOrName = {
                getName: () => sourceAgentName
            };
            console.log(`📝 Using context key: ${sourceAgentName}`);
        } else if (primaryEdge.flowType === 'execute_agents' && sourceNode.type === 'sdk_agent'){// && node.type === 'sdk_agent'
            agentOrName = this.instantiateSDKAgent(sourceNode);
        }
         else if (primaryEdge.flowType === 'llm_call' || primaryEdge.flowType === 'validation') {
            // For LLM calls and validation, get the actual GenericAgent instance
            const genericAgent = this.coordinator.agents.get(node.agentName);
            if (!genericAgent) {
                throw new Error(`GenericAgent not found in registry: ${node.agentName}`);
            }
            agentOrName = genericAgent;
        } else if (primaryEdge.flowType === 'sdk_agent' ) {
            // For SDK agents, instantiate the BaseSDKAgent
            if (node.type !== 'sdk_agent') {
                throw new Error(`Node ${node.id} has sdk_agent flowType but is not an sdk_agent node type`);
            }
            agentOrName = this.instantiateSDKAgent(node);
        } else {
            throw new Error(`Unsupported flowType: ${primaryEdge.flowType}`);
        }

        // Execute using strategy - strategy updates ContextManager
        await strategy.execute(
            agentOrName,
            node.agentName,
            this.coordinator.contextManager,
            undefined, // userQuery - can be passed if needed
            this.coordinator.agents, // agents registry for ExecuteAgentsStrategy
            targetNodeMetadata // NEW: Pass target node metadata for prompt injection
        );
    }

    /**
     * Execute an edge (transition to next node)
     */
    private async executeEdge(
        dag: DAGDefinition,
        edge: DAGEdge
    ): Promise<void> {
        // Check edge condition if present
        if (edge.condition) {
            // Get result from ContextManager for condition evaluation
            const sourceNode = dag.nodes.find(n => n.id === edge.from);
            const ctx = this.coordinator.contextManager.getContext(sourceNode?.agentName || edge.from);

            const conditionMet = this.evaluateCondition(edge.condition, ctx?.lastTransactionResult);
            if (!conditionMet) {
                console.log(`⏭️  Edge ${edge.id} condition not met, skipping target ${edge.to}`);
                return;
            }
        }

        // Execute target node
        await this.executeNode(dag, edge.to, null);
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

}
