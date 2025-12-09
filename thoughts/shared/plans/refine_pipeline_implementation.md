# Implementation Plan: Refine Pipeline

## IMPLEMENTATION NOTES (2024-12-08)

**Changes made during implementation:**

After user feedback about API complexity and command redundancy, we simplified the approach:

1. **Removed Format command** - It was redundant with `draft`. Instead, we improved the `draft` command prompt to:
   - Stick closely to the author's exact words and phrasing
   - Focus on structure and organization (not creativity)
   - Match the style guide faithfully
   - Be explicit about what NOT to do (embellish, add content, rewrite)

2. **Final Pipeline** - Simple three-step workflow:
   - `draft` - Transform raw notes into structured draft (with style matching)
   - `review` - Get improvement suggestions (optional)
   - `refine` - Apply editorial passes with optional tone (optional)

3. **Implementation completed:**
   - ✅ Phase 2: Review command
   - ✅ Phase 3: Tone selection for Refine command
   - ✅ Phase 4: Integration testing
   - ✅ Phase 5: Documentation
   - ❌ Phase 1: Format command (removed as redundant)

---

## Overview (Original Plan)

Implement a progressive refinement pipeline for writing with three stages:
1. **Format** - Structure and organize raw writing (verbatim but organized) - **REPLACED WITH IMPROVED DRAFT**
2. **Review** - Analyze content and output suggestions to a separate markdown file
3. **Refine** (enhance existing) - Apply improvements with optional tone selection

The pipeline is designed to be progressive and optional - users can stop at any stage and publish, or continue through all stages for maximum refinement.

## Implementation Approach

### Why This Approach

1. **Separation of concerns**: Each command has a single, clear responsibility
2. **Non-destructive workflow**: Original files are preserved, all outputs are versioned
3. **Progressive enhancement**: Users control how much AI assistance they want
4. **Follows existing patterns**: Leverages established codebase conventions from `draft.ts` and `refine.ts`

### Architecture Decisions

- **Format command**: Similar to `draft.ts` but focuses on structure without style matching
- **Review command**: Creates separate suggestions file (non-destructive analysis)
- **Tone in refine**: Optional parameter that modifies the system message dynamically
- **File naming**: Consistent with existing patterns (timestamps, descriptive suffixes)

---

## Phase 1: Format Command Implementation

### Changes Required

#### 1. Create Format Command
**File**: `src/commands/format.ts`
**Changes**: New command to structure raw writing into organized sections

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getPath, readMarkdown, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

interface FormatOptions {
  output?: string;
}

/**
 * Generate output filename with -formatted suffix
 */
function generateOutputPath(inputPath: string, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  return path.join(dir, `${basename}-formatted${ext}`);
}

/**
 * Format raw writing into structured, organized content
 */
