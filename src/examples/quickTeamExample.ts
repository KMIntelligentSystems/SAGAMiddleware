/**
 * Quick Team Example - Ready to Run
 *
 * A simple demonstration you can run immediately to see agent teams in action.
 * This example uses the Debate Team pattern to analyze the TODO CLI tool idea.
 */

import { DebateTeam, type TeamMember } from '../agents/teamOrchestrator.js';

async function main() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ERROR: ANTHROPIC_API_KEY environment variable is not set');
        process.exit(1);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('QUICK TEAM DEMO: Analyzing the TODO CLI Tool Idea');
    console.log('═'.repeat(70) + '\n');

    // Define three team members with different perspectives
    const uxExpert: TeamMember = {
        name: 'ux-expert',
        role: 'UX Designer - focuses on developer experience and usability',
        definition: {
            description: 'UX specialist for developer tools',
            model: 'haiku',  // Using Haiku for speed
            prompt: `You are a UX expert specializing in developer tools.
Analyze ideas from the perspective of user experience, ease of use, and developer workflows.
Be constructive and suggest concrete UX improvements.`
        }
    };

    const techArchitect: TeamMember = {
        name: 'tech-architect',
        role: 'Technical Architect - focuses on feasibility and implementation',
        definition: {
            description: 'Technical architecture specialist',
            model: 'haiku',
            prompt: `You are a technical architect.
Analyze ideas from the perspective of technical feasibility, scalability, and implementation complexity.
Identify technical challenges and suggest solutions.`
        }
    };

    const critic: TeamMember = {
        name: 'critic',
        role: 'Devil\'s Advocate - challenges assumptions and finds flaws',
        definition: {
            description: 'Critical analyst and devil\'s advocate',
            model: 'haiku',
            prompt: `You are a critical analyst playing devil's advocate.
Challenge assumptions, identify potential problems, and question whether the idea is truly needed.
Be constructively critical - point out real issues that need addressing.`
        }
    };

    // Create debate team
    const team = new DebateTeam(uxExpert, techArchitect, critic, {
        model: 'haiku',  // Fast and cost-effective
        maxTurns: 8
    });

    // Run the debate
    const result = await team.debate(
        `Idea: A CLI tool that tracks TODO comments across a codebase.

Features:
- Scans code for TODO/FIXME/HACK comments
- Lists them by file, author (via git blame), and date
- Filters and searches TODOs
- Generates reports
- Integrates with CI/CD to track TODO trends

Is this a valuable tool worth building?`,
        1  // 1 round (advocate, critic, synthesize)
    );

    console.log('\n' + '═'.repeat(70));
    console.log('DEBATE RESULT');
    console.log('═'.repeat(70));
    console.log(result);

    console.log('\n\n' + '═'.repeat(70));
    console.log('✅ DEBATE COMPLETE');
    console.log('═'.repeat(70));
    console.log('\nYou can see how three different perspectives were analyzed!');
    console.log('\nTo run other patterns, check out: teamPatternsExample.ts\n');
}

main().catch(console.error);
