import { Transaction, CompensableOperation } from '../types';

export class TransactionManager {
  private transactions: Map<string, Transaction> = new Map();
  private activeTransactions: Set<string> = new Set();

  async startTransaction(agentName: string): Promise<string> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction: Transaction = {
      id: transactionId,
      agentName,
      operations: [],
      status: 'pending'
    };

    this.transactions.set(transactionId, transaction);
    this.activeTransactions.add(transactionId);
    
    return transactionId;
  }

  addOperation(transactionId: string, operation: CompensableOperation): boolean {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.status !== 'pending') {
      return false;
    }

    transaction.operations.push(operation);
    return true;
  }

  async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.status !== 'pending') {
      return false;
    }

    try {
      for (const operation of transaction.operations) {
        await operation.execute();
      }
      
      transaction.status = 'committed';
      this.activeTransactions.delete(transactionId);
      return true;
    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  async rollbackTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return false;
    }

    try {
      const executedOperations = transaction.operations.slice().reverse();
      for (const operation of executedOperations) {
        try {
          await operation.compensate();
        } catch (compensationError) {
          console.error(`Compensation failed for operation ${operation.id}:`, compensationError);
        }
      }
      
      transaction.status = 'rolled_back';
      this.activeTransactions.delete(transactionId);
      return true;
    } catch (error) {
      console.error(`Rollback failed for transaction ${transactionId}:`, error);
      return false;
    }
  }

  async rollbackAllActive(): Promise<void> {
    const activeIds = Array.from(this.activeTransactions);
    await Promise.all(activeIds.map(id => this.rollbackTransaction(id)));
  }

  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId);
  }

  getActiveTransactions(): string[] {
    return Array.from(this.activeTransactions);
  }
}