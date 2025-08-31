import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { createMCPServerConfig, connectToMCPServer} from '../index.js';
import { GenericAgent } from '../agents/genericAgent.js';
import {SAGA_VALIDATION_COLLECTION,SetExecutionResult, SagaWorkflowRequest,SagaTransaction,TransactionSet, SagaState, HumanInLoopConfig,SAGA_AGENT_GEN_COLLECTION, SAGA_TRANSACTIONS, DEFAULT_SAGA_COLLECTION, TransactionSetCollection, groupingAgentPrompt, codingAgentPrompt,  dataValidatingAgentPrompt } from '../types/visualizationSaga.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { AgentDefinition, AgentResult, LLMConfig, MCPToolCall, MCPServerConfig, WorkingMemory } from '../types/index.js';
import { TransactionRegistry, TransactionRegistryConfig } from '../services/transactionRegistry.js';
import { ContextRegistry, ContextRegistryConfig, ContextSetDefinition, DataSource, LLMPromptConfig } from '../services/contextRegistry.js';
import { ConversationManager, ThreadMessage } from '../services/conversationManager.js';
import { agentData, groupingAgentResult } from '../test/testData.js'
import {AgentParser } from '../agents/agentParser.js'

export class SagaWorkflow {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;
  private codeGenServerConfig: any;
  private initialized: boolean = false;
  private eventBusClient: SAGAEventBusClient;
  private config: HumanInLoopConfig;
  private transactionRegistry: TransactionRegistry;
  private contextRegistry: ContextRegistry;
  private conversationManager: ConversationManager;
  
  // Global thread and message retention
  private currentThreadId: string | null = null;
  private currentUserMessage: string | null = null;
  private lastThreadMessage: ThreadMessage | null = null;
  
  constructor(config: HumanInLoopConfig) {
    this.config = config;
    
    // Create multiple MCP server configurations
    const mcpServers = {
      rag: createMCPServerConfig({
        name: "rag-server",
        transport: "stdio",
        command: "node",
        args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
        timeout: 600000
      }),
      execution: createMCPServerConfig({
        name: "execution-server",
        transport: "stdio",
        command: "node",
        args: ["C:/repos/codeGen-mcp-server/dist/server.js", "--stdio"],
        timeout: 300000
      })
    };

    // Store for backward compatibility
    this.ragServerConfig = mcpServers.rag;
    this.codeGenServerConfig = mcpServers.execution;
    
    // Pass all servers to coordinator
    this.coordinator = new SagaCoordinator(mcpServers);

    this.eventBusClient = new SAGAEventBusClient(config.eventBus.url);
    
    // Initialize TransactionRegistry
    const registryConfig: TransactionRegistryConfig = {
      eventBusUrl: config.eventBus.url,
      defaultTransactionSet: 'visualization'
    };
    this.transactionRegistry = new TransactionRegistry(registryConfig);
    
    // Initialize ContextRegistry
    const contextConfig: ContextRegistryConfig = {
      eventBusUrl: config.eventBus.url,
      defaultContextSet: 'default_visualization_context'
    };
    this.contextRegistry = new ContextRegistry(contextConfig);
    
    // Initialize ConversationManager
    this.conversationManager = new ConversationManager( process.env.ASSISTANT_ID  || '');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Visualization SAGA Processor...');
    
    // Initialize TransactionRegistry first set up event bus listener
    await this.transactionRegistry.initialize();
    
    // Register default visualization transaction set
    this.registerDefaultTransactionSet();
    
    // Initialize ContextRegistry after TransactionRegistry (requirement #4)
    await this.contextRegistry.initialize();
   
    
    // Register default context set for the visualization transaction set
    this.registerDefaultContextSet();
    
    // Connect to RAG server
    try {
    //  await connectToMCPServer(this.ragServerConfig);
      await connectToMCPServer(this.codeGenServerConfig);
      console.log('✅ Connected to RAG MCP server');
    } catch (error) {
      throw new Error(`Failed to connect to RAG server: ${error}`);
    }

    // Ensure data is indexed
    console.log('📊 Ensuring data is indexed...');
   /* const dataSource = await dataPreprocessor.ensureDataIndexed(
      "c:/repos/SAGAMiddleware/data/supply.csv",
      "supply_analysis",
      {
        type: "CSV",
        analysisType: "comprehensive",
        source: "supply.csv",
        indexedAt: new Date().toISOString()
      }
    );

    if (dataSource.status === 'error') {
      throw new Error(`Data preprocessing failed: ${dataSource.error}`);
    }

    console.log(`✅ Data indexed: ${dataSource.chunkCount} chunks available`);*/

    // Register SAGA agents
    this.registerAgents();

    // Set up event listeners
    this.setupEventListeners();

    // Listen for browser requests
    this.setupEventBusListener();

    this.initialized = true;
    console.log('✅ Visualization SAGA Processor initialized');
  }

