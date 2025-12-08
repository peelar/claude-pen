import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import yaml from 'yaml';
import { findProjectRoot } from './config.js';

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Parse markdown file with YAML frontmatter
 */
export function readMarkdown(filePath: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Check for frontmatter
  if (!raw.startsWith('---')) {
    return { frontmatter: {}, content: raw };
  }

  const endIndex = raw.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: {}, content: raw };
  }

  const frontmatterStr = raw.slice(3, endIndex).trim();
  const content = raw.slice(endIndex + 3).trim();

  try {
    const frontmatter = yaml.parse(frontmatterStr) ?? {};
    return { frontmatter, content };
  } catch {
    return { frontmatter: {}, content: raw };
  }
}

/**
 * Write markdown file with YAML frontmatter
 */
export function writeMarkdown(
  filePath: string,
  frontmatter: Record<string, unknown>,
  content: string
): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  let output: string;

  if (Object.keys(frontmatter).length > 0) {
    output = `---\n${yaml.stringify(frontmatter)}---\n\n${content}`;
  } else {
    output = content;
  }

  fs.writeFileSync(filePath, output);
}

/**
 * List all markdown files in directory (recursive)
 */
export async function listMarkdownFiles(dir: string): Promise<string[]> {
  const pattern = path.join(dir, '**/*.md');
  return glob(pattern, { nodir: true });
}

/**
 * Get project root or throw
 */
export function getProjectRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    throw new Error('Not in a Claude Pen workspace. Run `claude-pen init` first.');
  }
  return root;
}

/**
 * Get path relative to project root
 */
export function getPath(...segments: string[]): string {
  return path.join(getProjectRoot(), ...segments);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Slugify a string for filenames
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
