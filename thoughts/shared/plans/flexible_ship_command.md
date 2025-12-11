# Implementation Plan: Format-Aware Ship Command

**Date**: 2025-12-10
**Status**: Planning
**Goal**: Make `ship` command flexible to handle both promotional distribution (blog → social) and direct publishing (social-first workflow)

---

## Problem Statement

**Current Limitation:**
The `ship` command only supports one workflow: blog post → promotional social captions. This doesn't support the social-first workflow where users want to create content directly for LinkedIn/Twitter.

**User Requirements:**
1. **Blog-first workflow** (existing): Create promotional captions to drive traffic to blog
2. **Social-first workflow** (new): Prepare/publish content directly to social platforms

**Key Insight:**
The same command (`ship`) should behave differently based on the **format** (target platform) of the draft.

---

## Architecture Overview

### Format Detection Strategy

Ship needs to know: "Is this a blog post (needs promotion) or social content (needs publishing)?"

**Option 1: Frontmatter-based** (Recommended)
- Draft command writes format to frontmatter
- Ship reads format and adapts behavior
- Clean, explicit, follows existing patterns

**Option 2: Filename convention**
- `draft-linkedin.md` = LinkedIn content
- `draft.md` = Blog content
- Less explicit, error-prone

**Option 3: Command flag**
- `ship draft.md --mode promo` vs `ship draft.md --mode publish`
- User needs to remember, not automatic

**Decision: Use Option 1 (Frontmatter)**

---

## Data Flow: Format Through Pipeline

### Blog Workflow
```
draft notes.md
  ↓ (no --format flag)
  ↓ Creates: draft.md
  ↓ Frontmatter: { format: 'blog' }
  ↓
refine draft.md
  ↓ (preserves frontmatter)
  ↓
ship draft.md --url https://...
  ↓ Reads format: 'blog'
  ↓ Behavior: Create promotional posts
  ↓ Outputs: draft-linkedin.md, draft-twitter.md (promotional captions)
```

### Social-First Workflow
```
draft notes.md --format linkedin
  ↓ Creates: draft.md
  ↓ Frontmatter: { format: 'linkedin' }
  ↓
refine draft.md
  ↓ (preserves frontmatter)
  ↓
ship draft.md
  ↓ Reads format: 'linkedin'
  ↓ Behavior: Finalize for LinkedIn
  ↓ Output: draft.md (final version) OR publishes via API
```

---

## Implementation Phases

### Phase 1: Add Format Metadata

**Goal**: Enable draft command to specify target format

#### Changes Required

**1.1 Extend Types**

**File**: `src/types.ts`
**Changes**: Add format metadata interface

```typescript
export type ContentFormat = 'blog' | 'linkedin' | 'twitter' | 'substack';

export interface DraftMetadata {
  format: ContentFormat;
  created: string;
  source?: string;
  word_count?: number;
}
```

**1.2 Update Draft Command**

**File**: `src/commands/draft.ts`
**Changes**: Add `--format` option and write to frontmatter

Add to DraftOptions interface (line 11):
```typescript
interface DraftOptions {
  output?: string;
  stdin?: boolean;
  format?: ContentFormat;  // NEW
}
```

Update draft output section (around line 138):
```typescript
// Determine format (default to blog)
const format = options.format || 'blog';

// Create frontmatter
const frontmatter: DraftMetadata = {
  format,
  created: new Date().toISOString(),
  source: sourceName,
  word_count: draftWordCount,
};

// Write draft with frontmatter
writeMarkdown(outputPath, frontmatter, draftContent.trim());
```

**1.3 Register --format Flag**

**File**: `src/index.ts`
**Changes**: Add format option to draft command (around line 62)

