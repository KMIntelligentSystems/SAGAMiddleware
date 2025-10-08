// GenReflectProcess - Reads SVG file and provides it to GeneratingAgent for interpretation
// Uses SVGInterpreterPrompt to analyze SVG structure and semantics

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { SVGInterpreterPrompt } from '../types/visualizationSaga.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GenReflectProcess
 *
 * Executes GeneratingAgent to interpret SVG visualization:
 * - Reads SVG file from disk
 * - Provides SVG content to GeneratingAgent
 * - Uses SVGInterpreterPrompt to guide interpretation
 * - Returns structured analysis of SVG elements
 *
 * Pattern:
 * 1. Read SVG file from provided path
 * 2. Set SVGInterpreterPrompt as task description
 * 3. Provide SVG content to agent
 * 4. Execute agent to analyze SVG
 * 5. Store analysis result in context
 */
export class GenReflectProcess {
  private agent: GenericAgent;
  private contextManager: ContextManager;
  private svgFilePath: string;
  private targetAgentName = 'ValidatingAgent';
  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    svgFilePath: string,

  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.svgFilePath = svgFilePath;

  }

  /**
   * Execute SVG reflection/interpretation
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🔍 GenReflectProcess: Analyzing SVG with ${this.agent.getName()}`);
    console.log(`📄 SVG file: ${this.svgFilePath}`);

    // Read SVG file
    let svgContent: string;
    try {
      if (!fs.existsSync(this.svgFilePath)) {
        console.error(`❌ SVG file not found: ${this.svgFilePath}`);
        return {
          agentName: this.agent.getName(),
          result: '',
          success: false,
          timestamp: new Date(),
          error: `SVG file not found: ${this.svgFilePath}`
        };
      }

      svgContent = fs.readFileSync(this.svgFilePath, 'utf-8');
      console.log(`✅ Loaded SVG content (${svgContent.length} bytes)`);
    } catch (error) {
      console.error(`❌ Error reading SVG file:`, error);
      return {
        agentName: this.agent.getName(),
        result: '',
        success: false,
        timestamp: new Date(),
        error: `Failed to read SVG file: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // Set SVGInterpreterPrompt as task description
    this.agent.setTaskDescription(SVGInterpreterPrompt);
    console.log(`📋 Set task description: SVGInterpreterPrompt`);

    // Clear previous context
    this.agent.deleteContext();

    // Provide SVG content to agent
    this.agent.receiveContext({
      'SVG_CONTENT': svgContent,
      'SVG_FILE_PATH': this.svgFilePath,
      'INSTRUCTION': 'Analyze the SVG elements and provide structured interpretation'
    });

    console.log(`🤖 Executing ${this.agent.getName()} to interpret SVG...`);

    // Execute agent to analyze SVG
    const result = await this.agent.execute({}) as AgentResult;
console.log('GEN RESULT', result.result)
    if (result.success) {
      console.log(`✅ SVG analysis completed`);
      console.log(`📊 Analysis preview: ${String(result.result).substring(0, 200)}...`);

      // Store analysis result in context
      this.contextManager.updateContext(this.targetAgentName, {
        lastTransactionResult: result.result,
        svgAnalysis: result.result,
        svgFilePath: this.svgFilePath,
        transactionId: this.agent.getId(),
        timestamp: new Date()
      });

      this.contextManager.updateContext(this.agent.getName(), {
        lastTransactionResult: result.result,
        svgAnalysis: result.result,
        transactionId: this.agent.getId(),
        timestamp: new Date()
      });
    } else {
      console.error(`❌ SVG analysis failed`);
    }

    return result;
  }
}
