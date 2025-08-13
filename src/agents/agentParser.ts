import { GenericAgent } from './genericAgent.js';
import { AgentDefinition, LLMConfig } from '../types/index.js';
import { SagaTransaction, TransactionSetCollection, TransactionSet } from '../types/visualizationSaga.js';

export class AgentParser {
  /**
   * Parses conversation context and creates TransactionSetCollection with processing and saving agent sets
   * Format: [AGENT: agentName, id] ... [/AGENT] and <flow>A1 -> A2 -> A3 -> A1 -- A4</flow>
   * @param conversationText The text containing agent patterns and flow information
   * @returns TransactionSetCollection with processing agents and data saving agent in separate sets
   */
  static parseAndCreateSagaTransactions(conversationText: string | any): TransactionSetCollection {
    // Handle both string input and object input with result property
    let textToParse: string;
    if (typeof conversationText === 'string') {
      textToParse = conversationText;
    } else if (conversationText && typeof conversationText === 'object' && conversationText.result) {
      textToParse = conversationText.result;
    } else {
      console.error('AgentParser: Invalid conversation text format');
      return this.createEmptyCollection();
    }

    if (!textToParse) {
      console.log('AgentParser: No conversation text provided');
      return this.createEmptyCollection();
    }

    console.log(`AgentParser: Processing text of length ${textToParse.length}`);
    console.log(`AgentParser: First 200 characters: ${textToParse.substring(0, 200)}`);
    
    // Clean up string concatenation artifacts
    textToParse = textToParse
      .replace(/\'\s*\+\s*[\r\n]\s*\'/g, '') // Remove ' + \n '
      .replace(/\'\s*\+\s*\'/g, '') // Remove ' + '
      .replace(/\\\'/g, "'") // Replace escaped quotes
      .replace(/\\\"/g, '"'); // Replace escaped quotes

    // Step 1: Parse name, description, and toolUsers JSON
    let sagaName = 'Visualization_Saga'; // Default
    let sagaDescription = 'Data for the saga'; // Default
    
    // Parse Name and Description
    const namePattern = /Name:\s*[\"']?([^\"'\n]+)[\"']?/;
    const descriptionPattern = /Description:\s*[\"']?([^\"'\n]+)[\"']?/;
    
    const nameMatch = textToParse.match(namePattern);
    const descriptionMatch = textToParse.match(descriptionPattern);
    
    if (nameMatch) {
      sagaName = nameMatch[1].trim();
      console.log(`AgentParser: Found saga name: ${sagaName}`);
    }
    
    if (descriptionMatch) {
      sagaDescription = descriptionMatch[1].trim();
      console.log(`AgentParser: Found saga description: ${sagaDescription}`);
    }
    
    // Parse toolUsers JSON
    let toolUsers: string[] = [];
    const toolUsersPattern = /\{"toolUsers":\s*\[([^\]]+)\]\}/;
    const toolUsersMatch = textToParse.match(toolUsersPattern);
    
    if (toolUsersMatch) {
      try {
        const toolUsersString = toolUsersMatch[1];
        toolUsers = toolUsersString.split(',').map(name => name.trim().replace(/"/g, ''));
        console.log(`AgentParser: Found toolUsers:`, toolUsers);
      } catch (error) {
        console.log(`AgentParser: Error parsing toolUsers JSON:`, error);
      }
    }
    
    const agentPattern = /\[AGENT:\s*([^,]+),\s*([^\]]+)\](.*?)\[\/AGENT\]/gs;
    const agentMap = new Map<string, { name: string; content: string; agentType: 'tool' | 'processing' }>();
    
    console.log(`AgentParser: DEBUG - Looking for agent patterns in cleaned text`);
    
    let match;
    while ((match = agentPattern.exec(textToParse)) !== null) {
      const agentName = match[1].trim();
      const agentId = match[2].trim();
      const content = match[3].trim();
      
      console.log(`AgentParser: DEBUG - Raw match results:`, {
        agentName,
        agentId,
        contentLength: content.length
      });
      
      // Determine agent type based on toolUsers list
      const agentType: 'tool' | 'processing' = toolUsers.includes(agentName) ? 'tool' : 'processing';
      
      console.log(`AgentParser: Found agent "${agentName}" with ID "${agentId}", type "${agentType}"`);
      
      agentMap.set(agentId, { name: agentName, content, agentType });
    }
    
    console.log(`AgentParser: DEBUG - Total agents found: ${agentMap.size}`);

    // Step 2: Parse flow and calculate dependencies with separation of concerns
    const flowPattern = /<flow>([^<]+)<\/flow>/s;
    const flowMatch = textToParse.match(flowPattern);
    
    console.log(`AgentParser: DEBUG - Looking for flow pattern in text`);
    const flowIndex = textToParse.indexOf('<flow>');
    if (flowIndex >= 0) {
      const flowText = textToParse.substring(flowIndex, flowIndex + 100);
      console.log(`AgentParser: DEBUG - Text around <flow>:`, JSON.stringify(flowText));
    }
    console.log(`AgentParser: DEBUG - Flow regex result:`, flowMatch);
    
    const dependencies: { [agentId: string]: string[] } = {};
    let separationOfConcerns: { dependencies: string[], lastElement: string } | null = null;
    
    if (flowMatch) {
      const flowString = flowMatch[1].trim();
      console.log(`AgentParser: Found flow: ${flowString}`);
      
      // Check for separation of concerns pattern (-- separator)
      let flow: string[];
      let lastElement: string | null = null;
      
      if (flowString.includes('--')) {
        const parts = flowString.split('--').map(part => part.trim());
        const mainFlow = parts[0].split('->').map(item => item.trim());
        lastElement = parts[1].trim();
        flow = mainFlow;
        
        separationOfConcerns = {
          dependencies: mainFlow,
          lastElement: lastElement
        };
        
        console.log(`AgentParser: Found separation of concerns - main flow: ${mainFlow.join(' -> ')}, last element: ${lastElement}`);
      } else {
        flow = flowString.split('->').map(item => item.trim());
      }
      
      console.log(`AgentParser: Parsed flow:`, flow);
      
      // Initialize all agents with empty dependencies
      const uniqueIds = [...new Set(flow)];
      uniqueIds.forEach(id => {
        dependencies[id] = [];
      });
      
      // Corrected algorithm to calculate dependencies from flow
      // For flow: A1 -> A2 -> A3 -> A1 -- A4
      // Each agent depends on the next agent in the flow
      // A1 depends on A2, A2 depends on A3, etc.
      // If there's a separation of concerns (-- separator), handle the last element separately
      
      console.log(`AgentParser: DEBUG - uniqueIds:`, uniqueIds);
      console.log(`AgentParser: DEBUG - flow:`, flow);
      
      uniqueIds.forEach(currentId => {
        console.log(`AgentParser: DEBUG - Processing agent ${currentId}`);
        
        // Find all positions where this agent appears in the flow
        const positions = [];
        for (let i = 0; i < flow.length; i++) {
          if (flow[i] === currentId) {
            positions.push(i);
          }
        }
        console.log(`AgentParser: DEBUG - Agent ${currentId} found at positions:`, positions);
        
        // For each position of this agent, find what comes next
        const nextAgents = new Set<string>();
        positions.forEach(pos => {
          if (pos < flow.length - 1) {
            // Add the next agent in sequence
            const nextAgent = flow[pos + 1];
            console.log(`AgentParser: DEBUG - At position ${pos}, next agent is: ${nextAgent}`);
            nextAgents.add(nextAgent);
          } else {
            console.log(`AgentParser: DEBUG - Agent ${currentId} at position ${pos} is at end of sequence`);
          }
        });
        
        console.log(`AgentParser: DEBUG - Agent ${currentId} next agents set:`, Array.from(nextAgents));
        
        // Dependencies are the unique next agents
        dependencies[currentId] = Array.from(nextAgents);
        
        console.log(`AgentParser: DEBUG - Final dependencies for ${currentId}:`, dependencies[currentId]);
      });
      
      // Handle separation of concerns - add the last element with its own dependencies
      if (separationOfConcerns && lastElement) {
        dependencies[lastElement] = [];
        console.log(`AgentParser: Added separation of concerns element ${lastElement} with no dependencies`);
        
        // If we have flow dependencies but no agent definitions, create placeholder agents
        if (agentMap.size === 0) {
          const allAgentIds = [...new Set([...flow, lastElement])];
          allAgentIds.forEach(agentId => {
            // Determine agent type for placeholder based on toolUsers list
            const placeholderName = `Agent_${agentId}`;
            const agentType: 'tool' | 'processing' = toolUsers.includes(placeholderName) ? 'tool' : 'processing';
            
            agentMap.set(agentId, {
              name: placeholderName,
              content: `Placeholder agent for ${agentId}`,
              agentType: agentType
            });
            console.log(`AgentParser: Created placeholder agent for ${agentId} with type ${agentType}`);
          });
        }
      }
    } else {
      // If no sequence, all agents have no dependencies
      agentMap.forEach((_, id) => {
        dependencies[id] = [];
      });
    }

    console.log(`AgentParser: Calculated dependencies:`, dependencies);
    if (separationOfConcerns) {
      console.log(`AgentParser: Separation of concerns:`, separationOfConcerns);
    }

    // Step 3: Create SagaTransaction objects and divide into processing and saving sets
    const allTransactions: SagaTransaction[] = [];
    
    agentMap.forEach((agentInfo, agentId) => {
      const transaction: SagaTransaction = {
        id: agentId,
        name: `${agentInfo.name} Transaction`,
        agentName: agentInfo.name,
        dependencies: dependencies[agentId] || [],
        compensationAction: 'cleanup_conversation_state',
        status: 'pending',
        transactionPrompt: agentInfo.content
      };

      console.log(`AgentParser: Created transaction ${agentId} for ${agentInfo.name} with dependencies: [${transaction.dependencies.join(', ')}]`);
      allTransactions.push(transaction);
    });

    console.log(`AgentParser: Created ${allTransactions.length} SagaTransaction objects`);
    
    // Step 4: Divide transactions into processing and data saving sets
    const processingTransactions: SagaTransaction[] = [];
    const savingTransactions: SagaTransaction[] = [];
    
    if (separationOfConcerns && separationOfConcerns.lastElement) {
      // Find the last element (data saving agent)
      const lastElementId = separationOfConcerns.lastElement;
      
      allTransactions.forEach(transaction => {
        if (transaction.id === lastElementId) {
          savingTransactions.push(transaction);
        } else {
          processingTransactions.push(transaction);
        }
      });
    } else {
      // If no separation of concerns, all are processing transactions
      processingTransactions.push(...allTransactions);
    }
    
    console.log(`AgentParser: Processing transactions: ${processingTransactions.length}, Saving transactions: ${savingTransactions.length}`);
    
    // Step 5: Create TransactionSetCollection
    return this.createTransactionSetCollection(sagaName, sagaDescription, processingTransactions, savingTransactions);
  }

  /**
   * Creates and registers GenericAgent instances from SagaTransaction objects using sagaCoordinator
   * @param transactions Array of SagaTransaction objects
   * @param defaultLLMConfig Default LLM configuration to use for created agents
   * @param sagaCoordinator SagaCoordinator instance to register agents with
   * @returns Array of GenericAgent instances (primarily for fallback when no coordinator)
   */
  static createGenericAgentsFromTransactions(transactions: SagaTransaction[], defaultLLMConfig: LLMConfig, sagaCoordinator?: any): GenericAgent[] {
    return transactions.map(transaction => {
      // Determine agent type based on transaction agent name (already set in agentMap)
      const agentType: 'tool' | 'processing' = 'processing'; // Default, will be overridden by agentMap data
      
      const agentDefinition: AgentDefinition = {
        name: transaction.agentName,
        backstory: `Dynamic agent created from SAGA transaction with ID ${transaction.id}`,
        taskDescription: transaction.transactionPrompt || `Process tasks for ${transaction.agentName}`,
        taskExpectedOutput: 'Structured response based on task requirements',
        llmConfig: defaultLLMConfig,
        dependencies: [],
        agentType: agentType
      };

      console.log(`AgentParser: Creating and registering GenericAgent for ${transaction.agentName} (ID: ${transaction.id}, Type: ${agentType})`);
      
      if (sagaCoordinator && typeof sagaCoordinator.registerAgent === 'function') {
        // Register the agent with the coordinator
        sagaCoordinator.registerAgent(agentDefinition);
        // Return the registered agent from the coordinator's agents map
        return sagaCoordinator.agents.get(transaction.agentName);
      } else {
        // Fallback: create agent directly if no coordinator provided
        console.log(`AgentParser: No coordinator provided, creating agent directly`);
        return new GenericAgent(agentDefinition);
      }
    });
  }

  /**
   * Comprehensive method to parse conversation context and create both SagaTransactions and GenericAgents
   * @param conversationText The text containing agent patterns and sequence information, or an object with result property
   * @param defaultLLMConfig Default LLM configuration to use for created agents
   * @param sagaCoordinator Optional SagaCoordinator instance to register agents with (agents are registered automatically)
   * @returns Object containing SagaTransaction array and GenericAgent array (agents mainly for fallback scenarios)
   */
  static parseAndCreateSagaComponents(conversationText: string | any, defaultLLMConfig: LLMConfig, sagaCoordinator?: any): {
    transactions: SagaTransaction[],
    agents: GenericAgent[]
  } {
    console.log('AgentParser: Starting comprehensive parsing for SAGA components...');
    
    const transactionCollection = this.parseAndCreateSagaTransactions(conversationText);
    // Extract all transactions from the collection sets
    const transactions: SagaTransaction[] = transactionCollection.sets.flatMap(set => set.transactions);
    const agents = this.createGenericAgentsFromTransactions(transactions, defaultLLMConfig, sagaCoordinator);
    
    console.log(`AgentParser: Created ${transactions.length} transactions and ${agents.length} agents`);
    
    return { transactions, agents };
  }

  /**
   * Main method to parse conversation context, create agents, and return transactions
   * @param conversationText The text containing agent patterns
   * @param defaultLLMConfig Default LLM configuration to use for created agents
   * @param sagaCoordinator Optional SagaCoordinator instance to register agents with
   * @returns Array of SagaTransaction objects
   */
  static parseAndCreateAgents(conversationText: string | any,  sagaCoordinator?: any): TransactionSetCollection {
    const transactionCollection = this.parseAndCreateSagaTransactions(conversationText);
    // Extract all transactions from the collection sets
    const transactions: SagaTransaction[] = transactionCollection.sets.flatMap(set => set.transactions);
    
    // Register agents with coordinator if provided, but don't need the return value
    this.createGenericAgentsFromTransactions(transactions, sagaCoordinator);
    
    // Return the transactions as they contain the workflow information
    return transactionCollection;
  }

  /**
   * Creates a TransactionSetCollection with processing and saving transaction sets
   * @param sagaName Name of the saga
   * @param sagaDescription Description of the saga
   * @param processingTransactions Array of processing transactions
   * @param savingTransactions Array of data saving transactions
   * @returns TransactionSetCollection
   */
  private static createTransactionSetCollection(
    sagaName: string, 
    sagaDescription: string, 
    processingTransactions: SagaTransaction[], 
    savingTransactions: SagaTransaction[]
  ): TransactionSetCollection {
    const processingSet: TransactionSet = {
      id: 'processing-set',
      name: 'Data Processing Set',
      description: 'Processing agents that fetch, extract, normalize, group and aggregate data',
      transactions: processingTransactions,
      dependencies: []
    };

    const savingSet: TransactionSet = {
      id: 'saving-set',
      name: 'Data Saving Set', 
      description: 'Data saving agent that stores processed data',
      transactions: savingTransactions,
      dependencies: ['processing-set'] // Depends on processing set completion
    };

    const sets: TransactionSet[] = [processingSet];
    const executionOrder: string[] = ['processing-set'];
    
    // Only add saving set if there are saving transactions
    if (savingTransactions.length > 0) {
      sets.push(savingSet);
      executionOrder.push('saving-set');
    }

    const collection: TransactionSetCollection = {
      id: `saga-collection-${Date.now()}`,
      name: sagaName,
      description: sagaDescription,
      sets: sets,
      executionOrder: executionOrder,
      metadata: {
        version: '1.0.0',
        created: new Date()
      }
    };

    console.log(`AgentParser: Created TransactionSetCollection with ${sets.length} sets`);
    return collection;
  }

  /**
   * Creates an empty TransactionSetCollection for error cases
   * @returns Empty TransactionSetCollection
   */
  private static createEmptyCollection(): TransactionSetCollection {
    return {
      id: `empty-saga-collection-${Date.now()}`,
      name: 'Empty Saga',
      description: 'Empty saga due to parsing error',
      sets: [],
      executionOrder: [],
      metadata: {
        version: '1.0.0',
        created: new Date()
      }
    };
  }
}