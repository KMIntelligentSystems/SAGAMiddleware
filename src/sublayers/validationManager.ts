import { ValidationResult, AgentResult } from '../types/index.js';
import { mcpClientManager } from '../mcp/mcpClient.js';

export class ValidationManager {
  private validators: Map<string, AgentValidator> = new Map();
  private mcpValidator = new SchemaValidator(null)
  registerValidator(agentName: string, validator: AgentValidator): void {
    this.validators.set(agentName, validator);
  }

  async validateAgentOutput(agentName: string, output: any): Promise<ValidationResult> {
    const validator = this.validators.get(agentName);
    const baseResult = validator ? await validator.validate(output) : { isValid: true, errors: [], warnings: [] };
    
    // Additional MCP-specific validation
    const mcpValidation = await this.mcpValidator.validateMCPOutput(output);
    
    return {
      isValid: baseResult.isValid && mcpValidation.isValid,
      errors: [...baseResult.errors, ...mcpValidation.errors],
      warnings: [...baseResult.warnings, ...mcpValidation.warnings]
    };
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

  // MCP-specific validation methods
  async validateMCPOutput(output: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output || typeof output !== 'object') {
      return { isValid: true, errors, warnings };
    }

    // Validate MCP tool call results
    if (output.mcpToolCallSuccess === false && output.mcpToolError) {
      errors.push(`MCP tool call failed: ${output.mcpToolError}`);
    }

    // Validate multiple MCP tool calls
    if (output.mcpToolErrors && Array.isArray(output.mcpToolErrors)) {
      for (const toolError of output.mcpToolErrors) {
        if (!toolError.success) {
          errors.push(`MCP tool '${toolError.call?.name}' failed: ${toolError.error}`);
        }
      }
    }

    // Validate MCP tool call structure
    if (output.mcpToolCall) {
      const toolCallValidation = this.validateMCPToolCall(output.mcpToolCall);
      errors.push(...toolCallValidation.errors);
      warnings.push(...toolCallValidation.warnings);
    }

    if (output.mcpToolCalls && Array.isArray(output.mcpToolCalls)) {
      for (const toolCall of output.mcpToolCalls) {
        const toolCallValidation = this.validateMCPToolCall(toolCall);
        errors.push(...toolCallValidation.errors);
        warnings.push(...toolCallValidation.warnings);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateMCPToolCall(toolCall: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!toolCall || typeof toolCall !== 'object') {
      errors.push('Invalid MCP tool call structure');
      return { isValid: false, errors, warnings };
    }

    if (!toolCall.name || typeof toolCall.name !== 'string') {
      errors.push('MCP tool call missing or invalid name');
    }

    if (!toolCall.arguments || typeof toolCall.arguments !== 'object') {
      warnings.push('MCP tool call missing arguments object');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  
  // Validate MCP tool availability
  async validateMCPToolAvailability(toolNames: string[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const availableTools = await mcpClientManager.listTools();
      const availableToolNames = availableTools.map(tool => tool.name);

      for (const toolName of toolNames) {
        if (!availableToolNames.includes(toolName)) {
          errors.push(`MCP tool '${toolName}' is not available on any connected server`);
        }
      }
    } catch (error) {
      warnings.push(`Could not validate MCP tool availability: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Validate MCP resource accessibility
  async validateMCPResourceAccess(resourceUris: string[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const availableResources = await mcpClientManager.listResources();
      const availableResourceUris = availableResources.map(resource => resource.uri);

      for (const uri of resourceUris) {
        if (!availableResourceUris.includes(uri)) {
          warnings.push(`MCP resource '${uri}' may not be available on connected servers`);
        }
      }
    } catch (error) {
      warnings.push(`Could not validate MCP resource access: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Validate MCP server connectivity
  async validateMCPConnectivity(serverNames?: string[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const connectedServers = mcpClientManager.getConnectedServers();
    
    if (connectedServers.length === 0) {
      warnings.push('No MCP servers are currently connected');
    }

    if (serverNames) {
      for (const serverName of serverNames) {
        if (!mcpClientManager.isConnected(serverName)) {
          errors.push(`MCP server '${serverName}' is not connected`);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}