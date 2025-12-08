# Environment Variable Validation

## Overview

The project includes comprehensive environment variable validation to ensure proper configuration before runtime. This follows Bun best practices: fail fast with clear, actionable error messages.

## Features

### 1. Required Variable Validation
- **API Key**: Validates `ANTHROPIC_API_KEY` (or custom key name from config)
- Fails immediately with helpful error messages if missing

### 2. Model Override Support
You can override the model specified in `.claude-pen/config.yaml` using environment variables with **simple, user-friendly names**:

```bash
# Simple names (recommended)
export ANTHROPIC_MODEL=claude-sonnet-4.5
export ANTHROPIC_MODEL=opus-4.5
export ANTHROPIC_MODEL=sonnet  # defaults to latest

# Or use full identifiers
export ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

**Priority order**: `ANTHROPIC_MODEL` > `CLAUDE_PEN_MODEL` > config.yaml

### 3. Model Validation
The system supports both simple aliases and full model identifiers:

**Simple aliases (recommended):**
- `claude-sonnet-4.5` or `sonnet-4.5` → Claude Sonnet 4.5 (default)
- `claude-opus-4.5` or `opus-4.5` → Claude Opus 4.5
- `claude-sonnet-3.5` or `sonnet-3.5` → Claude 3.5 Sonnet
- `claude-haiku-3.5` or `haiku-3.5` → Claude 3.5 Haiku
- `sonnet`, `opus`, `haiku` → Latest versions

**Full identifiers (also supported):**
- `claude-sonnet-4-20250514`
- `claude-opus-4-20250514`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### 4. Helpful Error Messages
When validation fails, you get:
- Clear description of what's wrong
- Actionable hints on how to fix it
- Suggestions for valid alternatives

## Usage Examples

### Basic Setup
```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### With Model Override
```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
ANTHROPIC_MODEL=claude-opus-4.5
```

### Error Handling
```typescript
import { getLLMClient } from './lib/llm.js';

try {
  const client = getLLMClient();
  // Use client...
} catch (error) {
  // Error includes formatted validation message
  console.error(error.message);
  process.exit(1);
}
```

## Implementation Details

### File Structure
- `src/lib/env.ts`: Core validation logic
- `src/lib/llm.ts`: Integration with LLM client creation
- `.env.example`: Documentation of available variables

### Validation Flow
1. Load config from `.claude-pen/config.yaml`
2. Validate required env vars (API key)
3. Check for optional model override
4. Validate model identifier if provided
5. Return validated configuration

### Type Safety
All validation is fully typed with TypeScript:
- `ValidClaudeModel`: Union type of valid model identifiers
- `ValidatedEnv`: Result of successful validation
- `EnvValidationError`: Custom error with helpful context

## Best Practices

1. **Use .env files for local development**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Use environment variables in production**
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   export ANTHROPIC_MODEL=claude-opus-4-20250514
   ```

3. **Never commit .env files**
   - Already in `.gitignore`
   - Use `.env.example` for documentation

4. **Validate early**
   - Validation happens on first LLM client creation
   - Fails fast before any API calls

## Extending

To add new models, update `VALID_CLAUDE_MODELS` in `src/lib/env.ts`:

```typescript
const VALID_CLAUDE_MODELS = [
  // ... existing models
  'claude-new-model-20250601',
] as const;
```