  /**
   * Register the default visualization transaction set from types
   */
  private registerDefaultTransactionSet(): void {
    console.log('📝 Registering default visualization transaction set...');
    
    this.transactionRegistry.registerDefaultTransactionSet({
      name: 'visualization',
      description: 'Default visualization SAGA transaction set',
      transactions: SAGA_TRANSACTIONS,
    });
    
    // Set as active transaction set
    this.transactionRegistry.setActiveTransactionSet('visualization');
    
    console.log('✅ Default visualization transaction set registered and activated');
  }

  /**
   * Register the default context set for visualization transaction set
   */
  private registerDefaultContextSet(): void {
    console.log('📝 Registering default context set for visualization...');
    
    // Create default data sources (CSV files focus as per requirement #2)
    const defaultDataSources: DataSource[] = [
      {
        id: 'supply_csv',
        name: 'Supply Data',
        type: 'csv',
        path: 'c:/repos/SAGAMiddleware/data/supply.csv',
        metadata: {
          description: 'Supply chain energy data',
          columns: ['timestamp', 'output', 'type', 'location'],
          lastModified: new Date()
        }
      }
    ];
    
    // Create default LLM prompts for each agent (requirement #3)
    const defaultLLMPrompts: LLMPromptConfig[] = [
     
      {
        agentName: 'ConversationAgent',
        agentType: 'processing',
        transactionId: 'tx-1',
        backstory: 'Manage conversation with user as an intermediary passing user instructions to other agents.',
        taskDescription: `You are a passthrough agent. You will recieve information in <context></context>, pass the information between the tags as is.`,
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Pass through the information as received, preserving all formatting and bracket tags. You must provide the opening and closing tags as received: [AGENT...][/AGENT]'
      },
       {
        agentName: 'TransactionGroupingAgent',
        agentType: 'processing',
        transactionId: 'tx-2',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Your role is coordinator. You will receive instructions which will indicate your specific task and the output from thinking through the task to provide meaningful instructions for other agents to enable them to execute their tasks',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Provide information exactly as provided in meaningful terms for each agent in the set. You may frame your response in such a way as would be most beneficial for the receiving agent.'
      }, 
      {
        agentName: 'ValidatingAgent',
        agentType: 'processing',
        transactionId: 'tx-3',
        backstory: `Your role is to ensure rules are enforced in a JSON object. You act as validator and you report what needs 
        to be amended in the JSON object that does not follow the rules.`
        ,
        taskDescription:  dataValidatingAgentPrompt,
        taskExpectedOutput: 'JSON object indicating success or failure of the rules being followed. If failure than provide the solution in the JSON'
      }
      
      /*,
     {
        agentName: 'DataLoadingAgent',
        agentType: 'tool',
        transactionId: 'tx-2-1',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Your task is to pass the data store instructions to the tool handler to carry out the instructions. Therefore, ensure you provide the instructions without modification.',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Expect messages from the data store'
      },
     {
        agentName: 'DataCoordinatingAgent',
        agentType: 'processing',
        transactionId: 'tx-3',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Provide the agent prompts as stipulated by user requirments for a set of agents.',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Provide the agent prompts to be used by the defined agents '
      },
      {
        agentName: 'DataFilteringAgent',
        agentType: 'tool',
        transactionId: 'tx-4',
        backstory: 'Filter and chunk data for processing pipeline.',
        taskDescription: 'Your task is to provide a user query to a data store. You must pass the query exactly as it is without modification.',
        taskExpectedOutput: 'Filtered data chunks ready for presentation processing'
      },
   
      {
        agentName: 'DataExtractingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-1',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Use the inputs provided to create Clean JSON. Only parse JSON and validate required fields exist',
        taskExpectedOutput: 'Provide  Flat list of validated records'
      },
      {
        agentName: 'DataNormalizingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-2',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Convert datetime to date strings',
        taskExpectedOutput: 'Provide same records with added "date" field (YYYY-MM-DD)'
      },
      {
        agentName: 'DataGroupingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-3',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Group by the parameters you are provided in <context>. Only focus on the grouped logic using the input parameters',
        taskExpectedOutput: 'Provide grouped structure grouped by the input parameters'
      },
      {
        agentName:  'DataAggregatingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-4',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Extract values array for each group. Focus only on array extraction. The parameters for the extraction are in <context>',
        taskExpectedOutput: 'Provide Final structure using the input parameters'
      },
      {
        agentName:  'DataSavingAgent',
        agentType: 'tool',
        transactionId: 'tx-5',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Iteratively call a tool to process chunks of data. Be sure to use the tool name you are given to call the correct tool ',
        taskExpectedOutput: 'You should expect feedback from the tool call operation'
      }
    /* 
Task: Extract values array for each group
Input: Grouped records
Output: Final structure {date, installation, values[]}
Focus: Only array extraction
    {
        agentName: 'DataLoadingAgent',
        agentType: 'tool',
        transactionId: 'tx-2',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'The usage of tool calling under appropiate matching of tool with intent to index a file.',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Provide information such as the collection name so another agent can search the vectorized CSV data chunks, Also provide that part of the "user query" which pertains directly to data filtering and not to the indexing'
      },*/
  
    /*  {
        agentName: 'DataFilteringAgent',
        agentType: 'tool',
        transactionId: 'tx-3',
        backstory: 'Provide the search query for a structured query search.',
        taskDescription: 'Use the inputs provided to create a query.',
        taskExpectedOutput: 'Provide only the JSON to be used for the search tools parameters'
      }
      {
        agentName: 'DataStructuringAgent',
        agentType: 'processing',
        transactionId: 'tx-4-1',
        backstory: 'You compute the values that meet the requirements.',
        taskDescription: 'Structure input data so that it is suitable as input for other operations',
        taskExpectedOutput: 'Provide structured data as required for a specific operation'
      },
      {
        agentName: 'DataReflectingAgent',
        agentType: 'processing',
        transactionId: 'tx-4-2',
        backstory: 'You compute the values that meet the requirements.',
        taskDescription: 'Your task is to reflect on the input you receive and pose questions',
        taskExpectedOutput: 'Provide questions in a structured way'
      }*/
    ];
    
    const defaultContextSet: ContextSetDefinition = {
      name: 'default_visualization_context',
      transactionSetName: 'visualization', // Links to the transaction set (requirement #1)
      description: 'Default context set for visualization SAGA with CSV data sources',
      dataSources: defaultDataSources,
      llmPrompts: defaultLLMPrompts,
      userQuery: this.currentUserMessage as string
    };
    
    // Register the context set
    this.contextRegistry.registerDefaultContextSet(defaultContextSet);
    
    // Activate it for the visualization transaction set
    this.contextRegistry.activateContextSetForTransactionSet('visualization', 'default_visualization_context');
    
    // Initialize ConversationManager after context setup
    console.log('🧵 ConversationManager initialized with assistant ID:', process.env.OPENAI_ASSISTANT_ID || 'not set');
    
    console.log('✅ Default context set registered and activated for visualization transaction set');
  }

