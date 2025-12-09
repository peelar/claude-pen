# Implementation Plan: Format Command

**Date**: 2025-12-08
**Research**: `thoughts/shared/research/07-format_command_integration.md`

## Overview

Implement the `claude-pen format` command that adapts drafts for specific publishing platforms (LinkedIn, Twitter, Substack, Blog) while preserving the author's unique voice. The command will:

- Accept a draft file path and optional `--for` platform flag
- Format for all 4 platforms by default, or a specific platform when requested
- Load the user's style guide (with graceful fallback)
- Apply platform-specific formatting rules using Claude
- Write formatted outputs with platform suffixes (e.g., `post-linkedin.md`)
- Display statistics and next steps for each platform

## Implementation Approach

This implementation follows the established patterns from `draft.ts` and `refine.ts`:
- Similar workflow: read file → load style guide → prompt → LLM → write
- Reuse existing utility functions from `lib/files.ts`, `lib/prompts.ts`, `lib/llm.ts`
- Four separate prompt files for platform-specific formatting
- Intelligent output path generation (removes existing platform suffixes)
- Batch processing mode for "format all" default behavior

**Why this approach:**
1. Consistency with existing codebase patterns (validated across 5 commands)
2. Platform-specific prompts enable focused optimization
3. Default "all platforms" behavior maximizes publishing efficiency
4. Clean filename handling prevents `post-twitter-linkedin.md` accumulation
5. Follows `Platform` type already defined in `types.ts`

**Prerequisites (MUST be completed first):**
- Register refine command in `src/index.ts` (currently unregistered)
- Create missing refine prompt files (`proofread.md`, `punchier.md`, `clarity.md`)

---

## Phase 0: Prerequisites - Complete Refine Command

### Changes Required

#### 1. Register Refine Command
**File**: `src/index.ts`
**Location**: After draft command registration (around line 105)
**Changes**: Import and register the refine command

```typescript
// Add import with other command imports
import { refine } from './commands/refine.js';

// Add command registration after draft command
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

#### 2. Create Proofread Prompt
**File**: `src/prompts/proofread.md`
**Changes**: Create prompt for grammar and spelling fixes

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

#### 3. Create Punchier Prompt
**File**: `src/prompts/punchier.md`
**Changes**: Create prompt for tightening prose

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

#### 4. Create Clarity Prompt
**File**: `src/prompts/clarity.md`
**Changes**: Create prompt for improving flow

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
- [ ] TypeScript compilation passes: `bun run typecheck`
- [ ] Refine command appears in help: `bun run src/index.ts --help`
- [ ] All three prompt files exist

#### Manual Verification
- [ ] Refine command executes without import errors
- [ ] Prompt files have correct placeholders (`{{style_guide}}`, `{{content}}`)
- [ ] Help text displays correctly: `bun run src/index.ts refine --help`

---

## Phase 1: Platform Format Prompts

### Changes Required

#### 1. Create LinkedIn Prompt
**File**: `src/prompts/format/linkedin.md`
**Changes**: Create prompt for LinkedIn formatting

```markdown
You are an expert content formatter who adapts writing for LinkedIn while preserving the author's authentic voice.

## Author's Style Guide

{{style_guide}}

## Task

Format the content below for LinkedIn. Your goal is to optimize for the platform while maintaining the author's unique voice and core message.

**LinkedIn Platform Requirements:**

1. **No markdown** - LinkedIn doesn't support markdown formatting
2. **Short paragraphs** - 1-3 sentences maximum for readability
3. **Line breaks** - Use blank lines between paragraphs for mobile viewing
4. **Hooks** - Start with an attention-grabbing first line
5. **Engagement** - End with a question or call to action
6. **Hashtags** - Include 3-5 relevant hashtags at the end
7. **Professional tone** - Slightly more polished than blog posts, but keep personality

**Formatting Guidelines:**
- Remove H1/H2/H3 headers and integrate them naturally into the flow
- Convert bullet points to numbered points or short paragraphs
- Remove code blocks or technical formatting
- Keep emojis minimal and professional (optional)
- Aim for 1200-1500 characters for feed visibility

Important:
- Preserve the author's voice, vocabulary, and key phrases
- Maintain the core argument and examples
- Do NOT add corporate jargon or buzzwords
- Do NOT make it overly promotional
- Output only the formatted content

## Content to Format

{{content}}
```

#### 2. Create Twitter Prompt
**File**: `src/prompts/format/twitter.md`
**Changes**: Create prompt for Twitter thread formatting

```markdown
You are an expert content formatter who adapts writing for Twitter while preserving the author's authentic voice.

