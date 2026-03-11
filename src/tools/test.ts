import { AgentPromptArray } from '../agents/promptGeneratorAgent.js'
import { Agent, AgentTool } from "@mariozechner/pi-agent-core";
import { getModel, type Model } from "@mariozechner/pi-ai";
import * as fs from 'fs';
import * as path from 'path';
import { D3VisualizationOptions } from '../mcp/d3VisualizationClient.js';
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type ToolDefinition 
} from  "@mariozechner/pi-coding-agent";
 import { Type, type TObject } from "@sinclair/typebox";
 
import { callOnce } from "mcporter";

import { createRuntime, createServerProxy, ServerDefinition, CallOptions  } from "mcporter";

import { createCallResult } from 'mcporter';
import { Command } from 'commander';

const d3Code = fs.readFileSync('C:/repos/SAGAMiddleware/data/codingAgentResult.txt', 'utf-8');
const csvData = fs.readFileSync('C:/repos/sagaMiddleware/data/Output_one_hour_normalized_daily_avg.csv', 'utf-8')
const csvFilename = 'c:/repos/sagamiddleware/data/Output_one_hour_normalized_daily_avg.csv'

const options_: D3VisualizationOptions = {
                d3Code: d3Code,
                csvData: csvData,
                csvFilename: csvFilename,
				 svgName: `validation-${Date.now()}.svg`,
				  screenshotName: `validation-${Date.now()}.png`,
				 outputPath: 'C:/repos/SAGAMiddleware/output/d3-visualizations'
            }



const PLAYWRIGHT_TOOL = "http://127.0.0.1:3000/mcp";


const outputDir = options_.outputPath || path.join(process.cwd(), 'output', 'd3-visualizations');
if (!fs.existsSync(outputDir)) {
	 fs.mkdirSync(outputDir, { recursive: true });
}

const screenshotName = options_.screenshotName || `d3-visualization-${Date.now()}.png`;
const screenshotPath = path.join(outputDir, screenshotName);

 const svgName = options_.svgName || `d3-visualization-${Date.now()}.svg`;
	  const svgPath = path.join(outputDir, svgName);
	  console.log(`💾 Saving SVG to ${svgPath}...`);

	  const writeSVG: CallOptions = {args: {path:  svgPath}}

const importServer: ServerDefinition = {
  name: 'playwright_set_content',
  command: { kind: 'http', url: new URL(PLAYWRIGHT_TOOL) },
};

const runtime = await createRuntime();
await runtime.registerDefinition(importServer)

const servers = await runtime.listServers()
//console.log(servers)
const allTools: ToolDefinition[] = [];
  const tools = await runtime.listTools('playwright_set_content', { includeSchema: true });
  console.log('TOOL NAME ',tools )
const server = 'playwright_set_content'
       for (const tool of tools) {
       allTools.push({
         name: tool.name,   // namespace to avoid collisions
         label: `${server}/${tool.name}`,
         description: tool.description ?? "",
         parameters: jsonSchemaToTypebox(tool.inputSchema),

         async execute(toolCallId, params: any, signal) {
           const result = await runtime.callTool(server, tool.name, { args: params });//params



//const loadDocOptions: CallOptions = {args: {html:  options_.d3Code, waitUntil: 'networkidle', dataDir: 'C:/repos/sagamiddleware/'}}
//await runtime.callTool('playwright_set_content','playwright_set_content',   loadDocOptions);

           // mcporter returns raw MCP envelope — extract text content
           const content = extractContent(result);

           return { content, details: { server, tool: tool.name } };
         },
       });
     }

// Pass custom tools directly
const { session } = await createAgentSession({
  customTools: allTools,
});

  session.subscribe((event) => {
     if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
       process.stdout.write(event.assistantMessageEvent.delta);
     }
   });


   const m: Model<any> = getModel('openai', 'gpt-5.3-codex')
  await session.agent.setModel(m)

   const params = {html:  options_.d3Code, waitUntil: 'networkidle', dataDir: 'C:/repos/sagamiddleware/'}
   const writeDocOptions: CallOptions = {args: {path: screenshotPath,  fullPage: true}}

   const prompt = `Your task is to make a tool calls to Playwright in three steps:
1.Call 'playwright_set_content'  tool with the args: "  ${JSON.stringify(params)}. Wait for the reply.
2.Call 'playwright_screenshot' tool with args:  "  ${JSON.stringify(writeDocOptions)}. Wait for the reply.
3.Call 'playwright_save_svg' tool with args:  "  ${JSON.stringify(writeSVG)}.`

   await session.prompt(prompt);//"Call the 'playwrigt_set_content' tool with the args: " + JSON.stringify(params)

 console.log(JSON.stringify(params))
   // 4. Cleanup
   session.dispose();
   await runtime.close();

   
