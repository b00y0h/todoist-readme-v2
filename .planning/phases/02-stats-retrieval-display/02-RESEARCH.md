# Phase 2: Stats Retrieval & Display - Research

**Researched:** 2026-02-11
**Domain:** Todoist Productivity Stats Display & Customization
**Confidence:** HIGH

## Summary

Phase 2 focuses on **enhancing the stats display functionality** now that Phase 1 has established a working connection to the Todoist API v1 productivity stats endpoint. The current implementation (completed in Phase 1) already retrieves and displays all core stats (karma, daily tasks, weekly tasks for premium users, total completed tasks, and longest streak) using the REST endpoint `/api/v1/tasks/completed/stats`. This phase addresses the customization requirement (STAT-07) that allows users granular control over which stats appear and where they're displayed in their README.

The key challenge is implementing a tag-based customization system inspired by the SiddharthShyniben fork, which provides 18+ custom tags for granular stat control (e.g., `<!-- TODO-IST:KARMA -->`, `<!-- TODO-IST:DAILY_TASKS -->`). The current "all-or-nothing" approach inserts all available stats between `<!-- TODO-IST:START -->` and `<!-- TODO-IST:END -->` tags. Users want flexibility to choose which stats to display, customize their layout, and place stats in different README sections.

Research confirms the API response structure is stable and matches expected format: `karma`, `completed_count`, `days_items[0].total_completed`, `week_items[0].total_completed` (premium only), and `goals.max_daily_streak.count`. Phase 1 already implements defensive checks using optional chaining (`?.`) to handle missing fields gracefully. The existing humanize-plus library handles number formatting well for karma and completed_count.

**Primary recommendation:** Implement a dual-mode display system: (1) Legacy mode using existing `<!-- TODO-IST:START/END -->` tags for backward compatibility, and (2) Granular mode using individual stat tags (`<!-- TODO-IST-KARMA:START/END -->`, `<!-- TODO-IST-DAILY:START/END -->`, etc.) for custom layouts. Detect mode by checking which tags exist in README. Maintain current display logic as default fallback when no custom tags present. Add clear error messages when tag syntax is incorrect.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| humanize-plus | ^1.8.2 | Number formatting ("1,234") | Already installed and working. Handles karma/total count formatting. No need to change. |
| @actions/core | ^1.11.1 | GitHub Actions SDK | Already installed. Use for logging warnings when tags missing/malformed. |
| Node.js fs module | Built-in | File system operations | Native module, already used for README reading/writing. No additional dependencies needed. |
| String manipulation | Built-in | Tag parsing and replacement | Use native string methods (indexOf, slice, replace) for template processing. Keep it simple. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| regex | Native | Pattern matching for tags | For validating tag syntax, extracting tag names. Use sparingly to avoid complexity. |
| Template literal | ES6+ | String formatting | For building formatted stat strings with emoji. Already used in current implementation. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tag parser | Handlebars/Mustache | Template engines are overkill for simple tag replacement. Adds dependency weight (10KB+) for minimal benefit. Native string methods sufficient. |
| Manual string building | Template literals | Already using template literals. No change needed. More readable than string concatenation. |
| JSON config file | YAML config | Config file adds complexity users don't want. Tag-based approach is self-documenting and standard for GitHub Actions README workflows. |

**Installation:**
```bash
# No new dependencies required
# All functionality achievable with existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
workspace/
├── index.js              # Keep single-file for now
│   ├── main()           # Entry point (existing)
│   ├── updateReadme()   # Enhanced to support both modes
│   ├── buildReadme()    # Enhanced to support granular tags
│   └── formatStats()    # New: Extract formatting logic
├── dist/
│   └── index.js         # ncc bundled output
└── action.yml           # No changes needed
```

**Note:** Continue single-file architecture. Don't over-engineer. Extract formatting logic into separate functions for testability and reusability, but keep everything in index.js. Phase 3+ can consider multi-file structure if complexity grows.

### Pattern 1: Dual-Mode Tag Detection
**What:** Support both legacy all-in-one tags and granular individual stat tags

**When to use:** Immediately - maintains backward compatibility while adding new functionality

