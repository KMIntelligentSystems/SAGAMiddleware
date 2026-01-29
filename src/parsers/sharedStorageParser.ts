import {
  SharedStorage,
  DocumentAnalysisResult,
  DocumentWorkflowResult,
  PageDesignResult
} from '../types/dag.js';

/**
 * Parser for incoming socket messages to SharedStorage format
 */
export class SharedStorageParser {
  /**
   * Parse incoming socket message to SharedStorage structure
   * @param message - Raw message from socket
   * @returns Parsed SharedStorage object
   */
  public static parseMessage(message: any): SharedStorage {
    const sharedStorage: SharedStorage = {
      documentAnalyses: [],
      documentWorkflows: [],
      pageDesigns: [], 
      furtherInstructions: `You will receive three building blocks for the Document Builder.1.A typograhical layout using coordinates and font sizes for positioning text
        and 2-d charts on the page. 2. The text that will appear in the layout. The text will be rendered as sentences and paragraphs. For this purpose you will provide instructions
        to the Report Writing agent to improve the presentation of the text. 3. The visualizations will be rendered by coding agents. Your task is to provide exact details of csv data for their input so that they 
        have all the information for their coding task.
        You will also provide the coding agents with precise instructions. You will read all the data and comprend in regard to the overall task of building a document. You are the coordinator of other agents. 
        The file path for all referenced csv files is: c:/repos/my-app/data/visualizations/`
    };

    try {
      // Handle different message formats
      let parsedData = message;

      // If message has a 'data' property, use that
      if (message.data) {
        parsedData = message.data;
      }

      // If message.message is a string, parse it
      if (typeof parsedData.message === 'string') {
        parsedData = JSON.parse(parsedData.message);
      }

      // PRIORITY: Check if sharedStorage already exists in the parsed data
      if (parsedData.sharedStorage) {
        const existingStorage = parsedData.sharedStorage;

        // Parse documentAnalyses from sharedStorage
        if (existingStorage.documentAnalyses && Array.isArray(existingStorage.documentAnalyses)) {
          sharedStorage.documentAnalyses = existingStorage.documentAnalyses.map(
            (item: any) => this.parseDocumentAnalysis(item)
          );
        }

        // Parse documentWorkflows from sharedStorage
        if (existingStorage.documentWorkflows && Array.isArray(existingStorage.documentWorkflows)) {
          sharedStorage.documentWorkflows = existingStorage.documentWorkflows.map(
            (item: any) => this.parseDocumentWorkflow(item)
          );
        }

        // Parse pageDesigns from sharedStorage
        if (existingStorage.pageDesigns && Array.isArray(existingStorage.pageDesigns)) {
          sharedStorage.pageDesigns = existingStorage.pageDesigns.map(
            (item: any) => this.parsePageDesign(item)
          );
        }
      } else {
        // FALLBACK: Parse from root level if sharedStorage doesn't exist

        // Parse documentAnalyses if present
        if (parsedData.documentAnalyses && Array.isArray(parsedData.documentAnalyses)) {
          sharedStorage.documentAnalyses = parsedData.documentAnalyses.map(
            (item: any) => this.parseDocumentAnalysis(item)
          );
        }

        // Parse documentWorkflows if present
        if (parsedData.documentWorkflows && Array.isArray(parsedData.documentWorkflows)) {
          sharedStorage.documentWorkflows = parsedData.documentWorkflows.map(
            (item: any) => this.parseDocumentWorkflow(item)
          );
        }

        // Parse pageDesigns if present
        if (parsedData.pageDesigns && Array.isArray(parsedData.pageDesigns)) {
          sharedStorage.pageDesigns = parsedData.pageDesigns.map(
            (item: any) => this.parsePageDesign(item)
          );
        }

        // Handle workflowRequirements (convert to DocumentWorkflowResult)
        if (parsedData.workflowRequirements) {
          const workflowResult = this.parseWorkflowRequirements(parsedData);
          sharedStorage.documentWorkflows.push(workflowResult);
        }
      }

    } catch (error) {
      console.error('Error parsing message to SharedStorage:', error);
      throw new Error(`Failed to parse message: ${error}`);
    }

    return sharedStorage;
  }

