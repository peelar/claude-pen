# Shared Knowledge Base

This directory contains research findings, implementation plans, and saved work sessions using the Research-Plan-Implement framework.

## Directory Structure

```
thoughts/shared/
├── research/     # Research findings and codebase analyses
├── plans/        # Implementation plans
├── sessions/     # Saved work sessions
└── cloud/        # Cloud infrastructure analyses
```

## Naming Convention

**IMPORTANT**: All research and plan files MUST follow this naming convention:

### Format
```
NN-descriptive_name.md
```

Where:
- `NN` = Two-digit index number (01, 02, 03, etc.)
- `descriptive_name` = Lowercase with underscores
- `.md` = Markdown file extension

### Examples
- ✅ `01-init_command_research.md`
- ✅ `02-ingest_command_implementation.md`
- ✅ `05-spinner_flickering_analysis.md`
- ❌ `spinner_flickering_analysis.md` (missing index)
- ❌ `5-spinner-flickering.md` (single digit, uses hyphens)

### Index Assignment Logic

**Research Files** (`research/`):
- Ordered chronologically by when research was conducted
- Earlier foundational research gets lower numbers
- Current index: 01-05

**Plan Files** (`plans/`):
- Ordered by implementation sequence
- Foundation and utilities first
- Feature implementations follow
- Bug fixes and optimizations last
- Current index: 01-06

**Session Files** (`sessions/`):
- Use timestamp format: `YYYY-MM-DD_HHMM_description.md`
- Example: `2024-12-08_1400_feature_implementation.md`

## Why This Convention?

1. **Chronological tracking**: Easy to see the order of work
2. **File sorting**: Files automatically sort correctly in file explorers
3. **Reference stability**: Numbers provide stable references in documentation
4. **Discoverability**: New team members can follow the development flow
5. **Context preservation**: Order reveals the evolution of understanding

## Creating New Files

When creating a new research or plan file:

1. Check the highest existing index number in the directory
2. Increment by one for your new file
3. Use lowercase with underscores for the descriptive name
4. Follow the format: `NN-descriptive_name.md`

### Quick Reference

```bash
# Check current highest index in research/
ls thoughts/shared/research/ | tail -1

# Check current highest index in plans/
ls thoughts/shared/plans/ | tail -1

# Create new research file (if last is 05)
touch thoughts/shared/research/06-new_topic_research.md

# Create new plan file (if last is 06)
touch thoughts/shared/plans/07-new_feature_plan.md
```

## File Categories

### Research Files
Purpose: Deep dives into existing code, patterns, and systems
- Parallel agent investigations
- Code structure analysis
- Pattern discovery
- Bug investigation

### Plan Files
Purpose: Detailed implementation strategies
- Phased approaches
- File-by-file changes
- Verification steps
- Success criteria

### Session Files
Purpose: Work-in-progress snapshots
- Current task context
- Blockers and decisions
- Next steps
- Resume points

## Maintenance

### Renaming Existing Files

If you need to reorganize files:

```bash
# Example: Renaming research files
cd thoughts/shared/research/
mv old_name.md 01-old_name.md
mv another_file.md 02-another_file.md

# Example: Renaming plan files
cd thoughts/shared/plans/
mv old_plan.md 01-old_plan.md
```

### Updating References

After renaming, update references in:
- `CLAUDE.md` (if referenced)
- Other research/plan files (cross-references)
- Session files
- Documentation

## Current State

### Research Files (01-05)
1. `01-init_command_research.md` - Init command analysis
2. `02-ingest_command_implementation.md` - Ingest command deep dive
3. `03-analyze_command_research.md` - Analyze command patterns
4. `04-draft_command_implementation.md` - Draft command research
5. `05-spinner_flickering_analysis.md` - Spinner bug investigation

### Plan Files (01-06)
1. `01-foundation.md` - Project foundation
2. `02-core-utilities.md` - Utility libraries
3. `03-init-command.md` - Init command implementation
4. `04-ingest_command.md` - Ingest command implementation
5. `05-analyze_command_plan.md` - Analyze command implementation
6. `06-fix_spinner_flickering.md` - Spinner bug fixes

## Related Documentation

- Main project context: `/CLAUDE.md`
- Workflow commands: `/.claude/commands/`
- Research agents: `/.claude/agents/`
