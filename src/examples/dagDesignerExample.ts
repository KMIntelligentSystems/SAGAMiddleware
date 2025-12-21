/**
 * DAG Designer Example
 *
 * Demonstrates how to use the DAG Designer SDK Agent to autonomously
 * create workflow DAGs based on requirements
 */

import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { DAGDesigner } from '../agents/dagDesigner.js';
import { DAGExecutor } from '../workflows/dagExecutor.js';
import { extractAvailableAgents } from '../utils/agentRegistry.js';
import { WorkflowRequirements, DAGDesignResult } from '../types/dag.js';
import { AgentResult } from '../types/index.js';


/**
 * Example 1: Design D3 Visualization Workflow with Frontend Agent Specifications
 */
export async function designD3VisualizationWorkflow(coordinator: SagaCoordinator) {
    console.log('\n========================================');
    console.log('Example 1: Design D3 Visualization Workflow with Frontend Agents');
    console.log('========================================\n');

    // Step 1: Define workflow requirements (from actual frontend output)
    const requirements: WorkflowRequirements = {
  "objective": "Develop a complete D3.js histogram visualization with dynamic subagent analysis of price distribution data",
  "inputData": {
    "type": "csv_file",
    "source": "C:/repos/SAGAMiddleware/data/prices.csv",
    "schema": {
      "columns": [
        "price"
      ],
      "rowCount": 1000,
      "characteristics": "Single-column price data, range $23-$9,502 with outliers, majority $30-$500, Excel export with UTF-8 BOM, 2 header rows, 5-min intervals"
    }
  },
  "agents": [
    {
      "name": "WorkflowInterpreter",
      "agentType": "python_coding",
      "task": "Read and analyze price data from CSV file. Create dynamic agent definitions with Python code contexts for optimal histogram analysis including bin count calculation, range determination, and outlier handling strategies",
      "inputFrom": null,
      "outputSchema": {
        "agent_definitions": "dict",
        "analysis_context": "dict",
        "data_summary": "dict"
      }
    },
    {
      "name": "HistogramAnalyzer",
      "agentType": "python_coding",
      "task": "Execute histogram data analysis using the agent definitions from WorkflowInterpreter. Calculate optimal bin count, data distribution parameters, outlier thresholds, and complete histogram configuration",
      "inputFrom": "WorkflowInterpreter",
      "outputSchema": {
        "optimal_bins": "int",
        "data_range": "dict",
        "distribution_stats": "dict",
        "histogram_config": "dict"
      }
    },
    {
      "name": "ResultsValidator",
      "agentType": "functional",
      "task": "Validate the histogram analysis results for statistical accuracy, completeness, and optimal parameter selection",
      "inputFrom": "HistogramAnalyzer",
      "outputSchema": {
        "validation_status": "string",
        "validated_results": "dict",
        "validation_notes": "string"
      }
    },
    {
      "name": "D3HistogramCoder",
      "agentType": "functional",
      "task": "Generate complete D3.js histogram visualization HTML code using the validated optimal parameters and histogram configuration",
      "inputFrom": "ResultsValidator",
      "outputSchema": {
        "html_code": "string",
        "js_code": "string",
        "output_path": "string"
      }
    },
    {
      "name": "HTMLValidator",
      "agentType": "functional",
      "task": "Use Playwright to analyze the generated HTML file, validate SVG histogram elements against requirements, check for proper D3.js rendering. On validation failure, coordinate with D3HistogramCoder for one retry attempt with corrections",
      "inputFrom": "D3HistogramCoder",
      "outputSchema": {
        "svg_validation": "dict",
        "requirements_check": "dict",
        "playwright_results": "dict",
        "retry_coordination": "dict"
      }
    },
    {
      "name": "FinalValidator",
      "agentType": "functional",
      "task": "Handle final validation results and conversation termination. Process HTMLValidator output, manage single retry attempt if needed, and provide final pass/fail determination for the complete histogram workflow",
      "inputFrom": "HTMLValidator",
      "outputSchema": {
        "final_result": "string",
        "conversation_status": "string",
        "output_files": "list",
        "workflow_completion": "dict"
      }
    }
  ],
  "outputExpectation": {
    "type": "html_visualization",
    "format": "d3_histogram",
    "quality": [
      "validated",
      "production_ready",
      "responsive",
      "accessible"
    ]
  },
  "constraints": {
    "parallelismAllowed": false,
    "executionOrder": "sequential",
    "maxExecutionTime": 300
  }
};

    // Step 2: Extract available agents from coordinator
    const availableAgents = extractAvailableAgents(coordinator);
    console.log(`Found ${availableAgents.length} available agents`);
    console.log(`Frontend specified ${requirements.agents?.length || 0} Python agents for execution\n`);

    // Step 3: Create DAG Designer agent
    const dagDesigner = new DAGDesigner(coordinator.contextManager);

    // Step 4: Set input context
    coordinator.contextManager.updateContext('DAGDesigner', {
        lastTransactionResult: {
            workflowRequirements: requirements,
            availableAgents: availableAgents
        }
    });

    // Step 5: Execute DAG Designer
    console.log('🎨 Invoking DAG Designer...');
    console.log('Expected: DAG Designer should incorporate frontend agents using execute_agents flow type\n');
  let result: AgentResult = {
      agentName: 'cycle_start',
      result: '',//visualizationGroupingAgentsResult groupingAgentResult,groupingAgentFailedResult,
      success: true,
      timestamp: new Date()
    };

    result = await dagDesigner.execute({
        workflowRequirements: requirements,
        availableAgents: availableAgents
    });

    if (!result.success) {
        console.error('❌ DAG design failed:', result.error);
        return null;
    }

    const designResult = result.result as DAGDesignResult;
    const dag = designResult.dag!;

    // Step 6: Display designed DAG
    console.log('\n✅ DAG Design Complete!\n');
    console.log('📊 DAG Structure:');
    console.log(`   Name: ${dag.name}`);
    console.log(`   Description: ${dag.description}`);
    console.log(`   Nodes: ${dag.nodes.length}`);
    console.log(`   Edges: ${dag.edges.length}`);
    console.log(`   Entry: ${dag.entryNode}`);
    console.log(`   Exit: ${dag.exitNodes.join(', ')}`);

    console.log('\n🔀 Node Details:');
    dag.nodes.forEach(node => {
        console.log(`   - ${node.id}: ${node.agentName} (${node.type})`);
    });

    console.log('\n🔗 Edge Details:');
    let executeAgentsCount = 0;
    dag.edges.forEach(edge => {
        const flowIndicator = edge.flowType === 'execute_agents' ? '⚡' : '';
        console.log(`   ${flowIndicator} ${edge.from} →[${edge.flowType}]→ ${edge.to}`);
        if (edge.flowType === 'execute_agents') executeAgentsCount++;
    });

    console.log(`\n✅ Found ${executeAgentsCount} execute_agents flow type edges (expected: ${requirements.agents?.length || 0} frontend agents)`);

    if (designResult.warnings && designResult.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        designResult.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    return dag;
}

/**
 * Example 2: Execute Designed DAG
 */
export async function executeDesignedDAG(
    coordinator: SagaCoordinator,
    dag: any,
    userQuery: string
) {
    console.log('\n========================================');
    console.log('Example 2: Execute Designed DAG');
    console.log('========================================\n');

    // Create DAG Executor
    const dagExecutor = new DAGExecutor(coordinator);

    // Execute the DAG
    const result = await dagExecutor.executeDAG(dag, userQuery);

    console.log('\n✅ DAG Execution Complete!');
    console.log('Result:', result);

    return result;
}

/**
 * Example 3: Design Simple Data Processing Workflow
 */
export async function designDataProcessingWorkflow(coordinator: SagaCoordinator) {
    console.log('\n========================================');
    console.log('Example 3: Design Data Processing Workflow');
    console.log('========================================\n');

    const requirements: WorkflowRequirements = {
        objective: 'Analyze CSV data and generate statistical summary',

        inputData: {
            type: 'csv_file',
            source: './data/prices.csv'
        },

        outputExpectation: {
            type: 'statistical_report',
            format: 'json',
            quality: ['accurate', 'comprehensive']
        },

        constraints: {
            maxExecutionTime: 30000,
            parallelismAllowed: false
        }
    };

    const availableAgents = extractAvailableAgents(coordinator);
    const dagDesigner = new DAGDesigner(coordinator.contextManager);

    coordinator.contextManager.updateContext('DAGDesigner', {
        lastTransactionResult: {
            workflowRequirements: requirements,
            availableAgents: availableAgents
        }
    });

    const result = await dagDesigner.execute({
        workflowRequirements: requirements,
        availableAgents: availableAgents
    });

    if (result.success) {
        const designResult = result.result as DAGDesignResult;
        console.log('\n✅ Data Processing DAG Designed!');
        console.log(`   Nodes: ${designResult.dag?.nodes.length}`);
        console.log(`   Reasoning: ${designResult.reasoning}`);
        return designResult.dag;
    } else {
        console.error('❌ Design failed:', result.error);
        return null;
    }
}

/**
 * Example 4: Compare DAG Designer vs Manual Configuration
 */
export async function compareDesignApproaches(coordinator: SagaCoordinator) {
    console.log('\n========================================');
    console.log('Example 4: DAG Designer vs Manual Config');
    console.log('========================================\n');

    // Manual approach (current pipelineConfig)
    console.log('📝 Manual Approach:');
    console.log('   - Developer writes pipeline config');
    console.log('   - Hard-coded control flow steps');
    console.log('   - Requires understanding of all agents');
    console.log('   - Fixed, not adaptive');
    console.log('   - ~200 lines of configuration code');

    // DAG Designer approach
    console.log('\n🤖 DAG Designer Approach:');
    console.log('   - Provide workflow requirements (20-30 lines)');
    console.log('   - SDK agent autonomously designs DAG');
    console.log('   - Adapts to available agents');
    console.log('   - Can optimize for different goals');
    console.log('   - Self-documenting with reasoning');

    const requirements: WorkflowRequirements = {
        objective: 'Create D3 histogram with validation and correction loop',
        inputData: { type: 'csv_file', source: './data/prices.csv' },
        outputExpectation: { type: 'html_visualization', format: 'd3_histogram' },
        constraints: { parallelismAllowed: true }
    };

    const start = Date.now();
    const availableAgents = extractAvailableAgents(coordinator);
    const dagDesigner = new DAGDesigner(coordinator.contextManager);

    coordinator.contextManager.updateContext('DAGDesigner', {
        lastTransactionResult: {
            workflowRequirements: requirements,
            availableAgents: availableAgents
        }
    });

    const result = await dagDesigner.execute({
        workflowRequirements: requirements,
        availableAgents: availableAgents
    });

    const duration = Date.now() - start;

    if (result.success) {
        const designResult = result.result as DAGDesignResult;
        console.log(`\n✅ DAG designed in ${duration}ms`);
        console.log(`   Complexity: ${designResult.dag?.nodes.length} nodes, ${designResult.dag?.edges.length} edges`);
        console.log(`   Reasoning: ${designResult.reasoning}`);
    }
}

/**
 * Run all examples
 */
export async function runAllDAGExamples(coordinator: SagaCoordinator) {
    try {
        // Example 1: Design D3 workflow
        const dag = await designD3VisualizationWorkflow(coordinator);

        // NOTE: DAG execution temporarily disabled to view design output only
        // Uncomment below to test DAG execution after fixing FlowType issues
        /*
        if (dag) {
            // Example 2: Execute the designed DAG
            const userQuery = 'Create a histogram of prices from prices.csv';
            await executeDesignedDAG(coordinator, dag, userQuery);
        }
        */

        // Example 3: Simple data processing
        // await designDataProcessingWorkflow(coordinator);

        // Example 4: Comparison
        // await compareDesignApproaches(coordinator);

    } catch (error) {
        console.error('❌ Example execution failed:', error);
    }
}