**Example:**
```javascript
// Detect which mode user wants
function detectDisplayMode(readmeContent) {
  const hasLegacyTags = readmeContent.includes('<!-- TODO-IST:START -->') &&
                         readmeContent.includes('<!-- TODO-IST:END -->');

  const granularTags = [
    'TODO-IST-KARMA',
    'TODO-IST-DAILY',
    'TODO-IST-WEEKLY',
    'TODO-IST-TOTAL',
    'TODO-IST-STREAK'
  ];

  const hasGranularTags = granularTags.some(tag =>
    readmeContent.includes(`<!-- ${tag}:START -->`)
  );

  if (hasGranularTags) return 'granular';
  if (hasLegacyTags) return 'legacy';
  return 'none'; // Error case - no tags found
}

// Route to appropriate renderer
async function updateReadme(data) {
  const readmeContent = fs.readFileSync(README_FILE_PATH, 'utf8');
  const mode = detectDisplayMode(readmeContent);

  if (mode === 'granular') {
    return updateReadmeGranular(data, readmeContent);
  } else if (mode === 'legacy') {
    return updateReadmeLegacy(data, readmeContent); // Current implementation
  } else {
    core.error('No TODO-IST tags found in README');
    process.exit(1);
  }
}
```

### Pattern 2: Individual Stat Formatters
**What:** Extract each stat's formatting logic into dedicated functions

**When to use:** Phase 2 implementation - enables reuse across legacy and granular modes

**Example:**
```javascript
// Individual stat formatters
function formatKarmaStat(karma) {
  if (karma === undefined) return null;
  return `🏆  **${Humanize.intComma(karma)}** Karma Points`;
}

function formatDailyTasksStat(days_items) {
  if (!days_items?.[0]?.total_completed) return null;
  return `🌸  Completed **${days_items[0].total_completed}** tasks today`;
}

function formatWeeklyTasksStat(week_items, isPremium) {
  if (!isPremium || !week_items?.[0]?.total_completed) return null;
  return `🗓  Completed **${week_items[0].total_completed}** tasks this week`;
}

function formatTotalTasksStat(completed_count) {
  if (completed_count === undefined) return null;
  return `✅  Completed **${Humanize.intComma(completed_count)}** tasks so far`;
}

function formatLongestStreakStat(goals) {
  if (!goals?.max_daily_streak?.count) return null;
  return `⏳  Longest streak is **${goals.max_daily_streak.count}** days`;
}

// Reuse in both modes
function updateReadmeLegacy(data, readmeContent) {
  const stats = [
    formatKarmaStat(data.karma),
    formatDailyTasksStat(data.days_items),
    formatWeeklyTasksStat(data.week_items, PREMIUM === "true"),
    formatTotalTasksStat(data.completed_count),
    formatLongestStreakStat(data.goals)
  ].filter(Boolean); // Remove nulls

  return buildReadme(readmeContent, stats.join('           \n'));
}

function updateReadmeGranular(data, readmeContent) {
  let updatedContent = readmeContent;

  // Replace each tag individually
  if (readmeContent.includes('<!-- TODO-IST-KARMA:START -->')) {
    const formatted = formatKarmaStat(data.karma) || '';
    updatedContent = replaceTag(updatedContent, 'TODO-IST-KARMA', formatted);
  }

  // Repeat for each tag...
  return updatedContent;
}
```

### Pattern 3: Graceful Degradation for Missing Stats
**What:** Display helpful messages when stats unavailable instead of showing "undefined"

**When to use:** Both modes - improves user experience for premium/free tier differences

**Example:**
```javascript
function formatWeeklyTasksStat(week_items, isPremium) {
  // Premium feature check
  if (!isPremium) {
    return null; // Don't show tag at all in granular mode, skip in legacy mode
  }

  // Premium user but no data
  if (!week_items?.[0]?.total_completed) {
    return `🗓  Completed **0** tasks this week`;
  }

  return `🗓  Completed **${week_items[0].total_completed}** tasks this week`;
}

// Current streak (not in current implementation, but in requirements)
function formatCurrentStreakStat(goals) {
  const count = goals?.current_daily_streak?.count;

  if (count === undefined) {
    // No streak data available
    return null;
  }

  if (count === 0) {
    return `🔥  Current streak: **Start one today!**`;
  }

  return `🔥  **${count}** day streak`;
}
```

