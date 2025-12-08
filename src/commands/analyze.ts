import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { listMarkdownFiles, readMarkdown, getPath, writeMarkdown } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import type { Platform } from '../types.js';

const PLATFORMS: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];
const STYLE_GUIDE_PATH = 'writing/_style_guide.md';
const MAX_SAMPLE_TOKENS = 100000;
const CHARS_PER_TOKEN = 4;
const MAX_SAMPLE_CHARS = MAX_SAMPLE_TOKENS * CHARS_PER_TOKEN; // 400k chars

interface Sample {
  platform: Platform;
  title: string;
  content: string;
  wordCount: number;
  charCount: number;
}

async function collectSamples(): Promise<Sample[]> {
  const samples: Sample[] = [];

  for (const platform of PLATFORMS) {
    const platformDir = getPath('writing', 'content', platform);

    if (!fs.existsSync(platformDir)) {
      continue;
    }

    const files = await listMarkdownFiles(platformDir);

    for (const filePath of files) {
      const { frontmatter, content } = readMarkdown(filePath);

      samples.push({
        platform,
        title: (frontmatter.title as string) || 'Untitled',
        content,
        wordCount: (frontmatter.word_count as number) || 0,
        charCount: content.length,
      });
    }
  }

  return samples;
}

interface SelectionStats {
  selected: Sample[];
  byPlatform: Map<Platform, { total: number; included: number; chars: number }>;
  totalSamples: number;
  totalSelected: number;
  totalChars: number;
}

function selectRepresentativeSamples(samples: Sample[]): SelectionStats {
  // Group by platform
  const byPlatform = new Map<Platform, Sample[]>();

  for (const sample of samples) {
    if (!byPlatform.has(sample.platform)) {
      byPlatform.set(sample.platform, []);
    }
    byPlatform.get(sample.platform)!.push(sample);
  }

  // Allocate budget equally across platforms
  const platformCount = byPlatform.size;
  const budgetPerPlatform = Math.floor(MAX_SAMPLE_CHARS / platformCount);

  const selected: Sample[] = [];
  const platformStats = new Map<Platform, { total: number; included: number; chars: number }>();
  let totalChars = 0;

  for (const [platform, platformSamples] of byPlatform.entries()) {
    let platformChars = 0;

    for (const sample of platformSamples) {
      if (platformChars + sample.charCount <= budgetPerPlatform) {
        selected.push(sample);
        platformChars += sample.charCount;
        totalChars += sample.charCount;
      } else {
        // Truncate last sample if needed
        const remaining = budgetPerPlatform - platformChars;
        if (remaining > 1000) { // Only include if we have at least 1k chars available
          const truncated = {
            ...sample,
            content: sample.content.slice(0, remaining),
            charCount: remaining,
          };
          selected.push(truncated);
          totalChars += remaining;
          platformChars += remaining;
        }
        break;
      }
    }

    platformStats.set(platform, {
      total: platformSamples.length,
      included: selected.filter(s => s.platform === platform).length,
      chars: platformChars,
    });
  }

  return {
    selected,
    byPlatform: platformStats,
    totalSamples: samples.length,
    totalSelected: selected.length,
    totalChars,
  };
}

function formatSamples(samples: Sample[]): string {
  return samples
    .map(
      (sample, index) =>
        `## Sample ${index + 1}: ${sample.title} (${sample.platform})\n\n${sample.content}`
    )
    .join('\n\n---\n\n');
}

export async function analyze(): Promise<void> {
  const spinner = ora('Collecting writing samples').start();

  try {
    const allSamples = await collectSamples();

    if (allSamples.length === 0) {
      spinner.fail('No writing samples found');
      console.log(chalk.yellow('\nPublish some writing first:'));
      console.log(chalk.cyan('  1. Ingest: claude-pen ingest --platform blog'));
      console.log(chalk.cyan('  2. Review: Check writing/drafts/'));
      console.log(chalk.cyan('  3. Publish: Move files to writing/content/blog/'));
      return;
    }

    spinner.text = `Found ${allSamples.length} samples, selecting representative set`;

    const stats = selectRepresentativeSamples(allSamples);

    // Stop spinner to print stats cleanly
    spinner.stop();

    // Print platform-by-platform breakdown
    for (const [platform, platformStats] of stats.byPlatform.entries()) {
      console.log(
        chalk.dim(
          `  ${platform}: ${platformStats.total} samples, ${platformStats.included} included (~${Math.round(platformStats.chars / 1000)}k chars)`
        )
      );
    }
    console.log(
      chalk.dim(
        `  Total: ${stats.totalSamples} samples, ${stats.totalSelected} included (~${Math.round(stats.totalChars / 1000)}k chars)`
      )
    );

    // Restart spinner for next phase
    spinner.start(`Formatting ${stats.totalSelected} samples for analysis`);

    // Format samples for analysis
    const formattedSamples = formatSamples(stats.selected);
    const platforms = Array.from(new Set(stats.selected.map(s => s.platform))).join(', ');

    // Load and interpolate prompt
    const promptTemplate = loadPrompt('analyze');
    const prompt = interpolate(promptTemplate, {
      samples: formattedSamples,
      platforms,
    });

    spinner.text = 'Analyzing writing style';

    // Call LLM
    const styleGuide = await complete(prompt, {
      system: 'You are an expert writing style analyst.',
      maxTokens: 4096,
      silent: true,
    });

    spinner.text = `Saving style guide to ${STYLE_GUIDE_PATH}`;

    const outputPath = getPath(STYLE_GUIDE_PATH);
    const frontmatter = {
      generated: new Date().toISOString(),
      sample_count: stats.selected.length,
      platforms: Array.from(new Set(stats.selected.map(s => s.platform))),
    };

    writeMarkdown(outputPath, frontmatter, styleGuide);

    spinner.succeed(`Style guide saved to ${STYLE_GUIDE_PATH}`);

    // Summary
    console.log(chalk.bold('\n✓ Style Guide Generated'));
    console.log(`  Analyzed: ${chalk.green(`${stats.selected.length} samples`)}`);
    console.log(`  Platforms: ${chalk.cyan(platforms)}`);
    console.log(`  Output: ${chalk.blue(STYLE_GUIDE_PATH)}`);
    console.log(chalk.dim('\nUse this guide to inform your writing refinements.'));
  } catch (error) {
    spinner.fail('Failed to collect samples');
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
