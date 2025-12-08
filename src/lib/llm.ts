import Anthropic from '@anthropic-ai/sdk';
import ora from 'ora';
import { loadConfig } from './config.js';
import { validateEnv, getEffectiveModel, EnvValidationError, formatEnvError } from './env.js';

export interface LLMOptions {
  system?: string;
  maxTokens?: number;
  silent?: boolean;
}

export interface LLMClient {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
}

/**
 * Create Anthropic client
 */
function createAnthropicClient(apiKey: string, model: string): LLMClient {
  const client = new Anthropic({ apiKey });

  return {
    async complete(prompt: string, options: LLMOptions = {}): Promise<string> {
      const response = await client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 4096,
        system: options.system,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock?.text ?? '';
    },
  };
}

/**
 * Get configured LLM client
 */
export function getLLMClient(): LLMClient {
  const config = loadConfig();

  // Validate environment variables
  let env;
  try {
    env = validateEnv(config);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      throw new Error(formatEnvError(error));
    }
    throw error;
  }

  if (config.llm.provider !== 'anthropic') {
    throw new Error(`Unknown provider: ${config.llm.provider}`);
  }

  // Use model from env var if set, otherwise fall back to config
  const model = getEffectiveModel(env, config);

  return createAnthropicClient(env.apiKey, model);
}

/**
 * Complete with spinner UI
 */
export async function complete(
  prompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const spinner = options.silent ? null : ora('Thinking...').start();

  try {
    const client = getLLMClient();
    const result = await client.complete(prompt, options);
    spinner?.succeed('Done');
    return result;
  } catch (error) {
    spinner?.fail('Failed');
    throw error;
  }
}
