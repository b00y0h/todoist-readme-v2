# Technology Stack

**Project:** Todoist README GitHub Action Migration
**Researched:** 2026-02-11
**Confidence:** HIGH

## Recommended Stack

### Core API

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Todoist Sync API v9 | v9 (deprecated) | Current productivity stats retrieval | Currently implemented, still functional until Feb 10, 2026. **MUST migrate before shutdown date.** |
| Todoist Unified API | v1 (current) | Future-proof API access | Merged Sync and REST APIs. Official replacement for deprecated v9/v2 APIs. Supports webhooks, better error handling, pagination. |

### HTTP Client

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | ^0.20.0+ | HTTP requests to Todoist API | Already installed. Works with both v9 and v1 APIs. Upgrade to latest (^1.6.0+) recommended for security. |
| node-fetch | ^3.0.0+ | Alternative HTTP client | If you prefer native fetch-style API. Not needed if keeping axios. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| humanize-plus | ^1.8.2 | Number formatting (e.g., "1,234") | Already installed. Continue using for karma/task counts. |
| @actions/core | ^1.2.5+ | GitHub Actions SDK | Already installed. Upgrade to latest (^1.10.0+) recommended. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @zeit/ncc | Bundle Node.js to single file | Already configured. Consider upgrading to @vercel/ncc (renamed). |

## Critical API Migration Details

### Current Implementation (Sync API v9)

**Endpoint:** `https://api.todoist.com/sync/v9/completed/get_stats`

**Authentication:** Bearer token in Authorization header

**Status:** **Deprecated - Shuts down February 10, 2026**

**Data Retrieved:**
- `karma` - Current karma score
- `completed_count` - Total tasks completed all-time
- `days_items[0].total_completed` - Tasks completed today
- `week_items[0].total_completed` - Tasks completed this week (premium only)
- `goals.max_daily_streak.count` - Longest daily streak

### Migration Path

**Problem:** The `/completed/get_stats` endpoint exists **ONLY in Sync API v9**. There is **NO direct equivalent** in the new unified API v1 as of February 2026.

**Evidence:**
- REST API v2 documentation explicitly states it has no productivity/stats endpoints
- Unified API v1 documentation shows `update_goals` command but no `get_stats` retrieval
- Community discussions confirm stats endpoint is Sync-API-only feature

**Confidence Level:** MEDIUM - Official docs confirm v9 deprecation and v1 existence, but lack of replacement endpoint for stats is concerning. Needs validation with Todoist support.

### Migration Options

#### Option 1: Continue Using Sync API v9 via Unified API v1 (RECOMMENDED)

The unified API v1 **includes a `/sync` endpoint** that maintains backward compatibility with Sync API functionality.

**New Base URL:** `https://api.todoist.com/api/v1/sync`

**Endpoint Pattern:** Commands sent to `/sync` endpoint (similar to v9 architecture)

**Rationale:**
- Unified API v1 states: "special endpoint called /sync, which is used by first-party clients"
- "Anyone can use it, and some actions will only be available via /sync"
- This suggests stats endpoint likely accessible via new `/sync` endpoint

**Migration Steps:**
1. Change base URL from `sync/v9/completed/get_stats` to `api/v1/sync` + appropriate command
2. Update request format to use commands structure if needed
3. Verify response structure (IDs changed from integers to strings)
4. Test thoroughly before v9 shutdown

**Confidence:** MEDIUM - Logical inference from documentation, but needs practical verification.

#### Option 2: Use Official Todoist SDK

**Library:** `@doist/todoist-api-typescript`

**Rationale:**
- Official SDK from Todoist team
- Automatically handles API version changes
- Better TypeScript support
- Maintained by Todoist (more future-proof)

**Migration Impact:**
- Moderate code refactor required
- Adds dependency but reduces maintenance burden
- SDK may abstract stats endpoint access

**Confidence:** HIGH - Official SDK recommended by Todoist for v1 migration.

#### Option 3: Aggregate Data from Individual Endpoints

**Fallback if stats endpoint unavailable:**
- Use `/rest/v2/tasks` to fetch completed tasks
- Calculate stats client-side
- Use user endpoint for karma/goals

**Rationale:** Manual aggregation if no stats endpoint exists

**Why NOT Recommended:**
- Significantly more API calls (rate limiting concerns)
- Complex client-side logic
- No historical streak data available
- Performance overhead
- Increased maintenance

