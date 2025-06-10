import { createServer } from 'http';
import { EventMessage, ServiceRegistration } from './types.js';

// Conditional import - will be resolved at install time
let SocketIOServer: any;
try {
  // @ts-ignore - conditional import
  const socketIO = require('socket.io');
  SocketIOServer = socketIO.Server;
} catch (error) {
  console.error('⚠️  socket.io not installed. Run: npm install socket.io');
  console.error('   This is only needed for event bus testing');
  process.exit(1);
}

/**
 * Simple event bus server for local testing
 * This simulates a distributed event bus for SAGA coordination
 */
export class TestEventBusServer {
  private httpServer: any;
  private io: any;
  private connectedServices: Map<string, ServiceRegistration> = new Map();
  private eventHistory: EventMessage[] = [];
  private port: number;

  constructor(port: number = 3003) {
    this.port = port;
    this.httpServer = createServer();
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
  }

  /**
   * Start the event bus server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log(`🚀 Event Bus Server started on port ${this.port}`);
          console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}`);
          resolve();
        }
      });
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: any) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle service registration
      socket.on('register_service', (registration: ServiceRegistration) => {
        this.connectedServices.set(socket.id, registration);
        console.log(`📝 Service registered: ${registration.serviceName} (${registration.serviceType})`);
        console.log(`🛠️  Capabilities: ${registration.capabilities?.join(', ') || 'none'}`);
        
        // Broadcast service registration
        socket.broadcast.emit('service_registered', {
          socketId: socket.id,
          registration
        });
      });

      // Handle event publishing
      socket.on('publish_event', (message: EventMessage) => {
        console.log(`📤 Event published: ${message.type} from ${message.source}`);
        console.log(`🎯 Target: ${message.target || 'broadcast'}`);
        
        // Store event in history
        this.eventHistory.push({
          ...message,
          timestamp: new Date()
        });

        // Route event to appropriate recipients
        this.routeEvent(socket, message);
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        const service = this.connectedServices.get(socket.id);
        if (service) {
          console.log(`🔌 Service disconnected: ${service.serviceName} (${reason})`);
          this.connectedServices.delete(socket.id);
        } else {
          console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
        }
      });

      // Handle event bus queries
      socket.on('get_connected_services', () => {
        const services = Array.from(this.connectedServices.values());
        socket.emit('connected_services', services);
      });

      socket.on('get_event_history', (query: { limit?: number; type?: string }) => {
        let events = this.eventHistory;
        
        if (query.type) {
          events = events.filter(event => event.type === query.type);
        }
        
        if (query.limit) {
          events = events.slice(-query.limit);
        }
        
        socket.emit('event_history', events);
      });
    });
  }

  /**
   * Route event to appropriate recipients
   */
  private routeEvent(senderSocket: any, message: EventMessage): void {
    if (message.target === 'broadcast') {
      // Broadcast to all connected clients except sender
      senderSocket.broadcast.emit('event_received', message);
      console.log(`📡 Broadcasted to ${this.io.sockets.sockets.size - 1} clients`);
    } else if (message.target) {
      // Send to specific service type
      const targetServices = Array.from(this.connectedServices.entries())
        .filter(([_, service]) => service.serviceType === message.target);
      
      targetServices.forEach(([socketId, service]) => {
        const targetSocket = this.io.sockets.sockets.get(socketId);
        if (targetSocket) {
          targetSocket.emit('event_received', message);
          console.log(`📬 Delivered to ${service.serviceName}`);
        }
      });
    } else {
      // No specific target, broadcast to all
      senderSocket.broadcast.emit('event_received', message);
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    connectedServices: number;
    totalEvents: number;
    uptime: number;
    services: ServiceRegistration[];
  } {
    return {
      connectedServices: this.connectedServices.size,
      totalEvents: this.eventHistory.length,
      uptime: process.uptime(),
      services: Array.from(this.connectedServices.values())
    };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    console.log('🧹 Event history cleared');
  }

  /**
   * Stop the event bus server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        this.httpServer.close(() => {
          console.log('🔄 Event Bus Server stopped');
          resolve();
        });
      });
    });
  }
}

/**
 * Create and start event bus server for testing
 */
export async function startTestEventBusServer(port: number = 3003): Promise<TestEventBusServer> {
  const server = new TestEventBusServer(port);
  await server.start();
  
  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\\n🔄 Shutting down Event Bus Server...');
    await server.stop();
    process.exit(0);
  });

  // Display stats every 30 seconds
  setInterval(() => {
    const stats = server.getStats();
    if (stats.connectedServices > 0 || stats.totalEvents > 0) {
      console.log(`\n📊 Event Bus Stats:`);
      console.log(`   Connected Services: ${stats.connectedServices}`);
      console.log(`   Total Events: ${stats.totalEvents}`);
      console.log(`   Uptime: ${Math.round(stats.uptime)}s`);
      if (stats.services.length > 0) {
        console.log(`   Services: ${stats.services.map(s => s.serviceName).join(', ')}`);
      }
    }
  }, 30000);

  return server;
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('🚀 Starting Test Event Bus Server...');
  console.log('Press Ctrl+C to stop');
  
  startTestEventBusServer()
    .then(() => {
      console.log('✅ Event Bus Server ready for SAGA workflows');
      console.log('💡 Use "npm run hybrid" to test with event bus integration');
    })
    .catch((error) => {
      console.error('❌ Failed to start Event Bus Server:', error);
      process.exit(1);
    });
}