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
import { D3JSCodeGenerator } from '../agents/d3jsCodeGenerator.js';
import { D3JSCodeValidator } from '../agents/d3jsCodeValidator.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AgentResult } from '../types/index.js';

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
        input: string,
        pipelineExecutionState?: PipelineExecutionState
    ): Promise<PipelineExecutionState> {
        console.log(`🚀 Starting Pipeline: ${pipeline.name}`);
        console.log(`   Description: ${pipeline.description}`);
        console.log(`   Steps: ${pipeline.steps.length}`);

        // Initialize execution state with fresh context
        // SDK agents are stateless - only the last result matters
        this.state = {
            pipelineName: pipeline.name,
            currentStepIndex: 0,
            context: {
                input
            },
            startTime: new Date(),
            errors: [],
            completed: false
        };
          let result: AgentResult = {
               agentName: 'cycle_start',
               result: '',//visualizationGroupingAgentsResult groupingAgentResult,groupingAgentFailedResult,
               success: true,
               timestamp: new Date()
             };
        // Execute each step
        for (let i = 0; i < pipeline.steps.length; i++) {
            this.state.currentStepIndex = i;
            const step = pipeline.steps[i];

            console.log(`\n📍 Step ${i + 1}/${pipeline.steps.length}: ${step.name}`);
            console.log(`   Transaction Type: ${step.transactionType}`);
            console.log(`   Description: ${step.description}`);
            console.log('   Control Flow Steps:', step.processConfig.controlFlow.length);

            try {
                // Execute control flow for this step and capture result
                result = await this.executeStepControlFlow(step, result, pipelineExecutionState);

                if (!result.success) {
                    throw new Error(`Control flow failed: ${result.error || 'Unknown error'}`);
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
     * Instantiate SDK agent by transaction type
     */
    private instantiateAgent(transactionType: string): BaseSDKAgent {
        switch (transactionType) {
            case 'DataProfiler':
                return new DataProfiler();
            case 'AgentStructureGenerator':
                return new AgentStructureGenerator();
            case 'D3JSCodeGenerator':
                return new D3JSCodeGenerator();
            case 'D3JSCodeValidator':
                return new D3JSCodeValidator();
            default:
                throw new Error(`Unknown transaction type: ${transactionType}`);
        }
    }

    /**
     * Execute control flow for a pipeline step
     * This method orchestrates the execution of control flow steps and SDK agents
     */
    private async executeStepControlFlow(
        step: SDKAgentStep,
        previousResult: AgentResult,
        pipelineExecutionState?: PipelineExecutionState
    ): Promise<AgentResult> {
        console.log(`\n⚙️  Executing control flow for ${step.name}...`);

        // PHASE 1: Execute GenericAgent control flow
        // Initialize control flow in coordinator
        this.coordinator.initializeControlFlow(step.processConfig.controlFlow);

        // Determine input for control flow execution
        const input = this.determineStepInput(step, previousResult, pipelineExecutionState);

        // Execute the control flow through the coordinator
        console.log(`🔄 Starting control flow with ${step.processConfig.controlFlow.length} steps`);
        const controlFlowResult = await this.coordinator.executeControlFlow(input);

        console.log(`✅ Control flow execution complete`, controlFlowResult);

        // PHASE 2: Execute SDK Agent (uses control flow output)
        console.log(`\n🤖 Executing SDK Agent: ${step.transactionType}...`);
        const sdkAgent = this.instantiateAgent(step.transactionType);

        // Prepare input for SDK agent from control flow result
        const sdkInput = this.prepareSDKAgentInput(step, controlFlowResult, pipelineExecutionState);

        const sdkResult = await sdkAgent.execute(sdkInput);

        if (!sdkResult.success) {
            throw new Error(`SDK Agent ${step.transactionType} failed: ${sdkResult.error}`);
        }

        console.log(`✅ SDK Agent execution complete`);

        // Store only the latest SDK agent result
        // SDK agents are stateless - GenericAgents handle context management
        if (this.state) {
            this.state.context['COMPLETED'] = sdkResult.result;
            console.log(`💾 Stored latest SDK result in COMPLETED context`);
        }

        // Handle post-processing based on step configuration
        if (step.processConfig.renderVisualization && sdkResult.result) {
            await this.handleVisualizationRendering(step, sdkResult.result);
        }

        if (step.processConfig.testWithPlaywright) {
            await this.handlePlaywrightTesting(step);
        }

        console.log(`✅ Step complete: ${step.name}`);

        return sdkResult;
    }

    /**
     * Prepare input for SDK agent execution
     * SDK agents have different input requirements than control flow
     */
    private prepareSDKAgentInput(
        step: SDKAgentStep,
        controlFlowResult: AgentResult,
        pipelineExecutionState?: PipelineExecutionState
    ): any {
        // Different SDK agents have different input formats
        switch (step.transactionType) {
            case 'DataProfiler':
                // DataProfiler needs filepath + userRequirements
                return {
                    filepath: this.extractFilePath(controlFlowResult, pipelineExecutionState),
                    userRequirements: controlFlowResult.result
                };

            case 'AgentStructureGenerator':
            case 'D3JSCodeGenerator':
            case 'D3JSCodeValidator':
                // These agents take string input
                return typeof controlFlowResult.result === 'string'
                    ? controlFlowResult.result
                    : JSON.stringify(controlFlowResult.result);

            default:
                return controlFlowResult.result;
        }
    }

    /**
     * Extract file path from control flow result or pipeline state
     */
    private extractFilePath(
        controlFlowResult: AgentResult,
        pipelineExecutionState?: PipelineExecutionState
    ): string {
        // Check if filepath is in the control flow result
        if (typeof controlFlowResult.result === 'object' && controlFlowResult.result?.filepath) {
            return controlFlowResult.result.filepath;
        }

        // Check pipeline execution state for COMPLETED data with filepath
        if (pipelineExecutionState?.context['COMPLETED']) {
            const completed = pipelineExecutionState.context['COMPLETED'];
            if (typeof completed === 'object' && completed.filepath) {
                return completed.filepath;
            }
            if (typeof completed === 'string') {
                return completed;
            }
        }

        // Default to a standard test file path if not found
        return 'c:/repos/SAGAMiddleware/data/supply.csv';
    }

    /**
     * Determine the appropriate input for a step based on configuration and previous results
     */
    private determineStepInput(
        step: SDKAgentStep,
        previousResult: AgentResult,
        pipelineExecutionState?: PipelineExecutionState
    ): string {
        // Priority 1: If this is the first step of a new pipeline and previous pipeline has input,
        // use the input from previous pipeline
        if (pipelineExecutionState?.context['input'] && !previousResult.result) {
            console.log(`📥 Using input from previous pipeline`);
            return typeof pipelineExecutionState.context['input'] === 'string'
                ? pipelineExecutionState.context['input']
                : JSON.stringify(pipelineExecutionState.context['input']);
        }

        // Priority 2: If previous step in current pipeline has result, use that
        if (previousResult.result) {
            console.log(`📥 Using result from previous step in current pipeline`);
            return typeof previousResult.result === 'string'
                ? previousResult.result
                : JSON.stringify(previousResult.result);
        }

        // Priority 3: Fall back to initial input
        if (this.state) {
            console.log(`📥 Using initial pipeline input`);
            return this.state.context.input;
        }

        throw new Error(`Unable to determine input for step: ${step.name}`);
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
