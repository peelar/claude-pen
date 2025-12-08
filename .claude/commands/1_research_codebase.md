---
description: Deep dive into the codebase using parallel analysis
---

# Research Codebase Command

## Purpose
Deep dive into the codebase using parallel analysis to understand how specific systems work.

## Instructions

When the user provides a research question, you will:

1. **Spawn parallel research agents** to investigate different aspects:
   - **Codebase Locator**: Find all relevant files, modules, and directories
   - **Codebase Analyzer**: Understand how the code works, data flows, and dependencies
   - **Pattern Finder**: Discover coding patterns, conventions, and best practices to follow

2. **For each agent, investigate**:
   - File locations with specific line numbers
   - Code patterns and their purposes
   - Dependencies and relationships
   - Edge cases and error handling

3. **Synthesize findings** into a comprehensive research document:
   - Overview of the system
   - Key files and their responsibilities
   - Patterns to follow
   - Potential concerns or complexity
   - Recommendations for implementation

4. **Save the research** to `thoughts/shared/research/[descriptive_name].md`

## Output Format

```markdown
# Research: [Topic]

## Overview
[Brief summary of findings]

## Key Files & Locations
| File | Purpose | Key Lines |
|------|---------|-----------|
| path/to/file.ts | Description | 45-78 |

## Architecture & Data Flow
[How the system works]

## Patterns to Follow
[Code patterns discovered]

## Code Examples
[Relevant code snippets with file:line references]

## Recommendations
[Implementation guidance based on findings]
```

## Example Usage
> /1_research_codebase
> How does the authentication system handle session management and token refresh?
