#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';
import { ingest } from './commands/ingest.js';
import { analyze } from './commands/analyze.js';
import { draft } from './commands/draft.js';
import { review } from './commands/review.js';
import { refine } from './commands/refine.js';
import { ship } from './commands/ship.js';
import { clean } from './commands/clean.js';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0')
  .configureHelp({
    helpWidth: Math.min(process.stdout.columns || 80, 100),
    sortSubcommands: false,
    sortOptions: false,
  });

program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(async () => {
    try {
      await init();
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('ingest [directory]')
  .description('Batch import existing writing (defaults to writing/import/)')
  .requiredOption('--platform <platform>', 'Target platform: blog, linkedin, substack, twitter')
  .option('--published', 'Import directly to content/ for published writing (skips drafts)')
  .action(async (dir, options) => {
    try {
      await ingest(dir, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze your writing samples to generate a style guide')
  .action(async () => {
    try {
      await analyze();
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('draft [file]')
  .description('Transform raw notes into a structured draft')
  .option('--stdin', 'Read input from stdin instead of a file')
  .option('-o, --output <path>', 'Output file path (default: writing/drafts/<basename>.md or draft-<date>.md)')
  .option('-f, --format <format>', 'Target format: blog, linkedin, twitter, substack (default: blog)')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
  .action(async (file, options) => {
    try {
      // Validate format if provided
      if (options.format) {
        const validFormats = ['blog', 'linkedin', 'twitter', 'substack'];
        if (!validFormats.includes(options.format)) {
          console.error(`Invalid format: ${options.format}`);
          console.error(`Valid formats: ${validFormats.join(', ')}`);
          process.exit(1);
        }
      }
      await draft(file, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('review <file>')
  .description('Analyze content and generate improvement suggestions')
  .option('-o, --output <path>', 'Output file path for suggestions (default: <basename>-review.md)')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
  .action(async (file, options) => {
    try {
      await review(file, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('refine [draft] [instruction]')
  .description('Refine draft based on review feedback and/or custom instructions')
  .option('-o, --output <path>', 'Output file path (default: <basename>-<timestamp>-refined.md)')
  .option('-i, --instruct <instruction>', 'Custom instructions (alternative to positional arg)')
  .action(async (draft, instruction, options) => {
    try {
      // Merge positional and named option (positional takes precedence for backward compat)
      const finalInstruction = instruction || options.instruct;
      await refine(draft, finalInstruction, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('ship <draft>')
  .description('Finalize draft for publishing or create promotional posts')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
  .action(async (draft, options) => {
    try {
      await ship(draft, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Delete all draft files in writing/drafts/')
  .action(async () => {
    try {
      await clean();
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program.parse();
