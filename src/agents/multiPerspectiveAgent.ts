/**
 * Multi-Perspective Agent
 *
 * Extends BaseSDKAgent to provide multi-agent team analysis
 * Integrates team patterns into the existing agent architecture
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { ParallelTeam, ConsensusTeam, type TeamMember } from './teamOrchestrator.js';
import { AgentResult } from '../types/index.js';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

export interface MultiPerspectiveInput {
    task: string;
    filePath?: string;
    mode: 'analyze' | 'decide';
    options?: string[];  // For decision mode
}

/**
 * Agent that leverages team patterns for complex analysis
 * Can be used in SAGA workflows like any other agent
 */
export class MultiPerspectiveAgent extends BaseSDKAgent {
    constructor(contextManager?: any, nodeId?: string) {
        super('MultiPerspectiveAgent', 20, contextManager, nodeId);
    }

    protected buildPrompt(input: MultiPerspectiveInput): string {
        // This won't be used since we're delegating to team patterns
        // But required by BaseSDKAgent
        return input.task;
    }

    async execute(input: MultiPerspectiveInput): Promise<AgentResult> {
        console.log(`\n🎭 MultiPerspectiveAgent: Running in ${input.mode} mode\n`);

        try {
            let result: any;

            if (input.mode === 'analyze') {
                result = await this.runAnalysisMode(input);
            } else if (input.mode === 'decide') {
                result = await this.runDecisionMode(input);
            } else {
                throw new Error(`Unknown mode: ${input.mode}`);
            }

            // Store in context manager
            this.setContext({
                mode: input.mode,
                result: result,
                timestamp: new Date()
            });

            return {
                success: true,
                result: result,
                agentName: this.agentName,
                timestamp: new Date()
            };
        } catch (error) {
            console.error(`❌ ${this.agentName} failed:`, error);
            return {
                success: false,
                result: null,
                error: error instanceof Error ? error.message : String(error),
                agentName: this.agentName,
                timestamp: new Date()
            };
        }
    }

    /**
     * Analysis Mode: Multiple agents analyze from different perspectives
     */
    private async runAnalysisMode(input: MultiPerspectiveInput) {
        const team = this.createAnalysisTeam();
        const parallelTeam = new ParallelTeam(team, {
            model: this.options.model || 'sonnet',
            maxTurns: 10,
            permissionMode: this.options.permissionMode
        });

        const results = await parallelTeam.analyzeFromMultiplePerspectives(input.task);

        // Format results
        return {
            perspectives: results.map(r => ({
                agent: r.agentName,
                role: r.role,
                analysis: r.result,
                duration: r.duration,
                success: r.success
            })),
            summary: this.synthesizeAnalysis(results)
        };
    }

    /**
     * Decision Mode: Multiple agents vote on best option
     */
    private async runDecisionMode(input: MultiPerspectiveInput) {
        if (!input.options || input.options.length < 2) {
            throw new Error('Decision mode requires at least 2 options');
        }

        const team = this.createDecisionTeam();
        const consensusTeam = new ConsensusTeam(team, {
            model: this.options.model || 'sonnet',
            maxTurns: 10,
            permissionMode: this.options.permissionMode
        });

        const result = await consensusTeam.vote(
            input.task,
            input.options,
            'Consider: feasibility, maintainability, and impact'
        );

        return {
            decision: result.winner,
            votes: result.votes,
            confidence: this.calculateConfidence(result.votes),
            analysis: result.analysis
        };
    }

