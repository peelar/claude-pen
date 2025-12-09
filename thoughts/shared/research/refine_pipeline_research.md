# Research: Refine Pipeline Implementation

## Overview

Research conducted to implement a progressive refinement pipeline with three stages:
1. **Format** - Structure and organize raw writing (verbatim)
2. **Review** - Analyze content and output suggestions to markdown
3. **Refine** - Apply improvements with optional tone selection

## Current State

The `refine` command is **fully implemented** with the following features:
- Interactive file selection when no file specified
- Three refinement passes: `proofread`, `clarity`, `punchier`
- Timestamped output files to preserve versions
- Style guide integration with graceful fallback
- Rich UX with word counts and suggestions

**Key Files:**
- `/Users/adrianpilarczyk/Code/claude-pen/src/commands/refine.ts` - Complete implementation (254 lines)
- `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/proofread.md` - Grammar/spelling pass
- `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/clarity.md` - Flow/comprehension pass
- `/Users/adrianpilarczyk/Code/claude-pen/src/prompts/punchier.md` - Impact/conciseness pass

## Architecture Patterns

### Command Structure
All commands follow this pattern:
1. Imports (external → internal)
2. Constants (UPPER_SNAKE_CASE)
3. Type definitions (interfaces for options)
4. Helper functions (camelCase)
5. Main export (async function)

### LLM Interaction
Three-layer architecture:
1. **Command layer** - User-facing logic
2. **LLM abstraction** - `complete()` function in `src/lib/llm.ts`
3. **Anthropic SDK** - Actual API calls

### Prompt System
- Templates stored as markdown files in `src/prompts/`
- Variable interpolation using `{{variable}}` syntax
- Hierarchical loading (user prompts → bundled prompts)

## Implementation Needs for New Pipeline

### 1. Format Command (New)

**Purpose**: Structure raw writing into organized sections

**Pattern to Follow**: `draft.ts` command structure

**Needs**:
- Command file: `src/commands/format.ts`
- Prompt template: `src/prompts/format.md`
- CLI registration in `src/index.ts`

**Key Differences from Draft**:
- More aggressive structuring (sections, headings)
- Focus on organization over voice preservation
- Output should be "verbatim but organized"

### 2. Review Command (New)

**Purpose**: Analyze content and output suggestions to markdown file

**Pattern to Follow**: Analysis workflow similar to `analyze.ts`

**Needs**:
- Command file: `src/commands/review.ts`
- Prompt template: `src/prompts/review.md`
- Output format: Separate `[filename]-review.md` file with suggestions
- CLI registration in `src/index.ts`

**Key Features**:
- Read input file
- Analyze for clarity, structure, logic gaps
- Output rationale and specific suggestions
- Do NOT modify original content
- Suggestions file format: sections with line references

### 3. Refine Command Updates (Enhance Existing)

**Current**: Takes draft and applies one of three passes

**Enhancement Needed**: Add tone selection

**Implementation**:
- Add `--tone` option to CLI registration
- Create tone-specific prompt variants or dynamic system messages
- Update type definitions if needed

**Tone Options** (from conversation):
- punchy
- funny
- personal
- formal (maybe)

### 4. Pipeline Integration

**User Flow**:
```bash
# Step 1: Format (mandatory)
claude-pen format raw-notes.md
# Output: raw-notes-formatted.md

# Step 2: Review (optional)
claude-pen review raw-notes-formatted.md
# Output: raw-notes-formatted-review.md (suggestions file)

# Step 3: Refine (optional, with tone)
claude-pen refine raw-notes-formatted.md --pass clarity --tone punchy
# Output: raw-notes-formatted-20250109143022-clarity.md
```

## Key Files Reference