## Author's Style Guide

{{style_guide}}

## Task

Format the content below as a Twitter thread. Your goal is to break the content into tweet-sized pieces while maintaining the author's unique voice and core message.

**Twitter Platform Requirements:**

1. **Character limit** - Each tweet must be under 280 characters (including spaces and punctuation)
2. **Thread structure** - Number each tweet (1/, 2/, 3/, etc.)
3. **Hook first** - Tweet 1 must grab attention and promise value
4. **One idea per tweet** - Each tweet should be self-contained but flow into the next
5. **Natural breaks** - Split at logical idea boundaries
6. **Strong ending** - Final tweet should provide a takeaway or call to action
7. **No hashtags in thread** - Save hashtags for the final tweet only

**Formatting Guidelines:**
- Remove markdown formatting
- Keep language punchy and direct
- Use line breaks within tweets sparingly (counts against 280 chars)
- Aim for 8-15 tweets total (longer threads lose engagement)
- Each tweet should work standalone but contribute to the whole

Important:
- Preserve the author's voice, vocabulary, and key phrases
- Maintain the core argument and examples
- Do NOT add emoji spam or excessive punctuation
- Do NOT split mid-sentence awkwardly
- Verify each tweet is under 280 characters
- Output only the formatted thread

## Content to Format

{{content}}
```

#### 3. Create Substack Prompt
**File**: `src/prompts/format/substack.md`
**Changes**: Create prompt for Substack/newsletter formatting

```markdown
You are an expert content formatter who adapts writing for Substack newsletters while preserving the author's authentic voice.

## Author's Style Guide

{{style_guide}}

## Task

Format the content below for Substack. Your goal is to optimize for email newsletters while maintaining the author's unique voice and core message.

**Substack Platform Requirements:**

1. **Email format** - Optimized for inbox reading and web archive
2. **Compelling subject line** - Create a headline that works in email subject lines
3. **Strong preview text** - First 140 characters should hook readers
4. **Section headers** - Use clear H2/H3 headers for skimmability
5. **Paragraph length** - 2-4 sentences ideal for email reading
6. **Personal tone** - More conversational than blog posts
7. **Metadata** - Include frontmatter with headline, subtitle, and preview

**Formatting Guidelines:**
- Start with YAML frontmatter containing headline, subtitle, and preview
- Use markdown formatting (headers, bold, italic, lists)
- Add horizontal rules (---) to separate major sections
- Keep introduction short and personal
- End with a clear call to action or question
- Aim for 800-1500 words (5-8 minute read)

**Frontmatter Template:**
```
---
headline: "Compelling Subject Line (Under 60 characters)"
subtitle: "Supporting context or benefit"
preview: "First 140 characters that hook the reader and make them want to click..."
---
```

Important:
- Preserve the author's voice, vocabulary, and key phrases
- Maintain the core argument and examples
- Do NOT add generic newsletter language ("Hey subscribers!")
- Do NOT over-format with excessive styling
- Output the complete formatted post with frontmatter

## Content to Format

{{content}}
```

#### 4. Create Blog Prompt
**File**: `src/prompts/format/blog.md`
**Changes**: Create prompt for blog post formatting

```markdown
You are an expert content formatter who adapts writing for blog posts while preserving the author's authentic voice.

## Author's Style Guide

{{style_guide}}

## Task

Format the content below for a blog post. Your goal is to optimize for web reading and SEO while maintaining the author's unique voice and core message.

**Blog Platform Requirements:**

1. **SEO optimization** - Clear title, meta description, and structure
2. **Skimmability** - Use headers, lists, and short paragraphs
3. **Web reading** - Optimize for F-pattern reading behavior
4. **Clear structure** - Introduction, body sections, conclusion
5. **Visual breaks** - Use formatting to create visual rhythm
6. **Metadata** - Include frontmatter with title and meta description

**Formatting Guidelines:**
- Start with YAML frontmatter containing title and meta_description
- Use markdown formatting (H2/H3 headers, bold, italic, lists, code blocks)
- Keep paragraphs 3-5 sentences maximum
- Use bullet points or numbered lists for key takeaways
- Include a clear introduction that previews the content
- End with a conclusion that summarizes and provides next steps
- Aim for 1000-2000 words for SEO sweet spot

**Frontmatter Template:**
```
---
title: "Clear, Compelling Blog Post Title"
meta_description: "150-160 character summary for search results and social sharing"
---
```

