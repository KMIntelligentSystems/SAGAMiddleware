// AgentGeneratorProcess - Creates TransactionSet from agent definitions using AgentParser
// Handles both singletons and multi-agent transaction sets

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { WorkingMemory } from '../types/index.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AgentParser } from '../agents/agentParser.js';
import { TransactionSetCollection } from '../types/visualizationSaga.js';

/**
 * AgentGeneratorProcess
 *
 * Uses AgentParser to:
 * 1. Parse agent definitions from target agent's output
 * 2. Parse flow information from flow defining agent's output
 * 3. Create TransactionSet with GenericAgents
 * 4. Register agents with coordinator
 *
 * Handles:
 * - Singleton agents (single agent, no flow)
 * - Multi-agent sets (multiple agents with flow dependencies)
 *
 * Returns: TransactionSet containing the created agents
 */
export class AgentGeneratorProcess {
 // private flowDefiningAgent: GenericAgent;
  private agent: string;
  private targetAgent: GenericAgent;
  private contextManager: ContextManager;
  private coordinator: SagaCoordinator;
  private query: string;

  constructor(
    //flowDefiningAgent: GenericAgent,
    agent: string,
    targetAgent: GenericAgent,
    contextManager: ContextManager,
    query: string,
    coordinator: SagaCoordinator
  ) {
    this.agent = agent;
    this.targetAgent = targetAgent;
    this.contextManager = contextManager;
    this.coordinator = coordinator;
    this.query = query;
  }

  /**
   * Execute agent generation
   */
  async execute(): Promise<any> {//ransactionSetCollection
    console.log(`\n🏭 AgentGeneratorProcess: Creating agents from ${this.targetAgent.getName()} definitions`);//FlowDefiningAgent
   if(this.targetAgent.getName() ==='FlowDefiningAgent'){
    const ctx = this.contextManager.getContext('AgentStructureGenerator') as WorkingMemory;
    console.log('AGENT GEN PROCESS HAS ERROR ', ctx)
    if(ctx.hasError){
      this.contextManager.updateContext('FlowDefiningAgent', {
        codeInErrorResult: ctx.lastTransactionResult,
        agentInError: ctx.agentInError,
        hasError: true,
      })
    }
   }

    // Get flow information from flow defining agent
    const flowCtx = this.contextManager.getContext(
      this.agent
    ) as WorkingMemory;
 
    const agentDefinitionsText = this.query//flowCtx?.previousTransactionResult;
    const flowData = flowCtx?.lastTransactionResult;

    console.log(`📝 Agent definitions: $agentFlowText}...`, flowData);
    if (flowData) {
      this.contextManager.updateContext(this.targetAgent.getName(), {
        lastTransactionResult: flowData,
         transactionId: this.targetAgent.getId(),
           timestamp: new Date()
      })
      console.log(`🔀 Flow data: ${JSON.stringify(flowData).substring(0, 150)}...`);
    } else {
      console.log(`🔀 No flow data (singleton agent)`);
    }

    // Use AgentParser to create TransactionSetCollection
  

    return [];//transactionSetCollection;
  }

  /**
   * Get created transaction set collection (after execute)
   */
  getTransactionSetCollection(): TransactionSetCollection | null {
    // Transaction set collection is returned by execute()
    return null;
  }
}