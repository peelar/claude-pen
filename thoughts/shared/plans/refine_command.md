# Implementation Plan: Refine Command

**Date**: 2025-12-08
**Research**: `thoughts/shared/research/06-refine_command_implementation.md`

## Overview

Implement the `claude-pen refine` command that applies editorial refinement passes (proofread, punchier, clarity) to drafts while preserving the author's unique voice. The command will:

- Accept a draft file path and optional `--pass` flag
- Load the user's style guide (with graceful fallback)
- Apply the specified refinement pass using Claude
- Overwrite the original file (git provides version history)
- Display word count statistics
- Suggest next refinement passes or formatting

## Implementation Approach

This implementation follows the exact patterns established in `draft.ts`:
- Similar workflow: read file → load style guide → prompt → LLM → write
- Reuse existing utility functions from `lib/files.ts`, `lib/prompts.ts`, `lib/llm.ts`
- Three separate prompt files for focused, single-purpose refinement
- Default to 'proofread' pass as most commonly used
- Overwrite strategy (no output option) for simpler UX

**Why this approach:**
1. Consistency with existing codebase patterns
2. Reuses battle-tested utility functions
3. Separate prompts enable focused refinement goals
4. Flat prompt structure keeps implementation simple
5. File overwriting leverages git for history tracking

---

## Phase 1: Command Structure & Validation

### Changes Required

#### 1. Create Command Implementation File
**File**: `src/commands/refine.ts`
**Changes**: Create new command with imports, interfaces, and validation

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getPath, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';
import type { RefinePass } from '../types.js';

interface RefineOptions {
  pass?: RefinePass;
}

const VALID_PASSES: RefinePass[] = ['proofread', 'punchier', 'clarity'];

const PASS_DESCRIPTIONS: Record<RefinePass, string> = {
  proofread: 'Fixing grammar, spelling, and awkward phrasing',
  punchier: 'Tightening prose and strengthening impact',
  clarity: 'Improving flow and comprehension',
};

const STYLE_GUIDE_PATH = 'writing/_style_guide.md';

function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Refinement will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

export async function refine(draftArg: string, options: RefineOptions): Promise<void> {
  // Determine pass
  const pass: RefinePass = options.pass || 'proofread';

  // Validate pass
  if (!VALID_PASSES.includes(pass)) {
    console.error(chalk.red(`Invalid pass: ${pass}`));
    console.error(`Valid options: ${VALID_PASSES.join(', ')}`);
    process.exit(1);
  }

  // Resolve and validate file path
  const draftPath = path.resolve(draftArg);

  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  console.log(chalk.bold(`\n📝 Refining draft: ${path.basename(draftPath)}`));
  console.log(chalk.dim(`   Pass: ${pass}\n`));

  // Implementation continues in Phase 2...
}
```

### Success Criteria

#### Automated Verification
- [x] Build passes: `bun run typecheck`
- [x] No TypeScript errors in `src/commands/refine.ts`
- [x] All imports resolve correctly

#### Manual Verification
- [x] Constants are properly typed
- [x] Validation logic matches pattern from `ingest.ts:146-152`
- [x] Error messages follow chalk color conventions
- [x] File validation matches pattern from `draft.ts:82-90`

---

## Phase 2: Core Refinement Logic

### Changes Required

#### 1. Complete Refinement Implementation
**File**: `src/commands/refine.ts`
**Changes**: Add style guide loading, prompt interpolation, LLM completion, and file writing

```typescript
export async function refine(draftArg: string, options: RefineOptions): Promise<void> {
  // ... validation from Phase 1 ...

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Read draft content
  const content = fs.readFileSync(draftPath, 'utf-8');
  const originalWords = countWords(content);

  // Load and interpolate prompt
  const promptTemplate = loadPrompt(pass);
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
  });

  // Apply refinement pass
  const spinner = ora(`${PASS_DESCRIPTIONS[pass]}...`).start();

  try {
    const refined = await complete(prompt, {
      system: `You are a skilled editor helping improve writing while preserving the author's unique voice. Apply the ${pass} refinement pass carefully.`,
      maxTokens: 8000,
      silent: true,
    });

    spinner.succeed(`${pass} pass complete`);

    // Write refined content
    fs.writeFileSync(draftPath, refined, 'utf-8');

    // Calculate statistics
    const newWords = countWords(refined);
    const diff = newWords - originalWords;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

    // Display success
    console.log(chalk.green(`\n✓ Draft updated: ${draftPath}`));
    console.log(chalk.dim(`  ${newWords} words (${diffStr})`));

    // Suggest next steps
    const otherPasses = VALID_PASSES.filter(p => p !== pass);
    if (otherPasses.length > 0) {
      console.log(chalk.dim('\nOther refinement passes:'));
      for (const otherPass of otherPasses) {
        console.log(chalk.cyan(`  claude-pen refine ${draftPath} --pass ${otherPass}`));
      }
    }

    console.log(chalk.dim('\nOr format for publishing:'));
    console.log(chalk.cyan(`  claude-pen format ${draftPath}`));
    console.log();

  } catch (error) {
    spinner.fail(`${pass} pass failed`);
    throw error;
  }
}
```

### Success Criteria

#### Automated Verification
- [x] Build passes: `bun run typecheck`
- [x] No linting errors: `bun run lint`

#### Manual Verification
- [x] Style guide loads with proper fallback
- [x] Spinner shows appropriate message for each pass
- [x] Word count calculation is accurate
- [x] File is overwritten correctly
- [x] Error handling terminates spinner properly

---

## Phase 3: CLI Registration

### Changes Required

#### 1. Register Command in CLI Entry Point
**File**: `src/index.ts`
**Changes**: Add import and command registration after existing commands

```typescript
// Add import with other command imports (around line 5-10)
import { refine } from './commands/refine.js';

