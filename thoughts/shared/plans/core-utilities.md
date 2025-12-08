# Implementation Plan: Core Utilities

## Overview

Build foundational utilities that all commands depend on: config management, provider-agnostic LLM client, file operations with frontmatter support, and prompt loading system. These utilities form the backbone of claude-pen's functionality.

## Implementation Approach

This plan implements utilities in dependency order:
1. **Config utilities first** - Required by all other utilities
2. **File utilities second** - Independent, needed by prompt loader
3. **Prompt loader third** - Depends on config and file utilities
4. **LLM client fourth** - Depends on config utilities
5. **Barrel exports last** - After all utilities are implemented

This approach allows incremental verification at each phase and ensures dependencies are available when needed.

---

## Phase 1: Config Management

### Changes Required

#### 1. Config Utilities Module
**File**: `src/lib/config.ts`

**Implementation**: Complete config loading, saving, and workspace detection system.

```typescript
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type { ClaudePenConfig } from '../types.js';

const CONFIG_DIR = '.claude-pen';
const CONFIG_FILE = 'config.yaml';

const DEFAULT_CONFIG: ClaudePenConfig = {
  author: '',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

/**
 * Walk up directory tree to find .claude-pen folder
 */
export function findProjectRoot(): string | null {
  let current = process.cwd();

  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, CONFIG_DIR))) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Get path to config directory
 */
export function getConfigDir(): string {
  const root = findProjectRoot();
  if (!root) {
    throw new Error('Not in a Claude Pen workspace. Run `claude-pen init` first.');
  }
  return path.join(root, CONFIG_DIR);
}

/**
 * Check if we're in an initialized workspace
 */
export function hasConfig(): boolean {
  return findProjectRoot() !== null;
}

/**
 * Load config from .claude-pen/config.yaml
 */
export function loadConfig(): ClaudePenConfig {
  const configPath = path.join(getConfigDir(), CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.parse(content) as Partial<ClaudePenConfig>;

  return { ...DEFAULT_CONFIG, ...config };
}

/**
 * Save config to .claude-pen/config.yaml
 */
export function saveConfig(config: ClaudePenConfig): void {
  const configDir = path.join(process.cwd(), CONFIG_DIR);
  const configPath = path.join(configDir, CONFIG_FILE);

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, yaml.stringify(config));
}

/**
 * Get default config for init
 */
export function getDefaultConfig(): ClaudePenConfig {
  return { ...DEFAULT_CONFIG };
}
```

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes with no errors
- [x] File created without syntax errors

#### Manual Verification
- [ ] Create test workspace: `mkdir -p test-workspace/.claude-pen`
- [ ] Create test config with `saveConfig()`:
  ```bash
  cd test-workspace
  bun -e "import { saveConfig, getDefaultConfig } from '../src/lib/config.js'; saveConfig({ ...getDefaultConfig(), author: 'Test User' })"
  ```
- [ ] Verify config file created at `.claude-pen/config.yaml`
- [ ] Load config and verify author: `bun -e "import { loadConfig } from '../src/lib/config.js'; console.log(loadConfig().author)"`
- [ ] Test `findProjectRoot()` from subdirectory: `mkdir sub && cd sub && bun -e "import { findProjectRoot } from '../../src/lib/config.js'; console.log(findProjectRoot())"`
- [ ] Verify error when not in workspace: `cd /tmp && bun -e "import { loadConfig } from '/path/to/src/lib/config.js'; loadConfig()"` (should throw)
- [ ] Clean up: `rm -rf test-workspace`

---

## Phase 2: File Utilities

### Changes Required

#### 1. File Operations Module
**File**: `src/lib/files.ts`

**Implementation**: File operations with frontmatter parsing, slugification, and word counting.

