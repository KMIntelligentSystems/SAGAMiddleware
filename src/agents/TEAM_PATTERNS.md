# Agent Team Patterns

Advanced multi-agent coordination patterns for the Claude Agent SDK.

## Overview

The SDK doesn't provide a built-in `Team` class, but you can build sophisticated team coordination patterns using `AgentDefinition`, `Options`, and the `query()` function. This module provides 5 proven patterns.

## 5 Team Patterns

### 1. 🔄 Parallel Execution

Multiple agents work simultaneously on different or the same task.

**Use when:**
- You need multiple perspectives on the same problem
- Independent analyses that can run in parallel
- You want to maximize speed (all agents run at once)

**Example:**
```typescript
import { ParallelTeam } from './agents/teamOrchestrator.js';

const team = new ParallelTeam([
  { name: 'security', role: 'Security analyst', definition: securityAgent },
  { name: 'performance', role: 'Performance expert', definition: perfAgent }
]);

// All agents analyze simultaneously
const results = await team.analyzeFromMultiplePerspectives(
  'Analyze src/workflows/sagaWorkflow.ts'
);
```

**Output:** Array of results from each agent

---

### 2. 🗳️ Consensus Voting

Multiple agents vote on the best option.

**Use when:**
- You need to choose between multiple options
- Decision requires multiple expert perspectives
- You want democratic decision-making

**Example:**
```typescript
import { ConsensusTeam } from './agents/teamOrchestrator.js';

const team = new ConsensusTeam([
  { name: 'architect', role: 'System architect', definition: archAgent },
  { name: 'devops', role: 'DevOps engineer', definition: devopsAgent },
  { name: 'developer', role: 'Senior developer', definition: devAgent }
]);

const result = await team.vote(
  'How should we implement caching?',
  ['Redis', 'In-memory', 'SQLite', 'No caching'],
  'Consider: performance, complexity, cost'
);

console.log('Winner:', result.winner);
console.log('Votes:', result.votes);
```

**Output:** Winner, vote counts, and analysis

---

### 3. 👥 Hierarchical Delegation

Main coordinator delegates to specialized sub-agents.

**Use when:**
- Complex workflow requiring coordination
- Clear task breakdown with specialized agents
- Sequential or conditional delegation needed

**Example:**
```typescript
import { HierarchicalTeam } from './agents/teamOrchestrator.js';

const subAgents = {
  'loader': dataLoaderAgent,
  'transformer': transformerAgent,
  'analyzer': analyzerAgent
};

const team = new HierarchicalTeam(
  'You are the main coordinator...',
  subAgents
);

const result = await team.execute(
  'Process data/file.csv: load, clean, analyze'
);
```

**Output:** Final coordinated result

---

### 4. 📋 Blackboard (Shared Context)

Agents sequentially contribute to shared knowledge.

**Use when:**
- Building complex artifacts (designs, plans, reports)
- Each agent builds on previous work
- Collaborative knowledge construction

**Example:**
```typescript
import { BlackboardTeam } from './agents/teamOrchestrator.js';

const team = new BlackboardTeam([
  { name: 'requirements', role: 'Requirements analyst', definition: reqAgent },
  { name: 'architect', role: 'System architect', definition: archAgent },
  { name: 'planner', role: 'Implementation planner', definition: planAgent }
]);

const blackboard = await team.executeWithSharedContext(
  'Design a new feature: conditional workflow branching'
);

// Each agent's contribution is available
console.log(blackboard['requirements'].contribution);
console.log(blackboard['architect'].contribution);
console.log(blackboard['planner'].contribution);
```

**Output:** Shared knowledge map with all contributions

---

### 5. 💭 Debate Team

Structured debate: advocate → critic → synthesizer.

**Use when:**
- Exploring pros and cons of an idea
- Need balanced analysis of trade-offs
- Making important architectural decisions

**Example:**
```typescript
import { DebateTeam } from './agents/teamOrchestrator.js';

const team = new DebateTeam(
  advocateAgent,
  criticAgent,
  synthesizerAgent
);

const result = await team.debate(
  'Should we adopt microservices architecture?',
  2  // 2 rounds of back-and-forth
);

// Result includes advocate's position, critic's response, and synthesis
console.log(result);
```

**Output:** Full debate transcript with synthesis

---

## Quick Start

### Install and Run

