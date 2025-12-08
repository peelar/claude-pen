# Implementation Plan: Ingest Command

## Overview

The `ingest` command will batch import existing markdown writing files, use Claude to extract metadata (title, date, tags, summary), and organize them into the writing/drafts directory for review. This enables users to quickly populate their claude-pen workspace with historical content.

## Implementation Approach

This implementation leverages existing utilities in the codebase (markdown I/O, LLM integration, prompt system) and follows established patterns from the `init` command. The approach is:

1. **Sequential processing with visual feedback** - Process files one at a time with ora spinners for clear progress indication
2. **Smart skip logic** - Avoid re-processing files that already have metadata (frontmatter with `title` field)
3. **Graceful error handling** - Continue processing on individual file failures, report summary at end
4. **LLM-powered metadata extraction** - Use Claude to intelligently infer title, tags, and summary from content
5. **Safe filename generation** - Use date-prefixed slugs to prevent collisions

**Why this approach:**
- Reuses 100% of existing utilities (no new dependencies)
- Follows CLI patterns established by `init` command
- Provides excellent UX with spinners and colored output
- Handles edge cases gracefully (malformed YAML, duplicate titles, missing dates)

## Phase 1: Create Prompt Template

### Changes Required

#### 1. Ingest Prompt Template
**File**: `src/prompts/ingest.md`
**Changes**: Create new prompt template for metadata extraction

```markdown
You are analyzing a piece of writing to extract metadata.

Given the following article, extract:
- title: The title (infer from content if not explicitly stated)
- date: Publication date if mentioned (YYYY-MM-DD format), otherwise null
- tags: 3-5 relevant topic tags as an array
- summary: 1-2 sentence summary

Respond with ONLY valid YAML, no markdown code fences, no explanation:

title: "The extracted or inferred title"
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
summary: "Brief summary of the content"

If no date is found, use:
date: null

Article to analyze:

{{content}}
```

### Success Criteria

#### Automated Verification
- [ ] File exists: `test -f src/prompts/ingest.md`
- [ ] Contains required variables: `grep -q '{{content}}' src/prompts/ingest.md`

#### Manual Verification
- [ ] Prompt clearly specifies YAML-only output
- [ ] All required fields are documented (title, date, tags, summary)
- [ ] Includes example format
- [ ] Has clear delimiter before `{{content}}`

---

## Phase 2: Implement Command Logic

### Changes Required

#### 1. Ingest Command Implementation
**File**: `src/commands/ingest.ts`
**Changes**: Create new command with helper functions and main logic

```typescript
import { readdir } from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import yaml from 'yaml';

import type { Platform, ArticleFrontmatter } from '../types.js';
import {
  listMarkdownFiles,
  readMarkdown,
  writeMarkdown,
  getPath,
  countWords,
  slugify,
} from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

interface IngestOptions {
  platform: Platform;
}

interface ExtractedMetadata {
  title: string;
  date: string | null;
  tags: string[];
  summary: string;
}

/**
 * Parse LLM response as YAML metadata
 * Handles markdown code fences and invalid YAML gracefully
 */
function parseMetadata(response: string): ExtractedMetadata {
  // Clean up response - remove markdown code fences
  const cleaned = response
    .replace(/```ya?ml\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = yaml.parse(cleaned);
    return {
      title: parsed.title || 'Untitled',
      date: parsed.date || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      summary: parsed.summary || '',
    };
  } catch (error) {
    console.error(chalk.yellow('  Warning: Could not parse metadata, using defaults'));
    return {
      title: 'Untitled',
      date: null,
      tags: [],
      summary: '',
    };
  }
}

/**
 * Generate safe filename from metadata
 * Format: YYYY-MM-DD_slug.md
 */
function generateFilename(metadata: ExtractedMetadata): string {
  const date = metadata.date || new Date().toISOString().split('T')[0];
  const slug = slugify(metadata.title);
  return `${date}_${slug}.md`;
}

