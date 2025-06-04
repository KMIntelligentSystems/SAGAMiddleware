#!/usr/bin/env node

/**
 * Dedicated Entry Point for SAGA Chunk Processing Workflow
 * 
 * This is a streamlined entry point focused solely on the new 
 * chunk-based data processing capabilities using the SAGA pattern.
 */

import { 
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

// Configuration
const CONFIG = {
  dataPath: "c:/repos/SAGAMiddleware/data/supply.csv",
  collection: "supply_analysis",
  defaultChunkSize: 5,
  ragServerPath: "C:/repos/rag-mcp-server/dist/server.js"
};

class ChunkProcessingApp {
  private coordinator: SagaCoordinator;
  private ragServerConfig: any;

  constructor() {
    this.coordinator = new SagaCoordinator();
    this.ragServerConfig = createMCPServerConfig({
      name: "rag-server",
      transport: "stdio",
      command: "node",
      args: [CONFIG.ragServerPath, "--stdio"],
      timeout: 120000
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing SAGA Chunk Processing Application...');
    
    try {
      // Connect to MCP server
      await connectToMCPServer(this.ragServerConfig);
      console.log('✅ Connected to RAG MCP server');

      // Register specialized agents
      this.registerAgents();
      console.log('✅ Registered chunk processing agents');

      // Set up event monitoring
      this.setupEventListeners();
      console.log('✅ Event monitoring configured');

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  private registerAgents(): void {
    const chunkRequester = createChunkRequesterAgent([this.ragServerConfig]);
    const chunkAnalyzer = createChunkAnalyzerAgent();
    const accumulator = createAccumulatorAgent();
    const reportGenerator = createReportGeneratorAgent();

    this.coordinator.registerAgent(chunkRequester);
    this.coordinator.registerAgent(chunkAnalyzer);
    this.coordinator.registerAgent(accumulator);
    this.coordinator.registerAgent(reportGenerator);
  }

  private setupEventListeners(): void {
    this.coordinator.on('workflow_status_changed', (state) => {
      console.log(`📍 Workflow Status: ${state.status} (Batch: ${state.currentChunkBatch})`);
    });

    this.coordinator.on('data_accumulated', (event) => {
      console.log(`📈 Data accumulated for chunk ${event.chunkId} (Total: ${event.totalProcessed})`);
    });

    this.coordinator.on('processing_decision', (event) => {
      console.log(`🤔 Processing decision: ${event.decision} - ${event.reason}`);
    });

    this.coordinator.on('saga_event', (event) => {
      if (event.type === 'agent_error') {
        console.log(`⚠️  Agent ${event.agentName} encountered an error`);
      }
    });
  }

  async ensureDataIndexed(): Promise<{ collection: string; chunkCount: number }> {
    console.log('📊 Ensuring data is indexed...');
    
    const dataSource = await dataPreprocessor.ensureDataIndexed(
      CONFIG.dataPath,
      CONFIG.collection,
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

    console.log(`✅ Data indexed: ${dataSource.chunkCount || 0} chunks available`);
    return { collection: dataSource.collection, chunkCount: dataSource.chunkCount || 0 };
  }

  async runChunkProcessing(chunkSize: number = CONFIG.defaultChunkSize): Promise<void> {
    console.log(`\n🔄 Starting chunk processing (batch size: ${chunkSize})...\n`);

    const { collection } = await this.ensureDataIndexed();

    const startTime = Date.now();
    const result = await this.coordinator.executeChunkProcessingWorkflow(collection, chunkSize);
    const endTime = Date.now();

    this.displayResults(result, endTime - startTime);
  }

  private displayResults(result: any, processingTime: number): void {
    console.log('\n📋 SAGA Chunk Processing Results:');
    console.log('=====================================');
    
    if (result.success) {
      console.log('✅ Processing completed successfully!\n');
      
      const summary = result.result.summary;
      console.log('📊 Processing Summary:');
      console.log(`   • Total chunks processed: ${summary.totalChunksProcessed}`);
      console.log(`   • Total insights discovered: ${summary.totalInsights}`);
      console.log(`   • Total patterns identified: ${summary.totalPatterns}`);
      console.log(`   • Processing time: ${Math.round(processingTime / 1000)}s`);
      
      if (result.result.finalReport) {
        console.log('\n📄 Final Report Generated:');
        console.log(`   • Title: ${result.result.finalReport.title || 'N/A'}`);
        console.log(`   • Key findings: ${result.result.finalReport.keyFindings?.length || 0}`);
        console.log(`   • Recommendations: ${result.result.finalReport.recommendations?.length || 0}`);
        console.log(`   • Confidence score: ${result.result.finalReport.supportingData?.confidenceScore || 'N/A'}`);
      }

      // Show accumulated insights preview
      const accumulatedData = this.coordinator.getAccumulatedData();
      if (accumulatedData && accumulatedData.insights.length > 0) {
        console.log('\n💡 Sample Insights:');
        accumulatedData.insights.slice(0, 3).forEach((insight, index) => {
          console.log(`   ${index + 1}. ${insight}`);
        });
        if (accumulatedData.insights.length > 3) {
          console.log(`   ... and ${accumulatedData.insights.length - 3} more insights`);
        }
      }

    } else {
      console.log('❌ Processing failed:');
      console.log(`   Error: ${result.error}`);
    }
  }

  async getProcessingOptions(): Promise<{ action: string; chunkSize?: number }> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log('\n⚙️  SAGA Chunk Processing Options:');
      console.log('================================');
      console.log('1. Quick Processing (3 chunks per batch)');
      console.log('2. Standard Processing (5 chunks per batch)');
      console.log('3. Detailed Processing (10 chunks per batch)');
      console.log('4. Custom chunk size');
      console.log('0. Exit');
      console.log('');

      rl.question('Select processing option (0-4): ', (answer) => {
        const choice = answer.trim();
        
        switch (choice) {
          case '1':
            rl.close();
            resolve({ action: 'process', chunkSize: 3 });
            break;
          case '2':
            rl.close();
            resolve({ action: 'process', chunkSize: 5 });
            break;
          case '3':
            rl.close();
            resolve({ action: 'process', chunkSize: 10 });
            break;
          case '4':
            rl.question('Enter custom chunk size (1-50): ', (sizeAnswer) => {
              const size = parseInt(sizeAnswer.trim());
              rl.close();
              if (size > 0 && size <= 50) {
                resolve({ action: 'process', chunkSize: size });
              } else {
                console.log('Invalid chunk size. Using default (5).');
                resolve({ action: 'process', chunkSize: 5 });
              }
            });
            break;
          case '0':
            rl.close();
            resolve({ action: 'exit' });
            break;
          default:
            rl.close();
            console.log('Invalid option. Using standard processing.');
            resolve({ action: 'process', chunkSize: 5 });
        }
      });
    });
  }
}

// Main execution
async function main() {
  console.log('🎯 SAGA Middleware - Chunk Processing Application');
  console.log('================================================\n');

  const app = new ChunkProcessingApp();

  try {
    await app.initialize();
    
    const options = await app.getProcessingOptions();
    
    if (options.action === 'exit') {
      console.log('👋 Goodbye!');
      process.exit(0);
    }

    await app.runChunkProcessing(options.chunkSize);

  } catch (error) {
    console.error('\n💥 Application failed:', error);
    process.exit(1);
  }

  // Keep console open
  console.log('\nPress any key to exit...');
  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(0));
  } catch (stdinError) {
    console.log('Waiting 10 seconds before exit...');
    setTimeout(() => process.exit(0), 10000);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Execute main function
main();