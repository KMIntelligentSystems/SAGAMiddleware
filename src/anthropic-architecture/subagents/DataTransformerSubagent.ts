/**
 * Data Transformer Subagent
 *
 * Stateless subagent that executes data transformations using Python via MCP
 */

import { BaseSubagent } from './BaseSubagent.js';
import { SubagentTask, SubagentResult, DataTransformationSpec, DataTransformationResult } from '../types/index.js';

export class DataTransformerSubagent extends BaseSubagent {
  async executeTask(task: SubagentTask): Promise<SubagentResult> {
    const startTime = Date.now();

    try {
      const spec: DataTransformationSpec = task.input;

      if (!spec.sourceFile || !spec.operations || !spec.outputFile) {
        throw new Error('Invalid transformation spec: sourceFile, operations, and outputFile are required');
      }

      console.log(`   🔄 Transforming data: ${spec.sourceFile} -> ${spec.outputFile}`);
      console.log(`   📝 Operations: ${spec.operations.map(op => op.type).join(', ')}`);

      // Generate Python code for transformation
      const pythonCode = await this.generateTransformationCode(spec);

      console.log(`   🐍 Generated Python code (${pythonCode.length} chars)`);

      // Execute Python code via MCP
      const executionResult = await this.executeMCPTool(
        'execution-server',
        'execute_python',
        { code: pythonCode }
      );

      console.log(`   📊 Python execution result:`, executionResult);

      // Parse result
      if (executionResult.error) {
        throw new Error(`Python execution failed: ${executionResult.error}`);
      }

      // Extract summary statistics from output
      const result: DataTransformationResult = {
        outputFile: spec.outputFile,
        rowsProcessed: executionResult.rowsProcessed || 0,
        rowsOutput: executionResult.rowsOutput || 0,
        summary: executionResult.summary || {}
      };

      console.log(`   ✅ Transformation complete: ${result.rowsOutput} rows output`);

      return this.createSuccessResult(
        task.taskId,
        result,
        Date.now() - startTime,
        { pythonCode, executionResult }
      );
    } catch (error) {
      console.error('   ❌ Data transformation failed:', error);
      return this.createFailureResult(
        task.taskId,
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }

  /**
   * Generate Python code for data transformation
   */
  private async generateTransformationCode(spec: DataTransformationSpec): Promise<string> {
    const codeGenPrompt = `Generate Python code using pandas to perform the following data transformation:

Source File: ${spec.sourceFile}
Output File: ${spec.outputFile}

Operations to perform:
${spec.operations.map((op, idx) => `${idx + 1}. ${op.type}: ${JSON.stringify(op.parameters)}`).join('\n')}

Requirements:
1. Use pandas to read the CSV file
2. Perform each operation in sequence
3. Save the result to the output file
4. Print summary statistics (min, max, mean for numeric columns, categories for categorical)
5. Print rowsProcessed and rowsOutput counts

Respond with Python code only, no explanations or markdown.`;

    const response = await this.callLLM(codeGenPrompt);

    // Extract code (remove markdown if present)
    let code = response.content;
    const codeBlockMatch = code.match(/```(?:python)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    return code.trim();
  }
}
