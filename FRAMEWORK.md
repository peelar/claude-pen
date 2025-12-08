# Research → Plan → Implement Framework

This repository implements a structured workflow for AI-assisted development that emphasizes research, planning, and systematic implementation.

## Why This Framework?

90% of developers use AI tools incorrectly—they jump straight to implementation, skip research, and wonder why their AI assistant produces buggy, inconsistent code. This framework solves that by:

- **Building context** through deep research before coding
- **Creating clear plans** with phased implementation and success criteria
- **Implementing systematically** with verification at each step
- **Accumulating knowledge** that persists across sessions

## The Workflow

```
Research → Plan → Implement → Validate
```

Each phase has a dedicated slash command that guides Claude through the process.

## Quick Start

### 1. Research Phase
Before implementing anything, understand how the codebase works:

```
/1_research_codebase
How do existing CLI commands interact with the Anthropic API?
```

**What happens:**
- Spawns 3 parallel agents (Locator, Analyzer, Pattern Finder)
- Each investigates different aspects of your question
- Synthesizes findings into a comprehensive document
- Saves to `thoughts/shared/research/[topic].md`

**Output includes:**
- File locations with line numbers
- Code patterns and conventions
- Architecture insights
- Implementation recommendations

### 2. Planning Phase
Create a detailed, phased implementation plan:

```
/2_create_plan
Add a 'refine' command that improves text clarity using Claude
```

**What happens:**
- Reviews existing research (if available)
- Proposes a phased approach (typically 3-5 phases)
- Includes specific file changes and code examples
- Defines success criteria for each phase
- Saves to `thoughts/shared/plans/[feature].md`

**Plan structure:**
- Overview and approach rationale
- Phase-by-phase breakdown
- Automated verification (build, tests, types, lint)
- Manual verification checklist

### 3. Implementation Phase
Execute the plan systematically:

```
/4_implement_plan
thoughts/shared/plans/refine_command.md
```

**What happens:**
- Loads the plan and creates a todo list
- Implements phase by phase
- Runs verification after each phase
- Updates checkboxes in the plan
- Handles blockers intelligently

### 4. Validation Phase
Verify everything works as expected:

```
/3_validate_plan
```

**What happens:**
- Checks implementation status
- Runs automated verification (build, tests, types, lint)
- Performs code review
- Generates validation report
- Confirms readiness to commit

## Session Management

### Save Progress
When you need to pause work:

```
/5_save_progress
```

Creates a session file in `thoughts/shared/sessions/[date]_[topic].md` containing:
- What you were working on
- Progress through the plan
- Files modified
- Current blockers
- Exact commands to resume

### Resume Work
Continue from where you left off:

```
/6_resume_work
thoughts/shared/sessions/2025-12-08_refine_command.md
```

Restores complete context and continues implementation.

## Directory Structure

```
claude-pen/
├── .claude/
│   ├── agents/                   # Specialized research agents
│   │   ├── codebase-locator.md       # Finds relevant files
│   │   ├── codebase-analyzer.md      # Analyzes code structure
│   │   └── codebase-pattern-finder.md # Discovers patterns
│   └── commands/                 # Workflow slash commands
│       ├── 1_research_codebase.md
│       ├── 2_create_plan.md
│       ├── 3_validate_plan.md
│       ├── 4_implement_plan.md
│       ├── 5_save_progress.md
│       └── 6_resume_work.md
└── thoughts/                     # Persistent knowledge base
    └── shared/
        ├── research/             # Research findings
        ├── plans/                # Implementation plans
        ├── sessions/             # Work sessions
        └── cloud/                # Cloud analyses (optional)
```

## Complete Examples

### Example 1: Adding a New Feature

```bash
# Step 1: Research existing patterns
/1_research_codebase
How do the existing commands structure their options and handle errors?

# Review the generated research in thoughts/shared/research/

# Step 2: Create an implementation plan
/2_create_plan
Add a 'translate' command that translates text to different languages

# Review the plan, make any adjustments

# Step 3: Implement the plan
/4_implement_plan
thoughts/shared/plans/translate_command.md

# Step 4: Validate the implementation
/3_validate_plan

# Step 5: Commit
git add .
git commit -m "feat: add translate command"
```

### Example 2: Bug Fix with Research

```bash
# Step 1: Research the problematic area
/1_research_codebase
How does error handling work in the API client?

# Step 2: Create a fix plan
/2_create_plan
Fix the API timeout error handling to retry with exponential backoff

# Step 3: Implement
/4_implement_plan

# Step 4: Validate
/3_validate_plan
```

### Example 3: Multi-Day Feature

```bash
# === Day 1: Research and Planning ===
/1_research_codebase
How is configuration loaded and validated?

/2_create_plan
Add support for .claude-pen.yaml configuration files

/5_save_progress

# === Day 2: Core Implementation ===
/6_resume_work
thoughts/shared/sessions/2025-12-08_config.md

/4_implement_plan
# Implements Phase 1-2

/5_save_progress

# === Day 3: Finish and Ship ===
/6_resume_work

/4_implement_plan
# Completes remaining phases

/3_validate_plan

git commit -m "feat: add YAML configuration support"
```

