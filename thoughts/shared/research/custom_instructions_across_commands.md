# Research: Adding Custom Instructions Across All Commands

**Date**: 2025-12-10
**Researcher**: Claude Code
**Purpose**: Understand how the `refine` command implements custom instructions and design a consistent approach for adding this feature to all commands.

---

## Overview

The `refine` command currently supports custom instructions via a positional CLI argument, allowing users to provide ad-hoc guidance like "fix all typos" or "make it more concise." This research explores the implementation and identifies how to extend this capability to all commands (`draft`, `ship`, `review`, `analyze`).

---

## Current Implementation: Refine Command

### CLI Definition

**File**: `src/index.ts:105-116`

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

**Usage**: `claude-pen refine <file> "your custom instruction"`

### Function Signature

**File**: `src/commands/refine.ts:178-182`

```typescript
export async function refine(
  draftArg: string | undefined,
  customInstruction: string | undefined,
  options: RefineOptions
): Promise<void>
```

### Prompt Integration

**File**: `src/commands/refine.ts:223-229`

```typescript
const promptTemplate = loadPrompt('refine');
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  content: content,
  review_feedback: reviewFeedback || 'No review feedback available.',
  custom_instruction: customInstruction || 'Apply general improvements to enhance clarity, flow, and impact.',
});
```

**Key Pattern**: Custom instruction gets injected via `{{custom_instruction}}` placeholder with fallback to default improvement text.

### Prompt Template

**File**: `src/prompts/refine.md:20-22`

```markdown
# Custom Instructions

{{custom_instruction}}
```

The prompt explicitly includes a section for custom instructions, making them a first-class part of the refinement task.

---

## Command Inventory

### Commands That Should Receive Custom Instructions

| Command | Purpose | Current Options | Custom Instruction Use Case |
|---------|---------|-----------------|----------------------------|
| **draft** | Transform notes into structured draft | `--format`, `--stdin`, `--output` | "Fix typos like 'Cloud Code' → 'Claude Code'" |
| **refine** | Improve draft with feedback | `--output` | ✅ **Already implemented** |
| **ship** | Finalize or create promotional posts | None | "Emphasize the security benefits" |
| **review** | Generate improvement suggestions | `--output` | "Focus on clarity and conciseness" |

### Commands That Don't Need Custom Instructions

| Command | Reason |
|---------|--------|
| **analyze** | Fully automated style guide generation from samples |
| **ingest** | Batch metadata extraction (no creative output) |
| **init** | Setup command (no content generation) |
| **clean** | Utility command (deletes drafts) |

---

## Prompt Architecture Analysis

### Pattern: Mustache-Style Variable Interpolation

All commands follow this consistent pattern:

1. **Load Prompt Template**: `loadPrompt('command-name')`
2. **Interpolate Variables**: `interpolate(template, { variable: value })`
3. **Send to LLM**: `complete(prompt, { system, maxTokens })`

**File**: `src/lib/prompts.ts:58-68`

```typescript
export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    return context[key] ?? match;
  });
}
```

**Key Insight**: The system already supports arbitrary variable injection. Adding custom instructions is just:
1. Add CLI option/argument
2. Pass to function
3. Inject via `{{custom_instruction}}` placeholder
4. Update prompt template

---

## Existing Command Prompt Variables

| Command | Current Variables | Potential Custom Instruction Injection Point |
|---------|-------------------|----------------------------------------------|
| **draft** | `style_guide`, `notes` | After style guide, before notes |
| **refine** | `style_guide`, `content`, `review_feedback`, `custom_instruction` | ✅ Already has dedicated section |
| **ship** (promo) | `style_guide`, `content` | After style guide, before content |
| **ship** (finalize) | `style_guide`, `content` | After style guide, before content |
| **review** | Currently stub prompt | Would need custom_instruction added |

---

## Design Considerations

### 1. CLI Interface Design

**Option 1: Positional Argument (Current Refine Pattern)**
```bash
claude-pen draft notes.md "fix typos"
claude-pen ship draft.md "emphasize security"
```

**Pros**:
- Quick to type
- Natural for single instructions
- Consistent with refine

