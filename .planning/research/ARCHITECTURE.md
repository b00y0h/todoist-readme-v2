# Architecture Research

**Domain:** GitHub Action for README automation
**Researched:** 2026-02-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runtime                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Action Entry Point (index.js)           │    │
│  │  - Parse inputs from action.yml                      │    │
│  │  - Initialize @actions/core logging                  │    │
│  └────────────────┬─────────────────────────────────────┘    │
│                   │                                           │
│  ┌────────────────▼─────────────────────────────────────┐    │
│  │           API Integration Layer                       │    │
│  │  - HTTP client (axios)                                │    │
│  │  - Bearer token authentication                        │    │
│  │  - Todoist API endpoint(s)                           │    │
│  └────────────────┬─────────────────────────────────────┘    │
│                   │                                           │
│  ┌────────────────▼─────────────────────────────────────┐    │
│  │        Data Transformation Layer                      │    │
│  │  - Extract stats (karma, tasks, streaks)             │    │
│  │  - Format to markdown with emoji                     │    │
│  │  - Human-readable number formatting                  │    │
│  └────────────────┬─────────────────────────────────────┘    │
│                   │                                           │
│  ┌────────────────▼─────────────────────────────────────┐    │
│  │          README Template Processor                    │    │
│  │  - Locate HTML comment markers                       │    │
│  │  - Inject formatted stats between markers            │    │
│  │  - Detect changes vs existing content                │    │
│  └────────────────┬─────────────────────────────────────┘    │
│                   │                                           │
│  ┌────────────────▼─────────────────────────────────────┐    │
│  │           Git Automation Layer                        │    │
│  │  - Configure git identity (auto-detect from actor)   │    │
│  │  - Stage README.md changes                           │    │
│  │  - Commit with descriptive message                   │    │
│  │  - Push to repository using inherited credentials    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Action Entry Point | Bootstrap workflow, parse inputs, orchestrate pipeline | Single main() function, IIFE execution, @actions/core for I/O |
| API Integration | Communicate with external Todoist API | axios HTTP client, promise-based, bearer token auth |
| Data Transformation | Convert API response to user-visible format | Destructuring + formatting functions, conditional premium features |
| Template Processor | Safe README content injection | HTML comment marker detection, substring replacement, change detection |
| Git Automation | Commit and push changes to repository | Child process exec wrapper, git config/add/commit/push sequence |
| Command Executor | Subprocess management for git operations | Promise wrapper around spawn, stdio forwarding, exit code handling |

## Recommended Project Structure

For the current migration, keep the existing single-file pattern but with clearer separation:

```
/
├── action.yml              # Action metadata, inputs, runtime spec (node20)
├── package.json            # Dependencies, build script
├── index.js                # Main entry point and orchestration
├── lib/
│   ├── todoist-client.js   # API integration (NEW: encapsulate API calls)
│   ├── stats-formatter.js  # Data transformation (extract from index.js)
│   ├── readme-updater.js   # Template processing (extract from index.js)
│   └── git-committer.js    # Git operations (refactor from exec.js)
├── dist/
│   └── index.js            # ncc bundled output (generated, gitignored)
└── .github/
    └── workflows/
        └── test.yml         # CI workflow for testing action
```

### Structure Rationale

- **action.yml root:** GitHub Actions requirement for marketplace publishing
- **lib/ folder:** Logical separation without over-engineering; easier to test individual components
- **Single dist bundle:** GitHub Actions best practice for performance (no node_modules in action)
- **No src/ folder:** Overkill for this size project, lib/ is sufficient
- **No test/ folder yet:** Can add if test suite grows beyond inline testing

## Architectural Patterns

### Pattern 1: Fetch-Transform-Persist Pipeline

**What:** Linear data flow from external API → formatting → file write → git commit

**When to use:** Single-purpose automation tasks with clear data flow, no user interaction during execution

**Trade-offs:**
- ✅ Simple, predictable, easy to debug
- ✅ Each stage can be tested independently
- ❌ No retry mechanism (entire pipeline fails if one stage fails)
- ❌ Not suitable for complex state management or branching logic

**Example:**
```javascript
async function main() {
  // 1. Fetch
  const stats = await fetchTodoistStats(apiKey);

  // 2. Transform
  const markdown = formatStatsToMarkdown(stats, isPremium);

  // 3. Persist
  const changed = updateReadmeContent(markdown);
  if (changed) {
    await commitAndPush();
  }
}
```

### Pattern 2: HTML Comment Marker Template

**What:** Use HTML comments as injection points in markdown files, allowing safe content updates without breaking surrounding content

**When to use:** User-editable files where you need to update specific sections programmatically

**Trade-offs:**
- ✅ Non-technical users can understand and place markers
- ✅ Preserves surrounding content during updates
- ✅ Works with any text-based file format
- ❌ Brittle if users delete markers
- ❌ Requires explicit error handling for missing markers

