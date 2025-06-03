import { mcpClientManager } from '../mcp/mcpClient.js';
import { MCPToolCall, MCPServerConfig } from '../types/index.js';

export interface DataSource {
  filePath: string;
  collection: string;
  status: 'indexed' | 'pending' | 'error';
  chunkCount?: number;
  error?: string;
}

export interface IndexingJob {
  id: string;
  filePath: string;
  collection: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  chunkCount?: number;
  error?: string;
}

export class DataPreprocessor {
  private indexingJobs = new Map<string, IndexingJob>();

  /**
   * Ensures data is indexed and ready for agent workflows
   */
  async ensureDataIndexed(filePath: string, collection: string, metadata?: any): Promise<DataSource> {
    console.log(`\n=== Data Preprocessing: ${filePath} → ${collection} ===`);
    
    try {
      // First check if data is already indexed
      const status = await this.checkCollectionStatus(collection);
      if (status.chunkCount > 0) {
        console.log(`✅ Data already indexed: ${status.chunkCount} chunks in collection '${collection}'`);
        return {
          filePath,
          collection,
          status: 'indexed',
          chunkCount: status.chunkCount
        };
      }

      // Data not indexed, start indexing process
      console.log(`📊 Starting indexing process for: ${filePath}`);
      const job = await this.startIndexingJob(filePath, collection, metadata);
      
      // Wait for completion with proper timeout and progress
      const result = await this.waitForIndexingCompletion(job);
      
      if (result.status === 'completed') {
        console.log(`✅ Indexing completed: ${result.chunkCount} chunks indexed`);
        return {
          filePath,
          collection,
          status: 'indexed',
          chunkCount: result.chunkCount
        };
      } else {
        console.log(`❌ Indexing failed: ${result.error}`);
        return {
          filePath,
          collection,
          status: 'error',
          error: result.error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ Preprocessing failed: ${errorMessage}`);
      return {
        filePath,
        collection,
        status: 'error',
        error: errorMessage
      };
    }
  }

  /**
   * Check if a collection exists and has data
   */
  private async checkCollectionStatus(collection: string): Promise<{ exists: boolean; chunkCount: number }> {
    try {
      // Try to get chunks from the collection to see if it exists and has data
      const result = await this.callMCPTool('get_chunks', {
        collection,
        limit: 1
      });

      if (result && Array.isArray(result)) {
        // Check total count by trying to get more chunks
        const fullResult = await this.callMCPTool('get_chunks', {
          collection,
          limit: 1000 // Get many to count
        });
        
        const chunkCount = Array.isArray(fullResult) ? fullResult.length : 0;
        return { exists: true, chunkCount };
      }
      
      return { exists: false, chunkCount: 0 };
    } catch (error) {
      // Collection doesn't exist or is empty
      return { exists: false, chunkCount: 0 };
    }
  }

  /**
   * Start an indexing job
   */
  private async startIndexingJob(filePath: string, collection: string, metadata?: any): Promise<IndexingJob> {
    const jobId = `indexing_${Date.now()}`;
    const job: IndexingJob = {
      id: jobId,
      filePath,
      collection,
      status: 'running',
      startTime: new Date()
    };

    this.indexingJobs.set(jobId, job);

    try {
      console.log(`🚀 Starting indexing job ${jobId}...`);
      
      // Call the index_file tool directly
      const result = await this.callMCPTool('index_file', {
        filePath,
        collection,
        metadata: metadata || { type: 'CSV', source: filePath, indexedAt: new Date().toISOString() }
      });

      console.log(`📋 Indexing call completed, processing result...`);
      
      // The tool may return success info or we need to check the collection
      job.status = 'completed';
      job.endTime = new Date();
      
      // Get the actual chunk count
      const status = await this.checkCollectionStatus(collection);
      job.chunkCount = status.chunkCount;
      
      this.indexingJobs.set(jobId, job);
      return job;
      
    } catch (error) {
      console.log(`❌ Indexing job ${jobId} failed:`, error);
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : String(error);
      this.indexingJobs.set(jobId, job);
      return job;
    }
  }

  /**
   * Wait for indexing job completion with timeout handling
   */
  private async waitForIndexingCompletion(job: IndexingJob): Promise<IndexingJob> {
    const maxWaitTime = 300000; // 5 minutes max
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();

    while (job.status === 'running' && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Update job status
      const currentJob = this.indexingJobs.get(job.id);
      if (currentJob) {
        job = currentJob;
      }

      // For our direct call approach, the job should be completed after the first call
      // This is more for future async implementations
      if (job.status !== 'running') {
        break;
      }
    }

    if (job.status === 'running') {
      // Still running after timeout
      job.status = 'failed';
      job.error = 'Indexing timeout exceeded';
      job.endTime = new Date();
      this.indexingJobs.set(job.id, job);
    }

    return job;
  }

  /**
   * Direct MCP tool call bypassing agent system
   */
  private async callMCPTool(toolName: string, toolArguments: Record<string, any>): Promise<any> {
    const connectedServers = mcpClientManager.getConnectedServers();
    
    for (const serverName of connectedServers) {
      try {
        const tools = await mcpClientManager.listTools(serverName);
        const tool = tools.find(t => t.name === toolName);
        
        if (tool) {
          console.log(`🔧 Calling ${toolName} on server ${serverName}...`);
          const result = await mcpClientManager.callTool(serverName, {
            name: toolName,
            arguments: toolArguments
          });
          return result;
        }
      } catch (error) {
        console.log(`⚠️  Tool ${toolName} failed on server ${serverName}:`, error);
        // Continue to next server
        continue;
      }
    }
    
    throw new Error(`Tool '${toolName}' not found on any connected server`);
  }

  /**
   * Get status of all indexing jobs
   */
  getIndexingJobs(): IndexingJob[] {
    return Array.from(this.indexingJobs.values());
  }

  /**
   * Clean up completed jobs
   */
  cleanupJobs(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [jobId, job] of this.indexingJobs.entries()) {
      if (job.endTime && job.endTime.getTime() < cutoffTime) {
        this.indexingJobs.delete(jobId);
      }
    }
  }
}

// Singleton instance
export const dataPreprocessor = new DataPreprocessor();