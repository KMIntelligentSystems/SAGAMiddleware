/**
 * Conversation Agent to Agent Structures
 *
 * Connects user conversations to agent structure generation
 *
 * Flow:
 * 1. User sends request via conversation (OpenAI Assistant API)
 * 2. ConversationAgent interprets and formats the request
 * 3. AgentStructureGenerator creates agent definitions
 * 4. Workflow is saved and can be executed
 *
 * This provides a natural language interface to workflow generation
 */

import { ConversationManager, ThreadMessage } from '../services/conversationManager.js';
import { AgentStructureGenerator } from './agentStructureGenerator.js';
import { GeneratedWorkflowExecutor } from './executeGeneratedWorkflow.js';
import * as fs from 'fs';
import * as path from 'path';

interface ConversationRequest {
    threadId: string;
    userMessage: string;
}

/**
 * Conversation-driven Agent Structure Generator
 */
export class ConversationToAgentStructures {
    private conversationManager: ConversationManager;
    private structureGenerator: AgentStructureGenerator;
    private workflowExecutor: GeneratedWorkflowExecutor;

    constructor(assistantId?: string) {
        this.conversationManager = new ConversationManager(
            assistantId || process.env.ASSISTANT_ID || ''
        );
        this.structureGenerator = new AgentStructureGenerator();
        this.workflowExecutor = new GeneratedWorkflowExecutor();
    }

    /**
     * Process user request from conversation
     */
    async processUserRequest(request: ConversationRequest): Promise<string> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║     Conversation → Agent Structure Generation Pipeline         ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        try {
            // Step 1: Get conversation context
            console.log('📧 Step 1: Retrieving conversation context...');
            const messages = await this.conversationManager.listMessages(request.threadId);
            const conversationContext = this.extractConversationContext(messages, request.userMessage);
            console.log(`   ✅ Context extracted (${messages.length} messages)\n`);

            // Step 2: Format as task description
            console.log('📝 Step 2: Formatting task description...');
            const taskDescription = this.formatTaskDescription(conversationContext);
            console.log(`   ✅ Task formatted (${taskDescription.length} chars)\n`);

            // Step 3: Generate agent structures
            console.log('🤖 Step 3: Generating agent structures with Sonnet 4...');
            const workflowSpec = await this.structureGenerator.generateAgentStructures(taskDescription);
            console.log(`   ✅ Generated ${workflowSpec.agents.length} agents\n`);

            // Step 4: Save workflow
            console.log('💾 Step 4: Saving workflow specification...');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${workflowSpec.name.replace(/\s+/g, '_')}_${timestamp}.json`;
            const outputPath = path.join('./generated_workflows', filename);
            await this.structureGenerator.saveWorkflowSpec(workflowSpec, outputPath);
            console.log(`   ✅ Saved to: ${outputPath}\n`);

            // Step 5: Send response back to conversation
            console.log('💬 Step 5: Responding to user...');
            const response = this.buildUserResponse(workflowSpec, outputPath);
            await this.conversationManager.sendResponseToThread(request.threadId, response);
            console.log('   ✅ Response sent\n');

            return outputPath;

        } catch (error) {
            console.error('❌ Pipeline failed:', error);

            // Send error response to user
            const errorResponse = `I encountered an error while generating the workflow: ${error instanceof Error ? error.message : 'Unknown error'}`;
            await this.conversationManager.sendResponseToThread(request.threadId, errorResponse);

            throw error;
        }
    }

    /**
     * Process request and automatically execute workflow
     */
    async processAndExecute(request: ConversationRequest): Promise<void> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  Conversation → Generate → Execute (Full Pipeline)            ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        // Generate structures
        const workflowPath = await this.processUserRequest(request);

        // Ask user if they want to execute
        const confirmMessage = `
I've generated the workflow and saved it to: ${path.basename(workflowPath)}

The workflow includes:
${await this.getWorkflowSummary(workflowPath)}

Would you like me to execute this workflow now? Reply 'yes' to execute, or 'no' to review first.
`;

        await this.conversationManager.sendResponseToThread(request.threadId, confirmMessage);

        console.log('\n⏸️  Waiting for user confirmation to execute...\n');
    }

    /**
     * Execute a previously generated workflow
     */
    async executeWorkflow(workflowPath: string, threadId: string): Promise<void> {
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║              Executing Generated Workflow                      ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        try {
            // Notify user execution started
            await this.conversationManager.sendResponseToThread(
                threadId,
                '🚀 Starting workflow execution...'
            );

            // Load and execute
            const spec = this.workflowExecutor.loadWorkflow(workflowPath);
            await this.workflowExecutor.executeWorkflow(spec);

            // Send success message
            const successMessage = this.buildExecutionSuccessMessage(spec);
            await this.conversationManager.sendResponseToThread(threadId, successMessage);

        } catch (error) {
            // Send error message
            const errorMessage = `❌ Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            await this.conversationManager.sendResponseToThread(threadId, errorMessage);
            throw error;
        }
    }

    /**
     * Extract conversation context
     */
    private extractConversationContext(messages: ThreadMessage[], currentMessage: string): any {
        return {
            currentMessage,
            previousMessages: messages.slice(-5), // Last 5 messages for context
            messageCount: messages.length
        };
    }

    /**
     * Format conversation context as task description
     */
    private formatTaskDescription(context: any): string {
        const userMessage = context.currentMessage;

        // Build comprehensive task description from conversation
        let taskDescription = `User Request:\n${userMessage}\n\n`;

        // Add context from previous messages if available
        if (context.previousMessages && context.previousMessages.length > 0) {
            taskDescription += `\nConversation Context:\n`;
            context.previousMessages.forEach((msg: ThreadMessage, idx: number) => {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                const content = Array.isArray(msg.content)
                    ? msg.content.map(c => c.text?.value || '').join(' ')
                    : msg.content;
                taskDescription += `${role}: ${content}\n`;
            });
        }

        return taskDescription;
    }

    /**
     * Build response message for user
     */
    private buildUserResponse(workflowSpec: any, outputPath: string): string {
        const agentSummary = workflowSpec.agents.map((agent: any, idx: number) => {
            return `${idx + 1}. **${agent.agentDefinition.name}** (${agent.agentDefinition.agentType})\n   - ${agent.purpose}\n   - Model: ${agent.agentDefinition.llmConfig.model}`;
        }).join('\n\n');

        return `
✅ **Workflow Generated Successfully!**

**Workflow Name:** ${workflowSpec.name}
**Description:** ${workflowSpec.description}

**Generated Agents:**
${agentSummary}

**Execution Flow:**
${workflowSpec.executionFlow.join(' → ')}

**Output File:** \`${path.basename(outputPath)}\`

**Cost Estimate:**
- Planning (this step): ~$0.30 ✅ DONE
- Execution (when you run it): ~$0.05 per run

The workflow has been saved and is ready to execute. You can:
1. Review the generated structures in the JSON file
2. Execute the workflow using: \`executeGeneratedWorkflow\`
3. Modify the structures if needed before executing

Would you like me to execute this workflow now?
`;
    }

    /**
     * Build execution success message
     */
    private buildExecutionSuccessMessage(spec: any): string {
        return `
✅ **Workflow Execution Complete!**

**Workflow:** ${spec.name}

**Results:**
${spec.agents.map((agent: any, idx: number) => {
    return `${idx + 1}. ${agent.agentDefinition.name}: ✅ Completed`;
}).join('\n')}

**Output Files:**
${spec.context.outputFiles ? spec.context.outputFiles.map((f: string) => `- ${f}`).join('\n') : 'Check workflow context for outputs'}

**Cost:** ~$0.05 (using gpt-4o-mini)

The workflow has completed successfully! All agents executed and produced their expected outputs.
`;
    }

    /**
     * Get workflow summary
     */
    private async getWorkflowSummary(workflowPath: string): Promise<string> {
        const spec = this.workflowExecutor.loadWorkflow(workflowPath);
        return spec.agents.map((agent: any, idx: number) =>
            `  ${idx + 1}. ${agent.agentDefinition.name} (${agent.purpose})`
        ).join('\n');
    }
}