```typescript
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import yaml from 'yaml';
import { findProjectRoot } from './config.js';

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Parse markdown file with YAML frontmatter
 */
export function readMarkdown(filePath: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Check for frontmatter
  if (!raw.startsWith('---')) {
    return { frontmatter: {}, content: raw };
  }

  const endIndex = raw.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: {}, content: raw };
  }

  const frontmatterStr = raw.slice(3, endIndex).trim();
  const content = raw.slice(endIndex + 3).trim();

  try {
    const frontmatter = yaml.parse(frontmatterStr) ?? {};
    return { frontmatter, content };
  } catch {
    return { frontmatter: {}, content: raw };
  }
}

/**
 * Write markdown file with YAML frontmatter
 */
export function writeMarkdown(
  filePath: string,
  frontmatter: Record<string, unknown>,
  content: string
): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  let output: string;

  if (Object.keys(frontmatter).length > 0) {
    output = `---\n${yaml.stringify(frontmatter)}---\n\n${content}`;
  } else {
    output = content;
  }

  fs.writeFileSync(filePath, output);
}

/**
 * List all markdown files in directory (recursive)
 */
export async function listMarkdownFiles(dir: string): Promise<string[]> {
  const pattern = path.join(dir, '**/*.md');
  return glob(pattern, { nodir: true });
}

/**
 * Get project root or throw
 */
export function getProjectRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    throw new Error('Not in a Claude Pen workspace. Run `claude-pen init` first.');
  }
  return root;
}

/**
 * Get path relative to project root
 */
export function getPath(...segments: string[]): string {
  return path.join(getProjectRoot(), ...segments);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Slugify a string for filenames
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
```

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes with no errors
- [x] No import or syntax errors

#### Manual Verification
- [ ] Create test markdown with frontmatter:
  ```bash
  mkdir -p test-workspace/.claude-pen
  cat > test-workspace/test.md << 'EOF'
  ---
  title: Test Document
  author: Test User
  ---

  # Hello World

  This is a test document with **bold** text.
  EOF
  ```
- [ ] Test `readMarkdown()`:
  ```bash
  cd test-workspace
  bun -e "import { readMarkdown } from '../src/lib/files.js'; const result = readMarkdown('./test.md'); console.log(JSON.stringify(result, null, 2))"
  ```
- [ ] Verify frontmatter parsed correctly (title, author)
- [ ] Test `writeMarkdown()`:
  ```bash
  bun -e "import { writeMarkdown } from '../src/lib/files.js'; writeMarkdown('./output.md', { status: 'draft' }, '# Output Test')"
  ```
- [ ] Verify output.md has frontmatter and content
- [ ] Test `countWords()`: `bun -e "import { countWords } from '../src/lib/files.js'; console.log(countWords('Hello world test'))"`
- [ ] Test `slugify()`: `bun -e "import { slugify } from '../src/lib/files.js'; console.log(slugify('Hello World! Test 123'))"`
- [ ] Test `listMarkdownFiles()`: `bun -e "import { listMarkdownFiles } from '../src/lib/files.js'; listMarkdownFiles('.').then(console.log)"`
- [ ] Clean up: `rm -rf test-workspace`

---

## Phase 3: Prompt Loading System

### Changes Required

#### 1. Prompt Loader Module
**File**: `src/lib/prompts.ts`

**Implementation**: Prompt loading with user override support and template interpolation.

