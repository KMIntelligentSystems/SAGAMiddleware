# Data Domain Coordinator Flow Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER QUERY                               │
│  "Analyze supply.csv and create D3.js visualization data"       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
      ┌──────────────────────────────────────────────────┐
      │      CoordinatorFactory.createDataDomain()       │
      │  Creates coordinator + registers 4 subagents     │
      └────────────────────┬─────────────────────────────┘
                           │
                           ▼
      ┌──────────────────────────────────────────────────┐
      │        DataDomainCoordinator.execute()           │
      │                                                   │
      │  Contextful State:                               │
      │  - userQuery                                     │
      │  - workingMemory                                 │
      │  - discoveredSchema (builds up)                  │
      │  - dataAnalysis (accumulates)                    │
      │  - executedTasks (history)                       │
      │  - taskResults (map)                             │
      └────────────────────┬─────────────────────────────┘
                           │
                 ┌─────────┴──────────┐
                 │   Decision Loop    │
                 │  (max 10 iterations)│
                 └─────────┬──────────┘
                           │
      ┌────────────────────┴────────────────────┐
      │                                         │
      ▼                                         ▼
┌──────────┐                            ┌──────────┐
│makeDecision()│                        │ITERATION │
│             │◄───────────────────────│  COUNT   │
│ Calls LLM   │                        │          │
└──────┬──────┘                        └──────────┘
       │
       │ Returns decision JSON
       │
       ▼
┌────────────────────────────────────────┐
│  Decision Action Types:                │
│  1. call_subagent                      │
│  2. synthesize                         │
│  3. complete                           │
│  4. pass_to_coordinator                │
└────────┬───────────────────────────────┘
         │
         ▼
    ┌────┴─────┐
    │ ACTION?  │
    └┬─┬─┬─┬───┘
     │ │ │ │
     │ │ │ └──────────────────────┐
     │ │ │                        │
     │ │ └──────────────────┐     │
     │ │                    │     │
     │ └────────────┐       │     │
     │              │       │     │
     ▼              ▼       ▼     ▼

call_subagent   synthesize  complete  pass_to_coordinator
     │              │         │              │
     │              │         │              │
     ▼              │         │              │
┌────────────┐     │         │              │
│ Execute    │     │         │              │
│ Subagent   │     │         │              │
│ Task       │     │         │              │
└─────┬──────┘     │         │              │
      │            │         │              │
      ▼            │         │              │
┌────────────┐     │         │              │
│ 4 Subagents│     │         │              │
└─────┬──────┘     │         │              │
      │            │         │              │
      ├────────────────────────────────────┼────────┐
      │            │         │              │        │
      ▼            ▼         │              │        │
┌─────────────────────┐     │              │        │
│ Schema Analyzer     │     │              │        │
│ - Read CSV          │     │              │        │
│ - Sample data       │     │              │        │
│ - Call LLM          │     │              │        │
│ - Infer types       │     │              │        │
│ Returns:            │     │              │        │
│ SchemaAnalysisResult│     │              │        │
└─────────────────────┘     │              │        │
      │            │         │              │        │
      ▼            ▼         │              │        │
┌─────────────────────┐     │              │        │
│ Data Transformer    │     │              │        │
│ - Generate Python   │     │              │        │
│ - Call MCP execute  │     │              │        │
│ - Save output       │     │              │        │
│ Returns:            │     │              │        │
│ TransformationResult│     │              │        │
└─────────────────────┘     │              │        │
      │            │         │              │        │
      ▼            ▼         │              │        │
┌─────────────────────┐     │              │        │
│ Data Validator      │     │              │        │
│ - Check columns     │     │              │        │
│ - Validate types    │     │              │        │
│ - Check ranges      │     │              │        │
│ Returns:            │     │              │        │
│ ValidationResult    │     │              │        │
└─────────────────────┘     │              │        │
      │            │         │              │        │
      ▼            ▼         │              │        │
┌─────────────────────┐     │              │        │
│ Data Summarizer     │     │              │        │
│ - Read in chunks    │     │              │        │
│ - Summarize each    │     │              │        │
│ - Synthesize all    │     │              │        │
│ Returns:            │     │              │        │
│ SummarizationResult │     │              │        │
└─────────────────────┘     │              │        │
      │            │         │              │        │
      └────────────┴─────────┘              │        │
      │                                     │        │
      ▼                                     │        │
