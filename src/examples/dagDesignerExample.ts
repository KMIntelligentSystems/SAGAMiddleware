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

/**
 * Example 1: Design D3 Visualization Workflow with Frontend Agent Specifications
 */
export async function designD3VisualizationWorkflow(coordinator: SagaCoordinator) {
    console.log('\n========================================');
    console.log('Example 1: Design D3 Visualization Workflow with Frontend Agents');
    console.log('========================================\n');

    // Step 1: Define workflow requirements (from actual frontend output)
    const requirements: WorkflowRequirements = {
        objective: 'Create D3.js interactive histogram with intelligent outlier handling for prices dataset using 4-agent workflow with sophisticated statistical analysis',

        inputData: {
            type: 'csv_file',
            source: 'C:/repos/SAGAMiddleware/data/prices.csv',
            schema: {
                columns: ['price'],
                rowCount: 10000,
                characteristics: 'Right-skewed distribution with extreme outliers (23.0-9502.0), dense region 50-500'
            }
        },

        // Frontend-specified Python agents (CRITICAL for ExecuteAgentsStrategy)
        agents: [
            {
                name: 'DataProfiler',
                description: 'Data Profiler & Statistical Analyzer',
                task: 'Load the complete CSV file and generate comprehensive statistical profile including min, max, quartiles, mean, median, standard deviation, skewness, and outlier detection using both IQR method and Z-score analysis. Count total records and identify extreme values.',
                inputFrom: null,
                outputSchema: {
                    filepath: 'string',
                    row_count: 'int',
                    statistics: {
                        min: 'float',
                        max: 'float',
                        mean: 'float',
                        median: 'float',
                        q1: 'float',
                        q3: 'float',
                        std: 'float',
                        skewness: 'float',
                        kurtosis: 'float'
                    },
                    outliers: {
                        iqr_outliers: {
                            count: 'int',
                            threshold_low: 'float',
                            threshold_high: 'float'
                        }
                    }
                }
            },
            {
                name: 'HistogramParametersOptimizer',
                description: 'Histogram Parameters Optimizer',
                task: 'Analyze the statistical profile to determine optimal histogram parameters. Calculate appropriate bin count using multiple methods (Freedman-Diaconis, Sturges, Scott\'s rule), determine outlier handling strategy, assess if data transformation is needed, and recommend visualization range for best user experience.',
                inputFrom: 'DataProfiler',
                outputSchema: {
                    bin_analysis: {
                        freedman_diaconis_bins: 'int',
                        sturges_bins: 'int',
                        scotts_bins: 'int',
                        recommended_bins: 'int',
                        bin_width: 'float'
                    },
                    outlier_handling: {
                        strategy: 'string',
                        cap_percentile: 'float'
                    }
                }
            },
            {
                name: 'DataPreprocessor',
                description: 'Data Preprocessor & Binner',
                task: 'Apply the recommended outlier handling and data transformations. Create optimized datasets for visualization - both the main histogram data and outlier information. Generate precise bin assignments and calculate frequencies. Prepare all data structures needed for D3.js consumption.',
                inputFrom: 'HistogramParametersOptimizer',
                outputSchema: {
                    processed_data: {
                        main_dataset: 'list',
                        outliers_removed: 'list',
                        original_count: 'int',
                        processed_count: 'int'
                    },
                    binned_data: 'list'
                }
            },
            {
                name: 'D3JSHistogramGenerator',
                description: 'D3.js Interactive Histogram Generator',
                task: 'Generate a complete, production-ready D3.js HTML file that creates an interactive histogram with intelligent outlier handling. Include responsive design, tooltips showing bin details and outlier information, axis labels, legend, and zoom/pan functionality. Load data from relative path for portability. Add statistical overlay lines (mean, median) and outlier annotations.',
                inputFrom: 'DataPreprocessor',
                outputSchema: {
                    html_filepath: 'string',
                    visualization_type: 'string',
                    status: 'string'
                }
            }
        ],

        outputExpectation: {
            type: 'html_visualization',
            format: 'd3_histogram',
            quality: ['validated', 'data_accurate', 'production_ready', 'interactive_tooltips', 'responsive_design']
        },

        constraints: {
            maxExecutionTime: 60000,
            parallelismAllowed: false, // Sequential execution for agent chain
            executionOrder: 'sequential',
            mustIncludeAgents: ['D3JSCodeValidator'], // Still include validation
            mustExcludeAgents: []
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

    const result = await dagDesigner.execute({
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
