---
description: Save current work session state for later resumption
---

# Save Progress Command

## Purpose
Save current work session state for later resumption.

## Instructions

1. **Capture current state**:
   - What was being worked on
   - Progress through any active plan
   - Files modified
   - Current blockers or pending items

2. **Document context**:
   - Recent decisions made
   - Approaches tried
   - Open questions

3. **Create resumption guide**:
   - Exact commands to resume
   - What to check first
   - Priority items

4. **Save to** `thoughts/shared/sessions/[YYYY-MM-DD]_[topic].md`

## Session Template

```markdown
# Session: [Topic]
Date: [YYYY-MM-DD HH:MM]

## What We Were Working On
[Description of the task]

## Progress
- [x] Completed item
- [ ] In progress item (X% complete)
- [ ] Not started

## Current State
[Where we left off exactly]

## Context & Decisions
[Important context that might be lost]

## Blockers
[Any unresolved issues]

## To Resume

### Commands
```bash
/6_resume_work
> thoughts/shared/sessions/[this-file].md
```

### First Steps
1. [What to check/do first]
2. [Next priority]
```