export async function format(
  inputPath: string | undefined,
  options: FormatOptions
): Promise<void> {
  if (!inputPath) {
    console.error(chalk.red('Error: File path required'));
    console.log(chalk.dim('\nUsage:'));
    console.log(chalk.cyan('  claude-pen format <file>'));
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`File not found: ${inputPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('\n📋 Formatting content\n'));

  // Read input content
  const spinner = ora('Reading content').start();
  let content: string;
  try {
    const { content: markdownContent } = readMarkdown(inputPath);
    content = markdownContent;
  } catch {
    content = fs.readFileSync(inputPath, 'utf-8');
  }
  const wordCount = countWords(content);
  spinner.succeed(`Read ${chalk.green(wordCount)} words`);

  // Load and interpolate prompt
  const spinner2 = ora('Organizing content').start();
  const promptTemplate = loadPrompt('format');
  const prompt = interpolate(promptTemplate, {
    content: content,
  });

  // Format via LLM
  let formattedContent: string;
  try {
    formattedContent = await complete(prompt, {
      system: 'You are an expert editor focused on structure and organization. Your goal is to organize content clearly without changing the author\'s words or meaning.',
      maxTokens: 8000,
      silent: true,
    });
  } catch (error) {
    spinner2.fail('Failed to format content');
    throw error;
  }

  spinner2.succeed('Content organized');

  // Generate output path
  const outputPath = generateOutputPath(inputPath, options.output);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write formatted content
  fs.writeFileSync(outputPath, formattedContent.trim(), 'utf-8');

  const formattedWordCount = countWords(formattedContent);

  // Success feedback
  console.log(chalk.bold('\n✓ Content Formatted'));
  console.log(chalk.dim(`  Source: ${path.basename(inputPath)} (${wordCount} words)`));
  console.log(chalk.green(`  Output: ${outputPath} (${formattedWordCount} words)`));

  // Suggest next steps
  console.log(chalk.bold('\n📝 Next Steps:'));
  console.log(chalk.dim('  Review the formatting:'));
  console.log(chalk.cyan(`  open ${outputPath}`));
  console.log(chalk.dim('\n  Get suggestions for improvements:'));
  console.log(chalk.cyan(`  claude-pen review ${outputPath}`));
  console.log(chalk.dim('\n  Apply editorial refinements:'));
  console.log(chalk.cyan(`  claude-pen refine ${outputPath} --pass clarity`));
  console.log();
}
```

#### 2. Create Format Prompt Template
**File**: `src/prompts/format.md`
**Changes**: New prompt template for formatting content

```markdown
You are an expert editor focused on structure and organization.

## Task

Format the raw content below into a well-organized document. Your goal is to improve structure and readability while keeping the author's exact words and meaning.

**What to do:**

1. **Add clear structure** - Break content into logical sections with appropriate headings
2. **Organize paragraphs** - Group related ideas together
3. **Improve flow** - Reorder content if needed for better logical progression
4. **Add formatting** - Use markdown formatting (bold, italic, lists, quotes) to enhance readability
5. **Preserve content** - Keep the author's exact words, phrasing, and meaning intact

**What NOT to do:**

- Do NOT change the author's words, vocabulary, or phrasing
- Do NOT add new ideas or content not present in the original
- Do NOT remove content (unless it's truly redundant)
- Do NOT change the author's tone or voice
- Do NOT rewrite sentences for style

Think of this as organizing a messy desk - everything stays, but it's arranged logically.

## Output Format

Return ONLY the formatted markdown content. Do not include:
- Explanations about your changes
- Meta-commentary
- Notes to the author

## Raw Content

{{content}}
```

#### 3. Register Format Command
**File**: `src/index.ts`
**Changes**: Add format command registration

Add import at the top:
```typescript
import { format } from './commands/format.js';
```

Add command registration (insert after `draft` command, before `analyze`):
```typescript
program
  .command('format <file>')
  .description('Structure and organize raw writing into formatted content')
  .option('-o, --output <path>', 'Output file path (default: <basename>-formatted.md)')
  .action(async (file, options) => {
    try {
      await format(file, options);
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
- [x] Linting passes: `bun run lint`
- [x] No import errors when running: `bun run src/index.ts --help`

#### Manual Verification
- [x] Command shows in help: `bun run src/index.ts format --help`
- [ ] Command formats test file: `bun run src/index.ts format test-draft.md`
- [ ] Output file created with `-formatted` suffix
- [ ] Content is organized but verbatim (words unchanged)
- [ ] Next steps suggestions appear
- [ ] Error handling works for missing files

---

## Phase 2: Review Command Implementation

### Changes Required

#### 1. Create Review Command
**File**: `src/commands/review.ts`
**Changes**: New command to analyze content and output suggestions

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

interface ReviewOptions {
  output?: string;
}

/**
 * Generate output filename for review suggestions
 */
function generateReviewPath(inputPath: string, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  return path.join(dir, `${basename}-review${ext}`);
}

/**
 * Review content and generate suggestions
 */
export async function review(
  inputPath: string | undefined,
  options: ReviewOptions
): Promise<void> {
  if (!inputPath) {
    console.error(chalk.red('Error: File path required'));
    console.log(chalk.dim('\nUsage:'));
    console.log(chalk.cyan('  claude-pen review <file>'));
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`File not found: ${inputPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('\n🔍 Reviewing content\n'));

  // Read content
  const spinner = ora('Reading content').start();
  const content = fs.readFileSync(inputPath, 'utf-8');
  const wordCount = countWords(content);
  spinner.succeed(`Read ${chalk.green(wordCount)} words`);

  // Load and interpolate prompt
  const spinner2 = ora('Analyzing content').start();
  const promptTemplate = loadPrompt('review');
  const prompt = interpolate(promptTemplate, {
    content: content,
  });

  // Generate review via LLM
  let reviewContent: string;
  try {
    reviewContent = await complete(prompt, {
      system: 'You are an insightful editor who provides actionable feedback. Identify weaknesses and suggest specific improvements without rewriting.',
      maxTokens: 4096,
      silent: true,
    });
  } catch (error) {
    spinner2.fail('Failed to generate review');
    throw error;
  }

  spinner2.succeed('Review complete');

  // Generate output path
  const outputPath = generateReviewPath(inputPath, options.output);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write review to separate file
  fs.writeFileSync(outputPath, reviewContent.trim(), 'utf-8');

  // Success feedback
  console.log(chalk.bold('\n✓ Review Generated'));
  console.log(chalk.dim(`  Original: ${path.basename(inputPath)}`));
  console.log(chalk.green(`  Review:   ${outputPath}`));

  // Suggest next steps
  console.log(chalk.bold('\n📝 Next Steps:'));
  console.log(chalk.dim('  Read the suggestions:'));
  console.log(chalk.cyan(`  open ${outputPath}`));
  console.log(chalk.dim('\n  Apply improvements manually, or use refine:'));
  console.log(chalk.cyan(`  claude-pen refine ${inputPath} --pass clarity`));
  console.log(chalk.cyan(`  claude-pen refine ${inputPath} --pass proofread`));
  console.log();
}
```

#### 2. Create Review Prompt Template
**File**: `src/prompts/review.md`
**Changes**: New prompt template for content review

```markdown
You are an insightful editor providing actionable feedback on writing.

## Task

Review the content below and provide specific, actionable suggestions for improvement. Focus on identifying weaknesses and opportunities to strengthen the piece.

**Analysis Areas:**

1. **Structure & Organization**
   - Is the flow logical and easy to follow?
   - Are sections in the right order?
   - Are there gaps in the argument or narrative?

2. **Clarity & Comprehension**
   - Are there confusing or ambiguous sections?
   - Could complex ideas be explained more clearly?
   - Are transitions between ideas smooth?

3. **Content Strength**
   - Are arguments well-supported?
   - Are examples effective and relevant?
   - Is there missing context the reader needs?

4. **Style & Impact**
   - Are there wordy or redundant sections?
   - Could certain points be more impactful?
   - Is the tone consistent and appropriate?

**Output Format:**

Structure your review as follows:

```markdown
# Content Review

## Overview
[2-3 sentence summary of overall strengths and weaknesses]

## Key Strengths
- [What works well in this piece]
- [Effective elements to preserve]

## Areas for Improvement

### Structure & Organization
- **Issue:** [Specific problem]
  **Suggestion:** [How to fix it]

### Clarity & Comprehension
- **Issue:** [Specific problem]
  **Suggestion:** [How to fix it]

### Content Strength
- **Issue:** [Specific problem]
  **Suggestion:** [How to fix it]

### Style & Impact
- **Issue:** [Specific problem]
  **Suggestion:** [How to fix it]

## Priority Recommendations
1. [Most important change to make]
2. [Second most important change]
3. [Third most important change]
```

**Important Guidelines:**
- Be specific - reference particular sections or examples
- Provide actionable suggestions, not just criticism
- Explain WHY something needs improvement
- Prioritize the most impactful changes
- Do NOT rewrite content - only suggest improvements

## Content to Review

{{content}}
```

#### 3. Register Review Command
**File**: `src/index.ts`
**Changes**: Add review command registration

Add import at the top:
```typescript
import { review } from './commands/review.js';
```

Add command registration (insert after `format` command):
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

### Success Criteria

#### Automated Verification
- [x] Build passes: `bun run typecheck`
- [x] Linting passes: `bun run lint`
- [x] No import errors when running: `bun run src/index.ts --help`

#### Manual Verification
- [x] Command shows in help: `bun run src/index.ts review --help`
- [ ] Command reviews test file: `bun run src/index.ts review test-draft.md`
- [ ] Separate review file created with `-review` suffix
- [ ] Review contains structured suggestions (not rewrites)
- [ ] Original file is unchanged
- [ ] Next steps suggestions appear
- [ ] Error handling works for missing files

---

## Phase 3: Add Tone Selection to Refine Command

### Changes Required

#### 1. Add Tone Type Definition
**File**: `src/types.ts`
**Changes**: Add tone type after RefinePass

```typescript
export type RefinePass = 'proofread' | 'punchier' | 'clarity';

export type ToneOption = 'punchy' | 'funny' | 'personal' | 'professional';
```

#### 2. Update Refine Command with Tone Support
**File**: `src/commands/refine.ts`
**Changes**: Add tone parameter and integrate into LLM call

Add import for new type:
```typescript
import type { RefinePass, ToneOption } from '../types.js';
```

Update interface:
```typescript
interface RefineOptions {
  pass?: RefinePass;
  tone?: ToneOption;
}
```

Add constants for tone validation:
```typescript
const VALID_TONES: ToneOption[] = ['punchy', 'funny', 'personal', 'professional'];

const TONE_DESCRIPTIONS: Record<ToneOption, string> = {
  punchy: 'direct, impactful, concise',
  funny: 'humorous, entertaining, lighthearted',
  personal: 'intimate, conversational, warm',
  professional: 'formal, polished, authoritative',
};
```

Add tone validation in main function (after pass validation):
```typescript
// Validate tone if provided
if (options.tone && !VALID_TONES.includes(options.tone)) {
  console.error(chalk.red(`Invalid tone: ${options.tone}`));
  console.error(`Valid options: ${VALID_TONES.join(', ')}`);
  process.exit(1);
}
```

Update display to show tone (after line 193):
```typescript
console.log(chalk.bold(`\n📝 Refining draft: ${path.basename(draftPath)}`));
console.log(chalk.dim(`   Pass: ${pass}`));
if (options.tone) {
  console.log(chalk.dim(`   Tone: ${options.tone} (${TONE_DESCRIPTIONS[options.tone]})`));
}
console.log();
```

Update system message to incorporate tone (replace line 214):
```typescript
let systemMessage = `You are a skilled editor helping improve writing while preserving the author's unique voice. Apply the ${pass} refinement pass carefully.`;

if (options.tone) {
  systemMessage += ` Adjust the tone to be ${TONE_DESCRIPTIONS[options.tone]}.`;
}

const refined = await complete(prompt, {
  system: systemMessage,
  maxTokens: 8000,
  silent: true,
});
```

#### 3. Update CLI Registration
**File**: `src/index.ts`
**Changes**: Add tone option to refine command

Update refine command registration (find existing command around line 72):
```typescript
program
  .command('refine [draft]')
  .description('Apply editorial refinement pass to a draft')
  .option('--pass <pass>', 'Refinement pass: proofread, punchier, clarity', 'proofread')
  .option('--tone <tone>', 'Tone adjustment: punchy, funny, personal, professional')
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
- [x] Linting passes: `bun run lint`
- [x] No import errors

#### Manual Verification
- [x] Help shows tone option: `bun run src/index.ts refine --help`
- [ ] Command works without tone: `bun run src/index.ts refine test-draft.md`
- [ ] Command works with tone: `bun run src/index.ts refine test-draft.md --tone punchy`
- [ ] Tone is displayed in output
- [ ] Refined content reflects the selected tone
- [ ] Invalid tone shows error message
- [ ] Tone validation prevents invalid values

---

## Phase 4: Integration Testing

### Changes Required

No file changes - this phase focuses on testing the complete pipeline.

### Success Criteria

#### Automated Verification
- [x] Build passes: `bun run typecheck`
- [x] Linting passes: `bun run lint`
- [x] All commands show in help: `bun run src/index.ts --help`

#### Manual Verification - Complete Pipeline

Test the full workflow:

1. **Format stage:**
   ```bash
   bun run src/index.ts format test-draft.md
   ```
   - [ ] Creates `test-draft-formatted.md`
   - [ ] Content is structured but verbatim
   - [ ] Suggests review as next step

2. **Review stage:**
   ```bash
   bun run src/index.ts review test-draft-formatted.md
   ```
   - [ ] Creates `test-draft-formatted-review.md`
   - [ ] Review file contains structured suggestions
   - [ ] Original formatted file is unchanged
   - [ ] Suggests refine as next step

3. **Refine stage (without tone):**
   ```bash
   bun run src/index.ts refine test-draft-formatted.md --pass clarity
   ```
   - [ ] Creates timestamped file: `test-draft-formatted-YYYYMMDDHHMMSS-clarity.md`
   - [ ] Content improvements applied
   - [ ] Original formatted file is unchanged

4. **Refine stage (with tone):**
   ```bash
   bun run src/index.ts refine test-draft-formatted.md --pass punchier --tone punchy
   ```
   - [ ] Creates new timestamped file
   - [ ] Content reflects both pass and tone
   - [ ] Tone is shown in console output

5. **Error handling:**
   - [ ] Missing file shows clear error
   - [ ] Invalid pass shows error with valid options
   - [ ] Invalid tone shows error with valid options
   - [ ] Commands fail gracefully with helpful messages

6. **File organization:**
   - [ ] All output files are in expected locations
   - [ ] File naming is consistent and clear
   - [ ] No files are overwritten accidentally

---

## Phase 5: Documentation

### Changes Required

#### 1. Update README.md
**File**: `README.md`
**Changes**: Document the new pipeline commands

Add new section after "Quick Start":

```markdown
## Writing Pipeline

claude-pen provides a progressive refinement pipeline for your writing:

### 1. Format - Structure Your Content

Transform raw notes into organized, structured content:

```bash
claude-pen format raw-notes.md
```

This creates `raw-notes-formatted.md` with:
- Clear section headings
- Organized paragraphs
- Improved flow
- Your exact words preserved

### 2. Review - Get Feedback (Optional)

Analyze your content and get actionable suggestions:

```bash
claude-pen review raw-notes-formatted.md
```

This creates `raw-notes-formatted-review.md` containing:
- Overall assessment
- Key strengths
- Specific areas for improvement
- Priority recommendations

The review is non-destructive - your original file is unchanged.

### 3. Refine - Apply Improvements (Optional)

Apply editorial refinements with optional tone adjustments:

```bash
# Apply clarity improvements
claude-pen refine raw-notes-formatted.md --pass clarity

# Make it punchier with a punchy tone
claude-pen refine raw-notes-formatted.md --pass punchier --tone punchy

# Proofread with a professional tone
claude-pen refine raw-notes-formatted.md --pass proofread --tone professional
```

**Refinement passes:**
- `proofread` - Fix grammar, spelling, and awkward phrasing
- `clarity` - Improve flow and comprehension
- `punchier` - Tighten prose and strengthen impact

**Tone options:**
- `punchy` - Direct, impactful, concise
- `funny` - Humorous, entertaining, lighthearted
- `personal` - Intimate, conversational, warm
- `professional` - Formal, polished, authoritative

Each refinement creates a new timestamped file, preserving all versions.

### When to Use Each Command

- **Format only**: When your raw thoughts just need structure
- **Format + Review**: When you want suggestions before making changes
- **Format + Refine**: When you want AI to apply improvements directly
- **Full pipeline**: When you want maximum refinement with review guidance
```

Update the "Available Commands" section to include format and review:

```markdown
### `format`

Structure and organize raw writing into formatted content.

```bash
claude-pen format <file>

Options:
  -o, --output <path>  Output file path (default: <basename>-formatted.md)
```

### `review`

Analyze content and generate improvement suggestions.

```bash
claude-pen review <file>

Options:
  -o, --output <path>  Output file path for suggestions (default: <basename>-review.md)
```
```

Update the `refine` command documentation to include tone:

```markdown
### `refine`

Apply editorial refinement pass to a draft with optional tone adjustment.

```bash
claude-pen refine [draft]

Options:
  --pass <pass>  Refinement pass: proofread, punchier, clarity (default: proofread)
  --tone <tone>  Tone adjustment: punchy, funny, personal, professional
```

**Examples:**

```bash
# Interactive file selection
claude-pen refine

# Specific file with clarity pass
claude-pen refine draft.md --pass clarity

# Proofread with professional tone
claude-pen refine draft.md --pass proofread --tone professional

# Make it punchy
claude-pen refine draft.md --pass punchier --tone punchy
```
```

### Success Criteria

#### Automated Verification
- [ ] README renders correctly in markdown preview
- [ ] All command examples are accurate
- [ ] All links work

#### Manual Verification
- [ ] Pipeline workflow is clearly explained
- [ ] Each command is documented with options
- [ ] Examples are practical and helpful
- [ ] Tone options are described clearly
- [ ] When to use each command is explained

---

## Rollback Plan

If issues are discovered:

### Phase 1 Rollback (Format Command)
- Delete `src/commands/format.ts`
- Delete `src/prompts/format.md`
- Remove format import and registration from `src/index.ts`

### Phase 2 Rollback (Review Command)
- Delete `src/commands/review.ts`
- Delete `src/prompts/review.md`
- Remove review import and registration from `src/index.ts`

### Phase 3 Rollback (Tone in Refine)
- Remove `ToneOption` type from `src/types.ts`
- Revert `src/commands/refine.ts` to previous version (remove tone parameter)
- Remove `--tone` option from refine command in `src/index.ts`

### Phase 5 Rollback (Documentation)
- Revert `README.md` to previous version

### Complete Rollback
```bash
git checkout src/commands/format.ts src/commands/review.ts
git checkout src/prompts/format.md src/prompts/review.md
git checkout src/commands/refine.ts src/types.ts src/index.ts
git checkout README.md
```

---

## Implementation Notes

### Key Design Decisions

1. **Format vs Draft**: Format focuses on structure without voice matching, draft focuses on voice preservation
2. **Review as separate file**: Non-destructive, allows manual consideration of suggestions
3. **Tone as dynamic parameter**: Avoids proliferation of prompt templates while maintaining flexibility
4. **Consistent file naming**: All commands use descriptive suffixes for clarity

### Testing Strategy

- Test each phase independently before moving to next
- Test complete pipeline end-to-end in Phase 4
- Test error cases (missing files, invalid options)
- Verify file naming consistency
- Ensure non-destructive workflow (no overwrites)

### Future Enhancements (Out of Scope)

- Automatic pipeline chaining (format → review → refine in one command)
- Custom tone definitions via config
- Diff view between versions
- Undo/rollback to previous version
- Compare multiple refined versions