//----------------------------------
//await runtime.connect(PLAYWRIGHT_TOOL)
/*const  mcport44erCallOptions = exportPlaywrightTool(options_)
 console.log(`✅ Route interception set up for: ${JSON.stringify(mcport44erCallOptions)}`);
 //await runtime.callTool('playwright_set_content','playwright_route_file',  mcport44erCallOptions);

//const serverInfo = await runtime.listTools('playwright_set_content')

 console.log('📄 Loading D3 HTML document via playwright_set_content...');
 const loadDocOptions: CallOptions = {args: {html:  options_.d3Code, waitUntil: 'networkidle', dataDir: 'C:/repos/sagamiddleware/'}}
await runtime.callTool('playwright_set_content','playwright_set_content',   loadDocOptions);

console.log('✅ D3 HTML document loaded successfully');

	 // Save PNG screenshot

console.log(`📸 Taking screenshot to ${screenshotPath}...`);


await runtime.callTool('playwright_set_content','playwright_screenshot',    writeDocOptions);
		

 
	  await runtime.callTool('playwright_set_content','playwright_save_svg',    writeSVG);

	  console.log('✅ Visualization complete!');
	  console.log(`  📸 PNG: ${screenshotPath}`);
	  console.log(`  💾 SVG: ${svgPath}`);

	  await runtime.close();


function exportPlaywrightTool(options: D3VisualizationOptions): CallOptions{
	 if (options.csvFilename) {
			console.log(`📡 Setting up route interception for CSV file: ${options.csvFilename}`);
	
			// Read CSV file from disk if path provided, or use provided data
			let csvContent: string;
			let  csvPath;
			if (options.csvData) {
			  csvContent = options.csvData;
			  console.log(`📂 Using provided CSV data (${csvContent.length} bytes)`);
			} else {
			  // Try to read from the csvFilename path
			  csvPath = path.isAbsolute(options.csvFilename)
				? options.csvFilename
				: path.join(process.cwd(), 'data', options.csvFilename);
	
			  if (fs.existsSync(csvPath)) {
				csvContent = fs.readFileSync(csvPath, 'utf-8');
				console.log(`📂 Read CSV file from: ${csvPath} (${csvContent.length} bytes)`);
			  } else {
				console.warn(`⚠️ CSV file not found at: ${csvPath}`);
				throw new Error(`CSV file not found: ${csvPath}`);
			  }
			}
	
			// Use wildcard pattern to match the CSV file regardless of path
			const filename = path.basename(options.csvFilename);
			const urlPattern = `** /${filename}`;

			const mcport44erCallOptions: CallOptions = {args: { 
			urlPattern: urlPattern,
            filePath: 'c:/repos/sagamiddleware/data/Output_one_hour_normalized_daily_avg.csv',// options.csvFilename,
             contentType: '--allow-http'
		}}// 
	   
			
	return  mcport44erCallOptions
		}
}*/

function jsonSchemaToTypebox(schema: unknown): TObject {
     const s = schema as any;
     if (!s?.properties) return Type.Object({});

     const props: Record<string, any> = {};
     const required = new Set(s.required ?? []);

     for (const [key, value] of Object.entries(s.properties)) {
       const v = value as any;
       let field: any;

       switch (v.type) {
         case "string":  field = Type.String({ description: v.description }); break;
         case "number":
         case "integer": field = Type.Number({ description: v.description }); break;
         case "boolean": field = Type.Boolean({ description: v.description }); break;
         case "array":   field = Type.Array(Type.Unknown(), { description: v.description }); break;
         case "object":  field = Type.Unknown({ description: v.description }); break;
         default:        field = Type.Unknown({ description: v.description }); break;
       }

       props[key] = required.has(key) ? field : Type.Optional(field);
     }

     return Type.Object(props);
   }

   function extractContent(result: unknown): Array<{ type: "text"; text: string }> {
     // MCP results have { content: [{ type: "text", text: "..." }, ...] }
     const r = result as any;
     if (r?.content && Array.isArray(r.content)) {
       return r.content
         .filter((c: any) => c.type === "text")
         .map((c: any) => ({ type: "text" as const, text: c.text }));
     }
     // Fallback: stringify the whole thing
     return [{ type: "text", text: JSON.stringify(result, null, 2) }];
   }


 