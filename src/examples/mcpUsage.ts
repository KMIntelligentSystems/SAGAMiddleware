import { 
  createEnhancedSagaMiddleware, 
  createAgentDefinition, 
  createMCPServerConfig,
  connectToMCPServer,
  dataPreprocessor
} from '../index.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { 
  createChunkRequesterAgent,
  createChunkAnalyzerAgent,
  createAccumulatorAgent,
  createReportGeneratorAgent
} from '../agents/index.js';
import dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

async function mcpExampleUsage() {
  console.log('Creating enhanced SAGA middleware with MCP support...');
  
  // Create MCP server configurations
  const ragServerConfig = createMCPServerConfig({
    name: "rag-server",
    transport: "stdio",
    command: "node",
    args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
    timeout: 120000
  });
  const filesystemServerConfig = createMCPServerConfig({
    name: 'filesystem',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
    transport: 'stdio',
    timeout: 30000
  });

  // You can also configure other MCP servers
  const databaseServerConfig = createMCPServerConfig({
    name: 'database',
    command: 'node',
    args: ['./mcp-servers/database-server.js'],
    transport: 'stdio',
    timeout: 30000
  });

  // Create enhanced SAGA middleware with auto-connect MCP servers
  const saga = createEnhancedSagaMiddleware({
    autoConnectMCPServers: [ragServerConfig]
  });

  // Alternatively, connect manually
  //3. mcpClientManager.connect(serverConfig); singleton in index.js
  try {
    await connectToMCPServer(ragServerConfig);
    console.log('Connected to rag server MCP server');
  } catch (error) {
    console.log('Database server not available, continuing without it...');
  }

  // Create an agent that analyzes pre-indexed data
  const dataAnalyzerAgent = createAgentDefinition({
    name: 'data_analyzer',
    task: `Generate a comprehensive report using data from "supply_analysis" collection.

REQUIRED STEPS:
1. Call get_chunks tool with collection="supply_analysis" and limit=20 to retrieve data
2. Optionally use semantic_search to explore specific aspects
3. Create a structured report based on the retrieved data

You MUST use the tools to retrieve actual data before generating the report.`,
    provider: 'openai',
 
   model: 'gpt-4o-mini',
  apiKey: process.env["OPENAI_API_KEY"] as string,
    maxTokens: 1500,
    expectedOutput: {
      analyzed: 'boolean',
      dataRetrieved: 'boolean',
      chunksAnalyzed: 'number',
      insights: 'string[]',
      patterns: 'string[]'
    },
    context: {
      collection: 'supply_analysis'
    },
    // Specify MCP servers this agent can use
    mcpServers: [ragServerConfig],
    // Only query/search tools - no indexing tools
    mcpTools: ['search_documents', 'get_chunks', 'semantic_search'],
    // Optionally specify specific resources
    mcpResources: ['rag://collections']
  });
/*
`search_documents` - Vector similarity search
- `index_document` - Add/update documents
- `get_chunks` - Retrieve specific chunks
- `semantic_search*/
  const reportGeneratorAgent = createAgentDefinition({
    name: 'report_generator',
    task: `Generate a comprehensive report using data from "supply_analysis" collection.

REQUIRED STEPS:
1. Call get_chunks tool with collection="supply_analysis" and limit=20 to retrieve data
2. Optionally use semantic_search to explore specific aspects
3. Create a structured report based on the retrieved data

You MUST use the tools to retrieve actual data before generating the report.`,
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    apiKey: process.env["ANTHROPIC_API_KEY"] as string,
    maxTokens: 2000,
    expectedOutput: {
      title: 'string',
      dataRetrieved: 'boolean',
      chunksProcessed: 'number',
      summary: 'string',
      insights: 'string[]',
      recommendations: 'string[]'
    },
    dependencies: [
      { agentName: 'data_analyzer', required: true }
    ],
    context: {
      collection: 'supply_analysis'
    },
    // This agent only queries pre-indexed data
    mcpServers: [ragServerConfig],
    mcpTools: ['search_documents', 'get_chunks', 'semantic_search']
  });

  const qualityCheckerAgent = createAgentDefinition({
    name: 'quality_checker',
    task: 'Review the generated report file and assess its quality',
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env["OPENAI_API_KEY"] as string,
    expectedOutput: {
      qualityScore: 'number',
      issues: 'string[]',
      suggestions: 'string[]',
      approved: 'boolean'
    },
    dependencies: [
      { agentName: 'report_generator', required: true }
    ],
    // This agent can read files to check quality
    //Connected to MCP server: filesystem filesystemServerConfig]
    //Error listing resources from server filesystem: McpError: MCP error -32601: Method not found
  //  mcpServers: [ragServerConfig],
  //  mcpTools: ['read_file', 'get_file_info']
  });

  console.log('Registering MCP-enabled agents...');
  saga.registerAgent(dataAnalyzerAgent);
  saga.registerAgent(reportGeneratorAgent);
  //saga.registerAgent(qualityCheckerAgent);

  console.log('Setting up event listeners...');
  saga.on('saga_event', (event) => {
    console.log(`[${event.type}] ${event.agentName || 'workflow'}: ${event.id}`);
    if (event.data) {
      console.log('  Data:', JSON.stringify(event.data, null, 2));
    }
  });

  try {
    // Phase 1: Data Preprocessing (outside of agent workflow)
    console.log('\n🔄 Phase 1: Data Preprocessing');
    console.log('============================================');
    
    const dataSource = await dataPreprocessor.ensureDataIndexed(
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

    console.log(`✅ Data preprocessing completed: ${dataSource.chunkCount} chunks indexed\n`);

    // Phase 2: Agent Analysis (data already available)
    console.log('🤖 Phase 2: Agent Analysis');
    console.log('============================================');
    console.log('Starting MCP-enhanced workflow execution...');
    
    const results = await saga.executeWorkflow({
      inputData: "c:/repos/SAGAMiddleware/data/supply.csv",
      outputDirectory: './reports',
      collection: dataSource.collection,
      chunkCount: dataSource.chunkCount,
      analysisParameters: {
        includeStatistics: true,
        generateCharts: true,
        confidenceThreshold: 0.8,
        dataPreprocessed: true
      }
    });

    console.log('\nWorkflow Results:');
    for (const [agentName, result] of Array.from(results.entries())) {
      console.log(`\\n${agentName}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.success) {
        console.log('  Result:', JSON.stringify(result.result, null, 2));
        
        // Show any additional result data
        if (result.result && typeof result.result === 'object') {
          const keys = Object.keys(result.result);
          if (keys.length > 0) {
            console.log('  Additional data:', keys.join(', '));
          }
        }
      } else {
        console.log('  Error:', result.error);
      }
    }

  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

// Advanced MCP usage example
async function advancedMCPExample() {
  console.log('\\n=== Advanced MCP Usage Example ===');
  
  const saga = createEnhancedSagaMiddleware();
  
  // Create an agent that demonstrates MCP tool calling
  /*const mcpToolAgent = createAgentDefinition({
    name: 'mcp_tool_demo',
    task: `Demonstrate MCP tool usage. Use available MCP tools to:
    1. List files in the current directory
    2. Read a specific file if it exists
    3. Create a summary report`,
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env["OPENAI_API_KEY"] as string,
    expectedOutput: {
      directoryListing: 'string[]',
      fileContent: 'string',
      summary: 'string'
    },
    mcpServers: [
      createMCPServerConfig({
        name: 'filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
        transport: 'stdio'
      })
    ]
  });

  saga.registerAgent(mcpToolAgent);*/

  try {
    const results = await saga.executeWorkflow({
      workingDirectory: process.cwd()
    });

    console.log('Advanced MCP Results:', JSON.stringify(results.get('mcp_tool_demo'), null, 2));
  } catch (error) {
    console.error('Advanced MCP example failed:', error);
  }
}

// Context sharing example with MCP
async function mcpContextSharingExample() {
  console.log('\\n=== MCP Context Sharing Example ===');
  
  const saga = createEnhancedSagaMiddleware();

  // Agent that fetches data using MCP
 /* const dataFetcherAgent = createAgentDefinition({
    name: 'data_fetcher',
    task: 'Fetch and process data from available resources',
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env["OPENAI_API_KEY"] as string,
    expectedOutput: {
      dataFetched: 'boolean',
      recordCount: 'number',
      dataPreview: 'string'
    },
    mcpServers: [
      createMCPServerConfig({
        name: 'filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
        transport: 'stdio'
      })
    ]
  });*/

  // Agent that processes shared MCP context
  const dataProcessorAgent = createAgentDefinition({
    name: 'data_processor',
    task: 'Process the data that was fetched by the previous agent',
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    apiKey: process.env["ANTHROPIC_API_KEY"] as string,
    expectedOutput: {
      processedData: 'object',
      insights: 'string[]'
    },
    dependencies: [
      { agentName: 'data_fetcher', required: true }
    ]
  });

  //saga.registerAgent(dataFetcherAgent);
  saga.registerAgent(dataProcessorAgent);

  // Demonstrate context manager MCP features
  const contextManager = saga.getContextManager();
  
  // Set MCP context for the first agent
 // await contextManager.setMCPContext('data_fetcher', 'filesystem', ['file://./package.json']);

  try {
    const results = await saga.executeWorkflow({
      sharedContext: true
    });

    console.log('Context sharing results:', JSON.stringify(Array.from(results.entries()), null, 2));
  } catch (error) {
    console.error('Context sharing example failed:', error);
  }
}

// Always execute - simplified for ES modules
console.log("Starting MCP integration examples...");

// Keep console open function
const keepOpen = () => {
  console.log('\\nPress any key to exit...');
  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(0));
  } catch (stdinError) {
    console.log('Error setting up stdin, waiting 10 seconds...');
    setTimeout(() => process.exit(0), 10000);
  }
};

// New SAGA Chunk Processing Workflow
async function runSAGAChunkProcessing() {
  console.log('\\n🚀 Starting SAGA Chunk Processing Workflow...');
  
  const ragServerConfig = createMCPServerConfig({
    name: "rag-server",
    transport: "stdio",
    command: "node",
    args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
    timeout: 120000
  });

  try {
    await connectToMCPServer(ragServerConfig);
    console.log('✅ Connected to RAG MCP server');

    // Ensure data is indexed
    console.log('📊 Ensuring data is indexed...');
    const dataSource = await dataPreprocessor.ensureDataIndexed(
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

    console.log(`✅ Data indexed: ${dataSource.chunkCount} chunks available\\n`);

    // Create SAGA Coordinator with chunk processing agents
    const coordinator = new SagaCoordinator();
    
    const chunkRequester = createChunkRequesterAgent([ragServerConfig]);
    const chunkAnalyzer = createChunkAnalyzerAgent();
    const accumulator = createAccumulatorAgent();
    const reportGenerator = createReportGeneratorAgent();

    coordinator.registerAgent(chunkRequester);
    coordinator.registerAgent(chunkAnalyzer);
    coordinator.registerAgent(accumulator);
    coordinator.registerAgent(reportGenerator);

    // Set up event listeners
    coordinator.on('workflow_status_changed', (state) => {
      console.log(`📍 Status: ${state.status} (Batch: ${state.currentChunkBatch})`);
    });

    coordinator.on('data_accumulated', (event) => {
      console.log(`📈 Accumulated chunk ${event.chunkId} (Total: ${event.totalProcessed})`);
    });

    coordinator.on('processing_decision', (event) => {
      console.log(`🤔 Decision: ${event.decision} - ${event.reason}`);
    });

    // Execute chunk processing workflow
    console.log('🔄 Starting chunk processing...\\n');
    const result = await coordinator.executeChunkProcessingWorkflow(
      dataSource.collection,
      5 // Process 5 chunks at a time
    );

    if (result.success) {
      console.log('\\n✅ SAGA Chunk Processing completed successfully!');
      const summary = result.result.summary;
      console.log(`📊 Processed ${summary.totalChunksProcessed} chunks`);
      console.log(`💡 Discovered ${summary.totalInsights} insights`);
      console.log(`🔍 Identified ${summary.totalPatterns} patterns`);
      console.log(`⏱️ Processing time: ${Math.round(summary.processingTime / 1000)}s`);
    } else {
      console.log('❌ SAGA Chunk Processing failed:', result.error);
    }

  } catch (error) {
    console.error('SAGA Chunk Processing failed:', error);
  }
}

// Interactive menu system
function createMenu(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\\n🚀 SAGAMiddleware - MCP Integration Examples');
    console.log('=============================================');
    console.log('');
    console.log('Choose an option:');
    console.log('1. Traditional MCP Workflow (Original)');
    console.log('2. SAGA Chunk Processing Workflow (New)');
    console.log('3. Advanced MCP Examples');
    console.log('4. MCP Context Sharing Example');
    console.log('5. Run All Examples');
    console.log('0. Exit');
    console.log('');

    rl.question('Enter your choice (0-5): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Main execution function with menu
async function main() {
  try {
    const choice = await createMenu();

    switch (choice) {
      case '1':
        console.log('\\n🔄 Running Traditional MCP Workflow...');
        await mcpExampleUsage();
        break;
      
      case '2':
        await runSAGAChunkProcessing();
        break;
      
      case '3':
        console.log('\\n🔬 Running Advanced MCP Examples...');
        await advancedMCPExample();
        break;
      
      case '4':
        console.log('\\n🔗 Running MCP Context Sharing Example...');
        await mcpContextSharingExample();
        break;
      
      case '5':
        console.log('\\n🔄 Running All Examples...');
        await mcpExampleUsage();
        await runSAGAChunkProcessing();
        await advancedMCPExample();
        await mcpContextSharingExample();
        console.log('\\n🎉 All examples completed!');
        break;
      
      case '0':
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
      
      default:
        console.log('❌ Invalid choice. Please run again and select 0-5.');
        process.exit(1);
    }

    keepOpen();
  } catch (error) {
    console.error('Application failed:', error);
    keepOpen();
  }
}

// Execute main with menu
main();