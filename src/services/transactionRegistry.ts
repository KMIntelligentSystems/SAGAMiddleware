import { EventEmitter } from 'events';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';

export interface TransactionRegistryConfig {
  eventBusUrl: string;
  defaultTransactionSet?: string;
}


export interface Transaction {
  id: string;
  name: string;
  agentName: string;
  dependencies: string[];
  compensationAgent?: string;
  compensationAction?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensated';
}

export interface TransactionSetDefinition{
  name: string;
  description: string;
  transactions: Transaction[]
}

export interface TransactionSetPayload {
    transactionSetDefinition: TransactionSetDefinition;
    timestamp: string;
  }

export interface TransactionOrderingRequest {
  transactionSetName: string;
  transactionIds: string[];
  dependencies?: { [transactionId: string]: string[] };
  requestId?: string;
  correlationId?: string;
}

export class TransactionRegistry extends EventEmitter {
  private transactionSets: Map<string, TransactionSetDefinition> = new Map();
  private eventBusClient: SAGAEventBusClient;
  private activeTransactionSet: string | null = null;

  constructor(config: TransactionRegistryConfig) {
    super();
    this.eventBusClient = new SAGAEventBusClient(config.eventBusUrl);
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing TransactionRegistry...');
    
    // Wait for event bus connection
    let attempts = 0;
    while (!this.eventBusClient.isEventBusConnected() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!this.eventBusClient.isEventBusConnected()) {
      throw new Error('Failed to connect to Event Bus after 30 seconds');
    }
    
    console.log('✅ TransactionRegistry initialized and connected to Event Bus');
  }

  private setupEventListeners(): void {
    const socket = this.eventBusClient['socket'];
    
    socket.on('event_received', async (message: any) => {
      switch (message.type) {
        case 'register_transaction_set':
          await this.handleTransactionSetRegistration(message.data);
          break;
        case 'update_transaction_ordering':
       //   await this.handleTransactionOrderingUpdate(message.data);
          break;
        case 'set_active_transaction_set':
       //   await this.handleSetActiveTransactionSet(message.data);
          break;
        case 'get_transaction_registry_status':
      //    await this.handleGetRegistryStatus(message);
          break;
      }
    });
    
    console.log('🎧 TransactionRegistry listening for event bus messages...');
  }

