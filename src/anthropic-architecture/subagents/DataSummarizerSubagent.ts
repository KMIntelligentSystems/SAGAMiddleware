/**
 * Data Summarizer Subagent
 *
 * Stateless subagent that summarizes data in chunks for visualization planning
 */

import { BaseSubagent } from './BaseSubagent.js';
import { SubagentTask, SubagentResult, DataSummarizationResult } from '../types/index.js';
import * as fs from 'fs';

export class DataSummarizerSubagent extends BaseSubagent {
  async executeTask(task: SubagentTask): Promise<SubagentResult> {
    const startTime = Date.now();

    try {
      const { filePath, chunkSize = 20, purpose = 'visualization_planning' } = task.input;

      if (!filePath) {
        throw new Error('filePath is required in task input');
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      console.log(`   📊 Summarizing data: ${filePath} (chunk size: ${chunkSize})`);

      // Read entire file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
      const header = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
      const dataRows = lines.slice(1).map(line => line.split(',').map(v => v.trim().replace(/['"]/g, '')));

      // Process in chunks and accumulate insights
      const chunkSummaries: string[] = [];
      const totalChunks = Math.ceil(dataRows.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * chunkSize;
        const chunkEnd = Math.min((i + 1) * chunkSize, dataRows.length);
        const chunk = dataRows.slice(chunkStart, chunkEnd);

        console.log(`   🔍 Processing chunk ${i + 1}/${totalChunks} (rows ${chunkStart + 1}-${chunkEnd})`);

        const chunkSummary = await this.summarizeChunk(header, chunk, i + 1, totalChunks, purpose);
        chunkSummaries.push(chunkSummary);
      }

      // Synthesize all chunk summaries into final analysis
      console.log(`   🔄 Synthesizing ${chunkSummaries.length} chunk summaries...`);
      const finalAnalysis = await this.synthesizeChunkSummaries(
        header,
        chunkSummaries,
        dataRows.length,
        purpose
      );

      console.log(`   ✅ Summarization complete`);

      return this.createSuccessResult(
        task.taskId,
        finalAnalysis,
        Date.now() - startTime,
        { chunksProcessed: totalChunks }
      );
    } catch (error) {
      console.error('   ❌ Data summarization failed:', error);
      return this.createFailureResult(
        task.taskId,
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }

  /**
   * Summarize a single chunk of data
   */
  private async summarizeChunk(
    header: string[],
    chunk: string[][],
    chunkNum: number,
    totalChunks: number,
    purpose: string
  ): Promise<string> {
    const chunkPrompt = `Analyze this chunk of CSV data (chunk ${chunkNum}/${totalChunks}):

Header: ${header.join(', ')}

Data (${chunk.length} rows):
${chunk.slice(0, 10).map((row, idx) => `${row.join(', ')}`).join('\n')}
${chunk.length > 10 ? `... (${chunk.length - 10} more rows)` : ''}

Purpose: ${purpose}

Provide a brief summary (2-3 sentences) capturing:
1. Key patterns in this chunk
2. Value ranges for numeric columns
3. Categories present in categorical columns
4. Any temporal patterns if dates are present

Keep it concise and focused on insights useful for ${purpose}.`;

    const response = await this.callLLM(chunkPrompt);
    return response.content;
  }

  /**
   * Synthesize all chunk summaries into final analysis
   */
  private async synthesizeChunkSummaries(
    header: string[],
    chunkSummaries: string[],
    totalRows: number,
    purpose: string
  ): Promise<DataSummarizationResult> {
    const synthesisPrompt = `Synthesize the following chunk-by-chunk data summaries into a final comprehensive analysis.

Header: ${header.join(', ')}
Total Rows: ${totalRows}
Number of Chunks: ${chunkSummaries.length}
Purpose: ${purpose}

Chunk Summaries:
${chunkSummaries.map((summary, idx) => `Chunk ${idx + 1}: ${summary}`).join('\n\n')}

Create a comprehensive analysis that includes:
1. Overall temporal range (if dates present)
2. All unique categories found across chunks
3. Numeric ranges (min, max, mean) for key numeric columns
4. Recommendations for visualization type
5. Natural language summary for a coding agent

Respond with JSON:
{
  "chunksSummarized": ${chunkSummaries.length},
  "totalRows": ${totalRows},
  "summary": {
    "temporalRange": { "start": "...", "end": "..." } or null,
    "categories": ["cat1", "cat2"],
    "numericRanges": {
      "column_name": { "min": 0, "max": 100, "mean": 50 }
    },
    "visualizationRecommendations": ["recommendation1", "recommendation2"]
  },
  "detailedAnalysis": "Natural language summary suitable for a d3.js coding agent..."
}`;

    const response = await this.callLLM(synthesisPrompt);
    const result = JSON.parse(this.extractJson(response.content));

    return result as DataSummarizationResult;
  }

  private extractJson(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    throw new Error('No JSON found in response');
  }
}
