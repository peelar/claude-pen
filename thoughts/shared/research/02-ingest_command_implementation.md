# Research: Ingest Command Implementation

## Overview

This research document provides a comprehensive analysis of the claude-pen codebase to support implementation of the `ingest` command. The ingest command will batch import existing writing from `writing/import/` (or specified directory), use LLM to extract metadata, and organize files into `writing/drafts/` for review before publishing to `writing/content/[platform]/`.

## Key Files & Locations

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/types.ts` | Type definitions: Platform, ArticleFrontmatter, ClaudePenConfig | 1-23 |
| `src/index.ts` | CLI entry point and command registration | 1-18 |
| `src/commands/init.ts` | Example command implementation with user prompts and directory setup | 44-112 |
| `src/lib/files.ts` | Markdown I/O, file discovery, word counting, slugification | 17-108 |
| `src/lib/prompts.ts` | Prompt loading with user-first priority, variable interpolation | 32-68 |
| `src/lib/llm.ts` | Anthropic API integration with spinner UI | 17-84 |
| `src/lib/config.ts` | Configuration loading, project root discovery | 21-77 |

## Architecture & Data Flow

### 1. Command Registration Flow

```
src/index.ts (CLI entry)
    ├── Import command function from src/commands/[name].ts
    ├── Register with Commander: .command().description().option().action()
    └── Parse arguments and execute command
```

**Example from init command** (src/index.ts:11-14):
```typescript
program
  .command('init')
  .description('Initialize a new Claude Pen workspace')
  .action(init);
```

### 2. Markdown File Processing Flow

```
Input: Directory path (default: writing/import/) + Platform
    ↓
[1] listMarkdownFiles(dir) → Find all .md files recursively
    ↓
[2] readMarkdown(filePath) → Parse YAML frontmatter + content
    ↓
[3] Check if already ingested (has title in frontmatter)
    ↓
[4] Load prompt template → Interpolate {{content}}
    ↓
[5] complete(prompt) → Call LLM with spinner UI
    ↓
[6] Parse LLM response as YAML metadata
    ↓
[7] Generate filename: YYYY-MM-DD_slug.md
    ↓
[8] writeMarkdown(outputPath, frontmatter, content)
    ↓
[9] Remove source file from input directory
    ↓
Output: Files in writing/drafts/ (flat structure)
```

### 3. LLM Integration Flow

```
complete(prompt, options)
    ↓
[1] ora('Thinking...').start() → Show spinner
    ↓
[2] getLLMClient() → Load config, get API key from env
    ↓
[3] client.messages.create() → Call Anthropic API
    ↓
[4] Extract text block from response
    ↓
[5] spinner.succeed('Done') OR spinner.fail('Failed')
    ↓
Return: string response
```

### 4. Prompt System Flow

```
loadPrompt('ingest')
    ↓
[1] Check user's .claude-pen/prompts/ingest.md
    ↓
[2] Fall back to bundled src/prompts/ingest.md
    ↓
[3] Read file contents
    ↓
interpolate(template, { content: articleText })
    ↓
Replace {{content}} with actual article text
    ↓
Return: filled prompt string
```

## Patterns to Follow

### 1. CLI Command Structure

**Template**:
```typescript
// src/commands/ingest.ts
import type { Platform } from '../types.js';

interface IngestOptions {
  platform: Platform;
}

export async function ingest(
  dir: string | undefined,
  options: IngestOptions
): Promise<void> {
  // 1. Default to writing/import/ if no directory specified
  // 2. Validate inputs
  // 3. Load resources (config, prompts)
  // 4. Process files with spinners
  // 5. Move files from source to writing/drafts/
  // 6. Show summary with chalk colors
}
```

**Registration**:
```typescript
// src/index.ts
program
  .command('ingest [directory]')
  .description('Batch import existing writing into drafts (defaults to writing/import/)')
  .requiredOption('--platform <platform>', 'Target platform: blog, linkedin, substack, twitter')
  .action(ingest);
```

### 2. Error Handling Pattern

**Early validation** (src/commands/init.ts:46-49):
```typescript
if (hasConfig()) {
  console.log(chalk.yellow('⚠ Already in a Claude Pen workspace.'));
  console.log('  Run commands from here or delete .claude-pen/ to reinitialize.');
  return;
}
```

**Input validation with helpful messages**:
```typescript
const validPlatforms: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];
if (!validPlatforms.includes(platform)) {
  console.error(chalk.red(`Invalid platform: ${platform}`));
  console.error(`Valid options: ${validPlatforms.join(', ')}`);
  process.exit(1);
}

