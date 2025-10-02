// DataProcessingProcess - Handles initial user request processing
// Owns ONE TransactionSetCollection with agent definition/validation

import { Process, ProcessContext } from './Process.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { SetExecutionResult, TransactionSetCollection, TransactionSet, SagaTransaction } from '../types/visualizationSaga.js';

/**
 * DataProcessingProcess
 *
 * Owns ONE TransactionSetCollection:
 *
 * **data-processing-collection**
 *   └─ Set 1: agent-definition-set
 *       └─ Transactions: tx-grouping, tx-validating, tx-grouping (cyclic)
 *           - tx-grouping: TransactionGroupingAgent (depends on tx-validating)
 *           - tx-validating: ValidatingAgent (depends on tx-grouping)
 *           - tx-grouping: TransactionGroupingAgent (no deps - exit loop)
 *       └─ agentFlow: ['tx-grouping', 'tx-validating', 'tx-grouping']
 *
 *   └─ Set 2: code-execution-set (DYNAMICALLY CREATED by AgentParser)
 *       └─ Transactions: Created from validated agent definitions
 *           - e.g., CODER-01 (PythonCoder), EXEC-01 (PythonExecutor)
 *       └─ agentFlow: From agent definitions (e.g., ['CODER-01', 'EXEC-01'])
 *
 * The coordinator.executeTransactionSetCollection() handles:
 * - Parsing context via parseConversationResultForAgent()
 * - Calling agent.receiveContext()
 * - Executing based on dependencies and agentFlows
 */
export class DataProcessingProcess extends Process {

  constructor(coordinator: SagaCoordinator) {
    super(
      {
        id: 'data-processing-process',
        name: 'Data Processing Process',
        description: 'Agent definition/validation → Dynamic agent execution',
        maxRetries: 3,
        timeout: 600000,
        canCompensate: true
      },
      coordinator
    );
  }

  /**
   * Create the TransactionSetCollection for this Process
   * Uses EXISTING default transaction IDs from SagaWorkflow:
   * - tx-2: TransactionGroupingAgent
   * - tx-3: ValidatingAgent
   * Set 2 will be added dynamically after Set 1 executes
   */
  private createTransactionSetCollection(): TransactionSetCollection {
    // Set 1: Agent definition and validation (cyclic flow)
    // Uses EXISTING transaction IDs from SagaWorkflow
    const agentDefinitionTransactions: SagaTransaction[] = [
      {
        id: 'tx-2', // EXISTING transaction ID
        name: 'Agent Definition',
        agentName: 'TransactionGroupingAgent',
        dependencies: ['tx-3'], // Cyclic: depends on validator
        compensationAction: 'cleanup_conversation_state',
        status: 'pending'
      },
      {
        id: 'tx-3', // EXISTING transaction ID
        name: 'Agent Validation',
        agentName: 'ValidatingAgent',
        dependencies: ['tx-2'], // Cyclic: depends on grouping
        compensationAction: 'cleanup_conversation_state',
        status: 'pending'
      },
      {
        id: 'tx-2', // EXISTING transaction ID (exit loop)
        name: 'Agent Definition Final',
        agentName: 'TransactionGroupingAgent',
        dependencies: [], // No dependency: exit condition
        compensationAction: 'cleanup_conversation_state',
        status: 'pending'
      }
    ];

    const agentDefinitionSet: TransactionSet = {
      id: 'agent-definition-set',
      name: 'Agent Definition and Validation Set',
      description: 'TransactionGroupingAgent ↔ ValidatingAgent cyclic loop',
      transactions: agentDefinitionTransactions
    };

    return {
      id: 'data-processing-collection',
      name: 'Data Processing Collection',
      description: 'Agent definition/validation followed by dynamic agent execution',
      sets: [agentDefinitionSet], // Set 2 added dynamically
      executionOrder: ['agent-definition-set'], // Set 2 order added dynamically
      metadata: {
        version: '1.0.0',
        created: new Date()
      }
    };
  }

  /**
   * Step 1: Define agents
   * Handled by TSC execution (TransactionGroupingAgent)
   */
  protected async defineAgents(context: ProcessContext): Promise<string[]> {
    console.log('📝 DataProcessingProcess: Agents defined via TSC execution');
    return [];
  }

  /**
   * Step 2: Validate agent definitions
   * Handled by TSC execution (ValidatingAgent in cyclic loop)
   */
  protected async validateAgentDefinitions(
    agentDefinitions: string[],
    context: ProcessContext
  ): Promise<any[]> {
    console.log('🔍 DataProcessingProcess: Validation handled via TSC cyclic flow');
    return [];
  }

  /**
   * Step 3: Register agents
   * Handled by AgentParser during TSC execution
   */
  protected async registerAgents(validatedDefinitions: any[]): Promise<void> {
    console.log('📝 DataProcessingProcess: Registration handled by AgentParser');
  }

