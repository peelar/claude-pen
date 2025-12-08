# Implementation Plan: Analyze Command

## Overview

We're building a new `analyze` command that examines your published writing samples to generate a comprehensive style guide. This guide will capture voice, tone, structure patterns, and word choice preferences to inform future writing refinement.

## Implementation Approach

Based on the codebase research, we'll follow established patterns from the `ingest` command:

1. **Use existing directory structure**: `writing/content/{platform}/` (NOT `corpus/`)
2. **Reuse utilities**: `listMarkdownFiles()`, `readMarkdown()`, `getPath()`, `complete()`
3. **Follow CLI patterns**: Spinners with `ora`, colored output with `chalk`, structured summaries
4. **Manage token budget**: ~100k token input budget (~400k chars) with equal distribution across platforms
5. **Store output**: `writing/_style_guide.md` (keeping it with the writing samples)

## Phase 1: Create Prompt Template

### Changes Required

#### 1. Create Analysis Prompt
**File**: `src/prompts/analyze.md`
**Changes**: Create new prompt template for style analysis

```markdown
You are a writing style analyst. Analyze the following writing samples and create a comprehensive style guide.

## Writing Samples

{{samples}}

## Task

Generate a detailed style guide that captures:

1. **Voice & Tone**
   - Overall personality and attitude
   - Formality level
   - Emotional range

2. **Structural Patterns**
   - Common opening/closing techniques
   - Paragraph length and rhythm
   - Use of lists, examples, quotes

3. **Language & Word Choice**
   - Vocabulary sophistication
   - Technical vs. accessible language
   - Metaphors and analogies
   - Sentence complexity

4. **Platform-Specific Observations**
   - Differences across platforms ({{platforms}})
   - Adaptation strategies

5. **Distinctive Traits**
   - Unique phrases or expressions
   - Recurring themes
   - Signature moves

Format the guide as markdown with clear sections and specific examples from the samples.
```

### Success Criteria

#### Automated Verification
- [x] File exists at correct location: `ls src/prompts/analyze.md`
- [x] Prompt contains required placeholders: `grep "{{samples}}" src/prompts/analyze.md`
- [x] Prompt contains platform placeholder: `grep "{{platforms}}" src/prompts/analyze.md`

#### Manual Verification
- [x] Prompt addresses all key style aspects (voice, structure, language, platform differences)
- [x] Instructions are clear and specific
- [x] Output format is well-defined

---

## Phase 2: Implement Sample Collection

### Changes Required

#### 1. Create Analyze Command File
**File**: `src/commands/analyze.ts`
**Changes**: Create new command with sample collection logic

```typescript
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { listMarkdownFiles, readMarkdown, getPath, writeMarkdown } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import type { Platform } from '../types.js';

const PLATFORMS: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];
const STYLE_GUIDE_PATH = 'writing/_style_guide.md';
const MAX_SAMPLE_TOKENS = 100000;
const CHARS_PER_TOKEN = 4;
const MAX_SAMPLE_CHARS = MAX_SAMPLE_TOKENS * CHARS_PER_TOKEN; // 400k chars

interface Sample {
  platform: Platform;
  title: string;
  content: string;
  wordCount: number;
  charCount: number;
}

async function collectSamples(): Promise<Sample[]> {
  const samples: Sample[] = [];

  for (const platform of PLATFORMS) {
    const platformDir = getPath('writing', 'content', platform);

    if (!fs.existsSync(platformDir)) {
      continue;
    }

    const files = await listMarkdownFiles(platformDir);

    for (const filePath of files) {
      const { frontmatter, content } = readMarkdown(filePath);

      samples.push({
        platform,
        title: frontmatter.title || 'Untitled',
        content,
        wordCount: frontmatter.word_count || 0,
        charCount: content.length,
      });
    }
  }

  return samples;
}

function selectRepresentativeSamples(samples: Sample[]): Sample[] {
  // Group by platform
  const byPlatform = new Map<Platform, Sample[]>();

  for (const sample of samples) {
    if (!byPlatform.has(sample.platform)) {
      byPlatform.set(sample.platform, []);
    }
    byPlatform.get(sample.platform)!.push(sample);
  }

  // Allocate budget equally across platforms
  const platformCount = byPlatform.size;
  const budgetPerPlatform = Math.floor(MAX_SAMPLE_CHARS / platformCount);

  const selected: Sample[] = [];
  let totalChars = 0;

  for (const [platform, platformSamples] of byPlatform.entries()) {
    let platformChars = 0;

    for (const sample of platformSamples) {
      if (platformChars + sample.charCount <= budgetPerPlatform) {
        selected.push(sample);
        platformChars += sample.charCount;
        totalChars += sample.charCount;
      } else {
        // Truncate last sample if needed
        const remaining = budgetPerPlatform - platformChars;
        if (remaining > 1000) { // Only include if we have at least 1k chars available
          const truncated = {
            ...sample,
            content: sample.content.slice(0, remaining),
            charCount: remaining,
          };
          selected.push(truncated);
          totalChars += remaining;
        }
        break;
      }
    }

    console.log(
      chalk.dim(
        `  ${platform}: ${platformSamples.length} samples, ${selected.filter(s => s.platform === platform).length} included (~${Math.round(platformChars / 1000)}k chars)`
      )
    );
  }

  console.log(
    chalk.dim(
      `  Total: ${samples.length} samples, ${selected.length} included (~${Math.round(totalChars / 1000)}k chars)`
    )
  );

  return selected;
}

export async function analyze(): Promise<void> {
  const spinner = ora('Collecting writing samples').start();

  try {
    const allSamples = await collectSamples();

    if (allSamples.length === 0) {
      spinner.fail('No writing samples found');
      console.log(chalk.yellow('\nPublish some writing first:'));
      console.log(chalk.cyan('  1. Ingest: claude-pen ingest --platform blog'));
      console.log(chalk.cyan('  2. Review: Check writing/drafts/'));
      console.log(chalk.cyan('  3. Publish: Move files to writing/content/blog/'));
      return;
    }

    spinner.text = `Found ${allSamples.length} samples, selecting representative set`;

    const selectedSamples = selectRepresentativeSamples(allSamples);

    spinner.succeed(`Collected ${selectedSamples.length} samples from ${allSamples.length} total`);

    // Continue to Phase 3...
  } catch (error) {
    spinner.fail('Failed to collect samples');
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
```

