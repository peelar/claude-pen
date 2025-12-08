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

🚧 **Early Development** - Currently implements workspace initialization, content ingestion, style analysis, and draft generation. Refine command in development.

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
After drafting, review the output in your editor, then use `claude-pen refine` to polish specific aspects.

### Coming Soon

- `claude-pen refine <draft>` - Polish and improve draft with targeted passes

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
│   │   └── draft.ts          # Draft command
│   ├── lib/                  # Utility libraries
│   │   ├── config.ts         # Configuration management
│   │   ├── files.ts          # File utilities
│   │   ├── llm.ts            # LLM integration
│   │   └── prompts.ts        # Prompt management
│   └── prompts/              # Prompt templates
│       ├── ingest.md         # Ingest metadata extraction
│       ├── analyze.md        # Style analysis
│       └── draft.md          # Draft generation
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