### Pattern 4: Tag Replacement with Validation
**What:** Safe tag finding and replacement with error handling

**When to use:** Granular mode implementation

**Example:**
```javascript
function replaceTag(content, tagName, newContent) {
  const startTag = `<!-- ${tagName}:START -->`;
  const endTag = `<!-- ${tagName}:END -->`;

  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag, startIndex);

  // Validation
  if (startIndex === -1 || endIndex === -1) {
    core.warning(`Tag ${tagName} not found or incomplete in README`);
    return content; // Skip this stat, don't fail entire action
  }

  const endOfStartTag = startIndex + startTag.length;

  // Build new content: before start tag + start tag + newContent + newline + end tag + after end tag
  return [
    content.slice(0, endOfStartTag),
    '\n',
    newContent,
    '\n',
    content.slice(endIndex)
  ].join('');
}

// Process all tags
function updateReadmeGranular(data, readmeContent) {
  let updated = readmeContent;

  const tagMap = {
    'TODO-IST-KARMA': formatKarmaStat(data.karma),
    'TODO-IST-DAILY': formatDailyTasksStat(data.days_items),
    'TODO-IST-WEEKLY': formatWeeklyTasksStat(data.week_items, PREMIUM === "true"),
    'TODO-IST-TOTAL': formatTotalTasksStat(data.completed_count),
    'TODO-IST-STREAK': formatLongestStreakStat(data.goals)
  };

  for (const [tagName, formattedStat] of Object.entries(tagMap)) {
    if (formattedStat !== null) {
      updated = replaceTag(updated, tagName, formattedStat);
    }
  }

  return updated;
}
```

### Anti-Patterns to Avoid
- **Mixing modes:** Don't try to support both legacy and granular tags in same README. Choose one mode based on tag detection.
- **Breaking backward compatibility:** Existing users with `<!-- TODO-IST:START/END -->` tags must continue working without changes.
- **Over-engineering tag syntax:** Keep tag names simple (`TODO-IST-KARMA`, not `TODO-IST:STAT:KARMA:FORMAT:LARGE`). Avoid configurable options in tags.
- **Failing on missing granular tags:** If user wants only karma, let them add only `TODO-IST-KARMA` tags. Don't require all tags.
- **Showing "undefined" or "null":** Always check data availability before displaying. Skip stat entirely if unavailable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting | Custom comma insertion logic | humanize-plus library | Already installed, handles edge cases (negatives, decimals, localization). Battle-tested. |
| Template parsing | Regex-heavy parser with AST | Simple indexOf + slice | Overkill for simple start/end tag pairs. Native string methods are fast, readable, debuggable. |
| Configuration system | YAML/JSON config file parser | Tag-based inline configuration | Users don't want config files. Tags in README are self-documenting and standard in GitHub Actions ecosystem. |
| Tag validation | Complex regex validators | Simple string.includes() checks | Simpler tags = simpler validation. indexOf is faster and more maintainable than regex for fixed strings. |

**Key insight:** This is a display feature, not a parsing challenge. The complexity is in business logic (which stats to show, how to format them), not in template processing. Keep template logic dead simple. Complex template engines solve problems we don't have and create problems we don't want (learning curve, bundle size, edge cases).

## Common Pitfalls

### Pitfall 1: Breaking Backward Compatibility
**What goes wrong:** Implement granular tags, user updates action, existing `<!-- TODO-IST:START/END -->` tags stop working, README updates fail.

**Why it happens:** Developers focus on new feature (granular tags) and forget existing users rely on current behavior. Changing tag syntax or detection logic breaks production workflows.

**How to avoid:**
1. Detect which tag style exists in README before processing
2. Default to legacy mode if `TODO-IST:START` found
3. Only use granular mode if specific granular tags detected
4. Test with both tag styles in CI/CD
5. Document migration path in README with examples

**Warning signs:**
- Test suite only covers new granular tag syntax
- No tests for existing `TODO-IST:START/END` behavior
- Changes to buildReadme() function signature
- No migration guide in documentation

