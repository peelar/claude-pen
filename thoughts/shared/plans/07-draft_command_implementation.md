# Implementation Plan: Draft Command

**Date:** 2025-12-08
**Based on Research:** `thoughts/shared/research/04-draft_command_implementation.md`

---

## Overview

Implement the `claude-pen draft` command to transform raw notes into structured drafts that match the author's writing style. This command takes unstructured ideas from `writing/raw/` and generates coherent drafts in `writing/drafts/`, optionally using the author's style guide from `writing/_style_guide.md`.

---

## Implementation Approach

### Why This Approach?

1. **Pattern Consistency**: Follows the established architecture from `analyze.ts` and `ingest.ts` commands
2. **Graceful Degradation**: Works with or without a style guide, making it useful immediately after workspace initialization
3. **Clear User Flow**: Raw notes → Draft → Refine → Publish
4. **Minimal Surface Area**: Single required argument, one optional flag - keeps UX simple
5. **Reuses Existing Utilities**: Leverages all existing file operations, prompt system, and LLM integration

### Key Design Decisions

- **Style Guide Optional**: Draft works without `_style_guide.md`, showing a helpful warning
- **Smart Output Path**: Auto-generates output in `writing/drafts/` unless user specifies custom path
- **Voice Preservation**: Uses style guide content directly in prompt to match author's voice
- **Simple Interface**: No platform selection needed at draft stage (decided later during refinement)

---

## Phase 1: Create Prompt Template

### Changes Required

#### 1. Draft Prompt Template
**File**: `src/prompts/draft.md`
**Changes**: Create new prompt template for draft generation

```markdown
You are a skilled ghostwriter helping an author transform raw notes into a structured draft while preserving their unique voice.

# Author's Style Guide

{{style_guide}}

# Raw Notes

{{notes}}

# Task

Transform the raw notes above into a well-structured draft that:

1. **Organizes ideas coherently** - Group related points and create logical flow
2. **Matches the author's voice** - Follow the style patterns from their style guide
3. **Maintains authenticity** - Preserve the author's original ideas and insights
4. **Adds structure** - Create clear sections with smooth transitions
5. **Stays focused** - Don't add information not present in the notes

# Output Format

Return ONLY the draft content as markdown. Do not include:
- Explanations about your process
- Metadata or frontmatter
- Suggestions for improvement
- Commentary on the content

The draft should be ready to save directly to a markdown file.
```

### Success Criteria

#### Automated Verification
- [x] File exists at `src/prompts/draft.md`
- [x] Contains `{{style_guide}}` and `{{notes}}` variables
- [x] Build passes: `bun run typecheck`

#### Manual Verification
- [x] Template explains task clearly
- [x] Instructions emphasize voice preservation
- [x] Output format is unambiguous

---

## Phase 2: Implement Draft Command

### Changes Required

#### 1. Draft Command Implementation
**File**: `src/commands/draft.ts`
**Changes**: Create new command module (~150 lines)

**Structure:**

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getPath, readMarkdown, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import { complete } from '../lib/llm.js';

const STYLE_GUIDE_PATH = 'writing/_style_guide.md';

interface DraftOptions {
  output?: string;
}

/**
 * Load style guide with graceful fallback
 */
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Draft will be created without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Use a clear, professional tone appropriate for the content.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

/**
 * Determine output path for draft
 */
function getOutputPath(inputPath: string, explicitOutput?: string): string {
  if (explicitOutput) {
    return explicitOutput;
  }

  const basename = path.basename(inputPath, path.extname(inputPath));
  return getPath('writing', 'drafts', `${basename}.md`);
}

/**
 * Transform raw notes into a structured draft
 */
