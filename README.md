# SAGA Middleware for AI Agent Orchestration

A robust TypeScript middleware for orchestrating AI agents using the SAGA pattern with built-in MCP (Model Context Protocol) support for enhanced agent capabilities.

## Features

- **SAGA Pattern Implementation**: Ensures transactional consistency across multiple AI agent operations
- **Multi-Provider LLM Support**: Works with OpenAI, Anthropic, DeepSeek, and Ollama
- **MCP Integration**: Seamless integration with Model Context Protocol servers for extended agent capabilities
- **Dependency Management**: Automatic dependency resolution and execution ordering
- **Transaction Management**: Built-in rollback capabilities for failed operations
- **Context Sharing**: Sophisticated context management between agents
- **Validation Framework**: Comprehensive output validation and schema checking
- **Event-Driven Architecture**: Real-time event emission for monitoring and debugging

## Installation

```bash
npm install
```

## Quick Start

### Basic SAGA Workflow

```typescript
import { createSagaMiddleware, createAgentDefinition } from './src/index.js';

// Create SAGA coordinator
const saga = createSagaMiddleware();

// Define agents
const dataAnalyzerAgent = createAgentDefinition({
  name: 'data_analyzer',
  task: 'Analyze the provided data and extract insights',
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  expectedOutput: {
    insights: 'string[]',
    confidence: 'number'
  }
});

const reportGeneratorAgent = createAgentDefinition({
  name: 'report_generator',
  task: 'Generate a report based on analysis results',
  provider: 'anthropic',
  model: 'claude-3-7-sonnet-20250219',
  apiKey: process.env.ANTHROPIC_API_KEY,
  dependencies: [
    { agentName: 'data_analyzer', required: true }
  ],
  expectedOutput: {
    report: 'string',
    sections: 'object[]'
  }
});

// Register agents
saga.registerAgent(dataAnalyzerAgent);
saga.registerAgent(reportGeneratorAgent);

// Execute workflow
const results = await saga.executeWorkflow({
  inputData: 'Your data here'
});
```

### Enhanced SAGA with MCP Support

```typescript
import { 
  createEnhancedSagaMiddleware, 
  createAgentDefinition,
  createMCPServerConfig 
} from './src/index.js';

// Configure MCP servers
const filesystemServer = createMCPServerConfig({
  name: 'filesystem',
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
  transport: 'stdio'
});

// Create enhanced SAGA with auto-connect MCP servers
const saga = createEnhancedSagaMiddleware({
  autoConnectMCPServers: [filesystemServer]
});

// Create MCP-enabled agent
const fileProcessorAgent = createAgentDefinition({
  name: 'file_processor',
  task: 'Process files using MCP filesystem tools',
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  mcpServers: [filesystemServer],
  mcpTools: ['read_file', 'write_file', 'list_directory'],
  expectedOutput: {
    filesProcessed: 'number',
    results: 'object[]'
  }
});

saga.registerAgent(fileProcessorAgent);
const results = await saga.executeWorkflow();
```

## Core Components

### SagaCoordinator

The main orchestrator that manages agent execution, dependencies, and transactions.

**Key Methods:**
- `registerAgent(definition)`: Register an agent definition
- `executeWorkflow(context, correlationId)`: Execute the complete workflow
- `executeAgent(agentName, context, correlationId)`: Execute a specific agent

### Agent System

#### Generic Agent
Handles LLM interactions with support for multiple providers and MCP tool calling.

#### Agent Definition
Defines agent configuration including:
- LLM provider and model settings
- Task description and expected output
- Dependencies on other agents
- MCP server and tool configurations

### MCP Integration

The middleware provides comprehensive MCP support:

#### MCP Server Configuration
```typescript
const serverConfig = createMCPServerConfig({
  name: 'my-server',
  command: 'node',
  args: ['./mcp-server.js'],
  transport: 'stdio',
  timeout: 30000
});
```