**Verification:**
```javascript
// Test case: Legacy tags continue working
const legacyReadme = `
<!-- TODO-IST:START -->
<!-- TODO-IST:END -->
`;
const result = updateReadme(mockData, legacyReadme);
assert(result.includes('🏆  **5,432** Karma Points'));
assert(result.includes('Longest streak'));
```

### Pitfall 2: Tag Replacement Order Dependencies
**What goes wrong:** Replacing multiple tags in sequence causes index offsets, tags replaced multiple times, or content corrupted because string indices shift after first replacement.

**Why it happens:** Naive approach: `content = replaceTag(content, 'TAG1', data); content = replaceTag(content, 'TAG2', data);` works fine until tags overlap or are nested, or when replacement changes string length causing subsequent indexOf calls to target wrong positions.

**How to avoid:**
1. Process tags from end to beginning of file (reverse order)
2. OR: Collect all replacements first, apply in single pass
3. OR: Use regex with replaceAll + callback function
4. Always validate tag positions before replacement
5. Test with tags in various orders in README

**Warning signs:**
- Stats appearing in wrong sections of README
- Duplicate stat display (same stat appears twice)
- Tags bleeding into each other
- README corruption after update

**Verification:**
```javascript
// Test case: Multiple granular tags in different orders
const readme = `
# Section 1
<!-- TODO-IST-TOTAL:START -->
<!-- TODO-IST-TOTAL:END -->

# Section 2
<!-- TODO-IST-KARMA:START -->
<!-- TODO-IST-KARMA:END -->

# Section 3
<!-- TODO-IST-DAILY:START -->
<!-- TODO-IST-DAILY:END -->
`;

const result = updateReadmeGranular(mockData, readme);

// Verify each section got correct stat
assert(result.indexOf('Karma Points') > result.indexOf('Section 2'));
assert(result.indexOf('tasks today') > result.indexOf('Section 3'));
assert(result.indexOf('tasks so far') > result.indexOf('Section 1'));
```

### Pitfall 3: Premium Feature Confusion
**What goes wrong:** Free user adds `<!-- TODO-IST-WEEKLY:START/END -->` tags to README. Action runs, weekly tasks are undefined, user sees "Completed undefined tasks this week" or action fails with undefined reference error.

**Why it happens:** Weekly stats (`week_items`) are premium-only in Todoist API. Free users get null/undefined for this field. Code doesn't check PREMIUM input or handle undefined gracefully.

**How to avoid:**
1. Check PREMIUM input before formatting weekly stats
2. Return null from formatWeeklyTasksStat if not premium
3. Skip tag replacement if formatted stat is null
4. Log info message: "Weekly stats require Todoist Premium" for transparency
5. Document premium requirements in README and tag comments

**Warning signs:**
- User reports "undefined" appearing in README
- Issues from free users saying "weekly stats don't work"
- No conditional logic checking PREMIUM input value
- formatWeeklyTasksStat doesn't handle undefined week_items

**Verification:**
```javascript
// Test case: Free user (PREMIUM=false) with weekly tag
process.env.PREMIUM = "false";
const readme = `
<!-- TODO-IST-WEEKLY:START -->
<!-- TODO-IST-WEEKLY:END -->
`;

const mockDataFree = { ...mockData, week_items: null };
const result = updateReadmeGranular(mockDataFree, readme);

// Should skip weekly stat entirely, not show "undefined"
assert(!result.includes('undefined'));
assert(!result.includes('tasks this week'));

// Or show helpful message
assert(result.includes('Requires Todoist Premium') ||
       result.match(/TODO-IST-WEEKLY:START -->\s*<!-- TODO-IST-WEEKLY:END/));
```

### Pitfall 4: Inconsistent Empty State Handling
**What goes wrong:** User has 0 karma or 0-day streak. Action displays nothing (blank line) or shows "0 Karma Points" depending on which stat, creating inconsistent UX. Or worse, skips the stat entirely, making user think action is broken.

**Why it happens:** Formatter functions check `if (!value)` which treats 0 as falsy. Or different formatters use different checks (`!== undefined` vs `> 0` vs `!value`).

