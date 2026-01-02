/**
 * Prompt Registry
 *
 * Central registry for all agent prompts used in DAG workflows.
 * Maps prompt keys to actual prompt strings from visualizationSaga.ts
 */

import {
    MCPPythonCoderResultPrompt,
    D3ReadyAnalysisPrompt,
    histogramInterpretationPrompt,
    histogramValidationPrompt,
    geminiConversationAnalysis,
    createPrompt
} from '../types/visualizationSaga.js';

export const PROMPT_REGISTRY: Record<string, string> = {
    // Validation prompts
    'DataProfilerPrompt': geminiConversationAnalysis,
    'MCPPythonCoderResult': MCPPythonCoderResultPrompt,
    'D3ReadyAnalysis': D3ReadyAnalysisPrompt,
    'CreatePrompt': createPrompt,
    // D3.js coding prompts
    'histogramInterpretation': histogramInterpretationPrompt,
    'histogramValidation': histogramValidationPrompt
};

/**
 * Get a prompt by key
 * @param key - The prompt key
 * @returns The prompt string
 * @throws Error if prompt key not found
 */
export function getPrompt(key: string): string {
    const prompt = PROMPT_REGISTRY[key];
    if (!prompt) {
        throw new Error(`Prompt not found: ${key}. Available prompts: ${Object.keys(PROMPT_REGISTRY).join(', ')}`);
    }
    return prompt;
}

/**
 * Check if a prompt key exists
 * @param key - The prompt key to check
 * @returns True if prompt exists
 */
export function hasPrompt(key: string): boolean {
    return key in PROMPT_REGISTRY;
}
