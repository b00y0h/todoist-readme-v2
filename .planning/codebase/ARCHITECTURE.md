# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** GitHub Action (Workflow Automation)

**Key Characteristics:**
- Single-purpose CLI tool executed as a GitHub Action
- Fetch-Transform-Persist pattern
- Stateless operation triggered on schedule or manual dispatch
- Direct GitHub repository manipulation (git operations)
- External API integration (Todoist API v9)

## Layers

**Input/Orchestration Layer:**
- Purpose: Handle GitHub Action inputs and bootstrap main workflow
- Location: `index.js` (lines 1-17, 129-131)
- Contains: Entry point, configuration loading via `@actions/core`
- Depends on: Todoist API, GitHub Actions framework
- Used by: GitHub Actions runtime

**API Integration Layer:**
- Purpose: Communicate with external Todoist API
- Location: `index.js` (lines 12-15)
- Contains: Axios HTTP client, API authentication, stats retrieval
- Depends on: axios, Todoist API v9 endpoint
- Used by: Data transformation layer

**Data Transformation Layer:**
- Purpose: Convert Todoist stats to README markdown format
- Location: `index.js` (lines 23-75)
- Contains: Stats parsing, formatting, human-readable conversion
- Depends on: humanize-plus library, data validation
- Used by: File persistence layer

**File/Git Persistence Layer:**
- Purpose: Update README and commit changes to repository
- Location: `index.js` (lines 79-127), `exec.js`
- Contains: File I/O, git command execution, commit logic
- Depends on: fs module, exec wrapper, git command-line
- Used by: Main orchestration flow

**Command Execution Layer:**
- Purpose: Safely spawn and monitor subprocess execution
- Location: `exec.js`
- Contains: Child process management, error handling, stdio forwarding
- Depends on: Node.js child_process module
- Used by: Git persistence layer

## Data Flow

**Fetch-Transform-Persist Workflow:**

1. **Fetch Phase**: `main()` calls Todoist API with bearer token authentication
2. **Transform Phase**: `updateReadme()` extracts stats (karma, completed count, streaks, goals) and formats them into markdown with emoji decorations
3. **Validate Phase**: `buildReadme()` locates template tags (`<!-- TODO-IST:START -->` to `<!-- TODO-IST:END -->`) in existing README
4. **Insert Phase**: If content changed, inserts formatted stats between template tags
5. **Persist Phase**: Writes updated README to filesystem
6. **Commit Phase**: Git config, add, commit, and push changes (unless in TEST_MODE)

**State Management:**
- Global `todoist` array accumulates formatted stat strings during transform phase
- Global `jobFailFlag` tracks job status
- No persistent state between runs (stateless workflow action)

## Key Abstractions

**Todoist Stats Object:**
- Purpose: Structured data from API response
- Examples: `stats.data` contains `karma`, `completed_count`, `days_items`, `goals`, `week_items`
- Pattern: Direct destructuring of API response

**Markdown Template Pattern:**
- Purpose: Enable non-technical users to mark update zones in README
- Pattern: HTML comment markers (`<!-- TODO-IST:START -->`, `<!-- TODO-IST:END -->`)
- Used by: `buildReadme()` for safe content injection

**Exec Wrapper Abstraction:**
- Purpose: Unified promise-based child process management
- Pattern: `exec(cmd, args, options)` returns Promise
- Simplifies: Git command chaining, error handling, stdio management

**Conditional Premium Feature:**
- Purpose: Support Todoist free and premium tier differences
- Pattern: PREMIUM environment variable gates week_items inclusion
- Location: `index.js` line 34

## Entry Points

**GitHub Action Entry:**
- Location: `action.yml` specifies `dist/index.js` as entrypoint
- Triggers: `workflow_dispatch` (manual) or `schedule` (cron)
- Responsibilities: Accepts inputs (TODOIST_API_KEY, PREMIUM, USERNAME), validates inputs, returns success/failure

**Main Function:**
- Location: `index.js` line 10-17
- Triggers: IIFE at line 129-131
- Responsibilities: Orchestrate API fetch → data transform → README update → git commit

**Update Readme Function:**
- Location: `index.js` line 23-75
- Triggers: After successful API call
- Responsibilities: Format stats, validate template tags, write file, trigger git commit

## Error Handling

**Strategy:** Fail-fast with process.exit() calls

**Patterns:**
- **Missing Template Tags**: Logs error via `core.error()` and exits with code 1 (line 98-101)
- **Git Command Failures**: `exec()` rejects promise if subprocess exits non-zero (line 13-16 in exec.js), propagates up the chain
- **API Failures**: axios rejects promise on HTTP errors (implicit)
- **No Content Changes**: Skips commit and exits gracefully with code 0 (line 69)
- **Job Failure Flag**: Final exit code determined by `jobFailFlag` variable (lines 73, 126)

## Cross-Cutting Concerns

**Logging:**
- Uses `core.info()` from @actions/core for GitHub Actions UI visibility (lines 62, 68, 72, 124)
- Uses `core.error()` for error conditions with context
- Uses `console.log()` in exec.js for subprocess command logging

**Authentication:**
- Todoist API: Bearer token from TODOIST_API_KEY input (line 14)
- Git: Configured with hardcoded committer identity (lines 114-115 in exec wrapper, then line 118)
- Git credentials: Inherited from GitHub Actions environment (implicit git push uses runner token)

**Testing:**
- TEST_MODE environment variable bypasses git commit during development (line 64)
- Allows `updateReadme()` logic testing without actual git operations

---

*Architecture analysis: 2026-02-11*