## How Parallel Research Works

When you use `/1_research_codebase`, Claude spawns three specialized agents that work simultaneously:

### 1. Codebase Locator
- Finds all relevant files and modules
- Searches for related terms and imports
- Returns file paths with relevance explanations

### 2. Codebase Analyzer
- Reads and understands the code
- Traces data flow and control flow
- Documents architecture and dependencies

### 3. Codebase Pattern Finder
- Identifies coding patterns and conventions
- Discovers naming standards
- Finds error handling and testing patterns

**Result**: A comprehensive research document that synthesizes all three perspectives.

## Slash Command Reference

| Command | Purpose | Output |
|---------|---------|--------|
| `/1_research_codebase` | Deep codebase analysis | `thoughts/shared/research/` |
| `/2_create_plan` | Create implementation plan | `thoughts/shared/plans/` |
| `/3_validate_plan` | Verify implementation | Console report |
| `/4_implement_plan` | Execute plan phases | Code changes + updated plan |
| `/5_save_progress` | Save session state | `thoughts/shared/sessions/` |
| `/6_resume_work` | Restore and continue | Context restoration |

## Best Practices

### Always Research First
```bash
# ❌ Bad: Jump straight to implementation
/2_create_plan
Add OAuth support

# ✅ Good: Research existing patterns first
/1_research_codebase
How does authentication work in the codebase? What patterns should I follow?

/2_create_plan
Add OAuth support following the existing auth patterns
```

### Break Large Features into Phases
Plans should have 3-5 phases, each with clear success criteria:

```markdown
## Phase 1: Core OAuth Client
- Implement OAuth flow
- ✓ Tests pass
- ✓ Types check

## Phase 2: Provider Integration
- Add Google and GitHub providers
- ✓ Integration tests pass

## Phase 3: CLI Integration
- Add commands and options
- ✓ E2E tests pass
```

### Save Progress Frequently
If work might span multiple sessions, save progress:

```bash
# After completing a few phases
/5_save_progress

# Later, continue seamlessly
/6_resume_work
```

### Validate Before Committing
Never skip validation:

```bash
/3_validate_plan

# Wait for validation report before:
git commit -m "feat: ..."
```

## Customizing Commands

All slash commands are Markdown files in `.claude/commands/`. You can:

1. **Modify existing commands**: Edit the instruction prompts
2. **Add new commands**: Create new `.md` files
3. **Add frontmatter options**:

```yaml
---
description: Command description for /help
argument-hint: [arg1] [arg2]
allowed-tools: Read, Write, Bash(npm:*)
model: claude-3-5-haiku-20241022
---
```

## Customizing Agents

Agents live in `.claude/agents/`. Customize them for your needs:

```markdown
---
description: Agent specialization
---

You are a specialized agent for [purpose].

When given [input]:
1. [Step 1]
2. [Step 2]

Report:
- [Key finding 1]
- [Key finding 2]
```

## Thinking Keywords

For complex problems, trigger extended thinking:

```
think hard about the best approach for implementing OAuth
```

Keywords by intensity:
- `think` → basic extended thinking
- `think hard` → more computation
- `think harder` → even more
- `ultrathink` → maximum thinking budget

## Integration with CI/CD

While this framework is designed for interactive development, you can adapt parts for automation:

```bash
# Run validation in CI
claude -p "Load the latest plan and run validation" \
  --allowedTools "Read,Bash" \
  --output-format json
```

## Troubleshooting

### "No plan found"
```bash
# List available plans
ls thoughts/shared/plans/

# Specify the plan explicitly
/4_implement_plan
thoughts/shared/plans/specific_plan.md
```

### "Research incomplete"
If research misses important files:
```bash
/1_research_codebase
Also check [specific directory or file] for [specific thing]
```

### "Phase verification failed"
```bash
# Check the error in the plan file
# Fix the issue
# Resume implementation

/4_implement_plan
# Continue from where it left off
```

## Resources

- **Claude Code Documentation**: https://docs.anthropic.com
- **Anthropic SDK**: https://github.com/anthropics/anthropic-sdk-typescript
- **Project Context**: See `CLAUDE.md` for project-specific patterns

## Philosophy

### Context Is King
AI without context is just fancy autocomplete. This framework ensures Claude understands:
- Your codebase patterns
- Architectural decisions
- Team conventions
- Production constraints

### Plans Prevent Pain
Writing code is easy. Writing the *right* code is hard. Plans ensure:
- Clear scope and requirements
- Phased, testable implementation
- Measurable success criteria
- No scope creep or surprises

### Persistent Knowledge
Every research finding and plan becomes organizational memory:
- Research documents accumulate insights
- Plans serve as technical specifications
- Session summaries enable seamless handoffs

---

*This framework transforms Claude from a code generator into a systematic engineering partner.*