  /**
   * Parse DocumentAnalysisResult from raw data
   */
  private static parseDocumentAnalysis(data: any): DocumentAnalysisResult {
    return {
      analysisId: data.analysisId || '',
      documentPath: data.documentPath || '',
      sessionId: data.sessionId || '',
      timestamp: data.timestamp || Date.now(),
      originalAnalysis: {
        summary: data.originalAnalysis?.summary || '',
        keyFindings: data.originalAnalysis?.keyFindings || [],
        visualizationSuggestions: data.originalAnalysis?.visualizationSuggestions || [],
        rawAnalysis: data.originalAnalysis?.rawAnalysis || ''
      },
      conversationHistory: data.conversationHistory || [],
      dataFiles: {
        csvFiles: data.dataFiles?.csvFiles || [],
        manifestFiles: data.dataFiles?.manifestFiles || []
      },
      metadata: {
        submittedAt: data.metadata?.submittedAt || new Date().toISOString(),
        conversationLength: data.metadata?.conversationLength || 0,
        followUpQuestions: data.metadata?.followUpQuestions || 0
      },
      status: data.status || 'stored'
    };
  }

  /**
   * Parse DocumentWorkflowResult from raw data
   */
  private static parseDocumentWorkflow(data: any): DocumentWorkflowResult {
    return {
      workflowId: data.workflowId || '',
      analysisId: data.analysisId || '',
      workflowRequirements: data.workflowRequirements || {},
      documentPath: data.documentPath || '',
      timestamp: data.timestamp || Date.now(),
      status: data.status || 'pending_coordination'
    };
  }

  /**
   * Parse PageDesignResult from raw data
   */
  private static parsePageDesign(data: any): PageDesignResult {
//    console.log('DAAAAAAAAAAATAAAAAAA  ', data)
    return {
      designId: data.designId || '',
      timestamp: data.timestamp || Date.now(),
      pages: (data.pages || []).map((page: any) => ({
        rectangles: (page.rectangles || []).map((rect: any) => ({
          id: rect.id || '',
          x: rect.x || 0,
          y: rect.y || 0,
          width: rect.width || 0,
          height: rect.height || 0,
          fillColor: rect.fillColor || '#ffffff',
          strokeColor: rect.strokeColor || '#000000'
        })),
        textElements: (page.textElements || []).map((text: any) => ({
          id: text.id || '',
          x: text.x || 0,
          y: text.y || 0,
          text: text.text || '',
          fontFamily: text.fontFamily || 'Arial',
          fontSize: text.fontSize || 12,
          color: text.color || '#000000'
        })),
        canvasSize: {
          width: page.canvasSize?.width || 800,
          height: page.canvasSize?.height || 600
        }
      })),
      metadata: {
        createdAt: data.metadata?.createdAt || new Date().toISOString(),
        totalPages: data.metadata?.totalPages || 0,
        totalElements: data.metadata?.totalElements || 0
      },
      status: data.status || 'stored'
    };
  }

  /**
   * Convert workflowRequirements to DocumentWorkflowResult
   */
  private static parseWorkflowRequirements(data: any): DocumentWorkflowResult {
    return {
      workflowId: data.threadId || `workflow_${Date.now()}`,
      analysisId: data.analysisId || '',
      workflowRequirements: data.workflowRequirements || data,
      documentPath: data.documentPath || '',
      timestamp: Date.now(),
      status: 'pending_coordination'
    };
  }

  /**
   * Validate SharedStorage structure
   */
  public static validate(storage: SharedStorage): boolean {
    if (!storage) return false;
    if (!Array.isArray(storage.documentAnalyses)) return false;
    if (!Array.isArray(storage.documentWorkflows)) return false;
    if (!Array.isArray(storage.pageDesigns)) return false;
    return true;
  }

  /**
   * Merge multiple SharedStorage objects
   */
  public static merge(...storages: SharedStorage[]): SharedStorage {
    const merged: SharedStorage = {
      documentAnalyses: [],
      documentWorkflows: [],
      pageDesigns: [],
      furtherInstructions: `You will receive three building blocks for the Document Builder.1.A typograhical layout using coordinates and font sizes for positioning text
        and 2-d charts on the page. 2. The text that will appear in the layout. The text will be rendered as sentences and paragraphs. For this purpose you will provide instructions
        to the Report Writing agent to improve the presentation of the text. 3. The visualizations will be rendered by coding agents. Your task is to provide exact details of csv data for their input so that they 
        have all the information for their coding task.
        You will also provide the coding agents with precise instructions. You will read all the data and comprend in regard to the overall task of building a document. You are the coordinator of other agents. 
        The file path for all referenced csv files is: c:/repos/my-app/data/visualizations/`
    };

    for (const storage of storages) {
      if (this.validate(storage)) {
        merged.documentAnalyses.push(...storage.documentAnalyses);
        merged.documentWorkflows.push(...storage.documentWorkflows);
        merged.pageDesigns.push(...storage.pageDesigns);
        merged.furtherInstructions;
      }
    }

    return merged;
  }
}
