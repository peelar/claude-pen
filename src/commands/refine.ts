import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { select } from '@inquirer/prompts';
import { getPath, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

interface RefineOptions {
  output?: string;
}

const STYLE_GUIDE_PATH = 'writing/_style_guide.md';

function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Refinement will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

/**
 * Load review feedback if it exists
 */
function loadReviewFeedback(draftPath: string): string | null {
  const dir = path.dirname(draftPath);
  const ext = path.extname(draftPath);
  const basename = path.basename(draftPath, ext);
  const reviewPath = path.join(dir, `${basename}-review${ext}`);

  if (fs.existsSync(reviewPath)) {
    return fs.readFileSync(reviewPath, 'utf-8');
  }

  return null;
}

/**
 * Generate output filename with timestamp
 */
function generateOutputPath(inputPath: string, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  // Generate timestamp: YYYYMMDD-HHMMSS
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');

  return path.join(dir, `${basename}-${timestamp}-refined${ext}`);
}

interface FileChoice {
  name: string;
  value: string;
  description: string;
}

/**
 * Discover markdown files in common draft locations
 */
function discoverDraftFiles(): string[] {
  const searchPaths = [
    process.cwd(), // Current directory
    getPath('writing/drafts'), // Default drafts directory
  ];

  const files: string[] = [];

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    const entries = fs.readdirSync(searchPath);
    for (const entry of entries) {
      const fullPath = path.join(searchPath, entry);
      const stat = fs.statSync(fullPath);

      // Only include markdown files (not directories)
      if (stat.isFile() && entry.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  // Remove duplicates and sort by modification time (newest first)
  const uniqueFiles = [...new Set(files)];
  return uniqueFiles.sort((a, b) => {
    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    return statB.mtime.getTime() - statA.mtime.getTime();
  });
}

/**
 * Format file info for display
 */
function formatFileInfo(filePath: string): FileChoice {
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const wordCount = countWords(content);

  // Format relative time
  const now = Date.now();
  const mtime = stat.mtime.getTime();
  const diffMs = now - mtime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo: string;
  if (diffMins < 60) {
    timeAgo = diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    timeAgo = diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else {
    timeAgo = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  const basename = path.basename(filePath);
  const name = `${basename} (${wordCount.toLocaleString()} words, ${timeAgo})`;
  const description = path.dirname(filePath);

  return {
    name,
    value: filePath,
    description,
  };
}

/**
 * Select a draft file interactively
 */
async function selectDraftFile(): Promise<string> {
  const files = discoverDraftFiles();

  if (files.length === 0) {
    console.error(chalk.red('No markdown files found in current directory or writing/drafts/'));
    console.log(chalk.dim('\nTry:'));
    console.log(chalk.cyan('  claude-pen refine <file-path>'));
    process.exit(1);
  }

  if (files.length === 1) {
    const file = files[0];
    console.log(chalk.dim(`Using: ${chalk.cyan(path.basename(file))}\n`));
    return file;
  }

  // Multiple files - show selection menu
  const choices = files.map(formatFileInfo);

  const selected = await select({
    message: 'Select a draft to refine:',
    choices,
  });

  console.log(); // Add spacing after selection
  return selected;
}

export async function refine(
  draftArg: string | undefined,
  customInstruction: string | undefined,
  options: RefineOptions
): Promise<void> {
  // Resolve file path - either from argument or interactive selection
  let draftPath: string;

  if (draftArg) {
    draftPath = path.resolve(draftArg);
    if (!fs.existsSync(draftPath)) {
      console.error(chalk.red(`File not found: ${draftPath}`));
      process.exit(1);
    }
  } else {
    // No file specified - discover and select interactively
    draftPath = await selectDraftFile();
  }

  console.log(chalk.bold(`\n✨ Refining draft: ${path.basename(draftPath)}`));

  // Load review feedback if it exists
  const reviewFeedback = loadReviewFeedback(draftPath);
  if (reviewFeedback) {
    console.log(chalk.dim('   📋 Review feedback found and will be applied'));
  }

  if (customInstruction) {
    console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
  }

  if (!reviewFeedback && !customInstruction) {
    console.log(chalk.dim('   ℹ️  No review or instruction provided - applying general improvement'));
  }

  console.log();

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Read draft content
  const content = fs.readFileSync(draftPath, 'utf-8');
  const originalWords = countWords(content);

  // Load and interpolate prompt
  const promptTemplate = loadPrompt('refine');
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
    review_feedback: reviewFeedback || 'No review feedback available.',
    custom_instruction: customInstruction || 'Apply general improvements to enhance clarity, flow, and impact.',
  });

  // Apply refinement
  const spinner = ora('Refining content...').start();

  try {
    const systemMessage = 'You are a skilled editor helping improve writing while preserving the author\'s unique voice. Apply the refinements carefully based on the provided feedback and instructions.';

    const refined = await complete(prompt, {
      system: systemMessage,
      maxTokens: 8000,
      silent: true,
    });

    spinner.succeed('Refinement complete');

    // Generate output path with timestamp
    const outputPath = generateOutputPath(draftPath, options.output);

    // Write refined content to new file
    fs.writeFileSync(outputPath, refined, 'utf-8');

    // Calculate statistics
    const newWords = countWords(refined);
    const diff = newWords - originalWords;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

    // Display success
    console.log(chalk.green(`\n✓ Refined draft created: ${outputPath}`));
    console.log(chalk.dim(`  Original: ${originalWords} words`));
    console.log(chalk.dim(`  Refined:  ${newWords} words (${diffStr})`));

    // Suggest next steps
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.cyan(`  open ${outputPath}`));
    console.log(chalk.dim('\nApply another round of refinement:'));
    console.log(chalk.cyan(`  claude-pen refine ${outputPath} "your custom instruction"`));
    console.log();

  } catch (error) {
    spinner.fail('Refinement failed');
    throw error;
  }
}
