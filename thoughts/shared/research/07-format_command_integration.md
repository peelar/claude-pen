# Research: Format Command Integration

**Date:** 2025-12-08
**Scope:** Verify compatibility of proposed format command with claude-pen codebase
**Status:** ✓ Highly Compatible

## Executive Summary

The proposed `format` command can be implemented following established patterns with high confidence. All required infrastructure exists:
- `Platform` type already supports all 4 platforms
- Prompt loading system supports subdirectories (`format/linkedin.md`)
- `complete()` API provides exact functionality needed
- File utilities (`getPath()`, `ensureDir()`, markdown handling) fully available
- Validation and error handling patterns proven across 5 existing commands

**Verdict:** Code will work with the existing codebase architecture.

---

## Key Files & Locations

| File | Purpose | Critical Lines |
|------|---------|----------------|
| `src/index.ts` | CLI entry, command registration | 40-144 (command registration pattern) |
| `src/commands/draft.ts` | Reference: file processing, style guide loading | 19-29 (style guide), 116-135 (LLM call) |
| `src/commands/refine.ts` | Reference: similar workflow, NOT registered yet | 48-82 (validation + LLM) |
| `src/lib/llm.ts` | `complete()` function for Claude API calls | 67-82 (function signature) |
| `src/lib/prompts.ts` | `loadPrompt()` and `interpolate()` | 12-41 (load), 47-53 (interpolate) |
| `src/lib/files.ts` | Path resolution, markdown I/O | All utility functions |
| `src/types.ts` | Type definitions | 3 (Platform type) |

---

## Architecture & Data Flow

### 1. Command Registration Flow

```
src/index.ts
  ↓ imports command function
src/commands/format.ts
  ↓ exports async function format(draft, options)
  ↓ validates platform + file existence
  ↓ loads style guide (graceful fallback)
  ↓ loads platform prompt template
  ↓ interpolates template with style + content
  ↓ calls complete() for LLM formatting
  ↓ writes formatted output
  ↓ displays success message
```

### 2. Prompt Loading Flow

```
loadPrompt('format/linkedin')
  ↓ checks user override: .claude-pen/prompts/format/linkedin.md
  ↓ falls back to bundled: src/prompts/format/linkedin.md
  ↓ throws if not found
  ↓ returns template string with {{placeholders}}

interpolate(template, { style_guide, content })
  ↓ replaces {{style_guide}} with loaded style guide
  ↓ replaces {{content}} with draft content
  ↓ returns ready-to-send prompt
```

### 3. LLM Completion Flow

```
complete(prompt, { system, maxTokens, silent })
  ↓ getLLMClient() loads config + validates env
  ↓ creates spinner if silent !== true
  ↓ calls anthropic.messages.create()
  ↓ extracts text from response
  ↓ returns formatted string
```

---

## Patterns to Follow

### Pattern 1: File Path Input & Validation
**Source:** `refine.ts:48-53`, `draft.ts:82-90`

```typescript
const draftPath = path.resolve(draftArg);

if (!fs.existsSync(draftPath)) {
  console.error(chalk.red(`File not found: ${draftPath}`));
  process.exit(1);
}
```

**Why this pattern:**
- Uses `path.resolve()` to handle relative paths from user's CWD
- Consistent error message format across all commands
- Explicit `process.exit(1)` for failed validation

### Pattern 2: Platform Validation
**Source:** `ingest.ts:146-152`

```typescript
const validPlatforms: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];

if (!validPlatforms.includes(platform)) {
  console.error(chalk.red(`Invalid platform: ${platform}`));
  console.error(`Valid options: ${validPlatforms.join(', ')}`);
  process.exit(1);
}
```

**Why this pattern:**
- Defines valid options explicitly for clarity
- Shows helpful error with all valid options
- Exit code 1 indicates user input error

### Pattern 3: Style Guide with Graceful Fallback
**Source:** `draft.ts:19-29`, `refine.ts:22-32`

```typescript
function loadStyleGuide(): string {
  const stylePath = getPath('corpus', '_style_guide.md');

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Formatting will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}
```

**Why this pattern:**
- Warning but not error - command can still work
- Guides user to fix: suggests `analyze` command
- Returns fallback instruction for Claude
- Used identically in both `draft` and `refine`

### Pattern 4: LLM Completion with Spinner
**Source:** `refine.ts:73-82`, `draft.ts:116-135`

