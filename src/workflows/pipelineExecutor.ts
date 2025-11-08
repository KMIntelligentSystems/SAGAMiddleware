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
import { AgentResult, WorkingMemory } from '../types/index.js';

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
        // If pipelineExecutionState is provided, extract lastControlFlowResult
        console.log('🔍 Debug - Initializing new pipeline state');
        console.log('🔍 Debug - pipelineExecutionState provided:', pipelineExecutionState ? 'YES' : 'NO');
        console.log('🔍 Debug - pipelineExecutionState.lastSDKResult:', pipelineExecutionState?.lastSDKResult ? (typeof pipelineExecutionState.lastSDKResult === 'string' ? pipelineExecutionState.lastSDKResult.substring(0, 100) + '...' : 'object') : 'undefined');

        this.state = {
            pipelineName: pipeline.name,
            currentStepIndex: 0,
            context: {
                input
            },
            lastControlFlowResult: pipelineExecutionState?.lastControlFlowResult,
            lastSDKResult: pipelineExecutionState?.lastSDKResult,
            startTime: new Date(),
            errors: [],
            completed: false
        };

        console.log('🔍 Debug - New state.lastSDKResult:', this.state.lastSDKResult ? (typeof this.state.lastSDKResult === 'string' ? this.state.lastSDKResult.substring(0, 100) + '...' : 'object') : 'undefined');
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
                result = await this.executeStepControlFlow(step, result,this.state);

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

        // Store the final composite agent result in the state
        if (result && result.result) {
            this.state.lastControlFlowResult = result.result.controlFlowResult;
            this.state.lastSDKResult = result.result.sdkResult;
            console.log('✅ Stored in state.lastControlFlowResult:', this.state.lastControlFlowResult ? 'exists' : 'undefined');
            console.log('✅ Stored in state.lastSDKResult:', this.state.lastSDKResult ? (typeof this.state.lastSDKResult === 'string' ? this.state.lastSDKResult.substring(0, 100) + '...' : 'object') : 'undefined');
        } else {
            console.log('⚠️  No result to store in state');
        }

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
     * Injects the coordinator's context manager for shared context access
     */
    private instantiateAgent(transactionType: string): BaseSDKAgent {
        const contextManager = this.coordinator.contextManager;

        switch (transactionType) {
            case 'DataProfiler':
                return new DataProfiler(contextManager);
            case 'AgentStructureGenerator':
                return new AgentStructureGenerator(contextManager);
            case 'D3JSCodeGenerator':
                return new D3JSCodeGenerator(contextManager);
            case 'D3JSCodeValidator':
                return new D3JSCodeValidator(contextManager);
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
        const userQuery = this.determineStepInput(step, previousResult, pipelineExecutionState);

        // Execute the control flow through the coordinator
        // Pass composite input with previous results if this is a chained pipeline
        console.log(`🔄 Starting control flow with ${step.processConfig.controlFlow.length} steps`);
        console.log(`🔍 Debug - state.lastControlFlowResult:`, this.state?.lastControlFlowResult ? 'exists' : 'undefined');
        console.log(`🔍 Debug - state.lastSDKResult:`, this.state?.lastSDKResult ? 'exists' : 'undefined');
        console.log(`🔍 Debug - state.lastSDKResult.result:`, this.state?.lastSDKResult?.result ? (typeof this.state.lastSDKResult.result === 'string' ? this.state.lastSDKResult.result.substring(0, 100) + '...' : 'object') : 'undefined');

        const compositeInput = {
            userQuery,
            previousControlFlowResult: this.state?.lastControlFlowResult,
            previousSDKResult: this.state?.lastSDKResult?.result  // Extract just the result, not the whole AgentResult
        };
        const controlFlowResult = await this.coordinator.executeControlFlow(compositeInput);

        console.log(`✅ Control flow execution complete`, controlFlowResult);

        // PHASE 2: Execute SDK Agent (uses control flow output)
        console.log(`\n🤖 Executing SDK Agent: ${step.transactionType}...`);
        let sdkResult: AgentResult;

        if(step.processConfig.processType === 'agent')
        {
            const sdkAgent = this.instantiateAgent(step.transactionType);

            // Prepare input for SDK agent from control flow result
            const sdkInput = this.prepareSDKAgentInput(step, controlFlowResult, pipelineExecutionState);

            sdkResult = await sdkAgent.execute(sdkInput);

            if (!sdkResult.success) {
                throw new Error(`SDK Agent ${step.transactionType} failed: ${sdkResult.error}`);
            }

            console.log(`✅ SDK Agent execution complete`);
            this.coordinator.contextManager.updateContext(step.transactionType, {
                lastTransactionResult: sdkResult.result,
                transactionId: step.transactionType,
                timestamp: new Date()
            });
            console.log(`💾 Stored SDK result in context manager under key: ${step.transactionType}`);
        } else {
            // If processType is not 'agent', create a result from control flow only
            console.log(`⚠️  Process type is not 'agent', using control flow result only`);
            sdkResult = {
                agentName: step.transactionType,
                result: controlFlowResult.result,
                success: true,
                timestamp: new Date()
            };
        }

        // Store SDK result in context manager immediately so next step's control flow can access it
       

        // Debug: Verify the result was stored
        const verification = this.coordinator.contextManager.getContext(step.transactionType);
        console.log(`🔍 Debug - Verification: ${step.transactionType} context exists:`, verification ? 'YES' : 'NO');
        if (verification) {
            console.log(`🔍 Debug - Has lastTransactionResult:`, verification.lastTransactionResult ? 'YES' : 'NO');
        }

        // Store only the latest SDK agent result in pipeline state
        // SDK agents are stateless - GenericAgents handle context management
        if (this.state) {
            this.state.context['COMPLETED'] = sdkResult.result;
            this.state.lastControlFlowResult = controlFlowResult;
            this.state.lastSDKResult = sdkResult;
            console.log(`💾 Stored latest SDK result in COMPLETED context`);
        }

        if (step.processConfig.testWithPlaywright) {
           const codeString = typeof sdkResult.result === 'string'
               ? sdkResult.result
               : JSON.stringify(sdkResult.result);
           const svgPath = await this.handlePlaywrightTesting(step, codeString);
           sdkResult.result = {'D3 JS CODE: ': sdkResult.result, 'SVG PATH: ': svgPath}
        }

        console.log(`✅ Step complete: ${step.name}`);

        // Return composite result containing both control flow and SDK agent results
        const compositeResult: AgentResult = {
            agentName: sdkResult.agentName,
            result: {
                controlFlowResult: controlFlowResult,
                sdkResult: sdkResult.result
            },
            success: sdkResult.success,
            error: sdkResult.error,
            timestamp: sdkResult.timestamp
        };

        return compositeResult;
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
        console.log('LAST RESULT ', controlFlowResult)

        // Different SDK agents have different input formats
        switch (step.transactionType) {
            case 'DataProfiler':
                // DataProfiler needs filepath + userRequirements
                console.log('DATAFILER ', controlFlowResult)
                const ctx = this.coordinator.contextManager.getContext('DataProfiler') as WorkingMemory
                console.log('CTX ', ctx.lastTransactionResult)
                return {
                    filepath: ctx.lastTransactionResult.filepath,//this.extractFilePath(controlFlowResult, pipelineExecutionState),
                    userRequirements: ctx.lastTransactionResult.userRequirements//controlFlowResult.result
                };

            case 'D3JSCodeGenerator': {
                // D3JSCodeGenerator needs structured input with filepath and userRequirements
                // Control flow result has nested structure: result.result contains the actual data
                const actualResult = controlFlowResult.result?.result || controlFlowResult.result;

                // Parse the result if it's a JSON string
                let parsedResult = actualResult;
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
                };
            }

            case 'AgentStructureGenerator':
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

        // Priority 2: If previous step in current pipeline has result, combine input with previous result
        if (previousResult.result && this.state) {
            console.log(`📥 Combining original input with previous step result`);
            const compositeInput = {
                input: this.state.context.input,
                previousResult: previousResult.result
            };
            return JSON.stringify(compositeInput);
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
    private async handlePlaywrightTesting(step: SDKAgentStep, d3Code: string): Promise<any> {
        console.log(`\n🎨 Rendering visualization with Playwright...`);
        let renderResult;
       try {
            renderResult = await this.coordinator.renderD3Visualization(
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
        return renderResult?.svgPath
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
