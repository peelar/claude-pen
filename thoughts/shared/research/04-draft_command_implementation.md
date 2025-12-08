# Research: Draft Command Implementation

**Date:** 2025-12-08
**Purpose:** Understand existing patterns and architecture for implementing the `claude-pen draft` command

---

## Executive Summary

The claude-pen codebase has a well-established architecture for CLI commands with consistent patterns across existing commands (init, ingest, analyze). All required utility modules exist and are fully functional. This research identifies the exact patterns to follow for implementing the draft command.

**Critical Finding:** The plan references `corpus/_style_guide.md`, but the actual codebase uses `writing/_style_guide.md` (confirmed at `src/commands/analyze.ts:10`).

---

## 1. Directory Structure

### Current Structure
```
claude-pen/
├── src/
│   ├── index.ts              # CLI entry point (53 lines)
│   ├── types.ts              # Type definitions (23 lines)
│   ├── lib/                  # Utility modules
│   │   ├── config.ts         # Configuration management (83 lines)
│   │   ├── files.ts          # File operations (108 lines)
│   │   ├── llm.ts            # LLM integration (85 lines)
│   │   ├── prompts.ts        # Prompt loading/interpolation (68 lines)
│   │   └── index.ts          # Module exports
│   ├── prompts/              # Bundled prompt templates
│   │   ├── analyze.md        # Style guide generation (36 lines)
│   │   ├── ingest.md         # Metadata extraction (19 lines)
│   │   └── test.md           # Placeholder
│   └── commands/             # Command implementations
│       ├── analyze.ts        # Style guide analyzer (212 lines)
│       ├── ingest.ts         # Content ingestion (210 lines)
│       └── init.ts           # Workspace initialization (115 lines)
├── writing/                  # User workspace (NOT "corpus"!)
│   ├── _style_guide.md       # Generated style guide
│   ├── content/              # Published writing
│   │   ├── blog/
│   │   ├── linkedin/
│   │   ├── substack/
│   │   └── twitter/
│   ├── drafts/               # Work in progress
│   ├── import/               # Ingestion queue
│   └── raw/                  # Initial organization
└── .claude-pen/              # Project configuration
    ├── config.yaml           # User config
    └── prompts/              # User prompt overrides (optional)
```

### Important Path Corrections

**WRONG (from plan):**
```typescript
const STYLE_GUIDE_PATH = 'corpus/_style_guide.md';
```

**CORRECT (actual codebase):**
```typescript
const STYLE_GUIDE_PATH = 'writing/_style_guide.md';
```

Confirmed at: `src/commands/analyze.ts:10`

---

## 2. CLI Command Registration Pattern

### Location: `src/index.ts`

All commands follow this structure:

```typescript
import { Command } from 'commander';
import { draft } from './commands/draft.js';

program
  .command('draft <notes>')
  .description('Transform raw notes into a structured draft')
  .option('-o, --output <path>', 'Output file path')
  .action(async (notesPath, options) => {
    try {
      await draft(notesPath, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

**Pattern Details:**
- `<notes>` = required positional argument
- `[directory]` = optional positional argument (see ingest command)
- `.option()` = optional flag
- `.requiredOption()` = mandatory flag
- All actions wrap in try/catch with explicit exit codes
- Command logic delegates to separate function

**Reference:** Lines 14-53 in `src/index.ts`

---

## 3. Command Implementation Pattern

### Structure

Each command file exports a single async function:

```typescript
// src/commands/draft.ts
interface DraftOptions {
  output?: string;
}

export async function draft(
  notesPath: string,
  options: DraftOptions
): Promise<void> {
  // Implementation
}
```

### Common Import Pattern

**File:** All command implementations

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { Platform } from '../types.js';
import { getPath, ensureDir, readMarkdown, writeMarkdown, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';
```

**Note:** All imports use `.js` extension (ESM requirement)

**Reference:** Consistent across `analyze.ts`, `ingest.ts`, `init.ts`

---

## 4. File Operations