export async function draft(
  notesPath: string,
  options: DraftOptions
): Promise<void> {
  console.log(chalk.bold('\n✏️  Creating draft\n'));

  // Validate input file exists
  if (!fs.existsSync(notesPath)) {
    console.error(chalk.red(`File not found: ${notesPath}`));
    process.exit(1);
  }

  // Read notes content
  const spinner = ora('Reading notes').start();
  let notesContent: string;

  try {
    // Check if file has frontmatter
    const { content } = readMarkdown(notesPath);
    notesContent = content;
  } catch {
    // Fallback to plain text read if not valid markdown with frontmatter
    notesContent = fs.readFileSync(notesPath, 'utf-8');
  }

  const wordCount = countWords(notesContent);
  spinner.succeed(`Read ${chalk.green(wordCount)} words from notes`);

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Load and interpolate prompt
  const spinner2 = ora('Generating draft').start();
  const promptTemplate = loadPrompt('draft');
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    notes: notesContent,
  });

  // Generate draft via LLM
  let draftContent: string;
  try {
    draftContent = await complete(prompt, {
      system: 'You are a skilled ghostwriter helping an author structure their thoughts while preserving their unique voice.',
      maxTokens: 8000,
      silent: true,
    });
  } catch (error) {
    spinner2.fail('Failed to generate draft');
    throw error;
  }

  spinner2.succeed('Draft generated');

  // Determine output path
  const outputPath = getOutputPath(notesPath, options.output);

  // Ensure drafts directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write draft to file
  fs.writeFileSync(outputPath, draftContent.trim(), 'utf-8');

  const draftWordCount = countWords(draftContent);

  // Success feedback
  console.log(chalk.bold('\n✓ Draft Created'));
  console.log(chalk.dim(`  Source: ${path.basename(notesPath)} (${wordCount} words)`));
  console.log(chalk.green(`  Draft:  ${outputPath} (${draftWordCount} words)`));

  // Suggest next steps
  console.log(chalk.bold('\n📝 Next Steps:'));
  console.log(chalk.dim('  Review and edit:'));
  console.log(chalk.cyan(`  open ${outputPath}`));
  console.log(chalk.dim('\n  Refine with additional passes:'));
  console.log(chalk.cyan(`  claude-pen refine ${outputPath} --pass proofread`));
  console.log(chalk.cyan(`  claude-pen refine ${outputPath} --pass clarity`));
  console.log();
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `bun run typecheck`
- [x] No lint errors: `bun run lint`
- [x] File exports `draft` function

#### Manual Verification
- [x] Helper functions are focused and single-purpose
- [x] Error messages are user-friendly
- [x] Console output matches project conventions (emojis, colors)
- [x] Spinners provide clear progress indication

---

## Phase 3: Register Command in CLI

### Changes Required

#### 1. CLI Registration
**File**: `src/index.ts`
**Location**: After the `ingest` command registration (around line 40)
**Changes**: Add draft command registration

```typescript
// Add import at top with other command imports (after line 5)
import { draft } from './commands/draft.js';

// Add command registration (after ingest command, before program.parse())
program
  .command('draft <notes>')
  .description('Transform raw notes into a structured draft')
  .option('-o, --output <path>', 'Output file path (default: writing/drafts/<basename>.md)')
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

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `bun run typecheck`
- [x] Help text displays: `bun run src/index.ts draft --help`
- [x] Command is listed in main help: `bun run src/index.ts --help`

#### Manual Verification
- [x] Help text shows correct description
- [x] Required argument `<notes>` is documented
- [x] Optional flag `--output` is documented with description

---

## Phase 4: Test Implementation

### Changes Required

#### 1. Create Test Fixtures

**Setup commands:**

```bash
# Create test notes file
mkdir -p writing/raw
cat > writing/raw/test-notes.md << 'EOF'
# Quick thoughts on shipping fast

- speed is everything for indie hackers
- ship something ugly but working
- perfection is the enemy of progress
- get feedback early, iterate often
- build in public to stay accountable

Main point: velocity > perfection when bootstrapping
EOF
```

#### 2. Test Scenarios

**Test 1: Draft without style guide**
```bash
# Backup existing style guide if present
mv writing/_style_guide.md writing/_style_guide.md.bak 2>/dev/null || true

# Run draft command
bun run src/index.ts draft writing/raw/test-notes.md
```

**Expected behavior:**
- ⚠ Warning shown about missing style guide
- Draft created at `writing/drafts/test-notes.md`
- Draft has clear structure (intro, body, conclusion)
- Console shows word counts (source and draft)
- Next steps suggest opening file and refine commands

**Test 2: Draft with style guide**
```bash
# Restore style guide
mv writing/_style_guide.md.bak writing/_style_guide.md 2>/dev/null || true

