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

🚧 **Early Development** - Currently implements workspace initialization. Additional commands (ingest, analyze, draft) are in development.

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
├── corpus/                   # Your writing samples
│   ├── blog/
│   ├── linkedin/
│   ├── substack/
│   └── twitter/
├── drafts/                   # Generated drafts
├── raw/                      # Raw notes and ideas
└── .gitignore               # Excludes raw/ and drafts/
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

- `claude-pen init` - Initialize a new workspace

### Coming Soon

- `claude-pen ingest <path> --platform <blog|linkedin|substack|twitter>` - Import existing writing
- `claude-pen analyze` - Analyze your writing style
- `claude-pen draft <input-file>` - Generate a draft in your style

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
│   │   └── init.ts           # Init command
│   ├── lib/                  # Utility libraries
│   │   ├── config.ts         # Configuration management
│   │   └── files.ts          # File utilities
│   └── prompts/              # Prompt templates
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
