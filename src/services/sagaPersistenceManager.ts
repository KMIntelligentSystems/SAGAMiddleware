import { EventEmitter } from 'events';
import {
  HumanInLoopSAGAState,
  SAGACheckpoint,
  HumanInLoopConfig
} from '../types/humanInLoopSaga.js';

export class SAGAPersistenceManager extends EventEmitter {
  private transactionStates: Map<string, HumanInLoopSAGAState> = new Map();
  private checkpoints: Map<string, SAGACheckpoint[]> = new Map();
  private config: HumanInLoopConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: HumanInLoopConfig) {
    super();
    this.config = config;
    this.startCleanupScheduler();
  }

  /**
   * Save complete transaction state
   */
  async saveTransactionState(
    transactionId: string,
    state: HumanInLoopSAGAState
  ): Promise<void> {
    try {
      // Add persistence metadata
      const persistableState: HumanInLoopSAGAState = {
        ...state,
        lastCheckpoint: new Date(),
        persistenceKey: this.generatePersistenceKey(transactionId)
      };

      // Store in memory (in production, this would go to database/Redis)
      this.transactionStates.set(transactionId, persistableState);

      // Emit event for external persistence systems
      this.emit('state_saved', {
        transactionId,
        persistenceKey: persistableState.persistenceKey,
        timestamp: new Date(),
        stateSize: JSON.stringify(persistableState).length
      });

      console.log(`💾 Saved transaction state: ${transactionId}`);
      console.log(`📊 State size: ${JSON.stringify(persistableState).length} bytes`);

    } catch (error) {
      console.error(`❌ Failed to save transaction state ${transactionId}:`, error);
      throw new Error(`Persistence failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load transaction state from persistence
   */
  async loadTransactionState(transactionId: string): Promise<HumanInLoopSAGAState | null> {
    try {
      const state = this.transactionStates.get(transactionId);
      
      if (!state) {
        console.log(`📂 No saved state found for transaction: ${transactionId}`);
        return null;
      }

      // Emit event for monitoring
      this.emit('state_loaded', {
        transactionId,
        persistenceKey: state.persistenceKey,
        lastCheckpoint: state.lastCheckpoint,
        timestamp: new Date()
      });

      console.log(`📂 Loaded transaction state: ${transactionId}`);
      console.log(`⏰ Last checkpoint: ${state.lastCheckpoint.toISOString()}`);

      return state;

    } catch (error) {
      console.error(`❌ Failed to load transaction state ${transactionId}:`, error);
      return null;
    }
  }

  /**
   * Create a checkpoint for a specific service within a transaction
   */
  async createCheckpoint(
    transactionId: string,
    serviceId: string,
    state: any,
    canResume: boolean = true
  ): Promise<SAGACheckpoint> {
    const checkpoint: SAGACheckpoint = {
      serviceId,
      transactionId,
      state,
      timestamp: new Date(),
      canResume,
      version: this.generateCheckpointVersion()
    };

    // Store checkpoint
    const existingCheckpoints = this.checkpoints.get(transactionId) || [];
    existingCheckpoints.push(checkpoint);
    this.checkpoints.set(transactionId, existingCheckpoints);

    // Update main transaction state with new checkpoint
    const transactionState = this.transactionStates.get(transactionId);
    if (transactionState) {
      transactionState.checkpoints.push(checkpoint);
      transactionState.lastCheckpoint = new Date();
      await this.saveTransactionState(transactionId, transactionState);
    }

    // Emit checkpoint event
    this.emit('checkpoint_created', {
      transactionId,
      serviceId,
      checkpointVersion: checkpoint.version,
      canResume,
      timestamp: checkpoint.timestamp
    });

    console.log(`📍 Created checkpoint for ${serviceId} in transaction ${transactionId}`);
    console.log(`🔄 Can resume: ${canResume}`);

    return checkpoint;
  }

  /**
   * Get all checkpoints for a transaction
   */
  async getCheckpoints(transactionId: string): Promise<SAGACheckpoint[]> {
    return this.checkpoints.get(transactionId) || [];
  }

  /**
   * Get the latest checkpoint for a specific service
   */
  async getLatestCheckpoint(
    transactionId: string,
    serviceId: string
  ): Promise<SAGACheckpoint | null> {
    const checkpoints = await this.getCheckpoints(transactionId);
    const serviceCheckpoints = checkpoints
      .filter(cp => cp.serviceId === serviceId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return serviceCheckpoints.length > 0 ? serviceCheckpoints[0] : null;
  }

  /**
   * Schedule expiration for a transaction
   */
  async scheduleExpiration(transactionId: string, expiresAt: Date): Promise<void> {
    const now = new Date();
    const timeToExpiration = expiresAt.getTime() - now.getTime();

    if (timeToExpiration <= 0) {
      // Already expired
      await this.expireTransaction(transactionId, 'Already expired');
      return;
    }

    // Schedule expiration
    setTimeout(async () => {
      await this.expireTransaction(transactionId, 'Scheduled expiration');
    }, timeToExpiration);

    // Update transaction state
    const state = this.transactionStates.get(transactionId);
    if (state) {
      state.timeoutScheduled = expiresAt;
      await this.saveTransactionState(transactionId, state);
    }

    console.log(`⏰ Scheduled expiration for transaction ${transactionId} at ${expiresAt.toISOString()}`);
  }

  /**
   * Expire a transaction
   */
  private async expireTransaction(transactionId: string, reason: string): Promise<void> {
    const state = this.transactionStates.get(transactionId);
    if (!state) return;

    // Update state to expired
    state.status = 'timeout';
    state.endTime = new Date();
    state.errors.push(`Transaction expired: ${reason}`);

    await this.saveTransactionState(transactionId, state);

    // Emit expiration event
    this.emit('transaction_expired', {
      transactionId,
      reason,
      expiredAt: new Date(),
      duration: state.endTime.getTime() - state.startTime.getTime()
    });

    console.log(`⏰ Transaction expired: ${transactionId} - ${reason}`);
  }

  /**
   * Clean up expired transactions
   */
  async cleanupExpiredTransactions(): Promise<void> {
    const now = new Date();
    const retentionMs = this.config.persistence.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - retentionMs);

    const expiredTransactions: string[] = [];

    for (const [transactionId, state] of this.transactionStates.entries()) {
      // Clean up transactions older than retention period
      if (state.lastCheckpoint < cutoffTime) {
        expiredTransactions.push(transactionId);
        continue;
      }

      // Clean up failed/completed transactions after shorter period
      if (['completed', 'failed', 'timeout', 'compensated'].includes(state.status)) {
        const completionTime = state.endTime || state.lastCheckpoint;
        const shortRetentionMs = 7 * 24 * 60 * 60 * 1000; // 7 days for completed
        if (completionTime < new Date(now.getTime() - shortRetentionMs)) {
          expiredTransactions.push(transactionId);
        }
      }
    }

    // Archive and remove expired transactions
    for (const transactionId of expiredTransactions) {
      await this.archiveTransaction(transactionId);
      this.transactionStates.delete(transactionId);
      this.checkpoints.delete(transactionId);
    }

    if (expiredTransactions.length > 0) {
      this.emit('transactions_cleaned', {
        cleanedCount: expiredTransactions.length,
        cleanedTransactions: expiredTransactions,
        cleanupTime: new Date()
      });

      console.log(`🧹 Cleaned up ${expiredTransactions.length} expired transactions`);
    }
  }

  /**
   * Archive a transaction before cleanup
   */
  private async archiveTransaction(transactionId: string): Promise<void> {
    const state = this.transactionStates.get(transactionId);
    const checkpoints = this.checkpoints.get(transactionId);

    if (!state) return;

    // In production, this would save to long-term storage
    const archiveData = {
      transactionId,
      state,
      checkpoints,
      archivedAt: new Date()
    };

    this.emit('transaction_archived', archiveData);
    console.log(`📦 Archived transaction: ${transactionId}`);
  }

  /**
   * Get statistics about persisted transactions
   */
  getStats(): {
    totalTransactions: number;
    activeTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
    totalCheckpoints: number;
    oldestTransaction?: Date;
    newestTransaction?: Date;
  } {
    const states = Array.from(this.transactionStates.values());
    const checkpointCount = Array.from(this.checkpoints.values())
      .reduce((total, checkpoints) => total + checkpoints.length, 0);

    const timestamps = states.map(s => s.startTime);
    
    return {
      totalTransactions: states.length,
      activeTransactions: states.filter(s => 
        !['completed', 'failed', 'timeout', 'compensated'].includes(s.status)).length,
      completedTransactions: states.filter(s => s.status === 'completed').length,
      failedTransactions: states.filter(s => 
        ['failed', 'timeout', 'compensated'].includes(s.status)).length,
      totalCheckpoints: checkpointCount,
      oldestTransaction: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      newestTransaction: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined
    };
  }

  /**
   * Generate persistence key for transaction
   */
  private generatePersistenceKey(transactionId: string): string {
    const timestamp = Date.now();
    return `saga_${transactionId}_${timestamp}`;
  }

  /**
   * Generate checkpoint version
   */
  private generateCheckpointVersion(): string {
    return `v${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredTransactions();
    }, 60 * 60 * 1000);

    console.log('🕐 Started persistence cleanup scheduler (every hour)');
  }

  /**
   * Shutdown persistence manager
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Save all pending states before shutdown
    const savePromises = Array.from(this.transactionStates.entries()).map(
      ([transactionId, state]) => this.saveTransactionState(transactionId, state)
    );

    await Promise.all(savePromises);

    this.emit('persistence_shutdown', {
      savedTransactions: this.transactionStates.size,
      shutdownTime: new Date()
    });

    console.log('🔄 SAGA Persistence Manager shutdown complete');
  }
}