#### MCP Client Manager
- **Connection Management**: Connect/disconnect from MCP servers
- **Tool Discovery**: List available tools across servers
- **Resource Access**: Access MCP resources
- **Tool Execution**: Execute MCP tools with proper error handling

### Sublayers

#### Context Manager
- Manages agent contexts and shared data
- Supports MCP context sharing between agents
- Provides dependency data resolution

#### Validation Manager
- Schema-based output validation
- Custom validation rules
- Comprehensive error reporting

#### Transaction Manager
- SAGA pattern implementation
- Compensable operations
- Automatic rollback on failure

## Advanced Usage

### Custom MCP Tool Integration

Agents can call MCP tools directly in their responses:

```typescript
const mcpAgent = createAgentDefinition({
  name: 'file_analyzer',
  task: `Analyze files using MCP tools. Use tool calls like:
  {"mcpToolCall": {"name": "read_file", "arguments": {"path": "./data.txt"}}}`,
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  mcpServers: [filesystemServer]
});
```

### Event Monitoring

```typescript
saga.on('saga_event', (event) => {
  console.log(`[${event.type}] ${event.agentName || 'workflow'}: ${event.id}`);
  if (event.data) {
    console.log('Data:', JSON.stringify(event.data, null, 2));
  }
});
```

### Transaction Management

```typescript
// Transactions are automatically managed, but you can access the manager
const transactionManager = saga.getTransactionManager();

// Add compensable operations
await transactionManager.addOperation('my-agent', {
  id: 'operation-1',
  execute: async () => { /* operation logic */ },
  compensate: async () => { /* rollback logic */ }
});
```

## Project Structure

```
src/
├── index.ts                     # Main exports and factory functions
├── coordinator/
│   └── sagaCoordinator.ts      # SAGA pattern orchestrator
├── agents/
│   └── genericAgent.ts         # Multi-provider LLM agent
├── mcp/
│   └── mcpClient.ts           # MCP client implementation
├── sublayers/
│   ├── contextManager.ts      # Context and dependency management
│   ├── validationManager.ts   # Output validation framework
│   └── transactionManager.ts  # Transaction and compensation logic
├── types/
│   └── index.ts               # TypeScript interfaces
└── examples/
    ├── usage.ts               # Basic usage examples
    └── mcpUsage.ts           # MCP integration examples
```

## Configuration

### Environment Variables

```bash
# LLM Provider API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: DeepSeek API
DEEPSEEK_API_KEY=your_deepseek_key

# Optional: Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
```

### MCP Server Setup

The middleware supports any MCP-compatible server. Common examples:

```bash
# Filesystem server
npx @modelcontextprotocol/server-filesystem /path/to/directory

# Custom server
node ./your-mcp-server.js
```

## Examples

### Run Basic Example
```bash
npm start
```

### Run MCP Integration Example
```bash
node ./src/examples/mcpUsage.js
```

### Build Project
```bash
npm run build
```

## API Reference

### Factory Functions

- `createSagaMiddleware()`: Create basic SAGA coordinator
- `createEnhancedSagaMiddleware(options)`: Create MCP-enabled coordinator
- `createAgentDefinition(config)`: Create agent definition
- `createMCPServerConfig(config)`: Create MCP server configuration

### MCP Functions

- `connectToMCPServer(config)`: Connect to MCP server
- `disconnectFromMCPServer(name)`: Disconnect from server
- `listMCPTools(serverName?)`: List available tools
- `listMCPResources(serverName?)`: List available resources

## Error Handling

The middleware provides comprehensive error handling:

- **Connection Errors**: MCP server connection failures
- **Validation Errors**: Agent output validation failures
- **Dependency Errors**: Missing required dependencies
- **Transaction Errors**: Automatic rollback on failures

## Performance Considerations

- **Concurrent Execution**: Agents with no dependencies execute in parallel
- **Context Optimization**: Efficient context sharing between agents
- **MCP Connection Pooling**: Reuse of MCP server connections
- **Memory Management**: Automatic cleanup of completed transactions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the examples in `src/examples/`
- Review the type definitions in `src/types/`
- File issues on the project repository