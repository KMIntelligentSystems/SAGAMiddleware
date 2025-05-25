import { AgentDefinition, AgentResult, LLMConfig } from '../types';

export class GenericAgent {
  constructor(private definition: AgentDefinition) {}

  getName(): string {
    return this.definition.name;
  }

  getDependencies(): string[] {
    return this.definition.dependencies.map(dep => dep.agentName);
  }

  getRequiredDependencies(): string[] {
    return this.definition.dependencies
      .filter(dep => dep.required)
      .map(dep => dep.agentName);
  }

  async execute(contextData: Record<string, any> = {}): Promise<AgentResult> {
    const startTime = new Date();
    
    try {
      const prompt = this.buildPrompt(contextData);
      const llmResult = await this.invokeLLM(prompt);
      
      const result = this.parseOutput(llmResult);
      
      return {
        agentName: this.definition.name,
        result,
        success: true,
        timestamp: startTime
      };
    } catch (error) {
      return {
        agentName: this.definition.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  private buildPrompt(contextData: Record<string, any>): string {
    const baseContext = { ...this.definition.context, ...contextData };
    
    let prompt = `Task: ${this.definition.task}\n\n`;
    
    if (Object.keys(baseContext).length > 0) {
      prompt += `Context:\n`;
      for (const [key, value] of Object.entries(baseContext)) {
        prompt += `${key}: ${JSON.stringify(value)}\n`;
      }
      prompt += '\n';
    }

    if (this.definition.expectedOutput) {
      prompt += `Expected Output Format:\n${JSON.stringify(this.definition.expectedOutput, null, 2)}\n\n`;
    }

    prompt += `Please complete the task and provide the response in the expected format.`;
    
    return prompt;
  }

  private async invokeLLM(prompt: string): Promise<string> {
    const config = this.definition.llmConfig;
    
    switch (config.provider) {
      case 'openai':
        return await this.invokeOpenAI(prompt, config);
      case 'anthropic':
        return await this.invokeAnthropic(prompt, config);
      case 'deepseek':
        return await this.invokeDeepSeek(prompt, config);
      case 'ollama':
        return await this.invokeOllama(prompt, config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  private async invokeOpenAI(prompt: string, config: LLMConfig): Promise<string> {
    const { ChatOpenAI } = await import('@langchain/openai');
    
    const llm = new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000
    });

    const response = await llm.invoke(prompt);
    return response.content as string;
  }

  private async invokeAnthropic(prompt: string, config: LLMConfig): Promise<string> {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    
    const llm = new ChatAnthropic({
      model: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000
    });

    const response = await llm.invoke(prompt);
    return response.content as string;
  }

  private async invokeDeepSeek(prompt: string, config: LLMConfig): Promise<string> {
    const { ChatDeepSeek } = await import('@langchain/deepseek');
    
    const llm = new ChatDeepSeek({
      model: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000
    });

    const response = await llm.invoke(prompt);
    return response.content as string;
  }

  private async invokeOllama(prompt: string, config: LLMConfig): Promise<string> {
    const { ChatOllama } = await import('@langchain/ollama');
    
    const llm = new ChatOllama({
      model: config.model,
      temperature: config.temperature || 0.7
    });

    const response = await llm.invoke(prompt);
    return response.content as string;
  }

  private parseOutput(llmResponse: string): any {
    try {
      const jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      const codeBlockMatch = llmResponse.match(/```\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      return JSON.parse(llmResponse);
    } catch {
      return { raw: llmResponse };
    }
  }
}