   private registerAgents(): void {
      console.log('🔧 Registering Visualization SAGA agents...');

      // Get all llmPrompts and extract unique agent names
      const contextSet = this.contextRegistry.getContextSetForTransactionSet('visualization');
      if (!contextSet) {
        throw new Error('No context set found for visualization transaction set');
      }
      const uniqueAgentNames = [...new Set(contextSet.llmPrompts.map(prompt => prompt.agentName))];
      
      // Extract agent types for each unique agent
      const agentTypes = new Map<string, string>();
      for (const prompt of contextSet.llmPrompts) {
        agentTypes.set(prompt.agentName, prompt.agentType);
      }

      // Create mapping from agentName to transactionId
      const agentTransactionMapping = new Map<string, string>();
      for (const prompt of contextSet.llmPrompts) {
        agentTransactionMapping.set(prompt.agentName, prompt.transactionId);
      }

      // Create agents dynamically from llmPrompts
      for (const agentName of uniqueAgentNames) {
        let agent: AgentDefinition;
        const agentType = agentTypes.get(agentName);
        const transactionId = agentTransactionMapping.get(agentName);
        
        if (agentType === 'tool') {
          agent = this.createAgentFromLLMPrompts(agentName, transactionId, [this.codeGenServerConfig]);
        } else {
          agent = this.createAgentFromLLMPrompts(agentName, transactionId);
        }
        
        this.coordinator.registerAgent(agent);
        console.log(`✅ Registered agent: ${agentName}`);
      }

      console.log('✅ All SAGA agents registered');
    }