### Success Criteria

#### Automated Verification
- [x] File compiles: `bun run typecheck`
- [x] No lint errors: `bun run lint src/commands/analyze.ts`
- [x] Imports resolve correctly

#### Manual Verification
- [x] Sample collection reads from `writing/content/{platform}/` directories
- [x] Correctly handles missing platform directories
- [x] Token budget logic allocates fairly across platforms
- [x] Truncation logic preserves at least 1k chars
- [x] Console output shows platform-by-platform breakdown
- [x] Empty content shows helpful 3-step workflow message

---

## Phase 3: Format Samples and Generate Style Guide

### Changes Required

#### 1. Complete Analyze Command
**File**: `src/commands/analyze.ts`
**Changes**: Add sample formatting and LLM interaction

```typescript
// Add after selectRepresentativeSamples() call in analyze() function:

function formatSamples(samples: Sample[]): string {
  return samples
    .map(
      (sample, index) =>
        `## Sample ${index + 1}: ${sample.title} (${sample.platform})\n\n${sample.content}`
    )
    .join('\n\n---\n\n');
}

// Continue in analyze() function:
spinner.start('Formatting samples for analysis');

const formattedSamples = formatSamples(selectedSamples);
const platforms = Array.from(new Set(selectedSamples.map(s => s.platform))).join(', ');

spinner.succeed('Samples formatted');

// Load and interpolate prompt
const promptTemplate = loadPrompt('analyze');
const prompt = interpolate(promptTemplate, {
  samples: formattedSamples,
  platforms,
});

spinner.start('Analyzing writing style with Claude');

// Call LLM
const styleGuide = await complete(prompt, {
  system: 'You are an expert writing style analyst.',
  maxTokens: 4096,
});

spinner.succeed('Analysis complete');

// Save style guide
spinner.start(`Saving style guide to ${STYLE_GUIDE_PATH}`);

const outputPath = getPath(STYLE_GUIDE_PATH);
const frontmatter = {
  generated: new Date().toISOString(),
  sample_count: selectedSamples.length,
  platforms: Array.from(new Set(selectedSamples.map(s => s.platform))),
};

writeMarkdown(outputPath, frontmatter, styleGuide);

spinner.succeed(`Style guide saved to ${STYLE_GUIDE_PATH}`);

// Summary
console.log(chalk.bold('\n✓ Style Guide Generated'));
console.log(`  Analyzed: ${chalk.green(`${selectedSamples.length} samples`)}`);
console.log(`  Platforms: ${chalk.cyan(platforms)}`);
console.log(`  Output: ${chalk.blue(STYLE_GUIDE_PATH)}`);
console.log(chalk.dim(`\nUse this guide to inform your writing refinements.`));
```

### Success Criteria

#### Automated Verification
- [x] File compiles: `bun run typecheck`
- [x] No lint errors: `bun run lint src/commands/analyze.ts`
- [x] Function signatures match expected types

#### Manual Verification
- [x] Samples are formatted with clear separators
- [x] Prompt interpolation includes samples and platforms
- [x] LLM system message is appropriate
- [x] Token limit (4096) is sufficient for style guide output
- [x] Style guide saves to correct location with frontmatter
- [x] Summary output is clear and informative

---

## Phase 4: Register Command in CLI

### Changes Required

#### 1. Add Analyze Command to CLI
**File**: `src/index.ts`
**Changes**: Import and register the analyze command

```typescript
// Add import (after existing command imports)
import { analyze } from './commands/analyze.js';

// Add command registration (after existing commands)
program
  .command('analyze')
  .description('Analyze your writing samples to generate a style guide')
  .action(async () => {
    try {
      await analyze();
    } catch (error) {
      console.error(chalk.red('Command failed:'), error);
      process.exit(1);
    }
  });
