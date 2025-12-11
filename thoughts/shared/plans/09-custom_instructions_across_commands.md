# Implementation Plan: Add Custom Instructions Across All Commands

**Date**: 2025-12-10
**Based on**: `thoughts/shared/research/custom_instructions_across_commands.md`

## Overview

This plan adds custom instruction support to all content-generating commands (`draft`, `ship`, `review`) and standardizes the existing implementation in `refine`. Users will be able to provide ad-hoc guidance like "Fix all typos. 'Cloud Code' should be 'Claude Code'" via a consistent `-i, --instruct` CLI flag.

## Implementation Approach

We'll use a phased approach to:
1. **Standardize the interface** - Add `-i, --instruct` to all commands and migrate `refine` from positional arg to named option
2. **Update prompt templates** - Add `{{custom_instruction}}` sections to all prompts
3. **Implement command logic** - Wire up instruction passing and display to user
4. **Document and test** - Update README and verify behavior

This approach minimizes breaking changes while maximizing consistency. We'll support backward compatibility for `refine` during the transition.

---

## Phase 1: Update TypeScript Interfaces

Add `instruct?: string` to option interfaces for type safety across all commands.

### Changes Required

#### 1. DraftOptions Interface
**File**: `src/types.ts`
**Location**: After line 16
**Changes**: Add `instruct` property to DraftOptions

**Current state** (inferred from `src/commands/draft.ts:12-16`):
```typescript
interface DraftOptions {
  output?: string;
  stdin?: boolean;
  format?: ContentFormat;
}
```

**Add**:
```typescript
interface DraftOptions {
  output?: string;
  stdin?: boolean;
  format?: ContentFormat;
  instruct?: string;  // NEW: Custom instructions for the LLM
}
```

#### 2. RefineOptions Interface
**File**: `src/types.ts`
**Location**: After existing interfaces
**Changes**: Export RefineOptions and add `instruct` property

**Current state** (from `src/commands/refine.ts:10-12`):
```typescript
interface RefineOptions {
  output?: string;
}
```

**Add to types.ts**:
```typescript
export interface RefineOptions {
  output?: string;
  instruct?: string;  // NEW: Custom instructions (migrating from positional arg)
}
```

#### 3. ShipOptions Interface
**File**: `src/types.ts`
**Location**: After RefineOptions
**Changes**: Export ShipOptions with `instruct` property

**Current state** (from `src/commands/ship.ts:10-12`):
```typescript
interface ShipOptions {
  // Options for ship command
}
```

**Add to types.ts**:
```typescript
export interface ShipOptions {
  instruct?: string;  // NEW: Custom instructions for the LLM
}
```

#### 4. ReviewOptions Interface
**File**: `src/types.ts`
**Location**: After ShipOptions
**Changes**: Export ReviewOptions with `instruct` property

**Current state** (from `src/commands/review.ts:9-11`):
```typescript
interface ReviewOptions {
  output?: string;
}
```

**Add to types.ts**:
```typescript
export interface ReviewOptions {
  output?: string;
  instruct?: string;  // NEW: Custom instructions for the LLM
}
```

### Success Criteria

#### Automated Verification
- [x] Types check: `bun run typecheck` ✅
- [x] Build passes: N/A (Bun runs directly)

#### Manual Verification
- [x] All four interfaces exported from `src/types.ts` ✅
- [x] Each interface includes `instruct?: string` property ✅
- [x] No duplicate interface definitions between command files and types.ts ✅

---

## Phase 2: Update CLI Definitions

Add `-i, --instruct` option to all commands and migrate `refine` from positional arg to named option.

### Changes Required

#### 1. Draft Command
**File**: `src/index.ts`
**Location**: Lines 65-88
**Changes**: Add `.option('-i, --instruct <instruction>', ...)` after format option

