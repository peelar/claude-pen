import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { getPath } from '../lib/files.js';

const DRAFTS_DIR = 'writing/drafts';

/**
 * Clean up all draft files
 */
export async function clean(): Promise<void> {
  const draftsPath = getPath(DRAFTS_DIR);

  // Check if drafts directory exists
  if (!fs.existsSync(draftsPath)) {
    console.log(chalk.yellow('\n⚠ No drafts directory found.'));
    console.log(chalk.dim(`  Expected: ${draftsPath}\n`));
    return;
  }

  // Get all files in drafts directory
  const files = fs.readdirSync(draftsPath).filter(file => {
    const fullPath = path.join(draftsPath, file);
    return fs.statSync(fullPath).isFile();
  });

  // Check if directory is empty
  if (files.length === 0) {
    console.log(chalk.green('\n✓ Drafts directory is already empty.\n'));
    return;
  }

  // Show what will be deleted
  console.log(chalk.bold('\n🗑️  Clean Drafts\n'));
  console.log(chalk.dim(`Found ${chalk.white(files.length)} file(s) in ${DRAFTS_DIR}/:\n`));

  // List files (up to 10, then show "and X more...")
  const displayLimit = 10;
  const filesToShow = files.slice(0, displayLimit);

  for (const file of filesToShow) {
    console.log(chalk.dim(`  - ${file}`));
  }

  if (files.length > displayLimit) {
    console.log(chalk.dim(`  ... and ${files.length - displayLimit} more`));
  }

  console.log();

  // Ask for confirmation
  const confirmed = await confirm({
    message: chalk.red('Are you sure you want to delete all drafts?'),
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.dim('\nCancelled. No files were deleted.\n'));
    return;
  }

  // Delete all files
  let deletedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const filePath = path.join(draftsPath, file);
    try {
      fs.unlinkSync(filePath);
      deletedCount++;
    } catch (error) {
      console.error(chalk.red(`Failed to delete ${file}:`), error);
      failedCount++;
    }
  }

  // Report results
  console.log(chalk.green(`\n✓ Deleted ${deletedCount} file(s)`));

  if (failedCount > 0) {
    console.log(chalk.yellow(`⚠ Failed to delete ${failedCount} file(s)`));
  }

  console.log();
}