```typescript
import fs from 'fs';
import path from 'path';
import { findProjectRoot } from './config.js';

/**
 * Get the directory where bundled prompts live
 */
function getBundledPromptsDir(): string {
  // In development, relative to this file
  // src/lib/prompts.ts -> src/prompts/
  return path.join(path.dirname(import.meta.url.replace('file://', '')), '../prompts');
}

/**
 * Get user's custom prompts directory
 */
function getUserPromptsDir(): string | null {
  const root = findProjectRoot();
  if (!root) return null;

  const userDir = path.join(root, '.claude-pen', 'prompts');
  return fs.existsSync(userDir) ? userDir : null;
}

/**
 * Load a prompt by name
 *
 * Priority: user's .claude-pen/prompts/ > bundled prompts
 *
 * @param name - Prompt name like 'proofread' or 'format/linkedin'
 */
export function loadPrompt(name: string): string {
  const filename = name.endsWith('.md') ? name : `${name}.md`;

  // Try user prompts first
  const userDir = getUserPromptsDir();
  if (userDir) {
    const userPath = path.join(userDir, filename);
    if (fs.existsSync(userPath)) {
      return fs.readFileSync(userPath, 'utf-8');
    }
  }

  // Fall back to bundled prompts
  const bundledPath = path.join(getBundledPromptsDir(), filename);
  if (fs.existsSync(bundledPath)) {
    return fs.readFileSync(bundledPath, 'utf-8');
  }

  throw new Error(`Prompt not found: ${name}`);
}

/**
 * Interpolate variables into prompt template
 *
 * Replaces {{variable}} with values from context
 */
export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in context) {
      return context[key];
    }
    return `{{${key}}}`; // Leave unmatched
  });
}
```

#### 2. Test Prompt Files

**File**: `src/prompts/test.md`
```markdown
Hello {{name}}! Welcome to {{project}}.
```

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes with no errors
- [x] No import errors from config.js dependency

#### Manual Verification
- [ ] Create bundled test prompt: `mkdir -p src/prompts && echo 'Hello {{name}}!' > src/prompts/test.md`
- [ ] Test `loadPrompt()` with bundled prompt:
  ```bash
  bun -e "import { loadPrompt } from './src/lib/prompts.js'; console.log(loadPrompt('test'))"
  ```
- [ ] Create workspace with user override:
  ```bash
  mkdir -p test-workspace/.claude-pen/prompts
  echo 'Custom {{name}}!' > test-workspace/.claude-pen/prompts/test.md
  ```
- [ ] Test user override takes precedence:
  ```bash
  cd test-workspace
  bun -e "import { loadPrompt } from '../src/lib/prompts.js'; console.log(loadPrompt('test'))"
  ```
- [ ] Test `interpolate()`:
  ```bash
  bun -e "import { interpolate } from './src/lib/prompts.js'; console.log(interpolate('Hello {{name}}!', { name: 'World' }))"
  ```
- [ ] Test unmatched variables stay intact:
  ```bash
  bun -e "import { interpolate } from './src/lib/prompts.js'; console.log(interpolate('{{name}} {{missing}}', { name: 'Test' }))"
  ```
- [ ] Test subdirectory prompts: `mkdir -p src/prompts/format && echo 'Format test' > src/prompts/format/test.md`
- [ ] Load subdirectory prompt: `bun -e "import { loadPrompt } from './src/lib/prompts.js'; console.log(loadPrompt('format/test'))"`
- [ ] Clean up test files

---

## Phase 4: LLM Client

### Changes Required

#### 1. LLM Client Module
**File**: `src/lib/llm.ts`

**Implementation**: Provider-agnostic LLM client with Anthropic implementation and OpenAI placeholder.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import ora from 'ora';
import { loadConfig } from './config.js';

export interface LLMOptions {
  system?: string;
  maxTokens?: number;
}

export interface LLMClient {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
}

/**
 * Create Anthropic client
 */
function createAnthropicClient(apiKey: string, model: string): LLMClient {
  const client = new Anthropic({ apiKey });

  return {
    async complete(prompt: string, options: LLMOptions = {}): Promise<string> {
      const response = await client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 4096,
        system: options.system,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock?.text ?? '';
    },
  };
}

/**
 * Create OpenAI client (placeholder for future)
 */
function createOpenAIClient(apiKey: string, model: string): LLMClient {
  // TODO: Implement when adding OpenAI support
  throw new Error('OpenAI provider not yet implemented');
}

/**
 * Get configured LLM client
 */
