#!/usr/bin/env bun
import { Command } from 'commander';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

// Commands will be added here in subsequent phases

program.parse();
