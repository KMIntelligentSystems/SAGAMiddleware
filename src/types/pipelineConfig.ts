/**
 * Pipeline Configuration for Claude SDK Agents
 *
 * Defines the flow: DataProfiler -> AgentStructureGenerator -> D3JSCodeGenerator -> D3JSCodeValidator
 * Each SDK agent output feeds into a SAGA process that creates/executes GenericAgents
 */

export interface SDKAgentStep {
    transactionType: 'DataProfiler' | 'AgentStructureGenerator' | 'D3JSCodeGenerator' | 'D3JSCodeValidator';
    name: string;
    description: string;
    inputFrom?: string; // Previous step's output
    outputKey: string; // Key to store result in context
    processConfig: {
        controlFlow: ProcessFlowStep[];
        renderVisualization?: boolean;
        testWithPlaywright?: boolean;
    };
}

export interface ProcessFlowStep {
    agent: string;
    process: string;
    targetAgent?: string;
}

export interface PipelineConfig {
    name: string;
    description: string;
    steps: SDKAgentStep[];
    onComplete?: string; // Action to take when pipeline completes
}


/**
 * Data Profiling and Agent Generation Pipeline
 */
export const DATA_PROFILING_PIPELINE: PipelineConfig = {
    name: 'DataProfilingPipeline',
    description: 'Pipeline from data profiling to agent structure generation',
    steps: [
        {
            transactionType: 'DataProfiler',
            name: 'DataProfilingStep',
            description: 'Analyze CSV data and generate technical specifications',
            outputKey: 'profiledPrompt',
            processConfig: {
                controlFlow: [
                    { agent: 'TransactionGroupingAgent', process: 'DefineUserRequirementsProcess', targetAgent: 'DataProfiler' },
                    { agent: 'DataProfiler', process: 'DefineUserRequirementsProcess', targetAgent: 'FlowDefiningAgent' },
                    { agent: 'FlowDefiningAgent', process: 'FlowProcess', targetAgent: 'TransactionGroupingAgent' }
                ]
            }
        },
        {
            transactionType: 'AgentStructureGenerator',
            name: 'AgentGenerationStep',
            description: 'Generate agent structures in [AGENT:...] format',
            inputFrom: 'profiledPrompt',
            outputKey: 'agentStructures',
            processConfig: {
                controlFlow: [
                    { agent: 'TransactionGroupingAgent', process: 'AgentGeneratorProcess', targetAgent: 'FlowDefiningAgent'  },
                    { agent: 'FlowDefiningAgent', process: 'FlowProcess', targetAgent: 'TransactionGroupingAgent' }
                ]
            }
        }
    ],
    onComplete: 'proceed_to_visualization'
};

/**
 * D3 Visualization Generation and Validation Pipeline
 */
export const D3_VISUALIZATION_PIPELINE: PipelineConfig = {
    name: 'D3VisualizationPipeline',
    description: 'Pipeline for D3 code generation and validation',
    steps: [
        {
            transactionType: 'D3JSCodeGenerator',
            name: 'D3CodeGenerationStep',
            description: 'Generate D3.js visualization code',
            inputFrom: 'agentStructures',
            outputKey: 'd3jsCode',
            processConfig: {
                controlFlow: [
                    { agent: 'D3JSCoordinatingAgent', process: 'DefineUserRequirementsProcess', targetAgent: 'D3JSCodeGenerator'  },
                    { agent: 'D3JSCodeGenerator', process: 'D3JSCodingProcess', targetAgent: 'D3JSCoordinatingAgent' }
                ],
                renderVisualization: true // Render with Playwright after code generation
            }
        },
        {
            transactionType: 'D3JSCodeValidator',
            name: 'D3CodeValidationStep',
            description: 'Validate D3.js code against requirements and SVG output',
            inputFrom: 'd3jsCode',
            outputKey: 'validatedCode',
            processConfig: {
                controlFlow: [
                    { agent: 'D3JSCoordinatingAgent', process: 'D3JSCodingProcess', targetAgent: 'D3JSCodeValidator' }
                ],
                testWithPlaywright: true // Re-test with Playwright if code was corrected
            }
        }
    ],
    onComplete: 'send_to_user'
};

/**
 * Code Update Pipeline (for iteration/fixes)
 */
export const D3_CODE_UPDATE_PIPELINE: PipelineConfig = {
    name: 'D3CodeUpdatePipeline',
    description: 'Pipeline for updating existing D3 code based on feedback',
    steps: [
        {
            transactionType: 'D3JSCodeValidator',
            name: 'ValidateExistingCode',
            description: 'Validate and fix existing D3 code',
            outputKey: 'updatedCode',
            processConfig: {
                controlFlow: [
                    { agent: 'D3JSCodingAgent', process: 'D3JSCodingProcess', targetAgent: 'D3JSCoordinatingAgent' }
                ],
                renderVisualization: true,
                testWithPlaywright: true
            }
        }
    ],
    onComplete: 'send_to_user'
};

/**
 * Pipeline execution state
 */
export interface PipelineExecutionState {
    pipelineName: string;
    currentStepIndex: number;
    context: Record<string, any>;
    startTime: Date;
    errors: string[];
    completed: boolean;
}
