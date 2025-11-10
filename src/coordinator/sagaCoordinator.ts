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
    
    // THEN create GenericAgent with the enhanced definition
    const agent = new GenericAgent(definition);
    this.agents.set(definition.name, agent);
    this.agentDefinitions.set(definition.name, definition);
 
    const llmConfig: LLMConfig = {
            provider: 'openai',//'anthropic',
            model: definition.agentType === 'tool' ? 'gpt-4o-mini' : 'gpt-4', //gpt-5 gpt-4o-mini claude-3-7-sonnet-20250219
            temperature: 1,// promptParams.temperature || (agentType === 'tool' ? 0.2 : 0.3),//temp 1
            maxTokens: definition.agentType === 'tool' ? 2000 : 1500,
            apiKey: process.env.OPENAI_API_KEY
    }

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

  /**
   * Parse conversation result to extract content for a specific agent
   * Extracts content between [AGENT: agentName, id]...[/AGENT] tags
   */
  parseConversationResultForAgent(conversationResult: any, agentName: string): string {
    try {
      let resultText = '';
      if (typeof conversationResult === 'string') {
        resultText = conversationResult;
      } else if (conversationResult.message) {
        // Handle JSON object with message property (e.g., { threadId, message })
        resultText = conversationResult.message;
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        console.log(`⚠️  Conversation result format not recognized:`, conversationResult);
        return '';
      }

      // Escape special regex characters in agentName to prevent regex syntax errors
      const escapedAgentName = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Extract content between bracket tags for this agent
      // Updated regex to handle both formats:
      // [AGENT: agentName id] or [AGENT:agentName id] (with or without space after colon)
      // Also allows comma or space separation: [AGENT: agentName, id] or [AGENT:agentName id]
      const startTagPattern = new RegExp(`\\[AGENT:\\s*${escapedAgentName}(?:[,\\s]+[^\\]]+)?\\]`, 'i');
      const endTag = `[/AGENT]`;

      const startTagMatch = resultText.match(startTagPattern);
      let startIndex = -1;
      let startTagLength = 0;

      if (startTagMatch) {
        startIndex = startTagMatch.index!;
        startTagLength = startTagMatch[0].length;
        console.log(`✅ Found opening tag: "${startTagMatch[0]}" at index ${startIndex}`);
      } else {
        console.log(`🔍 No [AGENT: ${agentName}] tag found in text:`);
        console.log(`   Text preview: ${resultText.substring(0, 200)}...`);
        console.log(`   Pattern used: ${startTagPattern}`);
        return '';
      }

      const endIndex = resultText.indexOf(endTag, startIndex);

      if (startIndex !== -1 && endIndex !== -1) {
        console.log(`✅ Found closing tag at index ${endIndex}`);
        let content = resultText.substring(startIndex + startTagLength, endIndex).trim();
        console.log(`📝 Extracted content (${content.length} chars): ${content.substring(0, 100)}...`);
        content = content.replace(/^\d+\.\s*/, '').replace(/^\./, '').trim();
        return content;
      } else {
        console.log(`❌ Closing tag [/AGENT] not found after index ${startIndex}`);
        console.log(`   Remaining text: ${resultText.substring(startIndex, startIndex + 300)}...`);
      }

      return '';
    } catch (error) {
      console.warn(`Failed to parse for agent ${agentName}:`, error);
      return '';
    }
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
  ): DefineUserRequirementsProcess | ValidationProcess | FlowProcess | AgentGeneratorProcess | D3JSCodingProcess | DataAnalysisProcess | DataSummarizingProcess | ExecuteGenericAgentsProcess | GenReflectProcess | FlowGeneratingProcess | GenerateAgentAgentStructureProcess |null {
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
          agent.getName(), // ValidatingAgent
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
      
        return new ExecuteGenericAgentsProcess(
          agent,
          this,
         // transactionSetCollection,
          targetAgentName as string
        );
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
  async executeControlFlow(input: { userQuery: string; previousControlFlowResult?: any; previousSDKResult?: any }): Promise<AgentResult> {
    console.log('\n🎯 Starting control flow execution');
    console.log(`📋 Control flow steps: ${this.controlFlowList.length}`);

    // If previous control flow result exists, store it in context for GenericAgents to access
    if (input.previousControlFlowResult) {
      console.log('📥 Previous control flow result available for GenericAgents');
      this.contextManager.setContext('PREVIOUS_CONTROL_FLOW', input.previousControlFlowResult);
    }

    // If previous SDK result exists, store it in context for processes to access
    if (input.previousSDKResult) {
      console.log('📥 Previous SDK result available for processes');
      console.log('🔍 Debug - Storing in PREVIOUS_SDK_RESULT:', typeof input.previousSDKResult === 'string' ? input.previousSDKResult.substring(0, 100) + '...' : 'object');
      this.contextManager.setContext('PREVIOUS_SDK_RESULT', input.previousSDKResult);
    } else {
      console.log('⚠️  No previous SDK result provided to executeControlFlow');
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

      // Update current agent state
      this.currAgent = this.agents.get(step.agent) || null;

      if (step.process === 'DataAnalysisProcess') {
        step.targetAgent = lastDynamicAgentName;
      }

      // Instantiate process
      let process;
       if (step.process === 'FlowProcess') {
        process = this.instantiateProcess(step.process, step.agent, input.userQuery, step.targetAgent);
      } else if (step.process === 'GenReflectProcess') {//SVGValidationPrompt
        process = this.instantiateProcess(step.process, step.agent, input.userQuery, step.targetAgent, undefined, this.svgPath);
      } else if (step.process === 'ValidationProcess' && step.targetAgent === 'D3JSCodingAgent'){
       //   const ctx = this.contextManager.getContext('D3JSCoordinatingAgent');
        //  const codingAgent = this.agents.get('D3JSCodingAgent');

          process = this.instantiateProcess(step.process, step.agent, d3CodeValidatingAgentPrompt, step.targetAgent);
          //
      }  else if (step.process === 'D3JSCodingProcess'){
        console.log('aaaaaaaaaaaaaa ',  step.agent)
        console.log('PROCESS TYPE', step.process)
        console.log(' AGENT ', step.agent)
        console.log(input)
          process = this.instantiateProcess(step.process, step.agent, JSON.stringify(input),step.targetAgent); //When error D3JSCodeCorrectionPrompt  D3JSCodingAgentPrompt = userQuery
          //
      }else if (step.process === 'DefineUserRequirementsProcess' && step.agent === 'TransactionGroupingAgent'){
          const agent = this.agents.get('TransactionGroupingAgent') as GenericAgent;
      //    agent?.receiveContext({'YOUR TASKS: ': profiledPrompt})
          process = this.instantiateProcess(step.process, step.agent, input.userQuery, step.targetAgent); //When error D3JSCodeCorrectionPrompt  D3JSCodingAgentPrompt = userQuery
          //
      }
      else{
        process = this.instantiateProcess(step.process, step.agent, input.userQuery, step.targetAgent);
      }

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

      /*  if (step.process === 'FlowProcess') {

          const process = this.instantiateProcess('AgentGeneratorProcess', step.agent, input.userQuery);
          const transactionSetCollection = await process?.execute() as TransactionSetCollection;
          const executionProcess = this.instantiateProcess('ExecuteGenericAgentsProcess', step.agent, input.userQuery, step.targetAgent, transactionSetCollection);
          const response =  await executionProcess?.execute() as AgentResult;
          console.log('VALIDATING EXEC', response.result)
          result.result = JSON.stringify(response.result);
          this.contextManager.updateContext('D3JSCoordinatingAgent', {
                  lastTransactionResult: response.result,//pythonLogCodeResult,
                  transactionId: 'tx-5',
                  timestamp: new Date()
                });
          
        
           
        }*/

        // Auto-render D3 visualization after D3JSCodingProcess SVGInterpreterPrompt
      /*  if (step.process === 'D3JSCodingProcess') {
          const agentResult = processResult as AgentResult;

          const ctx = this.contextManager.getContext('D3JSCoordinatingAgent') as WorkingMemory;


          if (agentResult.success) {
            console.log('\n🎨 Auto-rendering D3 visualization...');

            // Get the D3 code from the result
            let d3Code = ctx.d3jsCodeResult;
            console.log('D3 JS COORD CODE CTX', d3Code)

            if (d3Code && typeof d3Code === 'string') {
              // Extract CSV filename from the HTML code
              // Handles: d3.csv('C:/repos/sagaMiddleware/data/processed_hourly.csv')
              const csvMatch = d3Code.match(/d3\.csv\(['"](?:[A-Z]:\/)?(?:[^'"]*\/)?([^\/'"]+\.csv)['"]/i);
              const csvFilename = csvMatch ? csvMatch[1] : null;

              // Replace any absolute paths (C:/path/to/file.csv) in d3.csv() with just the filename
              if (csvFilename) {
                console.log(`📊 Extracted CSV filename: ${csvFilename}`);
                d3Code = d3Code.replace(
                  /d3\.csv\(['"][A-Z]:\/[^'"]+\/([^\/'"]+\.csv)['"]/gi,
                  `d3.csv('$1'`
                );
                console.log(`🔧 Replaced d3.csv() path with just filename`);
              }

              let csvData: string | undefined;

              // If CSV file is referenced, try to load it
              if (csvFilename) {
                console.log(`📊 Found CSV reference: ${csvFilename}`);
                const csvPath = path.join(__dirname, '..', '..', 'data', csvFilename);

                try {
                  if (fs.existsSync(csvPath)) {
                    csvData = fs.readFileSync(csvPath, 'utf-8');
                    console.log(`✅ Loaded CSV data from: ${csvPath} (${csvData.length} bytes)`);
                  } else {
                    console.warn(`⚠️  CSV file not found at: ${csvPath}`);
                  }
                } catch (error) {
                  console.error(`❌ Error reading CSV file:`, error);
                }
              }
              //Add the 

              // Render the visualization
           /   const renderResult = await this.renderD3Visualization(
                d3Code,
                step.agent,
                `${step.agent}-output`,
                csvData,
                csvFilename || undefined
              );

              this.svgPath = renderResult.svgPath as string;/
         
            } else {
              console.warn('⚠️  No D3 code found in result, skipping auto-render');
            }
          }
        }*/

        if (step.process === 'ValidationProcess' && step.targetAgent === 'D3JSCodingAgent') {
            const validatedResult = result as AgentResult
           //  validatedResultForD3JS = validatedResult.result
        }

        if (step.process === 'GenReflectProcess') {
          const genAgent = this.agents.get('GeneratingAgent')
          genAgent?.setTaskDescription(SVGValidationPrompt);
       //   process = this.instantiateProcess('ValidationProcess', 'ValidatingAgent', SVGValidationPrompt,  'GeneratingAgent');
       //   process?.execute();
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