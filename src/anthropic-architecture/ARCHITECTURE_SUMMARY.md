# Architecture Summary: Anthropic Coordinator-Subagent Pattern

## What We Built

A complete implementation of Anthropic's recommended agent architecture for the **Data Domain** of your SAGA middleware.

## File Structure Created

```
src/anthropic-architecture/
├── types/index.ts                           # Type definitions
├── coordinators/
│   ├── BaseCoordinator.ts                   # Abstract coordinator base
│   ├── DataDomainCoordinator.ts             # Data domain implementation
│   └── index.ts
├── subagents/
│   ├── BaseSubagent.ts                      # Abstract subagent base
│   ├── SchemaAnalyzerSubagent.ts            # CSV schema analysis
│   ├── DataTransformerSubagent.ts           # Data transformations (Python/MCP)
│   ├── DataValidatorSubagent.ts             # Data validation
│   ├── DataSummarizerSubagent.ts            # Iterative data summarization
│   └── index.ts
├── examples/
│   └── dataDomainExample.ts                 # Working example
├── CoordinatorFactory.ts                     # Factory for creating coordinators
├── index.ts                                  # Main exports
├── README.md                                 # Full documentation
└── ARCHITECTURE_SUMMARY.md                   # This file
```

## Core Components

### 1. BaseCoordinator (Abstract Class)
- Maintains conversation context
- Makes decisions about next actions
- Orchestrates stateless subagents
- Accumulates results across iterations
- Determines completion or handoff

**Key Methods:**
- `execute(request)` - Main entry point
- `makeDecision()` - Abstract, returns next action
- `synthesizeResults()` - Abstract, combines subagent results
- `generateFinalResponse()` - Abstract, creates final output

### 2. DataDomainCoordinator (Concrete Implementation)
- Implements data-specific decision logic
- Tracks schema analysis, transformations, validations, summaries
- Uses LLM to decide which subagent to call next
- Builds comprehensive data analysis

**Decision Flow:**
```
User Query → Decision Loop → [
  Call Schema Analyzer?
  Call Data Transformer?
  Call Validator?
  Call Summarizer?
  Synthesize?
  Complete/Handoff?
]
```

### 3. Subagents (4 Implementations)

#### SchemaAnalyzerSubagent
- **Input:** CSV file path
- **Process:** Reads file, samples data, uses LLM to infer schema
- **Output:** Column types, relationships, statistics
- **Stateless:** No memory between tasks

#### DataTransformerSubagent
- **Input:** Transformation spec (operations, source, output)
- **Process:** Generates Python code, executes via MCP
- **Output:** Transformed data file + summary stats
- **Uses:** MCP execution server

#### DataValidatorSubagent
- **Input:** File path + validation rules
- **Process:** Checks columns, types, ranges, custom rules
- **Output:** Validation result (pass/fail + errors)
- **Hybrid:** Simple rules + LLM for complex validations

#### DataSummarizerSubagent
- **Input:** File path + chunk size
- **Process:** Iterates through data in chunks, summarizes each, synthesizes
- **Output:** Comprehensive summary for visualization planning
- **Iterative:** Handles large files

## How It Works

### Example Execution Flow

```
1. USER QUERY:
   "Analyze supply.csv and calculate daily averages for D3.js visualization"

2. COORDINATOR INITIALIZES:
   - Creates context with user query
   - Prepares for iteration

3. ITERATION 1:
   Coordinator: "I need to understand the data structure first"
   → Calls SchemaAnalyzerSubagent
   → Result: Columns [timestamp, output, type, location], 10000 rows
   → Updates context with schema

4. ITERATION 2:
   Coordinator: "User wants daily averages, need to transform"
   → Calls DataTransformerSubagent
   → Input: group by date+installation, aggregate mean(output)
   → Result: Transformed CSV with daily averages
   → Updates context with transformation

5. ITERATION 3:
   Coordinator: "Should validate the transformed data"
   → Calls DataValidatorSubagent
   → Input: Required columns, type checks
   → Result: Valid, no errors
   → Updates context with validation

6. ITERATION 4:
   Coordinator: "Need summary for visualization code"
   → Calls DataSummarizerSubagent
   → Process: 20 rows at a time, synthesize insights
   → Result: Date range, installations list, value ranges, recommendations
   → Updates context with summary

7. ITERATION 5:
   Coordinator: "Time to synthesize all results"
   → Action: synthesize
   → Combines schema, transformations, validation, summary
   → Natural language synthesis for coding agent

8. ITERATION 6:
   Coordinator: "Data analysis complete, pass to coding"
   → Action: pass_to_coordinator
   → Target: coding_domain_coordinator
   → Payload: All accumulated data insights

9. RESPONSE:
   {
     success: true,
     handoffData: {
       targetCoordinator: 'coding_domain_coordinator',
       payload: {
         schemaAnalysis: {...},
         transformationResults: {...},
         summarizationResult: {...},
         synthesis: "The data contains..."
       }
     }
   }
```

