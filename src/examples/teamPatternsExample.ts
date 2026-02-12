/**
 * Team Patterns Example
 *
 * Demonstrates all 5 team orchestration patterns:
 * 1. Parallel Execution
 * 2. Consensus Voting
 * 3. Hierarchical Delegation
 * 4. Blackboard (Shared Context)
 * 5. Debate Team
 */

import {
    ParallelTeam,
    ConsensusTeam,
    HierarchicalTeam,
    BlackboardTeam,
    DebateTeam,
    type TeamMember
} from '../agents/teamOrchestrator.js';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// ============================================================================
// EXAMPLE 1: PARALLEL EXECUTION
// Multiple agents analyze a codebase simultaneously from different angles
// ============================================================================

async function example1_ParallelAnalysis() {
    console.log('\n\n' + '═'.repeat(70));
    console.log('EXAMPLE 1: PARALLEL EXECUTION - Multi-Perspective Code Analysis');
    console.log('═'.repeat(70));

    const team: TeamMember[] = [
        {
            name: 'security-analyst',
            role: 'Security Expert - identifies vulnerabilities and security risks',
            definition: {
                description: 'Security specialist analyzing code for vulnerabilities',
                tools: ['Read', 'Grep'],
                model: 'sonnet',
                prompt: 'You are a security expert. Analyze code for security vulnerabilities, injection risks, and security best practices.'
            }
        },
        {
            name: 'performance-analyst',
            role: 'Performance Expert - identifies bottlenecks and optimization opportunities',
            definition: {
                description: 'Performance specialist analyzing code efficiency',
                tools: ['Read', 'Grep'],
                model: 'sonnet',
                prompt: 'You are a performance expert. Analyze code for performance issues, algorithmic complexity, and optimization opportunities.'
            }
        },
        {
            name: 'maintainability-analyst',
            role: 'Code Quality Expert - evaluates maintainability and architecture',
            definition: {
                description: 'Code quality specialist analyzing maintainability',
                tools: ['Read', 'Grep'],
                model: 'sonnet',
                prompt: 'You are a code quality expert. Analyze code for maintainability, readability, and architectural patterns.'
            }
        }
    ];

    const parallelTeam = new ParallelTeam(team);

    // All agents analyze the SAME codebase simultaneously
    const results = await parallelTeam.analyzeFromMultiplePerspectives(
        `Analyze the file: c:/repos/SAGAMiddleware/src/workflows/sagaWorkflow.ts

Provide a focused analysis from your specific perspective (security/performance/maintainability).
Keep your analysis concise (5-7 key points).`
    );

    console.log('\n\n📊 PARALLEL ANALYSIS RESULTS:\n');
    results.forEach(result => {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`${result.agentName.toUpperCase()} (${result.duration}ms)`);
        console.log('─'.repeat(70));
        console.log(result.result.substring(0, 500) + '...\n');
    });
}

// ============================================================================
// EXAMPLE 2: CONSENSUS VOTING
// Multiple agents vote on the best architectural approach
// ============================================================================

