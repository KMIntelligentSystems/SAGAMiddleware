// DefineUserRequirementsProcess - Executes a default agent to define new agents
// Used for agents like TransactionGroupingAgent, VisualizationCoordinatingAgent, D3JSCoordinatingAgent

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult } from '../types/index.js';
import { groupingAgentFailedResult, groupingAgentResult, visualizationGroupingAgentsResult, graphAnalyzerResult_1, d3jsCodeUpdateResult, userRequirementsResultJSON } from '../test/testData.js'
import { dataValidatingAgentPrompt, userRequestPrompt } from '../types/visualizationSaga.js'

/**
 * DefineUserRequirementsProcess
 *
 * Executes a default agent (singleton) to create agent definitions.
 * The agent receives its task extracted from the user query via parseConversationResultForAgent.
 *
 * Pattern:
 * 1. Parse user query to extract agent's task
 * 2. Clear agent context
 * 3. Set agent context with extracted task
 * 4. Execute agent
 * 5. Store result in contextManager
 *
 * Can create:
 * - Singleton agents (single agent definition)
 * - Multiple agents (e.g., Python coder + tool caller)
 */
export class DefineUserRequirementsProcess {
  private agent: GenericAgent;
  private contextManager: ContextManager;
  private userQuery: string;
  private targetAgent?: string
  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string,
    targetAgent?: string
  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
    this.targetAgent = targetAgent;
  }

  /**
   * Execute the process
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🎯 DefineUserRequirementsProcess: Executing ${this.agent.getName()}`);

 
console.log('DEFINE ', this.userQuery)
    // Parse user query to extract this agent's task
  


console.log('CONVERSATION ',this.userQuery )
    // Execute agent

   
   let result: AgentResult = {
      agentName: 'cycle_start',
      result: '',//visualizationGroupingAgentsResult groupingAgentResult,groupingAgentFailedResult,
      success: true,
      timestamp: new Date()
    };
 
    if(this.agent.getName() === 'TransactionGroupingAgent'){
      // NEW APPROACH: Pass the complete conversation context as workflowDescription
      // The DataProfiler will extract filepath and analyze the workflow itself
      console.log('📝 Passing complete workflow description to DataProfiler');

      // Create DataProfileInput with the complete workflow description
      const workflowInput = {
        workflowDescription: this.userQuery  // Complete workflow plan like claudeMDResuilt
      };

      result.result = workflowInput;
      console.log('🔍 Created workflowInput:', JSON.stringify(workflowInput, null, 2).substring(0, 300) + '...');

      if(this.targetAgent){
          this.contextManager.updateContext(this.targetAgent, {//DataProfiler
          lastTransactionResult: result.result,
          transactionId: this.agent.getId(),
           timestamp: new Date()
      })
      }

    } else if(this.agent.getName() === 'AgentStructureGenerator'){
      if(this.targetAgent){
          this.contextManager.updateContext(this.targetAgent, {
          lastTransactionResult: JSON.stringify( this.userQuery),
          transactionId: this.agent.getId(),
           timestamp: new Date()
      })
      }
    } else if(this.agent.getName() === 'D3JSCoordinatingAgent'){
     result.result =JSON.stringify( this.userQuery);//graphAnalyzerResult_1;
         
    } 
   
    // Store result in context manager
    this.contextManager.updateContext(this.agent.getName(), {
      lastTransactionResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

    console.log(`✅ ${this.agent.getName()} completed`);
 //   console.log(`📄 Result preview: ${result.result.substring(0, 200)}...`);

    return result;
  }

  /**
   * Parse conversation result to extract content for a specific agent
   * Extracts content between [AGENT: agentName, id]...[/AGENT] tags
   */
  private parseConversationResultForAgent(conversationResult: any, agentName: string): string {
    try {
      let resultText = '';
      if (typeof conversationResult === 'string') {
        resultText = conversationResult;
      } else if (conversationResult.message) {
        // Handle JSON object with message property (e.g., { threadId, message })
        resultText = conversationResult.message;
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        console.log(`⚠️  Conversation result format not recognized:`, conversationResult);
        return '';
      }

      // Extract content between bracket tags for this agent
      // Updated regex to handle both formats:
      // [AGENT: agentName id] or [AGENT:agentName id] (with or without space after colon)
      // Also allows comma or space separation: [AGENT: agentName, id] or [AGENT:agentName id]
      const startTagPattern = new RegExp(`\\[AGENT:\\s*${agentName}(?:[,\\s]+[^\\]]+)?\\]`, 'i');
      const endTag = `[/AGENT]`;

      const startTagMatch = resultText.match(startTagPattern);
      let startIndex = -1;
      let startTagLength = 0;

      if (startTagMatch) {
        startIndex = startTagMatch.index!;
        startTagLength = startTagMatch[0].length;
        console.log(`✅ Found opening tag: "${startTagMatch[0]}" at index ${startIndex}`);
      } else {
        console.log(`🔍 No [AGENT: ${agentName}] tag found in text:`);
        console.log(`   Text preview: ${resultText.substring(0, 200)}...`);
        console.log(`   Pattern used: ${startTagPattern}`);
        return '';
      }

      const endIndex = resultText.indexOf(endTag, startIndex);

      if (startIndex !== -1 && endIndex !== -1) {
        console.log(`✅ Found closing tag at index ${endIndex}`);
        let content = resultText.substring(startIndex + startTagLength, endIndex).trim();
        console.log(`📝 Extracted content (${content.length} chars): ${content.substring(0, 100)}...`);
        content = content.replace(/^\d+\.\s*/, '').replace(/^\./, '').trim();
        return content;
      } else {
        console.log(`❌ Closing tag [/AGENT] not found after index ${startIndex}`);
        console.log(`   Remaining text: ${resultText.substring(startIndex, startIndex + 300)}...`);
      }

      return '';
    } catch (error) {
      console.warn(`Failed to parse for agent ${agentName}:`, error);
      return '';
    }
  }

  /**
   * Get the agent being executed
   */
  getAgent(): GenericAgent {
    return this.agent;
  }
}