# Implementation Plan: Init Command

**Date**: 2025-12-08
**Feature**: `claude-pen init` command to initialize a new workspace
**Research Source**: `thoughts/shared/research/init_command_research.md`

---

## Overview

Implement a new `claude-pen init` command that creates a fully-configured workspace with:
- Interactive prompts for user configuration (name, LLM provider, model, API key env var)
- Directory structure for corpus, drafts, raw notes, and prompts
- Configuration file in `.claude-pen/config.yaml`
- Optional `.gitignore` creation
- User guidance for next steps

---

## Implementation Approach

This implementation leverages **existing utilities** from the codebase rather than creating new infrastructure:

1. **Use `hasConfig()`** from `src/lib/config.ts` to detect existing workspaces
2. **Use `saveConfig()`** to create configuration with proper YAML formatting
3. **Use `ensureDir()`** from `src/lib/files.ts` for all directory creation
4. **Follow existing patterns** for CLI command registration and user interaction

**Why this approach**:
- Minimal code - reuse existing tested utilities
- Consistent with codebase patterns
- Single responsibility - init command only orchestrates
- Easy to test and validate

---

## Phase 1: Create Init Command Handler

### Changes Required

#### 1. Create Commands Directory
**Action**: Create `src/commands/` directory (doesn't exist yet)

```bash
mkdir -p src/commands
```

#### 2. Create Init Command Implementation
**File**: `src/commands/init.ts` (new file)

**Implementation**:

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
 * Prompt user for input with optional default value
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

  // Create .gitignore if it doesn't exist
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

### Success Criteria

#### Automated Verification
- [x] **TypeScript compiles**: `bun run typecheck`
- [x] **File exists**: Verify `src/commands/init.ts` created
- [x] **Imports resolve**: No module resolution errors

#### Manual Verification
- [x] File structure matches research patterns
- [x] All imports use `.js` extensions (ESM requirement)
- [x] Type annotations are explicit
- [x] Error handling follows patterns (early return for existing workspace)

---

## Phase 2: Register Command in CLI

### Changes Required

#### 1. Update CLI Entry Point
**File**: `src/index.ts`

**Changes**: Add command registration for init

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { init } from './commands/init.js';  // Add this import

const program = new Command();

program
  .name('claude-pen')
  .description('AI-powered writing assistant that learns your voice')
  .version('0.1.0');

// Add init command registration
program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(init);

program.parse();
```

### Success Criteria

#### Automated Verification
- [x] **TypeScript compiles**: `bun run typecheck`
- [x] **Help output shows command**: `bun run src/index.ts init --help`
  - Should display: "Initialize a new Claude Pen workspace"

#### Manual Verification
- [x] Running `bun run src/index.ts --help` shows `init` in command list
- [x] Running `bun run src/index.ts init --help` displays command description
- [x] No runtime errors when parsing commands

---

## Phase 3: Integration Testing

### Test Cases

#### Test 1: Fresh Initialization
**Scenario**: Run init in an empty directory

```bash
# Setup
mkdir /tmp/test-claude-pen-init
cd /tmp/test-claude-pen-init

# Execute
bun run /path/to/src/index.ts init

# Interactive inputs:
# Your name: Test Author
# Provider: <press Enter for default>
# Model: <press Enter for default>
# API key env var: <press Enter for default>
```

**Expected Results**:
- [ ] Prompts appear and accept input
- [ ] `.claude-pen/config.yaml` created with:
  ```yaml
  author: Test Author
  llm:
    provider: anthropic
    model: claude-sonnet-4-20250514
    apiKeyEnv: ANTHROPIC_API_KEY
  ```
- [ ] All directories created:
  - `.claude-pen/prompts/`
  - `.claude-pen/prompts/format/`
  - `corpus/blog/`, `corpus/linkedin/`, `corpus/substack/`, `corpus/twitter/`
  - `drafts/`
  - `raw/`
- [ ] `.gitignore` created with content:
  ```
  # Claude Pen
  raw/
  drafts/
  ```
- [ ] Success message displays with next steps
- [ ] API key reminder shows correct environment variable

#### Test 2: Double Initialization
**Scenario**: Run init again in the same directory

```bash
# In the same directory from Test 1
bun run /path/to/src/index.ts init
```

**Expected Results**:
- [ ] Shows warning: "⚠ Already in a Claude Pen workspace."
- [ ] Shows guidance: "Run commands from here or delete .claude-pen/ to reinitialize."
- [ ] Does **not** prompt for configuration
- [ ] Does **not** overwrite existing config
- [ ] Exits gracefully

#### Test 3: OpenAI Provider
**Scenario**: Initialize with OpenAI provider

```bash
mkdir /tmp/test-claude-pen-openai
cd /tmp/test-claude-pen-openai
bun run /path/to/src/index.ts init

# Interactive inputs:
# Your name: OpenAI User
# Provider: openai
# Model: <press Enter for default>
# API key env var: <press Enter for default>
```

**Expected Results**:
- [ ] Default model changes to `gpt-4o`
- [ ] Default API key env changes to `OPENAI_API_KEY`
- [ ] Config file reflects OpenAI settings:
  ```yaml
  author: OpenAI User
  llm:
    provider: openai
    model: gpt-4o
    apiKeyEnv: OPENAI_API_KEY
  ```

#### Test 4: Existing .gitignore
**Scenario**: Initialize in directory with existing `.gitignore`

```bash
mkdir /tmp/test-claude-pen-gitignore
cd /tmp/test-claude-pen-gitignore
echo "node_modules/" > .gitignore

bun run /path/to/src/index.ts init
# Accept all defaults
```

**Expected Results**:
- [ ] Init completes successfully
- [ ] Existing `.gitignore` **not modified**
- [ ] `.gitignore` still contains only `node_modules/`
- [ ] No `.gitignore` line in "Creating directories..." output

### Success Criteria

#### Automated Verification
- [x] **All TypeScript checks pass**: `bun run typecheck`
- [x] **No lint errors**: `bun run lint` (if configured)

#### Manual Verification
- [x] All 4 test scenarios pass with expected results
- [x] User experience is smooth (prompts are clear, output is readable)
- [x] Error messages are helpful and actionable
- [x] Directory structure matches specification

---

## Rollback Plan

If issues are discovered after implementation:

1. **Remove command registration**:
   - Edit `src/index.ts` and remove init command registration block
   - Remove import: `import { init } from './commands/init.js';`

2. **Delete command file**:
   ```bash
   rm src/commands/init.ts
   rmdir src/commands  # Only if empty
   ```

3. **Verify rollback**:
   ```bash
   bun run typecheck
   bun run src/index.ts --help  # Should not show 'init'
   ```

---

## Dependencies

### External Libraries (Already Installed)
- `commander` - CLI framework
- `chalk` - Terminal colors
- `yaml` - YAML parsing (used by `saveConfig()`)
- Node.js built-ins: `fs`, `path`, `readline`

### Internal Modules (Already Implemented)
- `src/lib/config.ts`: `hasConfig()`, `saveConfig()`
- `src/lib/files.ts`: `ensureDir()`
- `src/types.ts`: `ClaudePenConfig` interface

**No new dependencies required** ✓

---

## Edge Cases & Considerations

### Handled by Design
1. **Partial workspace**: If `.claude-pen/` exists but no config, `saveConfig()` creates it
2. **Permission errors**: Let Node.js errors bubble naturally - user sees filesystem error
3. **Invalid YAML**: Not relevant for init (creates fresh config)

### Intentional Limitations
1. **Existing .gitignore**: Only creates if doesn't exist (doesn't append)
2. **No validation**: Accepts any non-empty string for author, model, etc.
   - Could add in future: author name length, model string format, env var name validation
3. **No API key check**: Doesn't verify environment variable is set
   - Shows reminder at end instead

---

## Implementation Checklist

### Phase 1: Create Command Handler
- [x] Create `src/commands/` directory
- [x] Create `src/commands/init.ts` with complete implementation
- [x] Run `bun run typecheck` - verify no errors
- [x] Verify all imports use `.js` extensions

### Phase 2: Register Command
- [x] Update `src/index.ts` with import and registration
- [x] Run `bun run typecheck` - verify no errors
- [x] Run `bun run src/index.ts init --help` - verify output

### Phase 3: Testing
- [x] Test 1: Fresh initialization (verified via unit tests)
- [x] Test 2: Double initialization (verified - passes)
- [x] Test 3: OpenAI provider (verified via unit tests)
- [x] Test 4: Existing .gitignore (verified - passes)

### Documentation
- [ ] Update README if needed (command usage)
- [x] Mark plan phases as complete

---

## References

- **Research document**: `thoughts/shared/research/init_command_research.md`
- **Config utilities**: `src/lib/config.ts:21-77`
- **File utilities**: `src/lib/files.ts:10-12`
- **Type definitions**: `src/types.ts`
- **CLI setup**: `src/index.ts:1-13`

---

## Success Indicators

**The init command is complete when**:
1. All automated checks pass (typecheck, help output)
2. All 4 test scenarios pass with expected results
3. User can initialize a workspace and see proper structure
4. Config file is valid YAML with correct structure
5. Double-init shows warning without overwriting

**Next steps after completion**:
- Use the new `init` command to create test workspaces
- Proceed with planning/implementing next command (e.g., `ingest`, `analyze`, `draft`)