```typescript
const spinner = ora(`Formatting for ${platform}...`).start();

try {
  const formatted = await complete(prompt, {
    system: 'You are an expert content formatter who adapts writing for different platforms while preserving the author\'s voice.',
    maxTokens: 8000,
    silent: true,  // Critical: prevents double spinner
  });

  spinner.succeed(`Formatted for ${platform}`);
  return formatted;
} catch (error) {
  spinner.fail(`Formatting failed`);
  throw error;
}
```

**Why this pattern:**
- Manual spinner management for better UX
- `silent: true` prevents `complete()` from creating its own spinner
- Success/fail messages match spinner start message
- Error thrown up for command-level try-catch to handle

### Pattern 5: Output with Next Steps
**Source:** `draft.ts:154-165`, `refine.ts:97-108`

```typescript
console.log(chalk.bold('\n✓ Formatted for Publishing'));
console.log(chalk.dim(`  Source: ${sourceName} (${sourceWordCount} words)`));
console.log(chalk.green(`  Output: ${outputPath} (${outputWordCount} words)`));

console.log(chalk.bold('\n📝 Next Steps:'));
console.log(chalk.dim('  Review the formatted content:'));
console.log(chalk.cyan(`  open ${outputPath}`));
console.log();
```

**Why this pattern:**
- Clear visual hierarchy with chalk colors
- Stats show transformation (input → output words)
- Next steps guide user on what to do after command
- Copyable command for quick file opening

---

## Code Examples from Existing Commands

### Example 1: Command Registration
**From:** `src/index.ts:90-104` (draft command)

```typescript
import { draft } from './commands/draft.js';

program
  .command('draft [notes]')
  .description('Transform raw notes or thoughts into a structured draft')
  .option('-o, --output <path>', 'Custom output file path')
  .action(async (notes, options) => {
    try {
      await draft(notes, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

**For format command, would be:**

```typescript
import { format } from './commands/format.js';

