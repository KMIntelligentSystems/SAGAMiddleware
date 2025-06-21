import { HumanInteractionService } from '../services/humanInteractionService.js';
import { SAGAPersistenceManager } from '../services/sagaPersistenceManager.js';
import { SAGAEventBusClient } from '../eventBus/sagaEventBusClient.js';
import { RequirementsService } from '../services/requirementsService.js';
import { DataAnalysisService } from '../services/dataAnalysisService.js';
import { EnhancedCodingService } from '../services/enhancedCodingService.js';
import {
  HumanInLoopConfig,
  HumanInLoopSAGAState,
  EnhancedSAGAState,
  ApprovalArtifacts,
  ChartSpecification,
  CodeArtifacts,
  FinalDeliverable,
  HumanApprovedResult,
  RequirementsArtifact,
  DataAnalysisArtifact,
  EnhancedHumanDecision,
  HumanFeedback,
  InteractiveDemo
} from '../types/humanInLoopSaga.js';
import { VisualizationWorkflowRequest } from '../types/visualizationSaga.js';
import { BrowserGraphRequest } from '../eventBus/types.js';

import { DataPreprocessor } from '../preprocessing/dataPreprocessor.js'

/**
 * Human-in-the-loop coordinator focused on browser interaction via event bus
 */
export class HumanInLoopBrowserCoordinator {
  private humanInteractionService: HumanInteractionService;
  private persistenceManager: SAGAPersistenceManager;
  private eventBusClient: SAGAEventBusClient;
  private requirementsService: RequirementsService;
  private dataAnalysisService: DataAnalysisService;
  private enhancedCodingService: EnhancedCodingService;
  private config: HumanInLoopConfig;
  private dataProcessor: DataPreprocessor = new DataPreprocessor();

  constructor(config: HumanInLoopConfig) {
    this.config = config;
    this.humanInteractionService = new HumanInteractionService(config);
    this.persistenceManager = new SAGAPersistenceManager(config);
    this.eventBusClient = new SAGAEventBusClient(config.eventBus.url);
    this.requirementsService = new RequirementsService();
    this.dataAnalysisService = new DataAnalysisService();
    this.enhancedCodingService = new EnhancedCodingService();
    
    this.setupEventBusListener(); // Listen for browser requests
  }

  /**
   * Execute enhanced human-in-the-loop SAGA with distributed services
   */
  async executeEnhancedBrowserSAGA(
    browserRequest: BrowserGraphRequest,
    enableHumanLoop: boolean = true
  ): Promise<HumanApprovedResult> {
    const transactionId = browserRequest.requestId || `enhanced_saga_${Date.now()}`;
    const startTime = new Date();

    console.log(`🚀 Starting Enhanced Human-in-the-Loop Browser SAGA: ${transactionId}`);
    
    // Initialize enhanced SAGA state
    const sagaState: EnhancedSAGAState = {
      id: transactionId,
      transactionId,
      status: 'initializing',
      startTime,
      lastActivity: startTime,
      humanDecisions: [],
      services: new Map([
        ['requirements-service', { name: 'requirements-service', status: 'pending', compensationActions: [] }],
        ['data-analysis-service', { name: 'data-analysis-service', status: 'pending', compensationActions: [] }],
        ['coding-service', { name: 'coding-service', status: 'pending', compensationActions: [] }],
        ['user-interaction-service', { name: 'user-interaction-service', status: 'pending', compensationActions: [] }]
      ]),
      pendingServices: ['requirements-service'],
      completedServices: [],
      failedServices: [],
      persistenceKey: '',
      lastCheckpoint: startTime,
      checkpoints: [],
      timeoutStrategy: this.config.timeouts,
      artifacts: {},
      errors: [],
      compensations: [],
      browserContext: {
        originalRequest: browserRequest,
        refinementCycle: 0,
        userFeedback: []
      }
    };

    try {
      // Save initial state
      await this.persistenceManager.saveTransactionState(transactionId, sagaState);

      // Phase 1: Requirements Analysis Service
      console.log(`📋 Phase 1: Requirements Analysis...`);
      sagaState.status = 'requirements_pending';
      
      const requirements = await this.executeRequirementsService(browserRequest, sagaState);
      sagaState.artifacts.requirements = requirements;
      sagaState.services.get('requirements-service')!.status = 'completed';
      sagaState.completedServices.push('requirements-service');

      // Create checkpoint after requirements
      await this.persistenceManager.createCheckpoint(
        transactionId,
        'requirements-service',
        { requirements, browserRequest },
        true
      );

      if (enableHumanLoop) {
        // Human Checkpoint 1: Requirements Review
        console.log(`🤝 Human Checkpoint 1: Requirements Review`);
        const reqApprovalResult = await this.requestEnhancedHumanApproval(
          transactionId,
          'requirements_review',
          {
            requirements,
            originalRequest: browserRequest,
            preview: this.generateRequirementsPreview(requirements),
            recommendations: this.generateRequirementsRecommendations(requirements)
          }
        );

        if (reqApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'requirements_rejected', sagaState);
        }

        if (reqApprovalResult.decision === 'refine') {
          return await this.handleRequirementsRefinement(reqApprovalResult, browserRequest, sagaState);
        }
      }

      // Phase 2: Data Analysis Service  
      console.log(`📊 Phase 2: Data Analysis...`);
      sagaState.status = 'data_analysis_pending';
      sagaState.pendingServices = ['data-analysis-service'];

      const dataAnalysis = await this.executeDataAnalysisService(requirements, browserRequest, sagaState);
      sagaState.artifacts.dataAnalysis = dataAnalysis;
      sagaState.services.get('data-analysis-service')!.status = 'completed';
      sagaState.completedServices.push('data-analysis-service');

      // Create checkpoint after data analysis
      await this.persistenceManager.createCheckpoint(
        transactionId,
        'data-analysis-service',
        { requirements, dataAnalysis },
        true
      );

      if (enableHumanLoop) {
        // Human Checkpoint 2: Data Analysis Review
        console.log(`🤝 Human Checkpoint 2: Data Analysis Review`);
        const dataApprovalResult = await this.requestEnhancedHumanApproval(
          transactionId,
          'data_analysis_review',
          {
            dataAnalysis,
            requirements,
            sampleData: dataAnalysis.sampleData.slice(0, 10),
            dataQuality: dataAnalysis.dataQualityMetrics,
            recommendations: [dataAnalysis.recommendedVisualization.reasoning]
          }
        );

        if (dataApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'data_analysis_rejected', sagaState);
        }

        if (dataApprovalResult.decision === 'refine') {
          return await this.handleDataAnalysisRefinement(dataApprovalResult, sagaState);
        }
      }