**Confidence:** HIGH - Technically feasible but impractical.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Sync API v9 base URL | Shuts down Feb 10, 2026 | Unified API v1 `/sync` endpoint |
| REST API v2 | Deprecated, replaced by unified v1 | Unified API v1 |
| Old Todoist Python SDK | Officially deprecated/shutdown | @doist/todoist-api-typescript or unified API v1 |
| Sync API v8 | Removed Oct 31, 2022 | N/A - long gone |
| Token in URL query param | Old auth method from v8 | Bearer token in Authorization header |

## Authentication

**Current (Works with both v9 and v1):**
```javascript
headers: {
  Authorization: `Bearer ${TODOIST_API_KEY}`
}
```

**No change needed** - Bearer token authentication carries forward to v1.

## Data Structure Changes

### ID Type Change (v9 → v1)

**Critical Breaking Change:** All IDs changed from integers to strings.

**Impact:** Low for this project (stats endpoint returns mostly numeric metrics, not IDs)

**Example:**
```javascript
// v9
project_id: 123456

// v1
project_id: "123456"
```

**Action Required:** Type checking if code assumes numeric IDs.

## Installation

```bash
# Current dependencies (keep)
npm install axios@latest humanize-plus @actions/core@latest

# Option 1: No new dependencies (use direct API calls)
# Keep axios, update endpoint URLs

# Option 2: Use official SDK
npm install @doist/todoist-api-typescript

# Development
npm install -D @vercel/ncc  # Upgraded from @zeit/ncc
```

## Migration Priority: URGENT

**Timeline:**
- **Today:** February 11, 2026 (1 day after v9 shutdown!)
- **Status:** Migration is **OVERDUE** - v9 may stop working any moment

**Immediate Action Required:**
1. Test if current endpoint still works
2. Find replacement in unified API v1
3. Implement migration ASAP
4. Deploy before complete shutdown

## Research Gaps

**Critical Questions Requiring Validation:**

1. **Stats Endpoint in v1:** What is the exact endpoint/command to retrieve productivity stats in unified API v1?
   - Needs: Direct test or Todoist support confirmation
   - Risk: May not exist, requiring fallback approach

2. **Response Format:** Does v1 stats response match v9 structure?
   - Needs: API testing with real account
   - Risk: Breaking changes in field names/structure

3. **Premium Features:** Does week_items still require premium in v1?
   - Needs: Documentation review or testing
   - Risk: Feature availability changes

## Recommended Next Steps

1. **Immediate:** Check Todoist developer forums/GitHub issues for v9→v1 stats migration examples
2. **Immediate:** Test current endpoint to see if it still works post-Feb 10
3. **Priority:** Contact Todoist support: "How do I get productivity stats in unified API v1?"
4. **Priority:** Review official migration guide: `https://developer.todoist.com/api/v1#tag/Migrating-from-v9`
5. **Alternative:** Install `@doist/todoist-api-typescript` and check if it exposes stats methods

## Sources

**High Confidence (Official Documentation):**
- [Todoist Unified API v1](https://developer.todoist.com/api/v1/) - Current API documentation
- [Todoist Sync API v9](https://developer.todoist.com/sync/v9/) - Deprecated API (contains get_stats endpoint docs)
- [Todoist REST API v2](https://developer.todoist.com/rest/v2/) - Deprecated API (confirms no stats endpoints)

**Medium Confidence (Community/Third-Party):**
- [Todoist API Updates - Drafts Community](https://forums.getdrafts.com/t/todoist-api-updates-deadline-febrary-2026/16403) - Feb 10, 2026 shutdown date
- [Todoist API Changes - Drafts Community](https://forums.getdrafts.com/t/todoist-api-changes/16352) - Migration discussion
- [GitHub n8n Issue #4430](https://github.com/n8n-io/n8n/issues/4430) - Third-party migration experiences
- [Todoist API v1.0 Announcement](https://groups.google.com/a/doist.com/g/todoist-api/c/LKz0K5TRQ9Q/m/IlIemN4-CAAJ) - Official launch announcement

**Low Confidence (Inferred):**
- Sync endpoint availability in v1 based on documentation mentions, not practical testing

---
*Stack research for: Todoist API Migration*
*Researched: 2026-02-11*
*Researcher Note: Migration is URGENT - v9 shutdown date was yesterday (Feb 10, 2026). Immediate testing/migration required.*
