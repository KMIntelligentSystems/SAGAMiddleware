import { SAGAEventBusClient } from './sagaEventBusClient.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Event Bus configuration
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://127.0.0.1:3003';
const SAGA_SERVICE_NAME = process.env.SAGA_SERVICE_NAME || 'saga-middleware-service';

/**
 * Main entry point for SAGA Middleware Event Bus integration
 */
class SAGAMiddlewareService {
  private eventBusClient: SAGAEventBusClient;
  private isRunning: boolean = false;

  constructor() {
    console.log('🚀 Initializing SAGA Middleware Service...');
    console.log(`📡 Event Bus URL: ${EVENT_BUS_URL}`);
    console.log(`🏷️  Service Name: ${SAGA_SERVICE_NAME}`);
    
    this.eventBusClient = new SAGAEventBusClient(EVENT_BUS_URL);
    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT (Ctrl+C), shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught Exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ SAGA Middleware Service is already running');
      return;
    }

    try {
      console.log('🔄 Starting SAGA Middleware Service...');
      
      // Wait for Event Bus connection
      await this.waitForEventBusConnection();
      
      this.isRunning = true;
      console.log('✅ SAGA Middleware Service started successfully');
      console.log('🎯 Ready to process visualization and chunk processing SAGAs');
      console.log('📊 Available capabilities:');
      console.log('   • Visualization SAGA execution');
      console.log('   • Chunk processing workflows');
      console.log('   • Real-time state updates');
      console.log('   • Error handling and compensation');
      
      // Keep the service running
      this.keepAlive();
      
    } catch (error) {
      console.error('❌ Failed to start SAGA Middleware Service:', error);
      throw error;
    }
  }

  private async waitForEventBusConnection(maxWaitTime: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (this.eventBusClient.isEventBusConnected()) {
          resolve();
        } else if (Date.now() - startTime > maxWaitTime) {
          reject(new Error('Timeout waiting for Event Bus connection'));
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      
      checkConnection();
    });
  }

  private keepAlive(): void {
    // Log periodic status updates
    setInterval(() => {
      if (this.isRunning) {
        const queuedMessages = this.eventBusClient.getQueuedMessageCount();
        const connected = this.eventBusClient.isEventBusConnected();
        
        console.log(`💓 SAGA Service Status: ${connected ? 'Connected' : 'Disconnected'} | Queued: ${queuedMessages} messages`);
      }
    }, 60000); // Every minute

    // Health check endpoint could be added here if needed
    console.log('🔄 Service keep-alive started');
  }

  public async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🔄 Shutting down SAGA Middleware Service...');
    this.isRunning = false;
    
    try {
      await this.eventBusClient.shutdown();
      console.log('✅ SAGA Middleware Service shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  public getEventBusClient(): SAGAEventBusClient {
    return this.eventBusClient;
  }

  public isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// Create and export the service instance
export const sagaMiddlewareService = new SAGAMiddlewareService();

// Auto-start if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  sagaMiddlewareService.start().catch((error) => {
    console.error('💥 Failed to start SAGA Middleware Service:', error);
    process.exit(1);
  });
}

// Export for external use
export { SAGAEventBusClient } from './sagaEventBusClient.js';
export default sagaMiddlewareService;