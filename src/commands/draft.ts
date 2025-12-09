import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getPath, readMarkdown, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

const STYLE_GUIDE_PATH = 'writing/_style_guide.md';

interface DraftOptions {
  output?: string;
  stdin?: boolean;
}

/**
 * Load style guide with graceful fallback
 */
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Draft will be created without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Use a clear, professional tone appropriate for the content.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

/**
 * Determine output path for draft
 */
function getOutputPath(inputPath: string | undefined, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  if (inputPath) {
    const basename = path.basename(inputPath, path.extname(inputPath));
    return getPath('writing', 'drafts', `${basename}.md`);
  }

  // Generate timestamp-based filename for stdin
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return getPath('writing', 'drafts', `draft-${timestamp}.md`);
}

/**
 * Read content from stdin
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Transform raw notes into a structured draft
 */
export async function draft(
  notesPath: string | undefined,
  options: DraftOptions
): Promise<void> {
  console.log(chalk.bold('\n✏️  Creating draft\n'));

  // Determine input source
  let notesContent: string;
  let sourceName: string;

  if (options.stdin) {
    // Read from stdin
    console.log(chalk.dim('Paste your text (press Ctrl+D when done):\n'));
    notesContent = await readStdin();
    sourceName = 'stdin';
  } else {
    // Read from file
    if (!notesPath) {
      console.error(chalk.red('Error: File path required when not using --stdin'));
      process.exit(1);
    }

    if (!fs.existsSync(notesPath)) {
      console.error(chalk.red(`File not found: ${notesPath}`));
      process.exit(1);
    }

    const spinner = ora('Reading notes').start();
    try {
      // Check if file has frontmatter
      const { content } = readMarkdown(notesPath);
      notesContent = content;
    } catch {
      // Fallback to plain text read if not valid markdown with frontmatter
      notesContent = fs.readFileSync(notesPath, 'utf-8');
    }
    sourceName = path.basename(notesPath);
    const wordCount = countWords(notesContent);
    spinner.succeed(`Read ${chalk.green(wordCount)} words from notes`);
  }

  // Show word count for stdin
  if (options.stdin) {
    const wordCount = countWords(notesContent);
    console.log(chalk.green(`\n✓ Read ${wordCount} words from stdin\n`));
  }

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Load and interpolate prompt
  const spinner2 = ora('Generating draft').start();
  const promptTemplate = loadPrompt('draft');
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    notes: notesContent,
  });

  // Generate draft via LLM
  let draftContent: string;
  try {
    draftContent = await complete(prompt, {
      system: 'You are a skilled ghostwriter helping an author structure their thoughts while preserving their unique voice.',
      maxTokens: 8000,
      silent: true,
    });
  } catch (error) {
    spinner2.fail('Failed to generate draft');
    throw error;
  }

  spinner2.succeed('Draft generated');

  // Determine output path
  const outputPath = getOutputPath(notesPath, options.output);

  // Ensure drafts directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write draft to file
  fs.writeFileSync(outputPath, draftContent.trim(), 'utf-8');

  const sourceWordCount = countWords(notesContent);
  const draftWordCount = countWords(draftContent);

  // Success feedback
  console.log(chalk.bold('\n✓ Draft Created'));
  console.log(chalk.dim(`  Source: ${sourceName} (${sourceWordCount} words)`));
  console.log(chalk.green(`  Draft:  ${outputPath} (${draftWordCount} words)`));

  // Suggest next steps
  console.log(chalk.bold('\n📝 Next Steps:'));
  console.log(chalk.dim('  Review and edit:'));
  console.log(chalk.cyan(`  open ${outputPath}`));
  console.log(chalk.dim('\n  Get AI feedback:'));
  console.log(chalk.cyan(`  claude-pen review ${outputPath}`));
  console.log();
}
