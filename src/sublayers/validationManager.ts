import { ValidationResult, AgentResult } from '../types';

export class ValidationManager {
  private validators: Map<string, AgentValidator> = new Map();

  registerValidator(agentName: string, validator: AgentValidator): void {
    this.validators.set(agentName, validator);
  }

  async validateAgentOutput(agentName: string, output: any): Promise<ValidationResult> {
    const validator = this.validators.get(agentName);
    if (!validator) {
      return { isValid: true, errors: [], warnings: [] };
    }

    return await validator.validate(output);
  }

  async validateGenerateReflectCycle(
    generateResult: AgentResult,
    reflectResult: AgentResult
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!generateResult.success) {
      errors.push(`Generate agent failed: ${generateResult.error}`);
    }

    if (!reflectResult.success) {
      errors.push(`Reflect agent failed: ${reflectResult.error}`);
    }

    const generateValidation = await this.validateAgentOutput(
      generateResult.agentName,
      generateResult.result
    );
    
    const reflectValidation = await this.validateAgentOutput(
      reflectResult.agentName,
      reflectResult.result
    );

    errors.push(...generateValidation.errors, ...reflectValidation.errors);
    warnings.push(...generateValidation.warnings, ...reflectValidation.warnings);

    if (reflectValidation.isValid && reflectResult.result?.needsRegeneration) {
      warnings.push('Reflect agent suggests regeneration needed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export interface AgentValidator {
  validate(output: any): Promise<ValidationResult>;
}

export class SchemaValidator implements AgentValidator {
  constructor(private schema: any) {}

  async validate(output: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (typeof this.schema.validate === 'function') {
        const result = this.schema.validate(output);
        if (result.error) {
          errors.push(`Schema validation failed: ${result.error.message}`);
        }
      }
    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}