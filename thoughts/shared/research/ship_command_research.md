# Research: Ship Command Implementation

**Date**: 2025-12-09
**Purpose**: Understand codebase patterns for implementing the "ship" command (renamed from "format") that transforms drafts into platform-specific versions for publishing.

## Overview

The ship command will format a draft for multiple platforms (LinkedIn, Twitter, Substack, Blog) with platform-specific optimizations. The infrastructure for this feature is already in place, and there's an existing detailed implementation plan at `thoughts/shared/plans/08-format_command_implementation.md`.

**Key Finding**: The command was originally planned as "format" but should be renamed to "ship" since it will eventually handle both formatting AND publishing to platforms.

## Key Files & Locations

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/index.ts` | CLI entry point - register commands here | 92-105 |
| `src/commands/draft.ts` | Best pattern for file processing + style guide | 65-165 |
| `src/commands/refine.ts` | Best pattern for multi-option processing & batch operations | 177-244 |
| `src/lib/llm.ts` | LLM integration with spinner UI | 6-10 |
| `src/lib/prompts.ts` | Prompt loading and interpolation | 32-68 |
| `src/lib/files.ts` | File I/O utilities (getPath, ensureDir, etc.) | 88-90 |
| `src/types.ts` | Type definitions - Platform type already exists | 1-30 |
| `src/prompts/format/` | Directory for platform-specific prompts (empty) | N/A |

## Architecture & Data Flow

### 1. Command Structure

Commands follow this pattern:
```typescript
export async function commandName(
  param?: string,           // Optional for interactive discovery
  options: CommandOptions   // Strongly typed options interface
): Promise<void>
```

**For ship command:**
```typescript
interface ShipOptions {
  for?: Platform;  // Optional: specific platform (default: all)
}
```

### 2. CLI Registration Pattern

**Location**: `src/index.ts`
```typescript
program
  .command('ship <draft>')
  .description('Format and prepare draft for publishing (all platforms by default)')
  .option('--for <platform>', 'Specific platform: linkedin, twitter, substack, blog')
  .action(async (draft, options) => {
    try {
      await ship(draft, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

### 3. LLM Workflow

**Standard pattern from draft.ts (lines 116-136):**
```typescript
// Step 1: Load prompt template
const promptTemplate = loadPrompt('format/linkedin');

// Step 2: Interpolate variables
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  content: draftContent,
});

// Step 3: Call LLM
const formatted = await complete(prompt, {
  system: 'You are an expert content formatter...',
  maxTokens: 4000,
  silent: true,
});
```

### 4. File Path Handling

**Core utilities:**
- `getPath(...segments)` - Get project-relative path
- `ensureDir(dirPath)` - Create directory recursively
- Output pattern: `draft-name-platform.md`

**Example:**
```typescript
// Input: drafts/my-post.md
// Output for LinkedIn: drafts/my-post-linkedin.md
// Output for Twitter: drafts/my-post-twitter.md
```

### 5. Multi-Platform Processing

**Pattern from refine.ts:**
```typescript
const platforms = options.for ? [options.for] : ALL_PLATFORMS;

for (const platform of platforms) {
  const spinner = ora(`Formatting for ${platform}...`).start();

  try {
    const formatted = await formatForPlatform(content, platform, styleGuide);
    const outputPath = getOutputPath(draftPath, platform);
    fs.writeFileSync(outputPath, formatted);
    results.push({ platform, path: outputPath });
    spinner.succeed(`${platform} → ${path.basename(outputPath)}`);
  } catch (error) {
    spinner.fail(`${platform} failed`);
    console.error(chalk.dim(`  ${error}`));
  }
}
```

## Patterns to Follow

### 1. Error Handling

**Validate platform option:**
```typescript
const ALL_PLATFORMS: Platform[] = ['linkedin', 'twitter', 'substack', 'blog'];

if (targetPlatform && !ALL_PLATFORMS.includes(targetPlatform)) {
  console.error(chalk.red(`Invalid platform: ${targetPlatform}`));
  console.error(`Valid options: ${ALL_PLATFORMS.join(', ')}`);
  process.exit(1);
}
```

**Validate file existence:**
```typescript
if (!fs.existsSync(draftPath)) {
  console.error(chalk.red(`File not found: ${draftPath}`));
  process.exit(1);
}
```

**Graceful style guide fallback (from draft.ts:19-29):**
```typescript
function loadStyleGuide(): string {
  const stylePath = getPath('corpus/_style_guide.md');

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Formatting will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}
```

### 2. User Feedback

**Progress indicators:**
```typescript
console.log(chalk.bold('\n📤 Formatting for publishing\n'));
console.log(chalk.dim(`  Source: ${draftPath}`));
console.log(chalk.dim(`  Platforms: ${platforms.join(', ')}\n`));
```

**Spinners for each platform:**
```typescript
const spinner = ora(`Formatting for ${platform}...`).start();
// ... processing ...
spinner.succeed(`${platform} → ${path.basename(outputPath)}`);
```

**Summary at end:**
```typescript
console.log(chalk.green('\n✓ Formatted files created:'));
for (const { platform, path: filePath } of results) {
  console.log(chalk.dim(`  ${platform}: ${filePath}`));
}
console.log(chalk.dim('\nReview each file and copy to the respective platform.'));
```

### 3. Output Path Generation

**Remove existing platform suffix (from plan):**
```typescript
function getOutputPath(inputPath: string, platform: Platform): string {
  const basename = path.basename(inputPath, path.extname(inputPath));
  // Remove any existing platform suffix to avoid double-suffixing
  const cleanName = basename.replace(/-(linkedin|twitter|substack|blog)$/, '');
  return getPath('drafts', `${cleanName}-${platform}.md`);
}
```

**Examples:**
- Input: `drafts/my-post.md` → Output: `drafts/my-post-linkedin.md`
- Input: `drafts/my-post-linkedin.md` (re-run) → Output: `drafts/my-post-twitter.md` (not `my-post-linkedin-twitter.md`)

### 4. Prompt Template Variables

**Common variables for format prompts:**
- `{{style_guide}}` - Author's writing style guide
- `{{content}}` - Draft content to format

**Platform-specific prompts location:**
- `src/prompts/format/linkedin.md`
- `src/prompts/format/twitter.md`
- `src/prompts/format/substack.md`
- `src/prompts/format/blog.md`

**Loading pattern:**
```typescript
const promptTemplate = loadPrompt(`format/${platform}`);
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  content: content,
});
```

## Code Examples

### Complete ship command implementation skeleton

**File**: `src/commands/ship.ts`
```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { getPath, ensureDir } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import type { Platform } from '../types.js';

interface ShipOptions {
  for?: Platform;
}

const ALL_PLATFORMS: Platform[] = ['linkedin', 'twitter', 'substack', 'blog'];
const STYLE_GUIDE_PATH = 'corpus/_style_guide.md';

function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Formatting will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

function getOutputPath(inputPath: string, platform: Platform): string {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const cleanName = basename.replace(/-(linkedin|twitter|substack|blog)$/, '');
  return getPath('drafts', `${cleanName}-${platform}.md`);
}

async function formatForPlatform(
  content: string,
  platform: Platform,
  styleGuide: string
): Promise<string> {
  const promptTemplate = loadPrompt(`format/${platform}`);
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
  });

  return complete(prompt, {
    system: 'You are an expert content formatter who adapts writing for different platforms while preserving the author\'s voice.',
    maxTokens: 4000,
  });
}

export async function ship(draftPath: string, options: ShipOptions): Promise<void> {
  const targetPlatform = options.for;

  // Validate platform if specified
  if (targetPlatform && !ALL_PLATFORMS.includes(targetPlatform)) {
    console.error(chalk.red(`Invalid platform: ${targetPlatform}`));
    console.error(`Valid options: ${ALL_PLATFORMS.join(', ')}`);
    process.exit(1);
  }

  // Validate input file
  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  const platforms = targetPlatform ? [targetPlatform] : ALL_PLATFORMS;

  console.log(chalk.bold('\n📤 Preparing for publishing\n'));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  console.log(chalk.dim(`  Platforms: ${platforms.join(', ')}\n`));

  // Read input
  const content = fs.readFileSync(draftPath, 'utf-8');

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Ensure drafts directory exists
  ensureDir(getPath('drafts'));

  // Format for each platform
  const results: { platform: Platform; path: string }[] = [];

  for (const platform of platforms) {
    const spinner = ora(`Formatting for ${platform}...`).start();

    try {
      const formatted = await formatForPlatform(content, platform, styleGuide);
      const outputPath = getOutputPath(draftPath, platform);

      fs.writeFileSync(outputPath, formatted);
      results.push({ platform, path: outputPath });

      spinner.succeed(`${platform} → ${path.basename(outputPath)}`);
    } catch (error) {
      spinner.fail(`${platform} failed`);
      console.error(chalk.dim(`  ${error}`));
    }
  }

  // Summary
  if (results.length > 0) {
    console.log(chalk.green('\n✓ Formatted files created:'));
    for (const { platform, path: filePath } of results) {
      console.log(chalk.dim(`  ${platform}: ${filePath}`));
    }

    console.log(chalk.dim('\nReview each file and copy to the respective platform.'));
  }
}
```

### Prompt template example (LinkedIn)

**File**: `src/prompts/format/linkedin.md`
```markdown
You are formatting content for LinkedIn.

## Author's Style Guide

{{style_guide}}

## LinkedIn Best Practices

- Hook in the first line (it's all people see before "see more")
- Short paragraphs (1-2 sentences max)
- Line breaks between paragraphs for mobile readability
- No markdown formatting (LinkedIn doesn't render it)
- Optimal length: 1,200-1,500 characters for engagement
- Use emojis sparingly and only if consistent with author's style
- End with engagement prompt or clear takeaway
- No hashtags cluttering the post (maybe 1-2 at the very end if relevant)

## Task

Reformat the following draft for LinkedIn. Adapt length and structure while preserving the core message and the author's voice.

Output only the LinkedIn post. No preamble, no explanation.

## Draft

{{content}}
```

## Recommendations

### Implementation Order

1. **Phase 1**: Create platform-specific prompts
   - `src/prompts/format/linkedin.md`
   - `src/prompts/format/twitter.md`
   - `src/prompts/format/substack.md`
   - `src/prompts/format/blog.md`

2. **Phase 2**: Implement `src/commands/ship.ts`
   - Follow the skeleton above
   - Use existing patterns from draft.ts and refine.ts
   - Handle errors gracefully
   - Show progress with spinners

3. **Phase 3**: Register command in `src/index.ts`
   - Add import for ship command
   - Register with Commander
   - Include --for option for platform selection

4. **Phase 4**: Test with sample drafts
   - Test all platforms at once
   - Test single platform with --for
   - Test error cases (missing file, invalid platform)
   - Verify character limits (Twitter: 280 chars per tweet)

### Naming Rationale

**"ship" vs "format":**
- "ship" better reflects future intent (formatting + publishing)
- Aligns with developer terminology ("ship it")
- Shorter, punchier command name
- Room to grow into actual publishing functionality

### Style Guide Integration

The command should:
- Load style guide from `corpus/_style_guide.md`
- Provide graceful fallback if missing
- Suggest running `claude-pen analyze` if no style guide exists
- Pass style guide to all platform formatters

### Platform-Specific Constraints

**LinkedIn:**
- No markdown rendering
- 1,200-1,500 char sweet spot
- Strong hook in first line
- Short paragraphs with line breaks

**Twitter:**
- 280 character limit per tweet
- Numbered tweets (1/, 2/, etc.)
- 5-15 tweet ideal thread length
- First tweet must hook

**Substack:**
- Full markdown support
- Needs headline, subtitle, preview (frontmatter)
- Depth encouraged
- Section headers for scannability

**Blog:**
- SEO-optimized title and meta description (frontmatter)
- Clean markdown
- H2/H3 subheadings
- Code blocks with language hints

## Related Files

**Existing implementation plan:**
- `thoughts/shared/plans/08-format_command_implementation.md` - Complete phased plan

**Dependencies:**
- `@anthropic-ai/sdk` - LLM API
- `chalk` - Terminal styling
- `ora` - Spinners
- `commander` - CLI framework

**Similar commands to reference:**
- `src/commands/draft.ts` - File processing + style guide pattern
- `src/commands/refine.ts` - Multi-option batch processing pattern
- `src/commands/review.ts` - Simple file-in, file-out pattern
