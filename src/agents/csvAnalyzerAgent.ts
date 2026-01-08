/**
 * CSVAnalyzerAgent
 *
 * Simple SDK agent that reads a CSV file and returns statistical analysis.
 * Runs BEFORE PromptGeneratorAgent to provide data context.
 *
 * Much more efficient than using a subagent (40 turns → ~5 turns)
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { ContextManager } from '../sublayers/contextManager.js';
import { WorkflowRequirements }  from '../types/dag.js'

export class CSVAnalyzerAgent extends BaseSDKAgent {
    private requirements: WorkflowRequirements;

    constructor( requirements: WorkflowRequirements, contextManager: ContextManager) {
        super('CSVAnalyzerAgent', 10, contextManager);
        this.requirements = requirements;
    }

    /**
     * Execute CSV analysis
     */
    async execute(_input?: any): Promise<AgentResult> {
        try {
            console.log('\n📊 CSVAnalyzerAgent: Analyzing CSV file...');

        //    const result = this.contextManager.getContext('CSVAnalyzerAgent') as WorkingMemory
       //     const prompt = this.buildPrompt(result.lastTransactionResult);
            const analysis = await this.executeQuery(null);

            // Store analysis in context
            this.setContext(analysis);

            return {
                agentName: 'CSVAnalyzerAgent',
                success: true,
                result: analysis,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ CSV Analyzer error:', error);
            return {
                agentName: 'CSVAnalyzerAgent',
                result: null,
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Build prompt for CSV analysis
     */
    protected buildPrompt(_input: any): string {
        return `You are a CSV data profiler. Read the CSV file and report statistical characteristics.
Preliminary task:
In ${this.requirements} you will find a dag defintion. In the "inputData" you will find relevant information such as the source CSV file. You need only examine the first agent in the tree. Its task description
will give you a brief description of the type of graphical display is required.
Your task:
1. Read the CSV file
2. Calculate basic statistics: row count, column names/types, value ranges
3. For numeric columns: calculate min, max, mean, median, quartiles, outliers
4. Report distribution characteristics (normal/skewed/uniform)

Respond in this format:

Dataset Analysis:
- File: [path]
- Rows: [count]
- Columns: [list with data types]
- Value Ranges: [min-max for each numeric column]
- Distribution: [describe distribution, note outliers with thresholds]
- Key Statistics: [mean, median, std, percentiles for numeric data]

Be concise and factual. Focus on information useful for designing data analysis workflows.`;
    }


}
