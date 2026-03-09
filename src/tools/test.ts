import { AgentPromptArray } from '../agents/promptGeneratorAgent.js'
import { Agent, AgentTool } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import * as fs from 'fs';
import * as path from 'path';
import { D3VisualizationOptions } from '../mcp/d3VisualizationClient.js';
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from  "@mariozechner/pi-coding-agent";

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
				  screenshotName: `validation-${Date.now()}.png`,
				 outputPath: 'C:/repos/SAGAMiddleware/output/d3-visualizations'
            }



const PLAYWRIGHT_TOOL = "http://127.0.0.1:3000/mcp";
;

const importServer: ServerDefinition = {
  name: 'playwright_set_content',
  command: { kind: 'http', url: new URL(PLAYWRIGHT_TOOL) },
};

const runtime = await createRuntime();
await runtime.registerDefinition(importServer)

const servers = await runtime.listServers()
console.log(servers)

//await runtime.connect(PLAYWRIGHT_TOOL)
const  mcport44erCallOptions = exportPlaywrightTool(options_)
 console.log(`✅ Route interception set up for: ${JSON.stringify(mcport44erCallOptions)}`);
 //await runtime.callTool('playwright_set_content','playwright_route_file',  mcport44erCallOptions);

//const serverInfo = await runtime.listTools('playwright_set_content')

 console.log('📄 Loading D3 HTML document via playwright_set_content...');
 const loadDocOptions: CallOptions = {args: {html:  options_.d3Code, waitUntil: 'networkidle', dataDir: 'C:/repos/sagamiddleware/'}}
await runtime.callTool('playwright_set_content','playwright_set_content',   loadDocOptions);

console.log('✅ D3 HTML document loaded successfully');

const outputDir = options_.outputPath || path.join(process.cwd(), 'output', 'd3-visualizations');
if (!fs.existsSync(outputDir)) {
	 fs.mkdirSync(outputDir, { recursive: true });
}
	 // Save PNG screenshot
const screenshotName = options_.screenshotName || `d3-visualization-${Date.now()}.png`;
const screenshotPath = path.join(outputDir, screenshotName);
console.log(`📸 Taking screenshot to ${screenshotPath}...`);

 const writeDocOptions: CallOptions = {args: {path: screenshotPath,  fullPage: true}}
await runtime.callTool('playwright_set_content','playwright_screenshot',    writeDocOptions);
		



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
			const urlPattern = `**/${filename}`;

			const mcport44erCallOptions: CallOptions = {args: { 
			urlPattern: urlPattern,
            filePath: 'c:/repos/sagamiddleware/data/Output_one_hour_normalized_daily_avg.csv',// options.csvFilename,
             contentType: '--allow-http'
		}}// 
	   
			
	return  mcport44erCallOptions
		}
}


 let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
//CREATE SESSION AGENT
/*const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd,
		scopedModels: options.scopedModels,
		resourceLoader,
		customTools: options.customTools,
		modelRegistry,
		initialActiveToolNames,
		extensionRunnerRef,
	});*/
/*
OPEN CLAW:
openclaw/src/agents/pi-embedded-runner/run/attempt.ts
  ({ session } = await createAgentSession({
        cwd: resolvedWorkspace,
        agentDir,
        authStorage: params.authStorage,
        modelRegistry: params.modelRegistry,
        model: params.model,
        thinkingLevel: mapThinkingLevel(params.thinkLevel),
        tools: builtInTools,
        customTools: allCustomTools,
        sessionManager,
        settingsManager,
        resourceLoader,
      }));
      applySystemPromptOverrideToSession(session, systemPromptText);
      if (!session) {
        throw new Error("Embedded agent session missing");
      }
      const activeSession = session;
*/
//TOOL
//pi-mono/packages/coding-agent/src/core/tools/read.ts
/*
const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

*/