// Add command registration after existing commands (around line 70+)
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

### Success Criteria

#### Automated Verification
- [x] Build passes: `bun run typecheck`
- [x] No import errors

#### Manual Verification
- [x] Help displays correctly: `bun run src/index.ts refine --help`
- [x] Command appears in main help: `bun run src/index.ts --help`
- [x] Option is documented properly

---

## Phase 4: Prompt Templates

### Changes Required

#### 1. Create Proofread Prompt
**File**: `src/prompts/proofread.md`
**Changes**: Create prompt for grammar, spelling, and awkward phrasing fixes

```markdown
You are a meticulous editor focused on correctness and clarity.

## Author's Style Guide

{{style_guide}}

## Task

Apply a proofread refinement pass to the content below. Your goal is to fix errors while preserving the author's unique voice and style.

1. **Fix grammar** - Correct grammatical errors, subject-verb agreement, tense consistency
2. **Fix spelling** - Correct typos and misspellings
3. **Fix punctuation** - Ensure proper punctuation usage
4. **Fix awkward phrasing** - Rewrite sentences that are unclear or clumsy
5. **Preserve voice** - Maintain the author's tone, word choice, and personality

Important:
- Do NOT change the author's vocabulary choices unless they're objectively wrong
- Do NOT reorganize content or change structure
- Do NOT add new ideas or examples
- Do NOT make the text more formal or academic
- Focus on correctness, not style changes

Output only the refined content. No preamble, no explanation, no meta-commentary.

## Content to Proofread

{{content}}
```

#### 2. Create Punchier Prompt
**File**: `src/prompts/punchier.md`
**Changes**: Create prompt for tightening prose and strengthening impact

```markdown
You are a skilled editor focused on making prose more impactful and concise.

## Author's Style Guide

{{style_guide}}

## Task

Apply a "punchier" refinement pass to the content below. Your goal is to tighten prose and strengthen impact while preserving the author's unique voice.

1. **Eliminate wordiness** - Remove redundant phrases and filler words
2. **Strengthen verbs** - Replace weak verbs with strong, active ones
3. **Shorten sentences** - Break up overly long sentences for better rhythm
4. **Remove hedging** - Cut "I think," "perhaps," "maybe" unless intentional
5. **Preserve voice** - Maintain the author's tone and personality

Important:
- Do NOT change the core meaning or arguments
- Do NOT make text overly aggressive or eliminate all nuance
- Do NOT remove the author's characteristic phrases
- Do NOT reorganize content structure
- Focus on impact and conciseness, not correctness

Output only the refined content. No preamble, no explanation, no meta-commentary.

## Content to Make Punchier

{{content}}
```

