import { SetExecutionResult, AnalysisResult } from '../types/visualizationSaga';

interface PythonToolResult {
  content: any[];
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  filename: string;
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
    //console.log('DEBUG: Searching for Python tool result in:', JSON.stringify(sagaResult, null, 2));
    
    // Search through the saga result structure to find Python tool results
    // Check in the main result
    if (this.isPythonToolResult(sagaResult.result)) {
      //console.log('DEBUG: Found Python result in sagaResult.result');
      return sagaResult.result;
    }

    // Check if result.result is a JSON string that needs parsing
    if (typeof sagaResult.result?.result === 'string') {
      //console.log('DEBUG: Found string in sagaResult.result.result:', sagaResult.result.result);
      try {
        const parsed = JSON.parse(sagaResult.result.result);
        //console.log('DEBUG: Parsed JSON:', parsed);
        if (this.isPythonToolResult(parsed)) {
          //console.log('DEBUG: Parsed object is valid Python tool result');
          return parsed;
        } else {
          //console.log('DEBUG: Parsed object failed isPythonToolResult check');
        }
      } catch (e) {
        //console.log('DEBUG: JSON parse failed:', e);
        // Not valid JSON, continue searching
      }
    }

    // Check in setResults structure
    if (sagaResult.result?.setResults) {
      //console.log('DEBUG: Found setResults, checking each set');
      for (const [setKey, setResult] of Object.entries(sagaResult.result.setResults)) {
        //console.log(`DEBUG: Checking setResult for ${setKey}:`, setResult);
        
        // Type guard for setResult
        if (setResult && typeof setResult === 'object' && 'result' in setResult) {
          // Check if setResult.result is a string that contains our data
          if (typeof setResult.result === 'string') {
            //console.log(`DEBUG: Found string in setResults.${setKey}.result`);
            try {
              // This string appears to be JavaScript object notation, not JSON
              // Try to extract the JSON part from the nested result
              const lines = setResult.result.split('\n');
              for (const line of lines) {
                if (line.includes('"content":') && line.includes('"success":')) {
                  // Extract the JSON string from the line
                  const jsonMatch = line.match(/result: '({.*})'/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[1]);
                    //console.log(`DEBUG: Parsed nested JSON from ${setKey}:`, parsed);
                    if (this.isPythonToolResult(parsed)) {
                      //console.log(`DEBUG: Found valid Python tool result in ${setKey}`);
                      return parsed;
                    }
                  }
                }
              }
            } catch (e) {
              //console.log(`DEBUG: Failed to parse setResult.${setKey}:`, e);
            }
          }
        }

        // Also recursively search the setResult object
        const found = this.searchForPythonResult(setResult);
        if (found) return found;
      }
    }

    // Check in transaction results
    //console.log('DEBUG: Checking transactionResults:', Object.keys(sagaResult.transactionResults || {}));
    for (const transactionResult of Object.values(sagaResult.transactionResults || {})) {
      if (this.isPythonToolResult(transactionResult)) {
        return transactionResult;
      }
      
      // Search deeper if transactionResult is an object with nested results
      if (typeof transactionResult === 'object' && transactionResult !== null) {
        const found = this.searchForPythonResult(transactionResult);
        if (found) return found;
      }
    }

    //console.log('DEBUG: No Python tool result found');
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
    const result = obj && 
           typeof obj === 'object' &&
           'content' in obj &&
           'success' in obj &&
           'stdout' in obj &&
           'stderr' in obj &&
           'filename' in obj;
    
    if (!result) {
      //console.log('DEBUG: isPythonToolResult failed for object:', obj);
      /*console.log('DEBUG: Missing properties:', {
        hasContent: 'content' in (obj || {}),
        hasSuccess: 'success' in (obj || {}),
        hasStdout: 'stdout' in (obj || {}),
        hasStderr: 'stderr' in (obj || {}),
        hasFilename: 'filename' in (obj || {}),
        actualKeys: obj ? Object.keys(obj) : 'null/undefined'
      });*/
    }
    
    return result;
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