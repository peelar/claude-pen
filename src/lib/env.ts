/**
 * Environment variable validation and configuration
 *
 * Validates required and optional environment variables on startup.
 * Follows Bun best practices: fail fast with clear error messages.
 */

import type { ClaudePenConfig } from '../types.js';

/**
 * Valid Claude model identifiers (full names)
 */
const VALID_CLAUDE_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
] as const;

export type ValidClaudeModel = typeof VALID_CLAUDE_MODELS[number];

/**
 * Simple model name aliases for user convenience
 * Maps friendly names to full model identifiers
 */
const MODEL_ALIASES: Record<string, ValidClaudeModel> = {
  // Claude 4.5 (latest)
  'claude-sonnet-4.5': 'claude-sonnet-4-20250514',
  'claude-opus-4.5': 'claude-opus-4-20250514',
  'sonnet-4.5': 'claude-sonnet-4-20250514',
  'opus-4.5': 'claude-opus-4-20250514',

  // Claude 3.5
  'claude-sonnet-3.5': 'claude-3-5-sonnet-20241022',
  'claude-haiku-3.5': 'claude-3-5-haiku-20241022',
  'sonnet-3.5': 'claude-3-5-sonnet-20241022',
  'haiku-3.5': 'claude-3-5-haiku-20241022',

  // Claude 3
  'claude-opus-3': 'claude-3-opus-20240229',
  'claude-sonnet-3': 'claude-3-sonnet-20240229',
  'claude-haiku-3': 'claude-3-haiku-20240307',
  'opus-3': 'claude-3-opus-20240229',
  'sonnet-3': 'claude-3-sonnet-20240229',
  'haiku-3': 'claude-3-haiku-20240307',

  // Simple defaults (latest versions)
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'haiku': 'claude-3-5-haiku-20241022',
};

/**
 * Validated environment configuration
 */
export interface ValidatedEnv {
  apiKey: string;
  model?: ValidClaudeModel;
}

/**
 * Validation error with helpful context
 */
export class EnvValidationError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Check if a string is a valid Claude model identifier
 */
function isValidClaudeModel(model: string): model is ValidClaudeModel {
  return VALID_CLAUDE_MODELS.includes(model as ValidClaudeModel);
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(
  name: string,
  value: string | undefined,
  required: boolean
): string | undefined {
  if (!value || value.trim() === '') {
    if (required) {
      throw new EnvValidationError(
        `Missing required environment variable: ${name}`,
        `Set ${name} in your .env file or environment`
      );
    }
    return undefined;
  }
  return value.trim();
}

/**
 * Resolve model alias to full identifier
 */
function resolveModelAlias(model: string): ValidClaudeModel | string {
  // Check if it's an alias
  const resolved = MODEL_ALIASES[model.toLowerCase()];
  if (resolved) {
    return resolved;
  }

  // Return as-is if not an alias (will be validated next)
  return model;
}

/**
 * Validate Claude model identifier
 */
function validateModel(model: string | undefined): ValidClaudeModel | undefined {
  if (!model) {
    return undefined;
  }

  // Resolve alias first
  const resolved = resolveModelAlias(model);

  if (!isValidClaudeModel(resolved)) {
    // Suggest similar aliases or full model names
    const aliases = Object.keys(MODEL_ALIASES).slice(0, 5).join(', ');

    throw new EnvValidationError(
      `Invalid Claude model: ${model}`,
      `Try: ${aliases}, ...`
    );
  }

  return resolved;
}

/**
 * Validate environment variables for LLM configuration
 *
 * Validates:
 * - API key (required, from config.llm.apiKeyEnv)
 * - Model override (optional, from ANTHROPIC_MODEL or CLAUDE_PEN_MODEL)
 *
 * Falls back to config.llm.model if no env var override is provided.
 */
export function validateEnv(config: ClaudePenConfig): ValidatedEnv {
  // Validate API key (required)
  const apiKey = validateEnvVar(
    config.llm.apiKeyEnv,
    process.env[config.llm.apiKeyEnv],
    true
  );

  if (!apiKey) {
    throw new EnvValidationError(
      `API key not found`,
      `Set ${config.llm.apiKeyEnv} environment variable`
    );
  }

  // Check for model override (optional)
  // Priority: ANTHROPIC_MODEL > CLAUDE_PEN_MODEL > config.llm.model
  const modelOverride =
    process.env.ANTHROPIC_MODEL ||
    process.env.CLAUDE_PEN_MODEL;

  const model = validateModel(modelOverride);

  return {
    apiKey,
    model,
  };
}

/**
 * Get the effective model to use
 *
 * Returns model from env var if set, otherwise falls back to config
 */
export function getEffectiveModel(
  env: ValidatedEnv,
  config: ClaudePenConfig
): string {
  return env.model || config.llm.model;
}

/**
 * Format validation error for CLI display
 */
export function formatEnvError(error: EnvValidationError): string {
  const lines = [
    `❌ Environment validation error: ${error.message}`,
  ];

  if (error.hint) {
    lines.push(`💡 ${error.hint}`);
  }

  return lines.join('\n');
}
