import fs from 'fs';
import path from 'path';
import { findProjectRoot } from './config.js';

/**
 * Get the directory where bundled prompts live
 */
function getBundledPromptsDir(): string {
  // In development, relative to this file
  // src/lib/prompts.ts -> src/prompts/
  return path.join(path.dirname(import.meta.url.replace('file://', '')), '../prompts');
}

/**
 * Get user's custom prompts directory
 */
function getUserPromptsDir(): string | null {
  const root = findProjectRoot();
  if (!root) return null;

  const userDir = path.join(root, '.claude-pen', 'prompts');
  return fs.existsSync(userDir) ? userDir : null;
}

/**
 * Load a prompt by name
 *
 * Priority: user's .claude-pen/prompts/ > bundled prompts
 *
 * @param name - Prompt name like 'proofread' or 'format/linkedin'
 */
export function loadPrompt(name: string): string {
  const filename = name.endsWith('.md') ? name : `${name}.md`;

  // Try user prompts first
  const userDir = getUserPromptsDir();
  if (userDir) {
    const userPath = path.join(userDir, filename);
    if (fs.existsSync(userPath)) {
      return fs.readFileSync(userPath, 'utf-8');
    }
  }

  // Fall back to bundled prompts
  const bundledPath = path.join(getBundledPromptsDir(), filename);
  if (fs.existsSync(bundledPath)) {
    return fs.readFileSync(bundledPath, 'utf-8');
  }

  throw new Error(`Prompt not found: ${name}`);
}

/**
 * Interpolate variables into prompt template
 *
 * Replaces {{variable}} with values from context
 */
export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in context) {
      return context[key];
    }
    return `{{${key}}}`; // Leave unmatched
  });
}