**Example:**
```markdown
# My Profile

Some custom content here...

<!-- TODO-IST:START -->
🏆  **1,234** Karma Points
<!-- TODO-IST:END -->

More custom content...
```

### Pattern 3: Git Committer Auto-Detection

**What:** Use GitHub Actions context variables to configure git identity instead of hardcoded values

**When to use:** Any action that commits back to the repository

**Trade-offs:**
- ✅ Works across different repositories without configuration
- ✅ Commits show correct author in GitHub UI
- ✅ Respects user privacy with noreply email option
- ❌ Requires understanding of GitHub Actions context

**Example:**
```javascript
// BAD: Hardcoded committer (current implementation)
await exec('git', ['config', 'user.email', 'example@gmail.com']);
await exec('git', ['config', 'user.name', 'Abhishek Naidu']);

// GOOD: Auto-detected committer (migration target)
const actor = process.env.GITHUB_ACTOR;
const actorId = process.env.GITHUB_ACTOR_ID;
const email = `${actorId}+${actor}@users.noreply.github.com`;
await exec('git', ['config', 'user.email', email]);
await exec('git', ['config', 'user.name', actor]);
```

### Pattern 4: Conditional Bundling with ncc

**What:** Use @vercel/ncc to bundle entire action (dependencies + code) into single distributable file

**When to use:** All GitHub Actions that use npm dependencies

