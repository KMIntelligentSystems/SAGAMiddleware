import { EventEmitter } from 'events';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';

export interface ContextRegistryConfig {
  eventBusUrl: string;
  defaultContextSet?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'csv' | 'database' | 'table' | 'json' | 'api';
  path?: string; // For CSV files
  connectionString?: string; // For databases
  tableName?: string; // For database tables
  metadata?: {
    columns?: string[];
    rowCount?: number;
    lastModified?: Date;
    description?: string;
  };
}

export interface LLMPromptConfig {
  agentName: string;
  agentType: string;
  transactionId: string;
  backstory: string;
  taskDescription: string;
  taskExpectedOutput: string;
  context?: Record<string, any>;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export interface ContextSetDefinition {
  name: string;
  transactionSetName: string; // Links to a transaction set
  description?: string;
  dataSources: DataSource[];
  llmPrompts: LLMPromptConfig[];
  userQuery: string;
}

export interface ContextSetPayload {
 contextSetDefinition: ContextSetDefinition;
 timestamp: string
}

export interface ContextRegistrationRequest {
  contextSetName: string;
  transactionSetName: string;
  dataSources: DataSource[];
  llmPrompts: LLMPromptConfig[];
  globalContext?: Record<string, any>;
  requestId?: string;
  correlationId?: string;
}

export interface ContextUpdateRequest {
  contextSetName: string;
  updates: {
    dataSources?: DataSource[];
    llmPrompts?: LLMPromptConfig[];
    globalContext?: Record<string, any>;
  };
  requestId?: string;
  correlationId?: string;
}

export class ContextRegistry extends EventEmitter {
  private contextSets: Map<string, ContextSetDefinition> = new Map();
  private activeContextSets: Map<string, string> = new Map(); // transactionSetName -> contextSetName
  private eventBusClient: SAGAEventBusClient;

  constructor(config: ContextRegistryConfig) {
    super();
    this.eventBusClient = new SAGAEventBusClient(config.eventBusUrl);
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing ContextRegistry...');
    
    // Wait for event bus connection
    let attempts = 0;
    while (!this.eventBusClient.isEventBusConnected() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!this.eventBusClient.isEventBusConnected()) {
      throw new Error('Failed to connect to Event Bus after 30 seconds');
    }
    
    console.log('✅ ContextRegistry initialized and connected to Event Bus');
  }