program
  .command('format <draft>')
  .description('Format draft for publishing (all platforms by default)')
  .option('--for <platform>', 'Specific platform: linkedin, twitter, substack, blog')
  .action(async (draft, options) => {
    try {
      await format(draft, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

### Example 2: Complete Function Signature
**From:** `src/lib/llm.ts:67-82`

```typescript
export async function complete(
  prompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const { system, maxTokens = 4096, silent = false } = options;

  const spinner = silent ? null : ora('Thinking...').start();

  const client = getLLMClient();
  const config = loadConfig();

  const response = await client.messages.create({
    model: config.llm.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  // ... extract and return text
}
```

**Usage pattern:**
- Always pass `silent: true` when managing own spinner
- `system` prompt sets overall role/context
- `maxTokens` should be 8000 for drafts (longer content)

### Example 3: Prompt Template Structure
**From:** `src/prompts/draft.md:1-20`

```markdown
You are a skilled ghostwriter who transforms rough notes and stream-of-consciousness thoughts into compelling, well-structured drafts.

## Author's Style Guide

{{style_guide}}

## Task

Your job is to convert the raw notes below into a clear, structured draft that:

1. Identifies the core message or narrative thread
2. Organizes ideas into a logical flow
3. Maintains the author's authentic voice and tone (guided by the style guide)
4. Adds structure without adding unnecessary formality
5. Preserves key phrases or expressions that sound authentically like the author

Important:
- Don't try to be overly polished. Natural and slightly rough beats formal and sterile.
- Output only the draft itself. No preamble, no meta-commentary.

## Notes

{{notes}}
```

**Key elements:**
1. Role definition (first paragraph)
2. `{{style_guide}}` placeholder
3. Clear task with numbered steps
4. Constraints in "Important:" section
5. Input section with `{{content}}` placeholder

---

## Verified Compatibility Checks

### ✓ Type System Ready

**From:** `src/types.ts:3`
```typescript
export type Platform = 'blog' | 'linkedin' | 'substack' | 'twitter';
```

All four platforms in the plan already exist in types. No changes needed.

### ✓ Prompt Directory Structure Ready

**From:** `src/commands/init.ts:78-82`
```typescript
const directories = [
  '.claude-pen/prompts/format',  // ← Created by init command
  'corpus',
  'notes',
  'drafts',
];
```

The `format/` subdirectory is already created by `init` command, indicating format was planned.

**Current state:**
```
src/prompts/
├── format/          ← Empty, ready for platform prompts
├── analyze.md
├── draft.md
├── ingest.md
└── test.md
```

### ✓ LLM Integration Parameters

**Required by plan:**
```typescript
complete(prompt, {
  system: 'You are an expert content formatter...',
  maxTokens: 4000,
})
```

**Actual signature from** `src/lib/llm.ts:67-82`:
```typescript
interface LLMOptions {
  system?: string;      ✓ Available
  maxTokens?: number;   ✓ Available
  silent?: boolean;     ✓ Available (bonus)
}
```

All parameters match exactly.

### ✓ File Utility Functions

**Required by plan:**
- `getPath(...segments)` ✓ Available (`files.ts:13-17`)
- `ensureDir(dirPath)` ✓ Available (`files.ts:88-95`)
- File existence check: `fs.existsSync()` ✓ Standard Node.js
- File read: `fs.readFileSync()` ✓ Standard Node.js
- File write: `fs.writeFileSync()` ✓ Standard Node.js

**Bonus utilities not in plan but useful:**
- `readMarkdown()` - Parse frontmatter automatically
- `writeMarkdown()` - Write frontmatter + content
- `countWords()` - Show word count stats
- `slugify()` - Generate clean filenames

### ✓ Prompt Loading System

**Required by plan:**
```typescript
loadPrompt(`format/${platform}`)
interpolate(promptTemplate, { style_guide, content })
```

**Actual implementation from** `src/lib/prompts.ts:12-53`:

```typescript
export function loadPrompt(name: string): string {
  // Checks .claude-pen/prompts/{name}.md first (user override)
  // Falls back to src/prompts/{name}.md (bundled)
  // Supports subdirectories: 'format/linkedin' → 'format/linkedin.md'
}

export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  // Replaces {{key}} with context[key]
  // Leaves unmatched keys as-is
}
```

Both functions exist and support exact usage pattern in plan.

---

## Proposed Plan Analysis

### Plan Section 1: Format Prompts

**Proposed files:**
- `src/prompts/format/linkedin.md`
- `src/prompts/format/twitter.md`
- `src/prompts/format/substack.md`
- `src/prompts/format/blog.md`

**Compatibility:** ✓ Perfect
- Directory structure ready
- Prompt loading supports `loadPrompt('format/linkedin')`
- Template structure matches existing prompts
- `{{style_guide}}` and `{{content}}` placeholders supported

**Recommendations:**
1. Follow structure from `draft.md` (role, style guide, task, constraints, input)
2. Emphasize "preserve author voice while adapting for platform"
3. Keep platform constraints strict (e.g., Twitter 280 char limit)
4. Output format should be consistent: "No preamble, no explanation"

### Plan Section 2: Format Command Implementation

**Proposed:** `src/commands/format.ts`

**Architecture review:**

```typescript
// ✓ Imports follow convention
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { getPath, ensureDir } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import type { Platform } from '../types.js';

// ✓ Interface matches Commander option pattern
interface FormatOptions {
  for?: Platform;  // Maps to --for <platform>
}

// ✓ Constants match type system
const ALL_PLATFORMS: Platform[] = ['linkedin', 'twitter', 'substack', 'blog'];
const STYLE_GUIDE_PATH = 'corpus/_style_guide.md';

// ✓ Helper functions follow established patterns
function loadStyleGuide(): string { /* ... */ }
function getOutputPath(inputPath: string, platform: Platform): string { /* ... */ }
async function formatForPlatform(/* ... */): Promise<string> { /* ... */ }

// ✓ Main function signature matches command pattern
export async function format(draftPath: string, options: FormatOptions): Promise<void>
```

**Compatibility verdict:** ✓ Perfect match

**Minor suggestions:**

1. **getOutputPath logic** - Plan removes platform suffix, which is good:
   ```typescript
   const cleanName = basename.replace(/-(linkedin|twitter|substack|blog)$/, '');
   ```
   This prevents `test-linkedin-twitter.md` when reformatting.

2. **Error handling in loop** - Plan catches errors per platform, which is good for "format all" mode.

3. **Results tracking** - Plan collects results array for summary, matches patterns from `ingest.ts`.

### Plan Section 3: Command Registration

**Proposed:**
```typescript
program
  .command('format <draft>')
  .description('Format draft for publishing (all platforms by default)')
  .option('--for <platform>', 'Specific platform: linkedin, twitter, substack, blog')
  .action(format);
```

**Issue:** Missing try-catch wrapper

**Correct pattern from existing commands:**
```typescript
.action(async (draft, options) => {
  try {
    await format(draft, options);
    process.exit(0);
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
});
```

**Why:** All commands wrap action in try-catch for consistent error handling.

---

## Discovered Issues & Solutions

### Issue 1: Refine Command Not Registered
**Status:** BLOCKING for user workflow

**Problem:**
- File exists: `src/commands/refine.ts` (113 lines, fully implemented)
- NOT imported in `src/index.ts`
- Users can't run `claude-pen refine` yet

**Solution:**
Add to `src/index.ts` after line 104 (after draft command):

```typescript
import { refine } from './commands/refine.js';

program
  .command('refine <draft>')
  .description('Apply an editorial refinement pass to a draft')
  .option('--pass <pass>', 'Refinement pass: proofread, punchier, clarity', 'proofread')
  .action(async (draft, options) => {
    try {
      await refine(draft, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

### Issue 2: Missing Refine Prompts
**Status:** BLOCKING for refine command

**Problem:**
- `refine.ts` calls `loadPrompt(pass)` where pass is `'proofread' | 'punchier' | 'clarity'`
- These files don't exist:
  - `src/prompts/proofread.md`
  - `src/prompts/punchier.md`
  - `src/prompts/clarity.md`

**Solution:**
Create three prompt files based on pattern from `draft.md`. Template structure:

```markdown
You are an expert editor specializing in [pass type].

## Author's Style Guide

{{style_guide}}

## Task

[Pass-specific instructions]

Important:
- Preserve the author's voice and tone
- [Pass-specific constraints]

Output only the refined text. No preamble, no explanation.

## Draft

{{content}}
```

### Issue 3: Format Command Option Design
**Status:** DESIGN DECISION

**Plan proposes:**
```bash
claude-pen format draft.md --for twitter
```

**Alternative pattern from refine:**
```bash
claude-pen refine draft.md --pass proofread
```

**Consistency suggestion:**
Use `--for` as in plan, matches semantic meaning better ("format for twitter" vs "format pass twitter").

**Default behavior question:**
- Plan: Format for all platforms if `--for` not specified
- Pro: One command generates all versions
- Con: Multiple API calls, longer wait time
- Recommendation: Keep as designed, but show progress clearly

---

## Integration Recommendations

### Recommendation 1: Fix Refine First
Before implementing format, complete the refine command setup:

1. Register command in `src/index.ts`
2. Create three prompt files (`proofread.md`, `punchier.md`, `clarity.md`)
3. Test refine workflow end-to-end

**Why:** Format command follows same patterns as refine. Completing refine validates the approach.

### Recommendation 2: Enhance Output Path Logic
Consider adding explicit output directory option:

```typescript
.option('-o, --output-dir <dir>', 'Output directory (default: drafts/)')
```

**Why:** Users might want platform versions in different folders (e.g., `writing/content/twitter/`).

**Alternative:** Keep simple as in plan, users can move files after.

### Recommendation 3: Add Dry Run Mode
Add flag for preview without writing:

```typescript
.option('--dry-run', 'Show what would be formatted without making changes')
```

**Why:** Helpful for checking which files would be created, especially with "all platforms" default.

### Recommendation 4: Word Count Stats
Add word count comparison in output (like draft and refine do):

```typescript
console.log(chalk.dim(`  ${platform}: ${inputWords} → ${outputWords} words`));
```

**Why:** Shows transformation impact, helps verify format didn't cut content.

### Recommendation 5: Validate Twitter Character Counts
Consider post-processing Twitter threads to verify 280 char limit:

```typescript
const tweets = formatted.split('\n\n');
const tooLong = tweets.filter(t => t.length > 280);
if (tooLong.length > 0) {
  console.warn(chalk.yellow(`⚠ ${tooLong.length} tweets exceed 280 characters`));
}
```

**Why:** LLMs can miscalculate character counts, manual verification catches errors.

---

## Testing Checklist

### Build & Type Safety
- [ ] `bun run typecheck` passes
- [ ] No import errors from `src/index.ts`
- [ ] All types resolve correctly (`Platform`, `FormatOptions`)

### File System
- [ ] Creates `drafts/` directory if missing
- [ ] Handles absolute and relative input paths
- [ ] Overwrites existing formatted files
- [ ] Removes platform suffix when present in input

### Validation
- [ ] Rejects invalid platform: `--for tiktok`
- [ ] Shows helpful error with valid options
- [ ] Rejects missing input file
- [ ] Shows clear file not found error

### Style Guide Handling
- [ ] Loads style guide when present
- [ ] Shows warning when missing (doesn't fail)
- [ ] Provides fallback instruction to Claude
- [ ] Suggests `analyze` command in warning

### LLM Integration
- [ ] Calls `complete()` with correct parameters
- [ ] Spinner shows platform being formatted
- [ ] Succeeds on API success
- [ ] Fails gracefully on API error
- [ ] Handles rate limiting (consider retry logic)

### Multi-Platform Formatting
- [ ] Formats all 4 platforms when `--for` not specified
- [ ] Shows progress for each platform
- [ ] Continues on error (doesn't fail entire batch)
- [ ] Shows summary of successes and failures

### Single Platform Formatting
- [ ] Formats only specified platform with `--for twitter`
- [ ] Creates correct output filename
- [ ] Shows single success message

### Output Quality
- [ ] LinkedIn: No markdown, short paragraphs
- [ ] Twitter: Numbered tweets, each under 280 chars
- [ ] Substack: Frontmatter with headline/subtitle/preview
- [ ] Blog: Frontmatter with title/meta_description
- [ ] All: Author voice preserved

### User Experience
- [ ] Help text shows: `claude-pen format --help`
- [ ] Output paths clearly displayed
- [ ] Next steps suggested
- [ ] Error messages are actionable

---

## Success Criteria Summary

**Must have:**
✓ All platform prompts created with correct structure
✓ Format command follows established patterns exactly
✓ Command registered in `src/index.ts` with try-catch
✓ File and platform validation work
✓ Style guide gracefully degrades
✓ Single platform formatting works
✓ Multi-platform formatting works
✓ TypeScript compilation passes

**Should have:**
✓ Word count statistics in output
✓ Clear progress indicators (spinners)
✓ Helpful error messages
✓ Next steps guidance
✓ Refine command registered (prerequisite)
✓ Refine prompts created (prerequisite)

**Nice to have:**
- Dry run mode
- Custom output directory
- Twitter character count validation
- Rate limit retry logic
- Batch processing multiple drafts

---

## Absolute File Paths Reference

**Core files:**
- CLI: `/Users/adrianpilarczyk/Code/claude-pen/src/index.ts`
- Types: `/Users/adrianpilarczyk/Code/claude-pen/src/types.ts`

**Utilities:**
- `/Users/adrianpilarczyk/Code/claude-pen/src/lib/llm.ts`
- `/Users/adrianpilarczyk/Code/claude-pen/src/lib/prompts.ts`
- `/Users/adrianpilarczyk/Code/claude-pen/src/lib/files.ts`
- `/Users/adrianpilarczyk/Code/claude-pen/src/lib/config.ts`
- `/Users/adrianpilarczyk/Code/claude-pen/src/lib/env.ts`

**Reference commands:**
- `/Users/adrianpilarczyk/Code/claude-pen/src/commands/draft.ts` (best pattern reference)
- `/Users/adrianpilarczyk/Code/claude-pen/src/commands/refine.ts` (most similar workflow)
- `/Users/adrianpilarczyk/Code/claude-pen/src/commands/ingest.ts` (platform validation)
- `/Users/adrianpilarczyk/Code/claude-pen/src/commands/analyze.ts` (style guide generation)
- `/Users/adrianpilarczyk/Code/claude-pen/src/commands/init.ts` (directory setup)

**Prompt directories:**
- Bundled: `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/`
- User overrides: `/Users/adrianpilarczyk/Code/claude-pen/.claude-pen/prompts/`

**Research output:**
- This file: `/Users/adrianpilarczyk/Code/claude-pen/thoughts/shared/research/07-format_command_integration.md`

---

## Final Verdict

**The proposed format command is architecturally sound and ready for implementation.**

All required infrastructure exists:
- Type system supports all platforms
- Prompt loading handles subdirectories
- LLM integration API matches requirements
- File utilities provide all needed operations
- Validation patterns proven across existing commands
- Error handling patterns established

**Next steps:**
1. Fix refine command registration (5 lines in `src/index.ts`)
2. Create refine prompt files (validate patterns work)
3. Implement format prompts (4 files)
4. Implement format command (follows refine pattern)
5. Register format command (5 lines in `src/index.ts`)
6. Test end-to-end workflow

**Estimated effort:** Low complexity, high confidence. The plan can be executed as written with minor adjustments to command registration (add try-catch wrapper).
