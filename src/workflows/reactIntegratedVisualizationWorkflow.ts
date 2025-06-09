import { createEnhancedSagaMiddleware, createMCPServerConfig, connectToMCPServer } from '../index.js';
import { createDataFilteringAgent, createChartSpecificationAgent } from '../agents/dataFilteringAgent.js';
import { createVisualizationReportAgent } from '../agents/visualizationReportAgent.js';
import { 
  createRequirementsInitializerAgent,
  createConversationManagerAgent, 
  createRequirementsValidatorAgent
} from '../agents/visualizationSagaAgents.js';
import { OpenAIAssistantManager, createOpenAIAssistantManager, ThreadConversationResult } from '../agents/openaiAssistantManager.js';
import { VisualizationRequest, VisualizationOutput } from '../types/visualization.js';
import { VisualizationWorkflowRequest, VisualizationSAGAState } from '../types/visualizationSaga.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';

export interface ReactVisualizationAPI {
  // OpenAI Thread-based conversation methods
  createVisualizationThread(): Promise<string>;
  startVisualizationConversation(threadId: string, initialRequest: string): Promise<ReactVisualizationResponse>;
  continueConversation(threadId: string, userMessage: string): Promise<ReactVisualizationResponse>;
  
  // Direct visualization generation (when requirements are clear)
  generateVisualization(request: VisualizationRequest): Promise<VisualizationOutput>;
  
  // Utility methods
  getThreadMessages(threadId: string): Promise<any[]>;
  deleteThread(threadId: string): Promise<void>;
}

export class ReactIntegratedVisualizationWorkflow implements ReactVisualizationAPI {
  private sagaCoordinator: SagaCoordinator;
  private ragServerConfig: any;
  private assistantManager: OpenAIAssistantManager;
  private initialized: boolean = false;

  constructor(assistantConfig: { apiKey: string; assistantId: string }) {
    this.ragServerConfig = createMCPServerConfig({
      name: "rag-server",
      transport: "stdio",
      command: "node",
      args: ["C:/repos/rag-mcp-server/dist/server.js", "--stdio"],
      timeout: 120000
    });

    this.assistantManager = createOpenAIAssistantManager({
      apiKey: assistantConfig.apiKey,
      assistantId: assistantConfig.assistantId
    });

    // Create SAGA coordinator for transaction management
    this.sagaCoordinator = new SagaCoordinator();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing React-Integrated Visualization SAGA Workflow...');
    
    // Connect to RAG server
    try {
      await connectToMCPServer(this.ragServerConfig);
      console.log('✅ Connected to RAG MCP server');
    } catch (error) {
      throw new Error(`Failed to connect to RAG server: ${error}`);
    }

    // Register SAGA agents for visualization workflow
    const requirementsInitializer = createRequirementsInitializerAgent();
    const conversationManager = createConversationManagerAgent();
    const requirementsValidator = createRequirementsValidatorAgent();
    const dataFilteringAgent = createDataFilteringAgent([this.ragServerConfig]);
    const chartSpecAgent = createChartSpecificationAgent();
    const visualizationReportAgent = createVisualizationReportAgent();

    this.sagaCoordinator.registerAgent(requirementsInitializer);
    this.sagaCoordinator.registerAgent(conversationManager);
    this.sagaCoordinator.registerAgent(requirementsValidator);
    this.sagaCoordinator.registerAgent(dataFilteringAgent);
    this.sagaCoordinator.registerAgent(chartSpecAgent);
    this.sagaCoordinator.registerAgent(visualizationReportAgent);

    // Set up event listeners for React app integration
    this.sagaCoordinator.on('visualization_saga_initialized', (state: VisualizationSAGAState) => {
      console.log(`[SAGA] Visualization SAGA initialized: ${state.id}`);
    });

    this.sagaCoordinator.on('visualization_transaction_started', (event: any) => {
      console.log(`[SAGA] Transaction started: ${event.name}`);
    });

    this.sagaCoordinator.on('visualization_transaction_completed', (event: any) => {
      console.log(`[SAGA] Transaction completed: ${event.name}`);
    });

    this.sagaCoordinator.on('visualization_saga_completed', (state: VisualizationSAGAState) => {
      console.log(`[SAGA] Visualization SAGA completed: ${state.id}`);
    });

    this.sagaCoordinator.on('visualization_saga_failed', (event: any) => {
      console.log(`[SAGA] Visualization SAGA failed: ${event.error}`);
    });

    this.initialized = true;
    console.log('✅ React-integrated visualization SAGA workflow initialized');
  }

