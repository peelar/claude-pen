import Anthropic from '@anthropic-ai/sdk';
import ora from 'ora';
import { loadConfig } from './config.js';

export interface LLMOptions {
  system?: string;
  maxTokens?: number;
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
 * Create OpenAI client (placeholder for future)
 */
function createOpenAIClient(apiKey: string, model: string): LLMClient {
  // TODO: Implement when adding OpenAI support
  throw new Error('OpenAI provider not yet implemented');
}

/**
 * Get configured LLM client
 */
export function getLLMClient(): LLMClient {
  const config = loadConfig();
  const apiKey = process.env[config.llm.apiKeyEnv];

  if (!apiKey) {
    throw new Error(
      `API key not found. Set ${config.llm.apiKeyEnv} environment variable.`
    );
  }

  switch (config.llm.provider) {
    case 'anthropic':
      return createAnthropicClient(apiKey, config.llm.model);
    case 'openai':
      return createOpenAIClient(apiKey, config.llm.model);
    default:
      throw new Error(`Unknown provider: ${config.llm.provider}`);
  }
}

/**
 * Complete with spinner UI
 */
export async function complete(
  prompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const spinner = ora('Thinking...').start();

  try {
    const client = getLLMClient();
    const result = await client.complete(prompt, options);
    spinner.succeed('Done');
    return result;
  } catch (error) {
    spinner.fail('Failed');
    throw error;
  }
}