## Key Design Decisions

### 1. Coordinator Uses LLM for Decision-Making
Instead of hardcoded flows, the coordinator calls its LLM to decide what to do next based on current context.

**Prompt Pattern:**
```typescript
const decision = await callCoordinatorLLM(`
  Context: ${buildContextSummary()}
  Available subagents: ${listSubagents()}

  Decide next action and respond with JSON:
  {
    "action": "call_subagent|synthesize|complete",
    "reasoning": "...",
    "subagentType": "...",
    ...
  }
`);
```

### 2. Subagents Are Pure Functions
Each subagent receives a task, executes it, and returns a result. No state between tasks.

```typescript
interface SubagentTask {
  taskId: string;
  taskType: string;
  input: any;
}

interface SubagentResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
}
```

### 3. Context Accumulation in Coordinator
The coordinator maintains all discovered knowledge:
- `discoveredSchema` - From SchemaAnalyzer
- `transformationResults` - From DataTransformer
- `validationResults` - From DataValidator
- `dataAnalysis` - From DataSummarizer

This context grows with each iteration and informs future decisions.

### 4. Clean Handoff Between Domains
When data analysis is complete, the coordinator packages all insights for the coding coordinator:

```typescript
{
  handoffData: {
    targetCoordinator: 'coding_domain_coordinator',
    payload: {
      // Everything coding needs to generate D3.js
      schemaAnalysis,
      transformationResults,
      summarizationResult,
      synthesis
    }
  }
}
```

## Integration with Your Existing System

### Current System
```
User Query
  ↓
ConversationAgent (pass-through)
  ↓
TransactionGroupingAgent (creates [AGENT]...[/AGENT] tags)
  ↓
ValidatingAgent (checks format)
  ↓
DefineGenericAgentsProcess (parses tags, creates agents)
  ↓
ExecuteGenericAgentsProcess (runs agents in flow)
  ↓
... (multiple validation/correction loops)
  ↓
D3JSCoordinatingAgent (summarize data)
  ↓
D3JSCodingAgent
```

### With Anthropic Architecture
```
User Query
  ↓
DataDomainCoordinator (maintains context, makes decisions)
  ├→ SchemaAnalyzerSubagent
  ├→ DataTransformerSubagent
  ├→ DataValidatorSubagent
  └→ DataSummarizerSubagent
  ↓
(synthesize all results)
  ↓
CodingDomainCoordinator (receives data insights)
  ├→ D3CodeGeneratorSubagent
  ├→ CodeValidatorSubagent
  └→ CodeEnhancerSubagent
```

**Benefits:**
- Simpler flow (no parsing, no dynamic agent creation)
- Better error handling (coordinator can retry)
- Clearer separation (data vs coding domains)
- Easier to test (pure subagents)
- More maintainable prompts

## Next Steps: Prompts

We've built the structure. Now you need to refine the prompts for:

### 1. Coordinator System Prompt
Currently in `CoordinatorFactory.ts`:
```typescript
systemPrompt: `You are the Data Domain Coordinator...`
```

**Tune this to:**
- Better decision logic
- Domain-specific reasoning
- When to call which subagent
- Completion criteria

### 2. Subagent Prompts
Currently in `CoordinatorFactory.ts` for each subagent:
```typescript
promptTemplate: `You are a Schema Analyzer...`
```

**Tune these to:**
- More specific task instructions
- Better output formatting
- Domain knowledge
- Error handling

### 3. Decision Prompt
Currently in `DataDomainCoordinator.makeDecision()`:
```typescript
const decisionPrompt = `${contextSummary}
Available Subagents: ...
Decide next action...`;
```

**Tune this to:**
- Better context representation
- Clearer action options
- Examples of good decisions

## Testing

Run the example:
```bash
npm run build
node dist/anthropic-architecture/examples/dataDomainExample.js
```

This will:
1. Create the coordinator with subagents
2. Execute a data analysis request
3. Show decision flow
4. Display execution trace

## Future: Coding Domain Coordinator

Next, implement `CodingDomainCoordinator` with subagents:
- `D3CodeGeneratorSubagent` - Generate D3.js code
- `CodeValidatorSubagent` - Validate syntax/semantics
- `CodeEnhancerSubagent` - Apply SVG analysis feedback
- `CodeTestRunnerSubagent` - Test in browser via Playwright MCP

Then connect:
```
DataDomainCoordinator → CodingDomainCoordinator
```

## Summary

You now have:
✅ Complete Anthropic architecture implementation for data domain
✅ 1 coordinator + 4 subagents
✅ Type-safe interfaces
✅ Factory for easy instantiation
✅ Working example
✅ Comprehensive documentation

**Next:** Refine prompts and test with real data flows!
