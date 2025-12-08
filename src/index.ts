#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';
import { ingest } from './commands/ingest.js';
import { analyze } from './commands/analyze.js';
import { draft } from './commands/draft.js';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

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
  .action(async (file, options) => {
    try {
      await draft(file, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program.parse();