**How to avoid:**
1. Distinguish between "data unavailable" (undefined/null) and "zero value" (0)
2. Use explicit checks: `if (value === undefined) return null;`
3. Display zero values with appropriate message: "**0** day streak - start one today!"
4. Consistent pattern across all formatters
5. Test with zero values for all stats

**Warning signs:**
- Formatter functions use `if (!value)` or `if (value)` without distinguishing null/undefined from 0
- Different formatters have different handling for zero vs missing
- README shows blank lines where stats should be
- User reports "streak disappeared" when they miss a day

**Verification:**
```javascript
// Test case: Zero values should display, not hide
const mockDataWithZeros = {
  karma: 0,
  completed_count: 0,
  days_items: [{ total_completed: 0 }],
  goals: {
    current_daily_streak: { count: 0 },
    max_daily_streak: { count: 0 }
  }
};

const formatted = formatKarmaStat(mockDataWithZeros.karma);
assert(formatted !== null, 'Zero karma should display');
assert(formatted.includes('0 Karma'), 'Should show 0 explicitly');

const streakFormatted = formatCurrentStreakStat(mockDataWithZeros.goals);
assert(streakFormatted !== null, 'Zero streak should display');
assert(streakFormatted.includes('Start') || streakFormatted.includes('0 day'), 'Should encourage starting streak');
```

### Pitfall 5: Malformed Tag Syntax Silent Failures
**What goes wrong:** User types `<!-- TODO-IST-KARM:START -->` (typo: missing 'A' in KARMA). Action runs successfully, but karma stat never appears. User doesn't know why, no error message, silently skips stat.

**Why it happens:** Tag detection checks for exact tag names. Typo means tag not found, function returns early without processing. No validation, no warnings, just silent failure.

**How to avoid:**
1. Log warnings for common typos: check for tags close to valid names (edit distance)
2. List all tags found in README at start: `core.info('Found tags: TODO-IST-KARMA, TODO-IST-DAILY')`
3. Log which stats were successfully updated vs skipped
4. Fail explicitly if no valid tags found at all
5. Provide clear tag name reference in action logs

**Warning signs:**
- No logging about which tags were processed
- replaceTag function silently returns original content on missing tag
- No validation of tag names against known valid names
- User confusion about why stats don't appear despite "action succeeded"

**Verification:**
```javascript
// Test case: Malformed tag name should warn user
const readmeWithTypo = `
<!-- TODO-IST-KARM:START -->
<!-- TODO-IST-KARM:END -->
`;

// Mock core.warning to capture warnings
const warnings = [];
core.warning = (msg) => warnings.push(msg);

updateReadmeGranular(mockData, readmeWithTypo);

// Should warn about unknown tag
assert(warnings.some(w => w.includes('TODO-IST-KARM')), 'Should warn about unknown tag');
assert(warnings.some(w => w.includes('KARMA')), 'Should suggest correct tag name');
```

## Code Examples

Verified patterns from current implementation and best practices:

### Current Stats Formatting (Phase 1)
```javascript
// Source: /workspace/index.js lines 70-96
// This is the working implementation from Phase 1
async function updateReadme(data) {
  const { karma, completed_count, days_items, goals, week_items } = data;

  // Karma points
  if (karma !== undefined) {
    todoist.push([`🏆  **${Humanize.intComma(karma)}** Karma Points`]);
  }

  // Daily tasks
  if (days_items?.[0]?.total_completed !== undefined) {
    todoist.push([`🌸  Completed **${days_items[0].total_completed}** tasks today`]);
  }

  // Weekly tasks (premium only)
  if (PREMIUM === "true" && week_items?.[0]?.total_completed !== undefined) {
    todoist.push([`🗓  Completed **${week_items[0].total_completed}** tasks this week`]);
  }

  // Total completed tasks
  if (completed_count !== undefined) {
    todoist.push([`✅  Completed **${Humanize.intComma(completed_count)}** tasks so far`]);
  }

  // Longest streak
  if (goals?.max_daily_streak?.count !== undefined) {
    todoist.push([`⏳  Longest streak is **${goals.max_daily_streak.count}** days`]);
  }

  if (todoist.length == 0) return;

  const readmeData = fs.readFileSync(README_FILE_PATH, "utf8");
  const newReadme = buildReadme(readmeData, todoist.join("           \n"));
  // ... rest of function
}
```

