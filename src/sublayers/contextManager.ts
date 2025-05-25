import { WorkingMemory } from '../types';

export class ContextManager {
  private workingMemory: Map<string, WorkingMemory> = new Map();
  private contextHistory: Map<string, WorkingMemory[]> = new Map();

  setContext(agentName: string, context: WorkingMemory): void {
    const history = this.contextHistory.get(agentName) || [];
    if (this.workingMemory.has(agentName)) {
      history.push(this.workingMemory.get(agentName)!);
    }
    
    this.workingMemory.set(agentName, { ...context });
    this.contextHistory.set(agentName, history);
  }

  getContext(agentName: string): WorkingMemory | undefined {
    return this.workingMemory.get(agentName);
  }

  updateContext(agentName: string, updates: Partial<WorkingMemory>): void {
    const current = this.workingMemory.get(agentName) || {};
    this.setContext(agentName, { ...current, ...updates });
  }

  clearContext(agentName: string): void {
    this.workingMemory.delete(agentName);
    this.contextHistory.delete(agentName);
  }

  getContextHistory(agentName: string): WorkingMemory[] {
    return this.contextHistory.get(agentName) || [];
  }

  rollbackContext(agentName: string, steps: number = 1): boolean {
    const history = this.contextHistory.get(agentName);
    if (!history || history.length < steps) {
      return false;
    }

    const targetContext = history[history.length - steps];
    this.workingMemory.set(agentName, targetContext);
    this.contextHistory.set(agentName, history.slice(0, -steps));
    return true;
  }
}