### Key Functions from `src/lib/files.ts`

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getPath()` | `(...segments: string[]) => string` | Build paths relative to project root |
| `ensureDir()` | `(dirPath: string) => void` | Create directory recursively |
| `readMarkdown()` | `(filePath: string) => {frontmatter, content}` | Parse markdown with YAML frontmatter |
| `writeMarkdown()` | `(filePath, frontmatter, content) => void` | Write markdown with frontmatter |
| `listMarkdownFiles()` | `(dir: string) => Promise<string[]>` | Find all `.md` files recursively |
| `countWords()` | `(text: string) => number` | Count words in text |
| `slugify()` | `(text: string) => string` | Create URL-safe filename |

### Usage Examples

**Reading content:**
```typescript
// ingest.ts:74-117
const { frontmatter, content } = readMarkdown(filePath);
```

**Writing with frontmatter:**
```typescript
// ingest.ts:106-109
writeMarkdown(outputPath, {
  title: metadata.title,
  date: metadata.date || new Date().toISOString().split('T')[0],
  platform,
  word_count: countWords(content),
  tags: metadata.tags,
  summary: metadata.summary,
}, content);
```

**Building paths:**
```typescript
// analyze.ts:47-48
const sourceDir = dir || getPath('writing', 'import');
const destinationDir = getPath('writing', 'content', platform);
```

**Ensuring directories exist:**
```typescript
// files.ts:52
ensureDir(path.dirname(filePath));
```

---

## 5. Console Output & Spinners

### Chalk Color Conventions

| Color | Usage | Example |
|-------|-------|---------|
| `chalk.green()` | Success | `✓ Draft saved to drafts/post.md` |
| `chalk.red()` | Error | `File not found: notes.md` |
| `chalk.yellow()` | Warning | `⚠ No style guide found` |
| `chalk.cyan()` | Next steps | `claude-pen refine drafts/post.md` |
| `chalk.dim()` | Secondary info | `Source: notes.md (342 words)` |
| `chalk.bold()` | Section headers | `✏️  Creating draft` |

**Reference:** Consistent pattern in `init.ts:46-114`, `analyze.ts:129-198`

### Ora Spinner Pattern

**Basic spinner:**
```typescript
// analyze.ts:129
const spinner = ora('Collecting writing samples').start();
```

**Update message mid-operation:**
```typescript
// analyze.ts:140
spinner.text = `Found ${allSamples.length} samples`;
```

**Success/failure:**
```typescript
// analyze.ts:198
spinner.succeed(`Style guide saved to ${STYLE_GUIDE_PATH}`);

// ingest.ts:187
spinner.fail(`${filename} - failed`);
```

**Info (neutral):**
```typescript
// ingest.ts:181
spinner.info(`${filename} - skipped (already has metadata)`);
```

**Stop without state:**
```typescript
// analyze.ts:146
spinner.stop();  // Stop to print clean output, then restart
```

---

## 6. LLM Integration

### Function: `complete()` from `src/lib/llm.ts`

**Signature:**
```typescript
async function complete(
  prompt: string,
  options?: {
    system?: string;
    maxTokens?: number;
    silent?: boolean;
  }
): Promise<string>
```

**Default Values:**
- `maxTokens`: 4096
- `silent`: false (shows "Thinking..." spinner)

### Usage Pattern

**Step 1: Load and interpolate prompt**
```typescript
// ingest.ts:88-90
const promptTemplate = loadPrompt('ingest');
const prompt = interpolate(promptTemplate, {
  content: fileContent
});
```

**Step 2: Call LLM**
```typescript
// ingest.ts:91-95
const response = await complete(prompt, {
  system: 'You are a metadata extraction assistant.',
  maxTokens: 500,
  silent: true,  // Suppress spinner (useful in loops)
});
```

### Examples from Commands

**Analyze command (style guide generation):**
```typescript
// analyze.ts:181
const styleGuide = await complete(prompt, {
  system: 'You are an expert writing style analyst.',
  maxTokens: 4096,
  silent: true,
});
```

**Ingest command (metadata extraction):**
```typescript
// ingest.ts:91-95
const response = await complete(prompt, {
  system: 'You are a metadata extraction assistant.',
  maxTokens: 500,
  silent: true,
});
```

**Draft command (expected pattern):**
```typescript
const draftContent = await complete(prompt, {
  system: 'You are a skilled ghostwriter helping an author structure their thoughts while preserving their unique voice.',
  maxTokens: 8000,  // Longer output for full drafts
});
```

---

## 7. Prompt System

### Functions from `src/lib/prompts.ts`

**Load prompt template:**
```typescript
loadPrompt(name: string): string
```

**Priority order:**
1. User prompts: `.claude-pen/prompts/[name].md`
2. Bundled: `src/prompts/[name].md`

**Interpolate variables:**
```typescript
interpolate(template: string, context: Record<string, string>): string
```

Replaces `{{variable}}` with values from context.

### Existing Prompts

| File | Purpose | Variables | Lines |
|------|---------|-----------|-------|
| `src/prompts/ingest.md` | Extract metadata | `{{content}}` | 19 |
| `src/prompts/analyze.md` | Generate style guide | `{{samples}}`, `{{platforms}}` | 36 |

### Draft Prompt Template (to create)

**File:** `src/prompts/draft.md`

**Variables:**
- `{{style_guide}}` - Author's style guide content
- `{{notes}}` - Raw notes to transform

**Reference:** See plan section 1 for full prompt template

---

## 8. Error Handling Patterns

### Input Validation

**Early validation with clear messages:**
```typescript
// ingest.ts:140-153
if (!validPlatforms.includes(platform)) {
  console.error(chalk.red(`Invalid platform: ${platform}`));
  console.error(`Valid options: ${validPlatforms.join(', ')}`);
  process.exit(1);
}

