import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { getPath, ensureDir } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';

interface ShipOptions {
  url?: string;
}

type Platform = 'linkedin' | 'twitter';

const PLATFORMS: Platform[] = ['linkedin', 'twitter'];
const STYLE_GUIDE_PATH = 'corpus/_style_guide.md';

/**
 * Load the style guide from corpus directory
 */
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Posts will be created without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Create promotional content that is clear and engaging.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

/**
 * Generate output path for a platform
 */
function getOutputPath(inputPath: string, platform: Platform): string {
  const dir = path.dirname(inputPath);
  const basename = path.basename(inputPath, path.extname(inputPath));
  return path.join(dir, `${basename}-${platform}.md`);
}

/**
 * Create promotional post for a specific platform
 */
async function createPromoPost(
  content: string,
  platform: Platform,
  styleGuide: string,
  url?: string
): Promise<string> {
  const promptTemplate = loadPrompt(`ship/${platform}`);

  // Simple conditional replacement for {{#if url}}...{{/if}} blocks
  let processedTemplate = promptTemplate;
  if (url) {
    // Remove {{else}} blocks and keep {{#if url}} content
    processedTemplate = processedTemplate
      .replace(/\{\{#if url\}\}([\s\S]*?)\{\{else\}\}[\s\S]*?\{\{\/if\}\}/g, '$1')
      .replace(/\{\{#if url\}\}/g, '')
      .replace(/\{\{\/if\}\}/g, '');
  } else {
    // Remove {{#if url}} blocks and keep {{else}} content
    processedTemplate = processedTemplate
      .replace(/\{\{#if url\}\}[\s\S]*?\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1')
      .replace(/\{\{#if url\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  const prompt = interpolate(processedTemplate, {
    style_guide: styleGuide,
    content: content,
    url: url || '',
  });

  return complete(prompt, {
    system: `You are a marketing expert creating engaging promotional content for ${platform} that drives traffic and creates curiosity.`,
    maxTokens: 1000,
  });
}

/**
 * Ship command - create promotional posts for social media
 */
export async function ship(draftPath: string, options: ShipOptions): Promise<void> {
  // Validate input file
  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('\n📤 Creating promotional posts\n'));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  if (options.url) {
    console.log(chalk.dim(`  Link: ${options.url}`));
  } else {
    console.log(chalk.dim(`  Link: Not provided (will use fallback)`));
  }
  console.log();

  // Read input
  const content = fs.readFileSync(draftPath, 'utf-8');

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Create promotional posts for each platform
  const results: { platform: Platform; path: string }[] = [];

  for (const platform of PLATFORMS) {
    const spinner = ora(`Creating ${platform} post...`).start();

    try {
      const promoPost = await createPromoPost(content, platform, styleGuide, options.url);
      const outputPath = getOutputPath(draftPath, platform);

      fs.writeFileSync(outputPath, promoPost.trim());
      results.push({ platform, path: outputPath });

      spinner.succeed(`${platform} → ${path.basename(outputPath)}`);
    } catch (error) {
      spinner.fail(`${platform} failed`);
      console.error(chalk.dim(`  ${error}`));
    }
  }

  // Summary
  if (results.length > 0) {
    console.log(chalk.green('\n✓ Promotional posts created:'));
    for (const { platform, path: filePath } of results) {
      console.log(chalk.dim(`  ${platform}: ${filePath}`));
    }

    console.log(chalk.bold('\n📝 Next Steps:'));
    console.log(chalk.dim('  1. Review each post'));
    console.log(chalk.dim('  2. Copy to respective platform'));
    console.log(chalk.dim('  3. Post and engage with responses'));
  }
}
