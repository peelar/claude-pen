---
description: Verify implementation matches plan success criteria
---

# Validate Plan Command

## Purpose
Verify implementation matches the plan's success criteria and prepare for commit.

## Instructions

1. **Find the relevant plan**:
   - Use the most recent plan if none specified
   - Or find plan matching the described feature

2. **Check implementation status**:
   - Verify each phase's changes exist
   - Confirm code matches plan specifications

3. **Run automated verification**:
   - Build: `npm run build` (or equivalent)
   - Tests: `npm test`
   - Type checking: `npm run typecheck`
   - Linting: `npm run lint`

4. **Code review**:
   - Check code follows project patterns
   - Verify security considerations
   - Confirm no regressions

5. **Generate validation report**:

```markdown
## Validation Report: [Feature Name]

### Implementation Status
✓ Phase 1: [Name] - Fully implemented
✓ Phase 2: [Name] - Fully implemented
⚠️ Phase 3: [Name] - Partial (see notes)

### Automated Verification Results
✓ Build passes
✓ All [X] tests pass
✓ Type checking clean
✓ No linting issues

### Code Review Findings

#### Matches Plan
- [Confirmation of key implementations]

#### Deviations
- [Any differences from plan with rationale]

#### Security Validation
- [Security checks performed]

### Manual Testing Checklist
- [ ] [Item to manually verify]
- [ ] [Another item]

### Ready to Commit
[Yes/No with any conditions]
```
