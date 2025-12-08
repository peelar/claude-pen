import { readdir } from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import yaml from 'yaml';

import type { Platform, ArticleFrontmatter } from '../types.js';
import {
  listMarkdownFiles,
  readMarkdown,
  writeMarkdown,
  getPath,
  countWords,
  slugify,
} from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

interface IngestOptions {
  platform: Platform;
  published?: boolean;
}

interface ExtractedMetadata {
  title: string;
  date: string | null;
  tags: string[];
  summary: string;
}

/**
 * Parse LLM response as YAML metadata
 * Handles markdown code fences and invalid YAML gracefully
 */
function parseMetadata(response: string): ExtractedMetadata {
  // Clean up response - remove markdown code fences
  const cleaned = response
    .replace(/```ya?ml\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = yaml.parse(cleaned);
    return {
      title: parsed.title || 'Untitled',
      date: parsed.date || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      summary: parsed.summary || '',
    };
  } catch (error) {
    console.error(chalk.yellow('  Warning: Could not parse metadata, using defaults'));
    return {
      title: 'Untitled',
      date: null,
      tags: [],
      summary: '',
    };
  }
}

/**
 * Generate safe filename from metadata
 * Format: YYYY-MM-DD_slug.md
 */
function generateFilename(metadata: ExtractedMetadata): string {
  const date = metadata.date || new Date().toISOString().split('T')[0];
  const slug = slugify(metadata.title);
  return `${date}_${slug}.md`;
}

/**
 * Process a single file: extract metadata and write to destination
 */
async function ingestFile(
  filePath: string,
  platform: Platform,
  promptTemplate: string,
  spinner: Ora,
  destinationDir: string
): Promise<{ success: boolean; outputPath?: string; skipped?: boolean }> {
  const { frontmatter, content } = readMarkdown(filePath);

  // Skip if already has title (already ingested)
  if (frontmatter.title) {
    return { success: true, skipped: true };
  }

  // Extract metadata via LLM
  spinner.text = `${path.basename(filePath)} - extracting metadata...`;
  const prompt = interpolate(promptTemplate, { content });
  const response = await complete(prompt, {
    system: 'You are a metadata extraction assistant.',
    maxTokens: 500,
    silent: true,
  });

  const metadata = parseMetadata(response);

  // Build frontmatter
  const outputFrontmatter: Record<string, unknown> = {
    title: metadata.title,
    date: metadata.date || new Date().toISOString().split('T')[0],
    platform,
    word_count: countWords(content),
    tags: metadata.tags,
    summary: metadata.summary,
  };

  // Generate output path
  const filename = generateFilename(metadata);
  const outputPath = path.join(destinationDir, filename);

  // Write to destination
  writeMarkdown(outputPath, outputFrontmatter, content);

  return { success: true, outputPath };
}

/**
 * Main ingest command
 */
export async function ingest(
  dir: string | undefined,
  options: IngestOptions
): Promise<void> {
  const { platform, published } = options;

  // Default to writing/import if no directory specified
  const sourceDir = dir || getPath('writing', 'import');

  // Determine destination based on published flag
  const destinationDir = published
    ? getPath('writing', 'content', platform)
    : getPath('writing', 'drafts');

  const destinationLabel = published
    ? `writing/content/${platform}/`
    : 'writing/drafts/';

  // Validate platform
  const validPlatforms: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];
  if (!validPlatforms.includes(platform)) {
    console.error(chalk.red(`Invalid platform: ${platform}`));
    console.error(`Valid options: ${validPlatforms.join(', ')}`);
    process.exit(1);
  }

  // Validate directory exists
  const fs = await import('fs');
  if (!fs.existsSync(sourceDir)) {
    console.error(chalk.red(`Directory not found: ${sourceDir}`));
    process.exit(1);
  }

  // Load prompt template
  const promptTemplate = loadPrompt('ingest');

  // Find all markdown files
  const files = await listMarkdownFiles(sourceDir);

  if (files.length === 0) {
    console.log(chalk.yellow('No markdown files found in directory.'));
    return;
  }

  console.log(chalk.bold(`\n📥 Ingesting ${files.length} files into ${destinationLabel}\n`));

  // Process files
  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const filename = path.basename(filePath);
    const spinner = ora(`Processing ${filename}`).start();

    try {
      const result = await ingestFile(filePath, platform, promptTemplate, spinner, destinationDir);

      if (result.skipped) {
        spinner.info(`${filename} - skipped (already has metadata)`);
        skipped++;
      } else {
        spinner.succeed(`${filename} → ${path.basename(result.outputPath!)}`);
        // Remove source file after successful processing
        fs.unlinkSync(filePath);
        ingested++;
      }
    } catch (error) {
      spinner.fail(`${filename} - failed`);
      console.error(chalk.dim(`  ${error}`));
      failed++;
    }
  }

  // Show summary
  console.log(chalk.bold('\n📊 Summary'));
  console.log(`  Ingested: ${chalk.green(ingested)}`);
  console.log(`  Skipped:  ${chalk.yellow(skipped)}`);
  console.log(`  Failed:   ${chalk.red(failed)}`);

  if (ingested > 0) {
    if (published) {
      console.log(chalk.cyan(`\nFiles are ready for analysis in ${destinationLabel}`));
    } else {
      console.log(chalk.cyan(`\nNext: Review files in writing/drafts/, then publish to writing/content/${platform}/`));
    }
  }
}