  /**
   * Step 4: Execute process logic
   * Creates TSC and delegates to coordinator
   */
  protected async executeProcessLogic(context: ProcessContext): Promise<SetExecutionResult> {
    console.log('⚙️  DataProcessingProcess: Executing TransactionSetCollection\n');

    // Create the TSC
    const tsc = this.createTransactionSetCollection();

    // Register the cyclic flow for Set 1
    // Flow: tx-2 → tx-3 → tx-2 (loop until valid)
    this.coordinator.registerAgentFlows(['tx-2', 'tx-3', 'tx-2']);

    console.log('🔄 Executing Set 1: agent-definition-set (cyclic flow)');

    // IMPORTANT: Extract and set context for TransactionGroupingAgent
    // Parse user request to get the section for TransactionGroupingAgent
    const groupingAgentTask = this.parseConversationResultForAgent(
      context.request.userQuery,
      'TransactionGroupingAgent'
    );

    if (groupingAgentTask) {
      const groupingAgent = this.coordinator.agents.get('TransactionGroupingAgent');
      if (groupingAgent) {
        groupingAgent.receiveContext({'YOUR TASK': groupingAgentTask});
        console.log('✅ Set TransactionGroupingAgent context from parsed user request');
      }
    } else {
      console.warn('⚠️  No [AGENT: TransactionGroupingAgent] section found in user request');
    }

    // Execute Set 1: Agent definition/validation
    const set1Result = await this.coordinator.executeTransactionSetCollection(
      context.request,
      tsc,
      context.sagaId,
      context.contextSet ?? undefined
    );

    if (!set1Result.success) {
      throw new Error(`Agent definition/validation failed: ${set1Result.error}`);
    }

    console.log('✅ Set 1 complete: Agents defined and validated\n');

    // At this point:
    // - AgentParser has been called (by coordinator)
    // - Dynamic agents are created and registered
    // - Flow for dynamic agents is registered in coordinator.agentFlows

    // Now execute Set 2: Dynamic agents
    // The dynamically created TSC is already registered with coordinator
    // We just need to execute those agents

    // Get the latest flow (for dynamic agents)
    const dynamicFlow = this.coordinator.agentFlows[this.coordinator.agentFlows.length - 1];

    if (!dynamicFlow || dynamicFlow.length === 0) {
      console.warn('⚠️  No dynamic agent flow found');
      return set1Result;
    }

    console.log(`🔄 Executing Set 2: Dynamic agents with flow: ${dynamicFlow.join(' → ')}`);

    // Create Set 2 with dynamic transactions
    const dynamicTransactions: SagaTransaction[] = dynamicFlow.map((txId, index) => ({
      id: txId,
      name: `Dynamic Transaction ${index + 1}`,
      agentName: this.findAgentNameById(txId),
      dependencies: index === 0 ? [] : [dynamicFlow[index - 1]], // Linear dependencies
      compensationAction: 'cleanup_conversation_state',
      status: 'pending'
    }));

    const codeExecutionSet: TransactionSet = {
      id: 'code-execution-set',
      name: 'Code Execution Set',
      description: 'Dynamically created agents (PythonCoder → PythonExecutor)',
      transactions: dynamicTransactions
    };

    // Add Set 2 to TSC
    tsc.sets.push(codeExecutionSet);
    tsc.executionOrder.push('code-execution-set');

    // Execute Set 2
    const set2Result = await this.coordinator.executeTransactionSetCollection(
      context.request,
      tsc,
      context.sagaId,
      context.contextSet ?? undefined
    );

    console.log('✅ Set 2 complete: Dynamic agents executed\n');

    // Track created agent IDs
    dynamicTransactions.forEach(tx => {
      const agent = this.coordinator.agents.get(tx.agentName);
      if (agent) {
        this.createdAgentIds.push(agent.getId());
      }
    });

    return set2Result;
  }

  /**
   * Step 5: Process results
   */
  protected async processResults(
    executionResult: SetExecutionResult,
    context: ProcessContext
  ): Promise<any> {
    console.log('📊 DataProcessingProcess: Processing results');

    return {
      success: executionResult.success,
      result: executionResult.result,
      outputFile: this.extractOutputFilePath(executionResult.result || ''),
      createdAgents: this.createdAgentIds
    };
  }

  /**
   * Extract output context for next process
   */
  protected extractOutputContext(data: any): Record<string, any> {
    return {
      processedDataPath: data.outputFile,
      result: data.result,
      createdAgents: data.createdAgents
    };
  }

  /**
   * Compensation
   */
  protected async executeCompensation(): Promise<void> {
    console.log('↩️  DataProcessingProcess: Compensation');
    // TODO: Clean up generated files
  }

  // ========== Helpers ==========

  /**
   * Find agent name by transaction ID
   */
  private findAgentNameById(txId: string): string {
    for (const [name, agent] of this.coordinator.agents.entries()) {
      if (agent.getId() === txId) {
        return name;
      }
    }
    return 'UnknownAgent';
  }

  /**
   * Extract output file path
   */
  private extractOutputFilePath(result: string): string | null {
    const patterns = [
      /to_csv\(['"](.*?)['"]\)/,
      /saved to:?\s+([^\s]+\.csv)/i,
      /output.*?:?\s+([^\s]+\.csv)/i
    ];

    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
}