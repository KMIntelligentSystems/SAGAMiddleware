# Auto-Validating Team Pattern

## Pattern: Hierarchical team with built-in validator sub-agent

Instead of one agent doing everything, create a **coordinator** that automatically delegates to a **validator** before finalizing results.

---

## Architecture

```
Main Coordinator Agent
├─ Step 1: Data Processor Sub-Agent (does the work)
├─ Step 2: Validator Sub-Agent (checks the work)
└─ Step 3: If validation fails → Re-run processor with fixes
```

The coordinator **always calls the validator** - it's not optional.

---

## Implementation (Claude Code Task Tool Way)

### Prompt for Main Coordinator:

```markdown
You are the Main Coordinator for wage interval processing.

You have access to TWO sub-agents:
1. **data-processor**: Processes wage data and calculates intervals
2. **data-validator**: Validates results against domain constraints

**Your Workflow (MANDATORY ORDER):**

### Phase 1: Initial Processing
Delegate to 'data-processor' sub-agent with this task:
"Process wage interval data from:
- c:/repos/sagaMiddleware/OES Interval 2005.CSV
- c:/repos/sagaMiddleware/national_may2005_dl.CSV

Calculate employee counts per interval.
Save results to: data/wage_intervals_employee_counts.csv"

Wait for processor to complete.

### Phase 2: MANDATORY Validation
Delegate to 'data-validator' sub-agent with this task:
"Validate the wage interval results:
- Check file: data/wage_intervals_employee_counts.csv
- Reference total: 130,307,840 employees (from 'All Occupations')
- US workforce 2005: ~140M

Validation checks:
1. Total should be ≤ 130M (allow 10% variance)
2. Total must be < 140M (US workforce)
3. No single interval > 130M
4. Flag if any interval has >60% of total

Return: PASS or FAIL with specific errors"

Wait for validator to complete.

### Phase 3: Decision Point

**If validation PASSES:**
- Print "✅ Validation passed!"
- Return the results to user
- DONE

**If validation FAILS:**
- Print "❌ Validation failed"
- Analyze validator's error report
- Identify root cause (likely: double-counting aggregates)
- Re-delegate to 'data-processor' with EXPLICIT FIX:
  "Previous run failed validation due to: [error]

   FIX: Filter out aggregate rows by excluding codes ending in -0000

   Re-process with corrected filtering."
- After re-processing, MUST re-validate (go back to Phase 2)
- Maximum 3 attempts

### Phase 4: Final Report
Summarize:
- Processing status (success/failure)
- Validation status
- Total employees found
- Number of intervals with data
- Any warnings or notes
```

---

## Sub-Agent Definitions

### Sub-Agent 1: Data Processor

```typescript
const dataProcessor: AgentDefinition = {
  description: 'Processes wage data and calculates interval distributions',
  tools: ['Read', 'execute_python'],
  model: 'sonnet',
  prompt: `You are a data processing specialist.

Your task: Process wage interval data.

INPUT FILES:
- Wage intervals: c:/repos/sagaMiddleware/OES Interval 2005.CSV
- BLS data: c:/repos/sagaMiddleware/national_may2005_dl.CSV

PROCESSING STEPS:
1. Read both CSV files
2. Extract: tot_emp, occ_title, h_mean from BLS data
3. Match h_mean to wage intervals
4. Sum employees per interval
5. Save output CSV

IMPORTANT: If coordinator specifies a FIX (e.g., "filter out aggregates"),
apply that fix in your processing logic.

OUTPUT: Save results to specified file path.`
};
```

### Sub-Agent 2: Data Validator

```typescript
const dataValidator: AgentDefinition = {
  description: 'Validates data processing results against constraints',
  tools: ['Read', 'execute_python'],
  model: 'sonnet',
  prompt: `You are a data quality validator specializing in workforce statistics.

Your task: Validate wage interval results.

