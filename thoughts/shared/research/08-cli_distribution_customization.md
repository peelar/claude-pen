# Research: CLI Distribution & Customization Architecture

**Date**: 2025-12-09
**Research Question**: How can we rebuild features with customizability in mind for CLI distribution, especially for custom prompts and user-specific voice/workflow (like the draft command)?

---

## Executive Summary

The `claude-pen` codebase has **excellent foundations** for customization and is well-positioned for distribution. Key findings:

1. **Prompt Override System** - Already implemented but underutilized. Users can override ANY prompt by placing files in `.claude-pen/prompts/`
2. **Configuration Architecture** - Clean YAML-based config with environment variable overrides
3. **Extensibility Points** - Clear patterns for adding custom refinement passes, voice profiles, and platforms
4. **Distribution Gaps** - Needs build process, bundled prompts, and extended configuration schema

**Key Insight**: Most infrastructure for user customization already exists. The main work is documentation, configuration expansion, and build tooling.

---

## Table of Contents

1. [Current Customization Capabilities](#1-current-customization-capabilities)
2. [Prompt System Architecture](#2-prompt-system-architecture)
3. [Configuration System](#3-configuration-system)
4. [Command Architecture & Data Flow](#4-command-architecture--data-flow)
5. [Customization Extension Points](#5-customization-extension-points)
6. [Distribution Requirements](#6-distribution-requirements)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Code References](#8-code-references)

---

## 1. Current Customization Capabilities

### 1.1 Already Implemented ✅

| Feature | Location | Status |
|---------|----------|--------|
| **Prompt overrides** | `.claude-pen/prompts/` | ✅ Fully functional |
| **YAML configuration** | `.claude-pen/config.yaml` | ✅ Working, needs extension |
| **Environment variables** | `.env` | ✅ API keys, model overrides |
| **Model aliases** | `src/lib/env.ts:29-54` | ✅ User-friendly names |
| **Interactive selection** | `src/commands/refine.ts:146-175` | ✅ Rich file discovery |
| **Style guide system** | `writing/_style_guide.md` | ✅ Voice learning |

### 1.2 Not Yet Implemented ❌

| Feature | Impact | Complexity |
|---------|--------|------------|
| **System message config** | High | Low |
| **Custom refinement passes** | High | Medium |
| **Voice profile management** | High | Medium |
| **Multiple style guides** | Medium | Low |
| **Custom platforms** | Low | Low |
| **Plugin system** | Low | High |

---

## 2. Prompt System Architecture

### 2.1 Two-Tier Prompt Loading

**Location**: `src/lib/prompts.ts:26-51`

```
Priority Chain:
1. User prompts:    .claude-pen/prompts/[name].md  (highest priority)
2. Bundled prompts: src/prompts/[name].md          (fallback)
```

**Key Implementation**:

```typescript
// src/lib/prompts.ts:32-51
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
```

### 2.2 Bundled Prompts

**Location**: `src/prompts/`

| Prompt | Purpose | Variables |
|--------|---------|-----------|
| `draft.md` | Transform raw notes into structured drafts | `{{style_guide}}`, `{{notes}}` |
| `proofread.md` | Fix grammar, spelling, awkward phrasing | `{{style_guide}}`, `{{content}}` |
| `punchier.md` | Tighten prose and strengthen impact | `{{style_guide}}`, `{{content}}` |
| `clarity.md` | Improve flow and comprehension | `{{style_guide}}`, `{{content}}` |
| `review.md` | Generate improvement suggestions | `{{content}}` |
| `analyze.md` | Generate style guide from samples | `{{samples}}`, `{{platforms}}` |
| `ingest.md` | Extract metadata from articles | `{{content}}` |

**Customization**: Users can override any of these by creating `.claude-pen/prompts/[name].md`

### 2.3 Template Interpolation

**Location**: `src/lib/prompts.ts:58-68`

Simple `{{variable}}` replacement:

```typescript
export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in context) {
      return context[key];
    }
    return `{{${key}}}`; // Leave unmatched variables as-is
  });
}
```

**Usage Pattern** (from `src/commands/draft.ts:118`):
```typescript
const promptTemplate = loadPrompt('draft');
const prompt = interpolate(promptTemplate, {
  style_guide: styleGuide,
  notes: notesContent,
});
```

---

## 3. Configuration System

### 3.1 Configuration Schema

**Location**: `src/types.ts:7-14`

**Current Schema**:
```typescript
export interface ClaudePenConfig {
  author: string;
  llm: {
    provider: 'anthropic';
    model: string;
    apiKeyEnv: string;
  };
}
```

**Example** (`.claude-pen/config.yaml`):
```yaml
author: Adrian
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  apiKeyEnv: ANTHROPIC_API_KEY
```

### 3.2 Configuration Loading

**Location**: `src/lib/config.ts:55-66`

**Pattern**: Convention over configuration with sensible defaults

```typescript
// Lines 9-16: Default configuration
const DEFAULT_CONFIG: ClaudePenConfig = {
  author: '',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

// Lines 55-66: Load and merge with defaults
export function loadConfig(): ClaudePenConfig {
  const configPath = path.join(getConfigDir(), CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new Error('No .claude-pen/config.yaml found...');
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.parse(raw);

  return { ...DEFAULT_CONFIG, ...config };  // Merge
}
```

### 3.3 Environment Variable Overrides

**Location**: `src/lib/env.ts`

**Priority Chain**:
1. `ANTHROPIC_MODEL` env var (highest)
2. `CLAUDE_PEN_MODEL` env var
3. `config.llm.model` from config.yaml
4. Default: `claude-sonnet-4-20250514`

**Model Aliases** (`src/lib/env.ts:29-54`):
- Simple names: `sonnet`, `opus`, `haiku`
- Version names: `sonnet-4.5`, `opus-4.5`
- Full IDs: `claude-sonnet-4-20250514`

---

## 4. Command Architecture & Data Flow

### 4.1 Command Registration Pattern

**Location**: `src/index.ts:22-105`

All commands follow the same pattern:

```typescript
program
  .command('command-name [arg]')
  .description('Command description')
  .option('--flag <value>', 'Flag description', 'default')
  .action(async (arg, options) => {
    try {
      await commandFunction(arg, options);
      process.exit(0);
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

### 4.2 Data Flow: User Input → API → Output

**Example**: Refine Command (`src/commands/refine.ts`)

```
1. User Input (line 177)
   └─> CLI args: file path, --pass, --tone

2. File Discovery (lines 196-207)
   └─> Interactive selection if no file specified

3. Style Guide Loading (lines 35-45)
   └─> Loads writing/_style_guide.md
   └─> Falls back to default message if missing

4. Prompt Construction (lines 224-228)
   └─> loadPrompt(pass) → Gets template
   └─> interpolate() → Injects style_guide + content

5. LLM Call (lines 234-244)
   └─> complete(prompt, options)
       ├─> System message constructed
       ├─> Tone adjustment injected
       └─> maxTokens: 8000

6. Output Generation (lines 249-275)
   └─> Timestamped filename: [basename]-[timestamp]-[pass].md
   └─> Written to same directory as input
```

### 4.3 System Messages (Hardcoded)

**Location**: Scattered across command files

| Command | File | Line | System Message |
|---------|------|------|----------------|
| **draft** | `src/commands/draft.ts` | 127 | `'You are a skilled ghostwriter...'` |
| **refine** | `src/commands/refine.ts` | 234-237 | Dynamic with tone injection |
| **review** | `src/commands/review.ts` | 66 | `'You are an insightful editor...'` |
| **analyze** | `src/commands/analyze.ts` | 186 | `'You are an expert writing style analyst.'` |

**Customization Opportunity**: Move these to configuration or prompt files

---

## 5. Customization Extension Points

### 5.1 Voice Profiles

**Current**: Single style guide at `writing/_style_guide.md`

**Extension Pattern**:

```yaml
# .claude-pen/config.yaml
author: Adrian
voice:
  default: personal
  profiles:
    technical: "Focus on precision, avoid metaphors"
    blog: "Conversational, storytelling, personal anecdotes"
    social: "Punchy, engaging, with clear CTAs"
```

**Implementation**:

```typescript
// Load voice profile
function loadVoiceProfile(name?: string): string {
  const profileName = name || config.voice?.default || 'default';
  const stylePath = getPath(`writing/_styles/${profileName}.md`);

  if (fs.existsSync(stylePath)) {
    return fs.readFileSync(stylePath, 'utf-8');
  }

  // Fallback to default style guide
  return loadStyleGuide();
}
```

**CLI Usage**:
```bash
claude-pen draft notes.md --voice technical
claude-pen refine draft.md --voice blog
```

### 5.2 Custom Refinement Passes

**Current**: Hardcoded in `src/types.ts:3`

```typescript
export type RefinePass = 'proofread' | 'punchier' | 'clarity';
```

**Extension Pattern**:

```yaml
# .claude-pen/config.yaml
refinement:
  default_pass: proofread
  custom_passes:
    technical_accuracy:
      description: "Verify technical claims and code examples"
      prompt: "prompts/custom/technical.md"
    seo_optimize:
      description: "Improve SEO without sacrificing readability"
      prompt: "prompts/custom/seo.md"
```

**Implementation**:

```typescript
// Dynamically load pass description and prompt
function loadPass(pass: string, config: ClaudePenConfig): PassInfo {
  // Check custom passes first
  const customPass = config.refinement?.custom_passes?.[pass];
  if (customPass) {
    return {
      description: customPass.description,
      prompt: loadPrompt(customPass.prompt),
    };
  }

  // Fall back to built-in
  return {
    description: PASS_DESCRIPTIONS[pass],
    prompt: loadPrompt(pass),
  };
}
```

### 5.3 System Message Customization

**Extension Pattern**:

```yaml
# .claude-pen/config.yaml
system_messages:
  draft: "You are a technical writer who creates detailed, accurate documentation"
  refine: "You are an editor specializing in {platform} content"
  review: "You provide constructive feedback focused on clarity and impact"
```

**Implementation**:

```typescript
// In each command
function getSystemMessage(command: string, config: ClaudePenConfig): string {
  const custom = config.system_messages?.[command];
  if (custom) {
    return interpolate(custom, { platform, tone, etc });
  }

  return DEFAULT_SYSTEM_MESSAGES[command];
}
```

### 5.4 Custom Platforms

**Current**: Hardcoded in `src/types.ts:1`

```typescript
export type Platform = 'blog' | 'linkedin' | 'substack' | 'twitter';
```

**Extension Pattern**:

```yaml
# .claude-pen/config.yaml
platforms:
  custom:
    medium:
      content_dir: writing/content/medium
      style_guide: writing/_styles/medium.md
    newsletter:
      content_dir: writing/content/newsletter
      style_guide: writing/_styles/newsletter.md
```

---

## 6. Distribution Requirements

### 6.1 Current Package Configuration

**Location**: `package.json:1-29`

```json
{
  "name": "claude-pen",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "claude-pen": "./src/index.ts"  // ← Points to source (needs fix)
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "bunx biome check src/"
  }
}
```

**Issues for Distribution**:
- ❌ Binary points to TypeScript source
- ❌ No build script
- ❌ Prompts in `src/` won't be accessible after build
- ❌ No `files` field to control what's published

### 6.2 Build Process Requirements

**Recommended Changes**:

```json
{
  "name": "claude-pen",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "claude-pen": "./dist/index.js"
  },
  "files": [
    "dist/",
    "prompts/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target node && npm run copy-prompts",
    "copy-prompts": "mkdir -p dist/prompts && cp -r src/prompts/* dist/prompts/",
    "prepublishOnly": "npm run typecheck && npm run lint && npm run build",
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "bunx biome check src/"
  }
}
```

### 6.3 Prompt Resolution for Distribution

**Location**: `src/lib/prompts.ts:8-12`

**Current Implementation**:
```typescript
function getBundledPromptsDir(): string {
  return path.join(path.dirname(import.meta.url.replace('file://', '')), '../prompts');
}
```

**Issue**: After build, prompts need to be resolved from `dist/` directory

**Solution**:
```typescript
function getBundledPromptsDir(): string {
  const isDist = import.meta.url.includes('/dist/');
  const baseDir = path.dirname(import.meta.url.replace('file://', ''));

  return isDist
    ? path.join(baseDir, '../prompts')      // dist/lib → prompts/
    : path.join(baseDir, '../prompts');     // src/lib → src/prompts/
}
```

### 6.4 Distribution Checklist

**Pre-publish**:
- [ ] Add build script to compile TypeScript
- [ ] Copy prompts to `dist/prompts/` during build
- [ ] Update binary path to `dist/index.js`
- [ ] Add entry point shebang: `#!/usr/bin/env node`
- [ ] Add `files` field to control published content
- [ ] Add `.npmignore` to exclude dev files
- [ ] Test installation: `npm install -g .`
- [ ] Verify bundled prompts are accessible
- [ ] Test all commands in fresh install

**Recommended .npmignore**:
```
src/
thoughts/
writing/
.claude/
.claude-pen/
.git/
.env
.env.example
tsconfig.json
*.md
!README.md
```

---

## 7. Implementation Roadmap

### Phase 1: Configuration Extensions (Low Risk)

**Goal**: Enable user customization through config file

**Tasks**:
1. Extend `ClaudePenConfig` schema in `src/types.ts`
2. Add voice profile support
3. Add custom refinement passes
4. Add system message overrides
5. Update config loading in `src/lib/config.ts`

**Example Config Schema**:
```typescript
export interface ClaudePenConfig {
  author: string;
  llm: {
    provider: 'anthropic';
    model: string;
    apiKeyEnv: string;
  };
  voice?: {
    default?: string;
    profiles?: Record<string, string>;
  };
  refinement?: {
    default_pass?: RefinePass;
    custom_passes?: Record<string, {
      description: string;
      prompt: string;
    }>;
  };
  system_messages?: Record<string, string>;
  platforms?: {
    custom?: Record<string, {
      content_dir: string;
      style_guide?: string;
    }>;
  };
}
```

### Phase 2: Command Extensions (Medium Risk)

**Goal**: Support new configuration options in commands

**Tasks**:
1. Add `--voice` flag to draft and refine commands
2. Load voice profiles from config
3. Support custom refinement passes
4. Use configurable system messages
5. Update help text to show custom options

**Files to Modify**:
- `src/commands/draft.ts`
- `src/commands/refine.ts`
- `src/commands/review.ts`
- `src/index.ts` (command registration)

### Phase 3: Distribution Setup (Medium Risk)

**Goal**: Package for npm distribution

**Tasks**:
1. Add build script to `package.json`
2. Create prompt copying mechanism
3. Update prompt resolution for dist
4. Add shebang to entry point
5. Configure `files` field
6. Create `.npmignore`
7. Test local installation
8. Test bundled prompts work

**Files to Create/Modify**:
- `package.json` (build scripts)
- `src/lib/prompts.ts` (dist resolution)
- `src/index.ts` (shebang)
- `.npmignore` (new file)

### Phase 4: Documentation (Low Risk)

**Goal**: Document customization features

**Tasks**:
1. Document prompt override system
2. Create example custom prompts
3. Document voice profile configuration
4. Document custom refinement passes
5. Create distribution guide
6. Add troubleshooting section

**Files to Create/Update**:
- `README.md` (user guide)
- `CLAUDE.md` (developer guide)
- `docs/customization.md` (new)
- `docs/distribution.md` (new)

### Phase 5: Profile Management (Higher Risk, Optional)

**Goal**: Add commands for managing profiles

**Tasks**:
1. Create `profile` command group
2. Add `profile create` subcommand
3. Add `profile list` subcommand
4. Add `profile edit` subcommand
5. Add `profile delete` subcommand
6. Add `profile analyze` subcommand

**Example Usage**:
```bash
claude-pen profile create technical "Technical writing style"
claude-pen profile list
claude-pen profile analyze blog --samples writing/content/blog/
```

---

## 8. Code References

### Core Infrastructure

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **CLI Entry Point** | `src/index.ts` | 1-108 | Command registration |
| **Type Definitions** | `src/types.ts` | 1-25 | Configuration schema |
| **Config Loading** | `src/lib/config.ts` | 1-85 | YAML config management |
| **Environment Validation** | `src/lib/env.ts` | 1-203 | API key, model validation |
| **Prompt System** | `src/lib/prompts.ts` | 1-69 | Prompt loading & interpolation |
| **LLM Integration** | `src/lib/llm.ts` | 1-83 | API client factory |
| **File Utilities** | `src/lib/files.ts` | 1-109 | File operations |

### Commands

| Command | File | Key Functions | Lines |
|---------|------|---------------|-------|
| **init** | `src/commands/init.ts` | `init()` | 1-144 |
| **ingest** | `src/commands/ingest.ts` | `ingest()` | 1-158 |
| **analyze** | `src/commands/analyze.ts` | `analyze()` | 1-242 |
| **draft** | `src/commands/draft.ts` | `draft()`, `loadStyleGuide()` | 1-151 |
| **review** | `src/commands/review.ts` | `review()` | 1-121 |
| **refine** | `src/commands/refine.ts` | `refine()`, `selectDraftFile()` | 1-286 |

### Prompts

| Prompt | Location | Variables | Lines |
|--------|----------|-----------|-------|
| **draft** | `src/prompts/draft.md` | `{{style_guide}}`, `{{notes}}` | 42 |
| **proofread** | `src/prompts/proofread.md` | `{{style_guide}}`, `{{content}}` | 29 |
| **punchier** | `src/prompts/punchier.md` | `{{style_guide}}`, `{{content}}` | 29 |
| **clarity** | `src/prompts/clarity.md` | `{{style_guide}}`, `{{content}}` | 29 |
| **review** | `src/prompts/review.md` | `{{content}}` | 77 |
| **analyze** | `src/prompts/analyze.md` | `{{samples}}`, `{{platforms}}` | 37 |
| **ingest** | `src/prompts/ingest.md` | `{{content}}` | 22 |

### Extension Points Summary

| Feature | Current File | Lines | Extension Type |
|---------|-------------|-------|----------------|
| **Config Schema** | `src/types.ts` | 7-14 | Add fields |
| **Prompt Loading** | `src/lib/prompts.ts` | 32-51 | Already extensible |
| **System Messages** | Command files | Various | Move to config |
| **Refinement Passes** | `src/types.ts` | 3 | Make dynamic |
| **Platforms** | `src/types.ts` | 1 | Make dynamic |
| **Model Aliases** | `src/lib/env.ts` | 29-54 | Add entries |

---

## Key Takeaways

1. **Prompt Override System is Production-Ready**
   - Users can already override any prompt by creating `.claude-pen/prompts/[name].md`
   - Supports nested directories (e.g., `format/linkedin.md`)
   - Just needs documentation and examples

2. **Configuration System is Easily Extensible**
   - Add new fields to `ClaudePenConfig` interface
   - Update `DEFAULT_CONFIG` with sensible defaults
   - Existing merge pattern handles backward compatibility

3. **Distribution Requires Build Tooling**
   - Add build script to compile TypeScript
   - Copy prompts to dist during build
   - Update prompt resolution for bundled vs. source
   - Test thoroughly before publishing

4. **Voice/Style Customization Maps Well to Existing Patterns**
   - Voice profiles → Style guide variants
   - Custom passes → Custom prompt files
   - System messages → Configuration overrides

5. **Clean Architecture Enables Extension**
   - Separation of concerns (commands, prompts, config, lib)
   - Consistent patterns across commands
   - Type-safe interfaces
   - Minimal coupling

---

## Recommendations

### Immediate Actions (Before Distribution)

1. **Document Prompt Override Feature**
   - Add section to README.md
   - Create example custom prompts
   - Show how to customize voice

2. **Add Build Process**
   - Implement build script
   - Test bundled distribution
   - Verify prompt resolution

3. **Extend Configuration Schema**
   - Add voice profiles
   - Add custom passes
   - Maintain backward compatibility

### Future Enhancements (Post-Distribution)

1. **Profile Management Commands**
   - `profile create/edit/delete`
   - `profile analyze` for voice extraction

2. **Plugin System**
   - Auto-discover commands in `.claude-pen/commands/`
   - Support custom command registration

3. **Advanced Features**
   - Multiple LLM provider support
   - Streaming responses
   - Batch processing
   - Conditional refinement pipelines

---

**Research Completed**: 2025-12-09
**Next Step**: Create implementation plan for Phase 1 (Configuration Extensions)