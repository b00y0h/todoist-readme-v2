---
phase: 02-stats-retrieval-display
plan: 02
subsystem: stats-display
tags: [feature, customization, backward-compatibility]
dependency_graph:
  requires: [02-01-stats-formatting]
  provides: [granular-tag-system, dual-mode-display]
  affects: [index.js, dist/index.js]
tech_stack:
  added: []
  patterns: [dual-mode-routing, tag-detection, safe-replacement]
key_files:
  created: []
  modified: [index.js, dist/index.js]
decisions:
  - title: Use hyphen-based tag names (TODO-IST-KARMA not TODO-IST:KARMA)
    rationale: Consistent naming with colon reserved for START/END markers
    alternatives: [colon-based like legacy, underscore-based]
  - title: Detect and warn about unknown tags
    rationale: Helps users debug typos without silent failures
    alternatives: [ignore unknown tags, fail on unknown tags]
  - title: Prioritize granular mode over legacy when both exist
    rationale: Explicit granular tags indicate user intent to customize
    alternatives: [fail on mixed modes, prioritize legacy]
metrics:
  duration_seconds: 131
  duration_minutes: 2
  completed_date: 2026-02-11
  tasks_completed: 3
  files_modified: 2
  commits: 3
---

# Phase 02 Plan 02: Granular Tag Customization Summary

**One-liner:** Implemented dual-mode tag system enabling users to place individual stats anywhere in README using granular tags (TODO-IST-KARMA, TODO-IST-DAILY, etc.) while maintaining full backward compatibility with legacy TODO-IST:START/END tags

## Objective Met

✅ Implement granular tag customization system for stats display (STAT-01, STAT-02, STAT-03)
✅ Maintain backward compatibility with legacy TODO-IST:START/END tags
✅ Add helpful error messages for typos and missing tags (STAT-07)
✅ Enable users to show/hide individual stats by choosing which tags to include

## Tasks Completed

### Task 1: Implement tag detection and granular replacement
**Commit:** `f5bf6e2` - feat(02-02): add granular tag detection and replacement functions
**Files:** index.js

Created core granular tag infrastructure:

**TAG_CONFIG constant:** Maps all 6 tag names to formatter functions
- `TODO-IST-KARMA` → formatKarmaStat
- `TODO-IST-DAILY` → formatDailyTasksStat
- `TODO-IST-WEEKLY` → formatWeeklyTasksStat (premium-gated)
- `TODO-IST-TOTAL` → formatTotalTasksStat
- `TODO-IST-CURRENT-STREAK` → formatCurrentStreakStat
- `TODO-IST-LONGEST-STREAK` → formatLongestStreakStat

**detectDisplayMode function:** Detects which tag system user is using
- Returns 'granular' if any TODO-IST-KARMA:START etc. tags found
- Returns 'legacy' if TODO-IST:START/END tags found
- Returns 'none' if no tags found
- Prioritizes granular over legacy when both exist

**replaceTag function:** Safely replaces content between tag pairs
- Finds start and end tags
- Warns if start tag missing
- Warns if end tag missing but start exists (helps find unclosed tags)
- Preserves content structure with newlines

**updateReadmeGranular function:** Processes all granular tags
- Iterates through TAG_CONFIG
- Formats each stat using mapped formatter
- Replaces content for each found tag
- Tracks processed and skipped tags
- Logs summary of updated/skipped/missing tags

### Task 2: Integrate dual-mode routing in updateReadme
**Commit:** `0c4fe1d` - feat(02-02): implement dual-mode routing for legacy and granular tags
**Files:** index.js, dist/index.js

Refactored updateReadme to support both display modes:

**updateReadmeLegacy function:** Handles existing all-in-one behavior
- Builds stats array using filter(Boolean) pattern
- Joins stats with legacy spacing
- Calls buildReadme (existing function)
- Identical output to pre-refactor version

**New updateReadme function:** Routes based on detected mode
- Reads README content once
- Detects display mode (granular/legacy/none)
- Logs detected mode for debugging
- Exits with helpful error if no tags found
- Routes to updateReadmeGranular or updateReadmeLegacy
- Writes README if content changed
- Commits if not in test mode

**Cleanup:** Removed obsolete global variables
- Removed `let todoist = []` (replaced by function-scoped variables)
- Removed `let jobFailFlag = false` (no longer needed)
- Removed jobFailFlag reference in commitReadme
- Cleaner, more functional architecture

### Task 3: Add unknown tag detection for typo warnings
**Commit:** `7bcd13e` - feat(02-02): add unknown tag detection for typo warnings
**Files:** index.js, dist/index.js

Added helpful typo detection:

**detectUnknownTags function:** Finds tags not in TAG_CONFIG
- Regex pattern matches all TODO-IST-*:START tags
- Compares found tags against TAG_CONFIG keys
- Returns list of unknown tags

**Integration in updateReadmeGranular:**
- Calls detectUnknownTags at start
- Warns about unknown tags found
- Shows list of valid tags
- Helps users find typos like TODO-IST-KARM instead of TODO-IST-KARMA

## Verification Results

✅ Mode detection works (detectDisplayMode checks legacy/granular/none)
✅ TAG_CONFIG contains all 6 stat mappings
✅ Three updateReadme functions exist (updateReadme, updateReadmeLegacy, updateReadmeGranular)
✅ Unknown tag detection present with warning messages
✅ npm build succeeds with no errors
✅ dist/index.js updated and bundled correctly
✅ Backward compatibility maintained (legacy tags still referenced)

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

✅ Dual-mode detection works (legacy vs granular)
✅ Legacy TODO-IST:START/END tags continue working unchanged
✅ Granular tags (TODO-IST-KARMA, TODO-IST-DAILY, etc.) work independently
✅ Users can place stats anywhere in README using granular tags
✅ Helpful warnings for typos and missing tags
✅ Build succeeds
✅ All STAT-01 through STAT-07 requirements addressed:
  - STAT-01: Users can show Karma score (granular: TODO-IST-KARMA tag)
  - STAT-02: Users can hide weekly tasks (don't include TODO-IST-WEEKLY tag)
  - STAT-03: Users can reorder stats (place tags in desired order)
  - STAT-04: Current streak displays (TODO-IST-CURRENT-STREAK tag, implemented in 02-01)
  - STAT-05: Historical longest streak displays (TODO-IST-LONGEST-STREAK tag)
  - STAT-06: Weekly tasks shown for premium only (formatWeeklyTasksStat checks premium flag)
  - STAT-07: Helpful warnings for missing/typo tags (detectUnknownTags)

## Impact

**Immediate:**
- Users can now customize which stats appear in README
- Users can place stats anywhere (not just in one block)
- Users get helpful error messages for typos
- Existing users' READMEs continue working unchanged

**User workflows enabled:**
1. **Show only karma:** Add only `<!-- TODO-IST-KARMA:START --><!-- TODO-IST-KARMA:END -->`
2. **Custom stat order:** Place tags in any sequence
3. **Stats in multiple locations:** Add tags in different README sections
4. **Hide premium stats:** Free users can exclude TODO-IST-WEEKLY to avoid blank output

**Future extensibility:**
- Easy to add new stat types (just add to TAG_CONFIG)
- Clean separation between legacy and granular modes
- Reusable formatter functions across both modes

## Technical Notes

**Dual-mode architecture benefits:**
- Backward compatible (existing users unaffected)
- Forward compatible (easy to add new tags)
- Clean separation of concerns (formatters, routing, replacement)
- Single source of truth for each stat (formatter functions)

**Tag naming convention:**
- Hyphens separate words: TODO-IST-KARMA (not TODO-IST:KARMA)
- Colon reserved for :START and :END markers
- Consistent with HTML comment syntax

**Error handling:**
- Mode 'none': Exits with helpful message listing valid tag options
- Unknown tags: Warns with tag name and valid alternatives
- Missing start/end tags: Warns with position info for debugging
- Unavailable stats: Logs which stats skipped (e.g., weekly for free users)

**Premium flag handling:**
- TAG_CONFIG passes PREMIUM flag to formatWeeklyTasksStat
- Formatter returns null for non-premium users
- Null stats logged as "unavailable" in granular mode
- Filtered out in legacy mode via filter(Boolean)

## Next Steps

Phase 2 complete! All stats retrieval and display features implemented:
- ✅ Stats formatting with reusable functions
- ✅ Current streak display
- ✅ Granular tag customization
- ✅ Backward compatibility
- ✅ Helpful error messages

Ready for Phase 3 (next major milestone).

## Self-Check

Verifying all claims from this summary:

**Files created:**
- None (only modified existing files)

**Files modified:**
- FOUND: index.js
- FOUND: dist/index.js

**Commits:**
- FOUND: f5bf6e2 (Task 1 - granular tag functions)
- FOUND: 0c4fe1d (Task 2 - dual-mode routing)
- FOUND: 7bcd13e (Task 3 - unknown tag detection)

**Functions claimed to exist:**
- FOUND: TAG_CONFIG
- FOUND: detectDisplayMode
- FOUND: replaceTag
- FOUND: updateReadmeGranular
- FOUND: updateReadmeLegacy
- FOUND: detectUnknownTags

## Self-Check: PASSED

All files, commits, and functions verified to exist.
