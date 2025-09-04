import { SetExecutionResult } from '../types/visualizationSaga';

interface PythonToolResult {
  content: any[];
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  filename: string;
}

interface AnalysisResult {
  isErrorFree: boolean;
  errorDetails?: string;
  message: string;
}

export class PythonLogAnalyzer {
  analyzeExecution(executionResult: SetExecutionResult): AnalysisResult {
    // Search for Python tool results within the SetExecutionResult
    const pythonResult = this.findPythonToolResult(executionResult);
    
    if (!pythonResult) {
      return {
        isErrorFree: false,
        errorDetails: 'No Python tool result found',
        message: 'Error detected: No Python tool result found'
      };
    }

    if (pythonResult.success === true && 
        (!pythonResult.stderr || pythonResult.stderr.trim() === '') &&
        (!pythonResult.error || pythonResult.error.trim() === '')) {
      return {
        isErrorFree: true,
        message: 'Success'
      };
    }

    const errorDetails = this.extractErrorDetails(pythonResult);
    return {
      isErrorFree: false,
      errorDetails,
      message: `Error detected: ${errorDetails}`
    };
  }

  private findPythonToolResult(sagaResult: SetExecutionResult): PythonToolResult | null {
    // Search through the saga result structure to find Python tool results
    // Check in the main result
    if (this.isPythonToolResult(sagaResult.result)) {
      return sagaResult.result;
    }

    // Check in transaction results
    for (const transactionResult of Object.values(sagaResult.transactionResults)) {
      if (this.isPythonToolResult(transactionResult)) {
        return transactionResult;
      }
      
      // Search deeper if transactionResult is an object with nested results
      if (typeof transactionResult === 'object' && transactionResult !== null) {
        const found = this.searchForPythonResult(transactionResult);
        if (found) return found;
      }
    }

    return null;
  }

  private searchForPythonResult(obj: any): PythonToolResult | null {
    if (this.isPythonToolResult(obj)) {
      return obj;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            const found = this.searchForPythonResult(item);
            if (found) return found;
          }
        } else if (typeof value === 'object' && value !== null) {
          const found = this.searchForPythonResult(value);
          if (found) return found;
        }
      }
    }

    return null;
  }

  private isPythonToolResult(obj: any): obj is PythonToolResult {
    return obj && 
           typeof obj === 'object' &&
           'content' in obj &&
           'success' in obj &&
           'stdout' in obj &&
           'stderr' in obj &&
           'filename' in obj;
  }

  private extractErrorDetails(executionResult: PythonToolResult): string {
    let errorInfo = '';

    if (executionResult.stderr) {
      const tracebackMatch = executionResult.stderr.match(/Traceback \(most recent call last\):(.*?)(?=\r?\n\r?\nThe above exception|$)/s);
      if (tracebackMatch) {
        const lines = tracebackMatch[1].split(/\r?\n/);
        const lastErrorLine = lines[lines.length - 1]?.trim();
        if (lastErrorLine && lastErrorLine.includes(':')) {
          errorInfo = lastErrorLine;
        }
      }

      if (!errorInfo) {
        const errorLineMatch = executionResult.stderr.match(/(\w+Error: .+?)(?=\r?\n|$)/);
        if (errorLineMatch) {
          errorInfo = errorLineMatch[1];
        }
      }
    }

    if (!errorInfo && executionResult.error) {
      const errorLineMatch = executionResult.error.match(/(\w+Error: .+?)(?=\r?\n|$)/);
      if (errorLineMatch) {
        errorInfo = errorLineMatch[1];
      }
    }

    return errorInfo || 'Unknown error occurred';
  }

  isErrorFree(executionResult: SetExecutionResult): boolean {
    return this.analyzeExecution(executionResult).isErrorFree;
  }

  getErrorDetails(executionResult: SetExecutionResult): string | null {
    const result = this.analyzeExecution(executionResult);
    return result.errorDetails || null;
  }
}