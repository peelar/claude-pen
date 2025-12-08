#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(init);

program.parse();