    private createAgentFromLLMPrompts(agentName: string, transactionId?: string, mcpServers?: MCPServerConfig[]): AgentDefinition {
      // Get llmPrompts for this agent from the context registry
      const llmPrompts = this.contextRegistry.getLLMPromptsForAgent('visualization', agentName);
      
      if (llmPrompts.length === 0) {
        throw new Error(`No LLM prompts found for agent: ${agentName}`);
      }

      // Use the first prompt as the base configuration
      const basePrompt = llmPrompts[0];
      
      // Get LLM configuration from prompt parameters if available, otherwise use defaults
      const promptParams = basePrompt.parameters || {};
      
      // Get agent type from llmPrompts
      const agentType = basePrompt.agentType as 'tool' | 'processing';
      
      // Create LLM config based on agent type
      const llmConfig: LLMConfig = {
        provider: 'openai',
        model: promptParams.model || (agentType === 'tool' ? 'gpt-5' : 'gpt-5'), //gpt-5 gpt-4o-mini
        temperature: 1,// promptParams.temperature || (agentType === 'tool' ? 0.2 : 0.3),//temp 1
        maxTokens: promptParams.maxTokens || (agentType === 'tool' ? 2000 : 1500),
        apiKey: process.env.OPENAI_API_KEY
      };

      // Create base context from llmPrompts
    /*  let context = basePrompt.context || {};
      
      // Add specific context for data_filtering agent
      if (agentName === 'DataFilteringAgent') {
        context = {
          ...context,
          collection: 'supply_analysis',
          maxChunks: 50
        };
      }*/
      let context = basePrompt.context || {};
      // Create agent definition using information from llmPrompts
      const agentDefinition: AgentDefinition = {
        id: transactionId || '',
        name: agentName,
        backstory: basePrompt.backstory,
        taskDescription: basePrompt.taskDescription,
        taskExpectedOutput: basePrompt.taskExpectedOutput,
        llmConfig,
        context,
        dependencies: [],
        agentType: agentType,
        mcpServers: mcpServers || []
      };

      return agentDefinition;
    }
  
    private setupEventListeners(): void {
      this.coordinator.on('saga_initialized', (state: SagaState) => {
        console.log(`🎯 [SAGA] Initialized: ${state.id} (${state.totalTransactions} transactions)`);
      });
  
      this.coordinator.on('transaction_started', (event: any) => {
        console.log(`🔄 [SAGA] Transaction started: ${event.name} (${event.transaction})`);
      });
  
      this.coordinator.on('transaction_completed', (event: any) => {
        console.log(`✅ [SAGA] Transaction completed: ${event.name}`);
      });
  
      this.coordinator.on('saga_completed', (state: SagaState) => {
        const duration = state.endTime ? state.endTime.getTime() - state.startTime.getTime() : 0;
        console.log(`🎉 [SAGA] Completed: ${state.id} in ${Math.round(duration / 1000)}s`);
      });
  
      this.coordinator.on('saga_failed', (event: any) => {
        console.log(`💥 [SAGA] Failed: ${event.error}`);
      });
  
      this.coordinator.on('compensation_executed', (event: any) => {
        console.log(`↪️ [SAGA] Compensation executed: ${event.action} for ${event.agentName}`);
      });
    }