### Enhanced Stats with Current Streak (New for Phase 2)
```javascript
// Add current streak display (requirement STAT-04)
function formatCurrentStreakStat(goals) {
  const count = goals?.current_daily_streak?.count;

  if (count === undefined) return null;

  if (count === 0) {
    return `🔥  Current streak: **0 days** - Start one today!`;
  }

  const days = count === 1 ? 'day' : 'days';
  return `🔥  Current streak: **${count} ${days}**`;
}

// Update updateReadme to include current streak
if (goals?.current_daily_streak?.count !== undefined) {
  todoist.push([formatCurrentStreakStat(goals)]);
}
```

### Granular Tag System Implementation
```javascript
// New for Phase 2: Granular tag support
const TAG_CONFIG = {
  'TODO-IST-KARMA': (data) => formatKarmaStat(data.karma),
  'TODO-IST-DAILY': (data) => formatDailyTasksStat(data.days_items),
  'TODO-IST-WEEKLY': (data) => formatWeeklyTasksStat(data.week_items, PREMIUM === "true"),
  'TODO-IST-TOTAL': (data) => formatTotalTasksStat(data.completed_count),
  'TODO-IST-CURRENT-STREAK': (data) => formatCurrentStreakStat(data.goals),
  'TODO-IST-LONGEST-STREAK': (data) => formatLongestStreakStat(data.goals)
};

function updateReadmeGranular(data, readmeContent) {
  let updated = readmeContent;
  let processedTags = [];

  for (const [tagName, formatter] of Object.entries(TAG_CONFIG)) {
    const startTag = `<!-- ${tagName}:START -->`;
    const endTag = `<!-- ${tagName}:END -->`;

    if (readmeContent.includes(startTag) && readmeContent.includes(endTag)) {
      const formattedStat = formatter(data);

      if (formattedStat !== null) {
        updated = replaceTag(updated, tagName, formattedStat);
        processedTags.push(tagName);
      } else {
        core.warning(`${tagName}: Stat unavailable (check premium status or API response)`);
      }
    }
  }

  if (processedTags.length > 0) {
    core.info(`Updated ${processedTags.length} stat(s): ${processedTags.join(', ')}`);
  } else {
    core.warning('No valid TODO-IST tags found in README');
  }

  return updated;
}
```