Important:
- Preserve the author's voice, vocabulary, and key phrases
- Maintain the core argument and examples
- Do NOT add generic SEO spam or keyword stuffing
- Do NOT make it overly formal or academic
- Output the complete formatted post with frontmatter

## Content to Format

{{content}}
```

### Success Criteria

#### Automated Verification
- [ ] All four prompt files exist in `src/prompts/format/`
- [ ] Prompt files are valid markdown
- [ ] Variable placeholders are correct: `{{style_guide}}`, `{{content}}`

#### Manual Verification
- [ ] Each prompt has platform-specific requirements clearly listed
- [ ] All prompts emphasize voice preservation
- [ ] Formatting guidelines are specific and actionable
- [ ] Output format instructions are clear
- [ ] LinkedIn prompt specifies no markdown
- [ ] Twitter prompt includes character limit validation
- [ ] Substack prompt includes frontmatter template
- [ ] Blog prompt includes SEO considerations

---

## Phase 2: Format Command Implementation

### Changes Required

#### 1. Create Format Command
**File**: `src/commands/format.ts`
**Changes**: Create new command with validation, processing, and output logic

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { getPath, ensureDir, countWords } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';
import type { Platform } from '../types.js';

interface FormatOptions {
  for?: Platform;
}

const ALL_PLATFORMS: Platform[] = ['linkedin', 'twitter', 'substack', 'blog'];

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  linkedin: 'LinkedIn (no markdown, short paragraphs)',
  twitter: 'Twitter thread (280 chars per tweet)',
  substack: 'Substack newsletter (with frontmatter)',
  blog: 'Blog post (SEO optimized)',
};

function loadStyleGuide(): string {
  const stylePath = getPath('corpus', '_style_guide.md');

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Formatting will proceed without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Preserve the existing tone and style.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

function getOutputPath(inputPath: string, platform: Platform): string {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  // Remove existing platform suffix if present
  const cleanName = basename.replace(/-(linkedin|twitter|substack|blog)$/, '');

  return path.join(dir, `${cleanName}-${platform}${ext}`);
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

  const spinner = ora(`Formatting for ${platform}...`).start();

  try {
    const formatted = await complete(prompt, {
      system: `You are an expert content formatter who adapts writing for different platforms while preserving the author's voice. You are formatting for ${platform}.`,
      maxTokens: 8000,
      silent: true,
    });

    spinner.succeed(`Formatted for ${platform}`);
    return formatted;
  } catch (error) {
    spinner.fail(`Formatting for ${platform} failed`);
    throw error;
  }
}

export async function format(draftArg: string, options: FormatOptions): Promise<void> {
  // Resolve and validate file path
  const draftPath = path.resolve(draftArg);

  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  // Determine platforms to format
  const platforms: Platform[] = options.for ? [options.for] : ALL_PLATFORMS;

  // Validate platform if specified
  if (options.for && !ALL_PLATFORMS.includes(options.for)) {
    console.error(chalk.red(`Invalid platform: ${options.for}`));
    console.error(`Valid options: ${ALL_PLATFORMS.join(', ')}`);
    process.exit(1);
  }

  console.log(chalk.bold(`\n📝 Formatting: ${path.basename(draftPath)}`));
  console.log(chalk.dim(`   Platforms: ${platforms.join(', ')}\n`));

  // Load style guide once
  const styleGuide = loadStyleGuide();

  // Read draft content once
  const content = fs.readFileSync(draftPath, 'utf-8');
  const originalWords = countWords(content);

  // Track results
  const results: Array<{ platform: Platform; success: boolean; outputPath?: string; words?: number }> = [];

  // Process each platform
  for (const platform of platforms) {
    try {
      // Format content
      const formatted = await formatForPlatform(content, platform, styleGuide);

      // Generate output path
      const outputPath = getOutputPath(draftPath, platform);

      // Ensure output directory exists
      ensureDir(path.dirname(outputPath));

      // Write formatted content
      fs.writeFileSync(outputPath, formatted, 'utf-8');

      // Calculate stats
      const formattedWords = countWords(formatted);

      results.push({
        platform,
        success: true,
        outputPath,
        words: formattedWords,
      });
    } catch (error) {
      results.push({
        platform,
        success: false,
      });

      console.error(chalk.red(`\n✗ Failed to format for ${platform}`));
      if (process.env.DEBUG) {
        console.error(error);
      }
    }
  }

  // Display results summary
  console.log(chalk.bold('\n✓ Formatting Complete\n'));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log(chalk.dim('  Formatted versions:'));
    for (const result of successful) {
      console.log(chalk.green(`  ✓ ${result.platform}: ${result.outputPath}`));
      console.log(chalk.dim(`    ${originalWords} → ${result.words} words`));
    }
  }

  if (failed.length > 0) {
    console.log(chalk.dim('\n  Failed platforms:'));
    for (const result of failed) {
      console.log(chalk.red(`  ✗ ${result.platform}`));
    }
  }

  // Display next steps
  console.log(chalk.bold('\n📝 Next Steps:'));
  console.log(chalk.dim('  Review and publish formatted versions:'));
  for (const result of successful) {
    console.log(chalk.cyan(`  open ${result.outputPath}`));
  }
  console.log();

  // Exit with error if any platform failed
  if (failed.length > 0) {
    process.exit(1);
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] Build passes: `bun run typecheck`
- [ ] No TypeScript errors in `src/commands/format.ts`
- [ ] All imports resolve correctly

