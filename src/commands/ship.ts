import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { getPath, readMarkdown, writeMarkdown } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import type { ContentFormat, ShipOptions } from '../types.js';

type Platform = 'linkedin' | 'twitter';

const PLATFORMS: Platform[] = ['linkedin', 'twitter'];
const STYLE_GUIDE_PATH = 'writing/_style_guide.md';

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
  customInstruction?: string
): Promise<string> {
  const promptTemplate = loadPrompt(`ship/${platform}`);

  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
    custom_instruction: customInstruction || 'Create engaging promotional content that drives clicks.',
  });

  return complete(prompt, {
    system: `You are a marketing expert creating engaging promotional content for ${platform} that drives traffic and creates curiosity.`,
    maxTokens: 1000,
  });
}

/**
 * Ship blog post - create promotional posts for social media
 */
async function shipBlogPost(
  draftPath: string,
  content: string,
  options: ShipOptions
): Promise<void> {
  console.log(chalk.bold('\n📤 Creating promotional posts\n'));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  console.log(chalk.dim(`  Note: Posts will include URL placeholder - replace before publishing\n`));

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Extract custom instruction
  const customInstruction = options.instruct;

  if (customInstruction) {
    console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
    console.log();
  }

  // Create promotional posts for each platform
  const results: { platform: Platform; path: string }[] = [];

  for (const platform of PLATFORMS) {
    const spinner = ora(`Creating ${platform} post...`).start();

    try {
      const promoPost = await createPromoPost(content, platform, styleGuide, customInstruction);
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

/**
 * Ship social content - finalize for specific platform
 */
async function shipSocialContent(
  draftPath: string,
  content: string,
  format: ContentFormat,
  options: ShipOptions
): Promise<void> {
  console.log(chalk.bold(`\n📤 Finalizing ${format} post\n`));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  console.log();

  const spinner = ora(`Preparing final ${format} version...`).start();

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Extract custom instruction
  const customInstruction = options.instruct;

  if (customInstruction) {
    console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
    console.log();
  }

  // Load format-specific finalization prompt
  const promptTemplate = loadPrompt(`ship/${format}-finalize`);
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
    custom_instruction: customInstruction || 'Finalize the content for publication with platform-specific formatting.',
  });

  try {
    const finalContent = await complete(prompt, {
      system: `You are finalizing content for ${format}, ensuring it meets platform best practices.`,
      maxTokens: 2000,
    });

    // Update draft in place
    const { frontmatter } = readMarkdown(draftPath);
    writeMarkdown(draftPath, frontmatter, finalContent.trim());

    spinner.succeed(`${format} post finalized`);

    // Summary
    console.log(chalk.green('\n✓ Post Ready to Publish'));
    console.log(chalk.dim(`  File: ${draftPath}`));
    console.log(chalk.bold('\n📝 Next Steps:'));
    console.log(chalk.dim(`  1. Review the final ${format} post`));
    console.log(chalk.dim(`  2. Copy content to ${format}`));
    console.log(chalk.dim(`  3. Publish and engage`));
  } catch (error) {
    spinner.fail('Finalization failed');
    console.error(chalk.dim(`  ${error}`));
    process.exit(1);
  }
}

/**
 * Ship command - create promotional posts or finalize social content
 */
export async function ship(draftPath: string, options: ShipOptions): Promise<void> {
  // Validate input file
  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  // Read draft and detect format
  const { frontmatter, content } = readMarkdown(draftPath);
  const format = (frontmatter.format as ContentFormat) || 'blog';

  // Branch based on format
  if (format === 'blog') {
    await shipBlogPost(draftPath, content, options);
  } else {
    await shipSocialContent(draftPath, content, format, options);
  }
}