/**
 * Process a single file: extract metadata and write to corpus
 */
async function ingestFile(
  filePath: string,
  platform: Platform,
  promptTemplate: string
): Promise<{ success: boolean; outputPath?: string; skipped?: boolean }> {
  const { frontmatter, content } = readMarkdown(filePath);

  // Skip if already has title (already ingested)
  if (frontmatter.title) {
    return { success: true, skipped: true };
  }

  // Extract metadata via LLM
  const prompt = interpolate(promptTemplate, { content });
  const response = await complete(prompt, {
    system: 'You are a metadata extraction assistant.',
    maxTokens: 500,
  });

  const metadata = parseMetadata(response);

  // Build frontmatter
  const outputFrontmatter: ArticleFrontmatter = {
    title: metadata.title,
    date: metadata.date || new Date().toISOString().split('T')[0],
    platform,
    word_count: countWords(content),
    tags: metadata.tags,
    summary: metadata.summary,
  };

  // Generate output path
  const filename = generateFilename(metadata);
  const outputPath = getPath('writing', 'drafts', filename);

  // Write to drafts
  writeMarkdown(outputPath, outputFrontmatter, content);

  return { success: true, outputPath };
}

/**
 * Main ingest command
 */
export async function ingest(
  dir: string | undefined,
  options: IngestOptions
): Promise<void> {
  const { platform } = options;

  // Default to writing/import if no directory specified
  const sourceDir = dir || getPath('writing', 'import');

  // Validate platform
  const validPlatforms: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];
  if (!validPlatforms.includes(platform)) {
    console.error(chalk.red(`Invalid platform: ${platform}`));
    console.error(`Valid options: ${validPlatforms.join(', ')}`);
    process.exit(1);
  }

  // Validate directory exists
  const fs = await import('fs');
  if (!fs.existsSync(sourceDir)) {
    console.error(chalk.red(`Directory not found: ${sourceDir}`));
    process.exit(1);
  }

  // Load prompt template
  const promptTemplate = loadPrompt('ingest');

  // Find all markdown files
  const files = await listMarkdownFiles(sourceDir);

  if (files.length === 0) {
    console.log(chalk.yellow('No markdown files found in directory.'));
    return;
  }

  console.log(chalk.bold(`\n📥 Ingesting ${files.length} files into writing/drafts/\n`));

  // Process files
  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const filename = path.basename(filePath);
    const spinner = ora(`Processing ${filename}`).start();

    try {
      const result = await ingestFile(filePath, platform, promptTemplate);

      if (result.skipped) {
        spinner.info(`${filename} - skipped (already has metadata)`);
        skipped++;
      } else {
        spinner.succeed(`${filename} → ${path.basename(result.outputPath!)}`);
        ingested++;
      }
    } catch (error) {
      spinner.fail(`${filename} - failed`);
      console.error(chalk.dim(`  ${error}`));
      failed++;
    }
  }

  // Show summary
  console.log(chalk.bold('\n📊 Summary'));
  console.log(`  Ingested: ${chalk.green(ingested)}`);
  console.log(`  Skipped:  ${chalk.yellow(skipped)}`);
  console.log(`  Failed:   ${chalk.red(failed)}`);

  if (ingested > 0) {
    console.log(chalk.cyan(`\nNext: Review files in writing/drafts/, then publish to writing/content/`));
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] File exports `ingest` function: `grep -q 'export async function ingest' src/commands/ingest.ts`

#### Manual Verification
- [ ] All imports resolve correctly
- [ ] Helper functions have clear JSDoc comments
- [ ] Error handling uses chalk.red for errors
- [ ] Success messages use chalk.green
- [ ] Skipped messages use chalk.yellow

---

## Phase 3: Register Command

### Changes Required

#### 1. CLI Registration
**File**: `src/index.ts`
**Changes**: Import and register ingest command

