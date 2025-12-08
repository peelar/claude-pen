# Research: Init Command Implementation

**Date**: 2025-12-08
**Purpose**: Deep dive into the codebase to understand how to implement the `claude-pen init` command

---

## Overview

The `claude-pen init` command will create a new workspace with proper directory structure and configuration. This research documents all relevant files, patterns, and implementation guidance discovered through parallel codebase analysis.

---

## Key Files & Locations

| File | Purpose | Key Functions/Lines |
|------|---------|---------------------|
| `src/commands/init.ts` | **TO CREATE** - Init command implementation | New file for command action handler |
| `src/index.ts` | CLI entry point and command registration | Lines 1-13: Commander setup, needs command registration |
| `src/types.ts` | TypeScript type definitions | `ClaudePenConfig` interface (core config structure) |
| `src/lib/config.ts` | Configuration management and workspace detection | `hasConfig()`:48, `saveConfig()`:71, `getDefaultConfig()`:82 |
| `src/lib/files.ts` | File system operations | `ensureDir()`:10, `getProjectRoot()`:77 |
| `src/lib/index.ts` | Library barrel exports | Re-exports all utilities for easier importing |
| `package.json` | Package configuration | Scripts, dependencies, bin entry point |
| `tsconfig.json` | TypeScript configuration | Strict mode, ESM module resolution |

---

## Architecture & Data Flow

### Configuration System

**Core Concept**: Workspace detection via walking up directory tree

```
User runs command
    ↓
findProjectRoot() walks up tree looking for .claude-pen/
    ↓
hasConfig() returns boolean (non-throwing check)
    ↓
saveConfig() creates .claude-pen/ + config.yaml
    ↓
loadConfig() reads and validates configuration
```

**Key Functions** (`src/lib/config.ts`):

1. **`findProjectRoot(): string | null`** (line 21-32)
   - Walks up directory tree from `process.cwd()`
   - Checks for `.claude-pen` directory at each level
   - Returns path or null if not found
   - Used by all config operations to locate workspace

2. **`hasConfig(): boolean`** (line 48-50)
   - Non-throwing check if workspace initialized
   - Returns `findProjectRoot() !== null`
   - **Use this for init command to check existing workspace**

3. **`saveConfig(config: ClaudePenConfig): void`** (line 71-77)
   - Gets config directory path
   - Creates directory structure with `ensureDir()`
   - Writes YAML file with `yaml.stringify()`
   - **Primary function for init to create workspace**

4. **`loadConfig(): ClaudePenConfig`** (line 55-66)
   - Reads config file
   - Parses YAML
   - Merges with defaults using spread operator
   - Throws if config not found
   - **Use for validation after init completes**

**Constants**:
```typescript
CONFIG_DIR = '.claude-pen'
CONFIG_FILE = 'config.yaml'
DEFAULT_CONFIG = {
  author: '',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY'
  }
}
```

### File System Operations

**Key Function** (`src/lib/files.ts`):

**`ensureDir(dirPath: string): void`** (line 10-12)
```typescript
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}
```
- Simple wrapper around `fs.mkdirSync`
- `recursive: true` creates parent directories
- **Use this pattern for all directory creation in init**

### Type System

**`ClaudePenConfig` Interface** (`src/types.ts`):
```typescript
export interface ClaudePenConfig {
  author: string
  llm: {
    provider: 'anthropic' | 'openai'
    model: string
    apiKeyEnv: string  // Environment variable name, not the key itself
  }
}
```

**Security Note**: API key is stored as environment variable reference, never in config file

---

## Patterns to Follow

### 1. Module Import Pattern

**External dependencies first, then internal modules**:
```typescript
// External dependencies
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';

// Internal modules with .js extension (ESM required)
import type { ClaudePenConfig } from '../types.js';
import { hasConfig, saveConfig } from '../lib/config.js';
import { ensureDir } from '../lib/files.js';
```

**Key Details**:
- Always use `.js` extensions (ESM module resolution)
- Use `type` keyword for type-only imports
- Group by external/internal

