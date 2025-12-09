# Implementation Plan: Ship Command (Promotional)

## Overview

Implement the `claude-pen ship` command that creates promotional social media posts to announce published content. The command takes a draft/article and generates short, engaging posts for LinkedIn and Twitter that drive traffic to the main piece.

**Key Principle**: Ship is promotional-only by default. Users who want different behavior (full content adaptation, different platforms, etc.) can customize via prompt overrides in `.claude-pen/prompts/`.

## Implementation Approach

**Philosophy**: Keep the CLI simple, enable customization through prompts.

- **No mode flags** - Always creates promotional content (no `--promote`, `--adapt`, etc.)
- **No platform flags** - Always creates LinkedIn + Twitter posts (no `--for`)
- **Optional URL** - If provided, includes link. If not, uses fallback message
- **Take content as-is** - No forced LLM changes to the source article
- **Prompt-driven customization** - Users override `.claude-pen/prompts/ship/linkedin.md` or `ship/twitter.md` to change behavior

**Why promotional-only:**
- Matches the most common real-world workflow: publish → announce
- Keeps command interface simple and focused
- Avoids feature bloat with multiple modes
- Customization happens through prompts (already architected)

## Prerequisites

- All previous commands (init, ingest, analyze, draft, review, refine) implemented
- Style guide generation working via `analyze` command
- Drafts directory structure in place
- Prompt override system working (`.claude-pen/prompts/` takes precedence)

## Phase 1: Create Promotional Prompt Templates

### Changes Required

#### 1. LinkedIn Promotional Prompt
**File**: `src/prompts/ship/linkedin.md`
**Changes**: Create new prompt for LinkedIn promotional posts

```markdown
You are creating a promotional LinkedIn post to announce published content.

## Author's Style Guide

{{style_guide}}

## LinkedIn Promotional Best Practices

- Hook in the first line (it's all people see before "see more")
- Short paragraphs (1-2 sentences max)
- Line breaks between paragraphs for mobile readability
- No markdown formatting (LinkedIn doesn't render it)
- Optimal length: 150-300 characters for promotional posts
- Tease the content without giving everything away
- Create curiosity or promise value
- Clear call-to-action at the end
- Use emojis sparingly and only if consistent with author's style

## Task

Create a short promotional post for LinkedIn that announces this content. Your goal is to create curiosity and drive clicks.

**Structure:**
1. Hook (what's interesting about this?)
2. 1-2 key insights or teases (don't reveal everything)
3. Call-to-action with link

{{#if url}}
Include this link: {{url}}
{{else}}
End with: "Link in comments 👇" or "Read more in the article" (no specific URL)
{{/if}}

Output only the LinkedIn post. No preamble, no explanation.

## Content to Promote

{{content}}
```

#### 2. Twitter Promotional Prompt
**File**: `src/prompts/ship/twitter.md`
**Changes**: Create new prompt for Twitter promotional thread

```markdown
You are creating a promotional Twitter/X thread to announce published content.

## Author's Style Guide

{{style_guide}}

## Twitter Promotional Thread Best Practices

- First tweet must hook - it determines if anyone reads the rest
- Create curiosity without revealing the full content
- Thread length: 2-4 tweets ideal for promotional content
- Each tweet MUST be under 280 characters (this is critical)
- Each tweet should build interest
- End with clear call-to-action
- No numbering for short promotional threads (only number if 5+ tweets)
- Last tweet should include the link (if provided)

## Task

Create a short promotional thread (2-4 tweets) that announces this content. Your goal is to create curiosity and drive clicks.

**Structure:**
1. Hook tweet (what's the big idea?)
2. 1-2 supporting tweets (tease key insights)
3. Call-to-action tweet with link

{{#if url}}
Include this link in the final tweet: {{url}}
{{else}}
End with: "🔗 Link in bio" or "Read more: [link]"
{{/if}}

Output only the thread with each tweet on its own line, separated by blank lines. No preamble, no explanation, no tweet numbers for short threads.

## Content to Promote

{{content}}
```

### Success Criteria