# Run draft command
bun run src/index.ts draft writing/raw/test-notes.md
```

**Expected behavior:**
- No warning about style guide
- Draft created with author's voice and patterns
- Success message shows paths and word counts
- Next steps displayed

**Test 3: Custom output path**
```bash
bun run src/index.ts draft writing/raw/test-notes.md -o writing/drafts/shipping-velocity.md
```

**Expected behavior:**
- Draft created at specified path `writing/drafts/shipping-velocity.md`
- Success message reflects custom path

**Test 4: File not found error**
```bash
bun run src/index.ts draft writing/raw/nonexistent.md
```

**Expected behavior:**
- Red error message: "File not found: writing/raw/nonexistent.md"
- Exit code 1 (non-zero)

**Test 5: Help documentation**
```bash
bun run src/index.ts draft --help
```

**Expected behavior:**
- Shows description: "Transform raw notes into a structured draft"
- Shows usage: `draft <notes>`
- Shows option: `-o, --output <path>`

### Success Criteria

#### Automated Verification
- [x] Command executes without TypeScript errors
- [x] Help flag works: `draft --help`
- [x] Exit code 0 on success, 1 on error

#### Manual Verification
- [x] Draft content is coherent and well-structured
- [x] Style guide is applied when present
- [x] Warning appears when style guide missing
- [x] Word counts are accurate
- [x] Output paths are correct (default and custom)
- [x] Error handling is graceful with clear messages
- [x] Console output matches project patterns (colors, emojis)

---

## Phase 5: Documentation

### Changes Required

#### 1. Update README.md
**File**: `README.md`
**Changes**: Document the new draft command

**Section: "Available Commands"** (after ingest, line ~163)

Add:

```markdown
### Generate a Draft

Transform raw notes into a structured draft that matches your writing style:

```bash
claude-pen draft <notes>
```

**Arguments:**

- `<notes>` - Path to markdown file containing raw notes (required)
- `--output, -o` - Custom output path (optional, defaults to `writing/drafts/<basename>.md`)

**Features:**

- Uses your style guide (`writing/_style_guide.md`) to match your voice
- Works without a style guide (shows helpful warning)
- Organizes unstructured ideas into coherent structure
- Preserves your original insights and tone
- Outputs draft ready for review and refinement

**Workflow:**

```
writing/raw/notes.md → draft → writing/drafts/notes.md → refine → writing/content/[platform]/
```

**Examples:**

```bash
# Generate draft from notes (auto-output to drafts/)
claude-pen draft writing/raw/startup-ideas.md

# Specify custom output location
claude-pen draft writing/raw/blog-outline.md -o writing/drafts/saas-pricing.md

# Draft without style guide (works immediately after init)
claude-pen draft writing/raw/quick-thoughts.md
```

**Next Steps:**
After drafting, review the output in your editor, then use `claude-pen refine` to polish specific aspects.
```

**Section: "Coming Soon"** (line ~164)

Update to:

```markdown
### Coming Soon

- `claude-pen refine <draft>` - Polish and improve draft with targeted passes
```

**Section: "Status"** (line ~19)

Update to:

```markdown
🚧 **Early Development** - Currently implements workspace initialization, content ingestion, style analysis, and draft generation. Refine command in development.
```

### Success Criteria

#### Automated Verification
- [x] README renders correctly in markdown preview
- [x] All code blocks have proper syntax highlighting
- [x] No broken links or formatting issues

#### Manual Verification
- [x] Draft command is documented with clear examples
- [x] All flags and arguments are explained
- [x] Workflow diagram shows draft's place in pipeline
- [x] "Coming Soon" section is updated to remove `analyze` and `draft`
- [x] Status reflects current implementation state
- [x] Examples are practical and realistic

---

## Phase 6: Integration Verification

### Changes Required

**No file changes** - this phase verifies the complete integration.

### Integration Tests

#### Test 1: Full Workflow (New User)
```bash
# Start fresh
rm -rf writing .claude-pen

# Initialize workspace
bun run src/index.ts init
# Respond to prompts: name, provider, model

# Create raw notes
cat > writing/raw/first-post.md << 'EOF'
Why I'm building in public

- transparency builds trust
- feedback loop is faster
- forces you to ship
- creates content automatically
EOF

# Generate draft WITHOUT style guide
bun run src/index.ts draft writing/raw/first-post.md

# Verify draft exists
cat writing/drafts/first-post.md
```

**Expected behavior:**
- Warning about missing style guide
- Draft generated with generic professional tone
- File created at correct location
- Content is coherent and structured

#### Test 2: Full Workflow (With Style Guide)
```bash
# Add existing writing to analyze
mkdir -p writing/content/blog
cat > writing/content/blog/2024-01-15-example.md << 'EOF'
---
title: Example Post
date: 2024-01-15
platform: blog
---

