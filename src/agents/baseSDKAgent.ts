/**
 * BaseSDKAgent
 *
 * Base class for all Claude SDK agents (DataProfiler, AgentStructureGenerator, D3JSCodeGenerator, D3JSCodeValidator)
 * Provides common functionality and standardized interface
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { AgentResult } from '../types/index.js';
import { ContextManager } from '../sublayers/contextManager.js';


export abstract class BaseSDKAgent {
    protected options: Options;
    protected agentName: string;
    protected contextManager: ContextManager;

    constructor(agentName: string, maxTurns: number = 15, contextManager?: ContextManager) {
        this.agentName = agentName;
        this.options = {
            permissionMode: 'bypassPermissions',
            maxTurns: maxTurns,
            cwd: process.cwd(),
            model: 'sonnet'
        };
        // Use injected context manager or create a new one
        this.contextManager = contextManager || new ContextManager();
    }

    /**
     * Execute the SDK agent with given input
     * Must be implemented by child classes
     */
    abstract execute(input: any): Promise<AgentResult>;

    /**
     * Build the prompt for the SDK agent
     * Must be implemented by child classes
     */
    protected abstract buildPrompt(input: any): string;

    /**
     * Common query execution logic
     */
    protected async executeQuery(prompt: string): Promise<string> {
        console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
        console.log(`║  ${this.agentName.padEnd(61)} ║`);
        console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

        let result = '';
        let turnCount = 0;
     /*   const q = query({ prompt, options: this.options });

      

        for await (const message of q) {
            turnCount++;

            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
                console.log(`[RESULT] ${this.agentName} complete (${result.length} chars)\n`);
            } else if (message.type === 'assistant') {
                console.log(`[TURN ${turnCount}] Processing...`);
            }
        }

        if (!result) {
            throw new Error(`${this.agentName} failed to generate result`);
        }

        console.log('═'.repeat(67));
        console.log(`✅ ${this.agentName} complete\n`);*/

        return result;
    }

    /**
     * Validate input before execution
     * Can be overridden by child classes
     */
    protected validateInput(input: any): boolean {
        return input !== null && input !== undefined;
    }

    /**
     * Get agent name
     */
    getName(): string {
        return this.agentName;
    }

    /**
     * Get agent options
     */
    getOptions(): Options {
        return this.options;
    }

    /**
     * Update max turns if needed
     */
    setMaxTurns(maxTurns: number): void {
        this.options.maxTurns = maxTurns;
    }

    /**
     * Get the context manager instance
     */
    getContextManager(): ContextManager {
        return this.contextManager;
    }

    /**
     * Set context in the shared context manager
     */
    setContext(value: any){
         this.contextManager.updateContext(this.agentName, {
            lastTransactionResult: value,
            transactionId: 'tx-2',
            timestamp: new Date()
        });
    }
}
