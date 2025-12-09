# claude-pen

An AI-powered writing assistant that learns your voice and writing style.

## Overview

Claude Pen is a CLI tool that helps you maintain consistency in your writing by analyzing your existing content and generating new drafts that match your unique style. Perfect for content creators, marketers, and writers who want AI assistance without losing their personal voice.

## Features

- **Voice Learning**: Analyzes your existing writing to understand your style, tone, and patterns
- **Multi-Platform Support**: Works with blog posts, LinkedIn articles, Substack newsletters, and Twitter threads
- **Style-Matched Drafting**: Generates new content that sounds like you
- **Local-First**: Your writing corpus and drafts stay on your machine
- **LLM Flexible**: Works with Anthropic Claude or OpenAI GPT models

## Status

🚧 **Early Development** - Currently implements workspace initialization, content ingestion, style analysis, draft generation, and editorial refinement passes.

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- An API key for Anthropic Claude or OpenAI GPT

### Install Dependencies

```bash
git clone https://github.com/yourusername/claude-pen.git
cd claude-pen
bun install
```

### Global Installation (Optional)

To use `claude-pen` as a command anywhere on your system:

```bash
bun link
```

Now you can run `claude-pen` from any directory.

## Usage

### Initialize a New Workspace

Create a new Claude Pen workspace in your current directory:

```bash
# If installed globally
claude-pen init

# Or run from source
bun run src/index.ts init
```

This interactive command will:

1. Prompt for your name
2. Ask which LLM provider you want to use (Anthropic or OpenAI)
3. Let you configure the model and API key environment variable
4. Create the following structure:

```
your-workspace/
├── .claude-pen/
│   ├── config.yaml           # Your configuration
│   └── prompts/              # Prompt templates
│       └── format/           # Format-specific prompts
├── writing/                  # All your writing in one place
│   ├── import/               # Drop existing content here to ingest
│   ├── raw/                  # Unstructured thoughts and ideas
│   ├── drafts/               # AI-processed content pending review
│   └── content/              # Finalized content organized by platform
│       ├── blog/
│       ├── linkedin/
│       ├── substack/
│       └── twitter/
└── .gitignore
```

### Configuration Example

After initialization, `.claude-pen/config.yaml` will contain:

```yaml
author: Your Name
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  apiKeyEnv: ANTHROPIC_API_KEY
```

### Set Your API Key

Make sure your API key is available in your environment:

```bash
# For Anthropic Claude
export ANTHROPIC_API_KEY=your-api-key-here

# For OpenAI GPT
export OPENAI_API_KEY=your-api-key-here
```

Add this to your `~/.bashrc`, `~/.zshrc`, or equivalent to make it permanent.

## Writing Workflow

claude-pen provides a simple three-step workflow for your writing:

### 1. Draft - Transform Notes into Structured Content

Transform raw notes into a well-structured draft that matches your writing style:

```bash
claude-pen draft raw-notes.md
```

This creates a draft in `writing/drafts/` with:
- Clear structure and logical flow
- Your exact words and phrasing preserved
- Style matched to your voice (from style guide)
- Ready for review and refinement

### 2. Review - Get Improvement Suggestions (Optional)

Analyze your draft and get actionable feedback:

```bash
claude-pen review writing/drafts/my-draft.md
```

This creates `my-draft-review.md` containing:
- Overall assessment
- Key strengths
- Specific areas for improvement
- Priority recommendations

The review is non-destructive - your original draft is unchanged.

### 3. Refine - Apply Editorial Improvements (Optional)

Apply targeted editorial passes with optional tone adjustments:

```bash
# Fix grammar and polish
claude-pen refine my-draft.md --pass proofread

# Improve clarity and flow
claude-pen refine my-draft.md --pass clarity

# Make it punchier with a punchy tone
claude-pen refine my-draft.md --pass punchier --tone punchy
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

### Recommended Workflow

```bash
# 1. Create structured draft from raw notes
claude-pen draft raw-notes.md

