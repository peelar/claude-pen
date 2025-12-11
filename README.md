# Claude Pen

CLI that learns your writing style once and remembers it. Analyze your existing content, build a persistent style profile, and every post comes out sounding like you, without re-explaining your voice each session.

## The pipeline

```
raw → draft → review → refine → ship
```

You dump messy notes (voice memos from a walk, scattered bullets, whatever) and move through the pipeline until you have a polished article with social posts.

```bash
claude-pen draft notes.md                    # raw → structured draft
claude-pen review draft.md                   # get editorial feedback
claude-pen refine draft.md "make it shorter" # apply changes
claude-pen ship article.md --url https://... # generate social posts
```

Each step is optional. Skip `review` if you're happy. Run `refine` multiple times. The pipeline is yours.

## Quick start

```bash
# 0. clone the repo and link
git clone https://github.com/yourusername/claude-pen.git
cd claude-pen
bun install
bun link  # optional: makes `claude-pen` available globally
cp .env.example .env

# 1. init workspace
claude-pen init

# 2. ingest your existing writing
claude-pen ingest

# 3. analyze your existing writing (builds style guide)
claude-pen analyze

# 4. draft something new
claude-pen draft writing/raw/idea.md
```

## Workspace structure

```
your-project/
├── .claude-pen/
│   ├── config.yaml
│   └── prompts/         # customizable
├── writing/
│   ├── _style_guide.md  # auto-generated
│   ├── import/          # drop files here to ingest
│   ├── raw/             # rough notes
│   ├── drafts/          # work in progress
│   └── content/         # published
│       ├── blog/
│       ├── linkedin/
│       └── twitter/
```

## Commands

| Command   | What it does                                                          |
| --------- | --------------------------------------------------------------------- |
| `init`    | Set up workspace and config                                           |
| `ingest`  | Import existing markdown with auto-extracted metadata                 |
| `analyze` | Generate style guide from your published content                      |
| `draft`   | Turn notes into structured drafts (blog, LinkedIn, Twitter, Substack) |
| `review`  | Get improvement suggestions                                           |
| `refine`  | Apply edits with custom instructions                                  |
| `ship`    | Finalize content or create promotional posts                          |
| `clean`   | Delete all drafts                                                     |

### Draft

```bash
claude-pen draft notes.md                        # blog post (default)
claude-pen draft notes.md --format linkedin      # LinkedIn post
claude-pen draft notes.md --format twitter       # Twitter thread
claude-pen draft --stdin                         # read from stdin
pbpaste | claude-pen draft --stdin               # from clipboard

# With custom instructions
claude-pen draft notes.md -i "Fix all typos"
claude-pen draft notes.md -i "Make it more conversational"
```

The `--format` flag determines the target platform and how `ship` will behave later.

### Refine

```bash
claude-pen refine                       # interactive file picker
claude-pen refine draft.md              # uses review file if exists
claude-pen refine draft.md -i "shorter" # custom instruction
claude-pen refine draft.md "shorter"    # positional arg (deprecated)
```

Creates timestamped versions, never overwrites.

### Review

```bash
claude-pen review draft.md                                     # basic review
claude-pen review draft.md -i "Focus on clarity and structure" # custom focus
```

Generates actionable feedback on structure, clarity, and impact.

### Ship

The `ship` command adapts based on the draft's format:

**Blog posts** (promotional workflow):

```bash
claude-pen ship article.md
claude-pen ship article.md -i "Emphasize the security benefits"
```

Creates promotional posts to drive traffic:

- `article-linkedin.md` - Promotional post with URL placeholder
- `article-twitter.md` - Promotional thread with URL placeholder

**Social content** (finalization workflow):

```bash
claude-pen ship draft.md  # LinkedIn or Twitter format
claude-pen ship draft.md -i "Make it more casual"
```

Finalizes the post for publishing:

- Updates `draft.md` in place with platform-optimized formatting
- LinkedIn: Adds hooks, proper paragraphing, hashtags
- Twitter: Formats as numbered thread with character limits

## Workflows

### Blog-First (Drive Traffic)

Create long-form content and generate promotional posts:

```bash
# 1. Create blog draft
claude-pen draft notes.md

# 2. Refine (with custom instructions)
claude-pen refine draft.md -i "Focus on clarity and removing jargon"

# 3. Ship - generates promotional posts
claude-pen ship draft.md

# Output: draft-linkedin.md, draft-twitter.md
# Replace URL placeholders before publishing
```

### Social-First (Native Platform Content)

Create content directly for LinkedIn or Twitter:

**LinkedIn Post:**

```bash
# 1. Create LinkedIn draft
cat voice-memo.txt | claude-pen draft --stdin --format linkedin

# 2. Refine (with custom instructions)
claude-pen refine draft.md -i "Focus on clarity and removing jargon"

# 3. Ship - finalizes for LinkedIn
claude-pen ship draft.md

# Output: draft.md (updated with LinkedIn formatting)
# Copy to LinkedIn and publish
```

**Twitter Thread:**

```bash
# 1. Create Twitter thread draft
claude-pen draft notes.md --format twitter

# 2. Refine (with custom instructions)
claude-pen refine draft.md -i "Make it punchier and more direct"

# 3. Ship - finalizes thread formatting
claude-pen ship draft.md

# Output: draft.md (formatted as numbered thread)
# Copy thread to Twitter
```

---

## Custom Instructions

All content-generating commands (`draft`, `review`, `refine`, `ship`) support custom instructions via the `-i, --instruct` flag. This allows you to provide ad-hoc guidance to the LLM without modifying prompt templates.

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

---

## Roadmap

- [ ] OpenAI / other providers
- [ ] Push to platforms (Medium, Substack, etc.)
- [ ] Set up a simple blog page

Contributions welcome.

## Dev

```bash
bun run src/index.ts [command]  # run from source
bun run typecheck
bun run lint
```

## License

MIT
