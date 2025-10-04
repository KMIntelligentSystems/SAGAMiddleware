// DefineGenericAgentsProcess - Executes a default agent to define new agents
// Used for agents like TransactionGroupingAgent, VisualizationCoordinatingAgent, D3JSCoordinatingAgent

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult } from '../types/index.js';
import { groupingAgentFailedResult, groupingAgentResult, visualizationGroupingAgentsResult, graphAnalyzerResult_1 } from '../test/testData.js'

/**
 * DefineGenericAgentsProcess
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
export class DefineGenericAgentsProcess {
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
   * Execute the process
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🎯 DefineGenericAgentsProcess: Executing ${this.agent.getName()}`);

  const taskDescription = `Your role is coordinator. You will receive instructions which will indicate your specific task 
  and the output from thinking through the task to provide meaningful instructions for other agents to 
  enable them to execute their tasks`;

   
    // Parse user query to extract this agent's task
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

    console.log(`📝 Extracted task for ${this.agent.getName()} (${conversationContext.length} chars)`);

    // Clear previous context
    this.agent.deleteContext();
    this.agent.setTaskDescription(taskDescription);
    // Set new context
    this.agent.receiveContext({ 'YOUR TASK': conversationContext });
console.log('CONVERSATION ',conversationContext )
    // Execute agent

   
   let result: AgentResult = {
      agentName: 'cycle_start',
      result: '',//visualizationGroupingAgentsResult groupingAgentResult,groupingAgentFailedResult,
      success: true,
      timestamp: new Date()
    };

    if(this.agent.getName() === 'TransactionGroupingAgent'){
     //  const result = await this.agent.execute({});
     // console.log('DEFINE AGENT ', result.result)
     result.result = groupingAgentResult
    } else if(this.agent.getName() === 'VisualizationCoordinatingAgent'){
     result.result = visualizationGroupingAgentsResult;
    } else if(this.agent.getName() === 'D3JSCoordinatingAgent'){
     result.result = graphAnalyzerResult_1;
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
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        return '';
      }

      // Extract content between bracket tags for this agent
      const startTagPattern = new RegExp(`\\[AGENT:\\s*${agentName}(?:,\\s*[^\\]]+)?\\]`);
      const endTag = `[/AGENT]`;

      const startTagMatch = resultText.match(startTagPattern);
      let startIndex = -1;
      let startTagLength = 0;

      if (startTagMatch) {
        startIndex = startTagMatch.index!;
        startTagLength = startTagMatch[0].length;
      } else {
        console.log(`🔍 No [AGENT: ${agentName}] tag found`);
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
   * Get the agent being executed
   */
  getAgent(): GenericAgent {
    return this.agent;
  }
}