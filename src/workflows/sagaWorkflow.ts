import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { createMCPServerConfig, connectToMCPServer} from '../index.js';
import { SagaState, HumanInLoopConfig,

  groupingAgentPrompt, codingAgentErrorPrompt,  dataValidatingAgentPrompt, csvAnalysisRefectingAgentPrompt, 
 SVGInterpreterPrompt, toolValidationPrompt } from '../types/visualizationSaga.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { BrowserGraphRequest } from '../eventBus/types.js';
import { AgentDefinition, AgentResult, LLMConfig, MCPToolCall, MCPServerConfig, WorkingMemory} from '../types/index.js';
import { TransactionRegistry, TransactionRegistryConfig } from '../services/transactionRegistry.js';
import { ContextRegistry, ContextRegistryConfig, ContextSetDefinition, DataSource, LLMPromptConfig } from '../services/contextRegistry.js';
import { ConversationManager, ThreadMessage } from '../services/conversationManager.js';
import { codeWriterTaskDescription, codeExecutorTaskDescription, codeWriterResult, codeExecutorResult, visCodeWriterTaskDescription, 
  visCodeExecutorTaskDescription, graphAnalyzerResult, agentConstructorInput } from '../test/testData.js'
import {AgentParser } from '../agents/agentParser.js'
import { PythonLogAnalyzer } from '../processing/pythonLogAnalyzer.js';
import { PipelineExecutor } from '../workflows/pipelineExecutor.js';
import { DATA_PROFILING_PIPELINE, D3_VISUALIZATION_PIPELINE,  D3_CODE_UPDATE_PIPELINE ,  PYTHON_CODE_UPDATE_PIPELINE} from '../types/pipelineConfig.js'
import { claudeMDResuilt } from '../test/histogramData.js'

import * as fs from 'fs'



// Default control flow list for saga coordinator
const CONTROL_FLOW_LIST = [
  { agent: 'TransactionGroupingAgent', process: 'DefineUserRequirementsProcess', targetAgent: 'DataProfiler' },
  { agent: 'DataProfiler', process: 'agentGeneratorProcess', targetAgent: 'FlowDefiningAgent' },
  { agent: 'FlowDefiningAgent', process: 'FlowProcess', targetAgent: 'TransactionGroupingAgent' },
/*  { agent: 'VisualizationCoordinatingAgent', process: 'DefineUserRequirementsProcess' },
  { agent: 'ValidatingAgent', process: 'ValidationProcess', targetAgent: 'VisualizationCoordinatingAgent' },
  { agent: 'FlowDefiningAgent', process: 'FlowProcess', targetAgent: 'VisualizationCoordinatingAgent', },
  { agent: 'D3JSCoordinatingAgent', process:'DefineUserRequirementsProcess'},
  { agent: 'ValidatingAgent', process: 'ValidationProcess', targetAgent: 'D3JSCoordinatingAgent' },
  { agent: 'FlowDefiningAgent', process: 'FlowProcess', targetAgent: 'D3JSCoordinatingAgent', },
  { agent: 'D3JSCoordinatingAgent', process: 'DataAnalysisProcess' },
  { agent: 'D3JSCoordinatingAgent', process: 'DataSummarizingProcess' },
  { agent: 'D3JSCodingAgent', process: 'D3JSCodingProcess', targetAgent: 'D3JSCoordinatingAgent' }, //
 // { agent: 'ValidatingAgent', process: 'ValidationProcess', targetAgent: 'D3JSCodingAgent' },*/
];

const VALIDATE_D3JS_CODE_FLOW_LIST = [
  { agent: 'D3JSCodingAgent', process: 'D3JSCodingProcess', targetAgent: 'D3JSCoordinatingAgent' },
]

const CONTROL_UPDATE_CODE_FLOW_LIST = [
  { agent: 'D3JSCodingAgent', process: 'D3JSCodingProcess', targetAgent:'ValidatingAgent' }
]


const GENERATE_REFLECT_FLOW_LIST = [
  { agent: 'GeneratingAgent', process: 'GenReflectProcess', targetAgent: 'ValidatingAgent'},
//  { agent: 'ValidatingAgent', process: 'ValidationProcess', targetAgent: 'D3JSCodingAgent' },
]


