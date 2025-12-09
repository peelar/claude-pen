# Research: Refine Command Implementation

**Date**: 2025-12-08
**Goal**: Understand the codebase to implement the `claude-pen refine` command

## Overview

The refine command will apply editorial passes (proofread, punchier, clarity) to drafts while preserving the author's voice. This research documents all relevant patterns, files, and conventions needed for implementation.

## Key Findings

### 1. The RefinePass Type Already Exists

**Location**: `/Users/adrianpilarczyk/Code/claude-pen/src/types.ts:3`

```typescript
export type RefinePass = 'proofread' | 'punchier' | 'clarity';
```

This type is already defined and ready to use. No need to create it.

### 2. Command Registration Pattern

**Location**: `/Users/adrianpilarczyk/Code/claude-pen/src/index.ts`

Commands follow this exact pattern:

```typescript
// 1. Import the command function
import { refine } from './commands/refine.js';

// 2. Register with commander
program
  .command('refine <draft>')
  .description('Apply editorial refinement pass to a draft')
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

**Key observations**:
- Always wrap in try-catch at entry point
- Use explicit `process.exit()` codes
- Options are passed as second parameter

### 3. Style Guide Integration

**Constant**: `STYLE_GUIDE_PATH = 'writing/_style_guide.md'`

**Pattern from draft.ts:19-29**:

```typescript
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Refinement will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}
```

**Important**: Commands gracefully handle missing style guides with warnings and fallback text.

## File Structure & Locations

### Files to Create

1. **Command Implementation**
   - Path: `/Users/adrianpilarczyk/Code/claude-pen/src/commands/refine.ts`
   - Pattern: Export async function matching command name
   - Reference: `draft.ts` is the best example (similar structure)

2. **Prompt Files** (choose one structure)

   **Option A - Flat Structure** (Recommended):
   - `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/proofread.md`
   - `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/punchier.md`
   - `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/clarity.md`

   **Option B - Subdirectory**:
   - `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/refine/proofread.md`
   - `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/refine/punchier.md`
   - `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/refine/clarity.md`

   **Recommendation**: Use Option A (flat structure) since each pass is independent and loaded by name.

### Files to Modify

1. **CLI Entry Point**
   - Path: `/Users/adrianpilarczyk/Code/claude-pen/src/index.ts`
   - Change: Add import and command registration
   - Location: After existing commands (around line 70+)

## Implementation Patterns

### 1. Import Structure

From `draft.ts:1-7`:

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getPath, readMarkdown, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';
```

**Order**: Node built-ins → npm packages → internal libs → types

### 2. Options Interface

```typescript
interface RefineOptions {
  pass?: RefinePass;  // Default: 'proofread'
}
```

### 3. Validation Pattern

From `ingest.ts:146-152`:

```typescript
const VALID_PASSES: RefinePass[] = ['proofread', 'punchier', 'clarity'];

if (!VALID_PASSES.includes(pass)) {
  console.error(chalk.red(`Invalid pass: ${pass}`));
  console.error(`Valid options: ${VALID_PASSES.join(', ')}`);
  process.exit(1);
}
```

### 4. File Validation

From `draft.ts:82-90`:

```typescript
if (!fs.existsSync(draftPath)) {
  console.error(chalk.red(`File not found: ${draftPath}`));
  process.exit(1);
}
```

### 5. Prompt Loading & Interpolation

From `draft.ts:116-121`:

```typescript
const promptTemplate = loadPrompt('proofread');  // or 'punchier', 'clarity'
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  content: content,
});
```

**How it works**:
- `loadPrompt('name')` looks for `src/prompts/name.md`
- `interpolate()` replaces `{{variable}}` with values
- User prompts in `.claude-pen/prompts/` override bundled prompts

### 6. LLM Interaction

From `draft.ts:124-135`:

```typescript
const spinner = ora(`Applying ${pass} pass...`).start();

try {
  const refined = await complete(prompt, {
    system: 'You are a skilled editor helping improve writing while preserving the author\'s unique voice.',
    maxTokens: 8000,
    silent: true,  // We're managing our own spinner
  });

  spinner.succeed(`${pass} pass complete`);
} catch (error) {
  spinner.fail(`${pass} pass failed`);
  throw error;
}
```

**Key points**:
- Use `silent: true` when managing your own spinner
- Set appropriate `maxTokens` (8000 for long-form content)
- Always terminate spinner (succeed or fail)

### 7. Output Pattern

From `draft.ts:154-165`:

```typescript
console.log(chalk.green(`\n✓ Draft updated: ${draftPath}`));
console.log(chalk.dim(`  ${newWords} words (${diffStr})`));

// Suggest next steps
const otherPasses = VALID_PASSES.filter(p => p !== pass);
console.log(chalk.dim('\nOther refinement passes:'));
for (const otherPass of otherPasses) {
  console.log(chalk.cyan(`  claude-pen refine ${draftPath} --pass ${otherPass}`));
}
console.log(chalk.dim('\nOr format for publishing:'));
console.log(chalk.cyan(`  claude-pen format ${draftPath}`));
console.log();  // Blank line at end
```

### 8. Chalk Color Conventions

- `chalk.bold()` - Headers
- `chalk.green()` - Success values
- `chalk.red()` - Errors
- `chalk.yellow()` - Warnings
- `chalk.cyan()` - Command suggestions
- `chalk.dim()` - Secondary info

## Utility Functions Available

### File Operations

**Location**: `/Users/adrianpilarczyk/Code/claude-pen/src/lib/files.ts`

