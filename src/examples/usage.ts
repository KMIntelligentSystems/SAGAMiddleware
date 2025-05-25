import { createSagaMiddleware, createAgentDefinition } from '../index';

async function exampleUsage() {
  const saga = createSagaMiddleware();

  const analyzerAgent = createAgentDefinition({
    name: 'analyzer',
    task: 'Analyze the provided data and extract key insights',
    provider: 'openai',
    model: 'gpt-4',
    expectedOutput: {
      insights: 'string[]',
      confidence: 'number',
      recommendations: 'string[]'
    },
    context: {
      domain: 'business_intelligence'
    }
  });

  const generatorAgent = createAgentDefinition({
    name: 'generator',
    task: 'Generate a report based on the analysis',
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    expectedOutput: {
      title: 'string',
      sections: 'object[]',
      conclusion: 'string'
    },
    dependencies: [
      { agentName: 'analyzer', required: true }
    ]
  });

  const reflectorAgent = createAgentDefinition({
    name: 'reflector',
    task: 'Review the generated report and suggest improvements',
    provider: 'openai',
    model: 'gpt-4',
    expectedOutput: {
      needsRegeneration: 'boolean',
      suggestions: 'string[]',
      quality_score: 'number'
    },
    dependencies: [
      { agentName: 'generator', required: true }
    ]
  });

  saga.registerAgent(analyzerAgent);
  saga.registerAgent(generatorAgent);
  saga.registerAgent(reflectorAgent);

  saga.on('saga_event', (event) => {
    console.log(`[${event.type}] ${event.agentName || 'workflow'}: ${event.id}`);
    if (event.data) {
      console.log('  Data:', JSON.stringify(event.data, null, 2));
    }
  });

  try {
    const results = await saga.executeWorkflow({
      inputData: 'Sample business data for analysis',
      userPreferences: {
        reportStyle: 'executive_summary',
        includeCharts: true
      }
    });

    console.log('\nWorkflow Results:');
    for (const [agentName, result] of results) {
      console.log(`${agentName}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.success) {
        console.log('  Result:', JSON.stringify(result.result, null, 2));
      } else {
        console.log('  Error:', result.error);
      }
    }

  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

if (require.main === module) {
  exampleUsage().catch(console.error);
}