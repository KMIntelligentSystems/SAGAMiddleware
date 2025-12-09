/**
 * Pipeline Configuration for Claude SDK Agents
 *
 * Defines the flow: DataProfiler -> AgentStructureGenerator -> D3JSCodeGenerator -> D3JSCodeValidator
 * Each SDK agent output feeds into a SAGA process that creates/executes GenericAgents
 */

export interface SDKAgentStep {
    transactionType: 'DataProfiler' | 'AgentStructureGenerator' | 'D3JSCodeGenerator' | 'D3JSCodeUpdater' | 'D3JSCodeValidator' |'AgentExecutor' | 'UserReview' | 'PythonCodeUpdater';
    name: string;
    description: string;
    inputFrom?: string; // Previous step's output
    outputKey?: string; // Key to store result in context
    processConfig: {
        processType: string;
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
            processConfig: {
                processType: 'agent',
                controlFlow: [
                    { agent: 'TransactionGroupingAgent', process: 'DefineUserRequirementsProcess', targetAgent: 'DataProfiler' }
                ]
            }
        },
        
        {
         transactionType: 'AgentStructureGenerator',
            name: 'AgentGenerationStep',
            description: 'Generate agent structures in [AGENT:...] format',
            processConfig: {
                processType: 'subAgent',
                controlFlow: [
                     { agent: 'DataProfiler', process: 'ExecuteGenericAgentsProcess', targetAgent: 'D3JSCodingAgent' }
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
                processType: 'subAgent',
                controlFlow: [
                  // { agent: 'ValidatingAgent', process: 'ValidationProcess', targetAgent: 'D3JSCoordinatingAgent' },
                //   { agent: 'D3JSCoordinatingAgent', process: 'D3JSCodingProcess', targetAgent: 'D3JSCodingAgent' },
                   { agent: 'D3JSCodingAgent', process: 'D3JSCodingProcess', targetAgent: 'ValidatingAgent' }
                ],
                testWithPlaywright: true 
            }
        },
        {
            transactionType: 'D3JSCodeValidator',
            name: 'D3CodeValidationStep',
            description: 'Validate D3.js code against requirements and SVG output',
            inputFrom: 'd3jsCode',
            outputKey: 'validatedCode',
            processConfig: {
                processType: 'agent',
                controlFlow: [
                     { agent: 'ValidatingAgent', process: 'ValidationProcess', targetAgent: 'D3JSCodeValidator'  },
                ],
               // Re-test with Playwright if code was corrected
            }
        },
        {
            transactionType: 'D3JSCodeUpdater',
            name: 'UpdateExistingCodeStep',
            description: 'Update existing D3 code based on user comments',
            outputKey: 'updatedCode',
            processConfig: {
                processType: 'subAgent',
                controlFlow: [
                     { agent: 'D3JSCodeValidator', process: 'ValidationProcess', targetAgent: 'D3JSCodingAgent'  },
                      { agent: 'D3JSCodingAgent', process: 'D3JSCodingProcess', targetAgent: 'ValidatingAgent' }
                ],
               // Re-test with Playwright if code was corrected
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
            transactionType: 'D3JSCodeUpdater',
            name: 'UpdateExistingCodeStep',
            description: 'Update existing D3 code based on user comments',
            outputKey: 'updatedCode',
            processConfig: {
                processType: 'agent',
                controlFlow: [
                    { agent: 'ConversationAgent', process: 'D3JSCodingProcess', targetAgent: 'D3JSCodeUpdater' }
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
    lastControlFlowResult?: any;
    lastSDKResult?: any;
    startTime: Date;
    endTime?: Date;
    errors: string[];
    completed: boolean;
}
