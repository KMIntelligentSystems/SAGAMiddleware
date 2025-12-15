// D3JSCodingProcess - Executes D3JSCodingAgent to generate D3.js visualization code
// Similar to DefineUserRequirementsProcess but specific to D3 coding

import { GenericAgent } from '../agents/genericAgent.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { D3JSCoordinatingAgentAnalysis, histogramInterpretationPrompt, histogramValidationPrompt, intermedateAnalysis, histogramValidationPrompt_1, analysisFixPrompt, MCPPythonCoderResultPrompt } from '../types/visualizationSaga.js'
import { D3CodeInput } from '../agents/d3jsCodeGenerator.js'
import { d3jsCoordinatingAgentResultforCodeGenerator } from '../test//testData.js'
//import { geminiAnalysisSummary } from '../test/histogramData.js'

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
  private previousResult: any;
  private targetAgentName: string;
  private lastControlFlowResult: any;

  constructor(
    agent: GenericAgent,
    contextManager: ContextManager,
    userQuery: string,
    targetAgentName: string,

  ) {
    this.agent = agent;
    this.contextManager = contextManager;
    this.targetAgentName = targetAgentName;

    // Parse userQuery which may be a composite JSON string { input, previousResult }
    try {
      const parsed = JSON.parse(userQuery);
      if (parsed.input && parsed.previousResult !== undefined) {
        // It's a composite input from Priority 2
        this.userQuery = parsed.input;
        this.previousResult = parsed.userQuery;
        console.log('📦 Parsed composite input with previous result');
      } else {
        // It's a simple string input
        this.userQuery = userQuery;
        this.previousResult = null;
      }
    } catch (e) {
      // Not JSON, treat as simple string
      this.userQuery = userQuery;
      this.previousResult = null;
    }

    console.log('USER QUERY ', this.userQuery)

    // Get previous control flow result from context manager
    this.lastControlFlowResult = this.contextManager.getContext('PREVIOUS_CONTROL_FLOW');
  }

  /**
   * Execute D3 coding
   */
  async execute(): Promise<AgentResult> {

    console.log(`\n🎨 D3JSCodingProcess: Generating D3.js code with ${this.agent.getName()}`);
    // Parse user query to extract D3JSCodingAgent's task
  /*  const conversationContext = this.parseConversationResultForAgent(
      this.userQuery,
      this.agent.getName())

         console.log('LASTT',  this.previousResult)
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
    }*/
 let result: AgentResult = {
      agentName: 'cycle_start',
      result: 'TEST',
      success: true,
      timestamp: new Date()
    };
    console.log(`📝 Extracted task for ${this.agent.getName()}`);
    console.log('LAST CONTROL FLOW RESULT',this.lastControlFlowResult )//user requirements + file path

    if(this.targetAgentName === 'D3JSCodeGenerator'){
      console.log('D3 JS CODE PROCESS AGENT', this.agent.getName())
          const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
          console.log('CONTECT LAST TRANS RES', ctx.lastTransactionResult.substring(0,200))//esult: '"[MCP-SERVER] Loaded DataFrame as: _loaded_df - shape=(338, 4)\r\nC:/repos/SAGAMiddleware/data/processed_hourly.csv"',
           this.agent.deleteContext();
          this.agent.setTaskDescription(D3JSCoordinatingAgentAnalysis);
      //    this.agent.receiveContext({ 'REQUIREMENT: ' :conversationContext});
          this.agent.receiveContext({ 'LAST CONTROL FLOW RESULT: ' :this.lastControlFlowResult }); 
      //    const finalResult = {data: ctx.lastTransactionResult, userRequirements: conversationContext}
      /*    this.contextManager.updateContext(this.targetAgentName, {
            lastTransactionResult: finalResult
          })*/
    } else if (this.targetAgentName === 'D3JSCodeValidator'){
         const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
         const codeResult = ctx.lastTransactionResult
          this.contextManager.updateContext(this.targetAgentName, {
            lastTransactionResult: codeResult
          })
    } else if (this.targetAgentName === 'D3JSCodeUpdater'){
         const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
         console.log('CONVERSATION AGENT CTX ',  ctx.lastTransactionResult)
         const input = {existingCode: ctx.lastTransactionResult.d3jsOutput, userComment: ctx.userComment}
         this.contextManager.updateContext(this.targetAgentName, {
          lastTransactionResult: input
         })
        //  result.result = d3jsCoordinatingAgentResultforCodeGenerator;// await this.agent.execute({}) as AgentResult;  analysisFixPrompt
    } else if (this.targetAgentName === 'D3JSCoordinatingAgent'){
         const ctx = this.contextManager.getContext(this.targetAgentName) as WorkingMemory;
         console.log('COORDINATING AGENT AGENT CTX VALIDATION',  ctx.lastTransactionResult);
         this.agent.setTaskDescription(analysisFixPrompt);
         result = await this.agent.execute(ctx.lastTransactionResult);
         const agentCtx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
         agentCtx.lastTransactionResult.python_analysis = ctx.lastTransactionResult;
         this.contextManager.updateContext(this.agent.getName(), {
          lastTransactionResult: agentCtx.lastTransactionResult
         })
        //  result.result = d3jsCoordinatingAgentResultforCodeGenerator;// await this.agent.execute({}) as AgentResult;
    }else if (this.targetAgentName === 'D3JSCodingAgent'){
      //MCPPythonCoderResultPrompt
      console.log('D3 JS COOOODING  ', this.agent.getName())
         const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
           console.log('HERE IN COOOODING',JSON.stringify(ctx.lastTransactionResult))
         result = await this.agent.execute({ 'USER QUERY: ': this.userQuery,'DATA TO ANALYZE: ' :ctx.lastTransactionResult }); 
          this.contextManager.updateContext(this.targetAgentName, {
            lastTransactionResult: { 'USER QUERY: ': this.userQuery,'DATA TO ANALYZE: ' :ctx.lastTransactionResult }
          })
    } else if (this.targetAgentName === 'ValidatingAgent'){
      console.log('VAAAALDDDATION   ', this.agent.getName())//D3JSCodingAgent
            const ctx = this.contextManager.getContext(this.agent.getName()) as WorkingMemory;
      //      console.log('HERE IN VAAAAAL',JSON.stringify(ctx.lastTransactionResult))//1.
           this.agent.deleteContext();
           if(this.agent.getName() === 'D3JSCodingAgent'){
           
                const task = this.agent.getAgentDefinition().taskDescription;
                if(task === histogramInterpretationPrompt){
                    this.agent.setTaskDescription(histogramValidationPrompt/*intermedateAnalysishi stogramValidationPrompt*/);
                    result.result = fs.readFileSync('C:/repos/SAGAMiddleware/data/opus.html', 'utf-8');// await this.agent.execute(ctx.lastTransactionResult); 
                }else {
                    this.agent.setTaskDescription(histogramInterpretationPrompt);
                    result =  await this.agent.execute({ 'FILE ANALYSIS: ': ctx.lastTransactionResult.data_analysis,'PYTHON ANALYSIS: ' :ctx.lastTransactionResult.python_analysis }); 
                }

           }

            this.contextManager.updateContext(this.targetAgentName, {
            lastTransactionResult: result.result,
            previousTransactionResult: ctx.lastTransactionResult.python_analysis
          })
    }
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
      } else if (conversationResult.message) {
        // Handle JSON object with message property (e.g., { threadId, message })
        resultText = conversationResult.message;
      } else if (conversationResult.result) {
        resultText = conversationResult.result;
      } else {
        return '';
      }

      // Updated regex to handle both formats:
      // [AGENT: agentName id] or [AGENT:agentName id] (with or without space after colon)
      const startTagPattern = new RegExp(`\\[AGENT:\\s*${agentName}(?:[,\\s]+[^\\]]+)?\\]`, 'i');
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

    // Replace d3.csv absolute paths with just the filename
    // Handles both Unix (/path/to/file.csv) and Windows (C:/path/to/file.csv) paths
    cleaned = cleaned.replace(
      /d3\.csv\(['"](?:[A-Z]:)?[\/\\]?[^'"]*[\/\\]([^\/\\'"]+\.csv)['"]/gi,
      "d3.csv('$1'"
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
   * Extract code and report from agent result
   * @param agentResult - Result from D3 coding agent containing JSON with 'CODE REPORT' and 'CODE'
   * @returns Object with cleaned code and report, or null if parsing fails
   */
  private extractCodeAndReport(agentResult: any): { code: string; report: string } | null {
    try {
      let resultData = agentResult;

      console.log('📊 Extracting code and report from agent result...');
      console.log('Type:', typeof agentResult);

      // If result is a string, try to parse it
      if (typeof agentResult === 'string') {
        console.log('String preview:', agentResult.substring(0, 200));

        // Try JSON.parse first (proper JSON format)
        try {
          resultData = JSON.parse(agentResult);
          console.log('✓ Parsed with JSON.parse');
        } catch (e1) {
          // Try to extract using string parsing for Python-style dict with nested content
          try {
            // Find the positions of the keys
            const reportKeyIndex = agentResult.indexOf("'CODE REPORT'");
            const codeKeyIndex = agentResult.indexOf("'CODE'", reportKeyIndex + 1);

            if (reportKeyIndex === -1 || codeKeyIndex === -1) {
              throw new Error('Could not find CODE REPORT or CODE keys');
            }

            // Extract CODE REPORT value (between first ':' after key and comma before 'CODE')
            const reportStart = agentResult.indexOf("'", reportKeyIndex + "'CODE REPORT'".length + 1) + 1;
            const reportEnd = agentResult.lastIndexOf("'", codeKeyIndex - 2);
            const report = agentResult.substring(reportStart, reportEnd);

            // Extract CODE value (between first ':' after key and closing '}')
            const codeStart = agentResult.indexOf("'", codeKeyIndex + "'CODE'".length + 1) + 1;
            const codeEnd = agentResult.lastIndexOf("'");
            const code = agentResult.substring(codeStart, codeEnd);

            resultData = {
              'CODE REPORT': report,
              'CODE': code
            };
            console.log('✓ Parsed with string extraction');
          } catch (e2) {
            // Try eval as last resort
            try {
              resultData = eval('(' + agentResult + ')');
              console.log('✓ Parsed with eval');
            } catch (e3) {
              console.warn('Could not parse agent result as object');
              console.error('Parse errors:', {
                json: e1 instanceof Error ? e1.message : String(e1),
                regex: e2 instanceof Error ? e2.message : String(e2),
                eval: e3 instanceof Error ? e3.message : String(e3)
              });
              return null;
            }
          }
        }
      }

      console.log('Parsed resultData keys:', Object.keys(resultData));

      // Extract CODE REPORT and CODE from the result (try multiple key variations)
      const report = resultData['CODE REPORT'] || resultData['CODE_REPORT'] || resultData['code_report'] || resultData.report || '';
      const rawCode = resultData['CODE'] || resultData['code'] || '';

      console.log('Found report:', report ? `Yes (${report.length} chars)` : 'No');
      console.log('Found code:', rawCode ? `Yes (${rawCode.length} chars)` : 'No');

      if (!rawCode) {
        console.warn('❌ No code found in agent result');
        console.log('Available keys:', Object.keys(resultData));
        return null;
      }

      // Clean the code using existing cleanJavaScriptCode method
      const cleanedCode = this.cleanJavaScriptCode(rawCode);

      console.log('✅ Successfully extracted code and report');
      return {
        code: cleanedCode,
        report: report
      };
    } catch (error) {
      console.error('Failed to extract code and report:', error);
      return null;
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