  private setupEventListeners(): void {
    const socket = this.eventBusClient['socket'];
    
    socket.on('event_received', async (message: any) => {
      switch (message.type) {
        case 'register_context_set':
          await this.handleContextSetRegistration(message.data);
          break;
        case 'update_context_set':
        //  await this.handleContextSetUpdate(message.data);
          break;
        case 'activate_context_set':
         // await this.handleActivateContextSet(message.data);
          break;
        case 'add_data_sources':
        //  await this.handleAddDataSources(message.data);
          break;
        case 'update_llm_prompts':
       //   await this.handleUpdateLLMPrompts(message.data);
          break;
        case 'get_context_registry_status':
      //    await this.handleGetContextRegistryStatus(message);
          break;
        case 'get_context_for_transaction':
      //    await this.handleGetContextForTransaction(message.data);
          break;
      }
    });
    
    console.log('🎧 ContextRegistry listening for event bus messages...');
  }
/*
  name: string;
  transactionSetName: string; // Links to a transaction set
  description?: string;
  dataSources: DataSource[];
  llmPrompts: LLMPromptConfig[];
  globalContext?: Record<string, any>;
  metadata?: {
    version?: string;
    author?: string;
    created?: Date;
    lastModified?: Date;*/
  private async handleContextSetRegistration(data: ContextSetPayload): Promise<void> {
    try {
       const contextDataSet: ContextSetDefinition = data.contextSetDefinition;
      // Validate the extracted data
      if (!contextDataSet.name || !contextDataSet.llmPrompts) {
        throw new Error('Invalid transaction set: name and transactions array are required');
      }

       console.log(`📝 Registering transaction set: ${ contextDataSet.name}`);
      
      // Validate context set structure
      this.validateContextRegistration(contextDataSet);
      
      // Create context set definition
      const contextSet: ContextSetDefinition = {
        name: contextDataSet.name,
        transactionSetName: contextDataSet.transactionSetName,
        dataSources: contextDataSet.dataSources,
        llmPrompts: contextDataSet.llmPrompts,
        userQuery: ''
      };
      
      // Register the context set
      this.contextSets.set(contextDataSet.name, contextSet);
      
      console.log(`✅ Context set registered: ${contextDataSet.name} with ${contextDataSet.dataSources.length} data sources and ${contextDataSet.llmPrompts.length} LLM prompts`);
      
      // Emit success event
      this.eventBusClient['publishEvent']('context_set_registered', {
        contextSetName: contextDataSet.name,
        transactionSetName: contextDataSet.transactionSetName,
        dataSourceCount: contextDataSet.dataSources.length,
        promptCount: contextDataSet.llmPrompts.length,
        success: true,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('context_set_registered', { contextSetName: contextDataSet.name, transactionSetName: contextDataSet.transactionSetName });
      
    } catch (error) {
      const contextDataSet = data.contextSetDefinition;
      console.error(`❌ Failed to register context set: ${contextDataSet.name}`, error);
      
      this.eventBusClient['publishEvent']('context_set_registration_failed', {
        contextSetName: contextDataSet.name,
        transactionSetName: contextDataSet.transactionSetName,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private validateContextRegistration(data: ContextSetDefinition): void {
    if (!data.name || !data.transactionSetName) {
      throw new Error('Context set name and transaction set name are required');
    }
    
    if (!Array.isArray(data.dataSources) || !Array.isArray(data.llmPrompts)) {
      throw new Error('Data sources and LLM prompts must be arrays');
    }
    
    // Validate data sources
    for (const dataSource of data.dataSources) {
      this.validateDataSource(dataSource);
    }
    
    // Validate LLM prompts
    for (const prompt of data.llmPrompts) {
      this.validateLLMPrompt(prompt);
    }
  }

   private validateDataSource(dataSource: DataSource): void {
    if (!dataSource.id || !dataSource.name || !dataSource.type) {
      throw new Error(`Invalid data source: ${JSON.stringify(dataSource)} - id, name, and type are required`);
    }
    
    if (dataSource.type === 'csv' && !dataSource.path) {
      throw new Error(`CSV data source requires path: ${dataSource.id}`);
    }
    
    if (['database', 'table'].includes(dataSource.type) && !dataSource.connectionString) {
      throw new Error(`Database data source requires connectionString: ${dataSource.id}`);
    }
  }

  private validateLLMPrompt(prompt: LLMPromptConfig): void {
    if (!prompt.agentName || !prompt.transactionId || !prompt.backstory) {
      throw new Error(`Invalid LLM prompt: ${JSON.stringify(prompt)} - agentName, transactionId, and prompt are required`);
    }
  }

  /*private async handleContextSetUpdate(data: ContextUpdateRequest): Promise<void> {
    try {
      console.log(`🔄 Updating context set: ${data.contextSetName}`);
      
      const contextSet = this.contextSets.get(data.contextSetName);
      if (!contextSet) {
        throw new Error(`Context set not found: ${data.contextSetName}`);
      }
      
      // Update context set
      if (data.updates.dataSources) {
        contextSet.dataSources = data.updates.dataSources;
      }
      
      if (data.updates.llmPrompts) {
        contextSet.llmPrompts = data.updates.llmPrompts;
      }
      
      if (data.updates.globalContext) {
        contextSet.globalContext = { ...contextSet.globalContext, ...data.updates.globalContext };
      }
      
      contextSet.metadata = {
        ...contextSet.metadata,
        lastModified: new Date()
      };
      
      console.log(`✅ Context set updated: ${data.contextSetName}`);
      
      this.eventBusClient['publishEvent']('context_set_updated', {
        contextSetName: data.contextSetName,
        success: true,
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('context_set_updated', data.contextSetName);
      
    } catch (error) {
      console.error(`❌ Failed to update context set: ${data.contextSetName}`, error);
      
      this.eventBusClient['publishEvent']('context_set_update_failed', {
        contextSetName: data.contextSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private async handleActivateContextSet(data: { transactionSetName: string, contextSetName: string, correlationId?: string }): Promise<void> {
    try {
      console.log(`🎯 Activating context set: ${data.contextSetName} for transaction set: ${data.transactionSetName}`);
      
      if (!this.contextSets.has(data.contextSetName)) {
        throw new Error(`Context set not found: ${data.contextSetName}`);
      }
      
      this.activeContextSets.set(data.transactionSetName, data.contextSetName);
      
      console.log(`✅ Context set activated: ${data.contextSetName} for transaction set: ${data.transactionSetName}`);
      
      this.eventBusClient['publishEvent']('context_set_activated', {
        transactionSetName: data.transactionSetName,
        contextSetName: data.contextSetName,
        success: true,
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('context_set_activated', { transactionSetName: data.transactionSetName, contextSetName: data.contextSetName });
      
    } catch (error) {
      console.error(`❌ Failed to activate context set: ${data.contextSetName}`, error);
      
      this.eventBusClient['publishEvent']('context_set_activation_failed', {
        transactionSetName: data.transactionSetName,
        contextSetName: data.contextSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private async handleAddDataSources(data: { contextSetName: string, dataSources: DataSource[], correlationId?: string }): Promise<void> {
    try {
      console.log(`📊 Adding ${data.dataSources.length} data sources to context set: ${data.contextSetName}`);
      
      const contextSet = this.contextSets.get(data.contextSetName);
      if (!contextSet) {
        throw new Error(`Context set not found: ${data.contextSetName}`);
      }
      
      // Validate and add data sources
      for (const dataSource of data.dataSources) {
        this.validateDataSource(dataSource);
        
        // Check for duplicates
        const existingIndex = contextSet.dataSources.findIndex(ds => ds.id === dataSource.id);
        if (existingIndex >= 0) {
          contextSet.dataSources[existingIndex] = dataSource; // Update existing
        } else {
          contextSet.dataSources.push(dataSource); // Add new
        }
      }
      
      contextSet.metadata = {
        ...contextSet.metadata,
        lastModified: new Date()
      };
      
      console.log(`✅ Data sources added to context set: ${data.contextSetName}`);
      
      this.eventBusClient['publishEvent']('data_sources_added', {
        contextSetName: data.contextSetName,
        dataSourceCount: data.dataSources.length,
        success: true,
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('data_sources_added', { contextSetName: data.contextSetName, dataSources: data.dataSources });
      
    } catch (error) {
      console.error(`❌ Failed to add data sources to context set: ${data.contextSetName}`, error);
      
      this.eventBusClient['publishEvent']('data_sources_add_failed', {
        contextSetName: data.contextSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private async handleUpdateLLMPrompts(data: { contextSetName: string, llmPrompts: LLMPromptConfig[], correlationId?: string }): Promise<void> {
    try {
      console.log(`🤖 Updating LLM prompts for context set: ${data.contextSetName}`);
      
      const contextSet = this.contextSets.get(data.contextSetName);
      if (!contextSet) {
        throw new Error(`Context set not found: ${data.contextSetName}`);
      }
      
      // Update LLM prompts
      for (const promptConfig of data.llmPrompts) {
        this.validateLLMPrompt(promptConfig);
        
        // Check for existing prompt by agent and transaction
        const existingIndex = contextSet.llmPrompts.findIndex(
          p => p.agentName === promptConfig.agentName && p.transactionId === promptConfig.transactionId
        );
        
        if (existingIndex >= 0) {
          contextSet.llmPrompts[existingIndex] = promptConfig; // Update existing
        } else {
          contextSet.llmPrompts.push(promptConfig); // Add new
        }
      }
      
      contextSet.metadata = {
        ...contextSet.metadata,
        lastModified: new Date()
      };
      
      console.log(`✅ LLM prompts updated for context set: ${data.contextSetName}`);
      
      this.eventBusClient['publishEvent']('llm_prompts_updated', {
        contextSetName: data.contextSetName,
        promptCount: data.llmPrompts.length,
        success: true,
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
      
      this.emit('llm_prompts_updated', { contextSetName: data.contextSetName, llmPrompts: data.llmPrompts });
      
    } catch (error) {
      console.error(`❌ Failed to update LLM prompts for context set: ${data.contextSetName}`, error);
      
      this.eventBusClient['publishEvent']('llm_prompts_update_failed', {
        contextSetName: data.contextSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

  private async handleGetContextRegistryStatus(message: any): Promise<void> {
    const status = {
      totalContextSets: this.contextSets.size,
      activeContextSets: Object.fromEntries(this.activeContextSets),
      contextSets: Array.from(this.contextSets.entries()).map(([name, set]) => ({
        name,
        transactionSetName: set.transactionSetName,
        dataSourceCount: set.dataSources.length,
        promptCount: set.llmPrompts.length,
        description: set.description,
        version: set.metadata?.version,
        created: set.metadata?.created,
        lastModified: set.metadata?.lastModified
      })),
      correlationId: message.correlationId,
      timestamp: new Date()
    };
    
    this.eventBusClient['publishEvent']('context_registry_status', status, 'broadcast');
  }

  private async handleGetContextForTransaction(data: { transactionSetName: string, transactionId?: string, agentName?: string, correlationId?: string }): Promise<void> {
    try {
      const contextSetName = this.activeContextSets.get(data.transactionSetName);
      if (!contextSetName) {
        throw new Error(`No active context set for transaction set: ${data.transactionSetName}`);
      }
      
      const contextSet = this.contextSets.get(contextSetName);
      if (!contextSet) {
        throw new Error(`Context set not found: ${contextSetName}`);
      }
      
      // Build context response
      const contextResponse = {
        contextSetName,
        transactionSetName: data.transactionSetName,
        dataSources: contextSet.dataSources,
        globalContext: contextSet.globalContext,
        llmPrompts: data.transactionId || data.agentName 
          ? contextSet.llmPrompts.filter(p => 
              (!data.transactionId || p.transactionId === data.transactionId) &&
              (!data.agentName || p.agentName === data.agentName)
            )
          : contextSet.llmPrompts,
        correlationId: data.correlationId,
        timestamp: new Date()
      };
      
      this.eventBusClient['publishEvent']('context_for_transaction', contextResponse, 'broadcast');
      
    } catch (error) {
      this.eventBusClient['publishEvent']('context_for_transaction_failed', {
        transactionSetName: data.transactionSetName,
        error: error instanceof Error ? error.message : String(error),
        correlationId: data.correlationId,
        timestamp: new Date()
      }, 'broadcast');
    }
  }

 */

  // Public API methods for sagaWorkflow and sagaCoordinator to use

  public registerDefaultContextSet(contextSetDefinition: ContextSetDefinition): void {
    this.contextSets.set(contextSetDefinition.name, contextSetDefinition);
    console.log(`📝 Local context set registration: ${contextSetDefinition.name} for transaction set: ${contextSetDefinition.transactionSetName}`);
    this.emit('context_set_registered', { 
      contextSetName: contextSetDefinition.name, 
      transactionSetName: contextSetDefinition.transactionSetName 
    });
  }

  public getContextSet(name: string): ContextSetDefinition | undefined {
    return this.contextSets.get(name);
  }

  public getContextSetForTransactionSet(transactionSetName: string): ContextSetDefinition | undefined {
    const contextSetName = this.activeContextSets.get(transactionSetName);
    if (!contextSetName) {
      return undefined;
    }
    return this.contextSets.get(contextSetName);
  }

  public activateContextSetForTransactionSet(transactionSetName: string, contextSetName: string): void {
    if (!this.contextSets.has(contextSetName)) {
      throw new Error(`Context set not found: ${contextSetName}`);
    }
    this.activeContextSets.set(transactionSetName, contextSetName);
    this.emit('context_set_activated', { transactionSetName, contextSetName });
  }

  public getDataSourcesForTransactionSet(transactionSetName: string): DataSource[] {
    const contextSet = this.getContextSetForTransactionSet(transactionSetName);
    return contextSet?.dataSources || [];
  }

  public getLLMPromptsForAgent(transactionSetName: string, agentName: string, transactionId?: string): LLMPromptConfig[] {
    const contextSet = this.getContextSetForTransactionSet(transactionSetName);
    if (!contextSet) {
      return [];
    }
    
    return contextSet.llmPrompts.filter(p => 
      p.agentName === agentName && 
      (!transactionId || p.transactionId === transactionId)
    );
  }


  public getAllContextSets(): string[] {
    return Array.from(this.contextSets.keys());
  }

  public getActiveContextSets(): Map<string, string> {
    return new Map(this.activeContextSets);
  }
}