**Cons**:
- Less discoverable
- Can't be easily combined with other positional args
- Harder to make optional when file selection is also optional

**Option 2: Named Option Flag**
```bash
claude-pen draft notes.md --instruct "fix typos"
claude-pen ship draft.md -i "emphasize security"
```

**Pros**:
- More discoverable (shows in --help)
- Works with any argument order
- Can be made optional easily
- Clear what the string represents

**Cons**:
- More verbose
- Inconsistent with current refine implementation

**Recommendation**: Use **Option 2 (named flag)** for new commands, and **migrate refine** to the same pattern for consistency. Use `-i, --instruct <instruction>` as the standard flag.

### 2. Fallback Behavior

When no custom instruction is provided, each command should have a sensible default:

| Command | Default Behavior (No Custom Instruction) |
|---------|------------------------------------------|
| **draft** | "Transform the notes into a well-structured draft while preserving the author's voice." |
| **refine** | "Apply general improvements to enhance clarity, flow, and impact." (current) |
| **ship** (promo) | "Create engaging promotional content that drives clicks." |
| **ship** (finalize) | "Finalize the content for publication with platform-specific formatting." |
| **review** | "Provide constructive feedback on structure, clarity, and impact." |

### 3. Prompt Template Updates

Each prompt template needs a dedicated section:

```markdown
# Custom Instructions

{{custom_instruction}}
```

**Placement**: After style guide and context, before the main content/task.

---

## File Changes Required

### 1. CLI Definitions (`src/index.ts`)

**Lines to modify**:
- Draft command: ~89-102
- Refine command: ~105-116 (migrate to named option)
- Ship command: ~119-130
- Review command: ~133-144

**Pattern**:
```typescript
.option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
```

### 2. Command Implementations

| File | Function Signature Update | Prompt Variable Update |
|------|---------------------------|------------------------|
| `src/commands/draft.ts` | Add `instruction?: string` param | Add `custom_instruction: instruction \|\| 'default'` |
| `src/commands/refine.ts` | Change positional arg to option | Update to read from `options.instruct` |
| `src/commands/ship.ts` | Add `instruction?: string` param | Add `custom_instruction` to both promo and finalize |
| `src/commands/review.ts` | Add `instruction?: string` param | Add `custom_instruction` to interpolation |

### 3. Prompt Templates

| File | Update Required |
|------|-----------------|
| `src/prompts/draft.md` | Add `{{custom_instruction}}` section after style guide |
| `src/prompts/refine.md` | ✅ Already has it |
| `src/prompts/ship/linkedin.md` | Add `{{custom_instruction}}` section |
| `src/prompts/ship/twitter.md` | Add `{{custom_instruction}}` section |
| `src/prompts/ship/linkedin-finalize.md` | Add `{{custom_instruction}}` section |
| `src/prompts/ship/twitter-finalize.md` | Add `{{custom_instruction}}` section |
| `src/prompts/review.md` | Add `{{custom_instruction}}` section |

### 4. TypeScript Interfaces

**File**: `src/types.ts`

Need to add `instruct?: string` to option interfaces:
- `DraftOptions`
- `RefineOptions`
- `ShipOptions`
- `ReviewOptions`

---

## Example Scenarios

### Use Case 1: Typo Correction in Draft

```bash
claude-pen draft notes.md -i "Fix all typos. 'Cloud Code' should be 'Claude Code'"
```

**Impact**: The draft prompt will include this instruction, ensuring the LLM corrects this specific typo pattern.

### Use Case 2: Emphasize Specific Angle in Ship

```bash
claude-pen ship blog-post.md -i "Emphasize the security and privacy benefits"
```

**Impact**: Promotional posts will focus on security/privacy messaging rather than generic benefits.

### Use Case 3: Focus Review on Specific Aspect

```bash
claude-pen review draft.md -i "Focus on clarity and removing jargon"
```

**Impact**: Review feedback will prioritize clarity issues over other potential improvements.

---

## Architecture Patterns to Follow

### 1. Consistent Variable Naming

Use `custom_instruction` (with underscore) in code and `customInstruction` in camelCase for TypeScript variables.

