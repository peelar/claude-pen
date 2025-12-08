---
description: Generate detailed, phased implementation plans
---

# Create Plan Command

## Purpose
Generate detailed, phased implementation plans with clear success criteria.

## Instructions

When the user describes a feature or change:

1. **Research phase** (if needed):
   - Check existing research in `thoughts/shared/research/`
   - Conduct additional research if gaps exist

2. **Generate a structured plan** with:
   - Overview explaining the approach
   - Why this approach was chosen
   - 3-5 implementation phases
   - Each phase includes:
     - Specific file changes with locations
     - Code examples where helpful
     - Automated verification commands
     - Manual verification checklist
   - **Always include a Documentation phase** to update README.md

3. **Success criteria for each phase**:
   - Automated checks (tests, build, lint, types)
   - Manual verification steps
   - Rollback considerations

4. **Save the plan** to `thoughts/shared/plans/[descriptive_name].md`

## Plan Template

```markdown
# Implementation Plan: [Feature Name]

## Overview
[What we're building and why]

## Implementation Approach
[Strategy and rationale]

## Phase 1: [Phase Name]

### Changes Required

#### 1. [Component/File Name]
**File**: `path/to/file.ts`
**Changes**: [Description]

```typescript
// Example code
```

### Success Criteria

#### Automated Verification
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Types check: `npm run typecheck`

#### Manual Verification
- [ ] [Specific behavior to verify]
- [ ] [Edge case to check]

---

## Phase 2: [Phase Name]
[Continue pattern...]

---

## Phase N: Documentation

### Changes Required

#### 1. Update README.md
**File**: `README.md`
**Changes**: Document new feature/command

- Update "Available Commands" section with new command
- Add usage examples and options
- Update "Coming Soon" section if applicable
- Add any new configuration or setup steps
- Update project structure diagram if files added

### Success Criteria

#### Automated Verification
- [ ] README renders correctly in markdown preview

#### Manual Verification
- [ ] Command is documented with examples
- [ ] All options and flags are explained
- [ ] Usage is clear for new users
- [ ] Links and references are valid

---

## Rollback Plan
[How to revert if needed]
```

## Example Usage
> /2_create_plan
> Based on the research, add OAuth 2.0 support with Google and GitHub providers
