import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

interface ReviewOptions {
  output?: string;
}

/**
 * Generate output filename for review suggestions
 */
function generateReviewPath(inputPath: string, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  return path.join(dir, `${basename}-review${ext}`);
}

/**
 * Review content and generate suggestions
 */
export async function review(
  inputPath: string | undefined,
  options: ReviewOptions
): Promise<void> {
  if (!inputPath) {
    console.error(chalk.red('Error: File path required'));
    console.log(chalk.dim('\nUsage:'));
    console.log(chalk.cyan('  claude-pen review <file>'));
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`File not found: ${inputPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('\n🔍 Reviewing content\n'));

  // Read content
  const spinner = ora('Reading content').start();
  const content = fs.readFileSync(inputPath, 'utf-8');
  const wordCount = countWords(content);
  spinner.succeed(`Read ${chalk.green(wordCount)} words`);

  // Load and interpolate prompt
  const spinner2 = ora('Analyzing content').start();
  const promptTemplate = loadPrompt('review');
  const prompt = interpolate(promptTemplate, {
    content: content,
  });

  // Generate review via LLM
  let reviewContent: string;
  try {
    reviewContent = await complete(prompt, {
      system: 'You are an insightful editor who provides actionable feedback. Identify weaknesses and suggest specific improvements without rewriting.',
      maxTokens: 4096,
      silent: true,
    });
  } catch (error) {
    spinner2.fail('Failed to generate review');
    throw error;
  }

  spinner2.succeed('Review complete');

  // Generate output path
  const outputPath = generateReviewPath(inputPath, options.output);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write review to separate file
  fs.writeFileSync(outputPath, reviewContent.trim(), 'utf-8');

  // Success feedback
  console.log(chalk.bold('\n✓ Review Generated'));
  console.log(chalk.dim(`  Original: ${path.basename(inputPath)}`));
  console.log(chalk.green(`  Review:   ${outputPath}`));

  // Suggest next steps
  console.log(chalk.bold('\n📝 Next Steps:'));
  console.log(chalk.dim('  Read the suggestions:'));
  console.log(chalk.cyan(`  open ${outputPath}`));
  console.log(chalk.dim('\n  Apply improvements manually, or use refine:'));
  console.log(chalk.cyan(`  claude-pen refine ${inputPath} --pass clarity`));
  console.log(chalk.cyan(`  claude-pen refine ${inputPath} --pass proofread`));
  console.log();
}
