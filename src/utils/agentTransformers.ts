/**
 * Utility functions for transforming agent data structures
 */

import { CreatedAgentInfo } from '../agents/dataProfiler.js';
import { SagaTransaction } from '../types/visualizationSaga.js';

/**
 * Transforms CreatedAgentInfo array from DataProfiler to SagaTransaction array
 * for use in ExecuteGenericAgentsProcess
 *
 * @param createdAgents - Array of CreatedAgentInfo objects from DataProfiler
 * @returns Array of SagaTransaction objects
 */
export function transformAgentDefinitionsToSagaTransactions(
    createdAgents: CreatedAgentInfo[]
): SagaTransaction[] {
    // Sort by order to ensure correct execution sequence
    const sortedAgents = [...createdAgents].sort((a, b) => a.order - b.order);

    return sortedAgents.map((agentInfo, index) => {
        const definition = agentInfo.definition;

        // Build dependencies array from agent definition
        const dependencies: string[] = definition.dependencies
            ? definition.dependencies
                .filter(dep => dep.required)
                .map(dep => {
                    // Find the transaction ID for the dependency by agent name
                    const depAgent = sortedAgents.find(a => a.definition.name === dep.agentName);
                    return depAgent ? `tx-${depAgent.order}` : dep.agentName;
                })
            : [];

        // Create SagaTransaction
        const transaction: SagaTransaction = {
            id: `tx-${agentInfo.order}`,
            name: definition.name,
            agentName: definition.name,
            agentType: definition.agentType,
            dependencies: dependencies,
            transactionPrompt: definition.taskDescription,
            status: 'pending',
            compensationAction: `cleanup_${definition.name.toLowerCase()}_state`
        };

        return transaction;
    });
}

/**
 * Transforms a serialized JSON string of CreatedAgentInfo[] to SagaTransaction[]
 *
 * @param serializedAgents - JSON string of CreatedAgentInfo array
 * @returns Array of SagaTransaction objects
 */
export function transformSerializedAgentsToSagaTransactions(
    serializedAgents: string
): SagaTransaction[] {
    try {
        const createdAgents: CreatedAgentInfo[] = JSON.parse(serializedAgents);
        return transformAgentDefinitionsToSagaTransactions(createdAgents);
    } catch (error) {
        console.error('Error parsing serialized agents:', error);
        throw new Error(`Failed to parse agent definitions: ${error instanceof Error ? error.message : String(error)}`);
    }
}
