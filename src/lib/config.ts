import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type { ClaudePenConfig } from '../types.js';

const CONFIG_DIR = '.claude-pen';
const CONFIG_FILE = 'config.yaml';

const DEFAULT_CONFIG: ClaudePenConfig = {
  author: '',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

/**
 * Walk up directory tree to find .claude-pen folder
 */
export function findProjectRoot(): string | null {
  let current = process.cwd();

  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, CONFIG_DIR))) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Get path to config directory
 */
export function getConfigDir(): string {
  const root = findProjectRoot();
  if (!root) {
    throw new Error('Not in a Claude Pen workspace. Run `claude-pen init` first.');
  }
  return path.join(root, CONFIG_DIR);
}

/**
 * Check if we're in an initialized workspace
 */
export function hasConfig(): boolean {
  return findProjectRoot() !== null;
}

/**
 * Load config from .claude-pen/config.yaml
 */
export function loadConfig(): ClaudePenConfig {
  const configPath = path.join(getConfigDir(), CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.parse(content) as Partial<ClaudePenConfig>;

  return { ...DEFAULT_CONFIG, ...config };
}

/**
 * Save config to .claude-pen/config.yaml
 */
export function saveConfig(config: ClaudePenConfig): void {
  const configDir = path.join(process.cwd(), CONFIG_DIR);
  const configPath = path.join(configDir, CONFIG_FILE);

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, yaml.stringify(config));
}

/**
 * Get default config for init
 */
export function getDefaultConfig(): ClaudePenConfig {
  return { ...DEFAULT_CONFIG };
}
