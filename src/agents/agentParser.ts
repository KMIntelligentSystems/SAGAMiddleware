import { GenericAgent } from './genericAgent.js';
import { AgentDefinition, LLMConfig } from '../types/index.js';
import { SagaTransaction, TransactionSetCollection, TransactionSet } from '../types/visualizationSaga.js';


export class AgentParser {
  /**
   * Parses conversation context and creates TransactionSetCollection with processing and saving agent sets
   * Format: [AGENT: agentName, id] ... [/AGENT] and <flow>A1 -> A2 -> A3 -> A1 -- A4</flow>
   * @param conversationText The text containing agent patterns [AGENT: name, id]...[/AGENT]
   * @param flowData The text containing flow information <flow>...</flow> and {"toolUsers": [...]}
   * @returns TransactionSetCollection with processing agents and data saving agent in separate sets
   */
  static parseAndCreateSagaTransactions(conversationText: string | any, flowData?: string | any, sagaCoordinator?: any): TransactionSetCollection {
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
    // Replace [AGENT followed by space with [AGENT: (handles cases like '[AGENT Python Executor')
    textToParse = textToParse.replace(/\[AGENT\s+([^:,\]]+)/g, '[AGENT: $1');                       
    if(textToParse.includes('[ / AGENT]')){
      textToParse = textToParse.replace(/\[\s*\/\s*AGENT\]/g, '[/AGENT]');
    }
     if(textToParse.includes('/AGENT]') && !textToParse.includes('[/AGENT]')){
      textToParse = textToParse.replace('/AGENT]', '[/AGENT]');
    }

    console.log(`AgentParser: Processing text of length ${textToParse.length}`);
    console.log(`AgentParser: First 200 characters: ${textToParse.substring(0, 200)}`);
    
    // Clean up string concatenation artifacts
    textToParse = textToParse
      .replace(/\'\s*\+\s*[\r\n]\s*\'/g, '') // Remove ' + \n '
      .replace(/\'\s*\+\s*\'/g, '') // Remove ' + '
      .replace(/\\\'/g, "'") // Replace escaped quotes
      .replace(/\\\"/g, '"'); // Replace escaped quotes

    // Step 1: Parse agents from conversationText
    console.log(`AgentParser: Parsing agents from conversationText`);
    
    // Step 1.1: Parse flow data if provided
    let flowToParse: string = '';
    let sagaName = 'Visualization_Saga'; // Default
    let sagaDescription = 'Data for the saga'; // Default
    let toolUsers: string[] = [];
    
    if (flowData) {
      if (typeof flowData === 'string') {
        flowToParse = flowData;
      } else if (flowData && typeof flowData === 'object' && flowData.result) {
        flowToParse = flowData.result;
      }
      
      // Clean up flow data string concatenation artifacts
      flowToParse = flowToParse
        .replace(/\'\s*\+\s*[\r\n]\s*\'/g, '') // Remove ' + \n '
        .replace(/\'\s*\+\s*\'/g, '') // Remove ' + '
        .replace(/\\\'/g, "'") // Replace escaped quotes
        .replace(/\\\"/g, '"'); // Replace escaped quotes
      
      console.log(`AgentParser: Processing flow data of length ${flowToParse.length}`);
      console.log(`AgentParser: First 200 characters of flow data: ${flowToParse.substring(0, 200)}`);
      
      // Parse Name and Description from flow data
      const namePattern = /Name:\s*[\"']?([^\"'\n]+)[\"']?/;
      const descriptionPattern = /Description:\s*[\"']?([^\"'\n]+)[\"']?/;
      
      const nameMatch = flowToParse.match(namePattern);
      const descriptionMatch = flowToParse.match(descriptionPattern);
      
      if (nameMatch) {
        sagaName = nameMatch[1].trim();
        console.log(`AgentParser: Found saga name: ${sagaName}`);
      }
      
      if (descriptionMatch) {
        sagaDescription = descriptionMatch[1].trim();
        console.log(`AgentParser: Found saga description: ${sagaDescription}`);
      }
      
      // Parse toolUsers JSON from flow data
      const toolUsersPattern = /\{"toolUsers":\s*(\[[^\]]+\])\}/;
      const toolUsersMatch = flowToParse.match(toolUsersPattern);
      
      if (toolUsersMatch) {
        try {
          const toolUsersArray = JSON.parse(toolUsersMatch[1]);
          toolUsers = toolUsersArray.map((name: string) => name.trim());
          console.log(`AgentParser: Found toolUsers:`, toolUsers);
        } catch (error) {
          console.log(`AgentParser: Error parsing toolUsers JSON:`, error);
          // Fallback to original parsing method
          const toolUsersString = toolUsersMatch[1].replace(/[\[\]]/g, '');
          toolUsers = toolUsersString.split(',').map(name => name.trim().replace(/"/g, ''));
        }
      }
    }
    
    const agentPattern = /\[AGENT:\s*([^,]+),\s*([^\]]+)\](.*?)\[\/AGENT\]/gs;
    const  agentMap = new Map<string, { name: string; content: string; agentType: 'tool' | 'processing' }>();
    
    console.log(`AgentParser: DEBUG - Looking for agent patterns in cleaned text`);
    console.log(`AgentParser: DEBUG - Cleaned text length: ${textToParse.length}`);
    console.log(`AgentParser: DEBUG - First 500 chars of cleaned text:`, JSON.stringify(textToParse.substring(0, 500)));
    console.log(`AgentParser: DEBUG - Agent regex pattern:`, agentPattern);
    
    let match;
    while ((match = agentPattern.exec(textToParse)) !== null) {
      const agentName = match[1].trim();
      const agentId = match[2].trim();
      const content = match[3].trim();
      //AgentParser: DEBUG - Raw match results: { agentName: ': name', agentId: 'id', contentLength: 3 }
      console.log(`AgentParser: DEBUG - Raw match results:`, {
        agentName,
        agentId,
        contentLength: content.length
      });
      
      // Initially set as processing - will be updated after flow parsing if needed
      const agentType: 'tool' | 'processing' = 'processing';
      //AgentParser: Found agent ": name" with ID "id", initial type "processing"
      console.log(`AgentParser: Found agent "${agentName}" with ID "${agentId}", initial type "${agentType}"`);
      if(agentId !== 'id' && !agentName.includes('name')){
         agentMap.set(agentId, { name: agentName, content, agentType });
      }
     
    }
    
    console.log(`AgentParser: DEBUG - Total agents found: ${agentMap.size}`);

    // Step 2: Parse flow and calculate dependencies with separation of concerns
    const flowPattern = /<flow>(.*?)<\/flow>/s;
    const flowMatch = flowToParse.match(flowPattern);
    
    console.log(`AgentParser: DEBUG - Looking for flow pattern in flow data`);
    const flowIndex = flowToParse.indexOf('<flow>');
    if (flowIndex >= 0) {
      const flowText = flowToParse.substring(flowIndex, flowIndex + 100);
      console.log(`AgentParser: DEBUG - Text around <flow>:`, JSON.stringify(flowText));
    }
    console.log(`AgentParser: DEBUG - Flow regex result:`, flowMatch);
    
    const dependencies: { [agentId: string]: string[] } = {};
    let separationOfConcerns: { dependencies: string[], lastElement: string } | null = null;
    let flow: string[] = [];
    if (flowMatch) {
      const fullFlowContent = flowMatch[1].trim();
      console.log(`AgentParser: Found full flow content: ${fullFlowContent}`);
      
      console.log('toolUsers     ',toolUsers)
      // Update agent types based on toolUsers array (now that we have the complete list)
      //AGENTS NAME : name
      //AGENTS type processing
      //AGENTS NAME PythonDataNormalizationCoder

      agentMap.forEach((agent, agentId) => {
        console.log('AGENTS NAME',agent.name)
         console.log('AGENTS type',agent.agentType)
        const updatedType: 'tool' | 'processing' = toolUsers.includes(agent.name) ? 'tool' : 'processing';
        if (updatedType !== agent.agentType) {
          console.log(`AgentParser: Updating agent "${agent.name}" type from "${agent.agentType}" to "${updatedType}"`);
          agentMap.set(agentId, { ...agent, agentType: updatedType });
        }
      });
      
      // Extract just the flow diagram part (before any JSON)
      const flowString = fullFlowContent.split('\n')[0].trim();
      console.log(`AgentParser: Found flow diagram: ${flowString}`);
      
      // Check for separation of concerns pattern (-- separator)
      
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
      }
    } else {
      // If no sequence, all agents have no dependencies
      agentMap.forEach((_, id) => {
        dependencies[id] = [];
      });
    }
     
    if (sagaCoordinator && typeof sagaCoordinator.registerAgentFlows === 'function') {
      console.log('HERE IN REGISTER')
        sagaCoordinator.registerAgentFlows(flow);
    }

    console.log(`AgentParser: Calculated dependencies:`, dependencies);
    if (separationOfConcerns) {
      console.log(`AgentParser: Separation of concerns:`, separationOfConcerns);
    }
/*
AgentParser: Calculated dependencies: {
  'SQ-001': [ 'DNM-002' ],
  'DNM-002': [ 'ACC-003' ],
  'ACC-003': [ 'LSP-004' ],
  'LSP-004': [ 'SQ-001' ],
  'FTS-005': []
}
AgentParser: Separation of concerns: {
  dependencies: [ 'SQ-001', 'DNM-002', 'ACC-003', 'LSP-004', 'SQ-001' ],
  lastElement: 'FTS-005'
}

AgentParser: Created transaction SQ-001 for StructuredQueryBuilder (type: tool) with dependencies: [DNM-002]
AgentParser: Created transaction DNM-002 for PageNormalizer (type: processing) with dependencies: [ACC-003]
AgentParser: Created transaction ACC-003 for PageAccumulator (type: processing) with dependencies: [LSP-004]
AgentParser: Created transaction LSP-004 for PageLocalPersistPrep (type: processing) with dependencies: [SQ-001]
AgentParser: Created transaction FTS-005 for FinalTotalsSaver (type: tool) with dependencies: []

*/
    // Step 3: Create SagaTransaction objects and divide into processing and saving sets
    const allTransactions: SagaTransaction[] = [];
    
    agentMap.forEach((agentInfo, agentId) => {
      const transaction: SagaTransaction = {
        id: agentId,
        name: `${agentInfo.name} Transaction`,
        agentName: agentInfo.name,
        agentType: agentInfo.agentType,
        dependencies: dependencies[agentId] || [],
        compensationAction: 'cleanup_conversation_state',
        status: 'pending',
        transactionPrompt: agentInfo.content
      };

//AgentParser: Created transaction id for : name (type: processing) with dependencies: []
//AgentParser: Created transaction CODER_PY_001 for PythonDataNormalizationCoder (type: processing) with dependencies: [TOOL_EXEC_001]
//AgentParser: Created transaction TOOL_EXEC_001 for ExecutePythonToolCaller (type: tool) with dependencies: []
      console.log(`AgentParser: Created transaction ${agentId} for ${agentInfo.name} (type: ${agentInfo.agentType}) with dependencies: [${transaction.dependencies.join(', ')}]`);
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
   * @param sagaCoordinator SagaCoordinator instance to register agents with
   * @returns Array of GenericAgent instances (primarily for fallback when no coordinator)
   */
  static createGenericAgentsFromTransactions(transactions: SagaTransaction[], sagaCoordinator?: any): GenericAgent[] {
    return transactions.map(transaction => {
      // Use agent type from transaction (set during parsing based on agentMap data)
      const agentType: 'tool' | 'processing' = transaction.agentType || 'processing';
      
      const agentDefinition: AgentDefinition = {
        id: transaction.id,
        name: transaction.agentName,
        backstory: `Dynamic agent created from SAGA transaction with ID ${transaction.id}`,
        taskDescription: transaction.transactionPrompt || `Process tasks for ${transaction.agentName}`,
        taskExpectedOutput: 'Structured response based on task requirements',
        llmConfig: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000,  provider: 'openai' },
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
   * @param conversationText The text containing agent patterns [AGENT: name, id]...[/AGENT]
   * @param flowData The text containing flow information <flow>...</flow> and {"toolUsers": [...]}
   * @param sagaCoordinator Optional SagaCoordinator instance to register agents with (agents are registered automatically)
   * @returns Object containing SagaTransaction array and GenericAgent array (agents mainly for fallback scenarios)
   */
  static parseAndCreateSagaComponents(conversationText: string | any, flowData?: string | any, sagaCoordinator?: any): {
    transactions: SagaTransaction[],
    agents: GenericAgent[]
  } {
    console.log('AgentParser: Starting comprehensive parsing for SAGA components...');
    
    const transactionCollection = this.parseAndCreateSagaTransactions(conversationText, flowData);
    // Extract all transactions from the collection sets
    const transactions: SagaTransaction[] = transactionCollection.sets.flatMap(set => set.transactions);
    const agents = this.createGenericAgentsFromTransactions(transactions, sagaCoordinator);
    
    console.log(`AgentParser: Created ${transactions.length} transactions and ${agents.length} agents`);
    
    return { transactions, agents };
  }

  /**
   * Main method to parse conversation context, create agents, and return transactions
   * @param conversationText The text containing agent patterns [AGENT: name, id]...[/AGENT]
   * @param flowData The text containing flow information <flow>...</flow> and {"toolUsers": [...]}
   * @param sagaCoordinator Optional SagaCoordinator instance to register agents with
   * @returns Array of SagaTransaction objects
   */
  static parseAndCreateAgents(conversationText: string | any, flowData?: string | any, sagaCoordinator?: any): TransactionSetCollection {
    const transactionCollection = this.parseAndCreateSagaTransactions(conversationText, flowData,  sagaCoordinator);
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