#### Automated Verification
- [x] Directory created: `src/prompts/ship/`
- [x] Both prompt files created: `linkedin.md` and `twitter.md`
- [x] Files are valid markdown (.md extension)

#### Manual Verification
- [ ] Read each prompt and verify:
  - [ ] Contains `{{style_guide}}` placeholder
  - [ ] Contains `{{content}}` placeholder
  - [ ] Contains `{{url}}` conditional logic
  - [ ] Has clear platform-specific constraints
  - [ ] Specifies promotional intent (not full adaptation)
  - [ ] Includes "no preamble, no explanation" instruction

---

## Phase 2: Implement Ship Command

### Changes Required

#### 1. Ship Command Implementation
**File**: `src/commands/ship.ts`
**Changes**: Create new command file

```typescript
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { complete } from '../lib/llm.js';
import { getPath, ensureDir } from '../lib/files.js';
import { loadPrompt, interpolate } from '../lib/prompts.js';

interface ShipOptions {
  url?: string;
}

type Platform = 'linkedin' | 'twitter';

const PLATFORMS: Platform[] = ['linkedin', 'twitter'];
const STYLE_GUIDE_PATH = 'corpus/_style_guide.md';

/**
 * Load the style guide from corpus directory
 */
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);

  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found. Posts will be created without style matching.'));
    console.log(chalk.dim('  Run `claude-pen analyze` to generate a style guide.\n'));
    return 'No style guide available. Create promotional content that is clear and engaging.';
  }

  return fs.readFileSync(stylePath, 'utf-8');
}

/**
 * Generate output path for a platform
 */
function getOutputPath(inputPath: string, platform: Platform): string {
  const dir = path.dirname(inputPath);
  const basename = path.basename(inputPath, path.extname(inputPath));
  return path.join(dir, `${basename}-${platform}.md`);
}

/**
 * Create promotional post for a specific platform
 */
async function createPromoPost(
  content: string,
  platform: Platform,
  styleGuide: string,
  url?: string
): Promise<string> {
  const promptTemplate = loadPrompt(`ship/${platform}`);

  // Simple conditional replacement for {{#if url}}...{{/if}} blocks
  let processedTemplate = promptTemplate;
  if (url) {
    // Remove {{else}} blocks and keep {{#if url}} content
    processedTemplate = processedTemplate
      .replace(/\{\{#if url\}\}([\s\S]*?)\{\{else\}\}[\s\S]*?\{\{\/if\}\}/g, '$1')
      .replace(/\{\{#if url\}\}/g, '')
      .replace(/\{\{\/if\}\}/g, '');
  } else {
    // Remove {{#if url}} blocks and keep {{else}} content
    processedTemplate = processedTemplate
      .replace(/\{\{#if url\}\}[\s\S]*?\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1')
      .replace(/\{\{#if url\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  const prompt = interpolate(processedTemplate, {
    style_guide: styleGuide,
    content: content,
    url: url || '',
  });

  return complete(prompt, {
    system: `You are a marketing expert creating engaging promotional content for ${platform} that drives traffic and creates curiosity.`,
    maxTokens: 1000,
  });
}

/**
 * Ship command - create promotional posts for social media
 */
export async function ship(draftPath: string, options: ShipOptions): Promise<void> {
  // Validate input file
  if (!fs.existsSync(draftPath)) {
    console.error(chalk.red(`File not found: ${draftPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('\n📤 Creating promotional posts\n'));
  console.log(chalk.dim(`  Source: ${draftPath}`));
  if (options.url) {
    console.log(chalk.dim(`  Link: ${options.url}`));
  } else {
    console.log(chalk.dim(`  Link: Not provided (will use fallback)`));
  }
  console.log();

  // Read input
  const content = fs.readFileSync(draftPath, 'utf-8');

  // Load style guide
  const styleGuide = loadStyleGuide();

  // Create promotional posts for each platform
  const results: { platform: Platform; path: string }[] = [];

  for (const platform of PLATFORMS) {
    const spinner = ora(`Creating ${platform} post...`).start();

    try {
      const promoPost = await createPromoPost(content, platform, styleGuide, options.url);
      const outputPath = getOutputPath(draftPath, platform);

      fs.writeFileSync(outputPath, promoPost.trim());
      results.push({ platform, path: outputPath });

      spinner.succeed(`${platform} → ${path.basename(outputPath)}`);
    } catch (error) {
      spinner.fail(`${platform} failed`);
      console.error(chalk.dim(`  ${error}`));
    }
  }

  // Summary
  if (results.length > 0) {
    console.log(chalk.green('\n✓ Promotional posts created:'));
    for (const { platform, path: filePath } of results) {
      console.log(chalk.dim(`  ${platform}: ${filePath}`));
    }

    console.log(chalk.bold('\n📝 Next Steps:'));
    console.log(chalk.dim('  1. Review each post'));
    console.log(chalk.dim('  2. Copy to respective platform'));
    console.log(chalk.dim('  3. Post and engage with responses'));
  }
}
```

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes with no errors
- [x] No import errors or missing dependencies

#### Manual Verification
- [ ] File created at `src/commands/ship.ts`
- [ ] All imports are correct
- [ ] ShipOptions interface defined with optional `url` field
- [ ] loadStyleGuide function follows existing pattern
- [ ] getOutputPath creates simple suffix (no platform de-duplication needed)
- [ ] createPromoPost handles conditional `{{#if url}}` blocks
- [ ] Error handling for missing file
- [ ] Progress feedback with spinners and summary
- [ ] Next steps guidance included

---

## Phase 3: Register Ship Command in CLI

### Changes Required

#### 1. Update CLI Entry Point
**File**: `src/index.ts`
**Changes**: Import and register ship command

Add import after line 8:
```typescript
import { ship } from './commands/ship.js';
```

Add command registration after the refine command (after line 105):
```typescript
program
  .command('ship <draft>')
  .description('Create promotional posts for social media')
  .option('--url <url>', 'URL to the published content (optional)')
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

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes
- [x] `bun run src/index.ts --help` shows ship command in list
- [x] `bun run src/index.ts ship --help` shows command description and options

#### Manual Verification
- [ ] Ship command appears in help output
- [ ] Description is clear: "Create promotional posts for social media"
- [ ] `--url` option documented as optional
- [ ] Command registered with proper error handling

---

## Phase 4: Integration Testing

### Changes Required

No code changes - testing phase only.

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes (if linting is configured)

#### Manual Verification

**Test 1: Create sample article**
```bash
mkdir -p drafts
cat > drafts/test-article.md << 'EOF'
# Speed is Your Only Moat

When you're an indie hacker, speed is everything. Big companies can't move fast—they're weighed down by process, meetings, and bureaucracy.

Your advantage is agility. Ship something ugly but working. Get it in front of real users. Learn from their behavior, not your assumptions.

Perfectionism kills more projects than bad code ever will. The 10-second rule applies everywhere: if it takes longer than 10 seconds to load, users bounce. If it takes longer than 10 days to ship, you've probably over-engineered it.

Technical debt is fine when you're learning. You can always refactor later—if there's a later. Most projects die from never shipping, not from messy code.

Focus on the core value. Strip everything else. Ship it today.
EOF
```

**Test 2: Create promotional posts with URL**
```bash
bun run src/index.ts ship drafts/test-article.md --url "https://yourblog.com/speed-is-your-moat"
```

Verify:
- [ ] Shows "📤 Creating promotional posts"
- [ ] Lists source file and URL
- [ ] Shows spinner for each platform (LinkedIn, Twitter)
- [ ] Creates 2 files:
  - [ ] `drafts/test-article-linkedin.md`
  - [ ] `drafts/test-article-twitter.md`
- [ ] Summary shows both created files
- [ ] "Next Steps" guidance included
- [ ] No errors or warnings (except style guide warning if not present)

**Test 3: Verify LinkedIn promotional post**
```bash
cat drafts/test-article-linkedin.md
```

Verify:
- [ ] Short post (150-300 chars approximately)
- [ ] Hook in first line
- [ ] Creates curiosity/teases content
- [ ] Includes the URL from --url flag
- [ ] Clear call-to-action
- [ ] No markdown formatting
- [ ] No preamble or explanation text
- [ ] Sounds promotional, not like full content

**Test 4: Verify Twitter promotional thread**
```bash
cat drafts/test-article-twitter.md
```

Verify:
- [ ] Short thread (2-4 tweets)
- [ ] Each tweet under 280 characters
- [ ] Blank lines between tweets
- [ ] First tweet is a strong hook
- [ ] Creates curiosity without revealing all
- [ ] Final tweet includes the URL
- [ ] No tweet numbering (since it's short)
- [ ] No preamble or explanation text

**Test 5: Create promotional posts WITHOUT URL**
```bash
bun run src/index.ts ship drafts/test-article.md
```

Verify:
- [ ] Shows "Link: Not provided (will use fallback)"
- [ ] Creates both files successfully
- [ ] LinkedIn post includes fallback like "Link in comments" or "Read more in the article"
- [ ] Twitter thread includes fallback like "🔗 Link in bio" or "Read more: [link]"
- [ ] No actual URL in the posts
- [ ] Posts still make sense and are promotional

**Test 6: Test with missing file**
```bash
bun run src/index.ts ship drafts/nonexistent.md
```

Verify:
- [ ] Shows error: "File not found: drafts/nonexistent.md"
- [ ] Exits with error code
- [ ] No files created

**Test 7: Test without style guide**
```bash
# Temporarily rename style guide if it exists
mv corpus/_style_guide.md corpus/_style_guide.md.bak 2>/dev/null || true

bun run src/index.ts ship drafts/test-article.md --url "https://test.com"

# Restore style guide
mv corpus/_style_guide.md.bak corpus/_style_guide.md 2>/dev/null || true
```

Verify:
- [ ] Shows warning: "⚠ No style guide found..."
- [ ] Suggests running `claude-pen analyze`
- [ ] Still creates promotional posts successfully
- [ ] Posts are generic but clear and engaging

**Test 8: Twitter character limit validation**

Manually inspect `drafts/test-article-twitter.md`:
```bash
# Check each tweet's character count
cat drafts/test-article-twitter.md | grep -v '^$' | while IFS= read -r line; do
  echo "${#line} chars: $line"
done
```

Verify:
- [ ] Every tweet is under 280 characters
- [ ] No truncated sentences
- [ ] Each tweet reads naturally
- [ ] URL fits within character limit

**Test 9: Test with different content types**

Create a longer article:
```bash
cat > drafts/long-article.md << 'EOF'
# Title here

[10 paragraphs of content with multiple sections, code examples, etc.]
EOF

bun run src/index.ts ship drafts/long-article.md --url "https://test.com/long"
```

Verify:
- [ ] Promotional posts are still short (don't scale with content length)
- [ ] Posts tease the content effectively
- [ ] Not trying to summarize everything
- [ ] Focus on hook and curiosity

**Test 10: Re-run ship on same file**
```bash
bun run src/index.ts ship drafts/test-article.md --url "https://test.com"
# Run again
bun run src/index.ts ship drafts/test-article.md --url "https://test.com"
```

Verify:
- [ ] Overwrites previous files (test-article-linkedin.md, test-article-twitter.md)
- [ ] No duplicate files created
- [ ] No errors about existing files

---

## Phase 5: Documentation

### Changes Required

#### 1. Update README.md
**File**: `README.md`
**Changes**: Add ship command documentation

Add the following section after the "Refine a Draft" section (around line 441):

```markdown
### Ship to Social Media

Create promotional posts to announce your published content on social media:

```bash
claude-pen ship <article> [--url <url>]
```

**Arguments:**

- `<article>` - Path to your article/draft (required)
- `--url <url>` - URL to the published content (optional)

**Features:**

- **Promotional content only** - Creates short, engaging posts that drive traffic
- **Two platforms** - LinkedIn and Twitter posts created automatically
- **URL optional** - If omitted, uses fallback text like "Link in bio"
- **Style preservation** - Uses your style guide to match your voice
- **Non-destructive** - Creates new files, preserves original article
- **Curiosity-driven** - Posts tease content without revealing everything

**Output:**

Creates promotional files in the same directory as your article:
- `article-linkedin.md` - Short LinkedIn promotional post (150-300 chars)
- `article-twitter.md` - Twitter thread (2-4 tweets, each under 280 chars)

**Workflow:**

```
1. Write and refine your article
   claude-pen draft notes.md
   claude-pen refine draft.md --pass clarity

2. Publish to your platform (blog, Substack, Medium, etc.)
   [Manual step - publish and get URL]

3. Create promotional posts
   claude-pen ship draft.md --url "https://yourblog.com/your-post"

4. Copy posts to LinkedIn and Twitter
   [Review and post manually]
```

**Examples:**

```bash
# With URL to published content
claude-pen ship drafts/my-article.md --url "https://yourblog.com/speed-is-your-moat"

# Without URL (uses fallback)
claude-pen ship drafts/my-article.md
# Posts will say "Link in comments" or "Link in bio"

# From any directory
claude-pen ship ~/Documents/blog-post.md --url "https://substack.com/p/post"
```

**What Gets Created:**

**LinkedIn Post** (150-300 characters):
- Hook in first line
- 1-2 key teases
- Call-to-action with link
- No markdown (plain text)

**Twitter Thread** (2-4 tweets):
- Hook tweet that creates curiosity
- Supporting tweets that tease insights
- Final tweet with link and CTA
- Each tweet under 280 characters

**Customization:**

The ship command creates promotional content by default. To customize the behavior:

1. Create custom prompts in `.claude-pen/prompts/ship/`
2. Override `linkedin.md` or `twitter.md` with your own templates
3. Use `{{content}}`, `{{style_guide}}`, and `{{url}}` variables
4. See existing prompts in `src/prompts/ship/` for examples

**Next Steps:**
After creating promotional posts, review each file for tone and accuracy, then copy to the respective platforms. Engage with comments and responses to build community.
```

Also update the "Available Commands" section to include ship:

```markdown
## Available Commands

[... existing commands ...]

### Ship to Social Media

```bash
claude-pen ship <article> [--url <url>]
```

Create promotional posts for LinkedIn and Twitter to announce your published content. See "Ship to Social Media" section for details.
```

Update the project structure section to include ship prompts:

```markdown
### Project Structure

```
claude-pen/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── commands/             # Command implementations
│   │   ├── init.ts           # Init command
│   │   ├── ingest.ts         # Ingest command
│   │   ├── analyze.ts        # Analyze command
│   │   ├── draft.ts          # Draft command
│   │   ├── review.ts         # Review command
│   │   ├── refine.ts         # Refine command
│   │   └── ship.ts           # Ship command (promotional posts)
│   ├── lib/                  # Utility libraries
│   │   ├── config.ts         # Configuration management
│   │   ├── files.ts          # File utilities
│   │   ├── llm.ts            # LLM integration
│   │   └── prompts.ts        # Prompt management
│   └── prompts/              # Prompt templates
│       ├── ingest.md         # Ingest metadata extraction
│       ├── analyze.md        # Style analysis
│       ├── draft.md          # Draft generation
│       ├── review.md         # Review and suggestions
│       ├── proofread.md      # Proofread refinement pass
│       ├── punchier.md       # Punchier refinement pass
│       ├── clarity.md        # Clarity refinement pass
│       └── ship/             # Promotional post prompts
│           ├── linkedin.md   # LinkedIn promotional posts
│           └── twitter.md    # Twitter promotional threads
├── thoughts/                 # Research and planning docs
└── .claude/                  # Claude Code configuration
```
```

### Success Criteria

#### Automated Verification
- [x] `README.md` renders correctly in markdown preview
- [x] No broken links or malformed markdown
- [x] Code blocks have proper syntax highlighting

#### Manual Verification
- [ ] Ship command documented with clear examples
- [ ] Workflow diagram shows publish → ship pattern
- [ ] Platform outputs clearly described
- [ ] URL optional behavior explained
- [ ] Customization section references prompt override system
- [ ] Added to "Available Commands" section
- [ ] Project structure updated to show ship prompts
- [ ] Next steps guidance provided

---

## Rollback Plan

If issues arise during implementation:

### Phase 1 Rollback
```bash
rm -rf src/prompts/ship/
```

### Phase 2 Rollback
```bash
rm src/commands/ship.ts
```

### Phase 3 Rollback
```bash
git checkout src/index.ts
```

### Phase 5 Rollback
```bash
git checkout README.md
```

### Complete Rollback
```bash
git checkout src/index.ts README.md
rm -rf src/prompts/ship/
rm src/commands/ship.ts
```

## Known Issues and Mitigations

### Issue 1: Twitter Character Limits
**Problem**: LLM might generate tweets over 280 characters
**Mitigation**: Prompt explicitly emphasizes "MUST be under 280 characters (this is critical)" and suggests 2-4 short tweets
**Validation**: Manual inspection in Phase 4, Test 8

### Issue 2: Style Guide Missing
**Problem**: Users may not have generated a style guide yet
**Mitigation**: Graceful fallback with clear warning and suggestion to run `analyze`
**Validation**: Phase 4, Test 7

### Issue 3: URL Fallback Messaging
**Problem**: Without URL, posts need generic but useful CTAs
**Mitigation**: Prompts include fallback suggestions like "Link in comments" or "Link in bio"
**Validation**: Phase 4, Test 5

### Issue 4: Conditional Template Syntax
**Problem**: Simple interpolation doesn't support `{{#if}}` blocks natively
**Mitigation**: Add simple conditional processing in `createPromoPost` function
**Validation**: Phase 4, Tests 2 and 5

### Issue 5: Over-Summarization
**Problem**: LLM might try to summarize entire long article in post
**Mitigation**: Prompt emphasizes "tease" and "create curiosity" rather than summarize
**Validation**: Phase 4, Test 9

## Future Enhancements

After this plan is implemented, consider:

1. **Direct Publishing** - Integrate with platform APIs
   - LinkedIn API for direct posting
   - Twitter API for thread publishing
   - `claude-pen ship --publish` flag

2. **Analytics Tracking** - Track performance of promotional posts
   - Engagement metrics
   - Click-through rates
   - A/B testing different hooks

3. **More Platforms** - Expand beyond LinkedIn and Twitter
   - Facebook, Instagram (via custom prompts)
   - Mastodon, Bluesky
   - Platform-specific optimizations

4. **Scheduling** - Schedule posts for optimal times
   - `claude-pen ship --schedule "2024-12-15 10:00"`
   - Integration with Buffer, Hootsuite

5. **Visual Assets** - Generate accompanying images
   - Quote cards
   - Hero images
   - Preview thumbnails

6. **Multi-URL Support** - Different links per platform
   - `--linkedin-url` and `--twitter-url` flags
   - Tracking parameters for analytics

## Success Metrics

After implementation, success is measured by:

1. **Functional Completeness**
   - Creates promotional posts for LinkedIn and Twitter
   - Handles optional URL parameter
   - Graceful fallback without URL
   - Error handling is robust

2. **Quality Standards**
   - Twitter tweets consistently under 280 chars
   - LinkedIn posts 150-300 chars (promotional length)
   - Posts are promotional (tease, don't reveal all)
   - Style guide integration works
   - Fallback messaging is clear

3. **User Experience**
   - Simple command interface (no mode flags)
   - Clear progress indicators
   - Helpful error messages
   - Next steps guidance
   - Comprehensive documentation

4. **Code Quality**
   - Type checking passes
   - Follows existing patterns
   - Well-commented code
   - No regressions in existing commands
   - Prompt override system documented

5. **Customizability**
   - Users can override prompts in `.claude-pen/prompts/ship/`
   - Custom behavior achievable without code changes
   - Documentation explains customization clearly
