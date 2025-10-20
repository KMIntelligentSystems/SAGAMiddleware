# Examples Directory

## Agent Workflow Examples

### 1. Direct Agentic Approach

**csvFilteringMainSubagent.ts** - Direct agent coordination with Claude SDK
- Uses Sonnet 4 for everything
- Good for prototyping
- Cost: ~$0.40 per run
- Two-step workflow: normalize + aggregate

```bash
npm run build
node dist/examples/csvFilteringMainSubagent.js
```

### 2. Generated Structures Approach ⭐ RECOMMENDED

**agentStructureGenerator.ts** + **executeGeneratedWorkflow.ts**
- Uses Sonnet 4 for planning (once)
- Uses gpt-4o-mini for execution (cheap)
- Cost: $0.30 + $0.05 per run
- 60-80% cost savings for repeated workflows

#### Step 1: Generate Agent Structures
```bash
npm run build
node dist/examples/agentStructureGenerator.js
```

Creates: `generated_workflows/energy_data_processing.json`

#### Step 2: Execute Workflow
```bash
node dist/examples/executeGeneratedWorkflow.js
```

Uses: Cheap gpt-4o-mini model with MCP tools

## Cost Comparison

| Approach | First Run | 10 Runs | Best For |
|----------|-----------|---------|----------|
| Direct Agentic | $0.40 | $4.00 | Prototyping |
| Generated Structures | $0.35 | $0.80 | Production |

**Savings**: $3.20 (80%) for 10 runs

## Documentation

See [AGENT_STRUCTURE_GENERATION.md](../../docs/AGENT_STRUCTURE_GENERATION.md) for detailed guide.

See [APPROACH_COMPARISON.md](../../docs/APPROACH_COMPARISON.md) for comparison.

## Quick Start

### For Development/Prototyping
```bash
# Use direct agentic approach
node dist/examples/csvFilteringMainSubagent.js
```

### For Production
```bash
# 1. Generate structures (once)
node dist/examples/agentStructureGenerator.js

# 2. Execute (many times)
node dist/examples/executeGeneratedWorkflow.js
```

## Files

- **csvFilteringMainSubagent.ts** - Direct agentic workflow
- **agentStructureGenerator.ts** - Generate agent structures with Sonnet 4
- **executeGeneratedWorkflow.ts** - Execute with cheap models
- **generated_workflows/** - Saved agent structures (JSON)

## Prerequisites

Set environment variables:
```bash
# For structure generation
export ANTHROPIC_API_KEY=your-key

# For execution
export OPENAI_API_KEY=your-key

# Or both
export ANTHROPIC_API_KEY=your-key
export OPENAI_API_KEY=your-key
```

MCP Server must be running:
- codeGen-mcp-server at `C:/repos/codeGen-mcp-server`