┌──────────────────┐                       │        │
│ Store result in  │                       │        │
│ coordinator      │                       │        │
│ context          │                       │        │
└────────┬─────────┘                       │        │
         │                                 │        │
         └─────────► NEXT ITERATION        │        │
                                           │        │
                    ┌──────────────────────┘        │
                    │                               │
                    ▼                               ▼
         ┌─────────────────────┐     ┌──────────────────────┐
         │ synthesizeResults() │     │ generateFinalResp()  │
         │                     │     │                      │
         │ - Collect all       │     │ - Package results    │
         │   subagent results  │     │ - Create handoff     │
         │ - Call LLM to       │     │   data for coding    │
         │   synthesize        │     │   coordinator        │
         │ - Store in context  │     │                      │
         └──────────┬──────────┘     └───────────┬──────────┘
                    │                            │
                    └────────────┬───────────────┘
                                 │
                                 ▼
                    ┌──────────────────────┐
                    │ CoordinatorResponse  │
                    │                      │
                    │ success: true        │
                    │ result: {...}        │
                    │ handoffData:         │
                    │   target: coding     │
                    │   payload: {...}     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Pass to Coding       │
                    │ Domain Coordinator   │
                    └──────────────────────┘
```

## Detailed Decision Flow

```
┌─────────────────────────────────────────────────────────┐
│               makeDecision() Internal Flow              │
└─────────────────────────────────────────────────────────┘

  Step 1: Build Context Summary
  ┌─────────────────────────────────┐
  │ - User query                    │
  │ - Executed tasks (count)        │
  │ - Discovered schema (if any)    │
  │ - Data analysis (if any)        │
  │ - Iteration count               │
  └────────────┬────────────────────┘
               │
               ▼
  Step 2: List Available Subagents
  ┌─────────────────────────────────┐
  │ - schema_analyzer               │
  │ - data_transformer              │
  │ - data_validator                │
  │ - data_summarizer               │
  └────────────┬────────────────────┘
               │
               ▼
  Step 3: Call Coordinator LLM
  ┌─────────────────────────────────────────────────┐
  │ Prompt:                                         │
  │ "Based on context and user query, decide:      │
  │  - call_subagent (which one?)                  │
  │  - synthesize (combine results)                │
  │  - complete (task done)                        │
  │  - pass_to_coordinator (handoff to coding)"    │
  │                                                 │
  │ Response format: JSON                           │
  └────────────┬────────────────────────────────────┘
               │
               ▼
  Step 4: Parse LLM Response
  ┌─────────────────────────────────┐
  │ {                               │
  │   "action": "call_subagent",    │
  │   "reasoning": "Need schema",   │
  │   "subagentType": "schema_...", │
  │   "taskDescription": "...",     │
  │   "taskInput": {...}            │
  │ }                               │
  └────────────┬────────────────────┘
               │
               ▼
  Step 5: Create SubagentTask
  ┌─────────────────────────────────┐
  │ {                               │
  │   taskId: "task_123_schema",    │
  │   taskType: "schema_analyzer",  │
  │   description: "...",           │
  │   input: {...}                  │
  │ }                               │
  └────────────┬────────────────────┘
               │
               ▼
  Step 6: Return CoordinatorDecision
  ┌─────────────────────────────────┐
  │ {                               │
  │   action: "call_subagent",      │
  │   reasoning: "...",             │
  │   taskToExecute: {...}          │
  │ }                               │
  └─────────────────────────────────┘
```

## Subagent Execution Flow

```
┌──────────────────────────────────────────────────────┐
│          executeSubagentTask() Flow                  │
└──────────────────────────────────────────────────────┘

  Input: SubagentTask
  ┌─────────────────────────────────┐
  │ taskId: "task_123"              │
  │ taskType: "schema_analyzer"     │
  │ description: "Analyze CSV..."   │
  │ input: { filePath: "..." }      │
  └────────────┬────────────────────┘
               │
               ▼
  Get Subagent by Type
  ┌─────────────────────────────────┐
  │ subagent = subagents.get(       │
  │   task.taskType                 │
  │ )                               │
  └────────────┬────────────────────┘
               │
               ▼
  Execute Subagent Task
  ┌─────────────────────────────────┐
  │ result = await                  │
  │   subagent.executeTask(task)    │
  └────────────┬────────────────────┘
               │
               ▼
  Subagent Internal Flow
  ┌────────────────────────────────────────────┐
  │ 1. Extract input from task                 │
  │ 2. Validate input                          │
  │ 3. Read file / prepare data                │
  │ 4. Call LLM (if needed)                    │
  │ 5. Execute tools (if needed, e.g., MCP)    │
  │ 6. Format result                           │
  │ 7. Return SubagentResult                   │
  └────────────┬─────────────────────────────────┘
               │
               ▼
  SubagentResult
  ┌─────────────────────────────────┐
  │ taskId: "task_123"              │
  │ success: true                   │
  │ result: { schema analysis }     │
  │ executionTime: 2345             │
  └────────────┬────────────────────┘
               │
               ▼
  Store in Coordinator Context
  ┌─────────────────────────────────┐
  │ context.taskResults.set(        │
  │   taskId, result                │
  │ )                               │
  │ context.executedTasks.push(task)│
  │ context.discoveredSchema = ...  │
  └────────────┬────────────────────┘
               │
               ▼
  Return to Main Loop
  (next iteration)
