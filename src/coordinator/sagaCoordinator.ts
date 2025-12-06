import { EventEmitter } from 'events';
import { 
  AgentDefinition, 
  SagaEvent, 
  AgentResult,
  WorkingMemory,
  LLMConfig,
  MCPServerConfig
} from '../types/index.js';
import { 
  SagaState, 
  SagaTransaction,

  SagaWorkflowRequest,
  CompensationAction,
  IterationState,
  IterationConfig,
  sagaPrompt,
  transactionGroupPrompt,
  TransactionSetCollection,
  SetExecutionResult,
  TransactionSet,
   pythonCodeValidatingAgentPrompt,
    dataValidatingAgentPrompt,
    d3CodeValidatingAgentPrompt,
    SVGValidationPrompt,
    D3JSCodingAgentPrompt,
    D3JSCodeCorrectionPrompt
} from '../types/visualizationSaga.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { ValidationManager } from '../sublayers/validationManager.js';
import { mcpClientManager, ToolCallContext } from '../mcp/mcpClient.js';
import { TransactionManager } from '../sublayers/transactionManager.js';
import { CSVReader } from '../processing/csvReader.js'
import { D3VisualizationClient, D3RenderResult } from '../mcp/d3VisualizationClient.js';
import { DefineUserRequirementsProcess } from '../process/DefineUserRequirementsProcess.js';
import { ValidationProcess } from '../process/ValidationProcess.js';
import { FlowProcess } from '../process/FlowProcess.js';
import { AgentGeneratorProcess } from '../process/AgentGeneratorProcess.js';
import { D3JSCodingProcess } from '../process/D3JSCodingProcess.js';
import { DataAnalysisProcess } from '../process/DataAnalysisProcess.js';
import { DataSummarizingProcess } from '../process/DataSummarizingProcess.js';
import { ExecuteGenericAgentsProcess } from '../process/ExecuteGenericAgentsProcess.js';
import { ExecuteGenericAgentsProcess_AgentDefinition } from '../process/ExecuteGenericAgentsProcess_AgentDefinition.js';
import { GenReflectProcess } from '../process/GenReflectProcess.js';
import { FlowGeneratingProcess } from '../process/FlowGeneratingProcess.js';
import { GenerateAgentAgentStructureProcess } from '../process/GenerateAgentAgentStructureProcess.js'
import { AgentParser } from '../agents/agentParser.js'
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SagaCoordinator extends EventEmitter {
  agents: Map<string, GenericAgent> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private executionOrder: string[] = [];
  contextManager: ContextManager;
  private validationManager: ValidationManager;
  private transactionManager: TransactionManager;
  private activeExecutions: Set<string> = new Set();
  private sagaState: SagaState | null = null;
  currentExecutingTransactionSet: SagaTransaction[] | null = null;
  private iterationStates: Map<string, IterationState> = new Map();
  private  conversationAgentCompleted = false;
  private mcpServers: Record<string, MCPServerConfig>;
  agentFlows: string[][] = [];
  private activeTransactionSetId: string = '';
  private csvReader: CSVReader = new CSVReader();
  private d3Client: D3VisualizationClient | null = null;
 
 //private agentParser: AgentParser;
 // private currentContextSet: ContextSetDefinition | null = null;

  // Process execution state tracking
  private currAgent: GenericAgent | null = null;
  private currTransactionSet: TransactionSet | null = null;
  private currToolCallTransactionSet: TransactionSet | null = null;

  // Control flow list: maps agent names to process types
  // For ValidationProcess: agent is ValidatingAgent, targetAgent is the agent being validated
  private controlFlowList: Array<{agent: string, process: string, targetAgent?: string}> = [];
  private svgPath = '';

  constructor(mcpServers: Record<string, MCPServerConfig>) {
    super();
   // this.agentParser = agentParser;
    this.contextManager = new ContextManager();
    this.validationManager = new ValidationManager();
    this.transactionManager = new TransactionManager();
    this.mcpServers = mcpServers;

    // Initialize AgentFactory with coordinator-specific config
  

    this.agentFlows.push([ 'tx-4','tx-3', 'tx-4']) //'tx-2' or tx-5 for DEFAULT_SAGA_COLLECTIONS 'tx-4','tx-3', 'tx-4' for visualizationCoordinatingAgent
  }

  registerAgent(definition: AgentDefinition): void {
    // BEFORE creating GenericAgent, intelligently assign servers based on tools
    if (definition.agentType === 'tool' && definition.mcpTools && definition.mcpTools.length > 0) {
      // Use getServersForTools to determine which servers this agent needs
      definition.mcpServers = this.getServersForTools(definition.mcpTools);
    } else if (definition.agentType === 'tool' && (!definition.mcpServers || definition.mcpServers.length === 0)) {
      // Fallback: if it's a tool agent but no tools specified, provide all servers
      definition.mcpServers = this.getServersForTools(['execute_python']);
   //   definition.mcpServers = Object.values(this.mcpServers);
      console.log(`🔧 Tool agent ${definition.name} has no specific tools defined, providing all MCP servers`);
    }
    
    // Configure LLM for this agent if not already set
    if (!definition.llmConfig) {
      definition.llmConfig = {
        provider: 'gemini',  // Options: 'openai', 'anthropic', 'gemini', 'deepseek', 'ollama'
        model: definition.agentType === 'tool' ? 'gemini-2.0-flash-exp' : 'gemini-2.0-flash-exp',
        temperature: 1,
        maxTokens: definition.agentType === 'tool' ? 2000 : 1500,
        apiKey: process.env.GEMINI_API_KEY
      };
    }

    // THEN create GenericAgent with the enhanced definition
    const agent = new GenericAgent(definition);
    this.agents.set(definition.name, agent);
    this.agentDefinitions.set(definition.name, definition);

    /*
if(definition.agentType === 'tool'){
      definition.mcpServers = [this.ragServerConfig];
    }
    */
    console.log(`🔧 Registered agent: ${definition.name}`);
    console.log(`🔧 MCP servers: ${definition.mcpServers?.map(s => s.name).join(', ') || 'none'}`);
    console.log(`🔧 MCP tools: ${definition.mcpTools?.join(', ') || 'none'}`);
  }

  registerAgentFlows(agentFlow: string[]){
    this.agentFlows.push(agentFlow);
    console.log('AGENT FLOW ', this.agentFlows)
  }

  registerCSVReader(csvReader: CSVReader){
    this.csvReader = csvReader;
  }

  /**
   * Intelligently determine which MCP servers are needed based on the tools an agent requires
   */
  private getServersForTools(tools: string[]): MCPServerConfig[] {
    const serverMap: Record<string, keyof typeof this.mcpServers> = {
      'execute_python': 'execution',
      'execute_typescript': 'execution', 
      'semantic_search': 'rag',
      'get_chunks': 'rag',
      'index_file': 'rag',
      'structured_query': 'rag',
      'calculate_energy_totals': 'rag',
      'save_processed_data': 'rag',
      'process_data_chunk': 'rag'
    };
    
    const requiredServers = new Set<keyof typeof this.mcpServers>();
    tools.forEach(tool => {
      const server = serverMap[tool];
      if (server && this.mcpServers[server]) {
        requiredServers.add(server);
      }
    });
    
    // If no specific mapping found, provide all available servers as fallback
    if (requiredServers.size === 0) {
      console.log(`⚠️ No server mapping found for tools: ${tools.join(', ')}. Providing all available servers.`);
      return Object.values(this.mcpServers);
    }
    
    const selectedServers = Array.from(requiredServers).map(key => this.mcpServers[key]).filter(Boolean);
    console.log(`🎯 Selected MCP servers for tools [${tools.join(', ')}]: ${selectedServers.map(s => s.name).join(', ')}`);
    
    return selectedServers;
  }



  // ========================================
  // SAGA METHODS
  // ========================================

  initializeSaga(workflowId: string, request: SagaWorkflowRequest, transactionCount?: number): void {
   

    console.log(`🎯 Initialized SAGA: ${workflowId}`);
    this.emit('saga_initialized', this.sagaState);
  }

sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

  
  /**
   * Initialize control flow list
   * Maps default agents to their corresponding process types
   */
  initializeControlFlow(controlFlowList: Array<{agent: string, process: string, targetAgent?: string}>): void {
    this.controlFlowList = controlFlowList;
  }

  /**
   * Instantiate a process based on process type
   * Returns the appropriate Process instance configured with required agents
   */
  private instantiateProcess(
    processType: string,
    agentName: string,
    userQuery: string,
    targetAgentName?: string,
    transactionSetCollection?: TransactionSetCollection,
    svgFilePath?: string
  ): DefineUserRequirementsProcess | ValidationProcess | FlowProcess | AgentGeneratorProcess | D3JSCodingProcess | DataAnalysisProcess | DataSummarizingProcess | ExecuteGenericAgentsProcess |  ExecuteGenericAgentsProcess_AgentDefinition | GenReflectProcess | FlowGeneratingProcess | GenerateAgentAgentStructureProcess | null {
    const agent = this.agents.get(agentName);
    
    console.log('PROCESS TYPE', processType)
    console.log(' AGENT ',  agentName)
    if (!agent) {
      console.error(`❌ Agent ${agentName} not found`);
      return null;
    }
   
   
    switch (processType) {
      case 'DefineUserRequirementsProcess':
        return new DefineUserRequirementsProcess(
          agent,
          this.contextManager,
          userQuery,
          targetAgentName
        );

      case 'ValidationProcess': {
        if( targetAgentName){
        return new ValidationProcess(
          agent, // ValidatingAgent
          targetAgentName, // Agent being validated
          this.contextManager,
          userQuery
        );
      }
    }
     
      case 'FlowProcess': {
       /* const flowDefiningAgent = this.agents.get('FlowDefiningAgent');
        if (!flowDefiningAgent) {
          console.error('❌ FlowDefiningAgent not found');
          return null;

        
        }*/
       if(targetAgentName){
          const targetAgent = this.agents.get(targetAgentName) as GenericAgent;
          return new FlowProcess(
            agent,
            targetAgent,
            this.contextManager
        );
       }
      
      }   
      
      case 'FlowGeneratingProcess': {
       if(targetAgentName){
          const targetAgent = this.agents.get(targetAgentName) as GenericAgent;
          return new FlowGeneratingProcess(
            agent.getName(),
            targetAgent.getName(),
            this.contextManager
        );
       }
      
      } 


 
      case 'ExecuteGenericAgentsProcess': {
       if(targetAgentName){
          const targetAgent = this.agents.get(targetAgentName) as GenericAgent;
          return new ExecuteGenericAgentsProcess_AgentDefinition(
          agent.getName(),
          this.contextManager,
          targetAgentName
        );
      } 
    }

      case 'AgentGeneratorProcess': {
          if(targetAgentName){
          const targetAgent = this.agents.get(targetAgentName) as GenericAgent;
        return new AgentGeneratorProcess(
          agentName,
          targetAgent,
          this.contextManager,
          userQuery,
          this
        );
      }} 
      
       case 'GenerateAgentAgentStructureProcess': {
          if(targetAgentName){
         return new GenerateAgentAgentStructureProcess
          (
          agentName,
          targetAgentName,
          this.contextManager
        );  
      }}
      
      case 'D3JSCodingProcess':
      
        return new D3JSCodingProcess(
          agent,
          this.contextManager,
          userQuery,
          targetAgentName as string
        );

      case 'DataAnalysisProcess':
        return new DataAnalysisProcess(
          agent,
          this.contextManager,
          userQuery,
          targetAgentName as string
        );

      case 'DataSummarizingProcess':
        return new DataSummarizingProcess(
          agent,
          this.contextManager,
          userQuery
        );

      case 'GenReflectProcess':
        if (!svgFilePath) {
          console.error('❌ GenReflectProcess requires svgFilePath');
          return null;
        }

        if(targetAgentName){
         const targetAgent = this.agents.get(targetAgentName);
           return new GenReflectProcess(
            agent,
            this.contextManager,
            svgFilePath,
            targetAgent
        );
        }
       
        return new GenReflectProcess(
          agent,
          this.contextManager,
          svgFilePath,
          undefined
        );

      default:
        console.error(`❌ Unknown process type: ${processType}`);
        return null;
    }
  }

  /**
   * Execute the control flow
   * Iterates through control flow list and executes each process in sequence
   */
  async executeControlFlow(input: { userQuery: string; previousControlFlowResult?: any }): Promise<AgentResult> {
    console.log('\n🎯 Starting control flow execution');
    console.log(`📋 Control flow steps: ${this.controlFlowList.length}`);

    // If previous control flow result exists, store it in context for GenericAgents to access
    if (input.previousControlFlowResult) {
      console.log('📥 Previous control flow result available for GenericAgents');
      this.contextManager.setContext('PREVIOUS_CONTROL_FLOW', input.previousControlFlowResult);
    }

    let validatedResult = '';

     let result: AgentResult = {
      agentName: 'cycle_start',
      result: '',//visualizationGroupingAgentsResult groupingAgentResult,groupingAgentFailedResult,
      success: true,
      timestamp: new Date()
    };

    let lastDynamicAgentName = '';
    for (let i = 0; i < this.controlFlowList.length; i++) {
      const step = this.controlFlowList[i];
      console.log(`\n--- Step ${i + 1}/${this.controlFlowList.length}: ${step.agent} → ${step.process} ---`);
//--- Step 1/1: DataProfiler → ExecuteGenericAgentsProcess ---
      // Update current agent state
    
      if (step.process === 'ExecuteGenericAgentsProcess') {
            console.log('🔴 SagaCoordinator: ExecuteGenericAgentsProcess step reached');
            console.log('🔴 SagaCoordinator: ContextManager instance:', this.contextManager ? 'EXISTS' : 'NULL');
            const ctx = this.contextManager.getContext('DataProfiler') as WorkingMemory;
            console.log('🔴 SagaCoordinator: DataProfiler context:', ctx ? 'EXISTS' : 'NULL');
            console.log('🔴 SagaCoordinator: lastTransactionResult:', ctx?.lastTransactionResult ? 'HAS DATA' : 'NULL');
            if (ctx?.lastTransactionResult) {
              console.log('🔴 SagaCoordinator: Data preview:', typeof ctx.lastTransactionResult === 'string' ? ctx.lastTransactionResult.substring(0, 200) : 'NOT STRING');
            }
      }
         
  this.currAgent = this.agents.get(step.agent) || null;

      // Instantiate process
      // Determine userQuery based on special cases
      let userQueryForProcess = input.userQuery;
      let svgFilePath: string | undefined = undefined;

      // Special case handling
      if (step.process === 'GenReflectProcess') {
        svgFilePath = this.svgPath;
      } else if (step.process === 'ValidationProcess' && step.targetAgent === 'D3JSCodingAgent') {
        userQueryForProcess = d3CodeValidatingAgentPrompt;
      } else if (step.process === 'D3JSCodingProcess' &&
                 (step.agent === 'D3JSCoordinatingAgent' || step.agent === 'D3JSCodeGenerator')) {
        userQueryForProcess = JSON.stringify(input);
      }

      const process = this.instantiateProcess(
        step.process,
        step.agent,
        userQueryForProcess,
        step.targetAgent,
        undefined,
        svgFilePath
      );

      if (!process) {
        console.error(`❌ Failed to instantiate process at step ${i + 1}`);
        continue;
      }

      try {
        // Execute process
        const processResult = await process.execute();

        // Update the main result with the process result (especially for DefineUserRequirementsProcess)
        if (step.process === 'DefineUserRequirementsProcess' && 'agentName' in processResult) {
          result = processResult as AgentResult;
        }

        if (step.process === 'AgentStructureProcess'){
       

        }

        // Handle ValidationProcess specifically for retry logic
        if (step.process === 'D3JSCodingProcess') {
              const agentResult = processResult as AgentResult;
              result.result = agentResult.result;
        }

        if (step.process === 'ValidationProcess') {
           result = processResult as AgentResult
           console.log('HERE IN PIPE VAL ',  result)
        }

       
        console.log(`✅ Step ${i + 1} completed successfully`);
      
      } catch (error) {
        console.error(`❌ Error executing step ${i + 1}:`, error);
        throw error; // Or continue based on error handling strategy
      }
         console.log('\n🎉 Control flow execution completed')             
    }

      return result;
  }

  /**
   * Find the previous DefineUserRequirementsProcess step for a given agent
   * Used for retry logic after validation failure
   */
  private findPreviousDefineStep(currentIndex: number, agentName: string): number {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = this.controlFlowList[i];
      if (step.agent === agentName && step.process === 'DefineUserRequirementsProcess') {
        return i;
      }
    }
    return -1;
  }

  /**
   * Initialize D3 visualization client with Playwright MCP server
   */
  initializeD3Client(): void {
    if (!this.d3Client) {
      this.d3Client = new D3VisualizationClient(mcpClientManager, 'playwright-server');
      console.log('✅ D3 visualization client initialized');
    }
  }

  /**
   * Render D3 visualization code using Playwright MCP
   *
   * @param d3Code - The D3.js code to render
   * @param agentName - The name of the agent that generated the code (optional, for context)
   * @param outputName - Custom name for output files (optional)
   * @param csvData - CSV data content to provide to d3.csv() calls (optional)
   * @param csvFilename - CSV filename to intercept (optional)
   * @returns Promise with render result including paths to PNG and SVG files
   */
  async renderD3Visualization(
    d3Code: string,
    agentName?: string,
    outputName?: string,
    csvData?: string,
    csvFilename?: string
  ): Promise<D3RenderResult> {
    // Initialize D3 client if not already initialized
    if (!this.d3Client) {
      this.initializeD3Client();
    }

    if (!this.d3Client) {
      console.error('❌ Failed to initialize D3 client');
      return {
        success: false,
        error: 'D3 client initialization failed'
      };
    }

    console.log(`🎨 Rendering D3 visualization${agentName ? ` from ${agentName}` : ''}...`);

    // Generate output name based on agent or timestamp
    const baseName = outputName || (agentName ? `${agentName}-${Date.now()}` : `visualization-${Date.now()}`);

    try {
      const result = { success: true, screenshotPath: '', svgPath: 'C:/repos/SAGAMiddleware/output/d3-visualizations/D3JSCodingAgent-output.svg'}/*await this.d3Client.renderD3({
        d3Code,
        csvData,
        csvFilename,
        screenshotName: `${baseName}.png`,
        svgName: `${baseName}.svg`,
        outputPath: path.join(process.cwd(), 'output', 'd3-visualizations')
      });

      if (result.success) {
        console.log(`✅ D3 visualization rendered successfully`);
        console.log(`  📸 PNG: ${result.screenshotPath}`);
        console.log(`  💾 SVG: ${result.svgPath}`);
console.log('D3CODE',d3Code)
        // Store visualization paths in context for the agent
        if (agentName) {
          this.contextManager.updateContext(agentName, {
            lastVisualizationPNG: result.screenshotPath,
            lastVisualizationSVG: result.svgPath,
            timestamp: new Date()
          });
        }
      }*/

      return result;
    } catch (error) {
      console.error('❌ Error rendering D3 visualization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Close D3 client and cleanup
   */
  async closeD3Client(): Promise<void> {
    if (this.d3Client) {
      await this.d3Client.close();
      this.d3Client = null;
      console.log('🔒 D3 visualization client closed');
    }
  }
}