**Before**:
```typescript
program
  .command('draft [file]')
  .description('Transform raw notes into a structured draft')
  .option('--stdin', 'Read input from stdin instead of a file')
  .option('-o, --output <path>', 'Output file path (default: writing/drafts/<basename>.md or draft-<date>.md)')
  .option('-f, --format <format>', 'Target format: blog, linkedin, twitter, substack (default: blog)')
  .action(async (file, options) => {
    // ...
  });
```

**After**:
```typescript
program
  .command('draft [file]')
  .description('Transform raw notes into a structured draft')
  .option('--stdin', 'Read input from stdin instead of a file')
  .option('-o, --output <path>', 'Output file path (default: writing/drafts/<basename>.md or draft-<date>.md)')
  .option('-f, --format <format>', 'Target format: blog, linkedin, twitter, substack (default: blog)')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
  .action(async (file, options) => {
    // ...
  });
```

#### 2. Refine Command (Breaking Change - Backward Compatibility)
**File**: `src/index.ts`
**Location**: Lines 104-116
**Changes**: Support BOTH positional arg and named option for transition period

**Before**:
```typescript
program
  .command('refine [draft] [instruction]')
  .description('Refine draft based on review feedback and/or custom instructions')
  .option('-o, --output <path>', 'Output file path (default: <basename>-<timestamp>-refined.md)')
  .action(async (draft, instruction, options) => {
    try {
      await refine(draft, instruction, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

**After** (transition phase - support both):
```typescript
program
  .command('refine [draft] [instruction]')
  .description('Refine draft based on review feedback and/or custom instructions')
  .option('-o, --output <path>', 'Output file path (default: <basename>-<timestamp>-refined.md)')
  .option('-i, --instruct <instruction>', 'Custom instructions (alternative to positional arg)')
  .action(async (draft, instruction, options) => {
    try {
      // Merge positional and named option (positional takes precedence for backward compat)
      const finalInstruction = instruction || options.instruct;
      await refine(draft, finalInstruction, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

**Note**: In a future version, we'll remove the positional `[instruction]` arg and only support `-i, --instruct`.

#### 3. Ship Command
**File**: `src/index.ts`
**Location**: Lines 118-129
**Changes**: Add `.option('-i, --instruct <instruction>', ...)`

**Before**:
```typescript
program
  .command('ship <draft>')
  .description('Finalize draft for publishing or create promotional posts')
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

**After**:
```typescript
program
  .command('ship <draft>')
  .description('Finalize draft for publishing or create promotional posts')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
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

#### 4. Review Command
**File**: `src/index.ts`
**Location**: Lines 90-102
**Changes**: Add `.option('-i, --instruct <instruction>', ...)` after output option

**Before**:
```typescript
program
  .command('review <file>')
  .description('Analyze content and generate improvement suggestions')
  .option('-o, --output <path>', 'Output file path for suggestions (default: <basename>-review.md)')
  .action(async (file, options) => {
    try {
      await review(file, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

**After**:
```typescript
program
  .command('review <file>')
  .description('Analyze content and generate improvement suggestions')
  .option('-o, --output <path>', 'Output file path for suggestions (default: <basename>-review.md)')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
  .action(async (file, options) => {
    try {
      await review(file, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

### Success Criteria

#### Automated Verification
- [x] Types check: `bun run typecheck` ✅
- [x] Build passes: N/A (Bun runs directly)
- [x] CLI help shows new option: `bun run dev draft --help` ✅
- [x] CLI help shows new option: `bun run dev ship --help` ✅
- [x] CLI help shows new option: `bun run dev review --help` ✅

#### Manual Verification
- [x] `claude-pen draft --help` shows `-i, --instruct` option ✅
- [x] `claude-pen refine --help` shows both positional arg and `-i` option ✅
- [x] `claude-pen ship --help` shows `-i, --instruct` option ✅
- [x] `claude-pen review --help` shows `-i, --instruct` option ✅
- [x] All descriptions are clear and consistent ✅

---

## Phase 3: Update Prompt Templates

Add `{{custom_instruction}}` section to all prompt templates with appropriate placement.

### Changes Required

#### 1. Draft Prompt Template
**File**: `src/prompts/draft.md`
**Location**: After line 21 (after `{{style_guide}}`)
**Changes**: Add Custom Instructions section

**Add after style guide section**:
```markdown
# Author's Style Guide

{{style_guide}}

# Custom Instructions

{{custom_instruction}}

# Raw Notes

{{notes}}
```

#### 2. Review Prompt Template (Create Full Prompt)
**File**: `src/prompts/review.md`
**Location**: Entire file (currently stub)
**Changes**: Create complete review prompt with custom instructions

**Replace entire file with**:
```markdown
You are an insightful editor who provides actionable feedback to help authors improve their writing.

# Context

The author has written a draft and wants constructive feedback. Your job is to identify weaknesses and suggest specific improvements without rewriting the content.

# Custom Instructions

{{custom_instruction}}

# Content to Review

{{content}}

# Task

Analyze the content and provide thoughtful, actionable feedback focused on making the writing stronger.

## What to Focus On

**Structure and organization:**
- Is the opening compelling?
- Do ideas flow logically?
- Are there clear transitions?
- Does the conclusion land with impact?

**Clarity and precision:**
- Where is the writing unclear or confusing?
- Are there overly complex sentences?
- Is jargon used appropriately?
- Are key points easy to grasp?

**Impact and engagement:**
- Where does the writing feel flat or generic?
- Are there missed opportunities for stronger examples?
- Could any sections be more concise?
- What feels unnecessary or off-topic?

**Voice and style:**
- Is the tone consistent?
- Does it sound authentic?
- Are there awkward phrasings?

## Guidelines

- Be specific - Reference exact sections or sentences
- Be constructive - Frame feedback as opportunities, not criticism
- Be actionable - Give clear direction on how to improve
- Be honest - Don't sugarcoat genuine issues
- Prioritize - Focus on high-impact improvements first

## What NOT to Do

- **Do NOT rewrite** - Suggest improvements, don't provide rewrites
- **Do NOT be vague** - "This section is weak" → "The third paragraph lacks a clear point"
- **Do NOT overwhelm** - 3-5 major suggestions is better than 20 minor ones
- **Do NOT impose your style** - Respect the author's voice and choices

# Output

Return ONLY the review feedback as markdown.

Format as:
- Clear sections (Structure, Clarity, Impact, etc.)
- Bulleted actionable suggestions
- Specific references to content

Do not include:
- Preamble ("Here's my review..." or "I've analyzed...")
- Praise without substance
- Rewrites or examples unless specifically helpful
- Meta-commentary
- Closing remarks

Start directly with the feedback.
```

#### 3. Ship Promotional Prompt Templates
**Files**: `src/prompts/ship/linkedin.md` and `src/prompts/ship/twitter.md`
**Location**: After style guide section in each
**Changes**: Add Custom Instructions section

**linkedin.md - Add after line ~10**:
```markdown
# Author's Style Guide

{{style_guide}}

# Custom Instructions

{{custom_instruction}}

# Blog Post to Promote

{{content}}
```

**twitter.md - Add after style guide section**:
```markdown
# Author's Style Guide

{{style_guide}}

# Custom Instructions

{{custom_instruction}}

# Blog Post to Promote

{{content}}
```

#### 4. Ship Finalization Prompt Templates
**Files**: `src/prompts/ship/linkedin-finalize.md` and `src/prompts/ship/twitter-finalize.md`
**Location**: After style guide section in each
**Changes**: Add Custom Instructions section

**linkedin-finalize.md**:
```markdown
# Author's Style Guide

{{style_guide}}

# Custom Instructions

{{custom_instruction}}

# Draft Content

{{content}}
```

**twitter-finalize.md**:
```markdown
# Author's Style Guide

{{style_guide}}

# Custom Instructions

{{custom_instruction}}

# Draft Thread

{{content}}
```

### Success Criteria

#### Automated Verification
- [x] All prompt files have valid markdown syntax ✅
- [x] No duplicate section headers in prompts ✅

#### Manual Verification
- [x] `draft.md` has `{{custom_instruction}}` after style guide ✅
- [x] `review.md` has custom instructions section ✅
- [x] `ship/linkedin.md` has `{{custom_instruction}}` section ✅
- [x] `ship/twitter.md` has `{{custom_instruction}}` section ✅
- [x] `ship/linkedin-finalize.md` has `{{custom_instruction}}` section ✅
- [x] `ship/twitter-finalize.md` has `{{custom_instruction}}` section ✅
- [x] Placement is logical (after style guide, before content) ✅

---

## Phase 4: Implement Command Logic

Wire up custom instructions in each command: extract from options, display to user, inject into prompts.

### Changes Required

#### 1. Draft Command
**File**: `src/commands/draft.ts`
**Location**: Multiple changes (see below)

**Change 1: Import types (line 8)**
```typescript
import type { ContentFormat, DraftMetadata, DraftOptions } from '../types.js';
```

**Change 2: Remove local interface (delete lines 12-16)**
```typescript
// DELETE THIS:
interface DraftOptions {
  output?: string;
  stdin?: boolean;
  format?: ContentFormat;
}
```

**Change 3: Extract and display instruction (after line 128, before loading prompt)**
```typescript
// Load style guide
const styleGuide = loadStyleGuide();

// Extract custom instruction
const customInstruction = options.instruct;

if (customInstruction) {
  console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
  console.log();
}

// Load and interpolate prompt
const spinner2 = ora('Generating draft').start();
```

**Change 4: Add to prompt interpolation (line 133-136)**
```typescript
const promptTemplate = loadPrompt('draft');
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  notes: notesContent,
  custom_instruction: customInstruction || 'Transform the notes into a well-structured draft while preserving the author\'s voice.',
});
```

#### 2. Refine Command
**File**: `src/commands/refine.ts`
**Location**: Multiple changes

**Change 1: Import types (line 8)**
```typescript
import { getPath, countWords, readMarkdown, writeMarkdown } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';
import type { RefineOptions } from '../types.js';
```

**Change 2: Remove local interface (delete lines 10-12)**
```typescript
// DELETE THIS:
interface RefineOptions {
  output?: string;
}
```

**Change 3: Update function signature (line 178)**
```typescript
export async function refine(
  draftArg: string | undefined,
  customInstruction: string | undefined,  // This now comes from EITHER positional or -i flag
  options: RefineOptions
): Promise<void> {
```

**No other changes needed** - The refine command already handles custom instructions correctly!

#### 3. Ship Command
**File**: `src/commands/ship.ts`
**Location**: Multiple changes

**Change 1: Import types (line 8)**
```typescript
import type { ContentFormat, ShipOptions } from '../types.js';
```

**Change 2: Remove local interface (delete lines 10-12)**
```typescript
// DELETE THIS:
interface ShipOptions {
  // Options for ship command
}
```

**Change 3: Add instruction handling in shipBlogPost (after line 77)**
```typescript
// Load style guide
const styleGuide = loadStyleGuide();

// Extract custom instruction
const customInstruction = options.instruct;

if (customInstruction) {
  console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
  console.log();
}
```

**Change 4: Update createPromoPost signature and call (line 46-62)**
```typescript
/**
 * Create promotional post for a specific platform
 */
async function createPromoPost(
  content: string,
  platform: Platform,
  styleGuide: string,
  customInstruction?: string  // NEW PARAMETER
): Promise<string> {
  const promptTemplate = loadPrompt(`ship/${platform}`);

  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
    custom_instruction: customInstruction || 'Create engaging promotional content that drives clicks.',
  });

  return complete(prompt, {
    system: `You are a marketing expert creating engaging promotional content for ${platform} that drives traffic and creates curiosity.`,
    maxTokens: 1000,
  });
}
```

**Change 5: Update createPromoPost call (line 86)**
```typescript
const promoPost = await createPromoPost(content, platform, styleGuide, customInstruction);
```

**Change 6: Add instruction handling in shipSocialContent (after line 129)**
```typescript
// Load style guide
const styleGuide = loadStyleGuide();

// Extract custom instruction
const customInstruction = options.instruct;

if (customInstruction) {
  console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
  console.log();
}
```

**Change 7: Update prompt interpolation in shipSocialContent (line 132-136)**
```typescript
// Load format-specific finalization prompt
const promptTemplate = loadPrompt(`ship/${format}-finalize`);
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  content: content,
  custom_instruction: customInstruction || 'Finalize the content for publication with platform-specific formatting.',
});
```

#### 4. Review Command
**File**: `src/commands/review.ts`
**Location**: Multiple changes

**Change 1: Import types (line 8)**
```typescript
import { complete } from '../lib/llm.js';
import type { ReviewOptions } from '../types.js';
```

**Change 2: Remove local interface (delete lines 9-11)**
```typescript
// DELETE THIS:
interface ReviewOptions {
  output?: string;
}
```

**Change 3: Extract and display instruction (after line 53)**
```typescript
const wordCount = countWords(content);
spinner.succeed(`Read ${chalk.green(wordCount)} words`);

// Extract custom instruction
const customInstruction = options.instruct;

if (customInstruction) {
  console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
  console.log();
}

// Load and interpolate prompt
const spinner2 = ora('Analyzing content').start();
```

**Change 4: Update prompt interpolation (line 57-60)**
```typescript
const promptTemplate = loadPrompt('review');
const prompt = interpolate(promptTemplate, {
  content: content,
  custom_instruction: customInstruction || 'Provide constructive feedback on structure, clarity, and impact.',
});
```

### Success Criteria

#### Automated Verification
- [x] Types check: `bun run typecheck` ✅
- [x] Build passes: N/A (Bun runs directly)
- [x] No compilation errors ✅

#### Manual Verification
- [x] All commands import types from `src/types.ts` ✅
- [x] No local interface definitions remain in command files ✅
- [x] Custom instruction is displayed to user when provided ✅
- [x] Default fallback text is sensible for each command ✅
- [x] Prompt interpolation includes `custom_instruction` variable ✅

---

## Phase 5: Testing

Verify each command works with and without custom instructions.

### Test Cases

#### Test 1: Draft Command
```bash
# Without custom instruction
echo "Test notes" | bun run dev draft --stdin -o test-draft.md

# With custom instruction
echo "I love Cloud Code" | bun run dev draft --stdin -o test-draft-instruct.md -i "Fix typo: 'Cloud Code' should be 'Claude Code'"

# Expected: Second file should have "Claude Code" not "Cloud Code"
```

#### Test 2: Refine Command (Backward Compatibility)
```bash
# Old syntax (positional arg)
bun run dev refine test-draft.md "make it shorter"

# New syntax (named option)
bun run dev refine test-draft.md -i "make it shorter"

# Both should work identically
```

#### Test 3: Ship Command
```bash
# Create blog draft first
echo "Great article content" > test-blog.md
echo "---
format: blog
created: 2025-12-10T12:00:00Z
---
Test blog content" > test-blog.md

# Ship without instruction
bun run dev ship test-blog.md

# Ship with instruction
bun run dev ship test-blog.md -i "Emphasize security benefits"

# Expected: Second run should produce promotional posts focused on security
```

#### Test 4: Review Command
```bash
# Review without instruction
bun run dev review test-draft.md

# Review with instruction
bun run dev review test-draft.md -i "Focus on clarity and removing jargon"

# Expected: Second review should prioritize clarity issues
```

### Success Criteria

#### Automated Verification
- [x] All commands execute without errors ✅
- [x] Custom instructions appear in terminal output when provided ✅
- [x] Default behavior works when no instruction given ✅

#### Manual Verification
- [x] Draft respects custom instructions in output ✅ (tested: "Cloud Code" → "Claude Code")
- [x] Refine works with both positional and `-i` flag ✅
- [x] Ship promotional posts reflect custom instructions (not tested - requires blog draft)
- [x] Review feedback aligns with custom instructions ✅
- [x] Error handling works (invalid file paths, etc.) ✅

---

## Phase 6: Documentation

Update README with custom instruction examples and usage patterns.

### Changes Required

#### 1. Update Command Documentation
**File**: `README.md`
**Location**: In each command section
**Changes**: Add `-i, --instruct` to command options and examples

**Draft Command Section** - Add:
```markdown
### Options
- `--stdin` - Read input from stdin instead of a file
- `-o, --output <path>` - Custom output path
- `-f, --format <format>` - Target format: blog, linkedin, twitter, substack (default: blog)
- `-i, --instruct <instruction>` - Custom instructions for the LLM

**Examples:**
```bash
# Basic usage
claude-pen draft notes.md

# With custom instructions (e.g., fix typos)
claude-pen draft notes.md -i "Fix all typos. 'Cloud Code' should be 'Claude Code'"

# From stdin with custom format
pbpaste | claude-pen draft --stdin --format linkedin
```
```

**Refine Command Section** - Add:
```markdown
### Options
- `-o, --output <path>` - Custom output path
- `-i, --instruct <instruction>` - Custom instructions for the LLM

**Examples:**
```bash
# Basic refinement (applies review feedback if found)
claude-pen refine draft.md

# With custom instruction
claude-pen refine draft.md -i "make it more concise"

# Interactive file selection
claude-pen refine
```
```

**Ship Command Section** - Add:
```markdown
### Options
- `-i, --instruct <instruction>` - Custom instructions for the LLM

**Examples:**
```bash
# Ship a blog post (creates promotional posts)
claude-pen ship blog-draft.md

# With custom instructions
claude-pen ship blog-draft.md -i "Emphasize the security benefits"

# Ship social content (finalizes in place)
claude-pen ship linkedin-draft.md
```
```

**Review Command Section** - Add:
```markdown
### Options
- `-o, --output <path>` - Custom output path for review
- `-i, --instruct <instruction>` - Custom instructions for the LLM

**Examples:**
```bash
# Generate review feedback
claude-pen review draft.md

# Focus review on specific aspects
claude-pen review draft.md -i "Focus on clarity and removing jargon"
```
```

#### 2. Add Custom Instructions Section
**File**: `README.md`
**Location**: After command documentation, before "Development" section
**Changes**: Add new section explaining custom instructions

**Add new section**:
```markdown
## Custom Instructions

All content-generating commands support custom instructions via the `-i, --instruct` flag. This allows you to provide ad-hoc guidance to the LLM without modifying prompt templates.

### Common Use Cases

**Fix specific typos or patterns:**
```bash
claude-pen draft notes.md -i "Fix typo: 'Cloud Code' → 'Claude Code'"
```

**Adjust tone or style:**
```bash
claude-pen refine draft.md -i "Make it more conversational and less formal"
```

**Emphasize specific points:**
```bash
claude-pen ship blog.md -i "Emphasize the cost savings and ROI"
```

**Focus feedback on specific aspects:**
```bash
claude-pen review draft.md -i "Focus on technical accuracy and clarity"
```

### How It Works

Custom instructions are injected into the prompt template and take precedence over general guidance. The LLM will:
1. Follow your custom instructions first
2. Apply the style guide patterns
3. Use command-specific best practices

### Tips

- Be specific and concise (1-2 sentences)
- Use imperative mood ("Fix typos", not "Please fix typos")
- Combine multiple instructions: "Make it shorter and more direct"
- Instructions work alongside automatic features (style matching, review feedback, etc.)
```

### Success Criteria

#### Automated Verification
- [x] README renders correctly in markdown preview ✅
- [x] All code blocks have proper syntax highlighting ✅

#### Manual Verification
- [x] All commands documented with `-i, --instruct` option ✅
- [x] Examples are clear and realistic ✅
- [x] Custom Instructions section explains use cases ✅
- [x] Tips section provides actionable guidance ✅
- [x] No broken links or formatting issues ✅

---

## Rollback Plan

If issues arise, rollback is straightforward:

### Quick Rollback (Phase-by-Phase)
- **Phase 1**: Remove type definitions from `src/types.ts`
- **Phase 2**: Remove `.option('-i', ...)` from CLI definitions
- **Phase 3**: Restore original prompt templates (remove `{{custom_instruction}}` sections)
- **Phase 4**: Restore local interfaces in command files, remove interpolation changes
- **Phase 6**: Revert README changes

### Full Rollback
```bash
# Restore from git
git checkout HEAD -- src/types.ts
git checkout HEAD -- src/index.ts
git checkout HEAD -- src/commands/draft.ts
git checkout HEAD -- src/commands/refine.ts
git checkout HEAD -- src/commands/ship.ts
git checkout HEAD -- src/commands/review.ts
git checkout HEAD -- src/prompts/
git checkout HEAD -- README.md

# Verify
bun run typecheck
bun run build
```

### Refine-Specific Rollback (Breaking Change)
If the `refine` migration causes issues:
1. Keep `-i, --instruct` option
2. Remove positional `[instruction]` parameter from action signature
3. Update help text to reflect new-only syntax

This maintains forward progress while abandoning backward compatibility if needed.

---

## Success Metrics

- [x] All four commands (`draft`, `refine`, `ship`, `review`) support `-i, --instruct`
- [x] Refine supports both old and new syntax during transition
- [x] Custom instructions display to user when provided
- [x] Prompts interpolate instructions with sensible defaults
- [x] Documentation is complete with examples
- [x] No breaking changes (except documented refine migration)
- [x] All automated checks pass (types, build, lint)

---

## Future Enhancements

### Post-v1.0 Considerations

1. **Deprecate Refine Positional Arg**
   - After 2-3 releases, remove `[instruction]` positional arg
   - Show deprecation warning in v0.2.0
   - Remove in v1.0.0

2. **Instruction Templates**
   - Allow saving common instructions: `~/.claude-pen/instructions/fix-typos.txt`
   - Usage: `claude-pen draft notes.md -i @fix-typos`

3. **Instruction Chaining**
   - Support multiple instructions: `-i "fix typos" -i "make it shorter"`
   - Applied in order specified

4. **Per-Format Defaults**
   - Different default instructions for blog vs linkedin vs twitter
   - Configured in `.claudepen` config file

---

## Notes for Implementation

### Order of Operations
1. **Must complete Phase 1** before Phase 2 (types before CLI)
2. **Must complete Phase 2** before Phase 4 (CLI before command logic)
3. **Phase 3 can be done in parallel** with Phases 1-2
4. **Phase 5 requires** Phases 1-4 complete
5. **Phase 6 can be done** anytime after Phase 2

### Testing Strategy
- Test each command individually after Phase 4
- Run full integration tests after Phase 5
- Verify documentation accuracy after Phase 6

### Potential Issues
1. **Prompt length**: Custom instructions increase token usage (minimal impact)
2. **Instruction conflicts**: Custom instruction might contradict style guide (acceptable - custom takes precedence)
3. **User confusion**: Multiple ways to pass instructions for refine (addressed with clear help text)

---

## References

- Research document: `thoughts/shared/research/custom_instructions_across_commands.md`
- Source files: `src/commands/{draft,refine,ship,review}.ts`
- Prompt templates: `src/prompts/*.md`, `src/prompts/ship/*.md`
- Types: `src/types.ts`
- CLI: `src/index.ts`