```typescript
// Add import at top
import { ingest } from './commands/ingest.js';

// Add command registration (after init command)
program
  .command('ingest [directory]')
  .description('Batch import existing writing into drafts (defaults to writing/import/)')
  .requiredOption('--platform <platform>', 'Target platform: blog, linkedin, substack, twitter')
  .action(ingest);
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Build succeeds: `bun run build` (if applicable)

#### Manual Verification
- [ ] Help text shows ingest command: `bun run src/index.ts --help`
- [ ] Command appears in help output with correct description
- [ ] Required option `--platform` is documented

---

## Phase 4: Manual Testing

### Changes Required
No code changes - verification only

### Success Criteria

#### Test Setup
```bash
# Create test directory with sample files
mkdir -p test-ingest
cat > test-ingest/article1.md << 'EOF'
# My First Article

This is a test article about productivity. It talks about time management and getting things done efficiently.

The key is to focus on one thing at a time.
EOF

cat > test-ingest/article2.md << 'EOF'
Some unstructured thoughts about AI and the future of work.

Will machines replace us? Probably not entirely, but they will augment our capabilities.
EOF

cat > test-ingest/already-ingested.md << 'EOF'
---
title: Already Processed
date: 2025-12-01
---
This file already has frontmatter.
EOF
```

#### Manual Verification

**Test 1: Basic Ingest**
- [ ] Run: `bun run src/index.ts ingest ./test-ingest --platform blog`
- [ ] Verify 2 files processed (article1.md, article2.md)
- [ ] Verify 1 file skipped (already-ingested.md)
- [ ] Check `writing/drafts/` directory created
- [ ] Check files have format: `YYYY-MM-DD_slug.md`
- [ ] Open output files and verify frontmatter structure:
  ```yaml
  title: "Extracted Title"
  date: YYYY-MM-DD
  platform: blog
  word_count: [number]
  tags: [tag1, tag2, tag3]
  summary: "Brief summary"
  ```

**Test 2: Error Handling**
- [ ] Run with invalid platform: `bun run src/index.ts ingest ./test-ingest --platform invalid`
- [ ] Verify helpful error message listing valid platforms
- [ ] Run with non-existent directory: `bun run src/index.ts ingest ./fake-dir --platform blog`
- [ ] Verify clear error message about directory not found

**Test 3: Skip Logic**
- [ ] Run ingest again on same directory: `bun run src/index.ts ingest ./test-ingest --platform blog`
- [ ] Verify all 3 files now skipped (they all have frontmatter from first run)
- [ ] Verify summary shows 0 ingested, 3 skipped

**Test 4: Default Directory**
- [ ] Create `writing/import/` directory
- [ ] Copy test files to `writing/import/`
- [ ] Run: `bun run src/index.ts ingest --platform blog` (no directory specified)
- [ ] Verify files processed from `writing/import/`
- [ ] Verify files written to `writing/drafts/`
- [ ] Verify source files removed from `writing/import/`

**Test 5: Different Platforms**
- [ ] Run: `bun run src/index.ts ingest ./test-ingest --platform twitter`
- [ ] Verify files created in `writing/drafts/`
- [ ] Verify frontmatter has `platform: twitter`

**Test 6: Multiple Files**
- [ ] Create directory with 10+ markdown files
- [ ] Run ingest command
- [ ] Verify spinner shows progress for each file
- [ ] Verify summary counts are accurate
- [ ] Verify all files processed (check writing/drafts/ directory)

**Test 7: Malformed Content**
- [ ] Create file with very short content (1-2 words)
- [ ] Create file with no content (empty)
- [ ] Run ingest command
- [ ] Verify files are processed (may have generic titles)
- [ ] Verify command doesn't crash

#### Cleanup
```bash
rm -rf test-ingest writing/drafts writing/import
```

---

## Phase 5: Documentation Update

### Changes Required

#### 1. README Update
**File**: `README.md`
**Changes**: Add ingest command to usage documentation

```markdown
### Ingest Command

