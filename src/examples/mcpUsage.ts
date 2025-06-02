import { 
  createEnhancedSagaMiddleware, 
  createAgentDefinition, 
  createMCPServerConfig,
  connectToMCPServer 
} from '../index.js';
import dotenv from 'dotenv';

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

  // Create an agent with MCP capabilities
  const dataAnalyzerAgent = createAgentDefinition({
    name: 'data_analyzer',
    task: `Index the supply.csv file into ChromaDB for analysis. Use the index_file tool with these exact parameters:
- filePath: "c:/repos/SAGAMiddleware/data/supply.csv" 
- collection: "supply_analysis"
- metadata: {"type": "CSV", "analysisType": "comprehensive"}

After indexing, provide insights about the data structure and content.`,
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env["OPENAI_API_KEY"] as string,
    expectedOutput: {
      indexed: 'boolean',
      collection: 'string',
      insights: 'string[]',
      confidence: 'number',
      dataSource: 'string',
      chunkCount: 'number'
    },
    context: {
      domain: 'data_analysis',
      analysisType: 'comprehensive'
    },
    // Specify MCP servers this agent can use
    mcpServers: [ragServerConfig],
    // Optionally specify specific tools (if not specified, all tools are available)
    mcpTools: ['search_documents', 'index_document', 'get_chunks', 'semantic_search', 'index_file'],
    // Optionally specify specific resources
    mcpResources: ['rag://collections', "path:c:/repos/SAGAMiddleware/data/supply.csv"]
  });
/*
`search_documents` - Vector similarity search
- `index_document` - Add/update documents
- `get_chunks` - Retrieve specific chunks
- `semantic_search*/
  const reportGeneratorAgent = createAgentDefinition({
    name: 'report_generator',
    task: `Use get_chunks to retrieve all chunks from the "supply_analysis" collection, then generate a comprehensive report analyzing the energy supply data. Create a detailed analysis report and save it as a text file in the ./reports directory.`,
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    apiKey: process.env["ANTHROPIC_API_KEY"] as string,
    expectedOutput: {
      title: 'string',
      sections: 'object[]',
      savedFile: 'string',
      fileSize: 'number'
    },
    dependencies: [
      { agentName: 'data_analyzer', required: true }
    ],
    // This agent can use RAG tools to get chunks and save reports
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
  saga.registerAgent(qualityCheckerAgent);

  console.log('Setting up event listeners...');
  saga.on('saga_event', (event) => {
    console.log(`[${event.type}] ${event.agentName || 'workflow'}: ${event.id}`);
    if (event.data) {
      console.log('  Data:', JSON.stringify(event.data, null, 2));
    }
  });

  try {
    console.log('Starting MCP-enhanced workflow execution...');
    const results = await saga.executeWorkflow({
      inputData: "c:/repos/SAGAMiddleware/data/supply.csv",
      outputDirectory: './reports',
      analysisParameters: {
        includeStatistics: true,
        generateCharts: true,
        confidenceThreshold: 0.8
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
  const dataFetcherAgent = createAgentDefinition({
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
  });

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

  saga.registerAgent(dataFetcherAgent);
  saga.registerAgent(dataProcessorAgent);

  // Demonstrate context manager MCP features
  const contextManager = saga.getContextManager();
  
  // Set MCP context for the first agent
  await contextManager.setMCPContext('data_fetcher', 'filesystem', ['file://./package.json']);

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

// Execute all examples
async function runAllExamples() {
  try {
    await mcpExampleUsage();
    await advancedMCPExample();
    await mcpContextSharingExample();
    
    console.log('\\nAll MCP examples completed successfully!');
    keepOpen();
  } catch (error) {
    console.error('Examples failed:', error);
    keepOpen();
  }
}

runAllExamples();