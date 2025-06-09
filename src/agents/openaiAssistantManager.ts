import OpenAI from 'openai';
import { VisualizationRequest } from '../types/visualization.js';

export interface OpenAIAssistantConfig {
  apiKey: string;
  assistantId: string;
  model?: string;
}

export interface ThreadConversationResult {
  threadId: string;
  requirementsComplete: boolean;
  visualizationRequest?: VisualizationRequest;
  lastAssistantMessage?: string;
  runId?: string;
  status: 'in_progress' | 'completed' | 'failed' | 'requires_action';
  extractedRequirements?: Partial<VisualizationRequest>;
}

export interface RequirementExtractionFunction {
  name: 'extract_visualization_requirements';
  parameters: {
    userQuery: string;
    timeRange?: { start: string; end: string };
    energyTypes?: string[];
    suppliers?: string[];
    chartType?: string;
    aggregation?: string;
    requirementsComplete: boolean;
    clarificationNeeded?: string[];
  };
}

export class OpenAIAssistantManager {
  private openai: OpenAI;
  private assistantId: string;
  private threadContexts = new Map<string, any>();

  constructor(config: OpenAIAssistantConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey
    });
    this.assistantId = config.assistantId;
  }

  async createVisualizationThread(): Promise<string> {
    console.log('🧵 Creating new OpenAI thread for visualization...');

    const thread = await this.openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: '',
        },
      ],
    });

    return thread.id;
  }

  async startVisualizationConversation(
    threadId: string, 
    userMessage: string
  ): Promise<ThreadConversationResult> {
    console.log(`🎬 Starting visualization conversation in thread: ${threadId}`);
    
    try {
      // Add user message to thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage
      });

      // Create and poll run with the assistant
      const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: this.assistantId,
        instructions: this.getVisualizationInstructions(),
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_visualization_requirements',
              description: 'Extract and structure visualization requirements from user conversation',
              parameters: {
                type: 'object',
                properties: {
                  userQuery: {
                    type: 'string',
                    description: 'The original user query'
                  },
                  timeRange: {
                    type: 'object',
                    properties: {
                      start: { type: 'string', description: 'Start date/time in ISO format' },
                      end: { type: 'string', description: 'End date/time in ISO format' }
                    },
                    description: 'Time range for the visualization'
                  },
                  energyTypes: {
                    type: 'array',
                    items: { type: 'string', enum: ['coal', 'gas', 'green'] },
                    description: 'Energy types to include'
                  },
                  suppliers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific suppliers to focus on'
                  },
                  chartType: {
                    type: 'string',
                    enum: ['line', 'bar', 'scatter', 'area', 'heatmap', 'auto'],
                    description: 'Preferred chart type'
                  },
                  aggregation: {
                    type: 'string',
                    enum: ['raw', '15min', 'hourly', 'daily'],
                    description: 'Data aggregation level'
                  },
                  requirementsComplete: {
                    type: 'boolean',
                    description: 'Whether all necessary requirements have been gathered'
                  },
                  clarificationNeeded: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of aspects that need clarification'
                  }
                },
                required: ['userQuery', 'requirementsComplete']
              }
            }
          }
        ]
      });

      return await this.processRunResult(threadId, run);

    } catch (error) {
      console.error('❌ Failed to start visualization conversation:', error);
      throw error;
    }
  }

  async continueConversation(
    threadId: string, 
    userMessage: string
  ): Promise<ThreadConversationResult> {
    console.log(`💬 Continuing conversation in thread: ${threadId}`);
    
    try {
      // Add user message to thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage
      });

      // Continue conversation with assistant
      const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: this.assistantId,
        instructions: this.getContinuationInstructions(),
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_visualization_requirements',
              description: 'Extract and structure visualization requirements from user conversation',
              parameters: {
                type: 'object',
                properties: {
                  userQuery: { type: 'string' },
                  timeRange: {
                    type: 'object',
                    properties: {
                      start: { type: 'string' },
                      end: { type: 'string' }
                    }
                  },
                  energyTypes: {
                    type: 'array',
                    items: { type: 'string', enum: ['coal', 'gas', 'green'] }
                  },
                  suppliers: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  chartType: {
                    type: 'string',
                    enum: ['line', 'bar', 'scatter', 'area', 'heatmap', 'auto']
                  },
                  aggregation: {
                    type: 'string',
                    enum: ['raw', '15min', 'hourly', 'daily']
                  },
                  requirementsComplete: { type: 'boolean' },
                  clarificationNeeded: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['userQuery', 'requirementsComplete']
              }
            }
          }
        ]
      });

      return await this.processRunResult(threadId, run);

    } catch (error) {
      console.error('❌ Failed to continue conversation:', error);
      throw error;
    }
  }

  private async processRunResult(threadId: string, run: any): Promise<ThreadConversationResult> {
    console.log(`📊 Processing run result: ${run.status}`);

    if (run.status === 'completed') {
      // Get the latest messages
      const messages = await this.openai.beta.threads.messages.list(threadId, {
        order: 'desc',
        limit: 1
      });

      const lastMessage = messages.data[0];
      const assistantMessage = lastMessage?.content[0]?.type === 'text' 
        ? lastMessage.content[0].text.value 
        : '';

      // Check if there were function calls (requirement extraction)
      if (run.required_action?.type === 'submit_tool_outputs') {
        // Process function call results
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
        const extractionCall = toolCalls.find((call: any) => 
          call.function.name === 'extract_visualization_requirements'
        );

        if (extractionCall) {
          const requirements = JSON.parse(extractionCall.function.arguments);
          
          if (requirements.requirementsComplete) {
            // Convert to VisualizationRequest
            const visualizationRequest: VisualizationRequest = {
              userQuery: requirements.userQuery,
              filters: {
                timeRange: requirements.timeRange,
                energyTypes: requirements.energyTypes,
                suppliers: requirements.suppliers,
                aggregation: requirements.aggregation
              },
              chartPreferences: {
                type: requirements.chartType || 'auto'
              }
            };

            return {
              threadId,
              requirementsComplete: true,
              visualizationRequest,
              lastAssistantMessage: assistantMessage,
              runId: run.id,
              status: 'completed',
              extractedRequirements: requirements
            };
          }
        }
      }

      return {
        threadId,
        requirementsComplete: false,
        lastAssistantMessage: assistantMessage,
        runId: run.id,
        status: 'completed'
      };

    } else if (run.status === 'failed') {
      return {
        threadId,
        requirementsComplete: false,
        status: 'failed',
        runId: run.id
      };
    }

    return {
      threadId,
      requirementsComplete: false,
      status: 'in_progress',
      runId: run.id
    };
  }

  private getVisualizationInstructions(): string {
    return `You are an expert energy data visualization assistant. Your role is to help users specify their visualization requirements for energy supply data.

DATASET CONTEXT:
- 28 energy suppliers (coal, gas, green energy)
- 5-minute interval data over 10 days
- Metrics: output, efficiency, cost, peak demand
- Time-series data with temporal patterns

YOUR PROCESS:
1. ANALYZE the user's request to understand their visualization intent
2. IDENTIFY what information is missing or unclear
3. ASK focused clarifying questions (1-2 per response)
4. EXTRACT requirements using the extract_visualization_requirements function when you have enough information

CLARIFICATION PRIORITIES:
1. Time range (if not specified)
2. Energy types of interest (coal, gas, green, or all)
3. Specific suppliers (if relevant to analysis)
4. Chart type preference (or let system decide)
5. Data granularity (raw 5-min, hourly, daily)

CONVERSATION STYLE:
- Be conversational and helpful
- Ask focused questions to avoid overwhelming the user
- Provide examples when helpful ("e.g., 'last 3 days' or 'December 10-15'")
- Use domain knowledge to suggest reasonable defaults
- Confirm understanding before finalizing requirements

CALL extract_visualization_requirements WHEN:
- You have sufficient information to create a meaningful visualization
- User has answered your clarifying questions
- Requirements are clear enough to proceed

EXAMPLE INTERACTION:
User: "Show me energy trends"
You: "I'd be happy to show you energy trends! To create the best visualization:
1. What time period interests you? (e.g., 'last 3 days', 'past week')
2. Are you interested in all energy types (coal, gas, green) or specific ones?"

Remember: Focus on gathering just enough information to create a useful visualization. Don't over-complicate the requirements gathering.`;
  }

  private getContinuationInstructions(): string {
    return `Continue the conversation to gather visualization requirements. Based on the user's latest response, either:

1. ASK additional clarifying questions if more information is needed
2. CALL extract_visualization_requirements if you now have sufficient information
3. CONFIRM your understanding before finalizing

Keep the conversation focused and efficient. Only ask for information that will significantly impact the visualization quality.`;
  }

  async getThreadMessages(threadId: string, limit: number = 10): Promise<any[]> {
    const messages = await this.openai.beta.threads.messages.list(threadId, {
      order: 'desc',
      limit
    });

    return messages.data.reverse(); // Return in chronological order
  }

  async deleteThread(threadId: string): Promise<void> {
    try {
      await this.openai.beta.threads.del(threadId);
      this.threadContexts.delete(threadId);
      console.log(`🗑️ Deleted thread: ${threadId}`);
    } catch (error) {
      console.error(`Failed to delete thread ${threadId}:`, error);
    }
  }
}

// Factory function for easy integration
export function createOpenAIAssistantManager(config: OpenAIAssistantConfig): OpenAIAssistantManager {
  return new OpenAIAssistantManager(config);
}