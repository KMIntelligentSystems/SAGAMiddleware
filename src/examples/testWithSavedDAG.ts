import { DAGExecutor } from '../workflows/dagExecutor.js';
import { loadDAG, listSavedDAGs } from '../utils/dagLoader.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';

/**
 * Test workflow execution using a saved DAG
 * This avoids the expensive dagDesigner invocation
 */
async function testD3WorkflowWithSavedDAG() {
    console.log('🔄 Loading saved DAG for testing...\n');

    // List available DAGs
    const savedDAGs = await listSavedDAGs();
    console.log('📁 Available saved DAGs:');
    savedDAGs.forEach(dag => console.log(`   - ${dag}`));
    console.log();

    // Load the D3 histogram DAG
    const dag = await loadDAG('d3_histogram_dag.json');

    console.log('✅ DAG loaded successfully!');
    console.log(`   Name: ${dag.name}`);
    console.log(`   Nodes: ${dag.nodes.length}`);
    console.log(`   Edges: ${dag.edges.length}\n`);

    // Create coordinator and executor
    const coordinator = new SagaCoordinator({});  // Empty MCP config for testing
    const executor = new DAGExecutor(coordinator);

    // Prepare input for the workflow
    const input = {
        csvFilePath: './data/price_data.csv',
        userRequest: 'Create a histogram visualization of the price distribution'
    };

    // Execute the DAG
    console.log('🚀 Executing DAG workflow...\n');
    try {
        await executor.executeDAG(dag, input);
        console.log('\n✅ Workflow completed successfully!');

        // Get results from context
        const finalContext = coordinator.contextManager.getContext(dag.exitNodes[0]);
        if (finalContext) {
            console.log('📊 Final context available');
        }

        return { success: true };
    } catch (error) {
        console.error('\n❌ Workflow failed:', error);
        return { success: false, error };
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testD3WorkflowWithSavedDAG()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error:', err);
            process.exit(1);
        });
}

export { testD3WorkflowWithSavedDAG };