     /**
   * Setup event bus listener for start-graph-request events from browser
   */
  private async setupEventBusListener(): Promise<void> {
    console.log('🔧 Setting up Event Bus listener for browser requests...');
    
    // Wait for event bus connection
    let attempts = 0;
    while (!this.eventBusClient.isEventBusConnected() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!this.eventBusClient.isEventBusConnected()) {
      console.error('❌ Failed to connect to Event Bus after 30 seconds');
      return;
    }
    
    console.log('✅ Event Bus connected, setting up message listener...');
    
    // Access the socket directly to listen for events
    const socket = this.eventBusClient['socket'];
    
    socket.on('event_received', async (message: any) => {
       if (message.type === 'thread_id_response' && message.source === 'react-app') {
        console.log(`🧵 Received thread_id_response from browser:` + JSON.stringify(message.data));
        await this.handleOpenAIThreadRequest(message)
       } else if (message.type === 'start-graph-request' && message.source === 'react-app') {
        console.log(`📊 Received start-graph-request from browser: ${JSON.stringify(message.data)}`);
      //  await this.handleBrowserGraphRequest(message);
      } else if (message.type === 'enhanced_graph_request') {
        console.log(`📊 Received enhanced routed graph request with priority: ${message.data.routingInfo?.priority}`);
   //     await this.handleEnhancedBrowserRequest(message.data.browserRequest, message.data.routingInfo);
      } else if (message.type === 'human_loop_graph_request') {
        console.log(`📊 Received legacy routed graph request: ${JSON.stringify(message.data)}`);
     //   await this.handleBrowserGraphRequest(message.data.originalMessage);
      }
    });
    
    console.log('🎧 Listening for browser graph requests via service bus...');
  }

  /**
   * Handle OpenAI thread request from browser
   */
  private async handleOpenAIThreadRequest(message: any): Promise<void> {
    try {
      console.log(`🧵 Processing OpenAI thread request from browser...`);
      
      // Test AgentParser with imported test data
      console.log('🧪 Testing AgentParser with new format data...');
   
      
      // Test with a simple example that matches your expected sequence
      const testData = {
        result: `[AGENT: OrchestratorAgent, ORCH-01]
Task: Coordinate the overall workflow
[/AGENT]

[AGENT: QueryAgent, QUERY-01]
Task: Execute structured query tool
[/AGENT]

[AGENT: ProcessingAgent, PROC-01]
Task: Process the data
[/AGENT]

[AGENT: MergeAgent, MERGE-01]
Task: Merge the results
[/AGENT]

SEQUENCE:
{ORCH-01 -> QUERY-01 -> PROC-01 -> MERGE-01 -> ORCH-01}`
      };
      
      console.log('🔄 Testing direct SagaTransaction parsing with test sequence...');
    /*  const transactions = AgentParser.parseAndCreateSagaTransactions(agentData);
    //  console.log(`✅ Created ${transactions.length} SagaTransaction objects directly`);
      
      console.log('📋 SagaTransactions:');
      transactions.forEach(tx => {
        console.log(`   - Transaction ${tx.id}: ${tx.agentName}, Dependencies: [${tx.dependencies.join(', ')}]`);
      });*/
      
      // Extract threadId from message
      const { data } = message;
      const threadId = data.threadId;
      
      if (!threadId) {
        console.error('❌ No threadId provided in thread_id_response');
        return;
      }
      
      // Store thread globally for retention
      this.currentThreadId = threadId;
      
      // Fetch latest message from OpenAI thread
      const threadMessage = await this.conversationManager.fetchLatestThreadMessage(threadId);
      
      if (!threadMessage) {
        console.error(`❌ No user message found in thread ${threadId}`);
        return;
      }
      
      // Store message globally for retention
      this.currentUserMessage = threadMessage.userMessage;
      this.lastThreadMessage = threadMessage;
      
      console.log(`📝 Fetched user message: ${threadMessage.userMessage.substring(0, 100)}...`);
      
      // Create browser request from thread message
      const browserRequest: BrowserGraphRequest = {
        userQuery: threadMessage.userMessage,
        correlationId: ''
      };
      
      // Execute SAGA with thread context
      await this.executeThreadVisualizationSAGA(browserRequest, threadId);
      
    } catch (error) {
      console.error('❌ Error handling OpenAI thread request:', error);
      
      // Send error response back to thread if possible
      if (this.currentThreadId) {
        try {
        /*  await this.conversationManager.sendResponseToThread(
            this.currentThreadId, 
            'I encountered an error processing your request. Please try again.'
          );*/
        } catch (responseError) {
          console.error('❌ Failed to send error response to thread:', responseError);
        }
      }
    }
  }