#### Manual Verification
- [ ] Constants are properly typed and match `Platform` type
- [ ] Validation logic matches pattern from `ingest.ts:146-152`
- [ ] Style guide loading follows pattern from `refine.ts:22-32`
- [ ] File path handling matches pattern from `draft.ts:82-90`
- [ ] Output path generation removes existing platform suffixes
- [ ] Error handling allows continuation for multi-platform formatting
- [ ] Results tracking shows successes and failures

---

## Phase 3: CLI Registration

### Changes Required

#### 1. Register Format Command
**File**: `src/index.ts`
**Location**: After refine command registration
**Changes**: Import and register the format command

```typescript
// Add import with other command imports
import { format } from './commands/format.js';

// Add command registration after refine command
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

### Success Criteria

#### Automated Verification
- [ ] Build passes: `bun run typecheck`
- [ ] No import errors
- [ ] Command appears in help output

#### Manual Verification
- [ ] Help displays correctly: `bun run src/index.ts format --help`
- [ ] Command appears in main help: `bun run src/index.ts --help`
- [ ] Option description is clear
- [ ] Default behavior (all platforms) is documented

---

## Phase 4: Integration Testing

### Changes Required

#### 1. Test Format Command
**Command**: Manual execution and verification

```bash
# Test single platform
bun run src/index.ts format test-draft.md --for linkedin
# Expected: Creates test-draft-linkedin.md with no markdown, short paragraphs

bun run src/index.ts format test-draft.md --for twitter
# Expected: Creates test-draft-twitter.md with numbered tweets under 280 chars

bun run src/index.ts format test-draft.md --for substack
# Expected: Creates test-draft-substack.md with frontmatter

bun run src/index.ts format test-draft.md --for blog
# Expected: Creates test-draft-blog.md with frontmatter and SEO structure

# Test all platforms (default)
bun run src/index.ts format test-draft.md
# Expected: Creates 4 files, shows progress for each, displays summary

# Test error handling
bun run src/index.ts format nonexistent.md
# Expected: Shows clear error message

bun run src/index.ts format test-draft.md --for invalid
# Expected: Shows error with valid platform options
```

### Success Criteria

#### Automated Verification
- [ ] Command executes without errors
- [ ] No TypeScript compilation errors: `bun run typecheck`
- [ ] Build succeeds: `bun run typecheck`

#### Manual Verification
- [ ] Invalid platform shows proper error with valid options
- [ ] Missing file shows proper error message
- [ ] Style guide warning appears when no style guide exists
- [ ] Single platform formatting creates one file
- [ ] Multi-platform formatting creates four files
- [ ] Output paths use clean names (no double suffixes)
- [ ] Word count statistics displayed for each platform
- [ ] Next steps show file paths to review
- [ ] Spinners show progress clearly
- [ ] Error on one platform doesn't stop others
- [ ] Summary shows both successes and failures

#### Output Quality Checks (Requires LLM)
- [ ] LinkedIn: No markdown, short paragraphs, hashtags included
- [ ] Twitter: Numbered tweets, each under 280 characters
- [ ] Substack: Frontmatter present with headline/subtitle/preview
- [ ] Blog: Frontmatter present with title/meta_description
- [ ] All: Author voice preserved from original content
- [ ] All: Core message and examples maintained

---

## Phase 5: Documentation

### Changes Required

#### 1. Update README.md
**File**: `README.md`
**Changes**: Document new format command

Add to "Available Commands" section:

```markdown
### `format`

