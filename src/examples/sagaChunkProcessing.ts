import { 
  createEnhancedSagaMiddleware, 
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

dotenv.config();
//START: runAllSAGAExamples: 1.  runSAGAChunkProcessingExample
//Connects to MCP server
//SagaCoordinator called and the agents are registered after their definitions are made
//Starting chunk processing workflow result = await coordinator.executeChunkProcessingWorkflow
async function runSAGAChunkProcessingExample() {
  console.log('🚀 Starting SAGA Chunk Processing Workflow...');
  
  // Create MCP server configuration
  const ragServerConfig = createMCPServerConfig({
    name: "rag-server",
    transport: "stdio",
    command: "node",
    args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
    timeout: 120000
  });

  try {
    // Connect to MCP server
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

    console.log(`✅ Data indexed: ${dataSource.chunkCount} chunks available\n`);

    // Create SAGA Coordinator
    const coordinator = new SagaCoordinator();

    // Create and register specialized agents
    console.log('🤖 Creating specialized agents...');
    
    const chunkRequester = createChunkRequesterAgent([ragServerConfig]);
    const chunkAnalyzer = createChunkAnalyzerAgent();
    const accumulator = createAccumulatorAgent();
    const reportGenerator = createReportGeneratorAgent();

    coordinator.registerAgent(chunkRequester);
    coordinator.registerAgent(chunkAnalyzer);
    coordinator.registerAgent(accumulator);
    coordinator.registerAgent(reportGenerator);

    // Set up event listeners for workflow monitoring
    coordinator.on('workflow_status_changed', (state) => {
      console.log(`📍 Workflow Status: ${state.status} (Batch: ${state.currentChunkBatch})`);
    });

    coordinator.on('data_accumulated', (event) => {
      console.log(`📈 Data accumulated for chunk ${event.chunkId} (Total: ${event.totalProcessed})`);
    });

    coordinator.on('processing_decision', (event) => {
      console.log(`🤔 Processing decision: ${event.decision} - ${event.reason}`);
    });

    // Execute the chunk processing workflow
    console.log('🔄 Starting chunk processing workflow...\n');
    const result = await coordinator.executeChunkProcessingWorkflow(
      dataSource.collection,
      5 // Process 5 chunks at a time
    );

    // Display results
    console.log('\n📋 SAGA Workflow Results:');
    console.log('===============================');
    
    if (result.success) {
      console.log('✅ Workflow completed successfully!');
      
      const summary = result.result.summary;
      console.log(`\n📊 Processing Summary:`);
      console.log(`   • Total chunks processed: ${summary.totalChunksProcessed}`);
      console.log(`   • Total insights discovered: ${summary.totalInsights}`);
      console.log(`   • Total patterns identified: ${summary.totalPatterns}`);
      console.log(`   • Processing time: ${Math.round(summary.processingTime / 1000)}s`);
      
      if (result.result.finalReport) {
        console.log(`\n📄 Final Report Generated:`);
        console.log(`   • Title: ${result.result.finalReport.title}`);
        console.log(`   • Key findings: ${result.result.finalReport.keyFindings?.length || 0}`);
        console.log(`   • Recommendations: ${result.result.finalReport.recommendations?.length || 0}`);
        console.log(`   • Confidence score: ${result.result.finalReport.supportingData?.confidenceScore || 'N/A'}`);
      }

      // Show workflow state
      const workflowState = coordinator.getChunkWorkflowState();
      if (workflowState) {
        console.log(`\n🔍 Workflow Details:`);
        console.log(`   • Batches processed: ${workflowState.currentChunkBatch}`);
        console.log(`   • Errors encountered: ${workflowState.errors.length}`);
        console.log(`   • Start time: ${workflowState.startTime.toISOString()}`);
        console.log(`   • End time: ${workflowState.endTime?.toISOString() || 'N/A'}`);
      }

    } else {
      console.log('❌ Workflow failed:');
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error('💥 SAGA workflow failed:', error);
  }
}

// Advanced example with custom processing parameters
async function runAdvancedSAGAExample() {
  console.log('\n🔬 Advanced SAGA Processing Example...');
  
  const ragServerConfig = createMCPServerConfig({
    name: "rag-server",
    transport: "stdio",
    command: "node",
    args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
    timeout: 120000
  });

  try {
    await connectToMCPServer(ragServerConfig);
    
    const coordinator = new SagaCoordinator();

    // Create agents with custom configurations
    const chunkRequester = createChunkRequesterAgent([ragServerConfig]);
    const chunkAnalyzer = createChunkAnalyzerAgent();
    const accumulator = createAccumulatorAgent();
    const reportGenerator = createReportGeneratorAgent();

    coordinator.registerAgent(chunkRequester);
    coordinator.registerAgent(chunkAnalyzer);
    coordinator.registerAgent(accumulator);
    coordinator.registerAgent(reportGenerator);

    // Monitor accumulated data in real-time
    const monitorInterval = setInterval(() => {
      const accumulatedData = coordinator.getAccumulatedData();
      if (accumulatedData && accumulatedData.metadata.totalChunksProcessed > 0) {
        console.log(`📊 Real-time stats: ${accumulatedData.insights.length} insights, ${accumulatedData.patterns.length} patterns`);
      }
    }, 5000);

    const result = await coordinator.executeChunkProcessingWorkflow("supply_analysis", 3);
    
    clearInterval(monitorInterval);
    
    console.log('\n🎯 Advanced workflow completed:', result.success ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('Advanced SAGA example failed:', error);
  }
}

// Keep console open function
const keepOpen = () => {
  console.log('\nPress any key to exit...');
  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(0));
  } catch (stdinError) {
    console.log('Error setting up stdin, waiting 10 seconds...');
    setTimeout(() => process.exit(0), 10000);
  }
};

// Execute examples
async function runAllSAGAExamples() {
  try {
    await runSAGAChunkProcessingExample();
    await runAdvancedSAGAExample();
    
    console.log('\n🎉 All SAGA examples completed successfully!');
    keepOpen();
  } catch (error) {
    console.error('SAGA examples failed:', error);
    keepOpen();
  }
}

runAllSAGAExamples();