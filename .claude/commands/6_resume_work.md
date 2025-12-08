---
description: Restore context from a saved session and continue work
---

# Resume Work Command

## Purpose
Restore context from a saved session and continue work.

## Instructions

1. **Load session file** from specified path or most recent

2. **Restore context**:
   - Read the session summary
   - Load referenced plan if applicable
   - Review the current state

3. **Verify environment**:
   - Check files mentioned still exist
   - Verify no conflicting changes
   - Run quick status check

4. **Present restoration summary**:
   ```
   Restored context:
   - Plan: [Name if applicable]
   - Progress: [Phase X of Y]
   - Last action: [What was done]
   - Next: [What to do]
   ```

5. **Continue from where we left off**
