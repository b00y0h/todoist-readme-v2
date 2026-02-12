# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-02-12

### Breaking Changes

- **Node.js 20 runtime** - Upgraded from Node 16 (deprecated by GitHub)
- **Removed `USERNAME` input** - Committer identity now auto-detected from GitHub actor
- **API Migration** - Switched from deprecated Todoist Sync API v9 to unified API v1

### Added

- **Granular tag customization** - Place individual stats anywhere in README:
  - `TODO-IST-KARMA` - Karma points
  - `TODO-IST-DAILY` - Tasks completed today
  - `TODO-IST-WEEKLY` - Tasks this week (Premium)
  - `TODO-IST-TOTAL` - Total completed tasks
  - `TODO-IST-CURRENT-STREAK` - Current daily streak
  - `TODO-IST-LONGEST-STREAK` - Longest streak record
- **Current streak display** - Shows current daily streak with encouraging messages
- **Longest streak display** - Shows historical best streak
- **Auto-detected committer** - Uses GitHub actor identity instead of hardcoded values
- **Skip empty commits** - Only commits when README actually changes
- **Improved error handling** - Clear, actionable error messages for API failures
- **Rate limit handling** - Exponential backoff with Retry-After header support

### Changed

- Commit message updated to "Update Todoist stats" (was "Todoist updated.")
- Git config uses local scope (doesn't leak to other workflow steps)
- Premium input now expects string "true"/"false" (was boolean)

### Fixed

- API compatibility with Todoist unified API v1 (v9 deprecated Feb 10, 2026)
- Empty commits when stats unchanged
- Hardcoded author identity in commits

## [1.x.x] - Previous

See git history for previous versions. v1.x used the now-deprecated Todoist Sync API v9.