if (!fs.existsSync(dir)) {
  console.error(chalk.red(`Directory not found: ${dir}`));
  process.exit(1);
}
```

**Graceful degradation** (src/lib/files.ts:36-41):
```typescript
try {
  const frontmatter = yaml.parse(frontmatterStr) ?? {};
  return { frontmatter, content };
} catch {
  return { frontmatter: {}, content: raw };
}
```

### 3. User Feedback with Chalk and Ora

**Status Messages**:
```typescript
console.log(chalk.bold(`\n📥 Ingesting ${files.length} files into writing/drafts/\n`));

const spinner = ora(`Processing ${filename}`).start();
spinner.succeed(`${filename} → ${outputFilename}`);
spinner.info(`${filename} - skipped (already has metadata)`);
spinner.fail(`${filename} - failed`);

console.log(chalk.bold('\n📊 Summary'));
console.log(`  Ingested: ${chalk.green(ingested)}`);
console.log(`  Skipped:  ${chalk.yellow(skipped)}`);
console.log(`  Failed:   ${chalk.red(failed)}`);
```

**Color Semantics**:
- `chalk.bold()` - Headers
- `chalk.green()` - Success counts
- `chalk.yellow()` - Warnings/skipped items
- `chalk.red()` - Errors
- `chalk.cyan()` - Next action suggestions
- `chalk.dim()` - Secondary info

### 4. File Utilities Usage

**List markdown files** (src/lib/files.ts:69-72):
```typescript
const files = await listMarkdownFiles(dir);
// Returns: ['/path/to/file1.md', '/path/to/file2.md']
```

**Read markdown with frontmatter** (src/lib/files.ts:17-42):
```typescript
const { frontmatter, content } = readMarkdown(filePath);
// frontmatter: Record<string, unknown>
// content: string (without frontmatter)
```

**Write markdown with frontmatter** (src/lib/files.ts:47-64):
```typescript
const frontmatter: ArticleFrontmatter = {
  title: 'Article Title',
  date: '2025-12-08',
  platform: 'blog',
  word_count: 500,
  tags: ['productivity', 'ai'],
  summary: 'Brief description',
};

writeMarkdown(outputPath, frontmatter, content);
// Creates: ---
//          title: Article Title
//          date: 2025-12-08
//          ...
//          ---
//
//          [content here]
```

**Generate safe filenames** (src/lib/files.ts:102-108):
```typescript
const slug = slugify('How to Build Fast'); // → 'how-to-build-fast'
const filename = `2025-12-08_${slug}.md`; // → '2025-12-08_how-to-build-fast.md'
```

**Get project-relative paths** (src/lib/files.ts:88-90):
```typescript
const outputPath = getPath('writing', 'drafts', filename);
// Returns: /project-root/writing/drafts/2025-12-08_article.md
```

### 5. Prompt Loading Pattern

**Load prompt template** (src/lib/prompts.ts:32-51):
```typescript
const promptTemplate = loadPrompt('ingest');
// Looks for:
//   1. .claude-pen/prompts/ingest.md (user custom)
//   2. src/prompts/ingest.md (bundled)
```

**Interpolate variables** (src/lib/prompts.ts:58-68):
```typescript
const prompt = interpolate(promptTemplate, {
  content: articleText,
});
// Replaces {{content}} with articleText
```

### 6. LLM API Call Pattern

**Simple completion** (src/lib/llm.ts:69-84):
```typescript
const response = await complete(prompt, {
  system: 'You are a metadata extraction assistant.',
  maxTokens: 500,
});
// Returns string, handles spinner automatically
```

**Direct client access** (src/lib/llm.ts:17-33):
```typescript
const client = getLLMClient();
const result = await client.complete(prompt, options);
```

### 7. Type Safety Pattern

**Import types explicitly**:
```typescript
import type { Platform, ArticleFrontmatter } from '../types.js';

interface ExtractedMetadata {
  title: string;
  date: string | null;
  tags: string[];
  summary: string;
}
```

**Type narrowing and validation**:
```typescript
const validPlatforms: Platform[] = ['blog', 'linkedin', 'substack', 'twitter'];
if (!validPlatforms.includes(platform)) {
  // TypeScript knows platform is invalid here
}
```

## Code Examples

### Example 1: Batch File Processing Loop

```typescript
// From planned ingest command
const files = await listMarkdownFiles(dir);
let ingested = 0;
let skipped = 0;
let failed = 0;