#### 3. Create Clarity Prompt
**File**: `src/prompts/clarity.md`
**Changes**: Create prompt for improving flow and comprehension

```markdown
You are a thoughtful editor focused on clarity and reader comprehension.

## Author's Style Guide

{{style_guide}}

## Task

Apply a clarity refinement pass to the content below. Your goal is to improve flow and comprehension while preserving the author's unique voice.

1. **Improve transitions** - Add or strengthen connections between ideas
2. **Clarify ambiguity** - Rewrite unclear references or vague statements
3. **Enhance flow** - Reorder sentences within paragraphs if it helps comprehension
4. **Simplify complexity** - Break down overly complex ideas without dumbing down
5. **Preserve voice** - Maintain the author's tone, vocabulary, and personality

Important:
- Do NOT add new ideas or examples unless essential for clarity
- Do NOT change the author's vocabulary to simpler words unnecessarily
- Do NOT make text more formal or academic
- Do NOT change the overall structure or argument flow
- Focus on making existing ideas clearer, not changing them

Output only the refined content. No preamble, no explanation, no meta-commentary.

## Content to Clarify

{{content}}
```

### Success Criteria

#### Automated Verification
- [x] All prompt files exist in correct location
- [x] Prompt files are valid markdown
- [x] Variable placeholders are correct: `{{style_guide}}`, `{{content}}`

#### Manual Verification
- [x] Each prompt has clear, focused instructions
- [x] All prompts emphasize voice preservation
- [x] Instructions match pass descriptions
- [x] Output format is clearly specified

---

## Phase 5: Integration Testing

### Changes Required

#### 1. Create Test Draft File
**File**: `test-draft.md` (temporary, for testing)
**Changes**: Create a test file with deliberate issues for each pass

```markdown
# Test Draft

this is a test draft with some issuess. Its got grammar errors and spelling mistakes.

I think that maybe the way we approach this problem is perhaps not the most optimal solution that we could potentially implement if we really wanted to.

The API connects to the database. Then the database returns the data. After that the data is processed. The processed data gets sent back. Finally the response is returned.

Its important to understand that when your writing code you need to make sure that your following best practices and that your being careful about edge cases because they can really cause problems down the line if your not thinking about them from the start.
```

#### 2. Test All Passes Manually
**Command**: Manual execution and verification

```bash
# Test proofread pass
bun run src/index.ts refine test-draft.md --pass proofread
# Expected: Grammar/spelling fixes, "issuess" → "issues", "Its" → "It's"

# Test punchier pass
bun run src/index.ts refine test-draft.md --pass punchier
# Expected: Removes hedging ("I think," "maybe," "perhaps"), tightens verbose sentence

# Test clarity pass
bun run src/index.ts refine test-draft.md --pass clarity
# Expected: Improves flow in API description, better transitions
```

### Success Criteria

#### Automated Verification
- [x] Command executes without errors
- [x] No TypeScript compilation errors: `bun run typecheck`
- [x] Build succeeds: `bun run typecheck`

#### Manual Verification
- [x] Invalid pass shows proper error message
- [x] Missing file shows proper error message
- [ ] Proofread pass fixes grammar and spelling (requires LLM call)
- [ ] Punchier pass removes wordiness and hedging (requires LLM call)
- [ ] Clarity pass improves flow and transitions (requires LLM call)
- [ ] All passes preserve core meaning (requires LLM call)
- [ ] Word count statistics are displayed (requires LLM call)
- [ ] Next steps are suggested (requires LLM call)
- [ ] File is overwritten correctly (requires LLM call)
- [ ] Style guide warning appears when no style guide exists (requires LLM call)

---

## Phase 6: Documentation

### Changes Required

#### 1. Update README.md
**File**: `README.md`
**Changes**: Document new refine command

Add to "Available Commands" section:

```markdown
### `refine`

Apply editorial refinement passes to drafts while preserving your unique voice.

```bash
claude-pen refine <draft-file> [--pass <pass-type>]
```

**Options:**
- `--pass <pass-type>` - Refinement pass to apply (default: `proofread`)
  - `proofread` - Fix grammar, spelling, and awkward phrasing
  - `punchier` - Tighten prose and strengthen impact
  - `clarity` - Improve flow and comprehension

**Examples:**

```bash
# Fix grammar and spelling
claude-pen refine writing/drafts/my-post.md --pass proofread