```typescript
// Get path relative to project root
getPath(...segments: string[]): string

// Count words in text
countWords(text: string): number

// Read markdown with frontmatter
readMarkdown(filePath: string): { frontmatter: Record<string, unknown>, content: string }

// Write markdown with frontmatter
writeMarkdown(filePath: string, frontmatter: Record, content: string): void

// Ensure directory exists
ensureDir(dirPath: string): void
```

### Prompt Operations

**Location**: `/Users/adrianpilarczyk/Code/claude-pen/src/lib/prompts.ts`

```typescript
// Load prompt file
loadPrompt(name: string): string

// Interpolate variables
interpolate(template: string, context: Record<string, string>): string
```

### LLM Operations

**Location**: `/Users/adrianpilarczyk/Code/claude-pen/src/lib/llm.ts`

```typescript
interface LLMOptions {
  system?: string;
  maxTokens?: number;
  silent?: boolean;
}

// Complete a prompt
complete(prompt: string, options?: LLMOptions): Promise<string>
```

## Prompt Template Structure

From `draft.md:1-30`:

```markdown
You are a [role description].

## Author's Style Guide

{{style_guide}}

## Task

[Clear task description with numbered steps]

1. **Action** - Details
2. **Action** - Details

Important:
- Constraint 1
- Constraint 2

Output only the [result]. No preamble, no explanation.

## [Input Section]

{{content}}
```

## Word Count & Statistics

From `draft.ts:149-157`:

```typescript
const content = fs.readFileSync(draftPath, 'utf-8');
const originalWords = content.split(/\s+/).length;

// ... process ...

const newWords = refined.split(/\s+/).length;
const diff = newWords - originalWords;
const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

console.log(chalk.dim(`  ${newWords} words (${diffStr})`));
```

## Expected User Flow

```bash
# Create initial draft
claude-pen draft notes.md
# → writing/drafts/notes.md

# Apply refinement passes
claude-pen refine writing/drafts/notes.md --pass proofread
# Fixes: grammar, spelling, punctuation

claude-pen refine writing/drafts/notes.md --pass punchier
# Makes: tighter prose, stronger verbs

claude-pen refine writing/drafts/notes.md --pass clarity
# Improves: flow, transitions, comprehension

# Format for publishing
claude-pen format writing/drafts/notes.md
```

## File Overwrite Strategy

**Decision**: Overwrite the input file directly (git tracks history).

**Rationale from codebase**:
- No `--output` option pattern found in similar commands
- Drafts directory is version controlled
- Users can use git to see changes
- Simpler UX (no file proliferation)

## Pass Descriptions

For UX messaging:

```typescript
const PASS_DESCRIPTIONS: Record<RefinePass, string> = {
  proofread: 'Fixing grammar, spelling, and awkward phrasing',
  punchier: 'Tightening prose and strengthening impact',
  clarity: 'Improving flow and comprehension',
};
```

## Code References

**Best reference files**:
1. **Primary**: `/Users/adrianpilarczyk/Code/claude-pen/src/commands/draft.ts`
   - Similar structure (read file → load style guide → prompt → LLM → write)
   - Good error handling examples
   - Next steps pattern

2. **Secondary**: `/Users/adrianpilarczyk/Code/claude-pen/src/commands/ingest.ts`
   - Validation patterns
   - File operations

**Prompt references**:
1. `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/draft.md`
   - Shows style guide integration
   - Variable interpolation pattern

## Implementation Strategy

### Phase 1: Command Structure
1. Create `src/commands/refine.ts` with basic structure
2. Define interface and constants
3. Implement validation logic

### Phase 2: Core Logic
1. Create style guide loader (copied from draft.ts)
2. Implement file reading
3. Add prompt loading and interpolation
4. Integrate LLM completion

### Phase 3: Output & UX
1. Write refined content back to file
2. Calculate word count statistics
3. Add success messages
4. Suggest next steps

### Phase 4: Integration
1. Register command in `src/index.ts`
2. Create prompt files for each pass

### Phase 5: Prompts
1. Write `proofread.md` prompt
2. Write `punchier.md` prompt
3. Write `clarity.md` prompt

## Success Criteria

### Type Checking
```bash
bun run typecheck
```
Should pass with no errors.

### Help Output
```bash
bun run src/index.ts refine --help
```
Should display command description and options.

### Valid Execution
```bash
bun run src/index.ts refine drafts/test.md --pass proofread
```
Should:
- Read file
- Load style guide (or warn if missing)
- Apply refinement
- Overwrite file
- Show word count diff
- Suggest next steps

### Error Handling
```bash
# Invalid pass
bun run src/index.ts refine drafts/test.md --pass invalid
# → Error: Invalid pass with valid options list

# Missing file
bun run src/index.ts refine drafts/nonexistent.md
# → Error: File not found
```

## Recommendations

1. **Use flat prompt structure** (`src/prompts/proofread.md` not `src/prompts/refine/proofread.md`)
2. **Follow draft.ts patterns exactly** - it's the closest reference
3. **Default to 'proofread' pass** - most commonly used
4. **Overwrite files directly** - simpler UX, git provides history
5. **Keep prompts focused** - each pass should have a single, clear purpose
6. **Test with real content** - ensure prompts preserve voice effectively

## Potential Concerns

1. **Style guide dependency**: Command works without it but warns user
2. **Large files**: 8000 max_tokens should handle most drafts (≈32k chars)
3. **Multiple passes**: Users may run sequentially - each should preserve previous improvements
4. **Voice preservation**: Critical requirement - prompts must emphasize maintaining style

## Next Steps

After this research:
1. ✓ Understand codebase patterns
2. → Create implementation plan (use `/2_create_plan`)
3. → Implement command phase by phase
4. → Validate against success criteria
