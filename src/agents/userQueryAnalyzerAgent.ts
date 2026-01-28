/**
 * UserQueryAnalyzerAgent
 *
 * SDK agent that analyzes detailed user query information and extracts
 * pertinent data for each agent in the DAG.
 *
 * This agent:
 * 1. Receives DAGDefinition and userQuery (detailed task descriptions) as constructor parameters
 * 2. Reads the DAG to understand the role and task of each agent
 * 3. Analyzes the userQuery which contains similar tasks/roles but highly detailed
 * 4. Extracts information pertinent to each agent in the DAG
 * 5. Uses a LOCAL TOOL to store each agent-name-to-data mapping
 * 6. Returns an array of shape: {agentName, id, agentData}
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { DAGDefinition } from '../types/dag.js';
import { AgentResult } from '../types/index.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as fs from 'fs';

export interface AgentDataMapping {
    [agentId: string]: {
        agentName: string;
        agentData: any;
    };
}

export type AgentDataArray = Array<{agentName: string, id: string, agentData: any}>; // Array of agent data objects

export class UserQueryAnalyzerAgent extends BaseSDKAgent {
    private dataMapping: AgentDataMapping = {};
    private dag: DAGDefinition;
    private userQuery: any;

    constructor(dag: DAGDefinition, userQuery: any, contextManager?: any) {
        super('UserQueryAnalyzerAgent', 25, contextManager);

        this.dag = dag;
        this.userQuery = userQuery;

        // Setup the local tool for storing agent-data mappings
        try {
            this.setupDataStoreTool();
        } catch (error) {
            console.error('⚠️  Warning: Failed to setup UserQueryAnalyzer tools:', error);
            console.log('   UserQueryAnalyzer will run without custom tools');
        }
    }

    /**
     * Setup local tool for storing agent-to-data mappings
     */
    private setupDataStoreTool(): void {
        // Tool: Store agent-to-data mapping
        const storeDataTool = tool(
            'store_agent_data',
            'Store extracted data for a specific agent from the user query. Call this tool for each agent in the DAG with relevant extracted information.',
            {
                agent_name: z.string().describe('The name of the agent from the DAG'),
                agent_id: z.string().describe('The unique id of the agent from the DAG'),
                agent_data: z.any().describe('Extracted data pertinent to this agent from the user query (can be object, array, string, etc.)')
            },
            async (args) => {
                return this.handleStoreData(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'user-query-analyzer',
            tools: [storeDataTool]
        });

        // Add MCP server to options
        this.options.mcpServers = {
            ...this.options.mcpServers,
            'user-query-analyzer': mcpServer
        } as any;

        console.log('✅ UserQueryAnalyzer tool setup complete');
    }

    /**
     * Handler for store_agent_data tool
     * Called when LLM invokes the tool
     */
    private async handleStoreData(args: any) {
        try {
            console.log(`   💾 Storing data for ${args.agent_name} (ID: ${args.agent_id})`);

            // Use agentId as the key to prevent overwrites
            this.dataMapping[args.agent_id] = {
                agentName: args.agent_name,
                agentData: args.agent_data
            };

            console.log(`   ✅ Stored data for ${args.agent_name}`);

            return {
                content: [{
                    type: 'text' as const,
                    text: `Successfully stored data for "${args.agent_name}" with ID "${args.agent_id}"`
                }]
            };
        } catch (error) {
            console.error(`   ❌ Error storing data for ${args.agent_name}:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error storing data: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Execute user query analysis
     */
    async execute(_input?: any): Promise<AgentResult> {
        try {
            console.log('\n🎯 UserQueryAnalyzerAgent: Starting user query analysis...');
         //   console.log(` QUERY: ${JSON.stringify(this.userQuery)}`);
// console.log(`   DAG: ${JSON.stringify(this.dag)}`);
            // Clear previous mapping
            this.dataMapping = {};

            // Build prompt with embedded DAG and user query
            const prompt = this.buildPrompt(this.userQuery);

            // Execute - the SDK agent will call the store_agent_data tool
            console.log(`\n   📝 Analyzing user query with LLM...`);
          /*  await this.executeQuery(prompt);

            // Convert mapping to array format: {agentName, id, agentData}
            console.log(`\n✅ UserQueryAnalyzerAgent: Extracted data for ${Object.keys(this.dataMapping).length} agents`);
            const dataArray = Object.entries(this.dataMapping).map(
                ([agentId, data]) => ({agentName: data.agentName, id: agentId, agentData: data.agentData})
            );

            // Write dataArray to file for debugging/testing
            try {
                const filePath = 'c:/repos/sagaMiddleware/data/userQueryAnalysis.txt';
                const fileContent = JSON.stringify(dataArray, null, 2);
                fs.writeFileSync(filePath, fileContent, 'utf-8');
                console.log(`📝 User query analysis written to ${filePath}`);
            } catch (writeError) {
                console.error('⚠️  Warning: Failed to write userQueryAnalysis to file:', writeError);
            }*/

            //TEST
            const fileContent = fs.readFileSync('c:/repos/sagaMiddleware/data/userQueryAnalysis.txt', 'utf-8');
            const dataArray: AgentDataArray = JSON.parse(fileContent);

            // Store the array in context
            this.setContext(dataArray);

            return {
                agentName: 'UserQueryAnalyzerAgent',
                success: true,
                result: dataArray,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('❌ UserQueryAnalyzer error:', error);
            return {
                agentName: 'UserQueryAnalyzerAgent',
                result: {},
                success: false,
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Build prompt for the SDK agent
     * Embeds DAG and user query directly in the prompt
     */
    protected buildPrompt(_input: any): string {
        // Extract agent list from DAG for the prompt
        const agentList = this.dag.nodes
            .filter(node => node.type === 'agent' || node.type === 'sdk_agent')
            .map(node => `- ${node.agentName} (id: ${node.id})`)
            .join('\n');

        return `You are a data extraction specialist. Your job is to extract COMPLETE, DETAILED, RAW information from the userQuery for each agent in the DAG.

# CRITICAL INSTRUCTION:
DO NOT SUMMARIZE. DO NOT PARAPHRASE. EXTRACT THE COMPLETE RAW DATA.
The userQuery contains extensive detailed information. You must extract ALL of it, not create brief summaries.

# DAG DEFINITION (SOURCE OF TRUTH FOR AGENT NAMES):
${JSON.stringify(this.dag, null, 2)}

# AGENTS TO PROCESS (from DAG):
${agentList}

# USER QUERY (COMPLETE DATA TO EXTRACT FROM):
${JSON.stringify(this.userQuery, null, 2)}

# EXTRACTION PROCESS:

**STEP 1: UNDERSTAND THE DATA STRUCTURE**

The userQuery typically contains these data structures (extract ALL data from applicable sections):

- **sharedStorage.documentAnalyses[]**: Document analysis results with full text
  - originalAnalysis.summary: Complete document summaries (full text)
  - originalAnalysis.keyFindings: Complete lists of findings
  - originalAnalysis.rawAnalysis: Complete raw analysis text
  - conversationHistory: Full Q&A exchanges (complete questions and answers)
  - dataFiles: CSV file paths and manifest files

- **sharedStorage.pageDesigns[]**: Complete page layout specifications
  - rectangles[]: ALL rectangles with id, x, y, width, height, fillColor, strokeColor
  - textElements[]: ALL text elements with id, x, y, text, fontFamily, fontSize, color
  - canvasSize: width and height specifications
  - metadata: timestamps and element counts

- **sharedStorage.documentWorkflows[]**: Workflow specifications
  - workflowRequirements: Complete workflow data
  - conversationOutput: Full conversation text

- **workflowRequirements.agents[]**: Agent task specifications
  - name: Agent name
  - agentType: Agent type
  - task: Complete task description (full text)
  - inputFrom: Input sources
  - outputSchema: Complete output schema specifications

- **workflowRequirements.inputData**: Input data specifications
  - type, source, schema: Complete data source information

- **workflowRequirements.outputExpectation**: Output requirements
  - type, format, quality: Complete output specifications

**STEP 2: EXTRACT COMPLETE DATA FOR EACH AGENT**

For EACH agent in the DAG (listed above), extract ALL relevant information:

1. **Find matching agent in workflowRequirements.agents[]** by name
   - Extract the COMPLETE task description (full text, not abbreviated)
   - Extract ALL inputFrom sources
   - Extract the COMPLETE outputSchema (all fields)
   - Extract agentType

2. **Find relevant data in sharedStorage** based on agent role:

   **For Layout/HTML/Design agents:**
   - Extract COMPLETE pageDesigns[] with ALL rectangles and textElements
   - Include every coordinate, color, font, size
   - Extract ALL placeholder mappings and integration requirements

   **For Report/Writing/Documentation agents:**
   - Extract COMPLETE documentAnalyses[].originalAnalysis (full text)
   - Extract ENTIRE conversationHistory (all Q&A)
   - Extract ALL keyFindings lists
   - Include all raw analysis text

   **For Visualization/Coding agents:**
   - Extract complete CSV file paths from dataFiles
   - Extract full chart specifications and requirements
   - Extract ALL data filtering requirements
   - Extract complete tooltip and interactivity requirements

   **For Analyzer/Processing agents:**
   - Extract complete data source specifications
   - Extract ALL statistical requirements
   - Extract complete pattern analysis requirements
   - Extract full output data structure specifications

   **For Validator/Testing agents:**
   - Extract complete validation criteria
   - Extract ALL quality requirements
   - Extract full testing scenarios
   - Extract complete compliance requirements

3. **Extract ANY other relevant data** from the userQuery that relates to this agent's role

**STEP 3: CALL THE TOOL WITH COMPLETE DATA**

For EACH agent in the DAG, call store_agent_data ONCE with ALL extracted information:

\`\`\`
store_agent_data(
  agent_name='[EXACT agentName from DAG]',
  agent_id='[EXACT id from DAG]',
  agent_data={
    // ALL relevant data extracted from userQuery
    // NO summaries - include complete text
    // NO abbreviations - include all list items
    // PRESERVE nested structures completely
  }
)
\`\`\`

**CRITICAL EXTRACTION RULES:**

1. **NO SUMMARIES**: Extract complete text - if 500 words exist, include all 500 words
2. **NO ABBREVIATIONS**: Extract all items - if 10 rectangles exist, include all 10
3. **PRESERVE STRUCTURE**: Maintain nested objects, arrays, and all relationships
4. **COMPLETE TEXT**: Extract full paragraphs, sentences, descriptions
5. **ALL COORDINATES**: Include every x, y, width, height, color value
6. **COMPLETE LISTS**: Include entire arrays, not samples
7. **FULL CONVERSATIONS**: Include complete questions AND complete answers
8. **MATCH BY NAME**: Match DAG agents to userQuery data by agent name

**BEGIN EXTRACTION NOW:**

1. Process EVERY agent in the "AGENTS TO PROCESS" list above
2. For each agent, extract ALL relevant data from userQuery
3. Call store_agent_data ONCE per agent with COMPLETE data
4. If no relevant data exists for an agent, call with empty object: {}

Start extraction and tool calls now.`;
    }

    /**
     * Get the current data mapping
     */
    public getDataMapping(): AgentDataMapping {
        return { ...this.dataMapping };
    }

    /**
     * Load data array from file and convert to AgentDataMapping
     * @param filePath - Path to the userQueryAnalysis.txt file
     * @returns AgentDataArray
     */
    public static loadDataArrayFromFile(filePath: string = 'c:/repos/sagaMiddleware/data/userQueryAnalysis.txt'): AgentDataArray {
        try {
            console.log(`📖 Loading user query analysis from ${filePath}...`);

            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            // Parse JSON array: [{agentName, id, agentData}, ...]
            const dataArray: AgentDataArray = JSON.parse(fileContent);

            console.log(`✅ Loaded data for ${dataArray.length} agents from file`);

            return dataArray;

        } catch (error) {
            console.error('❌ Error loading user query analysis from file:', error);
            throw new Error(`Failed to load user query analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Set the data mapping (useful for testing with loaded data)
     * @param mapping - AgentDataMapping to set
     */
    public setDataMapping(mapping: AgentDataMapping): void {
        this.dataMapping = mapping;
        console.log(`✅ Data mapping set with ${Object.keys(mapping).length} entries`);
    }

    /**
     * Validate input (optional for this agent)
     */
    protected validateInput(_input: any): boolean {
        return true; // Input is provided via constructor
    }

    /**
     * Get input from context (not used for this agent)
     */
    protected getInput(): any {
        return null;
    }

    /**
     * Set context with the data mapping
     */
    public setContext(data: any): void {
        this.contextManager.updateContext(this.agentName, {
            lastTransactionResult: data,
            timestamp: new Date()
        });
    }
}
