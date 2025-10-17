/**
 * Schema Analyzer Subagent
 *
 * Stateless subagent that analyzes CSV file structure and infers schema
 */

import { BaseSubagent } from './BaseSubagent.js';
import { SubagentTask, SubagentResult, SchemaAnalysisResult } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

export class SchemaAnalyzerSubagent extends BaseSubagent {
  async executeTask(task: SubagentTask): Promise<SubagentResult> {
    const startTime = Date.now();

    try {
      const { filePath, sampleSize = 100 } = task.input;

      if (!filePath) {
        throw new Error('filePath is required in task input');
      }

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      console.log(`   📊 Analyzing schema for: ${filePath}`);

      // Read file content (first N rows for sampling)
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim().length > 0);

      if (lines.length === 0) {
        throw new Error('File is empty');
      }

      // Extract header
      const header = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
      const sampleData = lines.slice(1, Math.min(sampleSize + 1, lines.length))
        .map(line => line.split(',').map(v => v.trim().replace(/['"]/g, '')));

      // Build analysis prompt for LLM
      const analysisPrompt = `Analyze the following CSV data and infer the schema.

Header: ${header.join(', ')}

Sample rows (showing first 10):
${sampleData.slice(0, 10).map((row, idx) => `Row ${idx + 1}: ${row.join(', ')}`).join('\n')}

Total rows in file: ${lines.length - 1}

For each column, determine:
1. Data type: numeric, categorical, datetime, text, or unknown
2. Whether it can be null (based on sample)
3. Approximate unique count (estimate from sample)
4. Sample values (3-5 representative values)

Also identify potential relationships:
- Temporal columns (dates/times for time-series analysis)
- Categorical groupings (columns that could group data)
- Numeric ranges (columns suitable for aggregation)

Respond with JSON:
{
  "columns": [
    {
      "name": "column_name",
      "type": "numeric|categorical|datetime|text|unknown",
      "nullable": true|false,
      "uniqueCount": estimated_count,
      "sampleValues": ["val1", "val2", "val3"]
    }
  ],
  "rowCount": total_rows,
  "filePath": "path",
  "inferredRelationships": [
    {
      "column": "column_name",
      "relationType": "temporal|categorical_group|numeric_range",
      "description": "brief description"
    }
  ]
}`;

      const response = await this.callLLM(analysisPrompt);
      const schemaAnalysis: SchemaAnalysisResult = JSON.parse(
        this.extractJson(response.content)
      );

      // Ensure filePath and rowCount are set correctly
      schemaAnalysis.filePath = filePath;
      schemaAnalysis.rowCount = lines.length - 1;

      console.log(`   ✅ Schema analysis complete: ${schemaAnalysis.columns.length} columns identified`);

      return this.createSuccessResult(
        task.taskId,
        schemaAnalysis,
        Date.now() - startTime
      );
    } catch (error) {
      console.error('   ❌ Schema analysis failed:', error);
      return this.createFailureResult(
        task.taskId,
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }

  private extractJson(text: string): string {
    // Try to find JSON in markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }

    // Try to find raw JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    throw new Error('No JSON found in response');
  }
}
