# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- JavaScript (ES6+) - All application logic

## Runtime

**Environment:**
- Node.js 12+ (specified in action.yml as "node12")

**Package Manager:**
- npm
- Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- GitHub Actions (@actions/core 1.2.5) - GitHub Actions integration and input/output handling

**Build/Dev:**
- @zeit/ncc 0.22.3 - Node CLI for compiling into standalone bundles for GitHub Actions distribution

**HTTP Client:**
- axios 0.20.0 - HTTP requests to external APIs (Todoist API)

## Key Dependencies

**Critical:**
- @actions/core 1.2.5 - Handles GitHub Actions context (inputs, logging, error handling). Used in `index.js` to retrieve API keys and configuration.
- axios 0.20.0 - Makes HTTP requests to Todoist API endpoints. Requires follow-redirects 1.10.0 transitive dependency.

**Utilities:**
- humanize-plus 1.8.2 - Formats numbers for README display (intComma for comma-separated thousands)
- child_process 1.0.2 - Wrapper module for spawning git CLI commands for commits and pushes

**System:**
- process 0.11.10 - Process utilities for exit codes and environment variable access

## Configuration

**Environment:**
- Configured via GitHub Actions input parameters defined in `action.yml`:
  - `TODOIST_API_KEY` (required) - API authentication token
  - `PREMIUM` (optional, default: false) - Flag to enable premium-only stats
  - `USERNAME` (optional, defaults to github.repository_owner) - GitHub username

**Build:**
- `action.yml` - GitHub Actions action manifest
- Build command: `npm run build` runs `ncc build index.js -o dist` to create standalone distribution bundle

## Platform Requirements

**Development:**
- Node.js 12 or later
- npm for package management
- git CLI available in PATH (for commit/push operations)

**Production:**
- Runs as GitHub Actions workflow (on GitHub's infrastructure)
- Requires write access to repository (for README.md commits)
- Requires outbound HTTPS to api.todoist.com

**Required Permissions:**
- GitHub Actions: contents (write) for committing changes
- GitHub Actions: pull-requests (write) if used in PRs

---

*Stack analysis: 2026-02-11*