Format drafts for different publishing platforms while preserving your unique voice.

```bash
claude-pen format <draft-file> [--for <platform>]
```

**Options:**
- `--for <platform>` - Specific platform to format for (optional)
  - `linkedin` - LinkedIn post (no markdown, short paragraphs, hashtags)
  - `twitter` - Twitter thread (numbered tweets, 280 char limit)
  - `substack` - Substack newsletter (with frontmatter)
  - `blog` - Blog post (SEO optimized, with frontmatter)

**Default Behavior:** If `--for` is not specified, formats for all platforms.

**Examples:**

```bash
# Format for all platforms (creates 4 files)
claude-pen format drafts/my-post.md

# Format for specific platform
claude-pen format drafts/my-post.md --for linkedin
claude-pen format drafts/my-post.md --for twitter
claude-pen format drafts/my-post.md --for substack
claude-pen format drafts/my-post.md --for blog
```

**Output Files:**
- `drafts/my-post-linkedin.md` - LinkedIn version
- `drafts/my-post-twitter.md` - Twitter thread
- `drafts/my-post-substack.md` - Substack newsletter
- `drafts/my-post-blog.md` - Blog post

**Workflow:**

1. Create initial draft from notes: `claude-pen draft notes.md`
2. Apply refinement passes:
   - `refine drafts/post.md --pass proofread`
   - `refine drafts/post.md --pass punchier`
   - `refine drafts/post.md --pass clarity`
3. Format for publishing: `claude-pen format drafts/post.md`
4. Review and publish platform-specific versions

**Platform-Specific Formatting:**
- **LinkedIn**: Removes markdown, uses short paragraphs, adds hashtags
- **Twitter**: Breaks content into numbered tweets under 280 characters
- **Substack**: Adds newsletter-style frontmatter (headline, subtitle, preview)
- **Blog**: Adds SEO-optimized frontmatter (title, meta description)

**Note:** The format command creates new files with platform suffixes. Original draft remains unchanged.
```

Update "Coming Soon" section if format was listed there (remove it).

#### 2. Update Project Structure Diagram
**File**: `README.md`
**Changes**: Add format prompt subdirectory to project structure

```markdown
└── src/prompts/           # AI prompt templates
    ├── format/            # Platform-specific formatting prompts
    │   ├── linkedin.md
    │   ├── twitter.md
    │   ├── substack.md
    │   └── blog.md
    ├── analyze.md
    ├── draft.md
    ├── proofread.md
    ├── punchier.md
    └── clarity.md