for (const filePath of files) {
  const filename = path.basename(filePath);
  const spinner = ora(`Processing ${filename}`).start();

  try {
    const result = await ingestFile(filePath, platform, promptTemplate);

    if (result.skipped) {
      spinner.info(`${filename} - skipped (already has metadata)`);
      skipped++;
    } else {
      spinner.succeed(`${filename} → ${path.basename(result.outputPath!)}`);
      ingested++;
    }
  } catch (error) {
    spinner.fail(`${filename} - failed`);
    console.error(chalk.dim(`  ${error}`));
    failed++;
  }
}
```

### Example 2: YAML Response Parsing

```typescript
function parseMetadata(response: string): ExtractedMetadata {
  // Clean up response - remove markdown code fences
  const cleaned = response
    .replace(/```ya?ml\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = yaml.parse(cleaned);
    return {
      title: parsed.title || 'Untitled',
      date: parsed.date || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      summary: parsed.summary || '',
    };
  } catch (error) {
    console.error(chalk.yellow('  Warning: Could not parse metadata'));
    return {
      title: 'Untitled',
      date: null,
      tags: [],
      summary: '',
    };
  }
}
```

### Example 3: Skip Already-Ingested Files

```typescript
async function ingestFile(
  filePath: string,
  platform: Platform,
  promptTemplate: string
): Promise<{ success: boolean; outputPath?: string; skipped?: boolean }> {
  const { frontmatter, content } = readMarkdown(filePath);

  // Skip if already has title (already ingested)
  if (frontmatter.title) {
    return { success: true, skipped: true };
  }

  // Extract metadata via LLM...
  // Build frontmatter...
  // Write to writing/drafts/...

  return { success: true, outputPath };
}
```

## Implementation Dependencies

### Required Utilities (Already Exist)

✅ `listMarkdownFiles(dir)` - Find all .md files recursively
✅ `readMarkdown(filePath)` - Parse YAML frontmatter + content
✅ `writeMarkdown(path, frontmatter, content)` - Write markdown with frontmatter
✅ `getPath(...segments)` - Build project-relative paths
✅ `countWords(text)` - Count words in text
✅ `slugify(text)` - Convert text to URL-safe slug
✅ `loadPrompt(name)` - Load prompt template with user-first priority
✅ `interpolate(template, context)` - Replace {{variables}} in template
✅ `complete(prompt, options)` - Call LLM with spinner UI

### New Files to Create

❌ `src/prompts/ingest.md` - Prompt template for metadata extraction
❌ `src/commands/ingest.ts` - Ingest command implementation

### Files to Update

🔧 `src/index.ts` - Register ingest command

## Potential Concerns & Complexity

### 1. LLM Response Parsing

**Challenge**: LLM may return markdown code fences around YAML, or invalid YAML.

**Solution**: Strip code fences with regex, graceful degradation on parse failure.

```typescript
const cleaned = response
  .replace(/```ya?ml\n?/gi, '')
  .replace(/```\n?/g, '')
  .trim();

try {
  const parsed = yaml.parse(cleaned);
  // Use parsed data
} catch (error) {
  // Return defaults
}
```

### 2. Filename Collision Prevention

**Challenge**: Multiple articles with similar titles could generate the same filename.

**Solution**: Include date prefix in filename format: `YYYY-MM-DD_slug.md`

```typescript
function generateFilename(metadata: ExtractedMetadata): string {
  const date = metadata.date || new Date().toISOString().split('T')[0];
  const slug = slugify(metadata.title);
  return `${date}_${slug}.md`;
}
```

### 3. Skip Already-Ingested Files

**Challenge**: Avoid re-processing files that already have metadata.

**Solution**: Check for presence of `title` in frontmatter as indicator.

```typescript
if (frontmatter.title) {
  return { success: true, skipped: true };
}
```

### 4. Directory Existence

**Challenge**: Target `writing/drafts/` directory may not exist yet.

**Solution**: Use `ensureDir()` utility (already used by `writeMarkdown()`).

```typescript
export function writeMarkdown(filePath: string, ...): void {
  const dir = path.dirname(filePath);
  ensureDir(dir); // Creates writing/drafts/ if needed
  // Write file...
}
```

### 5. API Rate Limiting

**Challenge**: Processing many files sequentially may hit rate limits.

**Consideration**: Sequential processing with spinners provides good UX. For MVP, acceptable. Future enhancement: batch processing with rate limit handling.

## Recommendations for Implementation

### 1. Prompt Engineering

Create `src/prompts/ingest.md` with clear structure:

```markdown
You are analyzing a piece of writing to extract metadata.

Given the following article, extract:
- title: The title (infer from content if not explicitly stated)
- date: Publication date if mentioned, otherwise null
- tags: 3-5 relevant topic tags as an array
- summary: 1-2 sentence summary

Respond with ONLY valid YAML, no markdown code fences, no explanation:

title: "The extracted or inferred title"
date: YYYY-MM-DD
tags: [tag1, tag2, tag3]
summary: "Brief summary of the content"

If no date is found, use:
date: null

Article to analyze:

{{content}}
```

**Key principles**:
- Explicit format instructions
- Clear delimiter between instructions and content
- Request YAML without code fences (but handle them anyway)
- Provide example format

### 2. Command Implementation Structure

```typescript
// src/commands/ingest.ts

// 1. Define interfaces
interface IngestOptions { platform: Platform; }
interface ExtractedMetadata { title, date, tags, summary }

// 2. Helper functions
function parseMetadata(response: string): ExtractedMetadata
function generateFilename(metadata: ExtractedMetadata): string
async function ingestFile(...): Promise<result>

// 3. Main command function
export async function ingest(dir: string, options: IngestOptions): Promise<void>
```

### 3. User Experience Flow

```
1. Default to writing/import/ if no directory specified
2. Validate inputs → Show helpful error if invalid
3. Discover files → Show count
4. Load prompt template
5. Process each file:
   - Show spinner with filename
   - Call LLM to extract metadata
   - Generate output filename
   - Write to writing/drafts/
   - Remove from source directory
   - Update spinner: succeed/info/fail
6. Show summary with counts
7. Suggest next step (review drafts, then publish to writing/content/)
```

### 4. Testing Strategy

**Manual Verification Steps**:

1. **Setup test files**:
   ```bash
   mkdir test-posts
   echo "Article content..." > test-posts/post1.md
   ```

2. **Test basic ingest**:
   ```bash
   bun run src/index.ts ingest ./test-posts --platform blog
   ```
   - Verify files created in `writing/drafts/`
   - Check frontmatter structure
   - Verify filename format
   - Verify source files removed from ./test-posts

3. **Test default directory**:
   ```bash
   # Copy files to writing/import/
   bun run src/index.ts ingest --platform blog
   ```
   - Verify files processed from `writing/import/`
   - Verify files written to `writing/drafts/`

4. **Test skip logic**:
   ```bash
   bun run src/index.ts ingest ./writing/drafts --platform blog
   ```
   - Verify files marked as "skipped"

5. **Test error handling**:
   ```bash
   bun run src/index.ts ingest ./test-posts --platform invalid
   ```
   - Verify helpful error message

### 5. Implementation Order

1. ✅ Create prompt template: `src/prompts/ingest.md`
2. ✅ Implement helper functions: `parseMetadata()`, `generateFilename()`
3. ✅ Implement single-file processor: `ingestFile()`
4. ✅ Implement main command: `ingest()` with validation and loop
5. ✅ Wire up command registration in `src/index.ts`
6. ✅ Test with manual verification steps

## Related Files Reference

All file paths are relative to `/Users/adrianpilarczyk/Code/claude-pen/`

- `src/types.ts:1-23` - Type definitions
- `src/index.ts:1-18` - CLI entry point
- `src/commands/init.ts:44-112` - Example command implementation
- `src/lib/files.ts:17-108` - File utilities
- `src/lib/prompts.ts:32-68` - Prompt system
- `src/lib/llm.ts:17-84` - LLM integration
- `src/lib/config.ts:21-77` - Configuration system

## Summary

The claude-pen codebase provides a solid foundation for implementing the ingest command:

- **File utilities** handle markdown I/O with YAML frontmatter parsing
- **Prompt system** supports user customization and variable interpolation
- **LLM integration** provides simple API with automatic spinner UI
- **Type system** ensures safety with Platform and ArticleFrontmatter interfaces
- **Error handling** patterns emphasize validation and helpful messages
- **User feedback** leverages chalk colors and ora spinners consistently

Implementation requires:
1. Creating the ingest prompt template
2. Implementing metadata parsing and file processing logic
3. Registering the command with Commander
4. Following established patterns for validation, error handling, and user feedback

No significant architectural changes or new dependencies needed. All required utilities already exist in the codebase.