export class SagaWorkflow {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;
  private codeGenServerConfig: any;
  private playwrightServerConfig: any;
  private initialized: boolean = false;
  private eventBusClient: SAGAEventBusClient;
  private config: HumanInLoopConfig;
  private transactionRegistry: TransactionRegistry;
  private contextRegistry: ContextRegistry;
  //private conversationManager: ConversationManager;
  private pythonLogAnalyzer: PythonLogAnalyzer;
  
  // Global thread and message retention
  private currentThreadId: string;
  private currentUserMessage: string | null = null;
  private lastThreadMessage: ThreadMessage | null = null;
  
  constructor(config: HumanInLoopConfig) {
    this.config = config;
    this.currentThreadId= '';
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
      }),
      playwright: createMCPServerConfig({
        name: "playwright-server",
        transport: "stdio",
        command: "node",
        args: ["C:/repos/playwright-mcp-server/dist/server.js"],
        timeout: 300000
      })
    };

    // Store for backward compatibility
    this.ragServerConfig = mcpServers.rag;
    this.codeGenServerConfig = mcpServers.execution;
    this.playwrightServerConfig = mcpServers.playwright;
    
    // Pass all servers to coordinator
    this.coordinator = new SagaCoordinator(mcpServers);

    this.eventBusClient = new SAGAEventBusClient(config.eventBus.url);
    
    // Initialize TransactionRegistry
    const registryConfig: TransactionRegistryConfig = {
      eventBusUrl: config.eventBus.url,
      defaultTransactionSet: 'visualization'
    };
    this.transactionRegistry = new TransactionRegistry(registryConfig);
    this.pythonLogAnalyzer = new PythonLogAnalyzer();
    // Initialize ContextRegistry
    const contextConfig: ContextRegistryConfig = {
      eventBusUrl: config.eventBus.url,
      defaultContextSet: 'default_visualization_context'
    };
    this.contextRegistry = new ContextRegistry(contextConfig);
    
    // Initialize ConversationManager
    //this.conversationManager = new ConversationManager( process.env.ASSISTANT_ID  || '');
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
    
    // Connect to MCP servers
    try {
    //  await connectToMCPServer(this.ragServerConfig);
      await connectToMCPServer(this.codeGenServerConfig);
      console.log('✅ Connected to CodeGen MCP server');

      await connectToMCPServer(this.playwrightServerConfig);
      console.log('✅ Connected to Playwright MCP server');
    } catch (error) {
      throw new Error(`Failed to connect to MCP servers: ${error}`);
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
        taskExpectedOutput: 'Output as expected.'
      },
      {
        agentName: 'DataProfiler',
        agentType: 'processing',
        transactionId: 'tx-2-2',
        backstory: 'You analyze data files and generate technical specifications.',
        taskDescription: 'Your role is to analyze CSV data files, understand their structure, identify data patterns, and generate comprehensive technical specifications for agent generation. You process user requirements in the context of the actual data.',
        taskExpectedOutput: 'Detailed technical specification including file structure, data types, transformation requirements, and agent generation guidelines.'
      },
      {
         agentName: 'AgentStructureGenerator',
        agentType: 'processing',
        transactionId: 'tx-2-3',
        backstory: 'You analyze data files and generate technical specifications.',
        taskDescription: 'Your role is to analyze CSV data files, understand their structure, identify data patterns, and generate comprehensive technical specifications for agent generation. You process user requirements in the context of the actual data.',
        taskExpectedOutput: 'Detailed technical specification including file structure, data types, transformation requirements, and agent generation guidelines.'
      },

      //validation of rendering an agent [/AGENT  etc
      {
        agentName: 'ValidatingAgent',
        agentType: 'processing',
        transactionId: 'tx-3',
        backstory: `Your role is to ensure rules are enforced in a JSON object. You act as validator and you report what needs 
        to be amended in the JSON object that does not follow the rules.`,
        taskDescription:  toolValidationPrompt,// dataValidatingAgentPrompt,
        taskExpectedOutput: 'Return expected output as intructed '
      },
       {
        agentName: 'GeneratingAgent',
        agentType: 'processing',
        transactionId: 'tx-3-1',
        backstory: `Your role is to ensure rules are enforced in a JSON object. You act as validator and you report what needs 
        to be amended in the JSON object that does not follow the rules.`,
        taskDescription: SVGInterpreterPrompt,
        taskExpectedOutput: 'JSON object indicating success or failure of the rules being followed. If failure than provide the solution in the JSON'
      },
      {
        agentName: 'VisualizationCoordinatingAgent',
        agentType: 'processing',
        transactionId: 'tx-4',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: `Your role is coordinator. You will receive instructions which will indicate your specific task 
        and the output from thinking through the task to provide meaningful instructions for other agents to enable them to execute their tasks'`,
        taskExpectedOutput: 'Provide information exactly as provided in meaningful terms for each agent in the set. You may frame your response in such a way as would be most beneficial for the receiving agent.'
      },
       {
        agentName: 'D3JSCoordinatingAgent',
        agentType: 'processing',
        transactionId: 'tx-5',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Your role is coordinator. You will receive instructions which will indicate your specific task and the output from thinking through the task to provide meaningful instructions for other agents to enable them to execute their tasks',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Provide output in expected format.'
      },
      {
        agentName: 'D3JSCodeGenerator',
        agentType: 'processing',
        transactionId: 'tx-5-1',
        backstory: 'You are a D3.js visualization code generator.',
        taskDescription: 'Your role is to generate D3.js visualization code based on data specifications and user requirements. You create complete, working D3.js code that can be rendered in a browser.',
        taskExpectedOutput: 'Complete D3.js HTML code ready to run in a browser, including data loading, scales, axes, and visual elements.'
      },
      {
        agentName: 'D3JSCodeValidator',
        agentType: 'processing',
        transactionId: 'tx-5-2',
        backstory: 'You are a D3.js code validator and quality assurance specialist.',
        taskDescription: 'Your role is to validate D3.js visualization code against requirements, check for errors, ensure best practices, and verify that the code will render correctly.',
        taskExpectedOutput: 'Validation report indicating whether code meets requirements, list of any issues found, and corrected code if needed.'
      },

      //Was part of validation of the collated results of csv data analysis given to challenger tx-6 to make critique and provide back to tx-5
      {
        agentName: 'D3AnalysisChallengingAgent',
        agentType: 'processinisg',
        transactionId: 'tx-6',
        backstory: `Your role is to ensure rules are enforced in a JSON object. You act as validator and you report what needs 
        to be amended in the JSON object that does not follow the rules.`,
        taskDescription:  csvAnalysisRefectingAgentPrompt,
        taskExpectedOutput: 'Provide a concise report.'
      },
       {
        agentName: 'D3JSCodingAgent',
        agentType: 'processing',
        transactionId: 'tx-7',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: `You are a d3 js coding expert especially in graphical representation of data using csv file format. You will receive a set of user requirements and
         d3 js code implementing the d3 js code as per the requirements. Your tasks are:
         1. Check the code for errors. Your priority is to fix the errors
         2. Ensure the code aligns with the requirements. Where possible implement the desideratum
         If there are no errors and the requirments are implemented then output the code as is.
       `,
        taskExpectedOutput: `  Your output must be of this form:
         {'CODE REPORT': [Your analysis of the code],
          'CODE': [code ready to run in a browser]`
      },
       {
        agentName: 'FlowDefiningAgent',
        agentType: 'processing',
        transactionId: 'tx-8',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: 'Your role is d3 js coder using csv data files. You will code graphs given a sample of the csv file and details about the data for a graph such as min-max ranges, date ranges and the number of items to be plotted',
      //  context: { dataSources: defaultDataSources },
        taskExpectedOutput: 'Provide html code without explanation so the code can be run in the browser.'
      },
     {
        agentName: 'ToolCallingAgent',
        agentType: 'tool',
        transactionId: 'tx-2-1',
        backstory: 'Provide files for indexing using tool calls.',
        taskDescription: `You are a Python execution agent.

TOOL: execute_python
INPUT: Use the code from context.clean_code
ACTION: Call execute_python with the clean_code as the "code" argument

DO NOT generate placeholder code. Use ONLY the code provided in your context.
 `,
        taskExpectedOutput: 'Clean python code to be executed'
      },
    /* {
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
      
      // llmconfig in sagaCoordinator
      const llmConfig: LLMConfig = {
        provider: 'openai', //'anthropic' 'openai'
        model: 'gpt-5',//'gemini-3-pro-preview', //claude-opus-4-5
        temperature: 1,// promptParams.temperature || (agentType === 'tool' ? 0.2 : 0.3),//temp 1
        maxTokens:  4096,
       // apiKey: process.env.ANTHROPIC_API_KEY
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
      console.log('MESSAGE TYPE', message.type)
       console.log('MESSAGE SOURCE', message.source)
       if ((message.type === 'create_code' ||  message.type === 'update_code' || message.type === 'profile_approved' || message.type === 'profile_rejected') && message.source === 'react-app') {
       message.data = {message: claudeMDResuilt};
        console.log(`🧵 Received create_code from browser:` + JSON.stringify(message.data));
        await this.handleOpenAIThreadRequest(message)
       } else if (message.type === 'update_code' && message.source === 'react-app') {
        console.log(`📊 Received start-graph-request from browser: ${JSON.stringify(message.data)}`);
    //    await this.handleBrowserGraphRequest(message);
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
   
      
     
      // Extract threadId from message
      const { data } = message;
      const opType =  message.type;
      const threadId = data.threadId;
      
     if (!threadId) {
        console.error('❌ No threadId provided in create_code');
     //   return;
      }
      
      // Store thread globally for retention
      this.currentThreadId = threadId;
      this.currentUserMessage = data.message;
      this.lastThreadMessage = data.message;

      const pipelineExecutor: PipelineExecutor = new PipelineExecutor(this.coordinator);

      // PHASE 1: Execute DATA_PROFILING_PIPELINE
      console.log('\n🔄 PHASE 1: Data Profiling Pipeline');
      let profilingState = await pipelineExecutor.executePipeline(
        DATA_PROFILING_PIPELINE,
        data.message || ''
      );

      const result = profilingState.lastControlFlowResult as AgentResult;
      console.log('✅ Data Profiling Complete:', {
        success: result?.success,
        hasResult: !!result?.result
      });

      // Check for errors in profiling phase
      if (!profilingState.lastControlFlowResult?.success) {
        console.error('❌ Data profiling failed');
        console.error('   Error:', profilingState.lastControlFlowResult?.error);

        // TODO: Implement compensation pipeline here (Option 1)
        // For now, we log the error and continue
        // Future: await pipelineExecutor.executePipeline(PYTHON_CODE_UPDATE_PIPELINE, ...);

        // Return early - don't proceed to visualization if profiling failed
        return;
      }

      // PHASE 2: Execute D3_VISUALIZATION_PIPELINE with previous state
      console.log('\n🔄 PHASE 2: D3 Visualization Pipeline');

      let visualizationState = await pipelineExecutor.executePipeline(
        D3_VISUALIZATION_PIPELINE,
        data.message || '',
        profilingState
      );

      console.log('✅ Visualization Complete:', {
        completed: visualizationState.completed,
        errors: visualizationState.errors.length
      });

      const finalResult = pipelineExecutor.getFinalResult();
      console.log('📊 Final Pipeline Result:', finalResult ? 'Available' : 'None');

      // PHASE 3: Handle user review responses
      if (opType === 'profile_approved') {
        console.log('✅ PROFILE APPROVED by user');
        // TODO: Send success notification to user
        // await this.sendDataProfileToUser(finalResult, threadId, data.workflowId, data.correlationId);

      } else if (opType === 'profile_rejected') {
        console.log('❌ PROFILE REJECTED by user, executing code update pipeline');
        console.log('   User feedback:', data.message);

        // Update context with user feedback
        this.coordinator.contextManager.updateContext('ConversationAgent', {
          userComment: data.message
        });

        // Execute code update pipeline
      /*  const updateState = await pipelineExecutor.executePipeline(
          D3_CODE_UPDATE_PIPELINE,
          data.message || '',
          visualizationState
        );

        console.log('✅ Code Update Complete:', {
          completed: updateState.completed,
          errors: updateState.errors.length
        });*/
      }
   
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
    console.log('🔄 Listening for more messages...');
    
    // Keep the process alive to continue listening for events
    // The socket event listeners will handle incoming messages

  } catch (error) {
    console.error('💥 Visualization SAGA processing failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('visualizationSagaProcessing.js') || process.argv[1].endsWith('visualizationSagaProcessing.ts')) {
  runVisualizationSAGAExample();
}