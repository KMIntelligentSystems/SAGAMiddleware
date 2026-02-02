/**
 * D3 Visualization Tools for LLM-based Agents
 *
 * Provides tool handlers that wrap D3VisualizationClient for use with
 * LLM-based agents (GenericAgent). Since LLMs cannot read files directly,
 * these handlers read the generated files and return their contents in
 * the tool response.
 */

import * as fs from 'fs';
import * as path from 'path';
import { D3VisualizationClient } from '../mcp/d3VisualizationClient.js';
import { mcpClientManager } from '../mcp/mcpClient.js';

export interface D3VisualizationToolArgs {
  d3Code: string;
  csvData?: string;
  csvFilename?: string;
  outputPath?: string;
}

export interface D3VisualizationToolResult {
  success: boolean;
  svgContent?: string;        // SVG file contents as string
  svgPath?: string;           // File path for reference
  screenshotPath?: string;    // File path for reference (PNG not included to reduce token usage)
  error?: string;
  metadata?: {
    svgSize: number;          // Size in bytes
    pngSize: number;          // Size in bytes (file exists but not returned in result)
    renderTime: number;       // Time taken in ms
  };
}

/**
 * Tool handler for LLM-based agents to render D3 visualizations
 *
 * Flow:
 * 1. Calls D3VisualizationClient to render the visualization
 * 2. Reads the generated files from disk
 * 3. Returns file CONTENTS (not just paths) so LLM can analyze them
 *
 * This is the critical difference from BaseSDKAgent usage:
 * - BaseSDKAgent: Can read files directly using fs.readFileSync()
 * - GenericAgent: Must receive file contents in tool response
 */
export async function renderD3VisualizationTool(
  args: D3VisualizationToolArgs
): Promise<D3VisualizationToolResult> {
  const startTime = Date.now();

  try {
    console.log('🎨 [D3 Tool Handler] Starting D3 visualization rendering...');
    console.log(`   D3 code length: ${args.d3Code.length} chars`);
    if (args.csvFilename) {
      console.log(`   CSV filename: ${args.csvFilename}`);
      console.log(`   CSV data: ${args.csvData ? `${args.csvData.length} chars` : 'not provided'}`);
    }

    // Step 1: Initialize D3 client and render
    console.log('📡 [D3 Tool Handler] Initializing D3VisualizationClient...');
    const d3Client = new D3VisualizationClient(mcpClientManager, 'playwright-server');

    const outputPath = args.outputPath || path.join(process.cwd(), 'output', 'd3-visualizations');
    const timestamp = Date.now();

    console.log('🚀 [D3 Tool Handler] Calling D3VisualizationClient.renderD3()...');
    const result = await d3Client.renderD3({
      d3Code: args.d3Code,
      csvData: args.csvData,
      csvFilename: args.csvFilename,
      screenshotName: `llm-validation-${timestamp}.png`,
      svgName: `llm-validation-${timestamp}.svg`,
      outputPath: outputPath
    });

    if (!result.success) {
      console.error('❌ [D3 Tool Handler] Rendering failed:', result.error);
      return {
        success: false,
        error: result.error || 'Unknown rendering error'
      };
    }

    console.log('✅ [D3 Tool Handler] Rendering successful');
    console.log(`   SVG path: ${result.svgPath}`);
    console.log(`   PNG path: ${result.screenshotPath}`);

    // Step 2: Read generated files from disk
    // THIS IS THE CRITICAL DIFFERENCE: LLMs can't read files, so we must
    // read them here and return the contents in the tool response

    console.log('📂 [D3 Tool Handler] Reading generated files from disk...');

    if (!result.svgPath || !result.screenshotPath) {
      throw new Error('File paths not returned from D3VisualizationClient');
    }

    if (!fs.existsSync(result.svgPath)) {
      throw new Error(`SVG file not found at: ${result.svgPath}`);
    }

    if (!fs.existsSync(result.screenshotPath)) {
      throw new Error(`PNG file not found at: ${result.screenshotPath}`);
    }

    const svgContent = fs.readFileSync(result.svgPath, 'utf-8');
    const pngBuffer = fs.readFileSync(result.screenshotPath);

    const renderTime = Date.now() - startTime;

    console.log(`✅ [D3 Tool Handler] Files read successfully`);
    console.log(`   SVG content: ${svgContent.length} chars`);
    console.log(`   PNG file size: ${pngBuffer.length} bytes`);
    console.log(`   Total time: ${renderTime}ms`);

    // Step 3: Return file contents to LLM
    // Note: We don't include pngBase64 to reduce token usage - only SVG content is needed for analysis
    return {
      success: true,
      svgContent: svgContent,           // SVG XML as string for analysis
      svgPath: result.svgPath,          // For logging/reference
      screenshotPath: result.screenshotPath,
      metadata: {
        svgSize: svgContent.length,
        pngSize: pngBuffer.length,
        renderTime: renderTime
      }
    };
  } catch (error) {
    console.error('❌ [D3 Tool Handler] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tool handler to read CSV data from file system
 * Used by GenericAgent to fetch CSV data on-demand
 */
export async function getCsvDataTool(args: { filePath: string }): Promise<{
  success: boolean;
  csvData?: string;
  csvFilename?: string;
  error?: string;
}> {
  try {
    console.log(`📂 [CSV Tool] Reading CSV file: ${args.filePath}`);

    if (!fs.existsSync(args.filePath)) {
      return {
        success: false,
        error: `CSV file not found: ${args.filePath}`
      };
    }

    const csvData = fs.readFileSync(args.filePath, 'utf-8');
    const csvFilename = path.basename(args.filePath);

    console.log(`✅ [CSV Tool] Read CSV: ${csvFilename} (${csvData.length} chars)`);

    return {
      success: true,
      csvData: csvData,
      csvFilename: csvFilename
    };
  } catch (error) {
    console.error(`❌ [CSV Tool] Error reading CSV:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get CSV data tool schema for LLM function calling
 */
export function getCsvDataToolSchema() {
  return {
    name: 'get_csv_data',
    description: 'Read CSV file contents from the file system. Use this to fetch CSV data when you need it for visualization validation.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the CSV file to read (can be absolute or relative)'
        }
      },
      required: ['filePath']
    }
  };
}

/**
 * Get tool schema for LLM function calling
 * This is used by GenericAgent to register the tool with the LLM provider
 */
export function getD3VisualizationToolSchema() {
  return {
    name: 'render_d3_visualization',
    description: 'Renders D3.js code using Playwright and returns SVG content and PNG screenshot for analysis. Use this tool to validate D3.js visualizations by rendering them and examining the generated SVG elements.',
    inputSchema: {
      type: 'object',
      properties: {
        d3Code: {
          type: 'string',
          description: 'Complete D3.js HTML code to render (must be a full HTML document)'
        },
        csvData: {
          type: 'string',
          description: 'Optional CSV data content to intercept and provide to d3.csv() calls'
        },
        csvFilename: {
          type: 'string',
          description: 'Optional CSV filename pattern to intercept (e.g., "data.csv" or "prices.csv")'
        },
        outputPath: {
          type: 'string',
          description: 'Optional custom output directory path for generated files'
        }
      },
      required: ['d3Code']
    }
  };
}
