/**
 * PipelineExecutor
 *
 * Executes SDK agent pipelines with integration to SAGA processes
 * Manages the flow: SDK Agent -> SAGA Process -> Next SDK Agent
 */

import { PipelineConfig, PipelineExecutionState, SDKAgentStep } from '../types/pipelineConfig.js';
import { BaseSDKAgent } from '../agents/baseSDKAgent.js';
import { DataProfiler } from '../agents/dataProfiler.js';
import { AgentStructureGenerator } from '../agents/agentStructureGenerator.js';
import { D3JSCodeProfiler } from '../agents/d3jsCodeProfiler.js';
import { D3JSCodeValidator } from '../agents/d3jsCodeValidator.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';

export class PipelineExecutor {
    private coordinator: SagaCoordinator;
    private state: PipelineExecutionState | null = null;

    constructor(coordinator: SagaCoordinator) {
        this.coordinator = coordinator;
    }

    /**
     * Execute a complete pipeline
     */
    async executePipeline(
        pipeline: PipelineConfig,
        initialInput: any
    ): Promise<PipelineExecutionState> {
        console.log(`🚀 Starting Pipeline: ${pipeline.name}`);
        console.log(`   Description: ${pipeline.description}`);
        console.log(`   Steps: ${pipeline.steps.length}`);

        // Initialize execution state
        this.state = {
            pipelineName: pipeline.name,
            currentStepIndex: 0,
            context: {
                initialInput
            },
            startTime: new Date(),
            errors: [],
            completed: false
        };

        // Execute each step
        for (let i = 0; i < pipeline.steps.length; i++) {
            this.state.currentStepIndex = i;
            const step = pipeline.steps[i];

            console.log(`\n📍 Step ${i + 1}/${pipeline.steps.length}: ${step.name}`);
            console.log(`   Agent: ${step.agentType}`);
            console.log(`   Description: ${step.description}`);

            try {
                 this.coordinator.initializeControlFlow( step.processConfig.controlFlow);
                 let result = await this.coordinator.executeControlFlow(initialInput);
                console.log('🔍 Result from executeControlFlow:', JSON.stringify(result, null, 2));
                console.log('🔍 result.result type:', typeof result.result);
                console.log('🔍 result.result value:', result.result);
                // Execute SDK agent
                const agent = this.instantiateAgent(step.agentType);
                const input = this.prepareAgentInput(step, result.result);
                console.log('🔍 Input prepared for agent:', JSON.stringify(input, null, 2));

                console.log(`\n🤖 Executing SDK Agent: ${step.agentType}...`);
                const agentResult = await agent.execute(input);

                if (!agentResult.success) {
                    throw new Error(`SDK Agent failed: ${agentResult.error}`);
                }

                // Store agent output in context
                this.state.context[step.outputKey] = agentResult.output;
                console.log(`✅ SDK Agent complete. Output stored in: ${step.outputKey}`);

                // Execute associated SAGA process if defined
                if (step.process && step.processConfig) {
                    console.log(`\n⚙️  Executing SAGA Process: ${step.process}...`);

                    // Initialize control flow for this step
                    this.coordinator.initializeControlFlow(step.processConfig.controlFlow);

                    // Execute the process
                    const processResult = await this.coordinator.executeControlFlow(
                        this.state.context.initialInput
                       /* agentResult.output*/
                    );

                    this.state.context[`${step.outputKey}_processResult`] = processResult;
                    console.log(`✅ SAGA Process complete`);

                    // Handle Playwright rendering if configured
                    if (step.processConfig.renderVisualization) {
                        await this.handleVisualizationRendering(step, agentResult.output);
                    }

                    // Handle Playwright testing if configured
                    if (step.processConfig.testWithPlaywright) {
                        await this.handlePlaywrightTesting(step);
                    }
                }

                console.log(`\n✅ Step ${i + 1} complete\n`);

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Step ${i + 1} failed: ${errorMsg}`);
                this.state.errors.push(`Step ${i + 1} (${step.name}): ${errorMsg}`);

                // Decide whether to continue or stop
                // For now, we stop on first error
                break;
            }
        }

        this.state.completed = this.state.errors.length === 0;

        console.log(`\n${'='.repeat(70)}`);
        if (this.state.completed) {
            console.log(`✅ Pipeline Complete: ${pipeline.name}`);
        } else {
            console.log(`❌ Pipeline Failed: ${pipeline.name}`);
            console.log(`   Errors: ${this.state.errors.length}`);
            this.state.errors.forEach((err, idx) => {
                console.log(`   ${idx + 1}. ${err}`);
            });
        }
        console.log(`${'='.repeat(70)}\n`);

        return this.state;
    }

    /**
     * Instantiate SDK agent by type
     */
    private instantiateAgent(agentType: string): BaseSDKAgent {
        switch (agentType) {
            case 'DataProfiler':
                return new DataProfiler();
            case 'AgentStructureGenerator':
                return new AgentStructureGenerator();
            case 'D3JSCodeProfiler':
                return new D3JSCodeProfiler();
            case 'D3JSCodeValidator':
                return new D3JSCodeValidator();
            default:
                throw new Error(`Unknown agent type: ${agentType}`);
        }
    }

    /**
     * Prepare input for SDK agent based on step configuration
     */
    private prepareAgentInput(step: SDKAgentStep, context: any): any {
        if (step.inputFrom) {
            // Get input from previous step's output
            const input = context[step.inputFrom];
            console.log('INPUT  ', input)
            if (!input) {
                throw new Error(`Input key '${step.inputFrom}' not found in context`);
            }
            return { input };
        } else {
            // If context is already a DataProfileInput object (has filepath and userRequirements), return it directly
            if (context && typeof context === 'object' && 'filepath' in context && 'userRequirements' in context) {
                console.log('Detected DataProfileInput object, returning directly');
                return context;
            }
            // Use initial input
            return context.initialInput || context;
        }
    }

    /**
     * Handle visualization rendering with Playwright
     */
    private async handleVisualizationRendering(step: SDKAgentStep, d3Code: string): Promise<void> {
        console.log(`\n🎨 Rendering visualization with Playwright...`);

        try {
            const renderResult = await this.coordinator.renderD3Visualization(
                d3Code,
                step.name,
                `${step.name}-${Date.now()}`
            );

            if (renderResult.success) {
                console.log(`✅ Visualization rendered`);
                console.log(`   PNG: ${renderResult.screenshotPath}`);
                console.log(`   SVG: ${renderResult.svgPath}`);

                // Store paths in context
                if (this.state) {
                    this.state.context.lastVisualizationPNG = renderResult.screenshotPath;
                    this.state.context.lastVisualizationSVG = renderResult.svgPath;
                }
            } else {
                console.warn(`⚠️  Visualization rendering failed: ${renderResult.error}`);
            }
        } catch (error) {
            console.error(`❌ Error rendering visualization:`, error);
        }
    }

    /**
     * Handle Playwright testing for validation
     */
    private async handlePlaywrightTesting(step: SDKAgentStep): Promise<void> {
        console.log(`\n🧪 Testing with Playwright...`);

        // If validator returned corrected code, render it again for testing
        if (this.state && this.state.context[step.outputKey]) {
            const output = this.state.context[step.outputKey];

            // Check if output is corrected code (not success message)
            if (!output.includes('Requirements achieved')) {
                console.log(`   Re-rendering corrected code...`);
                await this.handleVisualizationRendering(step, output);
            } else {
                console.log(`   ✅ Code validated successfully, no re-test needed`);
            }
        }
    }

    /**
     * Get current execution state
     */
    getState(): PipelineExecutionState | null {
        return this.state;
    }

    /**
     * Get output from context by key
     */
    getOutput(key: string): any {
        return this.state?.context[key];
    }
}
