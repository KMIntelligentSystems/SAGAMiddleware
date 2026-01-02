/**
 * DataProfiler
 *
 * Analyzes CSV files and generates detailed prompts for agent structure generation.
 *
 * Flow:
 * 1. User sends: file path + plain text requirements via socket
 * 2. SDK Claude (Sonnet) analyzes actual file + interprets requirements
 * 3. Outputs: Comprehensive prompt for AgentStructureGenerator
 *
 * The SDK agent figures out:
 * - File encoding, structure, headers
 * - DateTime formats, data mappings
 * - Transformation requirements
 * - Technical specifications for code generation
 */

import { BaseSDKAgent } from './baseSDKAgent.js';
import { AgentResult, WorkingMemory, AgentDefinition, LLMConfig } from '../types/index.js';
import { GenericAgent } from './genericAgent.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as fs from 'fs'
import { claudeBackendResult_1, claudeBackendResult_2, claudeBackendResult_3, dataProfilerPrompt_1, pythonHistogram, pythonDataPreProcessor, pythonDataFilter} from '../test/histogramData.js'
import { agentConstructorPythonExecutionError } from '../test/testData.js';

export interface DataProfileInput {
    workflowDescription: string;  // Complete workflow plan including filepath and requirements
    dataProfilerPrompt: string;
}

export interface SubAgentSpec {
    name: string;
    description: string;
    expectedOutput: string;
}

export interface CreatedAgentInfo {
    agent?: GenericAgent;  // Optional - only created when needed
    definition: AgentDefinition;
    order: number;
}

export class DataProfiler extends BaseSDKAgent {
    private createdAgents: CreatedAgentInfo[] = [];
    private agentCreationOrder: number = 0;

    constructor(contextManager?: any) {
        super('DataProfiler', 15, contextManager);

        // Add custom tool for creating GenericAgents
        this.setupCreateAgentTool();
    }

    /**
     * Setup custom MCP tool for creating GenericAgent instances
     */
    private setupCreateAgentTool(): void {
        const createAgentTool = tool(
            'create_generic_agent',
            'Creates a GenericAgent instance for data processing. Call this tool for each agent you want to create in the processing pipeline.',
            {
                name: z.string().describe('Agent name (e.g., "DataLoaderAgent", "StatisticsAgent")'),
                taskDescription: z.string().describe('Detailed task description - what this agent should do'),
                taskExpectedOutput: z.string().describe('Expected output format and structure'),
                agentType: z.enum(['tool', 'processing']).describe('Agent type: "tool" for agents using MCP tools, "processing" for pure text processing'),
                llmProvider: z.enum(['openai', 'anthropic', 'gemini']).optional().describe('LLM provider. Default: "openai"'),
                llmModel: z.string().optional().describe('Model name. Default: "gpt-4o-mini"'),
                dependencies: z.array(z.string()).optional().describe('Names of other agents this agent depends on'),
                mcpTools: z.array(z.string()).optional().describe('MCP tools this agent can use (e.g., ["execute_python"])')
            },
            async (args) => {
                return this.handleCreateAgent(args);
            }
        );

        // Create MCP server with the tool
        const mcpServer = createSdkMcpServer({
            name: 'agent-creator',
            tools: [createAgentTool]
        });

        // Add MCP server to options - merge with existing servers (like Railway HTTP servers)
        this.options.mcpServers = {
            ...this.options.mcpServers,  // Keep existing servers (Railway HTTP MCP servers)
            'agent-creator': mcpServer    // Add local tool server
        } as any;
    }