### 2. Function Definition Pattern

**Named exports with explicit types**:
```typescript
/**
 * Initialize a new Claude Pen workspace
 */
export async function init(): Promise<void> {
  // Implementation
}
```

**Patterns found** in existing codebase:
- All functions use named exports (no default exports)
- JSDoc comments on public functions
- Explicit return types
- camelCase naming with verb-noun pattern

### 3. Error Handling Pattern

**Throwing errors with context**:
```typescript
if (hasConfig()) {
  console.log(chalk.yellow('⚠ Already in a Claude Pen workspace.'));
  console.log('  Run commands from here or delete .claude-pen/ to reinitialize.');
  return;
}
```

**Patterns found**:
- Descriptive error messages with actionable guidance
- Use `throw new Error()` for critical failures
- Return early for recoverable situations
- User-friendly messages (example: "Run `claude-pen init` first")

### 4. CLI Command Registration Pattern

**Commander.js pattern** (`src/index.ts`):
```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(init);

program.parse();
```

**Key Details**:
- Import command handler from `./commands/` directory
- Chain `.command()`, `.description()`, `.action()`
- Final `.parse()` processes arguments

### 5. User Interaction Pattern

**Console output with chalk**:
```typescript
console.log(chalk.bold('\n📝 Initialize Claude Pen Workspace\n'));
console.log(chalk.dim('Creating directories...'));
console.log(chalk.green('\n✓ Workspace initialized!\n'));
console.log(chalk.yellow('⚠ Already in a Claude Pen workspace.'));
console.log(chalk.cyan('  1. Add existing writing:'));
```

**Available chalk methods**:
- `.bold()` - Headers
- `.dim()` - Secondary info
- `.green()` - Success messages
- `.yellow()` - Warnings
- `.cyan()` - Highlighting steps
- `.red()` - Errors (not yet used but available)

### 6. User Input Pattern

**Readline interface for prompts**:
```typescript
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const displayQuestion = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}
```

**Usage**:
```typescript
const author = await prompt('Your name');
const provider = await prompt('Provider (anthropic/openai)', 'anthropic');
```

### 7. Configuration Defaults Pattern

**Conditional defaults based on provider**:
```typescript
const providerInput = await prompt('Provider (anthropic/openai)', 'anthropic');
const provider = providerInput === 'openai' ? 'openai' : 'anthropic';

const defaultModel = provider === 'anthropic'
  ? 'claude-sonnet-4-20250514'
  : 'gpt-4o';

const defaultApiKeyEnv = provider === 'anthropic'
  ? 'ANTHROPIC_API_KEY'
  : 'OPENAI_API_KEY';
```

### 8. Directory Structure Creation Pattern

**Iterate and create with visual feedback**:
```typescript
const DIRECTORIES = [
  '.claude-pen/prompts',
  '.claude-pen/prompts/format',
  'corpus/blog',
  'corpus/linkedin',
  'corpus/substack',
  'corpus/twitter',
  'drafts',
  'raw',
];

console.log(chalk.dim('\nCreating directories...'));
for (const dir of DIRECTORIES) {
  ensureDir(path.join(process.cwd(), dir));
  console.log(chalk.dim(`  ${dir}/`));
}
```

### 9. .gitignore Creation Pattern

**Conditional file creation**:
```typescript
const gitignorePath = path.join(process.cwd(), '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  fs.writeFileSync(gitignorePath, '# Claude Pen\nraw/\ndrafts/\n');
  console.log(chalk.dim('  .gitignore'));
}
```

**Note**: Only creates if doesn't exist, doesn't append to existing

---

## Code Examples

### Complete Init Command Structure

**File**: `src/commands/init.ts`

