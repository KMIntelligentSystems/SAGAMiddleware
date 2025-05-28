import { createSagaMiddleware, createAgentDefinition } from '../index.js';
import dotenv from 'dotenv';

dotenv.config();

async function exampleUsage() {
  console.log('Creating saga middleware...');
  const saga = createSagaMiddleware();

  const analyzerAgent = createAgentDefinition({
    name: 'analyzer',
    task: 'Analyze the provided data and extract key insights',
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env["OPENAI_API_KEY"] as string,
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
    model: 'claude-3-7-sonnet-20250219',
    apiKey: process.env["ANTHROPIC_API_KEY"] as string,
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
    apiKey: process.env["OPENAI_API_KEY"] as string,
    expectedOutput: {
      needsRegeneration: 'boolean',
      suggestions: 'string[]',
      quality_score: 'number'
    },
    dependencies: [
      { agentName: 'generator', required: true }
    ]
  });

  console.log('Registering agents...');
  saga.registerAgent(analyzerAgent);
  saga.registerAgent(generatorAgent);
  saga.registerAgent(reflectorAgent);

  console.log('Setting up event listeners...');
  saga.on('saga_event', (event) => {
    console.log(`[${event.type}] ${event.agentName || 'workflow'}: ${event.id}`);
    if (event.data) {
      console.log('  Data:', JSON.stringify(event.data, null, 2));
    }
  });

  try {
    console.log('Starting workflow execution...');
    const results = await saga.executeWorkflow({
      inputData: 'Sample business data for analysis',
      userPreferences: {
        reportStyle: 'executive_summary',
        includeCharts: true
      }
    });

    console.log('\nWorkflow Results:');
    for (const [agentName, result] of Array.from(results.entries())) {
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

// Always execute - simplified for ES modules
console.log("Starting script...");

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

// Wrap everything in try-catch to catch synchronous errors
try {
  console.log("About to call exampleUsage...");
  
  exampleUsage()
    .then(() => {
      console.log('Script completed successfully');
      keepOpen();
    })
    .catch((error) => {
      console.error('Script failed:', error);
      keepOpen();
    });
    
} catch (syncError) {
  console.error('Synchronous error occurred:', syncError);
  console.log('Press Ctrl+C to exit or wait 10 seconds...');
  setTimeout(() => process.exit(1), 10000);
}