      // Phase 3: Enhanced Coding Service
      console.log(`💻 Phase 3: Enhanced Code Generation...`);
      sagaState.status = 'code_pending';
      sagaState.pendingServices = ['coding-service'];

      const codeArtifacts = await this.executeEnhancedCodingService(requirements, dataAnalysis, sagaState);
      sagaState.artifacts.code = codeArtifacts;
      sagaState.services.get('coding-service')!.status = 'completed';
      sagaState.completedServices.push('coding-service');

      // Create interactive demo
      const interactiveDemo = await this.enhancedCodingService.createInteractiveDemo(codeArtifacts, dataAnalysis);

      // Create checkpoint after code generation
      await this.persistenceManager.createCheckpoint(
        transactionId,
        'coding-service',
        { requirements, dataAnalysis, codeArtifacts, interactiveDemo },
        true
      );

      if (enableHumanLoop) {
        // Human Checkpoint 3: Visualization Review
        console.log(`🤝 Human Checkpoint 3: Visualization Review`);
        const codeApprovalResult = await this.requestEnhancedHumanApproval(
          transactionId,
          'visualization_review',
          {
            codeArtifacts,
            interactiveDemo,
            preview: codeArtifacts.preview,
            dataQuality: dataAnalysis.dataQualityMetrics,
            sampleData: dataAnalysis.sampleData.slice(0, 5)
          }
        );

        if (codeApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'visualization_rejected', sagaState);
        }

