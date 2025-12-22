import { DAGDefinition } from '../types/dag.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Load a saved DAG definition from file
 * Useful for testing without running expensive dagDesigner
 */
export async function loadDAG(filename: string): Promise<DAGDefinition> {
    const dagPath = path.join('./data/designed_dags', filename);
    const dagJson = await fs.readFile(dagPath, 'utf-8');
    return JSON.parse(dagJson) as DAGDefinition;
}

/**
 * List all available saved DAGs
 */
export async function listSavedDAGs(): Promise<string[]> {
    try {
        const files = await fs.readdir('./data/designed_dags');
        return files.filter(f => f.endsWith('.json'));
    } catch (error) {
        return [];
    }
}

/**
 * Save a DAG definition to file
 */
export async function saveDAG(dag: DAGDefinition, filename: string): Promise<string> {
    const dagPath = path.join('./data/designed_dags', filename);
    await fs.mkdir('./data/designed_dags', { recursive: true });
    await fs.writeFile(dagPath, JSON.stringify(dag, null, 2));
    return dagPath;
}