/**
 * Main function - Example usage
 */
export async function main() {
    // Check for required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY not set');
        process.exit(1);
    }

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ ERROR: OPENAI_API_KEY not set (needed for ConversationManager)');
        process.exit(1);
    }

    if (!process.env.ASSISTANT_ID) {
        console.error('❌ WARNING: ASSISTANT_ID not set, using default');
    }

    // Example: Process a user request
    const pipeline = new ConversationToAgentStructures();

    // Simulate a user request (in real usage, this comes from your event bus)
    const mockRequest: ConversationRequest = {
        threadId: 'thread_example_123',
        userMessage: `
I need to process energy data from a CSV file in two steps:

1. First, normalize the data from wide format to long format
   - Input: data/two_days.csv (has multi-row headers)
   - Output: data/filtered_energy_data.csv
   - Columns needed: date/time, installation, energy_source, MW

2. Then aggregate the normalized data by hour
   - Input: filtered_energy_data.csv
   - Calculate hourly averages for each installation and energy source
   - Output: data/hourly_energy_data.csv
   - Columns: date_hour, installation, energy_source, MW_avg

Both steps should use Python with pandas and execute via the MCP server.
        `
    };

    try {
        console.log('Example: Processing user request...\n');
        await pipeline.processAndExecute(mockRequest);

        console.log('\n' + '═'.repeat(70));
        console.log('✅ Pipeline completed successfully!');
        console.log('═'.repeat(70) + '\n');

    } catch (error) {
        console.error('\n✗ Pipeline failed:', error);
        process.exit(1);
    }
}

// Auto-run main when executed directly
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    main().catch(console.error);
}