```typescript
program
  .command('draft [notes]')
  .description('Transform raw notes into a structured draft')
  .option('--stdin', 'Read notes from stdin instead of file')
  .option('--output <path>', 'Custom output path')
  .option('--format <format>', 'Target format: blog, linkedin, twitter, substack (default: blog)')  // NEW
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

#### Success Criteria

**Automated:**
- [x] `bun run typecheck` passes
- [ ] Can run `claude-pen draft notes.md --format linkedin`

**Manual:**
- [ ] Draft created with frontmatter contains `format: linkedin`
- [ ] Default format is `blog` when --format not specified
- [ ] Invalid format shows error and suggests valid options
- [ ] Refine command preserves format in frontmatter

---

### Phase 2: Format-Aware Ship Behavior

**Goal**: Ship command adapts based on draft format

#### Ship Behavior Matrix

| Format | Ship Behavior | Output |
|--------|--------------|--------|
| **blog** | Create promotional posts | `draft-linkedin.md`, `draft-twitter.md` (captions) |
| **linkedin** | Finalize LinkedIn post | `draft.md` (updated in place) |
| **twitter** | Finalize Twitter thread | `draft.md` (updated, formatted as thread) |
| **substack** | Prepare Substack version | `draft.md` (updated with Substack formatting) |

#### Changes Required

**2.1 Update Ship Command Logic**

**File**: `src/commands/ship.ts`
**Changes**: Read format and branch behavior

Add format detection (after line 89):
```typescript
export async function ship(draftPath: string, options: ShipOptions): Promise<void> {
  // Validate input file
  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  // Read draft and detect format
  const { frontmatter, content } = readMarkdown(draftPath);
  const format = (frontmatter.format as ContentFormat) || 'blog';

  // Branch based on format
  if (format === 'blog') {
    await shipBlogPost(draftPath, content, options);
  } else {
    await shipSocialContent(draftPath, content, format, options);
  }
}
```

**2.2 Refactor Existing Ship Logic**

Move current ship logic to `shipBlogPost`:

```typescript
async function shipBlogPost(
  draftPath: string,
  content: string,
  options: ShipOptions
): Promise<void> {
  console.log(chalk.bold('\n📤 Creating promotional posts\n'));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  console.log(chalk.dim(`  Note: Posts will include URL placeholder - replace before publishing\n`));

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Create promotional posts for each platform
  // NOTE: URL is now a placeholder in the prompts, not a parameter
  // Prompts will output: "[INSERT YOUR BLOG URL HERE]"
  // ... existing logic from lines 100-136
}
```

**2.3 Implement Social Content Finalization**

New function for social-first workflow:

```typescript
async function shipSocialContent(
  draftPath: string,
  content: string,
  format: ContentFormat,
  options: ShipOptions
): Promise<void> {
  console.log(chalk.bold(`\n📤 Finalizing ${format} post\n`));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  console.log();

  const spinner = ora(`Preparing final ${format} version...`).start();

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Load format-specific finalization prompt
  const promptTemplate = loadPrompt(`ship/${format}-finalize`);
  const prompt = interpolate(promptTemplate, {
    style_guide: styleGuide,
    content: content,
  });

  try {
    const finalContent = await complete(prompt, {
      system: `You are finalizing content for ${format}, ensuring it meets platform best practices.`,
      maxTokens: 2000,
    });

    // Update draft in place
    const { frontmatter } = readMarkdown(draftPath);
    writeMarkdown(draftPath, frontmatter, finalContent.trim());

    spinner.succeed(`${format} post finalized`);

    // Summary
    console.log(chalk.green('\n✓ Post Ready to Publish'));
    console.log(chalk.dim(`  File: ${draftPath}`));
    console.log(chalk.bold('\n📝 Next Steps:'));
    console.log(chalk.dim(`  1. Review the final ${format} post`));
    console.log(chalk.dim(`  2. Copy content to ${format}`));
    console.log(chalk.dim(`  3. Publish and engage`));
  } catch (error) {
    spinner.fail('Finalization failed');
    console.error(chalk.dim(`  ${error}`));
    process.exit(1);
  }
}
```

#### Success Criteria

**Automated:**
- [x] `bun run typecheck` passes
- [x] Ship detects format from frontmatter

**Manual:**
- [ ] Blog draft → ship creates promotional posts
- [ ] LinkedIn draft → ship finalizes LinkedIn post
- [ ] Twitter draft → ship finalizes Twitter thread
- [ ] Error handling for missing frontmatter
- [x] Graceful fallback to blog format if format missing

---

### Phase 3: Format-Specific Finalization Prompts

**Goal**: Create prompts for finalizing social content (not promoting it)

**Note**: Existing promotional prompts have been updated to remove --url flag:
- `src/prompts/ship/linkedin.md` - Now uses placeholder `[INSERT YOUR BLOG URL HERE]`
- `src/prompts/ship/twitter.md` - Now uses placeholder `[INSERT YOUR BLOG URL HERE]`
- Removed `{{#if url}}` conditional logic
- Ship command no longer needs to process URL parameter for promotional posts

#### Prompts to Create

**3.1 LinkedIn Finalization Prompt**

**File**: `src/prompts/ship/linkedin-finalize.md`

```markdown
You are finalizing a LinkedIn post for publishing.

## Author's Style Guide

{{style_guide}}

## LinkedIn Best Practices

- Hook in the first line (shown before "see more")
- Short paragraphs (1-2 sentences max)
- Line breaks between paragraphs for mobile readability
- No markdown formatting (LinkedIn doesn't render it)
- Optimal length: 1,200-1,500 characters
- Use emojis sparingly, only if consistent with style
- End with engagement prompt or clear takeaway
- Include 2-3 relevant hashtags at the very end

## Task

Finalize this draft for LinkedIn. This is the FULL POST, not a promotional teaser. Ensure it follows LinkedIn best practices while preserving the author's voice and message.

Output only the final LinkedIn post. No preamble, no explanation.

## Draft

{{content}}
```

**3.2 Twitter Finalization Prompt**

**File**: `src/prompts/ship/twitter-finalize.md`

```markdown
You are finalizing a Twitter/X thread for publishing.

## Author's Style Guide

{{style_guide}}

## Twitter Thread Best Practices

- First tweet must hook - determines if people read the rest
- Each tweet MUST be under 280 characters (this is critical)
- Thread length: Depends on content (5-15 tweets typical)
- Number tweets (1/, 2/, 3/, etc.) for clarity
- Each tweet should be self-contained but flow to next
- Use line breaks within tweets for readability
- End with clear conclusion or call-to-action

## Task

Finalize this draft as a Twitter thread. Format it properly with numbered tweets, ensure each is under 280 characters, and maintain the author's voice.

Output the thread with each tweet on its own line, separated by blank lines. Start each tweet with its number (e.g., "1/").

## Draft

{{content}}
```

#### Success Criteria

**Automated:**
- [x] Files created in `src/prompts/ship/`
- [x] Both prompts exist

**Manual:**
- [x] Prompts emphasize "final post" not "promotional"
- [x] Platform-specific constraints included
- [x] Style guide integration consistent
- [x] Clear output format instructions

---

### Phase 4: Review & Refine Format Awareness

**Goal**: Ensure review and refine commands work with format-aware drafts

#### Changes Required

**4.1 Review Command**

**File**: `src/commands/review.ts`
**Changes**: Consider format in review suggestions

Currently review doesn't need format awareness, but could benefit from platform-specific review criteria in the future.

**4.2 Refine Command**

**File**: `src/commands/refine.ts`
**Changes**: Ensure frontmatter preservation

The refine command already preserves frontmatter (uses `readMarkdown` and `writeMarkdown`), so no changes needed. Verify it works correctly.

#### Success Criteria

**Manual:**
- [x] Refine preserves format in frontmatter
- [x] Review can read format-aware drafts
- [x] All refinement passes work with social formats

---

### Phase 5: Documentation & Examples

**Goal**: Document the new workflow

#### Changes Required

**5.1 Update README**

**File**: `README.md`
**Changes**: Add social-first workflow documentation

Add new section after "Ship to Social Media":

```markdown
### Social-First Workflow

Create content directly for social platforms instead of promoting a blog post:

#### LinkedIn Post from Voice Memo

```bash
# 1. Create LinkedIn draft from notes
cat voice-memo.txt | claude-pen draft --stdin --format linkedin

# 2. Review and refine
claude-pen refine draft.md --pass clarity

# 3. Finalize for LinkedIn
claude-pen ship draft.md

# 4. Copy to LinkedIn and publish
```

#### Twitter Thread from Notes

```bash
# 1. Create Twitter thread draft
claude-pen draft notes.md --format twitter

# 2. Refine for punchiness
claude-pen refine draft.md --pass punchier

# 3. Finalize thread formatting
claude-pen ship draft.md

# 4. Copy thread to Twitter
```

**Format-Specific Behavior:**

| Format | Draft Behavior | Ship Behavior |
|--------|----------------|---------------|
| `blog` (default) | Creates blog post | Generates promotional posts for LinkedIn + Twitter |
| `linkedin` | Creates LinkedIn post | Finalizes LinkedIn formatting, no promotional posts |
| `twitter` | Creates Twitter thread | Finalizes thread, ensures 280 char limits |
| `substack` | Creates Substack article | Finalizes Substack formatting |

**When to use which workflow:**

- **Blog-first**: You're publishing long-form content and want to drive traffic
  - Example: Technical tutorials, long essays, detailed guides
  - Use: `draft notes.md` (no --format flag)

- **Social-first**: You're creating native platform content
  - Example: LinkedIn thought leadership, Twitter threads, quick insights
  - Use: `draft notes.md --format linkedin` or `--format twitter`
```

**5.2 Update CLAUDE.md**

Add to project conventions:

```markdown
## Format-Aware Pipeline

All drafts now include format metadata in frontmatter. This enables the pipeline to adapt behavior:

**Metadata Structure:**
```yaml
---
format: blog | linkedin | twitter | substack
created: 2025-12-10T10:30:00Z
source: notes.md
word_count: 1250
---
```

**Impact on Commands:**
- `draft`: Writes format to frontmatter
- `refine`: Preserves format in frontmatter
- `ship`: Reads format and adapts behavior
  - Blog format → creates promotional posts
  - Social formats → finalizes for publishing
```

#### Success Criteria

**Manual:**
- [x] README documents social-first workflow
- [x] Examples show both blog and social workflows
- [x] Format behavior matrix is clear
- [x] CLAUDE.md updated with format architecture

---

## Rollback Plan

### Phase 1 Rollback
```bash
git checkout src/types.ts src/commands/draft.ts src/index.ts
```

### Phase 2 Rollback
```bash
git checkout src/commands/ship.ts
```

### Phase 3 Rollback
```bash
rm src/prompts/ship/linkedin-finalize.md
rm src/prompts/ship/twitter-finalize.md
```

### Complete Rollback
```bash
git checkout src/types.ts src/commands/draft.ts src/commands/ship.ts src/index.ts
rm src/prompts/ship/*-finalize.md
```

---

## Future Enhancements

### Direct Publishing (Phase 6)

Add actual API publishing instead of just finalizing:

```bash
# Publish directly to LinkedIn
claude-pen ship draft.md --publish

# Would require:
# - LinkedIn API integration
# - OAuth authentication
# - API credentials in config
```

### Multi-Platform Distribution (Phase 7)

One draft, multiple formats:

```bash
# Create blog post and promotional posts
claude-pen draft notes.md --formats blog,linkedin,twitter

# Ship would:
# 1. Finalize blog version
# 2. Create LinkedIn version
# 3. Create Twitter version
```

### Format-Specific Review (Phase 8)

Review criteria adapt to format:

```bash
claude-pen review draft.md

# LinkedIn draft → checks hook strength, paragraph length
# Twitter draft → checks character counts, thread flow
# Blog draft → checks SEO, readability, structure
```

### Format-Specific Voice Profiles (Phase 9: Analyze Extension)

Expand the `analyze` command to learn format-specific voices:

**Current Behavior:**
- `claude-pen analyze` generates single style guide from all writing samples
- Style guide at: `writing/_style_guide.md`

**Future Enhancement:**
```bash
# Analyze platform-specific voice
claude-pen analyze --platform linkedin
# Outputs: writing/_styles/linkedin.md

claude-pen analyze --platform twitter
# Outputs: writing/_styles/twitter.md

# Use platform-specific voice in drafts
claude-pen draft notes.md --format linkedin
# Automatically loads writing/_styles/linkedin.md if exists
```

**Implementation Notes:**
- Analyze command already has platform detection (src/commands/analyze.ts:9)
- Already groups samples by platform (analyze.ts:60-68)
- Would need to:
  1. Add --platform flag to analyze command
  2. Filter samples to single platform
  3. Output to platform-specific style guide path
  4. Update draft/refine to load format-specific style guide first

**Use Case:**
- Your LinkedIn voice might be more professional/thought-leadership
- Your Twitter voice might be punchier/more casual
- Your blog voice might be more detailed/tutorial-focused
- Each gets its own style guide learned from past examples

---

## Design Decisions

1. **Ship updates in-place for social formats** ✅
   - Social-first workflow updates draft.md with finalized version
   - User controls versioning via git
   - Simpler mental model than creating separate files

2. **Remove --url flag completely** ✅
   - Blog promotional posts use placeholder: `[INSERT YOUR BLOG URL HERE]`
   - Forces user to consciously add the link
   - Prevents accidental posting with template text
   - Cleaner UX - one less thing to remember

3. **Format defaults to 'blog'** ✅
   - Backward compatible with existing workflow
   - Blog-first is most common use case
   - Users opt-in to social-first with --format flag

4. **Analyze command future expansion** 📋
   - Current analyze: Learns voice from writing samples
   - Future: Could generate format-specific voice profiles
   - Example: LinkedIn voice vs blog voice vs Twitter voice
   - Deferred to future enhancement

5. **Substack format behavior**
   - Substack gets finalized (long-form, platform-specific formatting)
   - Similar to social-first workflow (not promotional)

6. **Format changes mid-pipeline**
   - Edge case: User creates blog draft, wants it as LinkedIn
   - Defer to later - can manually change frontmatter if needed

---

## Success Metrics

After implementation, the flexible ship command should:

1. **Support Both Workflows**
   - Blog-first → promotional posts (existing)
   - Social-first → direct finalization (new)

2. **Be Intuitive**
   - Format flag feels natural
   - Ship behavior matches expectations
   - Clear documentation and examples

3. **Maintain Quality**
   - Promotional posts still high quality
   - Social finalization follows best practices
   - Style guide integration consistent

4. **Be Extensible**
   - Easy to add new formats
   - Custom prompts via override system
   - Future API publishing possible

---

**Next Steps:**
1. Review this plan with user
2. Confirm design decisions
3. Implement Phase 1 (format metadata)
4. Test format propagation through pipeline
5. Implement Phase 2 (ship behavior)
6. Create finalization prompts
7. Document workflows
