# Plan 1: Project Foundation

## Overview

Set up the TypeScript project with Bun, CLI framework, and directory structure. No commands yet - just the skeleton that everything builds on.

## Changes Required

### 1. Initialize project

```bash
mkdir claude-pen && cd claude-pen
bun init
```

### 2. Dependencies

```bash
bun add commander @anthropic-ai/sdk glob yaml chalk ora
bun add -d @types/node typescript
```

### 3. Package configuration

**File**: `package.json`

```json
{
  "name": "claude-pen",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "claude-pen": "./src/index.ts"
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "bunx biome check src/"
  }
}
```

### 4. TypeScript configuration

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

### 5. Project structure

Create this directory structure:

```
claude-pen/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations (empty for now)
│   ├── lib/                  # Shared utilities (empty for now)
│   └── prompts/              # Default prompts (empty for now)
│       └── format/
├── package.json
├── tsconfig.json
└── README.md
```

### 6. CLI entry point

**File**: `src/index.ts`

```typescript
#!/usr/bin/env bun
import { Command } from "commander";

const program = new Command();

program
  .name("claude-pen")
  .description("AI-powered writing assistant that learns your voice")
  .version("0.1.0");

// Commands will be added here in subsequent phases

program.parse();
```

### 7. Shared types

**File**: `src/types.ts`

```typescript
export type Platform = "blog" | "linkedin" | "substack" | "twitter";

export type RefinePass = "proofread" | "punchier" | "clarity";

export interface ClaudePenConfig {
  author: string;
  llm: {
    provider: "anthropic" | "openai";
    model: string;
    apiKeyEnv: string; // Name of env var containing API key
  };
}

export interface ArticleFrontmatter {
  title: string;
  date: string;
  platform: Platform;
  url?: string;
  word_count: number;
  tags: string[];
  summary?: string;
}
```

## Success Criteria

### Automated Verification

- [ ] `bun install` completes without errors
- [ ] `bun run typecheck` passes with no errors
- [ ] `bun run src/index.ts --help` shows CLI help

### Manual Verification

- [ ] Running `bun run src/index.ts --version` shows `0.1.0`
- [ ] Help output shows name "claude-pen" and description
- [ ] All directories exist as specified
