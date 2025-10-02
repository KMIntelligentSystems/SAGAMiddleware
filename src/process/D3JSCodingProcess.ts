// D3JSCodingProcess - Executes D3JSCodingAgent to generate D3.js visualization code
// Similar to DefineGenericAgentsProcess but specific to D3 coding

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult } from '../types/index.js';

/**
 * D3JSCodingProcess
 *
 * Executes D3JSCodingAgent to generate D3.js code based on:
 * - User request (extracted from user query)
 * - Data analysis summary (from DataSummarizingProcess, stored in context)
 *
 * Pattern:
 * 1. Parse user query to extract D3JSCodingAgent's task
 * 2. Clear agent context
 * 3. Set context with task
 * 4. Execute agent
 * 5. Store D3 code result
 */
export class D3JSCodingProcess {
  private agent: GenericAgent;
  private contextManager: ContextManager;
  private userQuery: string;

  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string
  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
  }

  /**
   * Execute D3 coding
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🎨 D3JSCodingProcess: Generating D3.js code with ${this.agent.getName()}`);

    // Parse user query to extract D3JSCodingAgent's task
    const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.agent.getName()
    );

    if (!conversationContext) {
      console.warn(`⚠️  No task found for ${this.agent.getName()} in user query`);
      return {
        agentName: this.agent.getName(),
        result: '',
        success: false,
        timestamp: new Date(),
        error: `No [AGENT: ${this.agent.getName()}] section found in user query`
      };
    }

    console.log(`📝 Extracted task for ${this.agent.getName()}`);

    // Clear previous context
    this.agent.deleteContext();

    // Set context with task
    this.agent.receiveContext({ 'YOUR TASK': conversationContext });

    // Note: The data analysis summary should already be in the agent's context
    // from DataSummarizingProcess or set by SagaCoordinator

    // Execute agent to generate D3 code
   // const result = await this.agent.execute({});
     const result: AgentResult = {
      agentName: 'cycle_start',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };

    // Store D3 code result
    this.contextManager.updateContext(this.agent.getName(), {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    console.log(`✅ D3.js code generated`);
    console.log(`📄 Code preview: ${result.result.substring(0, 200)}...`);

    return result;
  }

  /**
   * Parse conversation result to extract content for a specific agent
   */
  private parseConversationResultForAgent(conversationResult: any, agentName: string): string {
    try {
      let resultText = '';
      if (typeof conversationResult === 'string') {
        resultText = conversationResult;
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        return '';
      }

      const startTagPattern = new RegExp(`\\[AGENT:\\s*${agentName}(?:,\\s*[^\\]]+)?\\]`);
      const endTag = `[/AGENT]`;

      const startTagMatch = resultText.match(startTagPattern);
      let startIndex = -1;
      let startTagLength = 0;

      if (startTagMatch) {
        startIndex = startTagMatch.index!;
        startTagLength = startTagMatch[0].length;
      } else {
        return '';
      }

      const endIndex = resultText.indexOf(endTag, startIndex);

      if (startIndex !== -1 && endIndex !== -1) {
        let content = resultText.substring(startIndex + startTagLength, endIndex).trim();
        content = content.replace(/^\d+\.\s*/, '').replace(/^\./, '').trim();
        return content;
      }

      return '';
    } catch (error) {
      console.warn(`Failed to parse for agent ${agentName}:`, error);
      return '';
    }
  }

  /**
   * Get the D3 code result
   */
  getD3Code(): string | null {
    const ctx = this.contextManager.getContext(this.agent.getName());
    return ctx?.lastTransactionResult || null;
  }
}