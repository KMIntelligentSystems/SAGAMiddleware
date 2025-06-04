import { EventEmitter } from 'events';
import { 
  AgentDefinition, 
  SagaEvent, 
  AgentResult,
  SAGAWorkflowState,
  AccumulatedData,
  ChunkState,
  ChunkRequest,
  ChunkAnalysisResult
} from '../types/index.js';
import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { ValidationManager } from '../sublayers/validationManager.js';
import { TransactionManager } from '../sublayers/transactionManager.js';

export class SagaCoordinator extends EventEmitter {
  private agents: Map<string, GenericAgent> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private executionOrder: string[] = [];
  private contextManager: ContextManager;
  private validationManager: ValidationManager;
  private transactionManager: TransactionManager;
  private activeExecutions: Set<string> = new Set();
  private chunkWorkflowState: SAGAWorkflowState | null = null;

  constructor() {
    super();
    this.contextManager = new ContextManager();
    this.validationManager = new ValidationManager();
    this.transactionManager = new TransactionManager();
  }

  registerAgent(definition: AgentDefinition): void {
    const agent = new GenericAgent(definition);
    this.agents.set(definition.name, agent);
    this.agentDefinitions.set(definition.name, definition);
    this.recalculateExecutionOrder();
    
    console.log(`🔧 Registered agent: ${definition.name}`);
    console.log(`🔧 MCP servers: ${definition.mcpServers?.map(s => s.name).join(', ') || 'none'}`);
    console.log(`🔧 MCP tools: ${definition.mcpTools?.join(', ') || 'none'}`);
  }

  async ensureAgentMCPCapabilities(): Promise<void> {
    console.log('🔧 Ensuring all agents have MCP capabilities...');
    for (const [name, agent] of this.agents.entries()) {
      try {
        await agent.refreshCapabilities();
        const tools = agent.getAvailableTools();
        console.log(`🔧 Agent ${name} tools refreshed: ${tools.map(t => t.name).join(', ') || 'none'}`);
      } catch (error) {
        console.error(`🔧 Failed to refresh MCP capabilities for ${name}:`, error);
      }
    }
  }

  async executeWorkflow(
    initialContext: Record<string, any> = {},
    correlationId: string = `workflow_${Date.now()}`
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();
    
    this.emitEvent({
      id: `start_${correlationId}`,
      type: 'transaction_start',
      data: { executionOrder: this.executionOrder },
      timestamp: new Date(),
      correlationId
    });

    const transactionId = await this.transactionManager.startTransaction('workflow');

    try {
      for (const agentName of this.executionOrder) {
        if (this.activeExecutions.has(agentName)) {
          throw new Error(`Agent ${agentName} is already executing`);
        }

        this.activeExecutions.add(agentName);
        
        try {
          const result = await this.executeAgent(agentName, initialContext, correlationId);
          results.set(agentName, result);

          if (!result.success) {
            throw new Error(`Agent ${agentName} failed: ${result.error}`);
          }

          this.contextManager.updateContext(agentName, { 
            lastResult: result.result,
            executionTime: result.timestamp 
          });

        } finally {
          this.activeExecutions.delete(agentName);
        }
      }

      await this.transactionManager.commitTransaction(transactionId);
      
      this.emitEvent({
        id: `commit_${correlationId}`,
        type: 'transaction_commit',
        data: { results: Array.from(results.entries()) },
        timestamp: new Date(),
        correlationId
      });

      return results;

    } catch (error) {
      await this.transactionManager.rollbackTransaction(transactionId);
      
      this.emitEvent({
        id: `rollback_${correlationId}`,
        type: 'transaction_rollback',
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        correlationId
      });

      throw error;
    }
  }

  async executeAgent(
    agentName: string, 
    additionalContext: Record<string, any> = {},
    correlationId: string = `agent_${Date.now()}`
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    this.emitEvent({
      id: `start_${agentName}_${correlationId}`,
      type: 'agent_start',
      agentName,
      timestamp: new Date(),
      correlationId
    });

    try {
      const dependencies = await this.resolveDependencies(agentName);
      const context = {
        ...this.contextManager.getContext(agentName),
        ...dependencies,
        ...additionalContext
      };

      const result = await agent.execute(context);

      const validation = await this.validationManager.validateAgentOutput(
        agentName, 
        result.result
      );

      if (!validation.isValid) {
        result.success = false;
        result.error = `Validation failed: ${validation.errors.join(', ')}`;
      }

      this.emitEvent({
        id: `complete_${agentName}_${correlationId}`,
        type: result.success ? 'agent_complete' : 'agent_error',
        agentName,
        data: { result: result.result, validation },
        timestamp: new Date(),
        correlationId
      });

      return result;

    } catch (error) {
      const errorResult: AgentResult = {
        agentName,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };

      this.emitEvent({
        id: `error_${agentName}_${correlationId}`,
        type: 'agent_error',
        agentName,
        data: { error: errorResult.error },
        timestamp: new Date(),
        correlationId
      });

      return errorResult;
    }
  }