**Trade-offs:**
- ✅ Fast action startup (no npm install during workflow execution)
- ✅ Smaller repository size (dist/ instead of node_modules/)
- ✅ Version pinning (bundled dependencies can't drift)
- ❌ Requires build step before publishing
- ❌ dist/ must be committed to repository

**Example:**
```json
// package.json
{
  "scripts": {
    "build": "ncc build index.js -o dist"
  }
}
```

## Data Flow

### Request Flow

```
[GitHub Actions Trigger: schedule/manual]
    ↓
[Action Entry: Parse inputs from action.yml]
    ↓
[API Client: GET /sync/v9/completed/get_stats OR new v2 endpoint]
    ↓ (response: JSON stats object)
[Formatter: Extract karma, tasks, streaks → markdown strings]
    ↓ (array of formatted strings)
[Template Processor: Locate markers, inject content, detect changes]
    ↓ (updated README content)
[File Writer: Write to README.md]
    ↓ (if content changed)
[Git Committer: config → add → commit → push]
    ↓
[GitHub Actions: Success/Failure exit code]
```

### State Management

**Global State (Current Implementation):**
- `todoist` array: Accumulates formatted stat strings during transformation
- `jobFailFlag`: Boolean tracking whether pipeline should exit with error code

**Recommended (Migration):**
- Pass state through function parameters instead of globals
- Return status from each function for better testability
- Use explicit return values rather than side-effect mutations

**Example refactor:**
```javascript
// BEFORE: Global state mutation
let todoist = [];
function addKarmaStat(stats) {
  todoist.push(formatKarma(stats.karma));
}

// AFTER: Pure functions with explicit returns
function formatAllStats(stats, isPremium) {
  const lines = [
    formatKarma(stats.karma),
    formatDailyTasks(stats.days_items),
    isPremium ? formatWeeklyTasks(stats.week_items) : null,
    formatTotalTasks(stats.completed_count),
    formatLongestStreak(stats.goals)
  ].filter(Boolean);

  return lines.join('\n');
}
```

### Key Data Flows

1. **Stats Retrieval:** Todoist API → axios → destructured object → formatter functions
2. **Content Injection:** Formatted strings → template processor → file system
3. **Git Operations:** fs write → git add → git commit (with auto-detected author) → git push

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 users | Current single-file architecture is fine, no changes needed |
| 100-1k users | Consider adding retry logic for API calls (Todoist rate limits), keep architecture otherwise |
| 1k+ users | Same architecture works (stateless, per-repo execution), potential GitHub Actions concurrency limits are GitHub's problem not ours |

### Scaling Priorities

1. **First bottleneck:** Todoist API rate limits (unlikely to hit at scale due to per-repo execution)
2. **Second bottleneck:** GitHub Actions runner availability (GitHub's infrastructure, not action's concern)

**Reality check:** This action runs once per user repository, not centralized. Architecture doesn't need to "scale" in traditional sense because each execution is isolated.

## Anti-Patterns

### Anti-Pattern 1: Hardcoded Git Committer Identity

**What people do:**
```javascript
await exec('git', ['config', 'user.email', 'example@gmail.com']);
await exec('git', ['config', 'user.name', 'Abhishek Naidu']);
```

**Why it's wrong:**
- All commits show same author regardless of who actually ran the action
- Misleading git history
- Violates user expectations (they expect commits from their account)
- Creates privacy issues (exposes action author's email in every user's repo)

**Do this instead:**
```javascript
const actor = process.env.GITHUB_ACTOR;
const actorId = process.env.GITHUB_ACTOR_ID || '41898282'; // GitHub Actions default
const email = `${actorId}+${actor}@users.noreply.github.com`;
await exec('git', ['config', 'user.email', email]);
await exec('git', ['config', 'user.name', actor]);
```

### Anti-Pattern 2: Not Bundling Dependencies

**What people do:** Publish action with `node_modules/` or expect `npm install` during workflow execution

**Why it's wrong:**
- Slow action startup (npm install takes 10-60 seconds)
- Potential security issues (dependencies could change between publishes)
- Larger repository size (entire node_modules vs single bundled file)
- Version drift issues (lockfile might not match installed versions)

**Do this instead:** Use @vercel/ncc or similar bundler to create single `dist/index.js` with all dependencies included

### Anti-Pattern 3: Using Deprecated Node Versions

**What people do:** Keep `using: 'node12'` or `using: 'node16'` in action.yml

**Why it's wrong:**
- Node 12 already deprecated
- Node 16 deprecated as of 2024
- Node 20 will be deprecated in summer 2026
- Actions fail to run when runtime is removed from GitHub runners

**Do this instead:** Use `using: 'node20'` now, plan migration to `node24` before summer 2026

### Anti-Pattern 4: No Change Detection

**What people do:** Always commit even if README content didn't change

**Why it's wrong:**
- Pollutes git history with "no-op" commits
- Triggers unnecessary CI/CD workflows
- Wastes GitHub Actions minutes
- Confuses users looking at commit history

**Do this instead:** Compare new content vs existing content, only commit if different (current implementation already does this correctly)

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Todoist API | REST HTTP with Bearer token | Currently v9 Sync API (deprecated), need to migrate to v2 REST API OR continue using v9 until shutdown |
| GitHub Actions Runtime | Environment variables + @actions/core | Inputs via `core.getInput()`, outputs via `core.setOutput()`, logging via `core.info()` |
| Git (GitHub Repository) | Command-line subprocess | Uses inherited GITHUB_TOKEN credential from Actions environment |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main ↔ API Client | Async function call, Promise resolution | Main orchestrates, API client handles HTTP details |
| API Client ↔ Formatter | Data object passed as parameter | API client returns raw JSON, formatter doesn't know about HTTP |
| Formatter ↔ Template Processor | Formatted string passed as parameter | Formatter knows markdown syntax, template processor knows marker locations |
| Template Processor ↔ Git | File path reference | Template processor writes file, git reads from filesystem |

## Migration-Specific Architecture Decisions

### API Migration Component Structure

**Decision:** Create new `todoist-client.js` module to encapsulate API migration complexity

**Rationale:**
- Isolates API-version-specific logic from business logic
- Allows easy testing of different API endpoints
- Makes future API migrations simpler (just update one module)
- Can implement retry/fallback logic if needed

**Structure:**
```javascript
// lib/todoist-client.js
class TodoistClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.todoist.com'; // Could change based on API version
  }

  async getStats() {
    // Try v2 REST API first, fallback to v9 Sync API if needed
    // OR just use v9 until shutdown (simpler for v1 migration)
  }
}
```

### Build Order for Migration

**Recommended sequence based on dependencies:**

1. **Update runtime spec:** `action.yml` → `using: 'node20'` (standalone, no dependencies)
2. **Extract API client:** Create `lib/todoist-client.js` with current v9 logic (no behavior change yet)
3. **Research new API:** Investigate what Todoist v2 actually provides (may discover v9 is still usable)
4. **Update API calls:** Switch to new endpoints in `todoist-client.js` only (isolated change)
5. **Extract git committer:** Create `lib/git-committer.js` with auto-detection (independent of API)
6. **Update build process:** Ensure ncc bundles new lib/ structure
7. **Integration test:** Test end-to-end with new structure
8. **Marketplace prep:** Add branding, descriptions, categories for publishing

**Why this order:**
- Runtime update is trivial, do it first to unblock everything else
- API extraction before migration allows testing structure without changing behavior
- Research step prevents implementing against wrong API version
- Git committer is independent, can be done in parallel with API work
- Build process update catches bundling issues early
- Integration testing validates everything works together
- Marketplace is last because it requires working action first

## Sources

- [Publishing actions in GitHub Marketplace - GitHub Docs](https://docs.github.com/en/actions/sharing-automations/creating-actions/publishing-actions-in-github-marketplace)
- [Metadata syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
- [Todoist Sync API v9 Reference](https://developer.todoist.com/sync/v9/) (DEPRECATED)
- [Todoist REST API v2 Reference](https://developer.todoist.com/rest/v2/)
- [GitHub Actions auto-commit best practices](https://github.com/stefanzweifel/git-auto-commit-action)
- [GitHub Actions community discussion on committer detection](https://github.com/orgs/community/discussions/26909)
- [Node 20 deprecation timeline](https://depot.dev/blog/node-20-deprecation-psa-for-depot-users)

---
*Architecture research for: Todoist README GitHub Action migration*
*Researched: 2026-02-11*