async function example2_ConsensusVoting() {
    console.log('\n\n' + '═'.repeat(70));
    console.log('EXAMPLE 2: CONSENSUS VOTING - Architecture Decision');
    console.log('═'.repeat(70));

    const team: TeamMember[] = [
        {
            name: 'architect',
            role: 'Software Architect - prioritizes scalability and maintainability',
            definition: {
                description: 'Architecture specialist',
                model: 'sonnet',
                prompt: 'You are a software architect. Evaluate options based on scalability, maintainability, and long-term viability.'
            }
        },
        {
            name: 'devops',
            role: 'DevOps Engineer - prioritizes deployment and operations',
            definition: {
                description: 'DevOps specialist',
                model: 'sonnet',
                prompt: 'You are a DevOps engineer. Evaluate options based on deployment ease, monitoring, and operational complexity.'
            }
        },
        {
            name: 'developer',
            role: 'Senior Developer - prioritizes development speed and DX',
            definition: {
                description: 'Development specialist',
                model: 'sonnet',
                prompt: 'You are a senior developer. Evaluate options based on developer experience, implementation speed, and code simplicity.'
            }
        }
    ];

    const consensusTeam = new ConsensusTeam(team);

    const result = await consensusTeam.vote(
        'How should we implement caching for our data analysis pipeline?',
        [
            'Redis with TTL-based expiration',
            'In-memory LRU cache with file system backup',
            'SQLite-based persistent cache',
            'No caching (compute on-demand)'
        ],
        'Consider: performance, complexity, cost, and maintainability'
    );

    console.log('\n\n🏆 CONSENSUS RESULT:\n');
    console.log('Winner:', result.winner);
    console.log('\nVote Distribution:');
    Object.entries(result.votes).forEach(([option, count]) => {
        console.log(`  ${option}: ${'█'.repeat(count)} (${count})`);
    });
}

// ============================================================================
// EXAMPLE 3: HIERARCHICAL DELEGATION
// Main coordinator delegates to specialized sub-agents
// ============================================================================

async function example3_HierarchicalDelegation() {
    console.log('\n\n' + '═'.repeat(70));
    console.log('EXAMPLE 3: HIERARCHICAL DELEGATION - Data Processing Workflow');
    console.log('═'.repeat(70));

    const subAgents: Record<string, AgentDefinition> = {
        'data-loader': {
            description: 'Loads and validates CSV files',
            tools: ['Read', 'execute_python'],
            model: 'sonnet',
            prompt: 'You are a data loading specialist. Read CSV files, validate structure, and report statistics.'
        },
        'data-transformer': {
            description: 'Transforms and cleans data',
            tools: ['execute_python'],
            model: 'sonnet',
            prompt: 'You are a data transformation specialist. Clean, normalize, and transform data as requested.'
        },
        'data-analyzer': {
            description: 'Analyzes data and generates insights',
            tools: ['execute_python'],
            model: 'sonnet',
            prompt: 'You are a data analysis specialist. Calculate statistics, identify patterns, and generate insights.'
        }
    };

    const coordinatorPrompt = `You are the Main Coordinator for a data processing workflow.
You have access to three specialized sub-agents:
- data-loader: For loading and validating files
- data-transformer: For cleaning and transforming data
- data-analyzer: For analysis and insights

Delegate tasks appropriately using the Task tool. Coordinate their work to complete the overall goal.`;

    const hierarchicalTeam = new HierarchicalTeam(
        coordinatorPrompt,
        subAgents,
        { maxTurns: 25 }
    );

    const result = await hierarchicalTeam.execute(
        `Process the file: c:/repos/SAGAMiddleware/data/hourly_energy_data.csv

1. Load and validate the file
2. Calculate summary statistics (row count, unique installations, energy sources)
3. Identify the top 3 energy sources by average MW output

Coordinate the sub-agents to complete this analysis.`
    );

    console.log('\n\n📋 HIERARCHICAL WORKFLOW RESULT:\n');
    console.log(result);
}

// ============================================================================
// EXAMPLE 4: BLACKBOARD PATTERN
// Agents build shared knowledge collaboratively
// ============================================================================

