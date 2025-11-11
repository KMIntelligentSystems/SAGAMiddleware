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
export class GenerateAgentAgentStructureProcess {
 // private flowDefiningAgent: GenericAgent;
  private agent: string;
  private targetAgent?: string;
  private contextManager: ContextManager;
 // private coordinator: SagaCoordinator;
//  private query: string;

  constructor(
    //flowDefiningAgent: GenericAgent,
    agent: string,
    targetAgent: string,
    contextManager: ContextManager,
  //  query: string
  ) {
    this.agent = agent;
    this.targetAgent = targetAgent
    this.contextManager = contextManager;
  //  this.coordinator = coordinator;
    //this.query = query;
  }

  /**
   * Execute agent generation
   */
  async execute(): Promise<any> {//ransactionSetCollection
    console.log(`\n🏭 AgentGeneratorProcess: Creating agents from ${this.targetAgent} definitions`);//FlowDefiningAgent

    // Get agent definitions from target agent
    const agentDefinitionsCtx = this.contextManager.getContext(
      this.agent
    ) as WorkingMemory;

    if (!agentDefinitionsCtx || !agentDefinitionsCtx.lastTransactionResult) {
      throw new Error(`No target agent definitions found for ${this.targetAgent}`);
    }

     if(this.targetAgent){
          this.contextManager.updateContext(this.targetAgent, {
          lastTransactionResult: JSON.stringify(agentDefinitionsCtx.lastTransactionResult),
          transactionId: 'id',
           timestamp: new Date()
      })
    }

    return [];//transactionSetCollection;
}

  }