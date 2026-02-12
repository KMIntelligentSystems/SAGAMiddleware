/**
 * Team Orchestrator - Advanced multi-agent coordination patterns
 *
 * Provides patterns for:
 * - Parallel execution
 * - Consensus voting
 * - Multi-perspective analysis
 * - Shared context (blackboard pattern)
 */

import {
    query,
    type Options,
    type AgentDefinition,
    type SDKMessage
} from '@anthropic-ai/claude-agent-sdk';

export interface TeamMember {
    name: string;
    definition: AgentDefinition;
    role: string;
}

export interface ParallelResult {
    agentName: string;
    role: string;
    result: string;
    duration: number;
    success: boolean;
}

export interface ConsensusResult {
    winner: string;
    votes: Record<string, number>;
    analysis: string;
}

/**
 * Pattern 1: Parallel Execution
 * Multiple agents work simultaneously on the same or different tasks
 */
export class ParallelTeam {
    private members: TeamMember[];
    private baseOptions: Options;

    constructor(members: TeamMember[], baseOptions: Partial<Options> = {}) {
        this.members = members;
        this.baseOptions = {
            permissionMode: 'bypassPermissions',
            maxTurns: 10,
            cwd: process.cwd(),
            model: 'sonnet',
            ...baseOptions
        };
    }

    /**
     * Execute multiple agents in parallel on different prompts
     */
    async executeParallel(prompts: Record<string, string>): Promise<ParallelResult[]> {
        console.log('\n🔄 Parallel Execution: Running', this.members.length, 'agents simultaneously...\n');

        const promises = this.members.map(async (member) => {
            const prompt = prompts[member.name];
            if (!prompt) {
                throw new Error(`No prompt provided for agent: ${member.name}`);
            }

            const startTime = Date.now();

            try {
                const result = await this.runAgent(member, prompt);
                const duration = Date.now() - startTime;

                console.log(`✅ ${member.name} (${member.role}) completed in ${duration}ms`);

                return {
                    agentName: member.name,
                    role: member.role,
                    result,
                    duration,
                    success: true
                };
            } catch (error) {
                console.error(`❌ ${member.name} failed:`, error);
                return {
                    agentName: member.name,
                    role: member.role,
                    result: `Error: ${error}`,
                    duration: Date.now() - startTime,
                    success: false
                };
            }
        });

        return Promise.all(promises);
    }

    /**
     * Execute multiple agents on the SAME prompt (multi-perspective analysis)
     */
    async analyzeFromMultiplePerspectives(task: string): Promise<ParallelResult[]> {
        console.log('\n🎭 Multi-Perspective Analysis:', this.members.length, 'viewpoints\n');

        const prompts: Record<string, string> = {};

        this.members.forEach(member => {
            prompts[member.name] = `${task}

Your perspective: ${member.role}
Provide your analysis from this specific viewpoint.`;
        });

        return this.executeParallel(prompts);
    }

    private async runAgent(member: TeamMember, prompt: string): Promise<string> {
        let result = '';

        const q = query({
            prompt,
            options: this.baseOptions
        });

        for await (const message of q) {
            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
            }
        }

        return result;
    }
}

/**
 * Pattern 2: Consensus/Voting Team
 * Multiple agents evaluate options and vote on the best approach
 */
export class ConsensusTeam {
    private members: TeamMember[];
    private baseOptions: Options;

    constructor(members: TeamMember[], baseOptions: Partial<Options> = {}) {
        this.members = members;
        this.baseOptions = {
            permissionMode: 'bypassPermissions',
            maxTurns: 10,
            cwd: process.cwd(),
            model: 'sonnet',
            ...baseOptions
        };
    }