```typescript
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import { hasConfig, saveConfig } from '../lib/config.js';
import { ensureDir } from '../lib/files.js';
import type { ClaudePenConfig } from '../types.js';

const DIRECTORIES = [
  '.claude-pen/prompts',
  '.claude-pen/prompts/format',
  'corpus/blog',
  'corpus/linkedin',
  'corpus/substack',
  'corpus/twitter',
  'drafts',
  'raw',
];

/**
 * Prompt user for input
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const displayQuestion = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Initialize a new Claude Pen workspace
 */
export async function init(): Promise<void> {
  // Check if already initialized
  if (hasConfig()) {
    console.log(chalk.yellow('⚠ Already in a Claude Pen workspace.'));
    console.log('  Run commands from here or delete .claude-pen/ to reinitialize.');
    return;
  }

  console.log(chalk.bold('\n📝 Initialize Claude Pen Workspace\n'));

  // Gather configuration
  const author = await prompt('Your name');

  console.log(chalk.dim('\nLLM Configuration (press Enter for defaults)'));

  const providerInput = await prompt('Provider (anthropic/openai)', 'anthropic');
  const provider = providerInput === 'openai' ? 'openai' : 'anthropic';

  const defaultModel = provider === 'anthropic'
    ? 'claude-sonnet-4-20250514'
    : 'gpt-4o';
  const model = await prompt('Model', defaultModel);

  const defaultApiKeyEnv = provider === 'anthropic'
    ? 'ANTHROPIC_API_KEY'
    : 'OPENAI_API_KEY';
  const apiKeyEnv = await prompt('API key environment variable', defaultApiKeyEnv);

  // Create directories
  console.log(chalk.dim('\nCreating directories...'));
  for (const dir of DIRECTORIES) {
    ensureDir(path.join(process.cwd(), dir));
    console.log(chalk.dim(`  ${dir}/`));
  }

  // Save configuration
  const config: ClaudePenConfig = {
    author,
    llm: {
      provider: provider as 'anthropic' | 'openai',
      model,
      apiKeyEnv,
    },
  };

  saveConfig(config);
  console.log(chalk.dim('  .claude-pen/config.yaml'));

  // Create .gitignore suggestion
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '# Claude Pen\nraw/\ndrafts/\n');
    console.log(chalk.dim('  .gitignore'));
  }

  // Success message
  console.log(chalk.green('\n✓ Workspace initialized!\n'));

  console.log('Next steps:');
  console.log(chalk.cyan('  1. Add existing writing:'));
  console.log(`     claude-pen ingest ./my-posts --platform blog\n`);
  console.log(chalk.cyan('  2. Analyze your style:'));
  console.log('     claude-pen analyze\n');
  console.log(chalk.cyan('  3. Start drafting:'));
  console.log('     claude-pen draft raw/my-notes.md\n');

  // API key reminder
  console.log(chalk.dim(`Remember to set ${apiKeyEnv} in your environment.`));
}
```

### Registering Command in Index

**File**: `src/index.ts` (update)

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(init);

program.parse();
```

---

## Recommendations

### Implementation Approach

1. **Create command file first**: `src/commands/init.ts`
   - Implement prompt helper function
   - Implement init function with config gathering
   - Use existing utilities from `lib/`

2. **Register in index**: Update `src/index.ts`
   - Import init command
   - Add command registration with `.command().action()`

3. **Test incrementally**:
   - Test with `bun run src/index.ts init --help`
   - Test full initialization flow
   - Test double-init warning

### Validation to Add

Consider adding these validations (not in plan but recommended):

- **Author name**: Non-empty, reasonable length
- **Model string**: Non-empty
- **API key env var**: Valid environment variable name format
- **Warn if env var not set**: Check `process.env[apiKeyEnv]` and show warning

### Directory Structure Details

**To Create**:
```
.claude-pen/
├── config.yaml              # Created by saveConfig()
└── prompts/                 # Custom user prompts
    └── format/              # Format-specific prompts

corpus/                      # Writing samples for learning voice
├── blog/
├── linkedin/
├── substack/
└── twitter/