  async createVisualizationThread(): Promise<string> {
    await this.initialize();
    return await this.assistantManager.createVisualizationThread();
  }

  async startVisualizationConversation(threadId: string, initialRequest: string): Promise<ReactVisualizationResponse> {
    await this.initialize();
    
    console.log(`🎬 Starting visualization conversation for thread: ${threadId}`);
    console.log(`Initial request: ${initialRequest}`);

    try {
      // Start conversation through OpenAI Assistant
      const threadResult = await this.assistantManager.startVisualizationConversation(threadId, initialRequest);
      
      // If requirements are complete, generate visualization
      if (threadResult.requirementsComplete && threadResult.visualizationRequest) {
        console.log('✅ Requirements complete, generating visualization...');
        
        const visualizationOutput = await this.generateVisualization(threadResult.visualizationRequest);
        
        return {
          ...threadResult,
          visualizationOutput
        };
      }

      return threadResult;

    } catch (error) {
      console.error('❌ Failed to start visualization conversation:', error);
      throw error;
    }
  }

  async continueConversation(threadId: string, userMessage: string): Promise<ReactVisualizationResponse> {
    await this.initialize();
    
    console.log(`💬 Continuing conversation for thread: ${threadId}`);
    console.log(`User message: ${userMessage}`);

    try {
      // Continue conversation through OpenAI Assistant
      const threadResult = await this.assistantManager.continueConversation(threadId, userMessage);
      
      // If requirements are now complete, generate visualization
      if (threadResult.requirementsComplete && threadResult.visualizationRequest) {
        console.log('✅ Requirements now complete, generating visualization...');
        
        const visualizationOutput = await this.generateVisualization(threadResult.visualizationRequest);
        
        return {
          ...threadResult,
          visualizationOutput
        };
      }

      return threadResult;

    } catch (error) {
      console.error('❌ Failed to continue conversation:', error);
      throw error;
    }
  }

  async generateVisualization(request: VisualizationRequest): Promise<VisualizationOutput> {
    await this.initialize();
    
    const startTime = Date.now();
    console.log('📊 Generating visualization using SAGA pattern...');
    console.log('Request:', JSON.stringify(request, null, 2));

    try {
      // Execute the visualization SAGA
      const workflowRequest: VisualizationWorkflowRequest = {
        userQuery: request.userQuery,
        visualizationRequest: request,
        workflowId: `viz_${Date.now()}`,
        correlationId: `react_${Date.now()}`
      };

      const sagaResult = await this.sagaCoordinator.executeVisualizationSAGA(workflowRequest);

      if (!sagaResult.success) {
        throw new Error(`Visualization SAGA failed: ${sagaResult.error}`);
      }

      console.log('✅ Visualization SAGA completed successfully');
      
      // Extract the final output from SAGA state
      const visualizationOutput = sagaResult.result.finalOutput as VisualizationOutput;
      
      if (!visualizationOutput) {
        throw new Error('No visualization output produced by SAGA');
      }

      // Enhance the output with D3-specific formatting
      return this.enhanceForD3(visualizationOutput);

    } catch (error) {
      console.error('❌ Visualization SAGA failed:', error);
      throw error;
    }
  }

  async getThreadMessages(threadId: string): Promise<any[]> {
    return await this.assistantManager.getThreadMessages(threadId);
  }

  async deleteThread(threadId: string): Promise<void> {
    return await this.assistantManager.deleteThread(threadId);
  }