    /**
     * Have all agents vote on the best option
     */
    async vote(
        question: string,
        options: string[],
        votingCriteria?: string
    ): Promise<ConsensusResult> {
        console.log('\n🗳️  Consensus Voting:', this.members.length, 'agents voting...\n');

        // Phase 1: Collect votes from all agents in parallel
        const votePromises = this.members.map(async (member) => {
            const prompt = this.buildVotingPrompt(question, options, votingCriteria, member.role);

            let result = '';
            const q = query({ prompt, options: this.baseOptions });

            for await (const message of q) {
                if (message.type === 'result' && message.subtype === 'success') {
                    result = message.result;
                }
            }

            // Extract vote from result (assumes agent returns option number or name)
            const vote = this.extractVote(result, options);
            console.log(`  ${member.name} (${member.role}) → voted for: ${vote}`);

            return { agent: member.name, vote, reasoning: result };
        });

        const votes = await Promise.all(votePromises);

        // Phase 2: Tally votes
        const voteCounts: Record<string, number> = {};
        options.forEach(opt => voteCounts[opt] = 0);

        votes.forEach(v => {
            if (v.vote && voteCounts[v.vote] !== undefined) {
                voteCounts[v.vote]++;
            }
        });

        // Phase 3: Determine winner
        const winner = Object.entries(voteCounts).reduce((a, b) =>
            b[1] > a[1] ? b : a
        )[0];

        console.log('\n📊 Vote Results:');
        Object.entries(voteCounts).forEach(([opt, count]) => {
            console.log(`  ${opt}: ${count} votes ${opt === winner ? '👑' : ''}`);
        });

        return {
            winner,
            votes: voteCounts,
            analysis: this.formatVotingAnalysis(votes, winner)
        };
    }

    private buildVotingPrompt(
        question: string,
        options: string[],
        criteria: string | undefined,
        role: string
    ): string {
        return `You are voting as: ${role}

Question: ${question}

Available options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

${criteria ? `Voting criteria: ${criteria}` : ''}

Provide your vote and reasoning. Your response must clearly indicate which option you choose.
Format your response as:
VOTE: [option name]
REASONING: [your detailed reasoning from your perspective as ${role}]`;
    }

    private extractVote(result: string, options: string[]): string {
        // Try to extract explicit VOTE: line
        const voteMatch = result.match(/VOTE:\s*(.+)/i);
        if (voteMatch) {
            const vote = voteMatch[1].trim();
            // Match against options
            const match = options.find(opt =>
                vote.toLowerCase().includes(opt.toLowerCase()) ||
                opt.toLowerCase().includes(vote.toLowerCase())
            );
            return match || options[0];
        }

        // Fallback: find which option is mentioned most
        const mentions = options.map(opt => ({
            option: opt,
            count: (result.toLowerCase().match(new RegExp(opt.toLowerCase(), 'g')) || []).length
        }));

        return mentions.reduce((a, b) => b.count > a.count ? b : a).option;
    }

    private formatVotingAnalysis(
        votes: { agent: string; vote: string; reasoning: string }[],
        winner: string
    ): string {
        return `
Winning Option: ${winner}

Individual Votes:
${votes.map(v => `
${v.agent}: ${v.vote}
${v.reasoning.substring(0, 200)}...
`).join('\n---\n')}
        `.trim();
    }
}

/**
 * Pattern 3: Hierarchical Team (Main + Sub-agents)
 * One main coordinator delegates to specialized sub-agents
 */
export class HierarchicalTeam {
    private coordinator: string;
    private subAgents: Record<string, AgentDefinition>;
    private options: Options;

    constructor(
        coordinatorPrompt: string,
        subAgents: Record<string, AgentDefinition>,
        baseOptions: Partial<Options> = {}
    ) {
        this.coordinator = coordinatorPrompt;
        this.subAgents = subAgents;
        this.options = {
            agents: subAgents,
            permissionMode: 'bypassPermissions',
            maxTurns: 20,
            cwd: process.cwd(),
            model: 'sonnet',
            ...baseOptions
        };
    }

    /**
     * Execute the hierarchical workflow
     */
    async execute(task: string): Promise<string> {
        console.log('\n👥 Hierarchical Team: Main coordinator delegating to',
            Object.keys(this.subAgents).length, 'sub-agents\n');

        const prompt = `${this.coordinator}

Available Sub-Agents:
${Object.entries(this.subAgents).map(([name, def]) =>
    `- ${name}: ${def.description}`
).join('\n')}

Task: ${task}

Coordinate the sub-agents to complete this task. Delegate using the Task tool.`;

        let result = '';
        let turnCount = 0;

        const q = query({
            prompt,
            options: this.options
        });

        for await (const message of q) {
            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
            } else if (message.type === 'assistant') {
                turnCount++;
                console.log(`[Turn ${turnCount}] Coordinator working...`);
            }
        }

        return result;
    }
}

/**
 * Pattern 4: Blackboard (Shared Context)
 * Agents read from and write to shared memory
 */
export class BlackboardTeam {
    private members: TeamMember[];
    private baseOptions: Options;
    private blackboard: Map<string, any>;

