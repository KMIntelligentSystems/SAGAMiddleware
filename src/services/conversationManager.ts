import { assert } from 'console';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ThreadMessage {
  threadId: string;
  userMessage: string;
  messageTimestamp: Date;
}
export interface ThreadResponse {
  success: boolean;
  threadId: string;
  runStatus: string;
  error?: string;
}

/**
 * ConversationManager handles only OpenAI thread operations
 * - Fetching messages from threads
 * - Sending responses via createAndPoll
 * - No context management (handled by ContextManager)
 * - No CSV file extraction (data sources in ContextRegistry)
 * - No conversation state (handled by ConversationAgent via SAGA)
 */
export class ConversationManager {
  private openaiClient: OpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });;
  private assistantId: string;
  constructor(assistantId: string) {
    this.assistantId = assistantId;
  }

  

  /**
   * Fetch the latest user message from OpenAI thread
   * Pure thread message retrieval - no CSV extraction or context creation
   */
  async fetchLatestThreadMessage(threadId: string): Promise<ThreadMessage | null> {
    try {
      console.log(`🧵 Fetching latest message from thread: ${threadId}`);

      const messages = await this.openaiClient.beta.threads.messages.list(threadId, {
        order: 'desc',
        limit: 10
      });

      // Find the most recent user message
      const userMessage = messages.data.find(msg => msg.role === 'user');
      
      if (userMessage && userMessage.content && userMessage.content.length > 0) {
        const content = userMessage.content[0];
        if (content.type === 'text') {
          return {
            threadId,
            userMessage: content.text.value,
            messageTimestamp: new Date(userMessage.created_at * 1000)
          };
        }
      }

      console.log(`⚠️ No user message found in thread ${threadId}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error fetching thread messages for ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * Send response back to OpenAI thread using createAndPoll
   * Pure thread response - no conversation logic
   */
  async sendResponseToThread(threadId: string, responseMessage: string): Promise<ThreadResponse> {
    try {
      console.log(`📤 Sending response to thread ${threadId}`);

      // Create and poll a run to send the response
      const run = await this.openaiClient.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: this.assistantId
      });

      console.log(`✅ Thread run completed with status: ${run.status}`);
      
      if (run.status === 'failed') {
        const errorMessage = `Thread run failed: ${run.last_error?.message || 'Unknown error'}`;
        console.error('❌', errorMessage);
        return {
          success: false,
          threadId,
          runStatus: run.status,
          error: errorMessage
        };
      }

      // If run is completed, add our response message
      if (run.status === 'completed') {
        await this.openaiClient.beta.threads.messages.create(threadId, {
          role: 'assistant',
          content: responseMessage
        });
        console.log(`📝 Response message added to thread ${threadId}`);
      }

      return {
        success: true,
        threadId,
        runStatus: run.status
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ Error sending response to thread ${threadId}:`, error);
      return {
        success: false,
        threadId,
        runStatus: 'error',
        error: errorMessage
      };
    }
  }

  /**
   * Get OpenAI client (for use by other services if needed)
   */
  getOpenAIClient(): OpenAI {
    return this.openaiClient;
  }

  /**
   * Get assistant ID
   */
  getAssistantId(): string {
    return this.assistantId;
  }
}