        if (codeApprovalResult.decision === 'refine') {
          return await this.handleVisualizationRefinement(codeApprovalResult, sagaState);
        }
      }

      // Phase 4: Final Deliverable
      console.log(`📦 Phase 4: Preparing enhanced deliverable...`);
      sagaState.status = 'final_approval_pending';

      const finalArtifacts = await this.prepareEnhancedFinalArtifacts(
        requirements,
        dataAnalysis,
        codeArtifacts,
        interactiveDemo,
        browserRequest
      );
      sagaState.artifacts.final = finalArtifacts;

      if (enableHumanLoop) {
        // Human Checkpoint 4: Final Approval
        console.log(`🤝 Human Checkpoint 4: Final Approval & Sign-off`);
        const finalApprovalResult = await this.requestEnhancedHumanApproval(
          transactionId,
          'final_approval',
          {
            finalArtifacts,
            interactiveDemo,
            dataQuality: dataAnalysis.dataQualityMetrics,
            processingTime: Date.now() - startTime.getTime(),
            servicesUsed: sagaState.completedServices
          }
        );

        if (finalApprovalResult.decision === 'reject') {
          return await this.handleRejection(transactionId, 'final_rejected', sagaState);
        }
      }

      // Phase 5: Persist Final Artifacts
      console.log(`💾 Phase 5: Persisting enhanced artifacts...`);
      await this.persistFinalArtifacts(finalArtifacts, transactionId);

      // Complete transaction
      sagaState.status = 'completed';
      sagaState.endTime = new Date();
      sagaState.services.get('user-interaction-service')!.status = 'completed';
      sagaState.completedServices.push('user-interaction-service');

      await this.persistenceManager.saveTransactionState(transactionId, sagaState);

      const result: HumanApprovedResult = {
        success: true,
        transactionId,
        artifacts: finalArtifacts,
        processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
        humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
        servicesUsed: sagaState.completedServices,
        refinementCycles: sagaState.browserContext.refinementCycle
      };

      console.log(`🎉 Enhanced Human-in-the-Loop Browser SAGA completed successfully: ${transactionId}`);
      console.log(`⏱️  Total time: ${Math.round(result.processingTime / 1000)}s`);
      console.log(`🤝 Human interaction time: ${Math.round(result.humanInteractionTime / 1000)}s`);
      console.log(`🔄 Refinement cycles: ${result.refinementCycles}`);

      return result;

    } catch (error) {
      console.error(`💥 Enhanced SAGA failed: ${transactionId}`, error);
      return await this.handleFailure(transactionId, error, sagaState);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async executeHumanInLoopBrowserSAGA(
    workflowRequest: VisualizationWorkflowRequest,
    enableHumanLoop: boolean = true
  ): Promise<HumanApprovedResult> {
    // Convert legacy request to enhanced browser request
    const browserRequest: BrowserGraphRequest = {
      userQuery: workflowRequest.userQuery || 'Legacy visualization request',
      dataRequirements: {
        dateRange: {
          start: workflowRequest.visualizationRequest?.filters?.timeRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: workflowRequest.visualizationRequest?.filters?.timeRange?.end || new Date().toISOString()
        },
        outputFields: ['timestamp', 'output', 'type'],
        graphType: (workflowRequest.visualizationRequest?.chartPreferences?.type as any) || 'line',
        aggregation: workflowRequest.visualizationRequest?.filters?.aggregation || 'daily',
        dataRequirement: ``,
        codeRequirement: ``,
        csvPath: ``
      },
      dataSource: {
        collection: 'supply_analysis',
        filters: workflowRequest.visualizationRequest?.filters || {}
      },
      requestId: workflowRequest.workflowId || `legacy_${Date.now()}`,
      threadId: workflowRequest.threadId || `thread_${Date.now()}`,
      correlationId: workflowRequest.correlationId || `corr_${Date.now()}`
    };

    return this.executeEnhancedBrowserSAGA(browserRequest, enableHumanLoop);
  }

  /**
   * Execute requirements service to process user query and validate requirements
   */
  private async executeRequirementsService(
    browserRequest: BrowserGraphRequest,
    sagaState: EnhancedSAGAState
  ): Promise<RequirementsArtifact> {
    console.log(`📋 Executing Requirements Service...`);
    
    try {
      const requirements = await this.requirementsService.processUserQuery(
        browserRequest.userQuery,
        browserRequest
      );
      
      console.log(`✅ Requirements processed: ${requirements.extractedEntities.length} entities found`);
      return requirements;
    } catch (error) {
      console.error(`❌ Requirements service failed:`, error);
      throw error;
    }
  }

  /**
   * Execute data analysis service
   */
  private async executeDataAnalysisService(
    requirements: RequirementsArtifact,
    browserRequest: BrowserGraphRequest,
    sagaState: EnhancedSAGAState
  ): Promise<DataAnalysisArtifact> {
    console.log(`📊 Executing Data Analysis Service...`);
    
    try {
      const dataAnalysis = await this.dataAnalysisService.analyzeDataSource(
        requirements,
        browserRequest
      );
      
      console.log(`✅ Data analysis completed: ${dataAnalysis.sampleData.length} sample records`);
      return dataAnalysis;
    } catch (error) {
      console.error(`❌ Data analysis service failed:`, error);
      throw error;
    }
  }

  /**
   * Execute enhanced coding service
   */
  private async executeEnhancedCodingService(
    requirements: RequirementsArtifact,
    dataAnalysis: DataAnalysisArtifact,
    sagaState: EnhancedSAGAState
  ): Promise<CodeArtifacts> {
    console.log(`💻 Executing Enhanced Coding Service...`);
    
    try {
      const codeArtifacts = await this.enhancedCodingService.generateVisualizationCode(
        requirements,
        dataAnalysis
      );
      
      console.log(`✅ Enhanced code generated: ${codeArtifacts.dependencies.length} dependencies`);
      return codeArtifacts;
    } catch (error) {
      console.error(`❌ Enhanced coding service failed:`, error);
      throw error;
    }
  }

  /**
   * Request enhanced human approval with rich context
   */
  private async requestEnhancedHumanApproval(
    transactionId: string,
    stage: 'requirements_review' | 'data_analysis_review' | 'visualization_review' | 'final_approval',
    artifacts: any
  ): Promise<EnhancedHumanDecision> {
    console.log(`🎯 Requesting enhanced human approval for ${stage}...`);
    
    // Ensure artifacts has transactionId for compatibility with ApprovalArtifacts
    const enhancedArtifacts = {
      transactionId,
      ...artifacts
    };
    
    // Request approval via enhanced human interaction service
    const approvalToken = await this.humanInteractionService.requestEnhancedApproval(
      transactionId,
      stage,
      enhancedArtifacts
    );

    // Publish enhanced approval request event
    this.eventBusClient['publishEvent']('enhanced_human_approval_requested', {
      transactionId,
      humanStage: stage,
      interactionToken: approvalToken.token,
      approvalUrl: approvalToken.approvalUrl,
      artifacts: enhancedArtifacts,
      timeoutAt: approvalToken.expiresAt,
      enhancedFeatures: {
        hasPreview: !!enhancedArtifacts.preview,
        hasInteractiveDemo: !!enhancedArtifacts.interactiveDemo,
        hasDataQuality: !!enhancedArtifacts.dataQuality,
        hasRecommendations: !!enhancedArtifacts.recommendations
      }
    }, 'broadcast');

    // Wait for human decision (in real implementation, this would be event-driven)
    console.log(`⏳ Waiting for enhanced human decision... (Timeout: ${approvalToken.expiresAt.toISOString()})`);
    console.log(`🔗 Enhanced approval URL: ${approvalToken.approvalUrl}`);
    
    // For demo purposes, simulate immediate approval
    // In real implementation, this would wait for actual human input via events
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate thinking time
    
    return {
      decision: 'approve',
      feedback: 'Enhanced approval: Looks excellent! The analysis and visualization meet all requirements.',
      modifications: undefined,
      refinementType: undefined,
      decidedBy: 'demo-user',
      decidedAt: new Date()
    };
  }

  /**
   * Handle requirements refinement cycle
   */
  private async handleRequirementsRefinement(
    feedback: EnhancedHumanDecision,
    browserRequest: BrowserGraphRequest,
    sagaState: EnhancedSAGAState
  ): Promise<HumanApprovedResult> {
    console.log(`🔄 Handling requirements refinement: ${feedback.refinementType}`);
    
    sagaState.browserContext.refinementCycle++;
    sagaState.browserContext.userFeedback.push({
      stage: 'requirements_review',
      decision: feedback.decision,
      feedback: feedback.feedback || '',
      refinementType: feedback.refinementType,
      modifications: feedback.modifications,
      timestamp: new Date(),
      userId: feedback.decidedBy
    });

    // Refine requirements based on feedback
    if (sagaState.artifacts.requirements) {
      const refinedRequirements = await this.requirementsService.refineRequirements(
        sagaState.artifacts.requirements,
        feedback.feedback || '',
        feedback.modifications
      );
      sagaState.artifacts.requirements = refinedRequirements;
    }

    // Continue with enhanced SAGA from data analysis phase
    return this.executeEnhancedBrowserSAGA(browserRequest, true);
  }

  /**
   * Handle data analysis refinement cycle
   */
  private async handleDataAnalysisRefinement(
    feedback: EnhancedHumanDecision,
    sagaState: EnhancedSAGAState
  ): Promise<HumanApprovedResult> {
    console.log(`🔄 Handling data analysis refinement: ${feedback.refinementType}`);
    
    sagaState.browserContext.refinementCycle++;
    sagaState.browserContext.userFeedback.push({
      stage: 'data_analysis_review',
      decision: feedback.decision,
      feedback: feedback.feedback || '',
      refinementType: feedback.refinementType,
      modifications: feedback.modifications,
      timestamp: new Date(),
      userId: feedback.decidedBy
    });

    // Re-execute data analysis with modifications if needed
    // This would typically involve re-running the analysis with different parameters
    
    // For demo, return to enhanced SAGA flow
    return this.executeEnhancedBrowserSAGA(sagaState.browserContext.originalRequest, true);
  }

  /**
   * Handle visualization refinement cycle
   */
  private async handleVisualizationRefinement(
    feedback: EnhancedHumanDecision,
    sagaState: EnhancedSAGAState
  ): Promise<HumanApprovedResult> {
    console.log(`🔄 Handling visualization refinement: ${feedback.refinementType}`);
    
    sagaState.browserContext.refinementCycle++;
    sagaState.browserContext.userFeedback.push({
      stage: 'visualization_review',
      decision: feedback.decision,
      feedback: feedback.feedback || '',
      refinementType: feedback.refinementType,
      modifications: feedback.modifications,
      timestamp: new Date(),
      userId: feedback.decidedBy
    });

    // Re-execute coding service with refinements
    // This would typically involve regenerating the code with different specifications
    
    // For demo, return to enhanced SAGA flow
    return this.executeEnhancedBrowserSAGA(sagaState.browserContext.originalRequest, true);
  }

  /**
   * Prepare enhanced final artifacts with all components
   */
  private async prepareEnhancedFinalArtifacts(
    requirements: RequirementsArtifact,
    dataAnalysis: DataAnalysisArtifact,
    codeArtifacts: CodeArtifacts,
    interactiveDemo: InteractiveDemo,
    browserRequest: BrowserGraphRequest
  ): Promise<FinalDeliverable> {
    console.log(`📦 Preparing enhanced final deliverable...`);

    const enhancedDocumentation = this.generateEnhancedDocumentation(
      requirements,
      dataAnalysis,
      codeArtifacts,
      interactiveDemo
    );

    const deploymentInstructions = this.generateEnhancedDeploymentInstructions(
      codeArtifacts,
      dataAnalysis,
      interactiveDemo
    );

    const finalDeliverable: FinalDeliverable = {
      specification: {
        chartType: dataAnalysis.recommendedVisualization.recommendedType,
        title: requirements.processedQuery.split('[Context:')[0].trim(),
        dataMapping: {
          xAxis: dataAnalysis.dataSchema.fields.find(f => f.type === 'date')?.name || 'timestamp',
          yAxis: dataAnalysis.dataSchema.fields.find(f => f.type === 'number')?.name || 'value'
        },
        filters: browserRequest.dataSource.filters || {},
        aggregation: browserRequest.dataRequirements.aggregation || 'daily',
        visualizationConfig: {
          requirements: requirements.processedQuery,
          qualityScore: dataAnalysis.dataQualityMetrics.accuracy,
          recommendationConfidence: dataAnalysis.recommendedVisualization.confidence
        }
      },
      code: codeArtifacts,
      documentation: enhancedDocumentation,
      deploymentInstructions,
      version: `enhanced_v1.0.0_${Date.now()}`,
      createdAt: new Date()
    };

    console.log(`✅ Enhanced final deliverable prepared: ${finalDeliverable.version}`);
    return finalDeliverable;
  }

  /**
   * Generate enhanced documentation
   */
  private generateEnhancedDocumentation(
    requirements: RequirementsArtifact,
    dataAnalysis: DataAnalysisArtifact,
    codeArtifacts: CodeArtifacts,
    interactiveDemo: InteractiveDemo
  ): string {
    return `# Enhanced Data Visualization

## Requirements Analysis
${requirements.processedQuery}

### Extracted Entities
${requirements.extractedEntities.map(e => `- ${e.type}: ${e.value} (confidence: ${Math.round(e.confidence * 100)}%)`).join('\n')}

### Validation Results
${requirements.validationResults.map(v => `- ${v.field}: ${v.status} - ${v.message}`).join('\n')}

## Data Analysis
- **Data Source**: ${dataAnalysis.queryPlan.collection}
- **Sample Size**: ${dataAnalysis.sampleData.length} records
- **Data Quality**: ${Math.round(dataAnalysis.dataQualityMetrics.accuracy * 100)}% accuracy
- **Recommended Visualization**: ${dataAnalysis.recommendedVisualization.recommendedType} (${Math.round(dataAnalysis.recommendedVisualization.confidence * 100)}% confidence)

### Quality Issues
${dataAnalysis.dataQualityMetrics.issues.map(i => `- ${i.type}: ${i.description} (${i.severity} severity)`).join('\n')}

## Code Artifacts
- **Component**: Interactive React visualization
- **Chart Library**: ${codeArtifacts.chartLibrary}
- **Dependencies**: ${codeArtifacts.dependencies.join(', ')}

## Interactive Features
- **Preview URL**: ${interactiveDemo.previewUrl}
- **Controls**: ${interactiveDemo.interactiveControls.length} interactive controls
- **Export Options**: ${interactiveDemo.exportOptions.join(', ')}

## Usage
\`\`\`jsx
import Chart from './Chart';
const data = ${JSON.stringify(dataAnalysis.sampleData.slice(0, 3), null, 2)};
<Chart data={data} />
\`\`\`

Generated at: ${new Date().toISOString()}
`;
  }

  /**
   * Generate enhanced deployment instructions
   */
  private generateEnhancedDeploymentInstructions(
    codeArtifacts: CodeArtifacts,
    dataAnalysis: DataAnalysisArtifact,
    interactiveDemo: InteractiveDemo
  ): string {
    return `# Enhanced Deployment Instructions

## Prerequisites
- Node.js 16+ and npm/yarn
- React 18+
- Access to data source: ${dataAnalysis.queryPlan.collection}

## Installation
1. Install dependencies:
   \`\`\`bash
   npm install ${codeArtifacts.dependencies.join(' ')}
   \`\`\`

2. Copy the generated component to your project

3. Configure data connection:
   - Database: ${dataAnalysis.queryPlan.collection}
   - Required fields: ${dataAnalysis.queryPlan.projections.join(', ')}

## Configuration
- Chart supports ${interactiveDemo.interactiveControls.length} interactive controls
- Export formats: ${interactiveDemo.exportOptions.join(', ')}
- Responsive design: Automatically adapts to container size

## Performance Considerations
- Data quality: ${Math.round(dataAnalysis.dataQualityMetrics.accuracy * 100)}%
- Estimated result size: ${dataAnalysis.queryPlan.estimatedResultSize} records
- Recommended refresh interval: Based on data update frequency

## Testing
1. Test with provided sample data
2. Verify interactive controls functionality
3. Test export features
4. Validate responsive behavior

## Production Deployment
1. Build the React application
2. Deploy to your hosting platform
3. Configure API endpoints for live data
4. Set up monitoring and alerts

## Support
- Interactive demo: ${interactiveDemo.previewUrl}
- Embed code provided for quick integration
`;
  }

  /**
   * Generate requirements preview for human review
   */
  private generateRequirementsPreview(requirements: RequirementsArtifact): string {
    return `Requirements Analysis Summary:
- Query: ${requirements.processedQuery}
- Entities: ${requirements.extractedEntities.length} found
- Scope: ${requirements.analysisScope}
- Validation: ${requirements.validationResults.filter(v => v.status === 'valid').length}/${requirements.validationResults.length} checks passed`;
  }

  /**
   * Generate requirements recommendations
   */
  private generateRequirementsRecommendations(requirements: RequirementsArtifact): string[] {
    const recommendations = ['Requirements analysis completed successfully'];
    
    if (requirements.validationResults.some(v => v.status === 'warning')) {
      recommendations.push('Some validation warnings were found - review recommended');
    }
    
    if (requirements.extractedEntities.length > 5) {
      recommendations.push('Complex query detected - consider breaking into smaller analyses');
    }
    
    return recommendations;
  }

  // Keep the rest of the original methods for the legacy implementation
  private async generateChartSpecification(
    userQuery: string,
    filters: any
  ): Promise<ChartSpecification> {
    console.log(`🔍 Generating chart specification from browser request...`);
    
    const chartSpec: ChartSpecification = {
      chartType: filters?.chartType || 'line',
      title: filters?.title || 'Browser Data Visualization',
      dataMapping: {
        xAxis: filters?.xAxis || 'timestamp',
        yAxis: filters?.yAxis || 'value'
      },
      filters: filters || {},
      aggregation: filters?.aggregation || 'hourly',
      visualizationConfig: {
        userQuery,
        requestSource: 'browser'
      }
    };

    console.log(`✅ Chart specification generated: ${chartSpec.chartType} chart`);
    return chartSpec;
  }

  /**
   * Execute coding service to generate React visualization code
   */
  private async executeCodingService(
    specification: ChartSpecification,
    sagaState: HumanInLoopSAGAState
  ): Promise<CodeArtifacts> {
    console.log(`💻 Executing coding service to generate visualization code...`);
    
    const reactComponent = this.generateReactComponent(specification);
    
    const codeArtifacts: CodeArtifacts = {
      reactComponent,
      chartLibrary: 'recharts',
      dependencies: ['react', 'recharts', 'styled-components'],
      preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      testData: [
        { timestamp: '2023-11-01', output: 1200, type: 'coal' },
        { timestamp: '2023-11-02', output: 1350, type: 'coal' },
        { timestamp: '2023-11-03', output: 1180, type: 'coal' }
      ]
    };

    console.log(`✅ Code generated: React component with ${codeArtifacts.chartLibrary}`);
    return codeArtifacts;
  }

  /**
   * Request human approval and wait for decision (legacy)
   */
  private async requestHumanApproval(
    transactionId: string,
    stage: 'specification_review' | 'code_review' | 'final_approval',
    artifacts: ApprovalArtifacts
  ): Promise<{ decision: 'approve' | 'reject' | 'modify'; feedback?: string; modifications?: any }> {
    console.log(`🤝 Requesting human approval for ${stage}...`);
    
    const approvalToken = await this.humanInteractionService.requestApproval(
      transactionId,
      stage,
      artifacts
    );

    this.eventBusClient['publishEvent']('human_approval_requested', {
      transactionId,
      humanStage: stage,
      interactionToken: approvalToken.token,
      approvalUrl: approvalToken.approvalUrl,
      artifacts,
      timeoutAt: approvalToken.expiresAt
    }, 'broadcast');

    // Wait for human decision (in real implementation, this would be event-driven)
    console.log(`⏳ Waiting for human decision... (Timeout: ${approvalToken.expiresAt.toISOString()})`);
    console.log(`🔗 Approval URL: ${approvalToken.approvalUrl}`);
    
    // For demo purposes, simulate immediate approval
    // In real implementation, this would wait for actual human input via events
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate thinking time
    
    return {
      decision: 'approve',
      feedback: 'Looks good! Proceeding with the specification.',
      modifications: undefined
    };
  }

  /**
   * Prepare final deliverable package
   */
  private async prepareFinalArtifacts(
    specification: ChartSpecification,
    code: CodeArtifacts,
    workflowRequest: VisualizationWorkflowRequest
  ): Promise<FinalDeliverable> {
    const finalDeliverable: FinalDeliverable = {
      specification,
      code,
      documentation: this.generateDocumentation(specification, code),
      deploymentInstructions: this.generateDeploymentInstructions(code),
      version: `v1.0.0_${Date.now()}`,
      createdAt: new Date()
    };

    return finalDeliverable;
  }

  /**
   * Handle rejection at any stage
   */
  private async handleRejection(
    transactionId: string,
    reason: string,
    sagaState: HumanInLoopSAGAState
  ): Promise<HumanApprovedResult> {
    console.log(`❌ Human rejection: ${reason} for transaction ${transactionId}`);
    
    // Execute compensations
    await this.executeDistributedCompensation(transactionId, sagaState);
    
    sagaState.status = 'compensated';
    sagaState.endTime = new Date();
    sagaState.errors.push(`Human rejected: ${reason}`);
    
    await this.persistenceManager.saveTransactionState(transactionId, sagaState);

    return {
      success: false,
      transactionId,
      reason,
      processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
      humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
      servicesUsed: sagaState.completedServices
    };
  }

  /**
   * Handle system failure
   */
  private async handleFailure(
    transactionId: string,
    error: any,
    sagaState: HumanInLoopSAGAState
  ): Promise<HumanApprovedResult> {
    await this.executeDistributedCompensation(transactionId, sagaState);
    
    sagaState.status = 'failed';
    sagaState.endTime = new Date();
    sagaState.errors.push(error instanceof Error ? error.message : String(error));
    
    await this.persistenceManager.saveTransactionState(transactionId, sagaState);

    return {
      success: false,
      transactionId,
      reason: 'system_failure',
      processingTime: sagaState.endTime.getTime() - sagaState.startTime.getTime(),
      humanInteractionTime: this.calculateHumanInteractionTime(sagaState),
      servicesUsed: sagaState.completedServices
    };
  }

  /**
   * Execute compensation actions across all services
   */
  private async executeDistributedCompensation(
    transactionId: string,
    sagaState: HumanInLoopSAGAState
  ): Promise<void> {
    console.log(`🔄 Executing distributed compensation for transaction ${transactionId}`);
    
    // Cancel any pending human approvals
    await this.humanInteractionService.cancelApprovals(transactionId, 'Transaction failed');
    
    // Execute service-specific compensations
    for (const [serviceId, service] of sagaState.services.entries()) {
      if (service.status === 'completed') {
        console.log(`↪️ Compensating service: ${serviceId}`);
        // In real implementation, would call service-specific compensation
      }
    }
  }

  /**
   * Calculate total time spent in human interactions
   */
  private calculateHumanInteractionTime(sagaState: HumanInLoopSAGAState): number {
    // In real implementation, would track actual human interaction time
    return 30000; // Demo: 30 seconds
  }

  /**
   * Persist final artifacts to long-term storage
   */
  private async persistFinalArtifacts(deliverable: FinalDeliverable, transactionId: string): Promise<void> {
    console.log(`💾 Persisting final artifacts for transaction ${transactionId}`);
    
    // In real implementation, would save to database, file system, or cloud storage
    // For demo, just log the artifacts
    console.log(`📄 Documentation: ${deliverable.documentation.substring(0, 100)}...`);
    console.log(`🔧 Deployment instructions ready`);
    console.log(`📦 Version: ${deliverable.version}`);
  }

  /**
   * Generate React component code
   */
  private generateReactComponent(specification: ChartSpecification): string {
    return `
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ${specification.title.replace(/\\s+/g, '')}Chart = ({ data }) => {
  return (
    <div style={{ width: '100%', height: '400px' }}>
      <h2>${specification.title}</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="${specification.dataMapping.xAxis}" />
          <YAxis dataKey="${specification.dataMapping.yAxis}" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="${specification.dataMapping.yAxis}" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ${specification.title.replace(/\\s+/g, '')}Chart;
`;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation(specification: ChartSpecification, code: CodeArtifacts): string {
    return `
# ${specification.title} Visualization

## Overview
This visualization displays ${specification.chartType} chart showing energy data with ${specification.aggregation} aggregation.

## Usage
\`\`\`jsx
import Chart from './Chart';
const data = [/* your data here */];
<Chart data={data} />
\`\`\`

## Dependencies
${code.dependencies.join(', ')}

## Configuration
- Chart Type: ${specification.chartType}
- Aggregation: ${specification.aggregation}
- X-Axis: ${specification.dataMapping.xAxis}
- Y-Axis: ${specification.dataMapping.yAxis}

Generated at: ${new Date().toISOString()}
`;
  }

  /**
   * Generate deployment instructions
   */
  private generateDeploymentInstructions(code: CodeArtifacts): string {
    return `
# Deployment Instructions

1. Install dependencies:
   npm install ${code.dependencies.join(' ')}

2. Copy the generated component to your project

3. Import and use in your React application

4. Ensure your data follows the expected format

5. Test with the provided sample data
`;
  }

  
  /**
   * Setup event bus listener for start-graph-request events from browser
   */
  private async setupEventBusListener(): Promise<void> {
    console.log('🔧 Setting up Event Bus listener for browser requests...');
    
    // Wait for event bus connection
    let attempts = 0;
    while (!this.eventBusClient.isEventBusConnected() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!this.eventBusClient.isEventBusConnected()) {
      console.error('❌ Failed to connect to Event Bus after 30 seconds');
      return;
    }
    
    console.log('✅ Event Bus connected, setting up message listener...');
    
    // Access the socket directly to listen for events
    const socket = this.eventBusClient['socket'];
    
    socket.on('event_received', async (message: any) => {
      if (message.type === 'start-graph-request' && message.source === 'react-app') {
        console.log(`📊 Received start-graph-request from browser: ${JSON.stringify(message.data)}`);
     //   await this.handleBrowserGraphRequest(message);
      } else if (message.type === 'enhanced_graph_request') {
        console.log(`📊 Received enhanced routed graph request with priority: ${message.data.routingInfo?.priority}`);
        await this.handleEnhancedBrowserRequest(message.data.browserRequest, message.data.routingInfo);
      } else if (message.type === 'human_loop_graph_request') {
        console.log(`📊 Received legacy routed graph request: ${JSON.stringify(message.data)}`);
        await this.handleBrowserGraphRequest(message.data.originalMessage);
      }
    });
    
    console.log('🎧 Listening for browser graph requests via service bus...');
  }

  /**
   * Handle enhanced browser request routed through SAGA middleware
   */
  private async handleEnhancedBrowserRequest(
    browserRequest: BrowserGraphRequest, 
    routingInfo: any
  ): Promise<void> {
    try {
      console.log(`🚀 Processing enhanced browser request with ${routingInfo?.priority} priority`);
      console.log(`📋 Requirements: ${browserRequest.userQuery}`);
      console.log(`📊 Data Source: ${browserRequest.dataSource.collection}`);
      console.log(`📈 Graph Type: ${browserRequest.dataRequirements.graphType}`);
      console.log(`⏱️ Estimated duration: ${routingInfo?.estimatedDuration}ms`);
      
      // Execute the enhanced SAGA directly with validated browser request
      const result = await this.executeEnhancedBrowserSAGA(browserRequest, true);
      
      // Publish enhanced result back to event bus
      this.eventBusClient['publishEvent']('enhanced_saga_completed', {
        result,
        workflowId: browserRequest.requestId,
        threadId: browserRequest.threadId,
        success: result.success,
        correlationId: browserRequest.correlationId,
        processingTime: result.processingTime,
        refinementCycles: result.refinementCycles,
        routingInfo,
        source: 'enhanced-human-in-loop-saga',
        completionMetrics: {
          actualDuration: result.processingTime,
          estimatedDuration: routingInfo?.estimatedDuration,
          accuracy: routingInfo?.estimatedDuration ? 
                   Math.abs(1 - (result.processingTime / routingInfo.estimatedDuration)) : 0,
          servicesUsed: result.servicesUsed,
          humanInteractionTime: result.humanInteractionTime
        }
      }, 'broadcast');
      
      if (result.success) {
        console.log(`✅ Enhanced browser request completed successfully: ${browserRequest.requestId}`);
        console.log(`📊 Services used: ${result.servicesUsed?.join(', ')}`);
        console.log(`🔄 Refinement cycles: ${result.refinementCycles || 0}`);
        console.log(`📦 Final version: ${result.artifacts?.version}`);
      } else {
        console.log(`❌ Enhanced browser request failed: ${result.reason}`);
      }
      
    } catch (error) {
      console.error(`💥 Error in enhanced browser request processing:`, error);
      
      this.eventBusClient['publishEvent']('enhanced_saga_failed', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: browserRequest.requestId,
        threadId: browserRequest.threadId,
        correlationId: browserRequest.correlationId,
        routingInfo,
        source: 'enhanced-human-in-loop-saga',
        failureContext: {
          phase: 'enhanced_processing',
          services: ['requirements-service', 'data-analysis-service', 'coding-service'],
          browserRequest: browserRequest.userQuery.substring(0, 100)
        }
      }, 'broadcast');
    }
  }

  /**
   * Handle graph request from browser via Event Bus using Enhanced SAGA
   */
  private async handleBrowserGraphRequest(message: any): Promise<void> {
    try {
      console.log(`📊 Processing enhanced graph request from browser...`);
      
      // Extract data from the message
      const { data } = message;
      const threadId = data.threadId || `browser_${Date.now()}`;
      const userQuery = data.userQuery || data.query || 'Show me coal energy output trends over the last 3 days';
      
      // Create enhanced browser request with three key inputs
      const browserRequest: BrowserGraphRequest = {
        // Input 1: Requirements for the graph
        userQuery,
        
        // Input 2: Data requirements including date ranges, output fields, and graph type
        dataRequirements: {
          dateRange: {
            start: data.filters?.timeRange?.start || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Last 3 days
            end: data.filters?.timeRange?.end || new Date().toISOString()
          },
          outputFields: data.outputFields || ['timestamp', 'output', 'type'],
          graphType: (data.chartType || 'line') as 'line' | 'bar' | 'pie' | 'scatter',
          aggregation: data.aggregation || 'hourly',
        dataRequirement: message.drReq,
        codeRequirement: message.cdReq,
        csvPath: ``
        },
        
        // Input 3: Data source specification
        dataSource: {
          collection: data.collection || 'supply_analysis',
          database: data.database,
          filters: data.filters?.energyTypes ? { type: { $in: data.filters.energyTypes } } : {}
        },
        
        // Request metadata
        requestId: data.workflowId || `enhanced_browser_${Date.now()}`,
        threadId,
        correlationId: message.messageId || `corr_${Date.now()}`
      };
      
      console.log(`🚀 Starting Enhanced Human-in-Loop Browser SAGA for request: ${browserRequest.requestId}`);
      console.log(`📋 Requirements: ${browserRequest.userQuery}`);
      console.log(`📊 Data Source: ${browserRequest.dataSource.collection}`);
      console.log(`📈 Graph Type: ${browserRequest.dataRequirements.dataRequirement}`);
      
      // Execute the enhanced human-in-the-loop SAGA
      const result = await this.executeEnhancedBrowserSAGA(browserRequest, true);
      
      // Publish enhanced result back to event bus for the browser
      this.eventBusClient['publishEvent']('enhanced_saga_result', {
        result,
        workflowId: browserRequest.requestId,
        threadId: browserRequest.threadId,
        success: result.success,
        correlationId: browserRequest.correlationId,
        processingTime: result.processingTime,
        refinementCycles: result.refinementCycles,
        source: 'enhanced-human-in-loop-saga',
        enhancedFeatures: {
          requirementsAnalysis: true,
          dataAnalysis: true,
          enhancedCoding: true,
          interactiveDemo: true,
          qualityMetrics: true
        }
      }, 'broadcast');
      
      if (result.success) {
        console.log(`✅ Enhanced browser graph request completed successfully: ${browserRequest.requestId}`);
        console.log(`🔄 Refinement cycles: ${result.refinementCycles || 0}`);
        console.log(`📊 Final artifacts version: ${result.artifacts?.version}`);
      } else {
        console.log(`❌ Enhanced browser graph request failed: ${result.reason}`);
      }
      
    } catch (error) {
      console.error(`💥 Error handling enhanced browser graph request:`, error);
      
      // Publish error back to event bus
      this.eventBusClient['publishEvent']('enhanced_saga_error', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: message.data?.workflowId || `enhanced_browser_error_${Date.now()}`,
        threadId: message.data?.threadId,
        correlationId: message.messageId,
        source: 'enhanced-human-in-loop-saga',
        enhancedContext: {
          phase: 'request_processing',
          services: ['requirements-service', 'data-analysis-service', 'coding-service']
        }
      }, 'broadcast');
    }
  }


  /**
   * Setup event handlers for various services
   */
  private setupEventHandlers(): void {
    // Human interaction service events
    this.humanInteractionService.on('approval_requested', (event) => {
      console.log(`📧 Approval notification sent for ${event.stage}`);
    });

    this.humanInteractionService.on('decision_received', (decision) => {
      console.log(`✅ Decision processed: ${decision.decision}`);
    });

    this.humanInteractionService.on('approval_timeout', (event) => {
      console.log(`⏰ Approval timeout: ${event.stage}`);
    });

    // Persistence manager events
    this.persistenceManager.on('state_saved', (event) => {
      console.log(`💾 State saved: ${event.transactionId}`);
    });

    this.persistenceManager.on('checkpoint_created', (event) => {
      console.log(`📍 Checkpoint created: ${event.serviceId}`);
    });
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Human-in-the-Loop Coordinator...');
    
    await Promise.all([
      this.humanInteractionService.shutdown(),
      this.persistenceManager.shutdown(),
      this.eventBusClient.shutdown()
    ]);

    console.log('✅ Human-in-the-Loop Coordinator shutdown complete');
  }
}