if (!fs.existsSync(sourceDir)) {
  console.error(chalk.red(`Directory not found: ${sourceDir}`));
  process.exit(1);
}
```

### Graceful Degradation

**Handle missing optional resources:**
```typescript
// Draft command pattern:
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Draft will be created without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Use a clear, professional tone.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}
```

### Per-Item Error Handling

**Continue processing on individual failures:**
```typescript
// ingest.ts:173-194
for (const filePath of files) {
  const spinner = ora(`Processing ${filename}`).start();

  try {
    await ingestFile(filePath, platform, promptTemplate, spinner, destinationDir);
    spinner.succeed(`${filename} → ${path.basename(result.outputPath!)}`);
    ingested++;
  } catch (error) {
    spinner.fail(`${filename} - failed`);
    console.error(chalk.dim(`  ${error}`));
    failed++;
  }
}

// Show summary
console.log(chalk.bold('\n📊 Summary'));
console.log(`  Ingested: ${chalk.green(ingested)}`);
console.log(`  Failed:   ${chalk.red(failed)}`);
```

---

## 9. Output Path Generation

### Pattern from Ingest Command

**Generate output filename:**
```typescript
// ingest.ts:33-41
function generateFilename(metadata: ExtractedMetadata): string {
  const slug = slugify(metadata.title);
  const date = metadata.date || new Date().toISOString().split('T')[0];
  return `${date}-${slug}.md`;
}
```

**Draft command pattern:**
```typescript
function getOutputPath(inputPath: string, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  const basename = path.basename(inputPath, path.extname(inputPath));
  return getPath('drafts', `${basename}.md`);
}
```

**Usage:**
```typescript
const outputPath = getOutputPath(notesPath, options.output);
```

---

## 10. Configuration

### Type Definition: `src/types.ts`

```typescript
export interface ClaudePenConfig {
  author: string;
  llm: {
    provider: 'anthropic' | 'openai';
    model: string;
    apiKeyEnv: string;
  };
}
```

**Default values:**
```typescript
{
  author: '',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  }
}
```

**Loading config:**
```typescript
import { loadConfig } from '../lib/config.js';

const config = loadConfig();
const apiKey = process.env[config.llm.apiKeyEnv];
```

**Reference:** `src/lib/config.ts:55-66`

---

## 11. Type Definitions

### Existing Types in `src/types.ts`

```typescript
export type Platform = 'blog' | 'linkedin' | 'substack' | 'twitter';
export type RefinePass = 'proofread' | 'punchier' | 'clarity';

