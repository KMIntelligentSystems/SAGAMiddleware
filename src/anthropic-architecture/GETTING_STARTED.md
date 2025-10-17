# Getting Started with Anthropic Architecture

This guide will help you get started with the Anthropic Coordinator-Subagent Architecture in the SAGA middleware.

## Quick Start

### 1. Install Dependencies

Ensure you have the required dependencies:
```bash
npm install @anthropic-ai/sdk
```

### 2. Set Environment Variables

Create or update your `.env` file:
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_key_here  # Optional, for comparison
```

### 3. Run the Example

```bash
# Build the project
npm run build

# Run the data domain example
node dist/anthropic-architecture/examples/dataDomainExample.js
```

## Basic Usage

### Creating a Data Domain Coordinator

```typescript
import { CoordinatorFactory } from './anthropic-architecture';
import { createMCPServerConfig, connectToMCPServer } from './index';

// Setup MCP servers (for data transformation via Python)
const mcpServers = {
  execution: createMCPServerConfig({
    name: "execution-server",
    transport: "stdio",
    command: "node",
    args: ["C:/repos/codeGen-mcp-server/dist/server.js", "--stdio"],
    timeout: 300000
  })
};

await connectToMCPServer(mcpServers.execution);

// Create coordinator with all subagents registered
const coordinator = CoordinatorFactory.createDataDomainCoordinator(mcpServers);
```

### Executing a Data Analysis Request

```typescript
import { CoordinatorRequest } from './anthropic-architecture/types';

const request: CoordinatorRequest = {
  userQuery: `Analyze data/supply.csv:
    1. Understand the schema
    2. Calculate daily averages by installation
    3. Validate data quality
    4. Provide summary for D3.js visualization`,
  requirements: {
    dataFile: 'data/supply.csv',
    analysisType: 'time-series',
    visualizationType: 'd3-line-chart'
  }
};

const response = await coordinator.execute(request);

if (response.success) {
  console.log('Data Analysis:', response.result);

  // If passing to coding coordinator
  if (response.handoffData) {
    console.log('Ready for:', response.handoffData.targetCoordinator);
    // Pass payload to CodingDomainCoordinator...
  }
}
```

## Understanding the Execution Flow

### Coordinator Decision Loop

The coordinator runs in a loop, making decisions at each iteration:

```
Iteration 1: "Need to understand data structure"
  → Calls SchemaAnalyzerSubagent
  → Updates context with schema

Iteration 2: "User wants transformations"
  → Calls DataTransformerSubagent
  → Updates context with transformation results

Iteration 3: "Should validate quality"
  → Calls DataValidatorSubagent
  → Updates context with validation results

Iteration 4: "Need summary for visualization"
  → Calls DataSummarizerSubagent
  → Updates context with summary

Iteration 5: "Time to synthesize"
  → Synthesizes all results
  → Creates coherent analysis

Iteration 6: "Analysis complete"
  → Returns response with handoff to coding coordinator
```

### Viewing Execution Trace

```typescript
const response = await coordinator.execute(request);

// Get detailed execution trace
const trace = coordinator.getExecutionTrace();

console.log('Decisions made:');
trace.decisions.forEach((decision, idx) => {
  console.log(`${idx + 1}. ${decision.action}: ${decision.reasoning}`);
});

console.log('\nSubagent calls:');
trace.subagentCalls.forEach((call, idx) => {
  console.log(`${idx + 1}. ${call.task.taskType} - ${call.result.success ? '✅' : '❌'}`);
});
```

## Customizing Prompts

### Coordinator System Prompt

Edit in [CoordinatorFactory.ts](CoordinatorFactory.ts):

```typescript
const coordinatorConfig: CoordinatorConfig = {
  // ...
  systemPrompt: `You are the Data Domain Coordinator...

    Your decision-making principles:
    1. Always start with schema analysis
    2. Transform only when user requests it
    3. Validate before summarization
    4. Summarize in chunks for large files

    ...
  `
};
```

### Subagent Prompts

Each subagent has a `promptTemplate` in its definition:

```typescript
const schemaAnalyzerDef: SubagentDefinition = {
  // ...
  promptTemplate: `You are a data schema analysis specialist.

    Your task:
    1. Analyze CSV structure
    2. Infer column types
    3. Detect relationships

    Be precise and data-driven.
  `
};
```

## Working with Results

### Schema Analysis Result

```typescript
interface SchemaAnalysisResult {
  columns: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'datetime' | 'text';
    nullable: boolean;
    sampleValues?: any[];
  }>;
  rowCount: number;
  inferredRelationships?: Array<{
    column: string;
    relationType: 'temporal' | 'categorical_group' | 'numeric_range';
  }>;
}

// Access result
const schemaAnalysis = response.result.schemaAnalysis;
console.log('Columns:', schemaAnalysis.columns.map(c => c.name));
console.log('Row count:', schemaAnalysis.rowCount);
```

### Data Summarization Result

```typescript
interface DataSummarizationResult {
  chunksSummarized: number;
  totalRows: number;
  summary: {
    temporalRange?: { start: string; end: string };
    categories?: string[];
    numericRanges?: Record<string, { min: number; max: number; mean: number }>;
  };
  detailedAnalysis: string; // For coding agent
}

