import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import { hasConfig, saveConfig } from '../lib/config.js';
import { ensureDir } from '../lib/files.js';
import type { ClaudePenConfig } from '../types.js';

const DIRECTORIES = [
  '.claude-pen/prompts',
  '.claude-pen/prompts/format',
  'writing/import',
  'writing/raw',
  'writing/drafts',
  'writing/content/blog',
  'writing/content/linkedin',
  'writing/content/substack',
  'writing/content/twitter',
];

/**
 * Prompt user for input with optional default value
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const displayQuestion = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Initialize a new Claude Pen workspace
 */
export async function init(): Promise<void> {
  // Check if already initialized
  if (hasConfig()) {
    console.log(chalk.yellow('⚠ Already in a Claude Pen workspace.'));
    console.log('  Run commands from here or delete .claude-pen/ to reinitialize.');
    return;
  }

  console.log(chalk.bold('\n📝 Initialize Claude Pen Workspace\n'));

  // Gather configuration
  const author = await prompt('Your name');

  console.log(chalk.dim('\nLLM Configuration (press Enter for defaults)'));

  const providerInput = await prompt('Provider (anthropic/openai)', 'anthropic');
  const provider = providerInput === 'openai' ? 'openai' : 'anthropic';

  const defaultModel = provider === 'anthropic'
    ? 'claude-sonnet-4-20250514'
    : 'gpt-4o';
  const model = await prompt('Model', defaultModel);

  const defaultApiKeyEnv = provider === 'anthropic'
    ? 'ANTHROPIC_API_KEY'
    : 'OPENAI_API_KEY';
  const apiKeyEnv = await prompt('API key environment variable', defaultApiKeyEnv);

  // Create directories
  console.log(chalk.dim('\nCreating directories...'));
  for (const dir of DIRECTORIES) {
    ensureDir(path.join(process.cwd(), dir));
    console.log(chalk.dim(`  ${dir}/`));
  }

  // Save configuration
  const config: ClaudePenConfig = {
    author,
    llm: {
      provider: provider as 'anthropic' | 'openai',
      model,
      apiKeyEnv,
    },
  };

  saveConfig(config);
  console.log(chalk.dim('  .claude-pen/config.yaml'));

  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '# Claude Pen\nwriting/raw/\nwriting/drafts/\nwriting/import/\n');
    console.log(chalk.dim('  .gitignore'));
  }

  // Success message
  console.log(chalk.green('\n✓ Workspace initialized!\n'));

  console.log('Next steps:');
  console.log(chalk.cyan('  1. Add existing writing:'));
  console.log(`     Drop files in writing/import/, then run:\n`);
  console.log(`     claude-pen ingest --platform blog\n`);
  console.log(chalk.cyan('  2. Or import from specific directory:'));
  console.log('     claude-pen ingest ./my-posts --platform blog\n');
  console.log(chalk.cyan('  3. Review drafts and publish:'));
  console.log('     Check writing/drafts/, then move to writing/content/[platform]/\n');

  // API key reminder
  console.log(chalk.dim(`Remember to set ${apiKeyEnv} in your environment.`));
}
