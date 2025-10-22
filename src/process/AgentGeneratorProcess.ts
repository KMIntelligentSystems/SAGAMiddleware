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
  private flowDefiningAgent: GenericAgent;
  private targetAgent: GenericAgent;
  private contextManager: ContextManager;
  private coordinator: SagaCoordinator;

  constructor(
    flowDefiningAgent: GenericAgent,
    targetAgent: GenericAgent,
    contextManager: ContextManager,
    coordinator: SagaCoordinator
  ) {
    this.flowDefiningAgent = flowDefiningAgent;
    this.targetAgent = targetAgent;
    this.contextManager = contextManager;
    this.coordinator = coordinator;
  }

  /**
   * Execute agent generation
   */
  async execute(): Promise<TransactionSetCollection> {
    console.log(`\n🏭 AgentGeneratorProcess: Creating agents from ${this.targetAgent.getName()} definitions`);//FlowDefiningAgent

    // Get agent definitions from target agent
    const agentDefinitionsCtx = this.contextManager.getContext(
      this.targetAgent.getName()
    ) as WorkingMemory;

    if (!agentDefinitionsCtx || !agentDefinitionsCtx.lastTransactionResult) {
      throw new Error(`No target agent definitions found for ${this.targetAgent.getName()}`);
    }

    // Get flow information from flow defining agent
    const flowCtx = this.contextManager.getContext(
      this.flowDefiningAgent.getName()
    ) as WorkingMemory;
 
    const agentDefinitionsText = flowCtx?.previousTransactionResult;
    const flowData = flowCtx?.lastTransactionResult;

    console.log(`📝 Agent definitions: $agentFlowText}...`, flowData);
    if (flowData) {
      console.log(`🔀 Flow data: ${JSON.stringify(flowData.substring(0, 150))}...`);
    } else {
      console.log(`🔀 No flow data (singleton agent)`);
    }

    // Use AgentParser to create TransactionSetCollection
    // Note: AgentParser will need to be updated to handle singletons
    const transactionSetCollection = AgentParser.parseAndCreateAgents(
      agentDefinitionsText,
      flowData,
      this.coordinator
    );

    console.log(`✅ Created TransactionSetCollection: ${transactionSetCollection.id}`);
    console.log(`   Sets: ${transactionSetCollection.sets.length}`);

    // Log all transactions from all sets
   /* transactionSetCollection.sets.forEach(set => {
      console.log(`   Set: ${set.id}`);
      set.transactions.forEach(tx => {
        console.log(`     - ${tx.name} (${tx.agentName}, ${tx.id})`);
      });
    });*/

    return transactionSetCollection;
  }

  /**
   * Get created transaction set collection (after execute)
   */
  getTransactionSetCollection(): TransactionSetCollection | null {
    // Transaction set collection is returned by execute()
    return null;
  }
}