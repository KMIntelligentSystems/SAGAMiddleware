/**
 * Example: Using Data Domain Coordinator with Anthropic Architecture
 *
 * This example demonstrates:
 * 1. Creating a Data Domain Coordinator
 * 2. Executing a user query about data analysis
 * 3. Coordinator making decisions and calling subagents
 * 4. Accumulating results and synthesizing insights
 */

import { CoordinatorFactory } from '../CoordinatorFactory.js';
import { CoordinatorRequest } from '../types/index.js';
import { createMCPServerConfig, connectToMCPServer } from '../../index.js';
import * as path from 'path';

async function runDataDomainExample() {
  console.log('🚀 Starting Data Domain Coordinator Example\n');

  // 1. Setup MCP servers
  console.log('📡 Setting up MCP servers...');
  const mcpServers = {
    execution: createMCPServerConfig({
      name: "execution-server",
      transport: "stdio",
      command: "node",
      args: ["C:/repos/codeGen-mcp-server/dist/server.js", "--stdio"],
      timeout: 300000
    })
  };

  try {
    await connectToMCPServer(mcpServers.execution);
    console.log('✅ Connected to execution MCP server\n');
  } catch (error) {
    console.error('❌ Failed to connect to MCP server:', error);
    console.log('⚠️  Continuing without MCP (some features will be limited)\n');
  }

  // 2. Create Data Domain Coordinator with subagents
  console.log('🎯 Creating Data Domain Coordinator...');
  const coordinator = CoordinatorFactory.createDataDomainCoordinator(mcpServers);
  console.log('');

  // 3. Define user query
  const dataFilePath = path.join(process.cwd(), 'data', 'supply.csv');

  const userQuery = `I need to analyze the supply data at ${dataFilePath}.
Please:
1. Understand the structure and schema of the data
2. Calculate daily averages for output values grouped by installation
3. Validate that all required columns exist and data is complete
4. Provide a summary suitable for creating a time-series visualization

The goal is to create a D3.js line chart showing output trends over time for each installation.`;

  // 4. Create request
  const request: CoordinatorRequest = {
    userQuery,
    requirements: {
      dataFile: dataFilePath,
      analysisType: 'time-series',
      visualizationType: 'd3-line-chart'
    }
  };

  console.log('📝 User Query:');
  console.log(userQuery);
  console.log('\n' + '='.repeat(80) + '\n');

  // 5. Execute coordinator
  try {
    const response = await coordinator.execute(request);

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📊 Final Results:\n');

    if (response.success) {
      console.log('✅ Execution successful!\n');

      // Display results
      if (response.result) {
        console.log('📋 Data Analysis Results:');
        console.log(JSON.stringify(response.result, null, 2));
      }

      // Display handoff data if passing to coding coordinator
      if (response.handoffData) {
        console.log('\n🔄 Handoff to Coding Coordinator:');
        console.log(`Target: ${response.handoffData.targetCoordinator}`);
        console.log('Payload:', JSON.stringify(response.handoffData.payload, null, 2));
      }

      // Display execution trace
      const trace = coordinator.getExecutionTrace();
      if (trace) {
        console.log('\n📈 Execution Trace:');
        console.log(`- Total iterations: ${response.context.metadata.iterationCount}`);
        console.log(`- Decisions made: ${trace.decisions.length}`);
        console.log(`- Subagent calls: ${trace.subagentCalls.length}`);

        console.log('\nDecision Flow:');
        trace.decisions.forEach((decision, idx) => {
          console.log(`  ${idx + 1}. ${decision.action}: ${decision.reasoning}`);
        });

        console.log('\nSubagent Calls:');
        trace.subagentCalls.forEach((call, idx) => {
          console.log(`  ${idx + 1}. ${call.task.taskType} - ${call.result.success ? '✅' : '❌'} (${call.result.executionTime}ms)`);
        });
      }
    } else {
      console.log('❌ Execution failed:');
      console.log(response.error);
    }

  } catch (error) {
    console.error('\n💥 Error executing coordinator:', error);
    throw error;
  }
}

// Run example if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runDataDomainExample()
    .then(() => {
      console.log('\n✨ Example completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Example failed:', error);
      process.exit(1);
    });
}

export { runDataDomainExample };
