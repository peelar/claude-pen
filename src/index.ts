#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';
import { ingest } from './commands/ingest.js';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(init);

program
  .command('ingest [directory]')
  .description('Batch import existing writing into drafts (defaults to writing/import/)')
  .requiredOption('--platform <platform>', 'Target platform: blog, linkedin, substack, twitter')
  .action(ingest);

program.parse();
