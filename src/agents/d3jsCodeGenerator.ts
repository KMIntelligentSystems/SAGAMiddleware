/**
 * D3JSCodeGenerator
 *
 * Generates D3.js visualization code based on user requirements and context data.
 * The SDK agent interprets both inputs and generates appropriate D3.js code.
 */

import { BaseSDKAgent} from './baseSDKAgent.js';
import { AgentResult, WorkingMemory } from '../types/index.js';
import { D3VisualizationClient, D3RenderResult } from '../mcp/d3VisualizationClient.js';
import { mcpClientManager, ToolCallContext } from '../mcp/mcpClient.js';

import * as fs from 'fs'


export interface D3CodeInput {
    filepath: string;
    userRequirements: string;
}

export class D3JSCodeGenerator extends BaseSDKAgent {
      private d3Client: D3VisualizationClient | null = null;
    constructor(contextManager?: any) {
        super('D3JSCodeGenerator', 15, contextManager);
    }

    /**
     * Execute D3 code generation
     */
    async execute(input: D3CodeInput): Promise<AgentResult> {
       
        input = this.getInput();
         console.log('FILE ', input.filepath)
        console.log(input.userRequirements)
        if (!this.validateInput(input)) {
             return {
                agentName: ' D3JSCodeGenerator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }

        try {
            const prompt = this.buildPrompt(input);
            const output = fs.readFileSync('C:/repos/SAGAMiddleware/data/D3JSCodeResult.txt', 'utf-8');//await this.executeQuery(prompt);
           
            const svgResult = this.handlePlaywrightTesting(output)
            this.setContext({'D3JS_CODE:': output, 'SVG_FILE_PATH:':svgResult });
           return {
                agentName: ' D3JSCodeGenerator',
                result: output,
                success: true,
                timestamp: new Date()
            };
            
        } catch (error) {
            return {
                agentName: ' D3JSCodeGenerator',
                result: '',
                success: false,
                timestamp: new Date(),
                error: 'Invalid input: filepath and userRequirements are required'
            };
        }
    }

    /**
     * Build prompt for D3 code generation
     */
    protected buildPrompt(input: D3CodeInput): string {
        return `You are a D3.js visualization code generator.

USER REQUIREMENTS:
${input.userRequirements}

CONTEXT DATA (contains CSV file path from MCP server):
${input.filepath}

YOUR TASK:
Generate complete D3.js code based on the user requirements. You must:
1. Extract the CSV file path from the context data
2. Read and inspect the CSV file to understand its structure (columns, data types, etc.)
3. Use d3.csv() method to load the file in the generated code
4. CRITICAL: Convert the file path to file:// URL format for browser access
   - Windows path: C:/repos/SAGAMiddleware/data/file.csv → file:///C:/repos/SAGAMiddleware/data/file.csv
   - Unix path: /home/user/data/file.csv → file:///home/user/data/file.csv
   - Note the THREE slashes after file: for absolute paths
5. Create the visualization as specified in the requirements
6. Output complete HTML code ready to run in a browser

**WHY file:// PROTOCOL:**
The HTML will be rendered in Playwright which can access local files via file:// protocol but cannot use relative paths or HTTP URLs.

**IMPORTANT**
- Provide only code
- Zero explanatory text
- Zero markdown
`;
    }

    /**
     * Validate input for D3 code generation
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.userRequirements === 'string' &&
            typeof input.filepath === 'string' &&
            input.userRequirements.length > 0 &&
            input.filepath.length > 0
        );
    }

    protected getInput(): D3CodeInput{
        const ctx = this.contextManager.getContext('D3JSCodeGenerator') as WorkingMemory;
        const actualResult = ctx.lastTransactionResult;
        let parsedResult;
        if (typeof actualResult === 'string') {
            try {
                parsedResult = JSON.parse(actualResult);
            } catch (e) {
                    console.warn('Could not parse control flow result as JSON, using as-is');
                }
            }

                // Extract filepath and userRequirements from the parsed result
                const filepath = parsedResult.filePath || parsedResult.filepath || '';
                const userRequirements = parsedResult.userRequirements
                    ? (typeof parsedResult.userRequirements === 'string'
                        ? parsedResult.userRequirements
                        : JSON.stringify(parsedResult.userRequirements, null, 2))
                    : JSON.stringify(parsedResult, null, 2);

                console.log('📋 Prepared D3JSCodeGenerator input:', { filepath, userRequirements: userRequirements.substring(0, 100) + '...' });

                return {
                    filepath,
                    userRequirements
    }
}

  /**
     * Handle visualization rendering with Playwright
     */
    private async handlePlaywrightTesting(d3Code: string): Promise<any> {
        console.log(`\n🎨 Rendering visualization with Playwright...`);
        let renderResult;
       try {
            renderResult = await this.renderD3Visualization(
                d3Code
            );

            if (renderResult.success) {
                console.log(`✅ Visualization rendered`);
                console.log(`   PNG: ${renderResult.screenshotPath}`);
                console.log(`   SVG: ${renderResult.svgPath}`);
            } else {
                console.warn(`⚠️  Visualization rendering failed: ${renderResult.error}`);
            }
        } catch (error) {
            console.error(`❌ Error rendering visualization:`, error);
        }
        return renderResult?.svgPath
    }

      /**
       * Initialize D3 visualization client with Playwright MCP server
       */
      initializeD3Client(): void {
        if (!this.d3Client) {
          this.d3Client = new D3VisualizationClient(mcpClientManager, 'playwright-server');
          console.log('✅ D3 visualization client initialized');
        }
      }
    
      /**
       * Render D3 visualization code using Playwright MCP
       *
       * @param d3Code - The D3.js code to render
       * @param agentName - The name of the agent that generated the code (optional, for context)
       * @param outputName - Custom name for output files (optional)
       * @param csvData - CSV data content to provide to d3.csv() calls (optional)
       * @param csvFilename - CSV filename to intercept (optional)
       * @returns Promise with render result including paths to PNG and SVG files
       */
      async renderD3Visualization(
        d3Code: string,
        agentName?: string,
        outputName?: string,
        csvData?: string,
        csvFilename?: string
      ): Promise<D3RenderResult> {
        // Initialize D3 client if not already initialized
        if (!this.d3Client) {
          this.initializeD3Client();
        }
    
        if (!this.d3Client) {
          console.error('❌ Failed to initialize D3 client');
          return {
            success: false,
            error: 'D3 client initialization failed'
          };
        }
    
        console.log(`🎨 Rendering D3 visualization${agentName ? ` from ${agentName}` : ''}...`);
    
        // Generate output name based on agent or timestamp
        const baseName = outputName || (agentName ? `${agentName}-${Date.now()}` : `visualization-${Date.now()}`);
    
        try {
          const result = { success: true, screenshotPath: '', svgPath: 'C:/repos/SAGAMiddleware/output/d3-visualizations/D3JSCodingAgent-output.svg'}
          
          /*await this.d3Client.renderD3({
            d3Code,
            csvData,
            csvFilename,
            screenshotName: `${baseName}.png`,
            svgName: `${baseName}.svg`,
            outputPath: path.join(process.cwd(), 'output', 'd3-visualizations')
          });
    
          if (result.success) {
            console.log(`✅ D3 visualization rendered successfully`);
            console.log(`  📸 PNG: ${result.screenshotPath}`);
            console.log(`  💾 SVG: ${result.svgPath}`);
    console.log('D3CODE',d3Code)
            // Store visualization paths in context for the agent
            if (agentName) {
              this.contextManager.updateContext(agentName, {
                lastVisualizationPNG: result.screenshotPath,
                lastVisualizationSVG: result.svgPath,
                timestamp: new Date()
              });
            }
          }*/
           this.contextManager.updateContext('D3JSCodeGenerator', {
                d3jsCodeResult: d3Code,
                userRequirements: this.getInput().userRequirements,
                lastVisualizationPNG: result.screenshotPath,
                lastVisualizationSVG: result.svgPath,
                timestamp: new Date()
              });
    
          return result;
        } catch (error) {
          console.error('❌ Error rendering D3 visualization:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    
      /**
       * Close D3 client and cleanup
       */
      async closeD3Client(): Promise<void> {
        if (this.d3Client) {
          await this.d3Client.close();
          this.d3Client = null;
          console.log('🔒 D3 visualization client closed');
        }
      }
 
}
