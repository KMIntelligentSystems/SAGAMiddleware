/**
 * Generic Data Result Processor
 * Handles parsing, cleaning, and global storage of agent results
 */

export interface ProcessedData {
  agentName?: string;
  processedAt?: Date;
  originalFormat?: string;
  cleanedData: any;
  metadata?: Record<string, any>;
}

export interface ProcessedDataWithKey extends ProcessedData {
  key: string;
}

export interface StorageStats {
  totalResults: number;
  resultsByAgent: Record<string, number>;
  oldestResult: Date | null;
  newestResult: Date | null;
  storageKeys: string[];
}

export class DataResultProcessor {
  private globalStorage: Map<string, ProcessedData> = new Map();

  /**
   * Parse and clean any agent result - handles nested structures and formatting
   */
  parseResult(rawResult: any, agentType?: string): ProcessedData {
    console.log('🔄 DataResultProcessor: Processing result for', agentType || 'unknown agent');
    
    const originalFormat = this.detectFormat(rawResult);
    const extractedData = this.extractCoreData(rawResult);
    const cleanedData = this.cleanData(extractedData);
    
    const processedData: ProcessedData = {
     // agentName: agentType || this.extractAgentName(rawResult) || 'unknown',
      //processedAt: new Date(),
     // originalFormat,
      cleanedData
    /*  metadata: {
        originalStructure: typeof rawResult,
        hasNestedResult: this.hasNestedResult(rawResult),
        dataSize: JSON.stringify(cleanedData).length
      }*/
    };

    console.log('✅ DataResultProcessor: Successfully processed data:', {
      agent: processedData.agentName,
      format: originalFormat,
      dataSize: processedData.metadata?.dataSize
    });

    return processedData;
  }
  /**
   * Generic data cleaning - removes formatting artifacts
   */
  cleanData(rawData: any): any {
    if (typeof rawData !== 'string') {
      return rawData; // Already clean object/array
    }

    let cleanedString = rawData;

    // Remove markdown code blocks
    cleanedString = cleanedString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Remove extra whitespace and newlines
    cleanedString = cleanedString.replace(/\n\s*\n/g, '\n').trim();
    console.log('CLEANED STRING  ',cleanedString)
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(cleanedString);
      console.log('📊 DataResultProcessor: Successfully parsed JSON data');
      return parsed;
    } catch (error) {
      // Look for JSON array or object in the text
      const jsonMatch = cleanedString.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          console.log('📊 DataResultProcessor: Successfully extracted and parsed JSON from text');
          return parsed;
        } catch (extractError) {
          console.log('⚠️ DataResultProcessor: Could not parse extracted JSON');
        }
      }
      console.log('⚠️ DataResultProcessor: Could not parse as JSON, returning as string');
      return cleanedString;
    }
  }

  /**
   * Store processed data with flexible key
   */
  storeResult(key: string, data: ProcessedData): void {
    this.globalStorage.set(key, data);
    console.log(`💾 DataResultProcessor: Stored result with key: ${key}`);
  }

  /**
   * Store with auto-generated key based on agent and timestamp
   */
  storeResultAuto(data: ProcessedData): string {
    const key = `${data.agentName}_${Date.now()}`;
    this.storeResult(key, data);
    return key;
  }

  /**
   * Retrieve result by key
   */
  getResult(key: string): ProcessedData | undefined {
    return this.globalStorage.get(key);
  }

  /**
   * Get all results from specific agent
   */
/*  getResultsByAgent(agentName: string): ProcessedData[] {
    const results: ProcessedData[] = [];
    for (const [key, data] of this.globalStorage.entries()) {
      if (data.agentName === agentName) {
        results.push(data);
      }
    }
    return results.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }*/

  /**
   * Get results by custom metadata filter
   */
/*  getResultsByFilter(filterFn: (data: ProcessedData) => boolean): ProcessedData[] {
    const results: ProcessedData[] = [];
    for (const [key, data] of this.globalStorage.entries()) {
      if (filterFn(data)) {
        results.push(data);
      }
    }
    return results.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }*/

  /**
   * Get latest result from specific agent
   */
 /* getLatestByAgent(agentName: string): ProcessedData | undefined {
    const results = this.getResultsByAgent(agentName);
    return results.length > 0 ? results[0] : undefined;
  }*/

  /**
   * Get all stored results
   */
  getAllResults(): Map<string, ProcessedData> {
    return new Map(this.globalStorage);
  }

