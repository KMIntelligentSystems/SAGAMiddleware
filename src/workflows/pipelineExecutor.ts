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
import { D3JSCodeUpdater } from '../agents/d3jsCodeUpdater.js';
import { SagaCoordinator } from '../coordinator/sagaCoordinator.js';
import { AgentResult, WorkingMemory } from '../types/index.js';

export class PipelineExecutor {
    private coordinator: SagaCoordinator;
    private state: PipelineExecutionState | null = null;
    private finalResult: any;

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

        // Initialize execution state
        // SDK agents are stateless - only the last result matters
        this.state = {
            pipelineName: pipeline.name,
            currentStepIndex: 0,
            context: {
                input: input
            },
            lastControlFlowResult: pipelineExecutionState?.lastControlFlowResult,
            lastSDKResult: pipelineExecutionState?.lastSDKResult,
            startTime: new Date(),
            errors: [],
            completed: false
        };
        let result: AgentResult | null = null;

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
                const compositeResult = await this.executeStepControlFlow(step, result,this.state);

                if (!compositeResult.success) {
                    throw new Error(`Control flow failed: ${compositeResult.error || 'Unknown error'}`);
                }

                // Extract just the control flow result for passing to the next step
                // This prevents nested result structures
                // Control flow result is the primary result from GenericAgent execution
                result = compositeResult.result?.controlFlowResult || compositeResult;

                if (result) {
                    console.log('🔍 Debug - Extracted result:', JSON.stringify({
                        agentName: result.agentName,
                        resultType: typeof result.result,
                        hasControlFlowResult: !!compositeResult.result?.controlFlowResult,
                        resultPreview: typeof result.result === 'string'
                            ? result.result.substring(0, 100)
                            : JSON.stringify(result.result).substring(0, 100)
                    }));
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
        if(pipeline.steps[pipeline.steps.length-1].transactionType  === 'UserReview'){
            const ctx = this.coordinator.contextManager.getContext('ConversationAgent') as WorkingMemory;
 
            this.finalResult = ctx.lastTransactionResult;
        }
        this.state.completed = this.state.errors.length === 0;
        this.state.endTime = new Date();

        // Store the final control flow result in the state
        // Note: result now contains the control flow AgentResult from the last step
        if (result) {
            this.state.lastControlFlowResult = result;
            console.log('✅ Stored final control flow result in state.lastControlFlowResult:', this.state.lastControlFlowResult ? (typeof this.state.lastControlFlowResult.result === 'string' ? this.state.lastControlFlowResult.result.substring(0, 100) + '...' : 'object') : 'undefined');
        } else {
            console.log('⚠️  No result to store in state');
        }

        // Calculate execution duration
        const duration = this.state.endTime.getTime() - this.state.startTime.getTime();

        console.log(`\n${'='.repeat(70)}`);
        if (this.state.completed) {
            console.log(`✅ Pipeline Complete: ${pipeline.name}`);
            console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
        } else {
            console.log(`❌ Pipeline Failed: ${pipeline.name}`);
            console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
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
            case 'D3JSCodeUpdater':
                return new D3JSCodeUpdater(contextManager);
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
        previousResult: AgentResult | null,
        pipelineExecutionState?: PipelineExecutionState
    ): Promise<AgentResult> {
        console.log(`\n⚙️  Executing control flow for ${step.name}...`);

        // PHASE 1: Execute GenericAgent control flow
        // Initialize control flow in coordinator
        this.coordinator.initializeControlFlow(step.processConfig.controlFlow);

        // Determine input for control flow execution
        const userQuery = this.determineStepInput(step, previousResult, pipelineExecutionState);

        // Pass only userQuery and previousControlFlowResult
        // SDK agent results are already stored in contextManager by the processes
        const compositeInput = {
            userQuery,
            previousControlFlowResult: this.state?.lastControlFlowResult
        };
        console.log(`🔄 COMPOSITE INPUT ${JSON.stringify(compositeInput)}`);
        const controlFlowResult = await this.coordinator.executeControlFlow(compositeInput);

        console.log(`✅ Control flow execution complete`, controlFlowResult);

        // PHASE 2: Execute SDK Agent (uses control flow output)
        console.log(`\n🤖 Executing SDK Agent: ${step.transactionType}...`);
        let sdkResult: AgentResult;

        if(step.processConfig.processType === 'agent')
        {
            const sdkAgent = this.instantiateAgent(step.transactionType);

            // SDK agents read their input from contextManager via getInput()
            // The control flow process has already populated the context with required data
            sdkResult = await sdkAgent.execute({} as any);

            if (!sdkResult.success) {
                throw new Error(`SDK Agent ${step.transactionType} failed: ${sdkResult.error}`);
            }

            console.log(`✅ SDK Agent execution complete`);

            // If this is a DataProfiler, retrieve and log created agents
            if (step.transactionType === 'DataProfiler' && sdkAgent instanceof DataProfiler) {
                const createdAgents = sdkAgent.getCreatedAgents();
                console.log(`\n📊 DataProfiler created ${createdAgents.length} agents:`);
                createdAgents.forEach((agentInfo, idx) => {
                    console.log(`\n   ${idx + 1}. ${agentInfo.definition.name} (Order: ${agentInfo.order})`);
                    console.log(`      Type: ${agentInfo.definition.agentType}`);
                    console.log(`      LLM: ${agentInfo.definition.llmConfig.provider}/${agentInfo.definition.llmConfig.model}`);
                    console.log(`      Dependencies: ${agentInfo.definition.dependencies?.map(d => d.agentName).join(', ') || 'none'}`);
                    console.log(`      MCP Tools: ${agentInfo.definition.mcpTools?.join(', ') || 'none'}`);
                    console.log(`      Task Preview: ${agentInfo.definition.taskDescription}`);
                });
                console.log(`\n`);
                const serialized = JSON.stringify(createdAgents, null, 2);
                this.coordinator.contextManager.updateContext('FlowDefiningAgent', {
                    lastTransactionResult: serialized
                })
            }
            /*
                These contexts get updated:
                DataProfiler
                AgentStructureGenerator
                D3JSCodeGenerator
            */
           if(step.transactionType != 'D3JSCodeGenerator' ){
                  this.coordinator.contextManager.updateContext(step.transactionType, {
                lastTransactionResult: sdkResult.result,
                transactionId: step.transactionType,
                timestamp: new Date()
            });
           }

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


    getFinalResult(): any{
        return this.finalResult;
    }
    /**
     * Determine the appropriate input for a step based on configuration and previous results
     */
    private determineStepInput(
        step: SDKAgentStep,
        previousResult: AgentResult | null,
        pipelineExecutionState?: PipelineExecutionState
    ): string {
        // Priority 1: If this is the first step of a new pipeline and previous pipeline has input,
        // use the input from previous pipeline
        if (pipelineExecutionState?.context['input'] && (!previousResult || !previousResult.result)) {
            console.log(`📥 Using input from previous pipeline`);
            return typeof pipelineExecutionState.context['input'] === 'string'
                ? pipelineExecutionState.context['input']
                : JSON.stringify(pipelineExecutionState.context['input']);
        }

        // Priority 2: If previous step in current pipeline has result, combine input with previous result
        if (previousResult && previousResult.result && this.state) {
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
                    this.state.context.lastVisualizationSVGlastVisualizationSVG = renderResult.svgPath;
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