  private async resolveDependencies(agentName: string): Promise<Record<string, any>> {
    const definition = this.agentDefinitions.get(agentName);
    if (!definition || !definition.dependencies.length) {
      return {};
    }

    const dependencyData: Record<string, any> = {};

    for (const dep of definition.dependencies) {
      const depContext = this.contextManager.getContext(dep.agentName);
      if (dep.required && !depContext?.lastResult) {
        throw new Error(`Required dependency ${dep.agentName} has not been executed`);
      }
      
      if (depContext?.lastResult) {
        dependencyData[dep.agentName] = depContext.lastResult;
      }
    }

    return dependencyData;
  }

  private recalculateExecutionOrder(): void {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const [name, definition] of this.agentDefinitions.entries()) {
      graph.set(name, definition.dependencies.map(d => d.agentName));
      inDegree.set(name, 0);
    }

    for (const [name, deps] of graph.entries()) {
      for (const dep of deps) {
        if (this.agentDefinitions.has(dep)) {
          inDegree.set(name, (inDegree.get(name) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [name, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const dependents = Array.from(this.agentDefinitions.entries())
        .filter(([_, def]) => def.dependencies.some(d => d.agentName === current))
        .map(([name, _]) => name);

      for (const dependent of dependents) {
        const currentDegree = inDegree.get(dependent) || 0;
        inDegree.set(dependent, currentDegree - 1);
        
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }

    if (result.length !== this.agentDefinitions.size) {
      throw new Error('Circular dependency detected in agent definitions');
    }

    this.executionOrder = result;
  }

  private emitEvent(event: SagaEvent): void {
    this.emit('saga_event', event);
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  getValidationManager(): ValidationManager {
    return this.validationManager;
  }

  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }

  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  // SAGA Chunk Processing Methods
//Type: SAGAWorkflowState maintains 
  initializeChunkWorkflow(workflowId: string, collection: string): void {
    this.chunkWorkflowState = {
      id: workflowId,
      status: 'initializing',
      currentChunkBatch: 0,
      totalChunks: 0,
      accumulatedData: {
        insights: [],
        patterns: [],
        statistics: {},
        metadata: {
          totalChunksProcessed: 0,
          processingStartTime: new Date(),
          lastUpdated: new Date(),
          collection
        },
        rawData: []
      },
      chunkStates: new Map(),
      errors: [],
      startTime: new Date()
    };
  }
//After sagaChunkProcessing creates chunking agents, checks collection is available then runs this:
  async executeChunkProcessingWorkflow(
    collection: string, 
    initialChunkLimit: number = 10,
    workflowId: string = `chunk_workflow_${Date.now()}`
  ): Promise<AgentResult> {
    console.log(`🔧 Starting executeChunkProcessingWorkflow: collection=${collection}, limit=${initialChunkLimit}`);
    console.log(`🔧 Registered agents: ${Array.from(this.agents.keys()).join(', ')}`);
    
    this.initializeChunkWorkflow(workflowId, collection);
    
    // Ensure all agents have their MCP capabilities loaded
    console.log(`🔧 Ensuring MCP capabilities for ${this.agents.size} agents...`);
    await this.ensureAgentMCPCapabilities();
    
    try {
      this.chunkWorkflowState!.status = 'requesting_chunks';
      this.emit('workflow_status_changed', this.chunkWorkflowState);

      let hasMoreChunks = true;
      let offset = 0;

      while (hasMoreChunks && this.chunkWorkflowState!.errors.length === 0) {
        // Step 1: Request chunks
        const chunkRequest: ChunkRequest = {
          collection,
          limit: initialChunkLimit,
          offset
        };

        const chunksResult = await this.requestChunks(chunkRequest);
        if (!chunksResult.success) {
          this.chunkWorkflowState!.errors.push(chunksResult.error || 'Failed to request chunks');
          break;
        }

        let chunks = [];
        
        // Handle different result formats
        if (chunksResult.result) {
          if (typeof chunksResult.result === 'string') {
            try {
              const parsed = JSON.parse(chunksResult.result);
              chunks = parsed.chunks || parsed.documents || parsed.results || [];
            } catch (e) {
              console.log(`🔧 Failed to parse chunk result: ${chunksResult.result}`);
              chunks = [];
            }
          } else if (Array.isArray(chunksResult.result)) {
            chunks = chunksResult.result;
          } else if (chunksResult.result.chunks) {
            chunks = chunksResult.result.chunks;
          } else if (chunksResult.result.documents) {
            chunks = chunksResult.result.documents;
          }
        }
        
        console.log(`🔧 Extracted ${chunks.length} chunks from result`);
        hasMoreChunks = chunks.length === initialChunkLimit;

        if (chunks.length === 0) {
          console.log(`🔧 No chunks found, ending processing`);
          break;
        }

        // Step 2: Analyze each chunk
        this.chunkWorkflowState!.status = 'analyzing';
        this.emit('workflow_status_changed', this.chunkWorkflowState);

        for (const chunk of chunks) {
          const analysisResult = await this.analyzeChunk(chunk);
          if (analysisResult.success) {
            // Step 3: Accumulate data
            await this.accumulateData(analysisResult.result);
          } else {
            this.chunkWorkflowState!.errors.push(`Chunk analysis failed: ${analysisResult.error}`);
          }
        }

        offset += chunks.length;
        this.chunkWorkflowState!.currentChunkBatch++;
        
        // Let accumulator decide if we need more chunks
        const continuationDecision = await this.shouldContinueProcessing();
        if (!continuationDecision.continue) {
          hasMoreChunks = false;
          this.emit('processing_decision', { 
            decision: 'stop', 
            reason: continuationDecision.reason 
          });
        }
      }

      // Step 4: Generate final report
      this.chunkWorkflowState!.status = 'reporting';
      this.emit('workflow_status_changed', this.chunkWorkflowState);

      const reportResult = await this.generateFinalReport();
      
      this.chunkWorkflowState!.status = this.chunkWorkflowState!.errors.length > 0 ? 'failed' : 'completed';
      this.chunkWorkflowState!.endTime = new Date();
      this.emit('workflow_status_changed', this.chunkWorkflowState);

      return {
        agentName: 'saga_coordinator',
        result: {
          workflowState: this.chunkWorkflowState,
          finalReport: reportResult.result,
          summary: {
            totalChunksProcessed: this.chunkWorkflowState!.accumulatedData.metadata.totalChunksProcessed,
            totalInsights: this.chunkWorkflowState!.accumulatedData.insights.length,
            totalPatterns: this.chunkWorkflowState!.accumulatedData.patterns.length,
            processingTime: this.chunkWorkflowState!.endTime!.getTime() - this.chunkWorkflowState!.startTime.getTime()
          }
        },
        success: this.chunkWorkflowState!.errors.length === 0,
        error: this.chunkWorkflowState!.errors.length > 0 ? this.chunkWorkflowState!.errors.join('; ') : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      this.chunkWorkflowState!.status = 'failed';
      this.chunkWorkflowState!.errors.push(error instanceof Error ? error.message : String(error));
      this.chunkWorkflowState!.endTime = new Date();

      return {
        agentName: 'saga_coordinator',
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  private async requestChunks(request: ChunkRequest): Promise<AgentResult> {
    const requesterAgent = this.agents.get('chunk_requester');
    if (!requesterAgent) {
      throw new Error('ChunkRequester agent not registered');
    }

    console.log(`🔧 Requesting chunks: collection=${request.collection}, limit=${request.limit}, offset=${request.offset}`);
    console.log(`🔧 Available tools for chunk_requester:`, requesterAgent.getAvailableTools().map(t => t.name));

    const result = await requesterAgent.execute({
      collection: request.collection,
      limit: request.limit,
      offset: request.offset || 0,
      currentBatch: this.chunkWorkflowState!.currentChunkBatch,
      chunkRequest: request
    });

    console.log(`🔧 Chunk request result:`, result.success ? 'SUCCESS' : 'FAILED', result.error || '');
    console.log(`🔧 Chunk request response:`, JSON.stringify(result.result, null, 2));
    
    // Check if we actually got chunks
    if (result.success && result.result) {
      if (typeof result.result === 'string') {
        try {
          const parsed = JSON.parse(result.result);
          console.log(`🔧 Parsed chunk response:`, JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(`🔧 Raw response string:`, result.result);
        }
      }
    }
    
    return result;
  }

  private async analyzeChunk(chunk: any): Promise<AgentResult> {
    const analyzerAgent = this.agents.get('chunk_analyzer');
    if (!analyzerAgent) {
      throw new Error('ChunkAnalyzer agent not registered');
    }

    const chunkState: ChunkState = {
      chunkId: chunk.id || `chunk_${Date.now()}`,
      collection: this.chunkWorkflowState!.accumulatedData.metadata.collection,
      processed: false,
      processingStarted: new Date(),
      processingCompleted: null,
      retryCount: 0,
      data: chunk
    };

    this.chunkWorkflowState!.chunkStates.set(chunkState.chunkId, chunkState);

    const result = await analyzerAgent.execute({
      chunk,
      accumulatedContext: this.chunkWorkflowState!.accumulatedData,
      chunkState
    });

    chunkState.processed = result.success;
    chunkState.processingCompleted = new Date();
    if (!result.success) {
      chunkState.error = result.error;
    }

    return result;
  }

  private async accumulateData(analysisResult: ChunkAnalysisResult): Promise<void> {
    const accumulatorAgent = this.agents.get('accumulator');
    if (!accumulatorAgent) {
      throw new Error('Accumulator agent not registered');
    }

    this.chunkWorkflowState!.status = 'accumulating';
    
    const result = await accumulatorAgent.execute({
      newAnalysis: analysisResult,
      currentAccumulation: this.chunkWorkflowState!.accumulatedData
    });

    if (result.success) {
      this.chunkWorkflowState!.accumulatedData = result.result;
      this.chunkWorkflowState!.accumulatedData.metadata.lastUpdated = new Date();
      this.chunkWorkflowState!.accumulatedData.metadata.totalChunksProcessed++;
      
      this.emit('data_accumulated', {
        chunkId: analysisResult.chunkId,
        totalProcessed: this.chunkWorkflowState!.accumulatedData.metadata.totalChunksProcessed
      });
    }
  }

  private async shouldContinueProcessing(): Promise<{ continue: boolean; reason: string }> {
    const accumulatorAgent = this.agents.get('accumulator');
    if (!accumulatorAgent) {
      return { continue: false, reason: 'Accumulator agent not available' };
    }

    const result = await accumulatorAgent.execute({
      action: 'evaluate_continuation',
      accumulatedData: this.chunkWorkflowState!.accumulatedData,
      currentBatch: this.chunkWorkflowState!.currentChunkBatch
    });

    if (result.success && result.result.shouldContinue !== undefined) {
      return {
        continue: result.result.shouldContinue,
        reason: result.result.reason || 'Agent decision'
      };
    }

    // Default: continue for up to 5 batches or 100 insights
    const shouldContinue = this.chunkWorkflowState!.currentChunkBatch < 5 && 
                          this.chunkWorkflowState!.accumulatedData.insights.length < 100;
    
    return {
      continue: shouldContinue,
      reason: shouldContinue ? 'Default continuation logic' : 'Reached processing limits'
    };
  }

  private async generateFinalReport(): Promise<AgentResult> {
    const reporterAgent = this.agents.get('report_generator');
    if (!reporterAgent) {
      throw new Error('ReportGenerator agent not registered');
    }

    return await reporterAgent.execute({
      accumulatedData: this.chunkWorkflowState!.accumulatedData,
      workflowSummary: {
        totalChunks: this.chunkWorkflowState!.accumulatedData.metadata.totalChunksProcessed,
        processingTime: new Date().getTime() - this.chunkWorkflowState!.startTime.getTime(),
        batchesProcessed: this.chunkWorkflowState!.currentChunkBatch
      }
    });
  }

  getChunkWorkflowState(): SAGAWorkflowState | null {
    return this.chunkWorkflowState ? { ...this.chunkWorkflowState } : null;
  }

  getAccumulatedData(): AccumulatedData | null {
    return this.chunkWorkflowState ? { ...this.chunkWorkflowState.accumulatedData } : null;
  }
}