async function example4_BlackboardPattern() {
    console.log('\n\n' + '═'.repeat(70));
    console.log('EXAMPLE 4: BLACKBOARD PATTERN - Collaborative Design');
    console.log('═'.repeat(70));

    const team: TeamMember[] = [
        {
            name: 'requirements-analyst',
            role: 'Requirements Analyst - defines what needs to be built',
            definition: {
                description: 'Requirements specialist',
                tools: ['Read'],
                model: 'sonnet',
                prompt: 'You are a requirements analyst. Define clear, actionable requirements for the feature.'
            }
        },
        {
            name: 'architect',
            role: 'System Architect - designs the technical solution',
            definition: {
                description: 'Architecture specialist',
                tools: ['Read', 'Grep'],
                model: 'sonnet',
                prompt: 'You are a system architect. Design the technical architecture based on the requirements provided by previous agents.'
            }
        },
        {
            name: 'implementation-planner',
            role: 'Implementation Planner - creates step-by-step plan',
            definition: {
                description: 'Implementation specialist',
                tools: ['Read', 'Grep'],
                model: 'sonnet',
                prompt: 'You are an implementation planner. Create a detailed implementation plan based on requirements and architecture provided by previous agents.'
            }
        }
    ];

    const blackboardTeam = new BlackboardTeam(team);

    const blackboard = await blackboardTeam.executeWithSharedContext(
        `Design a new feature for the SAGA workflow system:

Feature: "Conditional Branching Based on Agent Output"
Allow workflows to branch to different paths based on agent results.

Each agent should build on previous contributions to create a complete design.`
    );

    console.log('\n\n📋 SHARED KNOWLEDGE (BLACKBOARD):\n');
    Object.entries(blackboard).forEach(([agent, data]: [string, any]) => {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`${agent.toUpperCase()} - ${data.role}`);
        console.log('─'.repeat(70));
        console.log(data.contribution.substring(0, 400) + '...\n');
    });
}

// ============================================================================
// EXAMPLE 5: DEBATE TEAM
// Structured debate to explore pros and cons
// ============================================================================

async function example5_DebateTeam() {
    console.log('\n\n' + '═'.repeat(70));
    console.log('EXAMPLE 5: DEBATE TEAM - Structured Argument Analysis');
    console.log('═'.repeat(70));

    const advocate: TeamMember = {
        name: 'advocate',
        role: 'Advocate - argues in favor of the proposition',
        definition: {
            description: 'Advocate for the proposition',
            model: 'sonnet',
            prompt: 'You are an advocate. Present compelling arguments IN FAVOR of the topic. Be persuasive and evidence-based.'
        }
    };

    const critic: TeamMember = {
        name: 'critic',
        role: 'Critic - challenges and identifies weaknesses',
        definition: {
            description: 'Critic of the proposition',
            model: 'sonnet',
            prompt: 'You are a critical analyst. Challenge the argument by identifying weaknesses, risks, and counterarguments. Be thorough and skeptical.'
        }
    };

    const synthesizer: TeamMember = {
        name: 'synthesizer',
        role: 'Synthesizer - creates balanced conclusion',
        definition: {
            description: 'Synthesizer of perspectives',
            model: 'sonnet',
            prompt: 'You are a synthesis specialist. Create a balanced, nuanced conclusion that incorporates valid points from both sides.'
        }
    };

    const debateTeam = new DebateTeam(advocate, critic, synthesizer);

    const result = await debateTeam.debate(
        'Should our SAGA workflow system adopt a microservices architecture instead of the current monolithic approach?',
        2  // 2 rounds of debate
    );

    console.log('\n\n💭 DEBATE RESULT:\n');
    console.log(result);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY environment variable is not set');
        process.exit(1);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('TEAM ORCHESTRATION PATTERNS - DEMONSTRATION');
    console.log('═'.repeat(70));
    console.log('\nRunning 5 different team patterns...\n');

    try {
        // Run each example (comment out to run individually)
        await example1_ParallelAnalysis();
        await example2_ConsensusVoting();
        await example3_HierarchicalDelegation();
        await example4_BlackboardPattern();
        await example5_DebateTeam();

        console.log('\n\n' + '═'.repeat(70));
        console.log('✅ ALL EXAMPLES COMPLETED');
        console.log('═'.repeat(70));
    } catch (error) {
        console.error('\n❌ Error:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
        }
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export {
    example1_ParallelAnalysis,
    example2_ConsensusVoting,
    example3_HierarchicalDelegation,
    example4_BlackboardPattern,
    example5_DebateTeam
};