  /**
   * Execute visualization SAGA specifically for OpenAI thread requests
   */
  private async executeThreadVisualizationSAGA(browserRequest: BrowserGraphRequest, threadId: string): Promise<void> {
    try {
      console.log(`🧵 Executing Thread Visualization SAGA for thread: ${threadId}`);
      
      // Get active transaction set
      const activeTransactionSet = this.transactionRegistry.getActiveTransactionSet();
      if (!activeTransactionSet) {
        throw new Error('No active transaction set found');
      }
      console.log("COUNT TRSN ", activeTransactionSet.transactions.length)
      // Get the active context set for this transaction set
      const activeContextSet = this.contextRegistry.getContextSetForTransactionSet(activeTransactionSet.name);
      // Using context set: default_visualization_context for transaction set: visualization
      console.log(`🔄 Using context set: ${activeContextSet?.name || 'none'} for transaction set: ${activeTransactionSet.name}`);

       
      
      // Execute SAGA through coordinator using the new executeTransactionSetCollection method
      const result = await this.coordinator.executeTransactionSetCollection(
        browserRequest,
        DEFAULT_SAGA_COLLECTION,
        `thread_saga_${threadId}_${Date.now()}`,
        activeContextSet
      );
      
      this.coordinator.getAgents
      let sagaTransactionName = '';
            let sagaTransactionId = '';
            const names: string[] =[];
            const ids: string[] =[];
            const transResults: SetExecutionResult = result.transactionResults['processing-set'];
            
            Object.values(transResults.transactionResults).forEach((transactionSet: TransactionSet) => {
          transactionSet.transactions.forEach((transaction: SagaTransaction) => {
            console.log('NAME ', transaction.agentName)
            for (const flow of this.coordinator.agentFlows) {
                console.log('FLOW 1', flow)
                const transactionIndex = flow.indexOf(transaction.id);
                if (transactionIndex === -1 || transaction.agentName === 'TransactionGroupingAgent') continue;}
                    this.coordinator.currentExecutingTransactionSet?.push(transaction);
                    names.push(transaction.agentName);
                    ids.push(transaction.id);
                    sagaTransactionName = transaction.agentName;
                    sagaTransactionId = transaction.id;
            }) 
          });
            console.log('LATEST LINEAR ',sagaTransactionName)
            try{
                  const toolCtx = this.coordinator.contextManager.getContext(sagaTransactionName) as WorkingMemory;
                  const agent = this.coordinator.agents.get('TransactionGroupingAgent');
                  agent?.deleteContext();
                  if(groupingAgentPrompt){
                    if(names){
                        const priorName =  names[0]
                        const priorId =  ids[0]
                        const prompt = groupingAgentPrompt + 'name: ' + priorName + ' id: ' +  priorId //eg coder before tool caller
                        agent?.setTaskDescription(prompt);
                        const codeAgent = this.coordinator.agents.get(priorName);
                        codeAgent?.setTaskDescription(codingAgentPrompt);
                    }  
                  }
                  console.log('TOOL CTX ', toolCtx.lastActionResult)
                  console.log('TOOL CTX PREV', toolCtx.previousResult)
                  agent?.receiveContext({'Tool_Call_Result: ': transResults.result})
                  agent?.receiveContext({'Previous_Code: ': toolCtx.previousResult});
                  this.coordinator.agentFlows[0].unshift('tx-2');
                  this.coordinator.agentFlows[0].push('tx-2');
            } catch(error){
                console.log('ERROR 1', error)
            }

    /*   const resultNext = await this.coordinator.executeTransactionSetCollection(
        browserRequest,
        SAGA_VALIDATION_COLLECTION,
        `thread_saga_${threadId}_${Date.now()}`,
        activeContextSet
      );*/
      
      console.log('HEERERERWQRWER')
      // Send response back to thread
      if (result.success) {
        const responseMessage = result.result || 'Your request has been processed successfully.';
     //   await this.conversationManager.sendResponseToThread(threadId, responseMessage);
        console.log(`✅ Thread SAGA completed successfully for thread: ${threadId}`);
      } else {
        const errorMessage = `I encountered an issue processing your request: ${result.error || 'Unknown error'}`;
     //   await this.conversationManager.sendResponseToThread(threadId, errorMessage);
        console.log(`❌ Thread SAGA failed for thread: ${threadId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error executing Thread Visualization SAGA:`, error);
      
      // Send error response to thread
      try {
        const errorMessage = 'I encountered a technical error. Please try again or rephrase your request.';
       // await this.conversationManager.sendResponseToThread(threadId, errorMessage);
      } catch (responseError) {
        console.error('❌ Failed to send error response to thread:', responseError);
      }
    }
  }
}

// Main execution function
export async function runVisualizationSAGAExample(): Promise<void> {
    const config: HumanInLoopConfig = {
  /*    timeouts: {
        specificationReviewTimeout: 24 * 60 * 60 * 1000, // 24 hours
        codeReviewTimeout: 48 * 60 * 60 * 1000, // 48 hours
        finalApprovalTimeout: 7 * 24 * 60 * 60 * 1000, // 1 week
        maxTransactionLifetime: 30 * 24 * 60 * 60 * 1000, // 30 days
        onTimeout: 'compensate',
        compensationActions: {
          notifyUser: true,
          archiveArtifacts: true,
          releaseResources: true,
          emailNotification: true
        }
      },*/
      services: {
        ragService: 'http://localhost:3001',
        codingService: 'http://localhost:3002',
        humanInterface: 'http://localhost:3004',
        persistence: 'redis://localhost:6379'
      },
      eventBus: {
        url: 'http://localhost:3003',
        topics: ['saga_events', 'human_events'],
        retryAttempts: 3
      },
      humanInterface: {
        approvalBaseUrl: 'http://localhost:3004',
        emailNotifications: true,
        slackNotifications: false
      },
      persistence: {
        provider: 'database',
        retentionDays: 90,
        backupEnabled: true
      }
    };
  
  const processor = new SagaWorkflow(config);

  try {
    await processor.initialize();
     // Wait a bit for the event bus connection to be established
    await new Promise(resolve => setTimeout(resolve, 2000));
   // await processor.executeSimpleVisualizationSAGA();
    console.log('📡 Coordinator is now listening for browser requests via event bus...');
    console.log('💡 Send start-graph-request messages from react-app to trigger processing');
    console.log('');
    console.log('Press Ctrl+C to exit...');

    console.log('\n✨ Visualization SAGA processing complete!');
    console.log('Press any key to exit...');
    
    // Keep console open
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => process.exit(0));
    } catch (stdinError) {
      console.log('Waiting 10 seconds before exit...');
      setTimeout(() => process.exit(0), 10000);
    }

  } catch (error) {
    console.error('💥 Visualization SAGA processing failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('visualizationSagaProcessing.js') || process.argv[1].endsWith('visualizationSagaProcessing.ts')) {
  runVisualizationSAGAExample();
}