# 2. (Optional) Get improvement suggestions
claude-pen review writing/drafts/notes.md

# 3. (Optional) Apply refinement passes
claude-pen refine writing/drafts/notes.md --pass clarity
claude-pen refine writing/drafts/notes-20241208-clarity.md --pass proofread --tone professional
```

---

## Available Commands

### Initialize a New Workspace

```bash
claude-pen init
```

Interactive setup that creates your workspace structure and configuration.

### Ingest Existing Writing

Batch import existing markdown files into your drafts for review:

```bash
claude-pen ingest [directory] --platform <platform>
```

**Arguments:**

- `[directory]` - Optional path to directory containing markdown files (defaults to `writing/import/`)
- `--platform` - Target platform: `blog`, `linkedin`, `substack`, or `twitter`

**Features:**

- Automatically extracts title, date, tags, and summary using AI
- Skips files that already have metadata
- Generates safe filenames with date prefixes
- Writes to `writing/drafts/` for review
- Removes processed files from source directory

**Workflow:**

```
writing/import/ → ingest → writing/drafts/ → review → writing/content/[platform]/
```

**Examples:**

```bash
# Import from default location (writing/import/)
claude-pen ingest --platform blog

# Import from specific directory
claude-pen ingest ./my-old-blog --platform blog

# Import LinkedIn articles
claude-pen ingest ./linkedin-drafts --platform linkedin
```

**Next Steps:**
After ingesting, review files in `writing/drafts/`, then publish to `writing/content/[platform]/`.

### Analyze Your Writing Style

Generate a style guide that captures your voice, tone, and patterns:

```bash
claude-pen analyze
```

**Features:**

- Analyzes all published writing in `writing/content/`
- Identifies patterns in sentence structure, vocabulary, tone, and formatting
- Creates comprehensive style guide at `writing/_style_guide.md`
- Uses style guide for all future draft generation

**Workflow:**

```
writing/content/[platform]/ → analyze → writing/_style_guide.md → used by draft
```

**Examples:**

```bash
# Generate style guide from all existing content
claude-pen analyze
```

**Next Steps:**
After analyzing, use the style guide to generate drafts that match your voice with `claude-pen draft`.

### Generate a Draft

Transform raw notes into a structured draft that matches your writing style:

```bash
claude-pen draft [file]
claude-pen draft --stdin
```

**Arguments:**

- `[file]` - Path to markdown file containing raw notes (optional if using `--stdin`)
- `--stdin` - Read input from stdin instead of a file
- `--output, -o` - Custom output path (optional, auto-generates if not specified)

**Features:**

- Supports file input or stdin for multi-line text
- Uses your style guide (`writing/_style_guide.md`) to match your voice
- Works without a style guide (shows helpful warning)
- Organizes unstructured ideas into coherent structure
- Preserves your original insights and tone
- Outputs draft ready for review and refinement

**Workflow:**

```
File:  writing/raw/notes.md → draft → writing/drafts/notes.md
Stdin: paste/pipe text → draft --stdin → writing/drafts/draft-YYYY-MM-DD.md
```

**Examples:**

```bash
# Generate draft from file
claude-pen draft writing/raw/startup-ideas.md

# Generate draft from clipboard (macOS)
pbpaste | claude-pen draft --stdin

# Generate draft from stdin with custom output
pbpaste | claude-pen draft --stdin -o writing/drafts/my-thoughts.md

# Interactive paste (paste text, then press Ctrl+D)
claude-pen draft --stdin