```bash
# Quick demo (uses Haiku, fast and cheap)
npx ts-node --esm src/examples/quickTeamExample.ts

# Full examples (all 5 patterns)
npx ts-node --esm src/examples/teamPatternsExample.ts
```

### Basic Usage

```typescript
import { ParallelTeam, type TeamMember } from './agents/teamOrchestrator.js';

// 1. Define team members
const team: TeamMember[] = [
  {
    name: 'agent-1',
    role: 'Specialist in X',
    definition: {
      description: 'What this agent does',
      tools: ['Read', 'Grep'],
      model: 'sonnet',
      prompt: 'You are an expert in X...'
    }
  }
];

// 2. Create team
const parallelTeam = new ParallelTeam(team);

// 3. Execute
const results = await parallelTeam.analyzeFromMultiplePerspectives('Task');
```

## Pattern Selection Guide

| Pattern | Speed | Use Case | Coordination |
|---------|-------|----------|--------------|
| **Parallel** | ⚡⚡⚡ | Multiple perspectives | None (concurrent) |
| **Consensus** | ⚡⚡ | Decision making | Voting |
| **Hierarchical** | ⚡ | Complex workflows | Main coordinator |
| **Blackboard** | ⚡ | Collaborative design | Sequential building |
| **Debate** | ⚡ | Pros/cons analysis | Structured argument |

## Cost Considerations

- **Parallel**: Highest throughput, but N agents = N API calls
- **Consensus**: N votes + 1 synthesis
- **Hierarchical**: Depends on delegation depth
- **Blackboard**: N sequential calls
- **Debate**: rounds × 2 + 1 synthesis

**Tip:** Use `model: 'haiku'` for cost-effective experimentation!

## Integration with Your Existing Code

### Option 1: Extend BaseSDKAgent

```typescript
import { BaseSDKAgent } from './baseSDKAgent.js';
import { ParallelTeam } from './teamOrchestrator.js';

export class MultiPerspectiveAnalyzer extends BaseSDKAgent {
  async execute(input: { filePath: string }): Promise<AgentResult> {
    const team = new ParallelTeam(/* ... */);
    const results = await team.analyzeFromMultiplePerspectives(
      `Analyze ${input.filePath}`
    );

    return {
      success: true,
      data: results,
      agentName: this.agentName
    };
  }
}
```

### Option 2: Use in SAGA Workflows

```typescript
// In your SAGA workflow
const teamNode = {
  type: 'team-analysis',
  execute: async (context) => {
    const team = new ConsensusTeam(/* ... */);
    const decision = await team.vote(/* ... */);
    return decision.winner;
  }
};
```

### Option 3: Standalone Orchestration

```typescript
// Direct usage
const result = await new DebateTeam(/* ... */).debate(/* ... */);
```

## Advanced: Custom Patterns

Build your own patterns by combining primitives:

```typescript
class CustomTeam {
  async execute() {
    // Your coordination logic
    const results = await Promise.all([
      query({ prompt: p1, options }),
      query({ prompt: p2, options })
    ]);

    // Custom synthesis
    return this.synthesize(results);
  }
}
```

## Troubleshooting

**Problem:** Agents don't have tools they need
**Solution:** Add tools to `AgentDefinition`:
```typescript
definition: {
  tools: ['Read', 'Grep', 'execute_python'],
  // ...
}
```

**Problem:** Too slow / expensive
**Solution:**
- Use `model: 'haiku'` for faster/cheaper runs
- Reduce `maxTurns` in options
- Run smaller teams

**Problem:** Agents not coordinating well
**Solution:** Improve prompts with explicit coordination instructions

## Examples Index

| File | What It Shows |
|------|---------------|
| `quickTeamExample.ts` | Simple ready-to-run debate |
| `teamPatternsExample.ts` | All 5 patterns in action |
| `csvFilteringMainSubagent.ts` | Hierarchical (your existing code) |

## Next Steps

1. ✅ Run `quickTeamExample.ts` to see it in action
2. ✅ Explore `teamPatternsExample.ts` for all patterns
3. ✅ Pick a pattern that fits your use case
4. ✅ Integrate into your SAGA workflows

## API Reference

See inline documentation in `teamOrchestrator.ts` for full API details.

---

**Key Insight:** There's no magic "Team" class in the SDK, but these patterns give you everything you need to build sophisticated multi-agent systems. Pick the right pattern for your use case!