```

### Success Criteria

#### Automated Verification
- [x] Build passes: `bun run dev --help`
- [x] Command appears in help output: `bun run dev --help | grep analyze`
- [x] No TypeScript errors: `bun run typecheck`

#### Manual Verification
- [x] `analyze` command is listed in CLI help
- [x] Command description is clear
- [x] Error handling works correctly

---

## Phase 5: End-to-End Testing

### Changes Required

No code changes - testing phase only.

### Success Criteria

#### Automated Verification
- [x] Full build succeeds: `bun run typecheck && bun run lint`
- [x] Command executes without errors: `bun run src/index.ts analyze`

#### Manual Verification

**Test Case 1: Empty Content**
```bash
# Start with empty writing/content/ directories
bun run src/index.ts analyze
# Expected: Error message with 3-step workflow instructions
```

**Test Case 2: Single Platform**
```bash
# 1. Ingest blog posts
bun run src/index.ts ingest ./sample-blog-posts --platform blog

# 2. Review drafts
ls writing/drafts/

# 3. Publish to content
mv writing/drafts/*.md writing/content/blog/

# 4. Analyze
bun run src/index.ts analyze

# Expected: Style guide generated at writing/_style_guide.md
```

**Test Case 3: Multiple Platforms**
```bash
# Ingest multiple platforms
bun run src/index.ts ingest ./blog-posts --platform blog
bun run src/index.ts ingest ./linkedin-posts --platform linkedin

# Publish to content directories
mv writing/drafts/*blog*.md writing/content/blog/
mv writing/drafts/*linkedin*.md writing/content/linkedin/

# Analyze
bun run src/index.ts analyze

# Expected: Style guide includes both platforms
```

**Test Case 4: Large Corpus**
```bash
# Ingest many files (>50)
bun run src/index.ts ingest ./large-corpus --platform blog

# Publish and analyze
mv writing/drafts/*.md writing/content/blog/
bun run src/index.ts analyze

# Expected:
# - Sample selection reduces to token budget
# - Console shows "X of Y samples included"
# - Style guide still generated successfully
```

**Verification Checklist**
- [x] Empty content shows helpful error message
- [x] Single platform analysis works (verified up to API call)
- [~] Multiple platforms are detected and analyzed (requires API key for full test)
- [x] Token budget is respected (check console output)
- [~] Style guide file is created at `writing/_style_guide.md` (requires API key)
- [~] Style guide contains all expected sections (voice, structure, language, platform differences, distinctive traits) (requires API key)
- [~] Style guide frontmatter includes generation metadata (requires API key)
- [x] Console output is clear and helpful
- [x] Errors are handled gracefully

---

## Rollback Plan

If issues arise during implementation:

1. **Remove command registration** from `src/index.ts`
2. **Delete files**:
   - `src/commands/analyze.ts`
   - `src/prompts/analyze.md`
3. **Verify build**: `bun run typecheck`

---

## Key Decisions & Rationale

### Decision 1: Use `writing/content/` NOT `corpus/`
**Rationale**: Research revealed that `corpus/` exists but is completely unused. The actual workflow uses `writing/content/{platform}/` for published content.

### Decision 2: Output to `writing/_style_guide.md`
**Rationale**: Keep the style guide with the writing samples since it analyzes content from `writing/content/`. The `_` prefix indicates it's generated/meta content.

### Decision 3: Equal Token Budget per Platform
**Rationale**: Prevents one prolific platform from dominating the analysis. Ensures all platforms are fairly represented in the style guide.

### Decision 4: 100k Token Input Budget
**Rationale**: Claude Sonnet 4 has 200k context window. Using 100k for input leaves 100k for the analysis and style guide generation, which should be sufficient.

### Decision 5: Truncate Last Sample per Platform
**Rationale**: Maximizes sample count while respecting budget. Only includes truncated samples if they're >1k chars to avoid fragmentary content.

### Decision 6: 4096 Token Output Limit
**Rationale**: Style guides are comprehensive documents. 4096 tokens (~16k chars) provides enough space for detailed analysis across all sections.

---

## Dependencies

- All existing utilities (`listMarkdownFiles`, `readMarkdown`, `writeMarkdown`, `getPath`, `complete`, `loadPrompt`, `interpolate`)
- External packages already installed (`chalk`, `ora`, `fs`, `path`)
- No new dependencies required

---

## Success Metrics

- Command executes successfully on empty and populated content directories
- Style guide is generated with all expected sections
- Token budget is respected (visible in console output)
- Multiple platforms are handled correctly
- Error messages are helpful and actionable
- Output formatting follows project conventions (chalk colors, ora spinners)

---

## Future Enhancements (Out of Scope)

- Interactive platform selection (filter by platform)
- Incremental updates (re-analyze only new content)
- Multiple style guide versions (compare evolution over time)
- Export formats (JSON, HTML)
- Style guide "apply" command (use guide to refine writing)
