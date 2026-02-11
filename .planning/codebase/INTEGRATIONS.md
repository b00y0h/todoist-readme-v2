# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**Todoist:**
- Todoist API (v9) - Retrieves completed task statistics and user activity data
  - SDK/Client: axios HTTP client
  - Endpoint: `https://api.todoist.com/sync/v9/completed/get_stats`
  - Auth: Bearer token via Authorization header
  - Environment variable: `TODOIST_API_KEY` (input parameter)
  - Response data includes: karma points, daily/weekly task counts, completion goals, longest streak

**GitHub:**
- GitHub Actions Runtime - Provides workflow context and execution environment
  - Client: @actions/core
  - Provides: input parameter retrieval, logging, error handling

## Data Storage

**Databases:**
- Not used - stateless action

**File Storage:**
- Local filesystem only
  - Reads: `./README.md` (file-based, co-located with action)
  - Writes: `./README.md` with updated Todoist statistics
  - Pattern: Uses HTML comment tags to identify section: `<!-- TODO-IST:START -->` ... `<!-- TODO-IST:END -->`

**Caching:**
- None - fetches fresh data on each run

## Authentication & Identity

**Auth Provider:**
- Custom token-based
  - Implementation: Bearer token authentication with Todoist API
  - Token passed via `TODOIST_API_KEY` GitHub Actions input
  - Configured in GitHub Actions secrets at workflow definition time

**Git Identity:**
- Hardcoded in `index.js` (lines 114-115):
  - Committer name: "Abhishek Naidu" (hardcoded)
  - Committer email: "example@gmail.com" (hardcoded)
  - Used for git commit operations

## Monitoring & Observability

**Error Tracking:**
- None integrated

**Logs:**
- GitHub Actions logs (via @actions/core)
  - `core.info()` for informational messages
  - `core.error()` for error messages
  - Logs printed to GitHub Actions workflow console
  - Console.log used in exec.js for command execution tracking

## CI/CD & Deployment

**Hosting:**
- GitHub Actions (serverless, workflow-based execution)
- Execution context: GitHub Actions workflow triggered by schedule or manual dispatch

**Distribution:**
- Bundled as standalone action using @zeit/ncc
- Compiled bundle location: `dist/index.js` (referenced in action.yml)
- Entry point for GitHub Actions: "dist/index.js" (from action.yml line 22)

**CI Pipeline:**
- None configured - project is itself a GitHub Actions action
- Build command: `npm run build` creates ncc bundle for distribution

## Environment Configuration

**Required env vars (GitHub Actions inputs):**
- `TODOIST_API_KEY` - Todoist API authentication token (required)
- `PREMIUM` - Boolean flag to enable premium-only statistics (optional, default: false)
- `USERNAME` - GitHub username (optional, defaults to github.repository_owner)

**Secrets location:**
- GitHub Actions secrets (configured at repository settings level)
- Injected as workflow inputs to action.yml inputs

**Example workflow setup:**
```yaml
- uses: abhisheknaiidu/todoist-readme@master
  with:
    TODOIST_API_KEY: ${{ secrets.TODOIST_API_KEY }}
    PREMIUM: true
```

## Webhooks & Callbacks

**Incoming:**
- GitHub Actions workflow triggers (schedule or manual dispatch)
- Not using webhook-based event triggers

**Outgoing:**
- Git push to repository (uses `git push` to commit README changes back to repository)
- All communication via standard HTTPS protocols

## Git Integration

**Repository Operations:**
- Git config: user.email and user.name set globally within action execution
- Git operations:
  - `git add README.md` - stages updated file
  - `git commit -m "Todoist updated."` - commits changes
  - `git push` - pushes commit to remote repository
- Requires: write access to repository contents via GitHub Actions permissions

## Data Flow

1. GitHub Actions invokes action (triggered by schedule or manual event)
2. Action retrieves `TODOIST_API_KEY` from inputs
3. Action calls Todoist API v9 endpoint with Bearer authentication
4. Parses response containing karma, task counts, goals, streaks
5. Formats data with humanize-plus for display formatting
6. Reads existing README.md file
7. Inserts formatted stats between HTML comment markers
8. Commits changes with git (if changes detected)
9. Pushes to remote repository

---

*Integration audit: 2026-02-11*
