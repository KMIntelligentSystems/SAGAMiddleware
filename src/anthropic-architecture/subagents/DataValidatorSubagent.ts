/**
 * Data Validator Subagent
 *
 * Stateless subagent that validates data against rules
 */

import { BaseSubagent } from './BaseSubagent.js';
import { SubagentTask, SubagentResult, DataValidationRules, DataValidationResult } from '../types/index.js';
import * as fs from 'fs';

export class DataValidatorSubagent extends BaseSubagent {
  async executeTask(task: SubagentTask): Promise<SubagentResult> {
    const startTime = Date.now();

    try {
      const { filePath, rules } = task.input as { filePath: string; rules: DataValidationRules };

      if (!filePath || !rules) {
        throw new Error('filePath and rules are required in task input');
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      console.log(`   ✓ Validating data: ${filePath}`);

      // Read file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
      const header = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
      const dataRows = lines.slice(1).map(line => line.split(',').map(v => v.trim().replace(/['"]/g, '')));

      // Perform validation
      const errors: DataValidationResult['errors'] = [];
      const warnings: DataValidationResult['warnings'] = [];

      // 1. Check required columns
      if (rules.requiredColumns) {
        for (const reqCol of rules.requiredColumns) {
          if (!header.includes(reqCol)) {
            errors.push({
              type: 'missing_column',
              column: reqCol,
              message: `Required column '${reqCol}' is missing`
            });
          }
        }
      }

      // 2. Check column types (sample-based)
      if (rules.columnTypes) {
        for (const [column, expectedType] of Object.entries(rules.columnTypes)) {
          const colIndex = header.indexOf(column);
          if (colIndex === -1) continue;

          // Sample first 10 non-empty values
          const samples = dataRows
            .slice(0, 100)
            .map(row => row[colIndex])
            .filter(val => val && val.length > 0)
            .slice(0, 10);

          const actualType = this.inferType(samples);
          if (actualType !== expectedType && actualType !== 'unknown') {
            errors.push({
              type: 'type_mismatch',
              column,
              message: `Column '${column}' expected type '${expectedType}' but found '${actualType}'`
            });
          }
        }
      }

      // 3. Check range constraints
      if (rules.rangeChecks) {
        for (const [column, range] of Object.entries(rules.rangeChecks)) {
          const colIndex = header.indexOf(column);
          if (colIndex === -1) continue;

          let violationCount = 0;
          for (const row of dataRows) {
            const value = parseFloat(row[colIndex]);
            if (isNaN(value)) continue;

            if ((range.min !== undefined && value < range.min) ||
                (range.max !== undefined && value > range.max)) {
              violationCount++;
            }
          }

          if (violationCount > 0) {
            errors.push({
              type: 'range_violation',
              column,
              message: `Column '${column}' has ${violationCount} values outside range [${range.min}, ${range.max}]`,
              affectedRows: violationCount
            });
          }
        }
      }

      // 4. Custom validations (use LLM for complex rules)
      if (rules.customValidations && rules.customValidations.length > 0) {
        const customValidationPrompt = `Validate the following data against custom rules:

Header: ${header.join(', ')}
Sample rows (first 10):
${dataRows.slice(0, 10).map((row, idx) => `Row ${idx + 1}: ${row.join(', ')}`).join('\n')}

Custom validation rules:
${rules.customValidations.map((v, idx) => `${idx + 1}. ${v.rule}`).join('\n')}

For each rule, check if the data violates it. Respond with JSON:
{
  "violations": [
    {
      "ruleIndex": 0,
      "violated": true|false,
      "message": "explanation if violated"
    }
  ]
}`;

        const response = await this.callLLM(customValidationPrompt);
        const customResults = JSON.parse(this.extractJson(response.content));

        for (const violation of customResults.violations) {
          if (violation.violated) {
            errors.push({
              type: 'custom',
              message: `${rules.customValidations![violation.ruleIndex].errorMessage}: ${violation.message}`
            });
          }
        }
      }

      const result: DataValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings
      };

      console.log(`   ${result.isValid ? '✅' : '❌'} Validation ${result.isValid ? 'passed' : 'failed'}: ${errors.length} errors, ${warnings.length} warnings`);

      return this.createSuccessResult(
        task.taskId,
        result,
        Date.now() - startTime
      );
    } catch (error) {
      console.error('   ❌ Data validation failed:', error);
      return this.createFailureResult(
        task.taskId,
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }

  private inferType(samples: string[]): string {
    if (samples.length === 0) return 'unknown';

    // Check if all are numbers
    const allNumeric = samples.every(s => !isNaN(parseFloat(s)));
    if (allNumeric) return 'numeric';

    // Check if datetime pattern
    const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/;
    const allDates = samples.every(s => datePattern.test(s));
    if (allDates) return 'datetime';

    // Check if categorical (small unique set)
    const uniqueCount = new Set(samples).size;
    if (uniqueCount < samples.length * 0.5) return 'categorical';

    return 'text';
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