drafts/                      # Work-in-progress drafts
raw/                         # Raw notes and ideas
```

**Note**: Only `.claude-pen/config.yaml` is created by `saveConfig()`, all others need explicit `ensureDir()` calls

### Potential Edge Cases

1. **Existing partial workspace**: What if `.claude-pen/` exists but no `config.yaml`?
   - Current `hasConfig()` checks for directory, not file
   - `saveConfig()` will create file anyway
   - **Should be fine, no special handling needed**

2. **Existing .gitignore**: Plan says don't append, only create if missing
   - Consider asking user if they want to add lines?
   - For now, follow plan: only create if doesn't exist

3. **Permission errors**: Directory creation might fail
   - Let Node.js errors bubble up naturally
   - User will see filesystem error

4. **Invalid YAML in existing config**: Not relevant for init
   - loadConfig() handles parse errors
   - Init creates fresh config anyway

---

## Dependencies Required

All dependencies already installed in `package.json`:

- `commander` - CLI framework (already used in index.ts)
- `chalk` - Terminal colors (available but not yet used)
- `yaml` - YAML parsing (used in config.ts)
- Node.js `fs`, `path`, `readline` - Built-in modules

**No new dependencies needed**

---

## TypeScript Configuration Notes

**tsconfig.json** settings relevant to init:
- `"strict": true` - All strict checks enabled
- `"target": "ES2022"` - Modern JavaScript features available
- `"module": "NodeNext"` - ESM module resolution
- `"moduleResolution": "NodeNext"` - Requires `.js` extensions

**Implications**:
- Must include `.js` in all imports
- Strict null checks enforced
- No implicit `any` types
- Must specify types explicitly

---

## Testing Strategy

### Automated Tests (from plan)

```bash
# Type checking
bun run typecheck

# Help output
bun run src/index.ts init --help
```

### Manual Tests (from plan)

**Test 1: Fresh initialization**
```bash
# In an empty directory
bun run src/index.ts init
# Enter: "Test Author"
# Accept defaults for all others

# Verify:
# - .claude-pen/config.yaml created with author
# - All directories created
# - .gitignore created
# - Success message with next steps
```

**Test 2: Double initialization**
```bash
# In same directory
bun run src/index.ts init

# Verify:
# - Shows warning "Already in a Claude Pen workspace"
# - Does not overwrite existing config
```

---

## Success Criteria

### Automated Verification
- [ ] `bun run typecheck` passes
- [ ] `bun run src/index.ts init --help` shows command description

### Manual Verification

**Fresh init test**:
- [ ] `.claude-pen/config.yaml` created with correct author name
- [ ] `.claude-pen/prompts/` directory exists
- [ ] `.claude-pen/prompts/format/` directory exists
- [ ] `corpus/blog/`, `corpus/linkedin/`, `corpus/substack/`, `corpus/twitter/` exist
- [ ] `drafts/` directory exists
- [ ] `raw/` directory exists
- [ ] `.gitignore` created with `raw/` and `drafts/`
- [ ] Success message shows next steps

**Double init test**:
- [ ] Shows warning "Already in a Claude Pen workspace"
- [ ] Does not overwrite existing config

---

## Implementation Notes

### Key Integration Points

1. **Config module** (`src/lib/config.ts`):
   - `hasConfig()` - Check workspace initialized
   - `saveConfig(config)` - Write configuration

2. **Files module** (`src/lib/files.ts`):
   - `ensureDir(path)` - Create directories

3. **Types module** (`src/types.ts`):
   - `ClaudePenConfig` - Type safety for config object

4. **Entry point** (`src/index.ts`):
   - Command registration with Commander

### Existing Utilities Provide Everything Needed

The codebase already has all necessary utilities:
- Configuration management
- Directory creation
- Type definitions
- CLI framework setup

**No new utilities need to be created** - just wire up existing pieces!

---

## References

- **Config management**: `src/lib/config.ts`
- **File operations**: `src/lib/files.ts`
- **Type definitions**: `src/types.ts`
- **CLI setup**: `src/index.ts`
- **Implementation plan**: `thoughts/shared/plans/03-init-command.md`

---

## Next Steps

1. Create `src/commands/` directory (doesn't exist yet)
2. Create `src/commands/init.ts` with implementation
3. Update `src/index.ts` to register command
4. Run verification tests
5. Create plan for next command once init is validated
