// D3JSCodingProcess - Executes D3JSCodingAgent to generate D3.js visualization code
// Similar to DefineGenericAgentsProcess but specific to D3 coding

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { D3JSCodeCorrectionPrompt } from '../types/visualizationSaga.js'

import * as fs from 'fs'; 
import * as path from 'path';
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
  private targetAgentName: string;
  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string,
     targetAgentName: string
  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.userQuery = userQuery;
    this.targetAgentName = targetAgentName;
  }

  /**
   * Execute D3 coding
   */
  async execute(): Promise<AgentResult> {
    console.log(`\n🎨 D3JSCodingProcess: Generating D3.js code with ${this.agent.getName()}`);

    // Parse user query to extract D3JSCodingAgent's task
    const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.agent.getName())
console.log('CONVERSATION CTX', conversationContext)
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
 let result: AgentResult = {
      agentName: 'cycle_start',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
    console.log(`📝 Extracted task for ${this.agent.getName()}`);
  /*
  1. Code request -> d3jsCoordinator: original code passed use openairesult text
  2.  ValidatingAgent → ValidationProcess -> d3jsCodingAgent : uses svg to check for errors/enhancements 
  The SVG anallysis led to coding agent given the analysis and then outputting updated code but code turns out same as input 
  */
  if(this.targetAgentName === 'ValidatingAgent'){
    const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
     this.agent.setTaskDescription(conversationContext);
     //Add if errors in analysis
 //    this.agent.receiveContext({ 'ANALYSIS: ' :ctx.lastTransactionResult });
     this.agent.receiveContext({ 'CODE: ' :ctx.d3jsCodeResult });
   //  result = await this.agent.execute({}) as AgentResult;
     const code = this.cleanJavaScriptCode( result.result);
   //  fs.writeFileSync('data/codingAgentResult.txt', code, 'utf8');
     const codingResult = fs.readFileSync('data/codingOpenAIAgentResult.txt', 'utf-8');//data/codingOpenAIAgentResult.txt
    result.result = codingResult
   
  } else { 
    //  1. Code request -> d3jsCoordinator: original code passed use openairesult text  
    const ctx = this.contextManager.getContext(this. targetAgentName) as WorkingMemory; // Step 12/12: D3JSCodingAgent → D3JSCodingProcess ->d3jsCoordinatingAgent
    console.log('CODING PROCESS', this.targetAgentName)
     this.agent.setTaskDescription(conversationContext);
    this.agent.receiveContext({ 'INFORMATION TO ASSIST YOU: ' :ctx.dataGuidanceAnalysis});//Info from summarising process in d3jscoordinatingaggent context manager
   // result = await this.agent.execute({}) as AgentResult;
    const codingResult = fs.readFileSync('data/codingAgentResult.txt', 'utf-8');//data/codingOpenAIAgentResult.txt
    result.result = codingResult;//this.cleanJavaScriptCode( codingResult); //
  }



    // Note: The data analysis summary should already be in the agent's context
    // from DataSummarizingProcess or set by SagaCoordinator

    // Execute agent to generate D3 code
   //  result = await this.agent.execute({}) as AgentResult;
//result.result = D3JSAfterSVGResult;
     //   const code = this.cleanJavaScriptCode( result.result);
       //fs.writeFileSync('data/codingAgentResult.txt', code, 'utf8');
    //test codingAgentValidatedResult  codingAgentResult d3.csv('./Output_one_hour_normalized_daily_avg.csv')
      
    

    // Store D3 code result
    this.contextManager.updateContext(this.targetAgentName, {
      d3jsCodeResult: result.result,
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

       this.contextManager.updateContext(this.agent.getName(), {
      lastTransactionResult: result.result,
     d3jsCodeResult: result.result, 
      transactionId: this.agent.getId(),
      timestamp: new Date()
    });

 //   this.agent.setTaskDescription(d3CodeValidatingAgentPrompt); 

    console.log(`✅ D3.js code generated`);
    console.log(`📄 Code preview: ${result.result}`);

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

   private cleanJavaScriptCode(rawCode: any): string {
    let codeToClean = rawCode;

    // If it's a string that looks like JavaScript object literal, try to evaluate it
    if (typeof rawCode === 'string' && rawCode.trim().startsWith('{')) {
      try {
        // Safely evaluate the JavaScript object literal
        const evaluated = eval('(' + rawCode + ')');
        if (evaluated && typeof evaluated === 'object' && 'result' in evaluated) {
          codeToClean = evaluated.result;
        }
      } catch (e) {
        console.warn('Could not evaluate JavaScript object literal, treating as raw string');
        codeToClean = rawCode;
      }
    }
    // Handle object with result property (like d3jsCodeResult structure)
    else if (typeof rawCode === 'object' && rawCode !== null && 'result' in rawCode) {
      codeToClean = rawCode.result;
    }

    // Type safety check
    if (!codeToClean || typeof codeToClean !== 'string') {
      console.warn('cleanJavaScriptCode received non-string input:', typeof codeToClean, codeToClean);
      return typeof codeToClean === 'object' ? JSON.stringify(codeToClean) : String(codeToClean || '');
    }

    // Handle JavaScript-style concatenated strings with + operators
    let cleaned = codeToClean
      // Remove string concatenation operators and newlines
      .replace(/'\s*\+\s*$/gm, '')
      .replace(/'\s*\+\s*'/g, '')
      .replace(/"\s*\+\s*$/gm, '')
      .replace(/"\s*\+\s*"/g, '')
      .replace(/`/g, "'")  // Fix backticks to quotes
      // Remove leading/trailing quotes and handle escape sequences
      .replace(/^['"]/, '')
      .replace(/['"]$/, '')
      .replace(/\\n/g, '\n')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');

    // Replace hardcoded file paths with relative paths for browser compatibility
    cleaned = cleaned.replace(
      /const CSV_PATH = ['"'][^'"]*\/([^\/'"]+\.csv)['"];/g,
      "const CSV_PATH = './$1';"
    );

    // Replace d3.csv absolute paths with relative paths
    cleaned = cleaned.replace(
      /d3\.csv\(['"][^'"]*\/([^\/'"]+\.csv)['"]/g,
      "d3.csv('./$1'"
    );

    // Add error handling for missing CSV files
    if (cleaned.includes("d3.csv")) {
      cleaned = cleaned.replace(
        /(d3\.csv\([^)]+\))/g,
        "$1.catch(err => { console.error('CSV file not found:', err); return []; })"
      );
    }

    // Restore template literal placeholders that were escaped for text storage
    // Convert ${/variable} back to ${variable}
  //  cleaned = cleaned.replace(/\$\/\{([^}]+)\}/g, '${$1}');
    
    return cleaned.trim();
  }

  /**
   * Get the D3 code result
   */
  getD3Code(): string | null {
    const ctx = this.contextManager.getContext(this.agent.getName());
    return ctx?.lastTransactionResult || null;
  }
}