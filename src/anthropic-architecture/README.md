# Anthropic Coordinator-Subagent Architecture

This directory implements the **Anthropic Agent Architecture** pattern for the SAGA middleware, consisting of:
- **Contextful Coordinators**: Maintain conversation state, make decisions, orchestrate work
- **Stateless Subagents**: Execute bounded tasks, no context retention

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Data Domain Coordinator                     │
│  (Contextful - Maintains data analysis state)               │
│                                                              │
│  - User query understanding                                  │
│  - Decision making (which subagent to call next)            │
│  - Result accumulation & synthesis                          │
│  - Handoff to Coding Domain Coordinator                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Orchestrates
             │
     ┌───────┴─────────────────────────────┐
     │                                     │
     ▼                                     ▼
┌─────────────────┐              ┌─────────────────┐
│ Schema Analyzer │              │ Data Transformer│
│  (Stateless)    │              │   (Stateless)   │
│                 │              │                 │
│ - Infer types   │              │ - Generate code │
│ - Detect        │              │ - Execute via   │
│   relationships │              │   MCP           │
└─────────────────┘              └─────────────────┘
     │                                     │
     │                                     │
     ▼                                     ▼
┌─────────────────┐              ┌─────────────────┐
│ Data Validator  │              │ Data Summarizer │
│  (Stateless)    │              │  (Stateless)    │
│                 │              │                 │
│ - Check rules   │              │ - Chunk-based   │
│ - Validate      │              │ - Iterative     │
│   constraints   │              │ - Synthesis     │
└─────────────────┘              └─────────────────┘
```

## Directory Structure

```
anthropic-architecture/
├── types/
│   └── index.ts                 # Type definitions for architecture
├── coordinators/
│   ├── BaseCoordinator.ts       # Abstract base for coordinators
│   ├── DataDomainCoordinator.ts # Data domain implementation
│   └── index.ts
├── subagents/
│   ├── BaseSubagent.ts          # Abstract base for subagents
│   ├── SchemaAnalyzerSubagent.ts
│   ├── DataTransformerSubagent.ts
│   ├── DataValidatorSubagent.ts
│   ├── DataSummarizerSubagent.ts
│   └── index.ts
├── examples/
│   └── dataDomainExample.ts     # Usage example
├── CoordinatorFactory.ts         # Factory for creating coordinators
├── index.ts                      # Main exports
└── README.md                     # This file
```

## Key Concepts

### 1. Coordinators (Contextful)

**Characteristics:**
- Maintain working memory across iterations
- Make decisions about which subagent to call
- Accumulate and synthesize results
- Determine when task is complete or should handoff

**Example: DataDomainCoordinator**
```typescript
const coordinator = CoordinatorFactory.createDataDomainCoordinator();

const response = await coordinator.execute({
  userQuery: "Analyze supply.csv and calculate daily averages..."
});

// Coordinator maintains context of:
// - User's original query
// - Schema discovered from SchemaAnalyzer
// - Transformation results from DataTransformer
// - Validation results from DataValidator
// - Summaries from DataSummarizer
```

### 2. Subagents (Stateless)

**Characteristics:**
- Receive a task, execute it, return result
- No memory of previous tasks
- Can use LLM and/or tools (MCP)
- Single responsibility

**Example: SchemaAnalyzerSubagent**
```typescript
const task: SubagentTask = {
  taskId: 'analyze_schema_1',
  taskType: 'schema_analyzer',
  description: 'Analyze CSV structure and infer schema',
  input: { filePath: 'data/supply.csv' }
};

const result = await subagent.executeTask(task);
// Returns: SchemaAnalysisResult with column types, relationships, etc.
```

## Data Domain Subagents

### 1. Schema Analyzer
**Purpose:** Analyze CSV file structure and infer data schema

**Input:**
```typescript
{
  filePath: string;
  sampleSize?: number; // Default: 100
}
```

**Output:**
```typescript
{
  columns: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'unknown';
    nullable: boolean;
    uniqueCount?: number;
    sampleValues?: any[];
  }>;
  rowCount: number;
  filePath: string;
  inferredRelationships?: Array<{
    column: string;
    relationType: 'temporal' | 'categorical_group' | 'numeric_range';
    description: string;
  }>;
}
```

### 2. Data Transformer
**Purpose:** Execute data transformations using Python via MCP

**Input:**
```typescript
{
  sourceFile: string;
  operations: Array<{
    type: 'filter' | 'group' | 'aggregate' | 'normalize' | 'pivot';
    parameters: Record<string, any>;
  }>;
  outputFile: string;
}
```

**Output:**
```typescript
{
  outputFile: string;
  rowsProcessed: number;
  rowsOutput: number;
  summary: {
    min?: Record<string, number>;
    max?: Record<string, number>;
    mean?: Record<string, number>;
    categories?: Record<string, string[]>;
  };
}
```

### 3. Data Validator
**Purpose:** Validate data against rules and constraints

**Input:**
```typescript
{
  filePath: string;
  rules: {
    requiredColumns?: string[];
    columnTypes?: Record<string, string>;
    rangeChecks?: Record<string, { min?: number; max?: number }>;
    customValidations?: Array<{
      rule: string;
      errorMessage: string;
    }>;
  };
}
```

**Output:**
```typescript
{
  isValid: boolean;
  errors: Array<{
    type: 'missing_column' | 'type_mismatch' | 'range_violation' | 'custom';
    column?: string;
    message: string;
    affectedRows?: number;
  }>;
  warnings?: Array<{
    type: string;
    message: string;
  }>;
}
```

### 4. Data Summarizer
**Purpose:** Summarize data iteratively in chunks for visualization planning

**Input:**
```typescript
{
  filePath: string;
  chunkSize?: number; // Default: 20
  purpose?: string; // Default: 'visualization_planning'
}
```

**Output:**
```typescript
{
  chunksSummarized: number;
  totalRows: number;
  summary: {
    temporalRange?: { start: string; end: string };
    categories?: string[];
    numericRanges?: Record<string, { min: number; max: number; mean: number }>;
    visualizationRecommendations?: string[];
  };
  detailedAnalysis: string; // Natural language summary for coding agent
}
```

## Execution Flow

### Typical Data Domain Flow

1. **User Query Received**
   ```
   "Analyze supply.csv and create visualization data"
   ```

2. **Coordinator Iteration 1: Schema Analysis**
   - Decision: Call `schema_analyzer`
   - Result: Discovers columns, types, relationships
   - Context updated with schema

3. **Coordinator Iteration 2: Data Transformation** (if needed)
   - Decision: Call `data_transformer`
   - Result: Filters/groups/aggregates data
   - Context updated with transformation results

4. **Coordinator Iteration 3: Validation**
   - Decision: Call `data_validator`
   - Result: Validates data quality
   - Context updated with validation results

5. **Coordinator Iteration 4: Summarization**
   - Decision: Call `data_summarizer`
   - Result: Chunk-based summary for visualization
   - Context updated with summary

6. **Coordinator Iteration 5: Synthesize**
   - Decision: `synthesize`
   - Combines all results into coherent analysis

7. **Coordinator Iteration 6: Complete**
   - Decision: `pass_to_coordinator`
   - Packages results for Coding Domain Coordinator

## Usage Example

```typescript
import { CoordinatorFactory } from './anthropic-architecture';