VALIDATION CONSTRAINTS:
- US workforce 2005: ~140 million
- BLS "All Occupations" total: 130,307,840

CHECKS TO PERFORM:
1. Read the results file
2. Calculate total employees across all intervals
3. Check: total ≤ 130,307,840 (allow 10% variance for data quality issues)
4. Check: total < 140,000,000 (must not exceed US workforce)
5. Check: no single interval > 130,307,840
6. Check: distribution looks reasonable (no interval >60% of total)

OUTPUT FORMAT:
Status: [PASS/FAIL]
Total Employees: [number]
Issues Found: [list any problems]
Likely Cause: [if failed, diagnose why]
Recommended Fix: [if failed, suggest solution]

Be specific about what's wrong and how to fix it.`
};
```

---

## Example Team Setup (Claude Code SDK)

```typescript
import { HierarchicalTeam } from './agents/teamOrchestrator.js';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// Define sub-agents
const subAgents: Record<string, AgentDefinition> = {
  'data-processor': {
    description: 'Processes wage interval data',
    tools: ['Read', 'execute_python'],
    model: 'sonnet',
    prompt: `[Data processor prompt from above]`
  },
  'data-validator': {
    description: 'Validates results against domain constraints',
    tools: ['Read', 'execute_python'],
    model: 'sonnet',
    prompt: `[Data validator prompt from above]`
  }
};

// Coordinator prompt
const coordinatorPrompt = `[Coordinator prompt from above]`;

// Create team
const team = new HierarchicalTeam(
  coordinatorPrompt,
  subAgents,
  { maxTurns: 30 } // Allow retries
);

// Execute
const result = await team.execute(
  'Process wage interval data with validation'
);
```

---

## Claude Code Task Tool Way

When spawning the coordinator, pass it this structure:

```javascript
Task({
  subagent_type: 'general-purpose',
  description: 'Process wage data with validation',
  prompt: `[Use the coordinator prompt above]

Available sub-agents (use Task tool to delegate):
- data-processor: Processes the wage data
- data-validator: Validates the results

You MUST delegate to validator after processor completes.
If validation fails, re-run processor with fixes.`
});
```

The coordinator will then spawn its own sub-agents via nested Task calls.

---

## Benefits vs Single Agent with Validation

| Aspect | Single Agent + Validation | Auto-Validating Team |
|--------|---------------------------|----------------------|
| **Separation of concerns** | ❌ All in one prompt | ✅ Clear roles |
| **Reusability** | ❌ Prompt is specific | ✅ Validator reusable |
| **Complexity** | ✅ Simpler (1 agent) | ❌ More complex (3 agents) |
| **Reliability** | ⚠️ Agent might skip validation | ✅ Coordinator enforces it |
| **Cost** | ✅ Lower (fewer API calls) | ❌ Higher (multiple agents) |
| **Debugging** | ❌ Harder to isolate issues | ✅ Clear separation |
| **Validation thoroughness** | ⚠️ Depends on agent diligence | ✅ Dedicated validator |

---

## When to Use Each Pattern

### Use **Single Agent + Validation Steps** when:
- ✅ Task is straightforward
- ✅ Cost/speed is priority
- ✅ Validation is simple (1-2 checks)
- ✅ Agent prompt can stay focused

### Use **Auto-Validating Team** when:
- ✅ Validation is complex (many checks)
- ✅ Validator will be reused across tasks
- ✅ Critical that validation never gets skipped
- ✅ Multiple retry/fix cycles expected
- ✅ You want separation of concerns

---

## Hybrid Approach: Validator as a Checkpoint

For the original wage task, structure it like this:

```
Main Task Agent
├─ Sub-task 1: Read and explore data
├─ Sub-task 2: Process intervals
├─ CHECKPOINT: Delegate to validator
│   └─ If FAIL → analyze and retry
└─ Sub-task 3: Format and save final output
```

This gives you single-agent simplicity with multi-agent reliability.