# Specify custom output for file
claude-pen draft writing/raw/blog-outline.md -o writing/drafts/saas-pricing.md
```

**Next Steps:**
After drafting, review the output in your editor, get suggestions with `claude-pen review`, or apply refinement passes with `claude-pen refine`.

### Review Content

Analyze content and generate improvement suggestions:

```bash
claude-pen review <file>
```

**Arguments:**

- `<file>` - Path to markdown file to review (required)
- `--output, -o` - Custom output path for suggestions (optional, defaults to `<basename>-review.md`)

**Features:**

- Analyzes structure, organization, clarity, and impact
- Provides specific, actionable suggestions
- Explains WHY improvements are needed
- Prioritizes most impactful changes
- Non-destructive - creates separate review file

**Workflow:**

```
content.md → review → content-review.md
```

**Examples:**

```bash
# Review a formatted file
claude-pen review writing/drafts/my-post-formatted.md

# Review with custom output path
claude-pen review draft.md -o reviews/draft-feedback.md
```

**Next Steps:**
After reviewing suggestions, apply improvements manually or use `claude-pen refine` to apply editorial passes.

### Refine a Draft

Apply editorial refinement passes to drafts with optional tone adjustment:

```bash
claude-pen refine [draft-file] [--pass <pass-type>] [--tone <tone-option>]
```

**Arguments:**

- `[draft-file]` - Optional path to the draft file. If omitted, shows an interactive file selector
- `--pass <pass-type>` - Refinement pass to apply (default: `proofread`)
  - `proofread` - Fix grammar, spelling, and awkward phrasing
  - `punchier` - Tighten prose and strengthen impact
  - `clarity` - Improve flow and comprehension
- `--tone <tone-option>` - Optional tone adjustment
  - `punchy` - Direct, impactful, concise
  - `funny` - Humorous, entertaining, lighthearted
  - `personal` - Intimate, conversational, warm
  - `professional` - Formal, polished, authoritative

**Features:**

- **Interactive file selection** - Omit the file path to choose from available drafts
- Uses your style guide to preserve your unique voice
- Creates a new file with timestamp and pass name
- Preserves the original draft
- Shows word count statistics and delta
- Suggests next refinement passes
- Each pass focuses on a specific editorial goal

**Workflow:**

```
writing/drafts/post.md → refine --pass proofread → writing/drafts/post-20251208151234-proofread.md
```

**Examples:**

```bash
# Interactive mode - select from available drafts
claude-pen refine
# > my-post.md (1,234 words, 2 hours ago)
#   another-draft.md (856 words, 1 day ago)
#   startup-ideas.md (2,103 words, 3 days ago)

# Interactive mode with specific pass
claude-pen refine --pass punchier

# Specify a file directly (skip interactive selection)
claude-pen refine writing/drafts/my-post.md

# Combine file path with specific pass
claude-pen refine writing/drafts/my-post.md --pass clarity

# Apply refinement with tone adjustment
claude-pen refine my-post.md --pass proofread --tone professional

# Make it punchy
claude-pen refine my-post.md --pass punchier --tone punchy

# Interactive with tone
claude-pen refine --pass clarity --tone personal
```

**Recommended Workflow:**

1. Create initial draft from notes: `claude-pen draft notes.md`
2. Apply refinement passes as needed:
   - `refine --pass proofread` for correctness
   - `refine --pass punchier` for impact
   - `refine --pass clarity` for comprehension
3. Review and publish to `writing/content/[platform]/`

**Note:** The refine command creates a new file with a timestamp and pass name, preserving your original draft. You can apply multiple passes sequentially or experiment with different passes on the same source.

## Development

### Run from Source

```bash
bun run src/index.ts [command]
```

### Type Checking

```bash
bun run typecheck
```

### Linting

```bash
bun run lint
```

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
│   │   └── refine.ts         # Refine command
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
│       └── clarity.md        # Clarity refinement pass
├── thoughts/                 # Research and planning docs
└── .claude/                  # Claude Code configuration
```

## Contributing

Contributions are welcome! This project follows a Research → Plan → Implement workflow:

1. Research the codebase and existing patterns
2. Create a detailed implementation plan
3. Implement phase by phase with verification
4. Update documentation

See `CLAUDE.md` for detailed development guidelines.

## License

MIT

## Built With

- [Bun](https://bun.sh) - JavaScript runtime
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Claude AI integration
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