// Access result
const summary = response.result.summarizationResult;
console.log('Temporal range:', summary.summary.temporalRange);
console.log('Categories:', summary.summary.categories);
console.log('Analysis:', summary.detailedAnalysis);
```

## Integrating with Existing System

You can use the Anthropic architecture alongside your existing SAGA workflow:

### Option 1: Replace Transaction Flow

```typescript
// In SagaWorkflow.executeThreadVisualizationSAGA()

// Instead of:
// this.coordinator.initializeControlFlow(CONTROL_FLOW_LIST);
// await this.coordinator.executeControlFlow(userQuery);

// Use:
import { CoordinatorFactory } from '../anthropic-architecture';

const dataCoordinator = CoordinatorFactory.createDataDomainCoordinator(this.mcpServers);
const dataAnalysis = await dataCoordinator.execute({ userQuery });

// Continue with D3 coding...
if (dataAnalysis.handoffData) {
  // Use dataAnalysis.handoffData.payload for visualization
}
```

### Option 2: Hybrid Approach

```typescript
// Use Anthropic for data domain
const dataCoordinator = CoordinatorFactory.createDataDomainCoordinator();
const dataResults = await dataCoordinator.execute({ userQuery });

// Use existing system for coding domain
this.coordinator.initializeControlFlow(D3_CODING_FLOW_LIST);
await this.coordinator.executeControlFlow(dataResults.handoffData.payload);
```

## Error Handling

The coordinator handles errors gracefully:

```typescript
const response = await coordinator.execute(request);

if (!response.success) {
  console.error('Coordinator failed:', response.error);

  // Check execution trace to see where it failed
  const trace = coordinator.getExecutionTrace();
  const failedCalls = trace.subagentCalls.filter(call => !call.result.success);

  failedCalls.forEach(call => {
    console.error(`Failed: ${call.task.taskType}`);
    console.error(`Error: ${call.result.error}`);
  });
}
```

## Testing Individual Subagents

You can test subagents independently:

```typescript
import { SchemaAnalyzerSubagent } from './anthropic-architecture/subagents';
import { SubagentDefinition, SubagentTask } from './anthropic-architecture/types';

// Create subagent
const def: SubagentDefinition = {
  id: 'test_schema',
  name: 'Test Schema Analyzer',
  type: 'schema_analyzer',
  description: 'Test',
  capabilities: [],
  promptTemplate: 'Analyze CSV schema...',
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    temperature: 0.3,
    maxTokens: 4000
  }
};

const subagent = new SchemaAnalyzerSubagent(def);

// Create task
const task: SubagentTask = {
  taskId: 'test_task_1',
  taskType: 'schema_analyzer',
  description: 'Analyze test CSV',
  input: { filePath: 'data/test.csv' }
};

// Execute
const result = await subagent.executeTask(task);
console.log('Result:', result);
```

## Performance Tips

### 1. Adjust Iteration Limits

```typescript
const coordinatorConfig: CoordinatorConfig = {
  // ...
  maxIterations: 15,  // Default: 10
  maxSubagentCalls: 20  // Default: 15
};
```

### 2. Optimize Chunk Sizes

For large files, adjust chunk size in summarizer:

```typescript
const request: CoordinatorRequest = {
  userQuery: 'Analyze large.csv...',
  requirements: {
    dataFile: 'large.csv',
    chunkSize: 50  // Default: 20, increase for faster processing
  }
};
```

### 3. Use Appropriate Models

```typescript
// Fast, cheaper model for simple tasks
llmConfig: {
  provider: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  temperature: 0.2
}

// More capable model for complex reasoning
llmConfig: {
  provider: 'anthropic',
  model: 'claude-3-7-sonnet-20250219',
  temperature: 0.5
}
```

## Next Steps

1. **Test with Your Data**
   - Run the example with your CSV files
   - Adjust prompts based on results

2. **Build Coding Domain Coordinator**
   - Create `CodingDomainCoordinator`
   - Implement D3 code generation subagents
   - Connect data → coding pipeline

3. **Refine Prompts**
   - Tune coordinator decision-making
   - Improve subagent task descriptions
   - Add domain-specific knowledge

4. **Add More Subagents**
   - DataCleanerSubagent (handle missing values)
   - DataVisualizerSubagent (recommend chart types)
   - DataMergerSubagent (join multiple sources)

## Troubleshooting

### "No JSON found in response"

The LLM didn't return properly formatted JSON. Check:
- Prompt clarity
- Temperature (try lower, e.g., 0.2)
- Model capability

### "File not found"

Ensure file paths are absolute:
```typescript
import * as path from 'path';

const filePath = path.join(process.cwd(), 'data', 'supply.csv');
```

### "MCP tool execution failed"

Check:
- MCP server is running
- Server configuration is correct
- Tool name matches available tools

## Resources

- [README.md](README.md) - Full documentation
- [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md) - Conceptual overview
- [FLOW_DIAGRAM.md](FLOW_DIAGRAM.md) - Visual execution flows
- [Anthropic Agent Guide](https://www.anthropic.com/research/building-effective-agents)

## Support

For issues or questions:
1. Check execution trace for detailed debugging
2. Review prompt templates for clarity
3. Test subagents individually to isolate issues