  private enhanceForD3(output: VisualizationOutput): VisualizationOutput {
    // Enhance chart specification with D3-specific configurations
    const enhanced = { ...output };
    
    // Add D3-specific properties to chart spec
    enhanced.chartSpec = {
      ...enhanced.chartSpec,
      d3Config: {
        // D3-specific scaling functions
        xScale: this.determineD3Scale(enhanced.chartSpec.xAxis.type),
        yScale: this.determineD3Scale(enhanced.chartSpec.yAxis.type),
        
        // D3-friendly data format
        dataFormat: 'array-of-objects',
        
        // Animation preferences
        transitions: {
          duration: 750,
          ease: 'easeInOutQuad'
        },
        
        // Responsive design
        responsive: true,
        
        // Color scheme for energy types
        colorScheme: {
          coal: '#8B4513',
          gas: '#4169E1', 
          green: '#32CD32'
        },
        
        // Interactive features
        interactions: {
          tooltip: true,
          zoom: enhanced.chartSpec.interactivity.zoom,
          brush: enhanced.chartSpec.chartType === 'line',
          legend: enhanced.chartSpec.layout.showLegend
        }
      }
    };

    // Format data for D3 consumption
    enhanced.rawData.d3Data = this.formatDataForD3(enhanced.rawData.processedData, enhanced.chartSpec);
    
    return enhanced;
  }

  private determineD3Scale(axisType: string): string {
    switch (axisType) {
      case 'time': return 'scaleTime';
      case 'linear': return 'scaleLinear';
      case 'log': return 'scaleLog';
      case 'category': return 'scaleBand';
      default: return 'scaleLinear';
    }
  }

  private formatDataForD3(data: any[], chartSpec: any): any[] {
    // Transform data into D3-friendly format based on chart type
    return data.map(point => ({
      x: point[chartSpec.xAxis.field],
      y: point[chartSpec.yAxis.field],
      category: point.energyType || point.supplier,
      timestamp: point.timestamp,
      ...point // Include all original fields for tooltip/details
    }));
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down React-integrated visualization workflow...');
    // No cleanup needed for OpenAI Assistant threads - they're managed by OpenAI
    this.initialized = false;
    console.log('✅ Shutdown complete');
  }
}

// Export types for React app integration
export interface ReactVisualizationResponse extends ThreadConversationResult {
  visualizationOutput?: VisualizationOutput;
}

// Factory function for easy integration
export function createReactVisualizationAPI(assistantConfig: { apiKey: string; assistantId: string }): ReactVisualizationAPI {
  return new ReactIntegratedVisualizationWorkflow(assistantConfig);
}

// Example integration points for React app using OpenAI Assistants
export const REACT_INTEGRATION_EXAMPLES = {
  // Initialize the API with OpenAI credentials
  createAPI: () => {
    return createReactVisualizationAPI({
      apiKey: process.env.OPENAI_API_KEY!,
      assistantId: process.env.ASSISTANT_ID!
    });
  },

  // Create a new thread for visualization
  createThread: async (api: ReactVisualizationAPI) => {
    return await api.createVisualizationThread();
  },
  
  // Start conversation in existing thread
  startConversation: async (api: ReactVisualizationAPI, threadId: string, query: string) => {
    return await api.startVisualizationConversation(threadId, query);
  },
  
  // Continue conversation in thread
  continueConversation: async (api: ReactVisualizationAPI, threadId: string, response: string) => {
    return await api.continueConversation(threadId, response);
  },
  
  // Get thread message history
  getMessages: async (api: ReactVisualizationAPI, threadId: string) => {
    return await api.getThreadMessages(threadId);
  },
  
  // Direct visualization for clear requirements
  generateDirect: async (api: ReactVisualizationAPI, request: VisualizationRequest) => {
    return await api.generateVisualization(request);
  },

  // Cleanup thread when done
  cleanup: async (api: ReactVisualizationAPI, threadId: string) => {
    return await api.deleteThread(threadId);
  }
};