```

### Success Criteria

#### Automated Verification
- [ ] README renders correctly in markdown preview
- [ ] All code blocks have proper syntax highlighting
- [ ] Links and formatting are valid

#### Manual Verification
- [ ] Command is fully documented with all options
- [ ] Examples cover single and multi-platform usage
- [ ] Output file naming is clearly explained
- [ ] Workflow integrates with existing commands
- [ ] Platform-specific formatting details are listed
- [ ] Project structure diagram includes format directory
- [ ] Note about file creation (vs overwriting) is present

---

## Rollback Plan

If issues arise during implementation:

1. **Phase 0 (Prerequisites)**
   - Remove refine import and registration from `src/index.ts`
   - Delete prompt files: `proofread.md`, `punchier.md`, `clarity.md`

2. **Phase 1 (Format Prompts)**
   - Delete entire directory: `src/prompts/format/`

3. **Phase 2 (Format Command)**
   - Delete `src/commands/format.ts`

4. **Phase 3 (CLI Registration)**
   - Remove import line from `src/index.ts`
   - Remove command registration block

5. **Phase 4-5 (Testing/Docs)**
   - Revert README.md changes: `git checkout README.md`

**Complete rollback:**
```bash
git checkout src/index.ts README.md
rm -rf src/commands/format.ts
rm -rf src/prompts/format/
rm -f src/prompts/proofread.md src/prompts/punchier.md src/prompts/clarity.md
```

---

## Implementation Notes

### Dependencies on Existing Code
- **Types**: `Platform` already exists in `src/types.ts:3`
- **Utilities**: All required functions exist in `lib/` modules
- **Patterns**: Following exact structure from `draft.ts` and `refine.ts`
- **Infrastructure**: `init.ts` already creates `.claude-pen/prompts/format/` directory

### Key Design Decisions
1. **Subdirectory for prompts**: Cleaner organization, matches init setup
2. **Default to all platforms**: Maximizes utility, users can filter with `--for`
3. **Platform suffix on output**: Clear naming, prevents overwrites
4. **Remove existing suffix**: Prevents `post-twitter-linkedin.md` accumulation
5. **8000 max_tokens**: Handles most draft lengths (≈32k chars, 6000 words)
6. **Continue on error**: One platform failure shouldn't block others
7. **Results summary**: Clear feedback on what succeeded/failed

### Testing Strategy
Manual testing with real content is critical because:
- Platform constraints are specific (280 chars, frontmatter format)
- Voice preservation is subjective and context-dependent
- Each platform should feel native while maintaining core message
- Style guide integration varies by user

### Potential Issues and Mitigations

1. **Large files exceed token limits**
   - Impact: Files >6000 words may fail
   - Mitigation: Document limitation, suggest splitting drafts
   - Detection: Monitor for token limit errors

2. **Twitter character count accuracy**
   - Impact: LLMs may miscalculate, producing tweets >280 chars
   - Mitigation: Consider post-processing validation
   - Future: Add automatic tweet validation and warning

3. **Multiple API calls for "all platforms"**
   - Impact: Longer wait time, higher API costs
   - Mitigation: Clear progress indicators, allow single platform option
   - Future: Consider concurrent API calls (respect rate limits)

4. **Style guide quality variations**
   - Impact: Poor style guides may degrade platform formatting
   - Mitigation: Already handled with fallback text
   - User education: README should suggest running `analyze` first

5. **Platform-specific edge cases**
   - LinkedIn: Very long posts may need manual editing
   - Twitter: Complex threads may need manual reordering
   - Substack: Frontmatter may need customization
   - Blog: SEO metadata may need manual optimization
   - Mitigation: Document as expected, position as "first draft"

---

## Success Validation Checklist

Before considering this feature complete:

### Prerequisites
- [ ] Refine command registered in `src/index.ts`
- [ ] All three refine prompts created and tested

### Core Implementation
- [ ] All TypeScript compilation passes
- [ ] Format command registered and appears in help
- [ ] All four platform prompts created with correct structure
- [ ] Command accepts valid platform options
- [ ] Command rejects invalid platforms with helpful error

### Functionality
- [ ] Single platform formatting works
- [ ] Multi-platform formatting works (all 4 platforms)
- [ ] Style guide loading works (with and without guide)
- [ ] Output path generation removes existing suffixes
- [ ] Word count statistics accurate for all platforms
- [ ] Next steps display correct file paths

### Error Handling
- [ ] Missing file shows clear error
- [ ] Invalid platform shows error with valid options
- [ ] API errors don't crash entire multi-platform batch
- [ ] Failed platforms shown in summary

### Output Quality
- [ ] LinkedIn output has no markdown
- [ ] LinkedIn output uses short paragraphs
- [ ] Twitter output has numbered tweets
- [ ] Twitter tweets are under 280 characters
- [ ] Substack output has proper frontmatter
- [ ] Blog output has proper frontmatter
- [ ] All outputs preserve author voice
- [ ] All outputs maintain core message

### Documentation
- [ ] README documentation complete
- [ ] All options and platforms documented
- [ ] Examples cover common use cases
- [ ] Workflow section integrates with other commands
- [ ] Project structure diagram updated

### Polish
- [ ] Spinners show clear progress
- [ ] Colors and formatting consistent with other commands
- [ ] Next steps are helpful and actionable
- [ ] Error messages are clear and actionable

---

## Timeline Estimate

Estimated implementation order (all phases in one session):

1. Phase 0: Prerequisites - Refine Setup (20 min)
2. Phase 1: Platform Format Prompts (45 min)
3. Phase 2: Format Command Implementation (30 min)
4. Phase 3: CLI Registration (5 min)
5. Phase 4: Integration Testing (30 min)
6. Phase 5: Documentation (15 min)

**Total**: ~2.5 hours for complete implementation and testing

---

## Post-Implementation Enhancements (Future)

Nice-to-have features for future iterations:

1. **Dry run mode**: `--dry-run` flag to preview without writing
2. **Custom output directory**: `-o, --output-dir` option
3. **Twitter character validation**: Automatic detection of tweets >280 chars
4. **Concurrent formatting**: Parallel API calls for faster multi-platform
5. **Batch processing**: Format multiple drafts at once
6. **Platform templates**: User-customizable platform prompts
7. **Format preview**: Show sample output before committing
8. **Platform analytics**: Track character counts, word counts per platform
9. **Reformat detection**: Warn if formatting already-formatted file

These can be added in future phases based on user feedback.