    /**
     * Create analysis team with different perspectives
     */
    private createAnalysisTeam(): TeamMember[] {
        return [
            {
                name: 'technical-analyst',
                role: 'Technical Analyst - evaluates feasibility and implementation',
                definition: {
                    description: 'Technical analysis specialist',
                    tools: ['Read', 'Grep'],
                    model: 'sonnet',
                    prompt: `You are a technical analyst.
Evaluate from a technical perspective: feasibility, complexity, dependencies, risks.
Be specific and actionable. Format your response with clear sections:
1. Technical Assessment
2. Key Risks
3. Implementation Considerations`
                }
            },
            {
                name: 'architecture-analyst',
                role: 'Architecture Analyst - evaluates system design and patterns',
                definition: {
                    description: 'Architecture specialist',
                    tools: ['Read', 'Grep'],
                    model: 'sonnet',
                    prompt: `You are an architecture analyst.
Evaluate from an architectural perspective: patterns, scalability, maintainability.
Be specific and actionable. Format your response with clear sections:
1. Architectural Assessment
2. Design Patterns to Consider
3. Long-term Implications`
                }
            },
            {
                name: 'quality-analyst',
                role: 'Quality Analyst - evaluates testability and reliability',
                definition: {
                    description: 'Quality assurance specialist',
                    tools: ['Read', 'Grep'],
                    model: 'sonnet',
                    prompt: `You are a quality analyst.
Evaluate from a quality perspective: testability, reliability, edge cases.
Be specific and actionable. Format your response with clear sections:
1. Quality Assessment
2. Testing Strategies
3. Potential Issues`
                }
            }
        ];
    }

    /**
     * Create decision team with different stakeholder perspectives
     */
    private createDecisionTeam(): TeamMember[] {
        return [
            {
                name: 'engineer',
                role: 'Software Engineer - prioritizes implementation and code quality',
                definition: {
                    description: 'Engineering perspective',
                    model: 'sonnet',
                    prompt: 'You are a senior software engineer. Evaluate options based on code quality, implementation complexity, and developer experience.'
                }
            },
            {
                name: 'architect',
                role: 'System Architect - prioritizes scalability and maintainability',
                definition: {
                    description: 'Architecture perspective',
                    model: 'sonnet',
                    prompt: 'You are a system architect. Evaluate options based on scalability, maintainability, and long-term architectural health.'
                }
            },
            {
                name: 'product',
                role: 'Product Manager - prioritizes user value and delivery speed',
                definition: {
                    description: 'Product perspective',
                    model: 'sonnet',
                    prompt: 'You are a product manager. Evaluate options based on user value, time to market, and business impact.'
                }
            }
        ];
    }

    /**
     * Synthesize multiple analyses into a summary
     */
    private synthesizeAnalysis(results: any[]): string {
        const successful = results.filter(r => r.success);

        if (successful.length === 0) {
            return 'All analyses failed';
        }

        const keyPoints: string[] = [];

        // Extract common themes
        keyPoints.push(`Analyzed from ${successful.length} perspectives:`);
        successful.forEach(r => {
            keyPoints.push(`- ${r.role}: ${r.result.substring(0, 150)}...`);
        });

        return keyPoints.join('\n');
    }

    /**
     * Calculate confidence score from vote distribution
     */
    private calculateConfidence(votes: Record<string, number>): number {
        const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
        const max = Math.max(...Object.values(votes));

        if (total === 0) return 0;

        // Confidence is higher when there's clear consensus
        return Math.round((max / total) * 100);
    }
}

/**
 * Example usage in a SAGA workflow node
 */
export async function exampleSagaIntegration() {
    const agent = new MultiPerspectiveAgent();

    // Example 1: Analysis mode
    const analysisResult = await agent.execute({
        task: `Analyze the sagaWorkflow.ts file for potential improvements:
- Performance optimizations
- Error handling
- Code organization`,
        filePath: 'c:/repos/SAGAMiddleware/src/workflows/sagaWorkflow.ts',
        mode: 'analyze'
    });

    console.log('\n📊 Analysis Results:');
    console.log(JSON.stringify(analysisResult.result, null, 2));

    // Example 2: Decision mode
    const decisionResult = await agent.execute({
        task: 'Choose the best approach for implementing retry logic in the SAGA workflow',
        mode: 'decide',
        options: [
            'Exponential backoff with max retries',
            'Fixed delay with circuit breaker',
            'Immediate retry with dead letter queue',
            'No automatic retries (manual intervention)'
        ]
    });

    console.log('\n🎯 Decision Results:');
    console.log('Winner:', decisionResult.result.decision);
    console.log('Confidence:', decisionResult.result.confidence + '%');
    console.log('Votes:', decisionResult.result.votes);
}

// Uncomment to run example
// exampleSagaIntegration().catch(console.error);