Batch import existing markdown files into your drafts for review:

```bash
claude-pen ingest [directory] --platform <platform>
```

**Arguments:**
- `[directory]` - Optional path to directory containing markdown files (defaults to `writing/import/`)
- `--platform` - Target platform: `blog`, `linkedin`, `substack`, or `twitter`

**Features:**
- Automatically extracts title, date, tags, and summary using AI
- Skips files that already have metadata
- Generates safe filenames with date prefixes
- Writes to `writing/drafts/` for review
- Removes processed files from source directory

**Example:**
```bash
# Import from default location (writing/import/)
claude-pen ingest --platform blog

# Import from specific directory
claude-pen ingest ./my-old-blog --platform blog

# Import LinkedIn articles
claude-pen ingest ./linkedin-drafts --platform linkedin
```

**Next Steps:**
After ingesting, review files in `writing/drafts/`, then publish to `writing/content/`.
```

### Success Criteria

#### Manual Verification
- [ ] README includes ingest command section
- [ ] Examples are clear and correct
- [ ] Platform options are documented
- [ ] Links to next steps (analyze command)

---

## Rollback Plan

If issues arise, rollback is straightforward:

1. **Remove command registration**:
   ```bash
   git checkout src/index.ts
   ```

2. **Remove command implementation**:
   ```bash
   rm src/commands/ingest.ts
   ```

3. **Remove prompt template**:
   ```bash
   rm src/prompts/ingest.md
   ```

4. **Clean up any test files**:
   ```bash
   rm -rf test-ingest writing/drafts writing/import
   ```

5. **Verify clean state**:
   ```bash
   bun run typecheck
   git status
   ```

---

## Success Criteria Summary

### Automated Checks
- [ ] TypeScript compiles without errors: `bun run typecheck`
- [ ] Linter passes: `bun run lint` (if configured)
- [ ] Build succeeds: `bun run build` (if applicable)

### Functional Requirements
- [ ] Command appears in help output
- [ ] Validates platform and directory inputs
- [ ] Processes markdown files recursively
- [ ] Skips files with existing metadata
- [ ] Generates safe, collision-resistant filenames
- [ ] Writes correct frontmatter structure
- [ ] Shows progress with spinners
- [ ] Displays accurate summary counts
- [ ] Handles errors gracefully

### User Experience
- [ ] Clear error messages for invalid inputs
- [ ] Visual progress indication for each file
- [ ] Color-coded output (green success, yellow skip, red error)
- [ ] Helpful next-step suggestion after completion

---

## Implementation Notes

### Potential Edge Cases
1. **Very large directories** - Sequential processing may be slow; acceptable for MVP
2. **API rate limits** - Not handling retry logic; will fail fast and report in summary
3. **Duplicate titles** - Date prefix prevents most collisions; same-day duplicates will overwrite
4. **Unicode in titles** - `slugify` should handle this, verify in testing
5. **Empty content** - LLM will generate generic metadata; graceful degradation

### Future Enhancements (Out of Scope)
- Parallel file processing with concurrency limits
- Retry logic for API failures
- Duplicate detection with numbered suffixes
- Dry-run mode to preview changes
- Progress bar for large batches
- Custom prompt template per platform

### Dependencies
All required utilities already exist:
- ✅ `listMarkdownFiles` - src/lib/files.ts:69
- ✅ `readMarkdown` - src/lib/files.ts:17
- ✅ `writeMarkdown` - src/lib/files.ts:47
- ✅ `getPath` - src/lib/files.ts:88
- ✅ `countWords` - src/lib/files.ts:93
- ✅ `slugify` - src/lib/files.ts:102
- ✅ `loadPrompt` - src/lib/prompts.ts:32
- ✅ `interpolate` - src/lib/prompts.ts:58
- ✅ `complete` - src/lib/llm.ts:69