    /**
     * Handler for create_generic_agent tool
     */
    private async handleCreateAgent(args: any) {
        try {
            console.log(`\n🔧 Creating GenericAgent: ${args.name}`);

            // Generate unique ID
            const agentId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

            // Build LLM config
            const llmConfig: LLMConfig = {
                provider: args.llmProvider || 'openai',
                model: args.llmModel || 'gpt-5',
                temperature: 0.3,
                maxTokens: 4000
            };

            // Build dependencies
            const dependencies = (args.dependencies || []).map((depName: string) => ({
                agentName: depName,
                required: true
            }));

            // Create AgentDefinition
            const agentDefinition: AgentDefinition = {
                id: agentId,
                name: args.name,
                backstory: `Agent created by DataProfiler for: ${args.taskDescription.substring(0, 100)}`,
                taskDescription: args.taskDescription,
                taskExpectedOutput: args.taskExpectedOutput,
                llmConfig,
                dependencies,
                agentType: args.agentType,
                mcpServers: args.agentType === 'tool' ? [
                    {
                        name: 'execution',
                        command: 'npx',
                        args: ['-y', '@anthropic-ai/mcp-server-execution'],
                        transport: 'stdio' as const
                    }
                ] : undefined,
                mcpTools: args.mcpTools || (args.agentType === 'tool' ? ['execute_python'] : undefined)
            };

            // Store agent definition in registry (don't instantiate GenericAgent yet to avoid MCP connection errors)
            const agentInfo: CreatedAgentInfo = {
                definition: agentDefinition,
                order: this.agentCreationOrder++
            };

            this.createdAgents.push(agentInfo);

            console.log(`✅ Created agent definition: ${args.name} (Order: ${agentInfo.order})`);

            // Return success message to Claude
            return {
                content: [{
                    type: 'text' as const,
                    text: `Successfully created agent "${args.name}" (ID: ${agentId}, Order: ${agentInfo.order})`
                }]
            };
        } catch (error) {
            console.error(`❌ Error creating agent ${args.name}:`, error);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error creating agent: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Get all created agents
     */
    public getCreatedAgents(): CreatedAgentInfo[] {
        return [...this.createdAgents].sort((a, b) => a.order - b.order);
    }
// Test agents from appRunLog.txt - GenericAgent instances ready to use
    private createTestAgents(): GenericAgent[]{
        const agents: GenericAgent[] = [];

        // Agent 1: DataLoaderAgent
        const agent1 = new GenericAgent({
            id: 'agent_test_dataloader',
            name: 'DataLoaderAgent',
            backstory: 'Test agent',
            taskDescription: 'Data loading task',
            taskExpectedOutput: 'JSON',
            llmConfig: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 4000, provider: 'openai' },
            dependencies: [],
            agentType: 'tool',
            mcpServers: [{ name: 'execution', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-execution'], transport: 'stdio' }],
            mcpTools: ['execute_python']
        });
        agent1.setContext(`Task: import pandas as pd
import json
import numpy as np

# Load the CSV file with specific formatting considerations
file_path = r'C:/repos/SAGAMiddleware/data/prices.csv'

# Read CSV with UTF-8-BOM encoding and skip the first 2 header rows
df = pd.read_csv(file_path, encoding='utf-8-sig', skiprows=2, header=None, names=['price'])

# Extract price values (remove any $ symbols if present)
prices = df['price'].astype(str).str.replace('$', '', regex=False).str.replace(',', '', regex=False)
prices = pd.to_numeric(prices, errors='coerce').dropna()

# Convert to list for processing
price_list = prices.tolist()

# Calculate basic statistics
count_val = len(price_list)
min_val = float(prices.min())
max_val = float(prices.max())
mean_val = float(prices.mean())
median_val = float(prices.median())
std_val = float(prices.std())

# Calculate quartiles
q1 = float(prices.quantile(0.25))
q3 = float(prices.quantile(0.75))
iqr = q3 - q1

# Prepare result dictionary
result = {
    'price_data': price_list,
    'count': count_val,
    'min': min_val,
    'max': max_val,
    'mean': mean_val,
    'median': median_val,
    'std': std_val,
    'q1': q1,
    'q3': q3,
    'iqr': iqr,
    'file_path': file_path,
    'data_interval': '5-minute'
}

print(json.dumps(result))`);
        agents.push(agent1);

        // Agent 2: StatisticalAnalyzer
        const agent2 = new GenericAgent({
            id: 'agent_test_statistical',
            name: 'StatisticalAnalyzer',
            backstory: 'Test agent',
            taskDescription: 'Statistical analysis task',
            taskExpectedOutput: 'JSON',
            llmConfig: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 4000, provider: 'openai' },
            dependencies: [{ agentName: 'DataLoaderAgent', required: true }],
            agentType: 'tool',
            mcpServers: [{ name: 'execution', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-execution'], transport: 'stdio' }],
            mcpTools: ['execute_python']
        });
        agent2.setContext(`Task: import json
import numpy as np
from scipy import stats

# Access previous agent's result
price_data = _prev_result['price_data']
count_val = _prev_result['count']
min_val = _prev_result['min']
max_val = _prev_result['max']
mean_val = _prev_result['mean']
median_val = _prev_result['median']
std_val = _prev_result['std']
q1 = _prev_result['q1']
q3 = _prev_result['q3']
iqr = _prev_result['iqr']

# Convert to numpy array for calculations
prices = np.array(price_data)

# Identify outliers using multiple methods
# Method 1: IQR method
lower_bound_iqr = q1 - 1.5 * iqr
upper_bound_iqr = q3 + 1.5 * iqr
outliers_iqr = prices[(prices < lower_bound_iqr) | (prices > upper_bound_iqr)]
outliers_iqr_list = outliers_iqr.tolist()

# Method 2: Z-score method (|z| > 3)
z_scores = np.abs((prices - mean_val) / std_val)
outliers_zscore = prices[z_scores > 3]
outliers_zscore_list = outliers_zscore.tolist()

# Method 3: Modified Z-score using MAD
median_abs_deviation = float(np.median(np.abs(prices - median_val)))
if median_abs_deviation != 0:
    modified_z_scores = 0.6745 * (prices - median_val) / median_abs_deviation
    outliers_mad = prices[np.abs(modified_z_scores) > 3.5]
    outliers_mad_list = outliers_mad.tolist()
else:
    outliers_mad_list = []

# Analyze price distribution characteristics
# Check for normality
shapiro_stat, shapiro_p = stats.shapiro(prices[:5000] if len(prices) > 5000 else prices)
is_normal = shapiro_p > 0.05

# Calculate skewness and kurtosis
skewness = float(stats.skew(prices))
kurtosis_val = float(stats.kurtosis(prices))

# Identify core range
core_range_mask = (prices >= 30) & (prices <= 500)
core_range_count = int(np.sum(core_range_mask))
core_range_percentage = float(core_range_count / count_val * 100)

# Calculate percentiles
percentiles = {}
for p in [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]:
    percentiles[f'p{p}'] = float(np.percentile(prices, p))

# Robust statistics
trimmed_mean = float(stats.trim_mean(prices, 0.1))
winsorized_mean = float(stats.mstats.winsorize(prices, limits=(0.05, 0.05)).mean())

result = {
    'price_data': price_data,
    'basic_stats': {
        'count': count_val,
        'min': min_val,
        'max': max_val,
        'mean': mean_val,
        'median': median_val,
        'std': std_val,
        'q1': q1,
        'q3': q3,
        'iqr': iqr
    },
    'distribution': {
        'is_normal': is_normal,
        'shapiro_statistic': float(shapiro_stat),
        'shapiro_p_value': float(shapiro_p),
        'skewness': skewness,
        'kurtosis': kurtosis_val
    },
    'outlier_analysis': {
        'iqr_method': {
            'lower_bound': float(lower_bound_iqr),
            'upper_bound': float(upper_bound_iqr),
            'outliers': outliers_iqr_list,
            'outlier_count': len(outliers_iqr_list)
        },
        'zscore_method': {
            'threshold': 3.0,
            'outliers': outliers_zscore_list,
            'outlier_count': len(outliers_zscore_list)
        },
        'mad_method': {
            'outliers': outliers_mad_list,
            'outlier_count': len(outliers_mad_list)
        }
    },
    'core_range_analysis': {
        'range': [30, 500],
        'count_in_range': core_range_count,
        'percentage_in_range': core_range_percentage
    },
    'percentiles': percentiles,
    'robust_stats': {
        'trimmed_mean': trimmed_mean,
        'winsorized_mean': winsorized_mean
    }
}

print(json.dumps(result))`);
        agents.push(agent2);

        // Agent 3: BinStrategyGenerator
        const agent3 = new GenericAgent({
            id: 'agent_test_binstrategy',
            name: 'BinStrategyGenerator',
            backstory: 'Test agent',
            taskDescription: 'Bin strategy calculation task',
            taskExpectedOutput: 'JSON',
            llmConfig: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 4000, provider: 'openai' },
            dependencies: [{ agentName: 'StatisticalAnalyzer', required: true }],
            agentType: 'tool',
            mcpServers: [{ name: 'execution', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-execution'], transport: 'stdio' }],
            mcpTools: ['execute_python']
        });
        agent3.setContext(`Task: import json
import numpy as np
import math

# Access previous analysis results
price_data = _prev_result['price_data']
basic_stats = _prev_result['basic_stats']
distribution = _prev_result['distribution']
outlier_analysis = _prev_result['outlier_analysis']
core_range_analysis = _prev_result['core_range_analysis']
percentiles = _prev_result['percentiles']

count_val = basic_stats['count']
min_val = basic_stats['min']
max_val = basic_stats['max']
iqr = basic_stats['iqr']
std_val = basic_stats['std']

# Convert to numpy array
prices = np.array(price_data)

# Calculate bin strategies
sturges_bins = int(math.ceil(math.log2(count_val) + 1))
scott_h = 3.5 * std_val / (count_val ** (1/3))
scott_bins = int(math.ceil((max_val - min_val) / scott_h))
fd_h = 2 * iqr / (count_val ** (1/3))
fd_bins = int(math.ceil((max_val - min_val) / fd_h)) if fd_h > 0 else 20
sqrt_bins = int(math.ceil(math.sqrt(count_val)))
rice_bins = int(math.ceil(2 * (count_val ** (1/3))))

if distribution['skewness'] > 2 or distribution['skewness'] < -2:
    adaptive_bins = max(fd_bins, rice_bins)
elif core_range_analysis['percentage_in_range'] > 80:
    adaptive_bins = int(sqrt_bins * 1.2)
else:
    adaptive_bins = fd_bins

bin_strategies = {
    'sturges': min(max(sturges_bins, 5), 100),
    'scott': min(max(scott_bins, 5), 100),
    'freedman_diaconis': min(max(fd_bins, 5), 100),
    'sqrt': min(max(sqrt_bins, 5), 100),
    'rice': min(max(rice_bins, 5), 100),
    'adaptive': min(max(adaptive_bins, 5), 100)
}

if count_val >= 1000 and distribution['is_normal']:
    recommended_bins = bin_strategies['freedman_diaconis']
elif count_val >= 1000:
    recommended_bins = bin_strategies['adaptive']
else:
    recommended_bins = bin_strategies['sturges']

result = {
    'bin_strategies': bin_strategies,
    'recommended_bin_count': recommended_bins,
    'data_summary': {
        'total_values': count_val,
        'price_range': [min_val, max_val],
        'core_range': core_range_analysis['range'],
        'outlier_count': outlier_analysis['iqr_method']['outlier_count'],
        'distribution_type': 'normal' if distribution['is_normal'] else 'non-normal'
    }
}

print(json.dumps(result))`);
        agents.push(agent3);

        return agents;
    }

    // Test agents from appRunLog.txt - Version 2 returns AgentDefinitions (not GenericAgent instances)
    // These definitions will be converted to GenericAgents by FlowStrategies.createGenericAgentsFromDefinitions()
    private createTestAgents_2(): AgentDefinition[] {
        const agentDefinitions: AgentDefinition[] = [];

        // Agent 1: DataLoaderAgent - Python code goes in taskDescription field
        const agent1Definition: AgentDefinition = {
            id: 'agent_1767068750979_ru9xcllox',
            name: 'DataLoaderAgent',
            backstory: 'Test agent from appRunLog',
            taskDescription: `import pandas as pd
import json
import numpy as np

# Load the CSV file with specific formatting considerations
file_path = r'C:/repos/SAGAMiddleware/data/prices.csv'

# Read CSV with UTF-8-BOM encoding and skip the first 2 header rows
df = pd.read_csv(file_path, encoding='utf-8-sig', skiprows=2, header=None, names=['price'])

# Extract price values (remove any $ symbols if present)
prices = df['price'].astype(str).str.replace('$', '', regex=False).str.replace(',', '', regex=False)
prices = pd.to_numeric(prices, errors='coerce').dropna()

# Convert to list for processing
price_list = prices.tolist()

# Calculate basic statistics
count_val = len(price_list)
min_val = float(prices.min())
max_val = float(prices.max())
mean_val = float(prices.mean())
median_val = float(prices.median())
std_val = float(prices.std())

# Calculate quartiles
q1 = float(prices.quantile(0.25))
q3 = float(prices.quantile(0.75))
iqr = q3 - q1

# Prepare result dictionary
result = {
    'price_data': price_list,
    'count': count_val,
    'min': min_val,
    'max': max_val,
    'mean': mean_val,
    'median': median_val,
    'std': std_val,
    'q1': q1,
    'q3': q3,
    'iqr': iqr,
    'file_path': file_path,
    'data_interval': '5-minute'
}

print(json.dumps(result))`,
            taskExpectedOutput: 'JSON',
            llmConfig: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 4000, provider: 'openai' },
            dependencies: [],
            agentType: 'tool',
            mcpServers: [{ name: 'execution', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-execution'], transport: 'stdio' }],
            mcpTools: ['execute_python']
        };
        agentDefinitions.push(agent1Definition);

        // Agent 2: StatisticalAnalyzer - Python code in taskDescription field
        const agent2Definition: AgentDefinition = {
            id: 'agent_1767068775889_88b14dr7j',
            name: 'StatisticalAnalyzer',
            backstory: 'Test agent from appRunLog',
            taskDescription: `import json
import numpy as np
from scipy import stats

# Access previous agent's result
price_data = _prev_result['price_data']
count_val = _prev_result['count']
min_val = _prev_result['min']
max_val = _prev_result['max']
mean_val = _prev_result['mean']
median_val = _prev_result['median']
std_val = _prev_result['std']
q1 = _prev_result['q1']
q3 = _prev_result['q3']
iqr = _prev_result['iqr']

# Convert to numpy array for calculations
prices = np.array(price_data)

# Identify outliers using multiple methods
# Method 1: IQR method
lower_bound_iqr = q1 - 1.5 * iqr
upper_bound_iqr = q3 + 1.5 * iqr
outliers_iqr = prices[(prices < lower_bound_iqr) | (prices > upper_bound_iqr)]
outliers_iqr_list = outliers_iqr.tolist()

# Method 2: Z-score method (|z| > 3)
z_scores = np.abs((prices - mean_val) / std_val)
outliers_zscore = prices[z_scores > 3]
outliers_zscore_list = outliers_zscore.tolist()

# Method 3: Modified Z-score using MAD
median_abs_deviation = float(np.median(np.abs(prices - median_val)))
if median_abs_deviation != 0:
    modified_z_scores = 0.6745 * (prices - median_val) / median_abs_deviation
    outliers_mad = prices[np.abs(modified_z_scores) > 3.5]
    outliers_mad_list = outliers_mad.tolist()
else:
    outliers_mad_list = []

# Analyze price distribution characteristics
# Check for normality
shapiro_stat, shapiro_p = stats.shapiro(prices[:5000] if len(prices) > 5000 else prices)
is_normal = shapiro_p > 0.05

# Calculate skewness and kurtosis
skewness = float(stats.skew(prices))
kurtosis_val = float(stats.kurtosis(prices))

# Identify core range (majority of values between $30 and $500 as mentioned)
core_range_mask = (prices >= 30) & (prices <= 500)
core_range_count = int(np.sum(core_range_mask))
core_range_percentage = float(core_range_count / count_val * 100)

# Calculate percentiles for better understanding
percentiles = {}
for p in [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]:
    percentiles[f'p{p}'] = float(np.percentile(prices, p))

# Robust statistics
trimmed_mean = float(stats.trim_mean(prices, 0.1))  # 10% trimmed mean
winsorized_mean = float(stats.mstats.winsorize(prices, limits=(0.05, 0.05)).mean())

result = {
    'price_data': price_data,
    'basic_stats': {
        'count': count_val,
        'min': min_val,
        'max': max_val,
        'mean': mean_val,
        'median': median_val,
        'std': std_val,
        'q1': q1,
        'q3': q3,
        'iqr': iqr
    },
    'distribution': {
        'is_normal': is_normal,
        'shapiro_statistic': float(shapiro_stat),
        'shapiro_p_value': float(shapiro_p),
        'skewness': skewness,
        'kurtosis': kurtosis_val
    },
    'outlier_analysis': {
        'iqr_method': {
            'lower_bound': float(lower_bound_iqr),
            'upper_bound': float(upper_bound_iqr),
            'outliers': outliers_iqr_list,
            'outlier_count': len(outliers_iqr_list)
        },
        'zscore_method': {
            'threshold': 3.0,
            'outliers': outliers_zscore_list,
            'outlier_count': len(outliers_zscore_list)
        },
        'mad_method': {
            'outliers': outliers_mad_list,
            'outlier_count': len(outliers_mad_list)
        }
    },
    'core_range_analysis': {
        'range': [30, 500],
        'count_in_range': core_range_count,
        'percentage_in_range': core_range_percentage
    },
    'percentiles': percentiles,
    'robust_stats': {
        'trimmed_mean': trimmed_mean,
        'winsorized_mean': winsorized_mean
    }
}

print(json.dumps(result))`,
            taskExpectedOutput: 'JSON',
            llmConfig: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 4000, provider: 'openai' },
            dependencies: [{ agentName: 'DataLoaderAgent', required: true }],
            agentType: 'tool',
            mcpServers: [{ name: 'execution', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-execution'], transport: 'stdio' }],
            mcpTools: ['execute_python']
        };
        agentDefinitions.push(agent2Definition);

        // Agent 3: BinStrategyGenerator - Python code in taskDescription field
        const agent3Definition: AgentDefinition = {
            id: 'agent_1767068822654_1zydytvsv',
            name: 'BinStrategyGenerator',
            backstory: 'Test agent from appRunLog',
            taskDescription: `import json
import numpy as np
import math

# Access previous analysis results
price_data = _prev_result['price_data']
basic_stats = _prev_result['basic_stats']
distribution = _prev_result['distribution']
outlier_analysis = _prev_result['outlier_analysis']
core_range_analysis = _prev_result['core_range_analysis']
percentiles = _prev_result['percentiles']

count_val = basic_stats['count']
min_val = basic_stats['min']
max_val = basic_stats['max']
iqr = basic_stats['iqr']
std_val = basic_stats['std']

# Convert to numpy array
prices = np.array(price_data)

# Strategy 1: Sturges' Rule
sturges_bins = int(math.ceil(math.log2(count_val) + 1))

# Strategy 2: Scott's Rule
scott_h = 3.5 * std_val / (count_val ** (1/3))
scott_bins = int(math.ceil((max_val - min_val) / scott_h))

# Strategy 3: Freedman-Diaconis Rule
fd_h = 2 * iqr / (count_val ** (1/3))
fd_bins = int(math.ceil((max_val - min_val) / fd_h)) if fd_h > 0 else 20

# Strategy 4: Square Root Rule
sqrt_bins = int(math.ceil(math.sqrt(count_val)))

# Strategy 5: Rice Rule
rice_bins = int(math.ceil(2 * (count_val ** (1/3))))

# Strategy 6: Adaptive binning based on data characteristics
if distribution['skewness'] > 2 or distribution['skewness'] < -2:
    # Highly skewed - use more bins
    adaptive_bins = max(fd_bins, rice_bins)
elif core_range_analysis['percentage_in_range'] > 80:
    # Most data in core range - focus bins there
    adaptive_bins = int(sqrt_bins * 1.2)
else:
    # Default to Freedman-Diaconis
    adaptive_bins = fd_bins

# Ensure reasonable bin counts
bin_strategies = {
    'sturges': min(max(sturges_bins, 5), 100),
    'scott': min(max(scott_bins, 5), 100),
    'freedman_diaconis': min(max(fd_bins, 5), 100),
    'sqrt': min(max(sqrt_bins, 5), 100),
    'rice': min(max(rice_bins, 5), 100),
    'adaptive': min(max(adaptive_bins, 5), 100)
}

# Recommended bin count based on data characteristics
if count_val >= 1000 and distribution['is_normal']:
    recommended_bins = bin_strategies['freedman_diaconis']
elif count_val >= 1000:
    recommended_bins = bin_strategies['adaptive']
else:
    recommended_bins = bin_strategies['sturges']

# Range determination strategies
range_strategies = {
    'full_range': {
        'min': min_val,
        'max': max_val,
        'description': 'Uses complete data range including all outliers'
    },
    'iqr_based': {
        'min': float(outlier_analysis['iqr_method']['lower_bound']),
        'max': float(outlier_analysis['iqr_method']['upper_bound']),
        'description': 'Range based on IQR method, excluding extreme outliers'
    },
    'percentile_based': {
        'min': percentiles['p5'],
        'max': percentiles['p95'],
        'description': 'Range from 5th to 95th percentile, robust to outliers'
    },
    'core_focused': {
        'min': 30.0,
        'max': 500.0,
        'description': 'Focuses on core range where majority of data resides'
    },
    'adaptive_range': {
        'min': max(min_val, percentiles['p1']),
        'max': min(max_val, percentiles['p99']),
        'description': 'Adaptive range from 1st to 99th percentile'
    }
}

# Outlier handling strategies
outlier_strategies = {
    'include_all': {
        'method': 'Keep all outliers in analysis',
        'implementation': 'Use full_range with all data points',
        'when_to_use': 'When outliers are important signals'
    },
    'cap_outliers': {
        'method': 'Cap outliers at specific percentiles',
        'implementation': f"Cap values below {percentiles['p5']:.2f} and above {percentiles['p95']:.2f}",
        'when_to_use': 'When outliers should be included but not dominate'
    },
    'remove_outliers': {
        'method': 'Remove outliers using IQR method',
        'implementation': f"Remove {outlier_analysis['iqr_method']['outlier_count']} outliers outside [{outlier_analysis['iqr_method']['lower_bound']:.2f}, {outlier_analysis['iqr_method']['upper_bound']:.2f}]",
        'when_to_use': 'When outliers are noise or errors'
    },
    'separate_analysis': {
        'method': 'Analyze outliers separately',
        'implementation': 'Create separate bins for outliers and core data',
        'when_to_use': 'When both patterns are important'
    }
}

# Generate Python code context for histogram creation
histogram_code = f'''
# Optimal histogram creation based on data analysis
import matplotlib.pyplot as plt
import numpy as np

# Load your price data
prices = np.array({str(price_data[:10])}... # {count_val} total values)

# Recommended bin strategy: {recommended_bins} bins
# Based on data characteristics: {"normally distributed" if distribution['is_normal'] else "non-normal distribution"},
# skewness={distribution['skewness']:.2f}, {core_range_analysis['percentage_in_range']:.1f}% in core range

# Option 1: Standard histogram with optimal bins
plt.hist(prices, bins={recommended_bins}, edgecolor='black')
plt.xlabel('Price ($)')
plt.ylabel('Frequency')
plt.title('Price Distribution - Optimal Binning')

# Option 2: Focused on core range (\${core_range_analysis['range'][0]}-\${core_range_analysis['range'][1]})
core_prices = prices[(prices >= {core_range_analysis['range'][0]}) & (prices <= {core_range_analysis['range'][1]})]
plt.hist(core_prices, bins={int(recommended_bins * 0.8)}, edgecolor='black')
plt.xlabel('Price ($)')
plt.ylabel('Frequency')
plt.title('Price Distribution - Core Range Focus')

# Option 3: With outlier handling
# Remove outliers using IQR method
clean_prices = prices[(prices >= {outlier_analysis['iqr_method']['lower_bound']:.2f}) &
                      (prices <= {outlier_analysis['iqr_method']['upper_bound']:.2f})]
plt.hist(clean_prices, bins={recommended_bins}, edgecolor='black')
plt.xlabel('Price ($)')
plt.ylabel('Frequency')
plt.title('Price Distribution - Outliers Removed')
'''

result = {
    'bin_strategies': bin_strategies,
    'recommended_bin_count': recommended_bins,
    'range_strategies': range_strategies,
    'outlier_strategies': outlier_strategies,
    'histogram_code_context': histogram_code,
    'data_summary': {
        'total_values': count_val,
        'price_range': [min_val, max_val],
        'core_range': core_range_analysis['range'],
        'outlier_count': outlier_analysis['iqr_method']['outlier_count'],
        'distribution_type': 'normal' if distribution['is_normal'] else 'non-normal'
    },
    'recommendations': {
        'optimal_bins': recommended_bins,
        'optimal_range': 'percentile_based' if outlier_analysis['iqr_method']['outlier_count'] > count_val * 0.05 else 'full_range',
        'outlier_handling': 'separate_analysis' if outlier_analysis['iqr_method']['outlier_count'] > count_val * 0.01 else 'include_all'
    }
}

print(json.dumps(result))`,
            taskExpectedOutput: 'JSON',
            llmConfig: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 4000, provider: 'openai' },
            dependencies: [{ agentName: 'StatisticalAnalyzer', required: true }],
            agentType: 'tool',
            mcpServers: [{ name: 'execution', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-execution'], transport: 'stdio' }],
            mcpTools: ['execute_python']
        };
        agentDefinitions.push(agent3Definition);

        return agentDefinitions;
    }

    /**
     * Clear created agents
     */
    public clearCreatedAgents(): void {
        this.createdAgents = [];
        this.agentCreationOrder = 0;
    }

    /**
     * Execute data profiling
     */
    async execute(input: DataProfileInput): Promise<AgentResult> {
        // Get input from context manager

        try {
            const ctx = this.contextManager.getContext('DataProfiler') as WorkingMemory;
   
            const prompt = this.buildPrompt({workflowDescription: ctx.lastTransactionResult, dataProfilerPrompt: ctx.prompt});

           const output = ''//await this.executeQuery(prompt); //dataProfileHistogramResponse  fs.readFileSync('C:/repos/SAGAMiddleware/data/dataProfileHistogramResponse.txt', 'utf-8'); //fs.readFileSync('C:/repos/SAGAMiddleware/data/dataProfiler_PythonEnvResponse.txt', 'utf-8');//

         //  this.createTestAgents();//
            const agentDefinitions = this.createTestAgents_2();
           // Store just the agent definitions (without the wrapper objects)
        //   const agentDefinitions = this.createdAgents.map(info => info.definition);
           this.setContext(agentDefinitions);
            return {
               agentName: 'DataProfiler',
                result: output,
                success: true,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
              agentName: 'DataProfiler',
                result: '',
                success: false,
                timestamp: new Date(), 
                error: ''
            };
        }
    }

    /**
     * Build prompt for data profiling
     * Generic prompt that wraps around user requirements without hardcoded assumptions
     */
    protected buildPrompt(input: DataProfileInput): string {
        return this.getGenericDataAnalysisPrompt(input);
    }

    /**
     * Validate input for data profiling
     */
    protected validateInput(input: any): boolean {
        return (
            input &&
            typeof input.workflowDescription === 'string' &&
            input.workflowDescription.length > 0
        );
    }

    /**
     * Get input from context manager
     */
    protected getInput(): DataProfileInput {
        const ctx = this.contextManager.getContext('DataProfiler') as WorkingMemory;
        const actualResult = ctx?.lastTransactionResult;
console.log('INPUT DATAPROFILER ', actualResult)
        if (!actualResult) {
            throw new Error('DataProfiler context not initialized. Ensure DefineUserRequirementsProcess has run first.');
        }

        // The context should already contain the properly structured DataProfileInput
        return actualResult as DataProfileInput;
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use execute() instead
     */
  /*  async analyzeAndGeneratePrompt(workflowDescription: string): Promise<string> {
        const result = await this.execute({ workflowDescription });
        if (!result.success) {
            throw new Error(result.error || 'Failed to generate prompt from file analysis');
        }
        return result.result;
    }*/

    /**
     * Legacy file analysis prompt (deprecated)
     * @deprecated This method used the old two-parameter interface. Use getGenericDataAnalysisPrompt instead.
     */
    getFileAnalysisPrompt(input: DataProfileInput): string {
        console.log('⚠️ WARNING: getFileAnalysisPrompt is deprecated. Use getGenericDataAnalysisPrompt instead.');
        console.log('WORKFLOW DESCRIPTION', input.workflowDescription);

        // This legacy method is no longer functional with the new interface
        // Redirecting to the new generic prompt
        return this.getGenericDataAnalysisPrompt(input);
    }

    /**
     * Generic data analysis prompt - wraps around user requirements
     * Instructs Claude to use create_generic_agent tool to create agents
     */
    getGenericDataAnalysisPrompt(input: DataProfileInput): string {
        console.log('WORKFLOW DESCRIPTION', input.workflowDescription);

        return `Create a data processing pipeline from this workflow plan:

${input.workflowDescription}

AGENT DESIGN DECISION:
First, analyze the task complexity to determine if one agent or multiple agents would be optimal:

**Use ONE agent when:**
- The task is straightforward (e.g., simple data loading and basic statistics)
- All operations are closely related and naturally sequential
- Complexity is low (e.g., read CSV, calculate stats, output JSON)

**Use MULTIPLE agents when:**
- The task is complex with distinct logical phases (e.g., data ingestion → statistical analysis → bin calculation → outlier detection)
- Different stages have different concerns or could fail independently
- Intermediate results from one phase are substantial and need validation before the next phase
- Each agent can have a clear, focused responsibility
- The workflow plan explicitly suggests multiple stages or agents

**Decision Process:**
1. Assess the workflow description complexity
2. Identify if there are natural breakpoints (e.g., data loading vs. analysis vs. calculation)
3. If complexity is LOW, create ONE comprehensive agent
4. If complexity is MODERATE-HIGH, create MULTIPLE focused agents for better modularity and error handling

CRITICAL INSTRUCTION - taskDescription Field:
The taskDescription parameter must contain EXECUTABLE PYTHON CODE, not instructions.
You must write the complete Python script that the agent will execute.

For each agent you decide to create:
1. Write complete, executable Python code for that agent's task
2. Call create_generic_agent with the Python code in taskDescription parameter
3. After creating all agents, output: "Created N agents: [names]. Pipeline complete." and STOP

IMPORTANT RESTRICTIONS:
- IGNORE any visualization agents in the workflow plan - DO NOT create them
- ONLY create agents for data processing, analysis, and calculation tasks
- ALL agents must use agentType: 'tool' (NEVER use 'processing')
- ALL code must be Python - NEVER generate JavaScript, HTML, or D3.js code

AGENT DATA FLOW:
- First agent: Loads CSV file with pd.read_csv(path) - processes full dataset
- Subsequent agents: Use _prev_result dictionary from previous agent
  Example: mean_val = _prev_result['mean']
- MCP server automatically passes data between agents via pickle file
- Each agent's result is saved for next agent to access via _prev_result

PYTHON CODE REQUIREMENTS (for code you write in taskDescription):
- Import json at top: import json
- Never simulate data (no np.random, no fake data)
- Never reload CSV in dependent agents (use _prev_result)
- Use safe variable names (count_val, mean_val, not reserved words)
- Define all variables before using in dictionaries
- Convert numpy/pandas types to native Python: float(), int(), .tolist()
- Must end with: print(json.dumps(result))

ANALYSIS DEPTH (when applicable):
- Be thorough and comprehensive in statistical analysis
- Include multiple calculation strategies when appropriate

Now analyze the workflow plan, decide on the optimal number of agents, and create them.`;
    }

    /**
     * Legacy histogram-specific prompt (deprecated)
     * @deprecated This method used the old two-parameter interface and hardcoded histogram assumptions. Use getGenericDataAnalysisPrompt instead.
     */
    getHistogramPrompt(input: DataProfileInput): string {
        console.log('⚠️ WARNING: getHistogramPrompt is deprecated. Use getGenericDataAnalysisPrompt instead.');
        console.log('WORKFLOW DESCRIPTION', input.workflowDescription);

        // This legacy method is no longer functional with the new interface
        // Redirecting to the new generic prompt which handles all visualization types
        return this.getGenericDataAnalysisPrompt(input);
    }
}