    constructor(members: TeamMember[], baseOptions: Partial<Options> = {}) {
        this.members = members;
        this.blackboard = new Map();
        this.baseOptions = {
            permissionMode: 'bypassPermissions',
            maxTurns: 10,
            cwd: process.cwd(),
            model: 'sonnet',
            ...baseOptions
        };
    }

    /**
     * Execute agents sequentially, each adding to shared context
     */
    async executeWithSharedContext(task: string): Promise<Record<string, any>> {
        console.log('\n📋 Blackboard Pattern: Agents building shared knowledge\n');

        for (const member of this.members) {
            console.log(`\n▶️  ${member.name} (${member.role}) contributing...`);

            // Build prompt with current blackboard state
            const prompt = `${task}

Your role: ${member.role}

Current shared knowledge (blackboard):
${this.formatBlackboard()}

Add your contribution to the shared knowledge. Build upon what previous agents have provided.`;

            let result = '';
            const q = query({ prompt, options: this.baseOptions });

            for await (const message of q) {
                if (message.type === 'result' && message.subtype === 'success') {
                    result = message.result;
                }
            }

            // Add agent's contribution to blackboard
            this.blackboard.set(member.name, {
                role: member.role,
                contribution: result,
                timestamp: new Date()
            });

            console.log(`✅ ${member.name} added to blackboard`);
        }

        // Return final blackboard state
        return Object.fromEntries(this.blackboard);
    }

    private formatBlackboard(): string {
        if (this.blackboard.size === 0) {
            return '(Empty - you are the first contributor)';
        }

        return Array.from(this.blackboard.entries())
            .map(([name, data]) => `
${name} (${data.role}):
${data.contribution}
`)
            .join('\n---\n');
    }

    getBlackboard(): Map<string, any> {
        return this.blackboard;
    }
}

/**
 * Pattern 5: Debate Team
 * Agents engage in structured debate (propose → challenge → synthesize)
 */
export class DebateTeam {
    private advocate: TeamMember;
    private critic: TeamMember;
    private synthesizer: TeamMember;
    private baseOptions: Options;

    constructor(
        advocate: TeamMember,
        critic: TeamMember,
        synthesizer: TeamMember,
        baseOptions: Partial<Options> = {}
    ) {
        this.advocate = advocate;
        this.critic = critic;
        this.synthesizer = synthesizer;
        this.baseOptions = {
            permissionMode: 'bypassPermissions',
            maxTurns: 10,
            cwd: process.cwd(),
            model: 'sonnet',
            ...baseOptions
        };
    }

    async debate(topic: string, rounds: number = 2): Promise<string> {
        console.log('\n💭 Debate Team: Starting structured debate\n');

        let advocatePosition = '';
        let criticResponse = '';

        for (let round = 1; round <= rounds; round++) {
            console.log(`\n🔄 Round ${round}/${rounds}`);

            // Advocate presents or refines position
            console.log('  📢 Advocate presenting...');
            advocatePosition = await this.runAgent(
                this.advocate,
                round === 1
                    ? `Present your position on: ${topic}`
                    : `Refine your position considering the critic's feedback: ${criticResponse}\n\nOriginal topic: ${topic}`
            );

            // Critic challenges
            console.log('  🔍 Critic challenging...');
            criticResponse = await this.runAgent(
                this.critic,
                `Challenge this position:\n\n${advocatePosition}\n\nTopic: ${topic}`
            );
        }

        // Synthesizer creates balanced conclusion
        console.log('  ⚖️  Synthesizer creating balanced view...');
        const synthesis = await this.runAgent(
            this.synthesizer,
            `Synthesize a balanced conclusion from this debate:

Advocate's final position:
${advocatePosition}

Critic's final response:
${criticResponse}

Original topic: ${topic}

Provide a nuanced synthesis that incorporates strengths from both perspectives.`
        );

        return `
# Debate on: ${topic}

## Advocate's Position
${advocatePosition}

## Critic's Response
${criticResponse}

## Synthesis
${synthesis}
        `.trim();
    }

    private async runAgent(member: TeamMember, prompt: string): Promise<string> {
        let result = '';
        const q = query({ prompt, options: this.baseOptions });

        for await (const message of q) {
            if (message.type === 'result' && message.subtype === 'success') {
                result = message.result;
            }
        }

        return result;
    }
}