// Example usage and demo for browser interaction
export async function runHumanInLoopBrowserExample(): Promise<void> {
  const config: HumanInLoopConfig = {
    timeouts: {
      specificationReviewTimeout: 24 * 60 * 60 * 1000, // 24 hours
      codeReviewTimeout: 48 * 60 * 60 * 1000, // 48 hours
      finalApprovalTimeout: 7 * 24 * 60 * 60 * 1000, // 1 week
      maxTransactionLifetime: 30 * 24 * 60 * 60 * 1000, // 30 days
      onTimeout: 'compensate',
      compensationActions: {
        notifyUser: true,
        archiveArtifacts: true,
        releaseResources: true,
        emailNotification: true
      }
    },
    services: {
      ragService: 'http://localhost:3001',
      codingService: 'http://localhost:3002',
      humanInterface: 'http://localhost:3004',
      persistence: 'redis://localhost:6379'
    },
    eventBus: {
      url: 'http://localhost:3003',
      topics: ['saga_events', 'human_events'],
      retryAttempts: 3
    },
    humanInterface: {
      approvalBaseUrl: 'http://localhost:3004',
      emailNotifications: true,
      slackNotifications: false
    },
    persistence: {
      provider: 'database',
      retentionDays: 90,
      backupEnabled: true
    }
  };

  const coordinator = new HumanInLoopBrowserCoordinator(config);

  try {
    console.log('🚀 Starting Human-in-the-Loop Browser Listener...');
    
    // Wait a bit for the event bus connection to be established
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📡 Coordinator is now listening for browser requests via event bus...');
    console.log('💡 Send start-graph-request messages from react-app to trigger processing');
    console.log('');
    console.log('Press Ctrl+C to exit...');

    // Keep the process alive to listen for browser messages
    process.on('SIGINT', async () => {
      console.log('\n🔄 Shutting down Human-in-the-Loop Browser Coordinator...');
      await coordinator.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🔄 Shutting down Human-in-the-Loop Browser Coordinator...');
      await coordinator.shutdown();
      process.exit(0);
    });

    // Keep the event loop alive
    setInterval(() => {
      // Just keep alive, don't log anything
    }, 30000);

  } catch (error) {
    console.error('💥 Human-in-the-Loop example failed:', error);
    await coordinator.shutdown();
    process.exit(1);
  }

  
}

// Execute if run directly
/*if (import.meta.url === `file:///${process.argv[1].replace(/\\\\/g, '/')}`) {
  runHumanInLoopBrowserExample();
}*/

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('humanInteractionService.js') || process.argv[1].endsWith('humanInteractionService.ts')) {
   runHumanInLoopBrowserExample();
}