### Safe Tag Replacement
```javascript
// Replacement logic with validation
function replaceTag(content, tagName, newContent) {
  const startTag = `<!-- ${tagName}:START -->`;
  const endTag = `<!-- ${tagName}:END -->`;

  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag, startIndex);

  if (startIndex === -1) {
    core.warning(`${tagName}: Start tag not found`);
    return content;
  }

  if (endIndex === -1) {
    core.warning(`${tagName}: End tag not found (start tag exists)`);
    return content;
  }

  const endOfStartTag = startIndex + startTag.length;

  // Replace content between tags
  return [
    content.slice(0, endOfStartTag),
    '\n',
    newContent,
    '\n',
    content.slice(endIndex)
  ].join('');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All-in-one tag display | Granular individual stat tags | Phase 2 (this phase) | Users gain control over which stats appear and where. Maintains backward compatibility. |
| Hardcoded stat order | User-defined layout via tag placement | Phase 2 | Users can place karma at top, streaks at bottom, etc. More flexible README layouts. |
| Premium flag gates all premium features | Per-stat premium checks | Phase 1 already implemented | Better granularity: weekly tasks require premium, others don't. Clearer user messaging. |
| Silent failures on missing data | Defensive optional chaining (`?.`) | Phase 1 implemented | Prevents crashes when API response missing fields. Graceful degradation. |
| Fixed emoji | User customization of emoji (future) | Future consideration | Not in this phase. Complex to implement, low user demand. |

**Deprecated/outdated:**
- **All-or-nothing display:** Continuing to support for backward compatibility, but granular tags are preferred new pattern
- **Hardcoded committer identity:** Phase 3 will address this with GitHub actor detection
- **No current streak display:** Phase 2 adds this per STAT-04 requirement

## Open Questions

### 1. **Additional Streak Types**
- **What we know:** API provides `current_daily_streak` and `max_daily_streak` in `goals` object. Also has `current_weekly_streak` and `max_weekly_streak`.
- **What's unclear:**
  - Should we add weekly streak display tags?
  - Do users care about weekly streaks as much as daily?
  - Is weekly streak premium-only like weekly tasks?
- **Recommendation:** Implement daily streak tags first (requirement STAT-04, STAT-05). Add weekly streak as optional enhancement if users request it. Check API response for premium dependency during testing.

### 2. **Karma Trend Indicator**
- **What we know:** Old Sync API v9 had `karma_trend` field showing up/down movement.
- **What's unclear:** Does `/api/v1/tasks/completed/stats` endpoint include karma_trend?
- **Recommendation:** Check API response during Phase 2 testing. If available, add as enhancement (was listed in FEATURES.md as differentiator). If not available, defer to future or calculate trend locally by comparing current to previous run (requires state persistence).

### 3. **Empty Stats Display Strategy**
- **What we know:** Zero values possible (0 karma, 0 streak, 0 tasks today).
- **What's unclear:** Should we show encouraging message ("Start your streak today!") or just "0 days"? Different UX philosophy.
- **Recommendation:** Show actual zero value with optional encouraging context for streaks specifically. Karma/tasks show "0" plainly. Test with users for feedback.

### 4. **Tag Name Conventions**
- **What we know:** SiddharthShyniben fork uses 18+ tags with names like `TODO-IST:KARMA`, `TODO-IST:STREAK`.
- **What's unclear:** Should we use colon (`:`) or hyphen (`-`) as separator? `TODO-IST:KARMA` vs `TODO-IST-KARMA`?
- **Recommendation:** Use hyphen (`TODO-IST-KARMA`) for consistency with existing `TODO-IST:START` pattern. Reserve colon for start/end markers. Makes parsing clearer: hyphen joins words, colon indicates action.

## Sources

### Primary (HIGH confidence)
- **Current Implementation:** `/workspace/index.js` lines 40-96 - Working Phase 1 implementation with API response structure verified
- **API Endpoint Documentation:** Comment in index.js line 43 references official Todoist API docs
- **Humanize-plus Library:** npm package (verified in package.json), used for number formatting
- **Competitor Pattern:** SiddharthShyniben/todoist-readme fork documented in FEATURES.md with 18+ custom tag examples

### Secondary (MEDIUM confidence)
- **Similar Actions:** WakaTime-based README actions use similar tag patterns (`<!-- WAKATIME:START -->`) - validates approach
- **GitHub Actions Patterns:** Standard pattern across ecosystem for README injection (high confidence in user familiarity)
- **Todoist API Response:** Verified structure through Phase 1 verification (karma, completed_count, days_items, week_items, goals)

### Tertiary (LOW confidence - needs verification)
- **Karma trend field:** Mentioned in FEATURES.md from v9 API research, need to verify availability in v1 endpoint response
- **Weekly streak availability:** Assumed similar to weekly tasks (premium-only), requires testing to confirm
- **User preferences:** Tag customization demand inferred from SiddharthShyniben fork existence, no direct user survey data

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH - All tools already in use, proven working. No new dependencies. Simple string manipulation.
- **Architecture:** HIGH - Dual-mode pattern is standard compatibility approach. Individual stat formatters enable reuse. Tag replacement is straightforward string manipulation.
- **Pitfalls:** HIGH - Based on actual Phase 1 implementation review, existing code patterns, and common GitHub Actions failure modes.
- **Requirements:** HIGH - All requirements (STAT-01 through STAT-07) achievable with existing API response structure and proposed implementation.

**Research date:** 2026-02-11
**Valid until:** 2026-03-15 (30 days - stable requirements, implementation straightforward)

**Critical dependencies:**
1. Phase 1 verified working - API connection and basic stats display functional
2. API response structure stable - karma, days_items, week_items, completed_count, goals all present
3. Backward compatibility mandatory - existing users with legacy tags must continue working

**Ready for planning:** Yes - Clear implementation path, no blockers, all requirements addressable with existing stack and proven patterns.