createOptimalChunks(entries: [string, ProcessedData][], chunkSize: number = 2): ProcessedDataWithKey[][] {
    const chunks: ProcessedDataWithKey[][] = [];
    let currentChunk: ProcessedDataWithKey[] = [];
    
    for (const [key, data] of entries) {
      // Add key to the data object for reference
      currentChunk.push({ key, ...data });
      console.log('CHUNK  ',currentChunk[0])
      
      // If we've reached the chunk size, start a new chunk
      if (currentChunk.length >= chunkSize) {
        chunks.push([...currentChunk]);
        currentChunk = [];
      }
    }
    
    // Add remaining items if any
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    console.log(`📦 Created ${chunks.length} chunks with max ${chunkSize} records each`);
    return chunks;
  }
  

  /**
   * Clear storage with optional filter
   */
 /* clearStorage(filter?: string): number {
    if (!filter) {
      const count = this.globalStorage.size;
      this.globalStorage.clear();
      console.log(`🗑️ DataResultProcessor: Cleared all ${count} results`);
      return count;
    }

    let cleared = 0;
    for (const [key, data] of this.globalStorage.entries()) {
      if (key.includes(filter) || data.agentName.includes(filter)) {
        this.globalStorage.delete(key);
        cleared++;
      }
    }
    console.log(`🗑️ DataResultProcessor: Cleared ${cleared} results matching filter: ${filter}`);
    return cleared;
  }*/

  /**
   * Get storage statistics
   */
  /*getStorageStats(): StorageStats {
    const results = Array.from(this.globalStorage.values());
    const resultsByAgent: Record<string, number> = {};
    
    let oldestResult: Date | null = null;
    let newestResult: Date | null = null;

    for (const result of results) {
      // Count by agent
      resultsByAgent[result.agentName] = (resultsByAgent[result.agentName] || 0) + 1;
      
      // Track oldest/newest
      if (!oldestResult || result.processedAt < oldestResult) {
        oldestResult = result.processedAt;
      }
      if (!newestResult || result.processedAt > newestResult) {
        newestResult = result.processedAt;
      }
    }

    return {
      totalResults: this.globalStorage.size,
      resultsByAgent,
      oldestResult,
      newestResult,
      storageKeys: Array.from(this.globalStorage.keys())
    };
  }
*/
  // Private helper methods

  private detectFormat(rawResult: any): string {
    if (typeof rawResult === 'string') {
      if (rawResult.includes('```json')) return 'markdown_json';
      if (rawResult.trim().startsWith('{') || rawResult.trim().startsWith('[')) return 'json_string';
      return 'plain_string';
    }
    if (Array.isArray(rawResult)) return 'array';
    if (typeof rawResult === 'object' && rawResult !== null) {
      if (this.hasNestedResult(rawResult)) return 'nested_agent_result';
      return 'object';
    }
    return 'unknown';
  }
/*
  result: '```json\n' +
        '[\n' +
        '    {\n' +
        '        "date": "2023-11-05",\n' +
        '        "installation": "ERGTO1",\n' +
        '        "values": [0, 0, 0, 0, 0, 0, 0, 0]\n' +
        '    },\n' +
        '    {\n' +
        '        "date": "2023-11-05",\n' +
        '        "installation": "RPCG",\n' +
        '        "values": [-2.2, -2.2, -2.2, -2.2, -2.2, -2.2, -2.2, -2.2]\n' +
        '    }\n' +
        ']\n' +
*/
  private extractCoreData(rawResult: any): any {
    // Handle nested AgentResult structure
    if (typeof rawResult === 'object' && rawResult !== null) {
      if (rawResult.result && typeof rawResult.result === 'object' && rawResult.result.result) {
        // Double nested: { result: { result: "actual_data" } }
        return rawResult.result.result;
      } else if (rawResult.result) {
        // Single nested: { result: "actual_data" }
        return rawResult.result;
      }
    }
    
    return rawResult;
  }

  private extractAgentName(rawResult: any): string | null {
    if (typeof rawResult === 'object' && rawResult !== null) {
      if (rawResult.agentName) return rawResult.agentName;
      if (rawResult.result && rawResult.result.agentName) return rawResult.result.agentName;
    }
    return null;
  }

  private hasNestedResult(rawResult: any): boolean {
    return typeof rawResult === 'object' && 
           rawResult !== null && 
           rawResult.result && 
           typeof rawResult.result === 'object' &&
           rawResult.result.result;
  }
}

// Export singleton instance for global use
export const globalDataProcessor = new DataResultProcessor();