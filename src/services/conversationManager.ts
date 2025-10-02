import { assert } from 'console';
import OpenAI from 'openai';
import type {
  ResponseCreateParams, // payload you POST
  Response, // full result (non-streaming)
  ResponseStreamEvent, // SSE events
  ResponseOutputItem, // indiv. output element
  ResponseInputItem // indiv. input element
} from "openai/resources/responses/responses.mjs";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface ThreadMessage {
  responseId: string; // Changed from threadId to responseId for Responses API
  userMessage: string;
  messageTimestamp: Date;
}
export interface ThreadResponse {
  success: boolean;
  responseId: string; // Changed from threadId to responseId
  runStatus: string;
  error?: string;
}

/**
 * ConversationManager handles OpenAI Responses API operations
 * - Fetching responses using responses.retrieve 
 * - Creating streaming responses with responses.create
 * - Conversation chaining via previous_response_id
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
   * Retrieve the latest response using Responses API
   * Replaces deprecated threads.messages.list with responses.retrieve
   */
  async fetchLatestThreadMessage(responseId: string): Promise<ThreadMessage | null> {
    try {
      console.log(`🔄 Fetching response: ${responseId}`);

      const response = await this.openaiClient.responses.retrieve(responseId);
const r = response.output[0] as ResponseOutputItem;

           console.log('HERE CONVERSATION', response.output_text)
                console.log('HERE CONVERSATIONID ', response.id)
      if (response && response.output) {
        return {
          responseId,
          userMessage: JSON.stringify(response.output),
          messageTimestamp: new Date(response.created_at * 1000)
        };
      }

      console.log(`⚠️ No output_text found in response ${responseId}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error fetching response ${responseId}:`, error);
      throw error;
    }
  }

  async  sendResponseToThread(sessionId: string, result: string, status = 'completed') {
  if (!sessionId) {
    console.warn('No session ID found, cannot send callback');
    return;
  }

  try {
    const payload = {
      sessionId,
      result,
      status,
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending callback payload:', result)
    
    const response = await fetch(`${process.env.NEXTJS_URL}/api/callback`, {//http://localhost:3002/
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CALLBACK_SECRET}` // Optional security
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Callback failed with status ${response.status}:`, errorText);
      throw new Error(`Callback failed: ${response.status} - ${errorText}`);
    }
    console.log(`Callback sent successfully for session ${sessionId}`);
  } catch (error) {
    console.error('Failed to send callback:', error);
    
  }
}


  extractSessionId(content: string) {
  const match = content.match(/\[CALLBACK_SESSION: (session_[^\]]+)\]/);
  return match ? match[1] : null;
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