/*export function createReadTool(cwd: string, options?: ReadToolOptions): AgentTool<typeof readSchema> {
	const autoResizeImages = options?.autoResizeImages ?? true;
	const ops = options?.operations ?? defaultReadOperations;

	return {
		name: "read",
		label: "read",
		description: `Read the contents of a file. Supports text files and images (jpg, png, gif, webp). Images are sent as attachments. For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
		parameters: readSchema,
		execute: async (
			_toolCallId: string,
			{ path, offset, limit }: { path: string; offset?: number; limit?: number },
			signal?: AbortSignal,
		) => {
			const absolutePath = resolveReadPath(path, cwd);

			return new Promise<{ content: (TextContent | ImageContent)[]; details: ReadToolDetails | undefined }>(
				(resolve, reject) => {
					// Check if already aborted
					if (signal?.aborted) {
						reject(new Error("Operation aborted"));
						return;
					}

					let aborted = false;

					// Set up abort handler
					const onAbort = () => {
						aborted = true;
						reject(new Error("Operation aborted"));
					};

					if (signal) {
						signal.addEventListener("abort", onAbort, { once: true });
					}

					// Perform the read operation
					(async () => {
						try {
							// Check if file exists
							await ops.access(absolutePath);

							// Check if aborted before reading
							if (aborted) {
								return;
							}

							const mimeType = ops.detectImageMimeType ? await ops.detectImageMimeType(absolutePath) : undefined;

							// Read the file based on type
							let content: (TextContent | ImageContent)[];
							let details: ReadToolDetails | undefined;

							if (mimeType) {
								// Read as image (binary)
								const buffer = await ops.readFile(absolutePath);
								const base64 = buffer.toString("base64");

								if (autoResizeImages) {
									// Resize image if needed
									const resized = await resizeImage({ type: "image", data: base64, mimeType });
									const dimensionNote = formatDimensionNote(resized);

									let textNote = `Read image file [${resized.mimeType}]`;
									if (dimensionNote) {
										textNote += `\n${dimensionNote}`;
									}

									content = [
										{ type: "text", text: textNote },
										{ type: "image", data: resized.data, mimeType: resized.mimeType },
									];
								} else {
									const textNote = `Read image file [${mimeType}]`;
									content = [
										{ type: "text", text: textNote },
										{ type: "image", data: base64, mimeType },
									];
								}
							} else {
								// Read as text
								const buffer = await ops.readFile(absolutePath);
								const textContent = buffer.toString("utf-8");
								const allLines = textContent.split("\n");
								const totalFileLines = allLines.length;

								// Apply offset if specified (1-indexed to 0-indexed)
								const startLine = offset ? Math.max(0, offset - 1) : 0;
								const startLineDisplay = startLine + 1; // For display (1-indexed)

								// Check if offset is out of bounds
								if (startLine >= allLines.length) {
									throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
								}

								// If limit is specified by user, use it; otherwise we'll let truncateHead decide
								let selectedContent: string;
								let userLimitedLines: number | undefined;
								if (limit !== undefined) {
									const endLine = Math.min(startLine + limit, allLines.length);
									selectedContent = allLines.slice(startLine, endLine).join("\n");
									userLimitedLines = endLine - startLine;
								} else {
									selectedContent = allLines.slice(startLine).join("\n");
								}

								// Apply truncation (respects both line and byte limits)
								const truncation = truncateHead(selectedContent);

								let outputText: string;

								if (truncation.firstLineExceedsLimit) {
									// First line at offset exceeds 30KB - tell model to use bash
									const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine], "utf-8"));
									outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${path} | head -c ${DEFAULT_MAX_BYTES}]`;
									details = { truncation };
								} else if (truncation.truncated) {
									// Truncation occurred - build actionable notice
									const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
									const nextOffset = endLineDisplay + 1;

									outputText = truncation.content;

									if (truncation.truncatedBy === "lines") {
										outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
									} else {
										outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
									}
									details = { truncation };
								} else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
									// User specified limit, there's more content, but no truncation
									const remaining = allLines.length - (startLine + userLimitedLines);
									const nextOffset = startLine + userLimitedLines + 1;

									outputText = truncation.content;
									outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
								} else {
									// No truncation, no user limit exceeded
									outputText = truncation.content;
								}

								content = [{ type: "text", text: outputText }];
							}

							// Check if aborted after reading
							if (aborted) {
								return;
							}

							// Clean up abort handler
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}

							resolve({ content, details });
						} catch (error: any) {
							// Clean up abort handler
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}

							if (!aborted) {
								reject(error);
							}
						}
					})();
				},
			);
		},
	};
}
*/