```

## Context Evolution Example

```
ITERATION 1:
┌─────────────────────────────────┐
│ Context:                        │
│ - userQuery: "Analyze CSV..."   │
│ - executedTasks: []             │
│ - taskResults: {}               │
│ - discoveredSchema: undefined   │
│ - dataAnalysis: undefined       │
└─────────────────────────────────┘
         │ Call schema_analyzer
         ▼
ITERATION 2:
┌─────────────────────────────────┐
│ Context:                        │
│ - userQuery: "Analyze CSV..."   │
│ - executedTasks: [              │
│     {taskId: "task_1",          │
│      taskType: "schema_..."}    │
│   ]                             │
│ - taskResults: {                │
│     "task_1": {                 │
│       columns: [...],           │
│       rowCount: 10000           │
│     }                           │
│   }                             │
│ - discoveredSchema: {...}       │ ← UPDATED
│ - dataAnalysis: undefined       │
└─────────────────────────────────┘
         │ Call data_transformer
         ▼
ITERATION 3:
┌─────────────────────────────────┐
│ Context:                        │
│ - userQuery: "Analyze CSV..."   │
│ - executedTasks: [              │
│     schema_analyzer,            │
│     data_transformer            │
│   ]                             │
│ - taskResults: {                │
│     "task_1": schema,           │
│     "task_2": transformation    │ ← NEW
│   }                             │
│ - discoveredSchema: {...}       │
│ - transformationResults: [...]  │ ← UPDATED
│ - dataAnalysis: undefined       │
└─────────────────────────────────┘
         │ Continue...
         ▼
FINAL ITERATION:
┌─────────────────────────────────┐
│ Context:                        │
│ - userQuery: "Analyze CSV..."   │
│ - executedTasks: [4 tasks]      │
│ - taskResults: {4 results}      │
│ - discoveredSchema: {...}       │
│ - transformationResults: [...]  │
│ - validationResults: [...]      │
│ - dataAnalysis: {               │ ← COMPLETE
│     summary: {...},             │
│     synthesis: "..."            │
│   }                             │
└─────────────────────────────────┘
         │
         ▼ pass_to_coordinator
```

## Key Differences from Old System

```
OLD SYSTEM:                          NEW SYSTEM:
┌──────────────────┐                ┌──────────────────┐
│ ConversationAgent│                │ DataDomain       │
│   (pass-through) │                │ Coordinator      │
└────────┬─────────┘                │ (contextful)     │
         │                          └────────┬─────────┘
         ▼                                   │
┌──────────────────┐                        ├─► Schema Analyzer
│ TransactionGroup │                        │   (stateless)
│ Agent            │                        │
│ Creates [AGENT]  │                        ├─► Data Transformer
│   tags           │                        │   (stateless)
└────────┬─────────┘                        │
         │                                  ├─► Data Validator
         ▼                                  │   (stateless)
┌──────────────────┐                        │
│ ValidatingAgent  │                        └─► Data Summarizer
│ (checks tags)    │                            (stateless)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ DefineGeneric    │
│ AgentsProcess    │
│ (parses tags)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ ExecuteGeneric   │
│ AgentsProcess    │
└──────────────────┘

ISSUES:                              BENEFITS:
- Complex parsing                    - No parsing needed
- Dynamic agent creation             - Static, type-safe
- Distributed context                - Centralized context
- Validation loops                   - Integrated validation
- Hard to debug                      - Clear decision trace
```