# Make prose more concise and impactful
claude-pen refine writing/drafts/my-post.md --pass punchier

# Improve transitions and clarity
claude-pen refine writing/drafts/my-post.md --pass clarity

# Default to proofread if no pass specified
claude-pen refine writing/drafts/my-post.md
```

**Workflow:**

1. Create initial draft from notes: `claude-pen draft notes.md`
2. Apply refinement passes as needed:
   - `refine --pass proofread` for correctness
   - `refine --pass punchier` for impact
   - `refine --pass clarity` for comprehension
3. Format for publishing: `claude-pen format drafts/post.md`

**Note:** The refine command overwrites the input file. Use git to track changes.
```

Update "Coming Soon" section if refine was listed there (remove it).

### Success Criteria

#### Automated Verification
- [x] README renders correctly in markdown preview
- [x] All code blocks have proper syntax highlighting

#### Manual Verification
- [x] Command is fully documented with all options
- [x] Examples are clear and practical
- [x] Workflow integrates with existing commands (draft)
- [x] Note about file overwriting is present
- [x] Pass types are clearly described

---

## Rollback Plan

If issues arise during implementation:

1. **Phase 1-2 (Command Implementation)**
   - Delete `src/commands/refine.ts`
   - No other changes needed

2. **Phase 3 (CLI Registration)**
   - Remove import line from `src/index.ts`
   - Remove command registration block
   - Run `bun run typecheck` to verify

3. **Phase 4 (Prompts)**
   - Delete prompt files:
     - `src/prompts/proofread.md`
     - `src/prompts/punchier.md`
     - `src/prompts/clarity.md`

4. **Phase 5-6 (Testing/Docs)**
   - Delete `test-draft.md`
   - Revert README.md changes: `git checkout README.md`

**Complete rollback:**
```bash
git checkout src/index.ts README.md
rm -f src/commands/refine.ts
rm -f src/prompts/proofread.md src/prompts/punchier.md src/prompts/clarity.md
rm -f test-draft.md
```

---

## Implementation Notes

### Dependencies on Existing Code
- **Types**: `RefinePass` already exists in `src/types.ts:3`
- **Utilities**: All required functions exist in `lib/` modules
- **Patterns**: Following exact structure from `draft.ts`

### Key Design Decisions
1. **Flat prompt structure**: Simpler, clearer file organization
2. **Default to proofread**: Most commonly needed first pass
3. **Overwrite files**: Git provides history, simpler UX
4. **8000 max_tokens**: Handles most draft lengths (≈32k chars)
5. **Three focused prompts**: Single-purpose refinement > multi-purpose

### Testing Strategy
Manual testing with real content is critical because:
- Voice preservation is subjective
- Each pass should complement others
- Style guide integration varies by user

### Potential Issues
1. **Large files**: May hit token limits (8000 tokens ≈ 6000 words)
   - Solution: Document limitation, suggest splitting drafts
2. **Sequential passes**: Each pass should preserve previous improvements
   - Solution: Test passes in sequence during validation
3. **Style guide quality**: Low-quality style guides may degrade results
   - Solution: Already handled with fallback text

---

## Timeline

Estimated implementation order (all phases can be completed in one session):

1. Phase 1: Command Structure & Validation (15 min)
2. Phase 2: Core Refinement Logic (15 min)
3. Phase 3: CLI Registration (5 min)
4. Phase 4: Prompt Templates (30 min)
5. Phase 5: Integration Testing (20 min)
6. Phase 6: Documentation (10 min)

**Total**: ~1.5 hours for complete implementation and testing

---

## Success Validation Checklist

Before considering this feature complete:

- [ ] All TypeScript compilation passes
- [ ] All three passes execute successfully
- [ ] Style guide loading works (with and without guide)
- [ ] Error handling works (invalid pass, missing file)
- [ ] Word count statistics are accurate
- [ ] Next steps suggestions are appropriate
- [ ] README documentation is complete
- [ ] Manual testing with real drafts confirms voice preservation
- [ ] All prompts emphasize voice preservation
- [ ] File overwriting works correctly