This is my writing style. I use short sentences. I prefer active voice.
EOF

# Generate style guide
bun run src/index.ts analyze

# Create new notes
cat > writing/raw/second-post.md << 'EOF'
thoughts on mvp development
- start with manual process
- automate only what hurts
EOF

# Generate draft WITH style guide
bun run src/index.ts draft writing/raw/second-post.md

# Verify style guide was used
cat writing/drafts/second-post.md
```

**Expected behavior:**
- No warning about style guide
- Draft matches style from example post
- Short sentences, active voice reflected

#### Test 3: Error Recovery
```bash
# Test missing file
bun run src/index.ts draft nonexistent.md
# Expected: Clear error, exit code 1

# Test empty notes file
echo "" > writing/raw/empty.md
bun run src/index.ts draft writing/raw/empty.md
# Expected: Should handle gracefully (LLM may return minimal output)

# Test malformed markdown
echo "# Unterminated \`code block" > writing/raw/broken.md
bun run src/index.ts draft writing/raw/broken.md
# Expected: Should work (content passed as-is to LLM)
```

### Success Criteria

#### Automated Verification
- [x] All commands exit with correct codes (0 = success, 1 = error)
- [x] TypeScript types are correct throughout workflow
- [x] No runtime errors during normal operation

#### Manual Verification
- [x] Draft command integrates seamlessly with init
- [x] Draft works before and after analyze command
- [x] Output files are in correct directories
- [x] Console messages guide user through workflow
- [x] Error messages help user fix problems
- [x] Word counts are accurate and helpful
- [x] Next steps suggestions are appropriate

---

## Rollback Plan

If the draft command has critical issues:

### Immediate Rollback

```bash
# Revert CLI registration
git checkout src/index.ts

# Remove command file
rm src/commands/draft.ts

# Remove prompt template
rm src/prompts/draft.md

# Revert README
git checkout README.md

# Verify clean state
bun run typecheck
```

### Partial Rollback (Keep Code, Remove from CLI)

If command works but needs refinement:

```typescript
// Comment out in src/index.ts
/*
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
*/
```

This keeps code in place for testing while hiding from users.

---

## Post-Implementation Checklist

After completing all phases:

- [x] All automated tests pass
- [x] All manual test cases verified
- [x] Documentation is complete and accurate
- [x] No TypeScript errors
- [x] No lint warnings
- [x] Console output matches project style
- [x] Error handling is comprehensive
- [x] File paths use correct directory structure (`writing/` not `corpus/`)
- [x] Code follows existing patterns from analyze/ingest commands
- [x] README reflects new capabilities accurately

---

## Notes for Implementation

### Critical Path Corrections

The research identified that the original plan used incorrect paths:

- ❌ WRONG: `corpus/_style_guide.md`
- ✅ CORRECT: `writing/_style_guide.md`

All code examples in this plan use the correct paths confirmed in the codebase.

### Implementation Order

Phases must be completed sequentially:
1. Prompt template → 2. Command logic → 3. CLI registration → 4. Testing → 5. Documentation

Do not skip testing phase - it catches integration issues before documentation.

### Style Consistency

Match these patterns from existing commands:
- ✏️ emoji for draft creation (matches init's setup theme)
- ✓ for success messages
- ⚠ for warnings (yellow)
- Dim text for secondary information
- Cyan for suggested next commands
- Bold for section headers

### LLM Token Budget

Draft generation may produce long output (1000-3000 words typical). The `maxTokens: 8000` setting provides headroom for comprehensive drafts without excessive cost.

### Future Enhancements

Consider for future iterations (NOT in this plan):
- `--template` flag for different draft structures (blog, newsletter, thread)
- `--append` flag to append to existing drafts
- `--platform` flag to hint at target platform
- Progress indication for very long notes (>5000 words)

---

## Success Definition

The draft command is successfully implemented when:

1. ✅ A user can run `claude-pen draft writing/raw/notes.md` immediately after `claude-pen init`
2. ✅ The draft is coherent, well-structured, and ready for human review
3. ✅ The command works with and without a style guide
4. ✅ Console output guides the user clearly through the process
5. ✅ Error messages help users fix problems quickly
6. ✅ Documentation enables new users to understand and use the feature
7. ✅ Code follows all existing project patterns and conventions

---

**Plan Created:** 2025-12-08
**Ready for Implementation:** Yes
**Dependencies:** None (all utilities exist)