export function getLLMClient(): LLMClient {
  const config = loadConfig();
  const apiKey = process.env[config.llm.apiKeyEnv];

  if (!apiKey) {
    throw new Error(
      `API key not found. Set ${config.llm.apiKeyEnv} environment variable.`
    );
  }

  switch (config.llm.provider) {
    case 'anthropic':
      return createAnthropicClient(apiKey, config.llm.model);
    case 'openai':
      return createOpenAIClient(apiKey, config.llm.model);
    default:
      throw new Error(`Unknown provider: ${config.llm.provider}`);
  }
}

/**
 * Complete with spinner UI
 */
export async function complete(
  prompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const spinner = ora('Thinking...').start();

  try {
    const client = getLLMClient();
    const result = await client.complete(prompt, options);
    spinner.succeed('Done');
    return result;
  } catch (error) {
    spinner.fail('Failed');
    throw error;
  }
}
```

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes with no errors
- [x] No import errors from config.js dependency

#### Manual Verification
- [ ] Set up test workspace:
  ```bash
  mkdir -p test-workspace/.claude-pen
  bun -e "import { saveConfig, getDefaultConfig } from './src/lib/config.js'; saveConfig(getDefaultConfig())"
  ```
- [ ] Test error when API key missing:
  ```bash
  cd test-workspace
  unset ANTHROPIC_API_KEY
  bun -e "import { complete } from '../src/lib/llm.js'; complete('test').catch(e => console.log(e.message))"
  ```
- [ ] Verify error message mentions ANTHROPIC_API_KEY
- [ ] Test with valid API key (if available):
  ```bash
  export ANTHROPIC_API_KEY=your_key
  bun -e "import { complete } from '../src/lib/llm.js'; complete('Say hello in 3 words').then(console.log)"
  ```
- [ ] Verify spinner appears and completion works
- [ ] Test system prompt option:
  ```bash
  bun -e "import { complete } from '../src/lib/llm.js'; complete('Respond', { system: 'You are a pirate' }).then(console.log)"
  ```
- [ ] Test OpenAI provider throws not implemented:
  ```bash
  # Create config with openai provider
  bun -e "import { saveConfig } from '../src/lib/config.js'; saveConfig({ author: '', llm: { provider: 'openai', model: 'gpt-4', apiKeyEnv: 'OPENAI_API_KEY' } })"
  bun -e "import { complete } from '../src/lib/llm.js'; complete('test').catch(e => console.log(e.message))"
  ```
- [ ] Clean up: `rm -rf test-workspace`

---

## Phase 5: Module Exports

### Changes Required

#### 1. Barrel Export File
**File**: `src/lib/index.ts`

**Implementation**: Central export point for all library modules.

```typescript
export * from './config.js';
export * from './files.js';
export * from './llm.js';
export * from './prompts.js';
```

### Success Criteria

#### Automated Verification
- [x] `bun run typecheck` passes with no errors
- [x] No circular dependency warnings

#### Manual Verification
- [ ] Test importing from barrel:
  ```bash
  bun -e "import { loadConfig, readMarkdown, complete, loadPrompt } from './src/lib/index.js'; console.log('All imports successful')"
  ```
- [ ] Verify all exports accessible
- [ ] Test type imports work:
  ```bash
  bun -e "import type { LLMClient, LLMOptions } from './src/lib/index.js'; console.log('Type imports successful')"
  ```

---

## Rollback Plan

If issues arise during implementation:

1. **Phase 1 rollback**: Delete `src/lib/config.ts`
2. **Phase 2 rollback**: Delete `src/lib/files.ts`
3. **Phase 3 rollback**: Delete `src/lib/prompts.ts` and test prompt files
4. **Phase 4 rollback**: Delete `src/lib/llm.ts`
5. **Phase 5 rollback**: Delete `src/lib/index.ts`

Each phase is independent until Phase 5, so rollback is straightforward.

---

## Notes

- All utilities use ES modules (`.js` extensions in imports)
- Config loading walks up directory tree for workspace detection
- File utilities handle frontmatter parsing robustly
- Prompt loading supports user overrides in `.claude-pen/prompts/`
- LLM client is provider-agnostic with clear extension points
- Comprehensive manual testing ensures utilities work correctly before building commands on top