### Existing Commands
| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/commands/draft.ts` | Transform notes to structured drafts | 166 | ✅ Complete |
| `src/commands/analyze.ts` | Generate style guide from samples | 215 | ✅ Complete |
| `src/commands/refine.ts` | Apply editorial passes | 254 | ✅ Complete |
| `src/commands/ingest.ts` | Batch import with metadata | ~250 | ✅ Complete |
| `src/commands/init.ts` | Initialize workspace | ~100 | ✅ Complete |

### Utilities
| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/lib/files.ts` | File operations | `readMarkdown`, `writeMarkdown`, `getPath`, `countWords` |
| `src/lib/prompts.ts` | Prompt loading | `loadPrompt`, `interpolate` |
| `src/lib/llm.ts` | LLM abstraction | `complete`, `getLLMClient` |
| `src/lib/config.ts` | Configuration | `loadConfig`, `getProjectRoot` |
| `src/lib/env.ts` | Environment validation | `validateEnv`, `getEffectiveModel` |

### Prompts
| File | Purpose | Variables |
|------|---------|-----------|
| `src/prompts/draft.md` | Draft generation | `{{style_guide}}`, `{{notes}}` |
| `src/prompts/analyze.md` | Style analysis | `{{samples}}`, `{{platforms}}` |
| `src/prompts/proofread.md` | Grammar/spelling pass | `{{style_guide}}`, `{{content}}` |
| `src/prompts/clarity.md` | Flow/comprehension pass | `{{style_guide}}`, `{{content}}` |
| `src/prompts/punchier.md` | Impact/conciseness pass | `{{style_guide}}`, `{{content}}` |

## Code Patterns Summary

### Spinner Usage
```typescript
const spinner = ora('Message').start();
try {
  const result = await complete(prompt, { silent: true });
  spinner.succeed('Success message');
} catch (error) {
  spinner.fail('Failure message');
  throw error;
}
```

### Style Guide Loading
```typescript
function loadStyleGuide(): string {
  const stylePath = getPath(STYLE_GUIDE_PATH);
  if (!fs.existsSync(stylePath)) {
    console.log(chalk.yellow('⚠ No style guide found...'));
    return 'Fallback instruction';
  }
  return fs.readFileSync(stylePath, 'utf-8');
}
```

### Prompt Composition
```typescript
const promptTemplate = loadPrompt('prompt-name');
const prompt = interpolate(promptTemplate, {
  variable1: value1,
  variable2: value2,
});
const result = await complete(prompt, {
  system: 'System message',
  maxTokens: 4096,
  silent: true,
});
```

### File Output
```typescript
const outputPath = getPath('writing/drafts', `${basename}-${timestamp}.md`);
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(outputPath, content);
```

### Console Output
```typescript
console.log(chalk.bold('\n✓ Action Complete'));
console.log(chalk.dim(`  Source: ${sourcePath}`));
console.log(chalk.green(`  Output: ${outputPath}`));
console.log(chalk.bold('\n📝 Next Steps:'));
console.log(chalk.cyan(`  claude-pen next-command ${outputPath}`));
```

## Recommendations

### 1. Format Command
- Use `draft.ts` as template
- Focus prompt on structure/organization, not content changes
- Output filename: `[basename]-formatted.md`
- Should NOT use style guide (verbatim requirement)

### 2. Review Command
- Create separate review file, don't modify input
- Output format: Markdown with sections for different issues
- Structure: Overview → Specific Suggestions (with line refs) → Summary
- Use numbered or bulleted lists for actionability

### 3. Tone Selection in Refine
- Add tone as optional parameter to existing passes
- Integrate tone into system message or prompt template
- Consider creating tone-specific prompt templates vs. dynamic insertion
- Document tone options in help text and README

### 4. Pipeline Documentation
- Update README with pipeline workflow examples
- Add examples showing when to use each command
- Document file naming conventions
- Show how review suggestions inform refinement

## Next Steps

Based on conversation, the user wants to pivot from existing plan to implement:
1. Three-command pipeline: `format` → `review` → `refine`
2. Format as mandatory base step
3. Review outputs separate suggestions file
4. Refine applies improvements with optional tone

**Proposed Plan**:
1. Research complete ✅
2. Create detailed implementation plan for format + review commands
3. Implement format command
4. Implement review command
5. Enhance refine with tone selection
6. Integration testing
7. Update documentation

## Questions to Clarify

1. Review output format - structured suggestions with line numbers? Or general feedback?
2. Should review suggest specific rewrites, or just identify issues?
3. Tone options - start with 3-4 options or allow freeform?
4. Should commands chain automatically, or always explicit per-command invocation?