export interface ArticleFrontmatter {
  title: string;
  date: string;
  platform: Platform;
  url?: string;
  word_count: number;
  tags: string[];
  summary?: string;
}
```

**Draft command types (to add):**
```typescript
interface DraftOptions {
  output?: string;
}
```

---

## 12. Dependencies

### From `package.json`

**Core:**
- `@anthropic-ai/sdk`: ^0.71.2 - Claude API integration
- `commander`: ^14.0.2 - CLI framework

**Utilities:**
- `chalk`: ^5.6.2 - Terminal colors
- `ora`: ^9.0.0 - Spinners
- `glob`: ^13.0.0 - File pattern matching
- `yaml`: ^2.8.2 - YAML parsing

**Dev:**
- `typescript`: ^5.8.1
- `@types/node`: ^22.12.5
- `bun-types`: ^1.2.11

---

## 13. Key Architectural Decisions

### 1. Workspace Structure
- User workspace directory is `writing/`, NOT `corpus/`
- Style guide location: `writing/_style_guide.md`
- Draft output: `writing/drafts/`

### 2. File Organization
- Commands: One file per command in `src/commands/`
- Utilities: Organized by concern in `src/lib/`
- Prompts: Markdown files in `src/prompts/` (bundled) and `.claude-pen/prompts/` (user)

### 3. Error Handling Strategy
- Validate early, fail fast
- Graceful degradation for optional features
- Per-item error handling in batch operations
- Always show summary statistics

### 4. User Feedback
- Use emojis for visual clarity (✏️, ✓, ⚠, 📊)
- Color-code messages semantically
- Show spinners for long operations
- Suggest next steps after completion

### 5. Extensibility
- User prompts override bundled prompts
- Support multiple LLM providers via config
- Workspace can be in any directory (auto-discovery)

---

## 14. Implementation Checklist for Draft Command

Based on existing patterns, the draft command needs:

### Files to Create
- [ ] `src/commands/draft.ts` - Command implementation (~150 lines)
- [ ] `src/prompts/draft.md` - Prompt template (~30 lines)

### Files to Modify
- [ ] `src/index.ts` - Register draft command (~15 lines added)

### Key Functions to Implement

**Command function:**
```typescript
export async function draft(notesPath: string, options: DraftOptions): Promise<void>
```

**Helper functions:**
```typescript
function loadStyleGuide(): string
function getOutputPath(inputPath: string, explicitOutput?: string): string
```

### Implementation Steps

1. **Input validation**
   - Check notes file exists
   - Read notes content
   - Calculate word count

2. **Load resources**
   - Load style guide (with graceful fallback)
   - Load draft prompt template
   - Interpolate variables

3. **Generate draft**
   - Call LLM with spinner
   - Handle errors

4. **Save output**
   - Ensure drafts directory exists
   - Write draft to file
   - Calculate word count

5. **User feedback**
   - Show success message with word count
   - Suggest next steps (refine commands)

---

## 15. Code Examples from Similar Commands

### Analyze Command Structure (most similar)

**File:** `src/commands/analyze.ts`

```typescript
const STYLE_GUIDE_PATH = 'writing/_style_guide.md';