  private async handleTransactionSetRegistration(data: TransactionSetPayload): Promise<void> {
    try {
      const transactionSet = data.transactionSetDefinition;
      // Validate the extracted data
      if (!transactionSet.name || !transactionSet.transactions) {
        throw new Error('Invalid transaction set: name and transactions array are required');
      }

       console.log(`📝 Registering transaction set: ${ transactionSet.name}`);
      
      // Validate transaction set structure
      this.validateTransactionSet( transactionSet);
      
      // Register the transaction set
      this.transactionSets.set( transactionSet.name, {
        ... transactionSet
      });
      
      console.log(`✅ Transaction set registered: ${ transactionSet.name} with ${ transactionSet.transactions.length} transactions`);
      
      // Emit success event
      this.eventBusClient['publishEvent']('transaction_set_registered', {
        transactionSetName:  transactionSet.name,
        transactionCount:  transactionSet.transactions.length,
        success: true,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('transaction_set_registered',  transactionSet.name);
      
    } catch (error) {
      const transactionSet = data.transactionSetDefinition;
      console.error(`❌ Failed to register transaction set: ${transactionSet.name}`, error);
      
      this.eventBusClient['publishEvent']('transaction_set_registration_failed', {
        transactionSetName:  transactionSet.name,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      }, 'broadcast');
    }
  }

   private validateTransactionSet(transactionSet: TransactionSetDefinition): void {
    if (!transactionSet.name || !transactionSet.transactions || !Array.isArray(transactionSet.transactions)) {
      throw new Error('Invalid transaction set: name and transactions array are required');
    }
    
    // Validate each transaction has required fields
    for (const transaction of transactionSet.transactions) {
      if (!transaction.id || !transaction.name || !transaction.agentName) {
        throw new Error(`Invalid transaction: ${JSON.stringify(transaction)} - id, name, and agentName are required`);
      }
    }
    
    // Validate dependencies exist within the transaction set
    const transactionIds = new Set(transactionSet.transactions.map(t => t.id));
    for (const transaction of transactionSet.transactions) {
      for (const depId of transaction.dependencies) {
        if (!transactionIds.has(depId)) {
          throw new Error(`Transaction ${transaction.id} has invalid dependency: ${depId}`);
        }
      }
    }
  }

 /* private async handleTransactionOrderingUpdate(data: TransactionOrderingRequest): Promise<void> {
    try {
      console.log(`🔄 Updating transaction ordering for: ${data.transactionSetName}`);
      
      const transactionSet = this.transactionSets.get(data.transactionSetName);
      if (!transactionSet) {
        throw new Error(`Transaction set not found: ${data.transactionSetName}`);
      }
      
      // Update transaction ordering and dependencies
      this.updateTransactionOrdering(transactionSet, data);
      
      console.log(`✅ Transaction ordering updated for: ${data.transactionSetName}`);
      
      this.eventBusClient['publishEvent']('transaction_ordering_updated', {
        transactionSetName: data.transactionSetName,
        newOrdering: data.transactionIds,
        success: true,
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('transaction_ordering_updated', data.transactionSetName);
      
    } catch (error) {
      console.error(`❌ Failed to update transaction ordering for: ${data.transactionSetName}`, error);
      
      this.eventBusClient['publishEvent']('transaction_ordering_update_failed', {
        transactionSetName: data.transactionSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private async handleSetActiveTransactionSet(data: { transactionSetName: string, correlationId?: string }): Promise<void> {
    try {
      console.log(`🎯 Setting active transaction set: ${data.transactionSetName}`);
      
      if (!this.transactionSets.has(data.transactionSetName)) {
        throw new Error(`Transaction set not found: ${data.transactionSetName}`);
      }
      
      this.activeTransactionSet = data.transactionSetName;
      
      console.log(`✅ Active transaction set set to: ${data.transactionSetName}`);
      
      this.eventBusClient['publishEvent']('active_transaction_set_changed', {
        transactionSetName: data.transactionSetName,
        success: true,
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('active_transaction_set_changed', data.transactionSetName);
      
    } catch (error) {
      console.error(`❌ Failed to set active transaction set: ${data.transactionSetName}`, error);
      
      this.eventBusClient['publishEvent']('active_transaction_set_change_failed', {
        transactionSetName: data.transactionSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private async handleGetRegistryStatus(message: any): Promise<void> {
    const status = {
      totalTransactionSets: this.transactionSets.size,
      activeTransactionSet: this.activeTransactionSet,
      transactionSets: Array.from(this.transactionSets.entries()).map(([name, set]) => ({
        name,
        transactionCount: set.transactions.length,
        description: set.description,
        version: set.metadata?.version,
        created: set.metadata?.created
      })),
      correlationId: message.correlationId,
      timestamp: new Date()
    };
    
    this.eventBusClient['publishEvent']('transaction_registry_status', status, 'broadcast');
  }*/


  /*private updateTransactionOrdering(
    transactionSet: TransactionSetDefinition, 
    orderingRequest: TransactionOrderingRequest
  ): void {
    // Create a map of current transactions for quick lookup
    const transactionMap = new Map(transactionSet.transactions.map(t => [t.id, t]));
    
    // Reorder transactions based on the provided ordering
    const reorderedTransactions: [] = [];
    
    for (const transactionId of orderingRequest.transactionIds) {
      const transaction = transactionMap.get(transactionId);
      if (!transaction) {
        throw new Error(`Transaction not found in set: ${transactionId}`);
      }
      
      // Update dependencies if provided
      if (orderingRequest.dependencies && orderingRequest.dependencies[transactionId]) {
        transaction.dependencies = orderingRequest.dependencies[transactionId];
      }
      
      reorderedTransactions.push(transaction);
    }
    
    // Ensure all transactions are included
    if (reorderedTransactions.length !== transactionSet.transactions.length) {
      throw new Error('Transaction ordering must include all transactions in the set');
    }
    
    // Update the transaction set
    transactionSet.transactions = reorderedTransactions;
  }*/

  // Public API methods for sagaWorkflow to use

  public registerDefaultTransactionSet(transactionSet: TransactionSetDefinition): void {
    this.validateTransactionSet(transactionSet);
    this.transactionSets.set(transactionSet.name, transactionSet);
    console.log(`📝 Local registration: ${transactionSet.name} with ${transactionSet.transactions.length} transactions`);
    this.emit('transaction_set_registered', transactionSet.name);
  }

  public getTransactionSet(name: string): TransactionSetDefinition | undefined {
    return this.transactionSets.get(name);
  }
//Set up to return  this.activeTransactionSet = name = 'visulaization' see setActiveTransactionSet
  public getActiveTransactionSet(): TransactionSetDefinition | undefined {
    if (!this.activeTransactionSet) {
      return undefined;
    }
    return this.transactionSets.get(this.activeTransactionSet);
  }

  public getTransactionOrdering(transactionSetName: string): Transaction[] {
    const transactionSet = this.transactionSets.get(transactionSetName);
    if (!transactionSet) {
      throw new Error(`Transaction set not found: ${transactionSetName}`);
    }
    return [...transactionSet.transactions]; // Return a copy
  }

  public getAllTransactionSets(): string[] {
    return Array.from(this.transactionSets.keys());
  }
//Set from registerDefaultTransactionSet() not event listener
  public setActiveTransactionSet(name: string): void {
    if (!this.transactionSets.has(name)) {
      throw new Error(`Transaction set not found: ${name}`);
    }
    this.activeTransactionSet = name;
    this.emit('active_transaction_set_changed', name);
  }

  public getTransactionById(transactionSetName: string, transactionId: string): Transaction | undefined {
    const transactionSet = this.transactionSets.get(transactionSetName);
    if (!transactionSet) {
      return undefined;
    }
    return transactionSet.transactions.find(t => t.id === transactionId);
  }

}