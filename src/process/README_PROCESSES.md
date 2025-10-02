# Process Templates Architecture

## Overview

Process templates are lightweight, reusable classes that execute specific workflow patterns. They are instantiated and executed by `SagaCoordinator` based on a control flow list.

## Implemented Processes

### 1. DefineGenericAgentsProcess
**Purpose**: Execute a default agent to create agent definitions

**Parameters**:
- `agent`: GenericAgent - The defining agent (e.g., TransactionGroupingAgent)
- `contextManager`: ContextManager - Stores results
- `userQuery`: string - User request with [AGENT:...] sections

**Flow**:
```
1. Parse userQuery → Extract [AGENT: agentName, id]...[/AGENT]
2. agent.deleteContext()
3. agent.receiveContext({'YOUR TASK': extractedTask})
4. result = await agent.execute({})
5. contextManager.updateContext(agentName, {lastTransactionResult: result})
```

**Creates**: Singleton or multiple agent definitions

---

### 2. ValidationProcess
**Purpose**: Validate target agent's output using ValidatingAgent

**Parameters**:
- `validatingAgent`: GenericAgent - The validator
- `targetAgent`: GenericAgent - Agent whose output to validate
- `contextManager`: ContextManager
- `userQuery`: string - Original user request

**Flow**:
```
1. Get targetAgent's lastTransactionResult from contextManager
2. Parse userQuery → Extract target agent's original task
3. validatingAgent.deleteContext()
4. validatingAgent.receiveContext({'USER REQUEST': originalTask})
5. validatingAgent.receiveContext({'VALIDATE': targetOutput})
6. result = await validatingAgent.execute({})
7. contextManager.updateContext(targetAgent.name, {validationResult: result})
```

**Returns**: `AgentResult` with `success: boolean` indicating validation pass/fail

**Note**: Retry logic handled by SagaCoordinator

---

### 3. FlowProcess
**Purpose**: Extract flow diagram and tool users from agent definitions

**Parameters**:
- `flowDefiningAgent`: GenericAgent - Agent that defines flow
- `targetAgent`: GenericAgent - Agent whose output contains definitions
- `contextManager`: ContextManager

**Flow**:
```
1. Get targetAgent's lastTransactionResult (agent definitions)
2. flowDefiningAgent.deleteContext()
3. flowDefiningAgent.receiveContext({'EXTRACT FLOW AND TOOL CALLS': definitions})
4. result = await flowDefiningAgent.execute({})
5. contextManager.updateContext(flowDefiningAgent.name, {lastTransactionResult: result})
```

**Extracts**:
- Flow diagram: `<flow>A1 -> A2 -> A3</flow>`
- Tool users: `{"toolUsers": ["Agent1", "Agent2"]}`

---

### 4. AgentGeneratorProcess
**Purpose**: Create TransactionSet from agent definitions using AgentParser

**Parameters**:
- `flowDefiningAgent`: GenericAgent - Agent that defined flow
- `targetAgent`: GenericAgent - Agent that defined agents
- `contextManager`: ContextManager
- `coordinator`: SagaCoordinator

**Flow**:
```
1. Get agentDefinitions from targetAgent context
2. Get flowData from flowDefiningAgent context
3. transactionSet = AgentParser.parseAndCreateAgents(
     agentDefinitions,
     flowData,
     coordinator
   )
4. Return transactionSet
```

**Returns**: `TransactionSet` with created agents registered

**Handles**: Singletons and multi-agent sets

---

### 5. D3JSCodingProcess
**Purpose**: Generate D3.js visualization code

**Parameters**:
- `agent`: GenericAgent - D3JSCodingAgent
- `contextManager`: ContextManager
- `userQuery`: string

**Flow**:
```
1. Parse userQuery → Extract D3JSCodingAgent task
2. agent.deleteContext()
3. agent.receiveContext({'YOUR TASK': extractedTask})
4. result = await agent.execute({})
5. contextManager.updateContext(agent.name, {lastTransactionResult: result})
```

**Note**: Data analysis summary should be in agent context before execution

---

## Pending Implementation

### 6. DataAnalysisProcess
**Purpose**: Analyze CSV data in chunks using self-referencing execution

**Complexity**: High - Involves CSV reading, iteration, and global storage

### 7. DataSummarizingProcess
**Purpose**: Summarize all chunk analysis results into a concise report

**Complexity**: Medium - Aggregates results from global storage

---

## Usage Pattern in SagaCoordinator

```typescript
// Control flow list
const controlFlow = [
  { agent: 'TransactionGroupingAgent', process: 'DefineGenericAgentsProcess' },
  { agent: 'ValidatingAgent', process: 'ValidationProcess' },
  { agent: 'TransactionGroupingAgent', process: 'FlowProcess' },
  { agent: 'TransactionGroupingAgent', process: 'AgentGeneratorProcess' }
];

// Execute
for (const item of controlFlow) {
  const agent = this.agents.get(item.agent);

  switch (item.process) {
    case 'DefineGenericAgentsProcess':
      const defineProcess = new DefineGenericAgentsProcess(
        agent,
        this.contextManager,
        request.userQuery
      );
      await defineProcess.execute();
      this.currAgent = agent;
      break;

    case 'ValidationProcess':
      const validationProcess = new ValidationProcess(
        validatingAgent,
        this.currAgent,
        this.contextManager,
        request.userQuery
      );
      const validationResult = await validationProcess.execute();
      if (!validationResult.success) {
        // Handle retry logic
      }
      break;

    // ... other cases
  }
}
```

---

## State Tracking in SagaCoordinator

```typescript
private currAgent: GenericAgent | null;
private currTransactionSet: TransactionSet | null;
private currToolCallTransactionSet: TransactionSet | null;
```

Updated by process execution to maintain workflow state.

---

## Notes

1. **parseConversationResultForAgent** is duplicated in each process - could be moved to a utility class
2. **AgentParser** needs update to handle singleton agents
3. **Validation retry logic** to be designed in SagaCoordinator
4. **DataAnalysisProcess** and **DataSummarizingProcess** need detailed implementation based on existing sagaCoordinator code
