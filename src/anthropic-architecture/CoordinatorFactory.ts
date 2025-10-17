/**
 * Factory for creating and configuring coordinators with their subagents
 */

import { DataDomainCoordinator } from './coordinators/DataDomainCoordinator.js';
import {
  SchemaAnalyzerSubagent,
  DataTransformerSubagent,
  DataValidatorSubagent,
  DataSummarizerSubagent
} from './subagents/index.js';
import { CoordinatorConfig, SubagentDefinition } from './types/index.js';
import { MCPServerConfig } from '../types/index.js';

export class CoordinatorFactory {
  /**
   * Create a fully configured Data Domain Coordinator with all subagents
   */
  static createDataDomainCoordinator(mcpServers?: Record<string, MCPServerConfig>): DataDomainCoordinator {
    // Define subagents
    const schemaAnalyzerDef: SubagentDefinition = {
      id: 'schema_analyzer_1',
      name: 'Schema Analyzer',
      type: 'schema_analyzer',
      description: 'Analyzes CSV file structure and infers data schema, types, and relationships',
      capabilities: [
        'Infer column data types',
        'Detect temporal patterns',
        'Identify categorical groupings',
        'Estimate data distributions'
      ],
      promptTemplate: `You are a data schema analysis specialist. Your task is to analyze CSV data and infer:
1. Column data types (numeric, categorical, datetime, text)
2. Nullability and data quality
3. Potential relationships between columns
4. Insights useful for data transformation and visualization

Be precise and base your analysis on the actual sample data provided.`,
      llmConfig: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.3,
        maxTokens: 4000
      }
    };

    const dataTransformerDef: SubagentDefinition = {
      id: 'data_transformer_1',
      name: 'Data Transformer',
      type: 'data_transformer',
      description: 'Executes data transformations (filter, group, aggregate, normalize) using Python',
      capabilities: [
        'Generate Python/pandas code for transformations',
        'Execute transformations via MCP',
        'Compute summary statistics',
        'Handle data type conversions'
      ],
      promptTemplate: `You are a data transformation specialist. Your task is to generate Python code using pandas to:
1. Read CSV data
2. Perform specified transformations (filter, group, aggregate, normalize)
3. Save transformed data to output file
4. Compute and return summary statistics

Generate clean, efficient Python code without explanations.`,
      llmConfig: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.2,
        maxTokens: 3000
      },
      mcpServers: mcpServers ? [mcpServers.execution] : []
    };

    const dataValidatorDef: SubagentDefinition = {
      id: 'data_validator_1',
      name: 'Data Validator',
      type: 'data_validator',
      description: 'Validates data against specified rules and quality constraints',
      capabilities: [
        'Check required columns',
        'Validate data types',
        'Enforce range constraints',
        'Custom validation rules'
      ],
      promptTemplate: `You are a data validation specialist. Your task is to:
1. Check if data meets required constraints
2. Identify data quality issues
3. Report violations clearly and actionably

Be thorough and precise in identifying issues.`,
      llmConfig: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.2,
        maxTokens: 3000
      }
    };

    const dataSummarizerDef: SubagentDefinition = {
      id: 'data_summarizer_1',
      name: 'Data Summarizer',
      type: 'data_summarizer',
      description: 'Summarizes data in chunks for visualization planning, capturing key patterns and statistics',
      capabilities: [
        'Process data in manageable chunks',
        'Identify temporal patterns',
        'Compute statistical summaries',
        'Generate insights for visualization',
        'Synthesize chunk-level insights'
      ],
      promptTemplate: `You are a data summarization specialist. Your task is to:
1. Analyze data chunks and identify key patterns
2. Capture temporal ranges, categories, and numeric distributions
3. Synthesize insights across chunks
4. Provide clear, actionable summaries for visualization coding

Focus on insights that help a coding agent create effective visualizations.`,
      llmConfig: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.4,
        maxTokens: 4000
      }
    };

    // Create coordinator configuration
    const coordinatorConfig: CoordinatorConfig = {
      id: 'data_domain_coordinator_1',
      name: 'Data Domain Coordinator',
      domain: 'data',
      description: 'Coordinates data analysis, transformation, validation, and summarization tasks',
      availableSubagents: [
        schemaAnalyzerDef,
        dataTransformerDef,
        dataValidatorDef,
        dataSummarizerDef
      ],
      llmConfig: {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.5,
        maxTokens: 4000
      },
      systemPrompt: `You are the Data Domain Coordinator in a multi-agent system.

Your role:
- Maintain context about user's data requirements and analysis goals
- Decide which stateless subagents to call to gather information
- Accumulate results from subagents and build comprehensive understanding
- Synthesize data analysis into coherent insights
- Determine when to pass results to the Coding Domain Coordinator

Available subagents:
1. schema_analyzer: Analyzes CSV structure and infers data schema
2. data_transformer: Executes data transformations using Python
3. data_validator: Validates data quality and constraints
4. data_summarizer: Summarizes data for visualization planning

Decision-making principles:
- Start with schema analysis to understand data structure
- Transform data if user requests filtering, grouping, or aggregation
- Validate data quality when specified or when critical
- Summarize data iteratively for large datasets
- Pass to coding coordinator when data analysis is complete

Maintain context about what you've learned and build on it with each subagent call.`,
      maxIterations: 10,
      maxSubagentCalls: 15
    };

    // Create coordinator
    const coordinator = new DataDomainCoordinator(coordinatorConfig);

    // Create and register subagents
    coordinator.registerSubagent(new SchemaAnalyzerSubagent(schemaAnalyzerDef));
    coordinator.registerSubagent(new DataTransformerSubagent(dataTransformerDef));
    coordinator.registerSubagent(new DataValidatorSubagent(dataValidatorDef));
    coordinator.registerSubagent(new DataSummarizerSubagent(dataSummarizerDef));

    console.log('✅ Data Domain Coordinator created with 4 subagents');

    return coordinator;
  }
}