// 1. Create coordinator with subagents
const coordinator = CoordinatorFactory.createDataDomainCoordinator(mcpServers);

// 2. Define request
const request = {
  userQuery: `Analyze data/supply.csv and calculate daily averages
              for visualization as a D3.js line chart`,
  requirements: {
    dataFile: 'data/supply.csv',
    analysisType: 'time-series',
    visualizationType: 'd3-line-chart'
  }
};

// 3. Execute
const response = await coordinator.execute(request);

// 4. Use results
if (response.success) {
  console.log('Schema:', response.result.schemaAnalysis);
  console.log('Summary:', response.result.summarizationResult);

  // Pass to coding coordinator
  if (response.handoffData) {
    await codingCoordinator.execute({
      userQuery: request.userQuery,
      context: response.handoffData.payload
    });
  }
}
```

## Benefits Over Previous Approach

### 1. **Clear Separation of Concerns**
- Coordinators: Think, decide, maintain context
- Subagents: Execute, return, no state

### 2. **Parallel Execution Potential**
- Multiple stateless subagents can run concurrently
- Coordinator orchestrates parallel tasks

### 3. **Easier Testing**
- Subagents are pure functions (input → output)
- Coordinators can be tested with mock subagents

### 4. **Better Error Handling**
- Coordinator can retry failed subagent tasks
- No context corruption on failure

### 5. **Simplified Prompts**
- No need for `[AGENT]...[/AGENT]` parsing
- Coordinators and subagents have focused prompts

## Prompt Design Principles

### Coordinator Prompt
```
You are the Data Domain Coordinator.

Your role:
- Maintain context about user's data requirements
- Decide which subagents to call
- Accumulate and synthesize results
- Determine when to complete or handoff

Decision format:
{
  "action": "call_subagent|synthesize|complete|pass_to_coordinator",
  "reasoning": "why...",
  "subagentType": "...",
  ...
}
```

### Subagent Prompt
```
You are a Schema Analyzer.

Your task:
- Analyze CSV structure
- Infer column types
- Identify relationships

Input: CSV file path and sample data
Output: JSON schema analysis

Be precise and data-driven.
```

## Future Extensions

1. **Coding Domain Coordinator**
   - Receives data analysis from Data Domain
   - Orchestrates code generation subagents
   - Validates and tests generated code

2. **Additional Subagents**
   - DataVisualizerSubagent: Generate visualization recommendations
   - DataCleanerSubagent: Handle missing values, outliers
   - DataMergerSubagent: Join multiple data sources

3. **Multi-Coordinator Workflows**
   - DataDomain → CodingDomain → ValidationDomain
   - Each coordinator maintains its domain context
   - Clean handoffs between domains

## Comparison with Existing System

| Aspect | Previous System | Anthropic Architecture |
|--------|----------------|------------------------|
| Context | Distributed across agents | Centralized in coordinator |
| Agent Definition | Dynamic via parsing `[AGENT]` tags | Static, strongly-typed subagents |
| Execution | SAGA transactions, flows | Coordinator decision loop |
| Tool Calling | Generic agents with MCP | Specialized subagents with MCP |
| Validation | Separate ValidatingAgent | Integrated validation subagent |
| Complexity | High (parsing, flows, transactions) | Lower (coordinator + subagents) |

## Integration with Existing System

The Anthropic architecture can coexist with the current SAGA system:

```typescript
// In SagaWorkflow
import { CoordinatorFactory } from './anthropic-architecture';

// Instead of TransactionGroupingAgent + dynamic agents
const dataCoordinator = CoordinatorFactory.createDataDomainCoordinator();
const dataAnalysis = await dataCoordinator.execute({ userQuery });

// Continue with existing D3JSCoordinatingAgent for coding
// Or create CodingDomainCoordinator for full Anthropic flow
```

## References

- [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [SAGA Pattern](https://microservices.io/patterns/data/saga.html)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
