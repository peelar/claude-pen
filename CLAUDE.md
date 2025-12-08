# Claude Code Project Context

## Project Overview

**claude-pen** is an AI-powered writing assistant that learns your voice and writing style. Built with TypeScript and Bun, it provides a CLI interface for interacting with Claude to enhance and personalize written content.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **AI Integration**: Anthropic SDK (@anthropic-ai/sdk)
- **CLI Framework**: Commander
- **Additional Tools**:
  - chalk (terminal styling)
  - ora (spinners/loading indicators)
  - glob (file pattern matching)
  - yaml (configuration parsing)

## Project Structure

```
claude-pen/
├── src/
│   ├── index.ts          # Main CLI entry point
│   ├── types.ts          # TypeScript type definitions
│   ├── lib/              # Utility libraries
│   ├── prompts/          # Prompt templates and formatting
│   │   └── format/       # Formatting-specific prompts
│   └── commands/         # CLI command implementations
├── thoughts/             # Knowledge base (Research-Plan-Implement framework)
│   └── shared/
│       ├── research/     # Research findings and codebase analyses
│       ├── plans/        # Implementation plans
│       ├── sessions/     # Saved work sessions
│       └── cloud/        # Cloud infrastructure analyses
└── .claude/              # Claude Code configuration
    ├── agents/           # Specialized research agents
    └── commands/         # Workflow slash commands
```

## Development Commands

- **Run**: `bun run dev` or `bun run src/index.ts`
- **Type Check**: `bun run typecheck`
- **Lint**: `bun run lint`

## Code Conventions

### File Organization
- CLI commands: `src/commands/[command-name].ts`
- Utilities: `src/lib/[utility-name].ts`
- Prompts: `src/prompts/[category]/[prompt-name].ts`
- Types: `src/types.ts` (central type definitions)

### TypeScript Standards
- Use strict mode
- Prefer functional patterns
- Export types alongside implementations
- Use clear, descriptive naming

### Import Patterns
```typescript
// External dependencies first
import { Command } from 'commander';
import Anthropic from '@anthropic-ai/sdk';

// Internal modules second
import type { Config } from './types';
import { loadConfig } from './lib/config';
```

## Research → Plan → Implement Workflow

This project uses a structured workflow for all feature development and changes:

### Phase 1: Research (`/1_research_codebase`)
Deep dive into the codebase using parallel agents before making any changes. Spawns specialized agents to:
- Locate relevant files and modules
- Analyze code structure and data flow
- Discover patterns and conventions

**Output**: Comprehensive research document in `thoughts/shared/research/`

### Phase 2: Planning (`/2_create_plan`)
Create detailed, phased implementation plans with:
- Clear overview and approach rationale
- 3-5 implementation phases
- Specific file changes and code examples
- Automated verification steps
- Manual testing checklists

**Output**: Implementation plan in `thoughts/shared/plans/`

### Phase 3: Implementation (`/4_implement_plan`)
Execute the plan systematically:
- Work phase by phase
- Run verification after each phase
- Update plan checkboxes
- Handle blockers intelligently

### Phase 4: Validation (`/3_validate_plan`)
Verify implementation matches the plan:
- Run automated checks (build, tests, types, lint)
- Perform code review
- Complete manual testing checklist

### Session Management
- **Save progress**: `/5_save_progress` - Capture current state for later resumption
- **Resume work**: `/6_resume_work` - Restore context and continue from where you left off

## Key Principles

### 1. Context Is King
Always research existing patterns before implementing new features. Understand:
- How similar features work
- Project conventions and patterns
- Dependencies and integrations
- Edge cases and error handling

### 2. Plans Prevent Pain
Never jump straight to implementation. Plans ensure:
- Clear scope and requirements
- Phased, testable approach
- Measurable success criteria
- No scope creep

### 3. Persistent Knowledge
Every research finding and plan builds organizational memory:
- Research documents accumulate insights
- Plans serve as technical specifications
- Session files enable seamless handoffs

## Specialized Agents

The project includes three specialized research agents in `.claude/agents/`:

1. **codebase-locator**: Finds relevant files and locations
2. **codebase-analyzer**: Analyzes code structure and dependencies
3. **codebase-pattern-finder**: Discovers patterns and conventions

These agents work in parallel during research to provide comprehensive understanding.

## Workflow Examples

### Adding a New Feature
```bash
# 1. Research how similar features work
/1_research_codebase
> How do existing commands interact with the Anthropic API?

# 2. Create an implementation plan
/2_create_plan
> Add a new 'refine' command that improves text clarity

# 3. Implement phase by phase
/4_implement_plan
> thoughts/shared/plans/refine_command.md

# 4. Validate before committing
/3_validate_plan
```

### Multi-Day Development
```bash
# Day 1: Research and plan
/1_research_codebase
/2_create_plan
/5_save_progress

# Day 2: Continue implementation
/6_resume_work
/4_implement_plan
```

## Security Considerations

- Never commit API keys or sensitive data
- Validate all user inputs
- Sanitize file paths to prevent traversal attacks
- Review AI-generated content before executing

## Testing Philosophy

- Test commands in isolation
- Verify API integrations with real requests
- Test error handling and edge cases
- Ensure graceful degradation

## When Implementing Changes

1. **Always research first** - Use `/1_research_codebase` to understand existing patterns
2. **Create a plan** - Use `/2_create_plan` for any non-trivial changes
3. **Implement incrementally** - Work phase by phase, verifying after each
4. **Validate thoroughly** - Use `/3_validate_plan` before considering the work complete
5. **Document context** - Use `/5_save_progress` if pausing work

## Common Patterns to Follow

### CLI Command Structure
```typescript
program
  .command('command-name')
  .description('What the command does')
  .option('-f, --flag', 'Flag description')
  .action(async (options) => {
    // Implementation
  });
```

### Error Handling
```typescript
try {
  // Operation
} catch (error) {
  console.error('User-friendly error message');
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
}
```

### API Interaction
```typescript
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
});
```

## Resources

- **Anthropic SDK**: https://github.com/anthropics/anthropic-sdk-typescript
- **Bun Documentation**: https://bun.sh/docs
- **Commander.js**: https://github.com/tj/commander.js
- **Research-Plan-Implement Framework**: See workflow commands in `.claude/commands/`