### 2. User Notification

Display custom instruction to user for transparency:

```typescript
if (customInstruction) {
  console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
}
```

### 3. Graceful Degradation

Always provide a sensible default if no instruction is given:

```typescript
custom_instruction: customInstruction || 'Apply general improvements to enhance clarity, flow, and impact.'
```

### 4. Prompt Section Placement

```markdown
# Author's Style Guide
{{style_guide}}

# Custom Instructions
{{custom_instruction}}

# Content/Notes/Task
{{content}}
```

---

## Recommendations

### Phase 1: Standardize the Interface
1. **Migrate refine** from positional arg to `-i, --instruct` option
2. Add `-i, --instruct` to **draft**, **ship**, and **review** commands
3. Update TypeScript interfaces in `src/types.ts`

### Phase 2: Update Prompts
1. Add `{{custom_instruction}}` sections to all prompt templates
2. Write default fallback text for each command
3. Test prompt interpolation

### Phase 3: Implement Command Logic
1. Update each command function to accept and pass custom instruction
2. Add user notification (display instruction if provided)
3. Update interpolation calls

### Phase 4: Documentation & Testing
1. Update README with custom instruction examples
2. Test each command with and without custom instructions
3. Verify fallback behavior

---

## Code Examples

### Draft Command Pattern

```typescript
// src/index.ts
program
  .command('draft [file]')
  .description('Create structured draft from raw notes')
  .option('--stdin', 'Read input from stdin')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Target format: blog, linkedin, twitter, substack', 'blog')
  .option('-i, --instruct <instruction>', 'Custom instructions for the LLM')
  .action(async (file, options) => {
    try {
      await draft(file, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

// src/commands/draft.ts
export async function draft(
  fileArg: string | undefined,
  options: DraftOptions
): Promise<void> {
  // ... existing code ...

  const customInstruction = options.instruct;

  if (customInstruction) {
    console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
  }

  const promptTemplate = loadPrompt('draft');
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    notes: notesContent,
    custom_instruction: customInstruction || 'Transform the notes into a well-structured draft while preserving the author\'s voice.',
  });

  // ... rest of implementation ...
}
```

### Ship Command Pattern

```typescript
// src/commands/ship.ts (promotional branch)
const customInstruction = options.instruct;

if (customInstruction) {
  console.log(chalk.dim(`   💬 Custom instruction: "${customInstruction}"`));
}

for (const platform of ['linkedin', 'twitter']) {
  const promptTemplate = loadPrompt(`ship/${platform}`);
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
    custom_instruction: customInstruction || 'Create engaging promotional content that drives clicks.',
  });

  // ... rest of implementation ...
}
```

---

## Success Criteria

✅ All content-generating commands (`draft`, `refine`, `ship`, `review`) support custom instructions
✅ Consistent CLI interface: `-i, --instruct <instruction>`
✅ User-friendly: Instructions displayed to user before processing
✅ Graceful fallbacks: Commands work without custom instructions
✅ Prompt templates updated with `{{custom_instruction}}` sections
✅ TypeScript interfaces include `instruct?: string` option

---

## Potential Concerns

1. **Breaking Change**: Migrating `refine` from positional arg to named option
   - **Mitigation**: Support both for backward compatibility during transition

2. **Prompt Length**: Adding custom instructions increases prompt size
   - **Mitigation**: Instructions are typically short (1-2 sentences)

3. **Instruction Conflicts**: Custom instruction might conflict with style guide
   - **Mitigation**: Prompt should clarify precedence (custom instruction overrides general style)

---

## Next Steps

1. Create implementation plan with phased approach
2. Update CLI definitions and TypeScript interfaces
3. Modify command implementations
4. Update prompt templates
5. Test each command with various instructions
6. Update documentation

---

## References

- `src/index.ts` - CLI command definitions
- `src/commands/refine.ts` - Reference implementation for custom instructions
- `src/lib/prompts.ts` - Prompt loading and interpolation utilities
- `src/prompts/refine.md` - Example prompt template with custom instructions
- `src/types.ts` - TypeScript type definitions
