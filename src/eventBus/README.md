# SAGA Middleware Event Bus Integration

This module provides Event Bus integration for the SAGA Middleware, enabling decoupled communication with React applications using AI SDK and other services.

## Architecture Overview

The SAGAMiddleware connects to a dedicated Event Bus service and communicates via publish/subscribe patterns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │    │   Event Bus      │    │ SAGA Middleware │
│   (Port 3000)   │    │   (Port 3003)    │    │   Event Client  │
│                 │    │                  │    │                 │
│ • AI SDK        │◄──►│ • Message Router │◄──►│ • SagaCoordinator│
│ • useAssistant  │    │ • Event Broker   │    │ • Event Emitter │
│ • threadId      │    │ • Service Registry│    │ • State Updates │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Features

### 🔄 **Bidirectional Communication**
- Receives commands from React app via Event Bus
- Publishes SAGA state updates in real-time
- Maintains threadId correlation throughout workflow

### 📡 **Event-Driven Architecture**
- Pure publish/subscribe pattern
- No direct service dependencies
- Automatic reconnection and message queuing

### 🎯 **SAGA Integration**
- **Visualization SAGA**: Complete workflow execution
- **Chunk Processing**: Large dataset processing
- **State Management**: Real-time progress tracking
- **Error Handling**: Compensation pattern support

## Event Types

### **Incoming Events** (React → SAGA)
- `start_visualization_saga` - Execute visualization workflow
- `get_visualization_state` - Request current SAGA state
- `start_chunk_processing` - Execute chunk processing workflow
- `get_chunk_workflow_state` - Request chunk processing state
- `cancel_workflow` - Cancel ongoing workflow

### **Outgoing Events** (SAGA → React)
- `saga_state_update` - Real-time state changes
- `saga_result` - Workflow completion results
- `saga_error` - Error notifications
- `visualization_state_response` - State query responses
- `chunk_processing_result` - Chunk processing results

## ThreadId Alignment

The critical integration point is threadId flow:

```typescript
// React useAssistant provides threadId
const { threadId } = useAssistant();

// Flows through Event Bus to SAGA
event: {
  threadId: "thread_abc123",
  data: { visualizationRequest: {...} }
}

// Updates requirementsState in SagaCoordinator
requirementsState: {
  threadId: "thread_abc123", // From React
  conversationComplete: false,
  requirementsExtracted: false,
  // ...
}
```

## Usage

### **Start SAGA Middleware Event Bus Client**
```bash
npm run event-bus
```

### **Environment Configuration**
```env
EVENT_BUS_URL=http://localhost:3003
SAGA_SERVICE_NAME=saga-middleware-service
```

### **Event Message Format**
```typescript
interface EventMessage {
  type: string;
  source: 'react-app' | 'express-server' | 'saga-middleware';
  target?: 'react-app' | 'express-server' | 'saga-middleware' | 'broadcast';
  data: any;
  messageId: string;
  timestamp: Date;
  threadId?: string;      // Critical for React integration
  workflowId?: string;
  correlationId?: string;
}
```

## Service Lifecycle

1. **Initialization**: Connect to Event Bus and register service
2. **Event Handling**: Process incoming visualization/chunk requests
3. **State Forwarding**: Broadcast SAGA state changes to subscribers
4. **Graceful Shutdown**: Clean disconnection with notification

## Integration with React

The React app (using AI SDK) communicates with SAGA through Event Bus:

1. **Thread Creation**: React creates OpenAI thread using `useAssistant`
2. **Requirements Gathering**: AI SDK handles conversation flow
3. **SAGA Trigger**: When requirements complete, React sends `start_visualization_saga`
4. **Real-time Updates**: SAGA publishes state updates via `saga_state_update`
5. **Result Delivery**: Final visualization delivered via `saga_result`

## Error Handling

- **Connection Failures**: Automatic reconnection with exponential backoff
- **Message Queuing**: Failed messages queued for retry when connection restored
- **SAGA Errors**: Compensation pattern execution with error broadcasting
- **Graceful Degradation**: Service continues operating with reduced functionality

## Monitoring

The service provides:
- Connection status logging
- Message queue monitoring
- Periodic health checks
- Event processing metrics

## Dependencies

- `socket.io-client` - Event Bus communication
- `SagaCoordinator` - Core SAGA execution logic
- `dotenv` - Environment configuration

This Event Bus integration maintains the SAGA Middleware's independence while enabling seamless React + AI SDK integration through the threadId correlation mechanism.