export async function analyze(): Promise<void> {
  console.log(chalk.bold('\n📊 Analyzing writing style\n'));

  const spinner = ora('Collecting writing samples').start();

  try {
    const allSamples = await collectSamples();

    if (allSamples.length === 0) {
      spinner.fail('No writing samples found');
      console.log(chalk.yellow('\nPublish some writing first:'));
      return;
    }

    spinner.text = 'Analyzing writing style';
    const styleGuide = await complete(prompt, { silent: true });

    spinner.succeed(`Style guide saved to ${STYLE_GUIDE_PATH}`);

    console.log(chalk.bold('\n✓ Style Guide Generated'));
    console.log(`  Analyzed: ${chalk.green(`${stats.selected.length} samples`)}`);

  } catch (error) {
    spinner.fail('Failed to collect samples');
    throw error;
  }
}
```

### Ingest Command File Processing (for reference)

**File:** `src/commands/ingest.ts:74-117`

```typescript
async function ingestFile(
  filePath: string,
  platform: Platform,
  promptTemplate: string,
  spinner: ora.Ora,
  destinationDir: string
): Promise<{ skipped?: boolean; outputPath?: string }> {
  const { frontmatter, content } = readMarkdown(filePath);

  // Skip if already has metadata
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    return { skipped: true };
  }

  // Extract metadata via LLM
  spinner.text = `Extracting metadata`;
  const prompt = interpolate(promptTemplate, { content });
  const response = await complete(prompt, {
    system: 'You are a metadata extraction assistant.',
    maxTokens: 500,
    silent: true,
  });

  const metadata = parseMetadata(response);
  const filename = generateFilename(metadata);
  const outputPath = path.join(destinationDir, filename);

  writeMarkdown(outputPath, {
    title: metadata.title,
    date: metadata.date || new Date().toISOString().split('T')[0],
    platform,
    word_count: countWords(content),
    tags: metadata.tags,
    summary: metadata.summary,
  }, content);

  return { outputPath };
}
```

---

## 16. Testing Strategy (from plan)

### Automated Verification
```bash
bun run typecheck
bun run src/index.ts draft --help
```

### Manual Test Cases

**1. Create test notes:**
```bash
mkdir -p raw
cat > raw/test-notes.md << 'EOF'
thoughts on building fast
- speed is everything for indie hackers
- ship something ugly but working
EOF
```

**2. Test without style guide:**
```bash
mv writing/_style_guide.md writing/_style_guide.md.bak
bun run src/index.ts draft raw/test-notes.md
```

Expected:
- Warning about missing style guide
- Draft created in `writing/drafts/test-notes.md`
- Draft has structure (intro, body, conclusion)

**3. Test with style guide:**
```bash
mv writing/_style_guide.md.bak writing/_style_guide.md
bun run src/index.ts draft raw/test-notes.md
```

Expected:
- No warning
- Draft matches author's voice
- Shows word count
- Suggests refine commands

**4. Test custom output:**
```bash
bun run src/index.ts draft raw/test-notes.md -o writing/drafts/speed-post.md
```

Expected:
- Creates file at specified path

**5. Test error handling:**
```bash
bun run src/index.ts draft raw/nonexistent.md
```

Expected:
- "File not found" error
- Non-zero exit code

---

## Recommendations

### Must Follow
1. **Use correct paths:** `writing/_style_guide.md` NOT `corpus/_style_guide.md`
2. **Match existing patterns:** Follow analyze.ts structure for consistency
3. **Graceful degradation:** Draft should work without style guide
4. **User feedback:** Clear messages, spinners, next steps
5. **Error handling:** Validate early, fail with helpful messages

### Nice to Have
1. Consider adding `--append` flag to append to existing drafts
2. Consider `--template` flag for different draft structures
3. Add progress indication if processing very long notes
4. Log to `.claude-pen/history.log` for debugging

### Testing Priority
1. Happy path with style guide (highest priority)
2. Fallback without style guide
3. Custom output path
4. Error cases (file not found)

---

## Next Steps

1. **Create prompt template:** `src/prompts/draft.md`
2. **Implement command:** `src/commands/draft.ts`
3. **Register command:** Update `src/index.ts`
4. **Test thoroughly:** Follow manual test plan
5. **Verify types:** Run `bun run typecheck`

---

## Appendix: File Locations Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 53 | CLI entry point, command registration |
| `src/types.ts` | 23 | Type definitions |
| `src/lib/config.ts` | 83 | Configuration management |
| `src/lib/files.ts` | 108 | File operations |
| `src/lib/llm.ts` | 85 | LLM integration |
| `src/lib/prompts.ts` | 68 | Prompt loading/interpolation |
| `src/commands/init.ts` | 115 | Workspace initialization |
| `src/commands/ingest.ts` | 210 | Content ingestion |
| `src/commands/analyze.ts` | 212 | Style guide generation |
| `src/prompts/analyze.md` | 36 | Style guide prompt |
| `src/prompts/ingest.md` | 19 | Metadata extraction prompt |

---

**Research completed:** 2025-12-08
**Status:** Ready for planning phase