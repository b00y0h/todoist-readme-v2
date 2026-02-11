# Todoist Readme V2

## What This Is

A GitHub Action that displays Todoist productivity stats in your README. Forked from an existing action that broke due to Todoist API deprecation — migrating to new API endpoints and publishing to GitHub Marketplace.

## Core Value

Users can automatically showcase their Todoist productivity stats in their GitHub profile README without manual updates.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing functionality. -->

- ✓ GitHub Action with configurable inputs (API key, premium flag) — existing
- ✓ README template system using HTML comment markers — existing
- ✓ Stats formatting with emoji and human-readable numbers — existing
- ✓ Automatic git commit/push of changes — existing
- ✓ TEST_MODE for development without git operations — existing
- ✓ Premium tier differentiation (weekly stats) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Migrate from deprecated Sync API to new Todoist /api/v1/ endpoints
- [ ] Display karma points from new API
- [ ] Display tasks completed today from new API
- [ ] Display tasks completed this week (premium) from new API
- [ ] Display total completed tasks from new API
- [ ] Display longest streak from new API
- [ ] Auto-detect committer from GitHub actor (replace hardcoded values)
- [ ] Update to Node.js 20 runtime
- [ ] Publish to GitHub Marketplace

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- OAuth login flow — Users already have API tokens, keeping it simple
- Custom stat selection — Keep v1 simple, all-or-nothing display
- Multiple README targets — Single README.md is sufficient for v1
- Notification features — Out of scope for a README updater

## Context

**Origin:** Fork of existing Todoist README action that stopped working when Todoist deprecated `/sync/v9/completed/get_stats` endpoint.

**API Migration:** Error message from deprecated endpoint directs to `/api/v1/` endpoints. Need to research what stats are available in the new API structure.

**Existing Codebase:**
- Single-file architecture (`index.js` + `exec.js` helper)
- Uses axios for HTTP, @actions/core for GitHub Actions integration
- Bundled with ncc for distribution
- See `.planning/codebase/` for detailed analysis

## Constraints

- **API Compatibility**: Must work with whatever stats Todoist's new /api/v1/ provides
- **GitHub Actions**: Must pass GitHub Marketplace requirements
- **Node 20**: GitHub Actions deprecated Node 16, must use Node 20
- **Backwards Compatible**: Existing users should be able to upgrade with minimal changes

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GitHub actor for commits | Hardcoded author info is bad practice, actor auto-detection is cleaner | — Pending |
| Research API before requirements | New API may have different data available, need to understand options | — Pending |
| Keep single-file architecture | Existing pattern works, no need to over-engineer | — Pending |

---
*Last updated: 2026-02-11 after initialization*
