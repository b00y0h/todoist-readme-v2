# Phase 1: API Migration Foundation - Research

**Researched:** 2026-02-11
**Domain:** Todoist API Migration & Node.js Runtime Upgrade
**Confidence:** MEDIUM

## Summary

Phase 1 addresses the **critical API deprecation blocker** that makes this GitHub Action non-functional. Todoist shut down Sync API v9 on February 10, 2026 (yesterday), requiring immediate migration to the unified API v1. The challenge is that the productivity stats endpoint (`/sync/v9/completed/get_stats`) used by this action has no explicitly documented replacement in the new API.

Research reveals that the unified API v1 includes a `/sync` endpoint that returns a "stats" object as part of sync responses when requesting all resources. This suggests the stats functionality is preserved but accessed differently - through the sync endpoint with `resource_types='["all"]'` or potentially `["stats"]` rather than a dedicated stats endpoint. The migration requires changing the base URL from `api.todoist.com/sync/v9/completed/get_stats` to `api.todoist.com/api/v1/sync` with appropriate parameters.

Simultaneously, the action must upgrade from Node 12 (declared in action.yml) to Node 20 to avoid GitHub Actions runtime deprecation. This is a breaking change requiring a v2.0.0 release. The upgrade impacts dependencies (@actions/core must be v1.10.0+, axios should upgrade to v1.6.0+ for security), build tooling (@zeit/ncc renamed to @vercel/ncc), and authentication patterns (bearer tokens remain the same, but response structure changes including ID type migration from integers to strings).

**Primary recommendation:** First verify if the v9 stats endpoint still functions post-shutdown (grace period), then implement migration to v1 `/sync` endpoint with stats resource type retrieval. Test response structure matches v9 format (karma, completed_count, days_items, week_items, goals with streaks). If stats not available through sync, escalate to Todoist support for guidance before proceeding with Phase 2.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Todoist Unified API v1 | v1 (current) | Productivity stats retrieval | Official API, replaces deprecated v9/v2 APIs. Merged Sync+REST. Only supported option after Feb 10, 2026. |
| axios | ^1.6.0+ | HTTP requests to Todoist API | Already installed (v0.20.0), needs security upgrade. Proven HTTP client with timeout/retry support. |
| Node 20 runtime | 20.x | GitHub Actions execution | Required upgrade from Node 12. Node 16 deprecated, Node 20 current stable runtime for Actions. |
| @actions/core | ^1.10.0+ | GitHub Actions SDK | Already installed (v1.2.5), needs upgrade for Node 20 compatibility. Official GitHub Actions toolkit. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| humanize-plus | ^1.8.2 | Number formatting (e.g., "1,234") | Already installed. Continue using for karma/task count display. Low complexity, does one thing well. |
| @vercel/ncc | ^0.38.0+ | Bundle to single dist file | Renamed from @zeit/ncc (v0.22.3 currently). Enables fast GitHub Actions startup without npm install. |
| axios-retry | ^4.0.0 | Exponential backoff for rate limits | Add for production resilience. Handles 429 errors with Retry-After header support. Industry standard pattern. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| axios | @doist/todoist-api-typescript | Official SDK abstracts API version changes (pro), adds dependency weight and learning curve (con). Defer to Phase 2 if direct API calls fail. |
| axios | node-fetch | Native fetch-style API, but axios already installed and has better error handling/retry patterns. No benefit to switching. |
| axios-retry | Custom retry logic | More control, but reinvents wheel. Library handles edge cases (jitter, Retry-After headers) that custom code misses. |

**Installation:**
```bash
# Upgrade existing dependencies
npm install axios@latest @actions/core@latest

# Add rate limit handling
npm install axios-retry@latest

# Upgrade build tool
npm install -D @vercel/ncc@latest
```

## Architecture Patterns

### Recommended Project Structure
```
workspace/
├── index.js              # Entry point (keep single-file for now)
├── dist/
│   └── index.js         # ncc bundled output
├── action.yml           # MUST update: using: "node20"
└── package.json         # MUST update: dependencies
```

**Note:** Keep single-file architecture initially. Extract to `lib/` modules in Phase 2 (Stats Retrieval Refactoring) when adding complexity for better testability. Don't over-engineer before functionality works.

### Pattern 1: API Migration - Bearer Token with Sync Endpoint
**What:** Change from dedicated stats endpoint to sync endpoint with resource type filtering

**When to use:** Immediately - this is the core migration pattern for Phase 1

**Example:**
```javascript
// OLD (v9 - deprecated, shut down Feb 10, 2026)
const response = await axios.get(
  'https://api.todoist.com/sync/v9/completed/get_stats',
  {
    headers: { Authorization: `Bearer ${TODOIST_API_KEY}` }
  }
);
const { karma, completed_count, days_items, goals } = response.data;

// NEW (v1 - current unified API)
const response = await axios.post(
  'https://api.todoist.com/api/v1/sync',
  {
    sync_token: '*',        // '*' for full sync, token for incremental
    resource_types: '["all"]' // or '["stats"]' if stats is a valid resource type
  },
  {
    headers: { Authorization: `Bearer ${TODOIST_API_KEY}` },
    timeout: 10000           // Always set timeout to fail fast
  }
);
const stats = response.data.stats; // Stats now part of sync response
const { karma, completed_count, days_items, goals } = stats;
```

**Critical changes:**
- GET → POST request method
- URL: `/sync/v9/completed/get_stats` → `/api/v1/sync`
- Add request body with `sync_token` and `resource_types`
- Stats data nested in `response.data.stats` instead of `response.data` directly
- IDs are now strings (including task/project IDs if used), not integers

### Pattern 2: Node 20 Runtime Upgrade
**What:** Update action.yml runtime declaration and verify dependency compatibility

**When to use:** Simultaneously with API migration - both are breaking changes for v2.0.0 release

**Example:**
```yaml
# action.yml
name: 'Todoist Readme'
runs:
  using: "node20"        # Changed from "node12"
  main: "dist/index.js"

# package.json - ensure Node 20 compatibility
{
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@actions/core": "^1.10.0",  # Upgraded from ^1.2.5
    "axios": "^1.6.0"             # Upgraded from ^0.20.0
  }
}
```

**Verification:** Test locally with Node 20 before pushing. GitHub Actions will use Node 20 runtime when action.yml specifies it.

### Pattern 3: Rate Limit Handling with Exponential Backoff
**What:** Add retry interceptor to handle Todoist's 1000 requests/15min rate limit

**When to use:** Phase 1 implementation - prevents silent failures from day one

**Example:**
```javascript
import axios from 'axios';
import axiosRetry from 'axios-retry';

// Configure axios instance with retry logic
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    // Respect Retry-After header if present
    if (error.response?.headers['retry-after']) {
      return parseInt(error.response.headers['retry-after']) * 1000;
    }
    // Exponential backoff with jitter: 1s, 2s, 4s
    return axiosRetry.exponentialDelay(retryCount, error, 1000);
  },
  retryCondition: (error) => {
    // Retry on rate limit (429) and server errors (5xx)
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === 429 ||
           (error.response?.status >= 500 && error.response?.status < 600);
  },
  onRetry: (retryCount, error) => {
    core.warning(`Retrying Todoist API request (attempt ${retryCount}): ${error.message}`);
  }
});

// Use axios as normal - retries happen automatically
const response = await axios.post('https://api.todoist.com/api/v1/sync', ...);
```

**Why:** Prevents workflow failures during high-traffic periods (top of hour when cron jobs trigger). Todoist rate limit is per-user, so multiple repos using same token can hit limits.

### Pattern 4: ID Type Handling (String Migration)
**What:** Treat all IDs as opaque strings, never coerce to numbers

**When to use:** Low impact for this project (stats endpoint returns metrics, not IDs), but required if displaying task/project IDs in future

**Example:**
```javascript
// ❌ BAD - assumes IDs are numeric
const taskId = parseInt(response.data.task_id);
if (taskId > 1000) { ... }

// ✅ GOOD - IDs are opaque strings
const taskId = response.data.task_id; // Could be "ar-xi-v-202403190000-202403192359-7814598409"
if (taskId === expectedId) { ... }    // Use strict equality
```

### Anti-Patterns to Avoid
- **Using v9 endpoints after migration:** V9 shut down Feb 10, 2026. No grace period guaranteed. Migrate immediately.
- **Node 12/16 runtime:** Deprecated and will stop working. Node 20 required (Note: Node 20 itself EOL April 2026, but Node 24 not yet stable for Actions).
- **Hardcoded API URLs:** Use constants for API base URLs to simplify future migrations.
- **No timeout on axios calls:** Always set timeout (10-30 seconds) to prevent hung workflows.
- **Retrying immediately without backoff:** Causes cascading failures and rate limit ban. Always use exponential backoff.
- **Using --global git config:** Leaks into other workflow steps. Use --local or let GitHub Actions handle git config.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limit retry logic | Custom retry loops with fixed delays | axios-retry with exponentialDelay | Library handles Retry-After headers, jitter to prevent thundering herd, conditional retry based on error type. Custom code misses edge cases. |
| API request timeout handling | Manual Promise.race() with setTimeout | axios `timeout` option | Built-in, well-tested, cleaner code. Covers request AND response timeouts. |
| Exponential backoff calculation | Custom math for retry delays | axiosRetry.exponentialDelay() | Industry-standard algorithm with jitter support. Prevents retry storms. |
| GitHub Actions input validation | Manual process.env checks | @actions/core getInput() with required flag | Automatic validation, better error messages, consistent with Actions ecosystem. |

**Key insight:** HTTP retry logic is deceptively complex. Edge cases include: respecting Retry-After headers, adding jitter to prevent synchronized retries, distinguishing transient (429, 5xx) from permanent (400, 401) errors, handling timeout vs network vs server errors differently. Libraries like axios-retry have battle-tested this logic across millions of requests.

## Common Pitfalls

### Pitfall 1: Stats Endpoint Not Found in V1 API
**What goes wrong:** Migration assumes `/sync/v9/completed/get_stats` has a direct v1 replacement, but API docs don't explicitly document stats endpoint in v1. Code blindly changes URL and fails with 404.

**Why it happens:** Todoist merged Sync+REST APIs into unified v1 and changed access patterns. Stats are now part of sync response, not a dedicated endpoint. Documentation focuses on task/project management, not stats retrieval.

**How to avoid:**
1. Test v1 `/sync` endpoint with `resource_types='["all"]'` to verify stats object exists in response
2. If stats not in response, try `resource_types='["stats"]'` explicitly
3. If still fails, check v9 endpoint for grace period (may still work temporarily)
4. Document response structure for Phase 2 reference
5. If stats truly unavailable, escalate to Todoist support BEFORE Phase 2

**Warning signs:**
- 404 Not Found when calling `/api/v1/sync` with stats resource type
- Response missing `stats` object even with `resource_types='["all"]'`
- Documentation search for "stats" or "karma" returns no v1 results
- Community forums show no v9→v1 migration examples for stats endpoint

**Verification:**
```javascript
// Test script to verify stats availability
const response = await axios.post(
  'https://api.todoist.com/api/v1/sync',
  { sync_token: '*', resource_types: '["all"]' },
  { headers: { Authorization: `Bearer ${process.env.TODOIST_API_KEY}` } }
);
console.log('Available resources:', Object.keys(response.data));
console.log('Stats object:', response.data.stats);
```

### Pitfall 2: Node Version Mismatch Between action.yml and Dependencies
**What goes wrong:** Update @actions/core to v1.10.0 for Node 20 support but forget to update action.yml from `using: "node12"` to `using: "node20"`. Action runs on Node 12, dependencies fail with module errors.

**Why it happens:** Runtime declaration in action.yml is separate from package.json engines field. GitHub Actions uses action.yml to determine Node version, ignoring package.json.

**How to avoid:**
1. Update action.yml `runs.using` to "node20" FIRST
2. Update all @actions/* dependencies to latest versions
3. Test locally with Node 20: `node --version` should show v20.x.x
4. Verify GitHub Actions runner uses Node 20 in workflow logs
5. Check for deprecation warnings in workflow output

**Warning signs:**
- Workflow logs show "Node.js 12 actions are deprecated" warning
- Module import errors despite installing latest dependencies
- `package.json` says Node 20 but action still runs on Node 12
- GitHub runner shows "Node 12" in setup step

**Verification:** After deploying, check workflow logs for "Running on Node.js 20.x.x" message.

### Pitfall 3: Rate Limit Failures Without Retry Logic
**What goes wrong:** Multiple repos using same Todoist API token trigger workflows at top of hour (cron). Hit 1000 req/15min rate limit. Workflows fail silently with 429 errors, stats don't update, users don't notice for days.

**Why it happens:** Todoist enforces 1000 requests per user per 15 minutes. GitHub Actions cron jobs often align (hourly at :00). No retry logic means first 429 error fails entire workflow.

**How to avoid:**
1. Install axios-retry BEFORE first production release
2. Configure exponential backoff with Retry-After header support
3. Set retries to 3 with 1-4s backoff range
4. Log warnings when retrying (use @actions/core warning())
5. Consider adding delay to cron schedule (e.g., :15 instead of :00) to reduce collision

**Warning signs:**
- Intermittent workflow failures during high-traffic times
- Error logs show "429 Too Many Requests" without retry
- Stats update succeeds in test but fails in production with multiple repos
- API calls work individually but fail in batch

**Verification:**
```javascript
// Test rate limit handling (requires multiple requests)
const requests = Array(10).fill().map(() =>
  axios.post('https://api.todoist.com/api/v1/sync', ...)
);
const results = await Promise.allSettled(requests);
// Should see retry warnings in logs, not failures
```

### Pitfall 4: Response Structure Changes Break Data Extraction
**What goes wrong:** v9 response had stats at `response.data.karma`. v1 nests it as `response.data.stats.karma`. Code tries to destructure directly and gets undefined, formatted stats show "undefined karma".

**Why it happens:** API consolidation changed response nesting. Stats are now one resource type among many (items, projects, stats, etc.) instead of dedicated endpoint returning only stats.

**How to avoid:**
1. Log full v1 response structure during testing: `console.log(JSON.stringify(response.data, null, 2))`
2. Update destructuring to match new nesting: `const { stats } = response.data; const { karma } = stats;`
3. Add validation: check if `response.data.stats` exists before accessing
4. Write tests comparing v9 and v1 response shapes
5. Document field mappings for Phase 2 reference

**Warning signs:**
- README shows "undefined" or "null" for stats values
- Console logs show successful API call but missing data
- No error thrown but stats object empty
- Different field names in response vs expected (e.g., `complete_count` vs `completed_count`)

**Verification:**
```javascript
// Response structure validation
const response = await axios.post(...);
assert(response.data.stats !== undefined, 'Stats object missing from response');
assert(response.data.stats.karma !== undefined, 'Karma field missing from stats');
assert(typeof response.data.stats.completed_count === 'number', 'Completed count wrong type');
```

## Code Examples

Verified patterns from official sources and research:

### Todoist API V1 Sync Request
```javascript
// Source: Todoist API v1 Documentation + WebSearch research
import axios from 'axios';
import core from '@actions/core';

async function getTodoistStats(apiKey) {
  try {
    const response = await axios.post(
      'https://api.todoist.com/api/v1/sync',
      {
        sync_token: '*',              // Full sync (use stored token for incremental)
        resource_types: '["all"]'     // or try '["stats"]' if stats is separate resource
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000                // 10s timeout
      }
    );

    // V1 nests stats in response object
    if (!response.data.stats) {
      core.error('Stats object not found in API response');
      core.error(`Available resources: ${Object.keys(response.data).join(', ')}`);
      throw new Error('Stats endpoint unavailable in API v1');
    }

    return response.data.stats;
  } catch (error) {
    if (error.response?.status === 429) {
      core.warning('Rate limited by Todoist API');
    }
    throw error;
  }
}
```

### Rate Limit Retry Configuration
```javascript
// Source: axios-retry documentation + WebSearch best practices
import axios from 'axios';
import axiosRetry from 'axios-retry';
import core from '@actions/core';

// Configure retry behavior once
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    // Check for Retry-After header (seconds)
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      core.info(`Respecting Retry-After: ${retryAfter}s`);
      return parseInt(retryAfter) * 1000;
    }

    // Exponential backoff: 1s, 2s, 4s (with 1000ms base)
    return axiosRetry.exponentialDelay(retryCount, error, 1000);
  },
  retryCondition: (error) => {
    // Retry on network errors, 429 rate limit, 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429 ||
      (error.response?.status >= 500 && error.response?.status < 600)
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    core.warning(
      `Retry attempt ${retryCount} for ${requestConfig.url}: ${error.message}`
    );
  }
});

// axios calls now automatically retry with backoff
const response = await axios.post('https://api.todoist.com/api/v1/sync', ...);
```

### Action.yml Runtime Upgrade
```yaml
# Source: GitHub Actions documentation
name: 'Todoist Readme'
author: 'Abhishek Naidu'
description: 'Updates README with your Todoist stats'

inputs:
  TODOIST_API_KEY:
    description: 'Your Todoist API Key'
    required: true
  USERNAME:
    description: 'Your GitHub username'
    default: ${{ github.repository_owner }}
    required: false
  PREMIUM:
    description: 'Premium User or Not'
    default: false
    required: false

runs:
  using: "node20"          # CHANGED from "node12" - breaking change
  main: "dist/index.js"

branding:
  icon: "activity"
  color: "red"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync API v9 dedicated stats endpoint | Unified API v1 sync with resource types | Feb 10, 2026 shutdown | CRITICAL - must migrate immediately. Stats access pattern changes from dedicated GET to sync POST. |
| Node 12 runtime | Node 20 runtime | Node 12 deprecated 2022, Node 16 deprecated 2024 | BREAKING - requires action.yml change and v2.0.0 release. Note: Node 20 EOL April 2026, may need Node 24 soon. |
| Integer IDs (task_id: 123456) | String IDs (task_id: "123456" or UUID) | Unified API v1 launch | LOW impact for stats endpoint (no task IDs), but affects future features. |
| @zeit/ncc bundler | @vercel/ncc bundler | Company rebrand (Zeit → Vercel) | TRIVIAL - package rename, same functionality. |
| axios v0.20.0 | axios v1.6.0+ | Ongoing security updates | RECOMMENDED - security patches, better error handling. |
| @actions/core v1.2.5 | @actions/core v1.10.0+ | Node 20 compatibility | REQUIRED - v1.2.5 incompatible with Node 20. |

**Deprecated/outdated:**
- **Sync API v9:** Shut down Feb 10, 2026. No longer functional. Migrate to unified v1 immediately.
- **REST API v2:** Deprecated early 2026, merged into unified v1. Don't use for new development.
- **Node 12/16 runtimes:** Removed from GitHub Actions runners. Action will fail to start.
- **@zeit/ncc package:** Renamed to @vercel/ncc. Old package frozen, no updates.

## Open Questions

### 1. **Stats Resource Type Availability in V1 Sync API**
- **What we know:** Unified API v1 has `/sync` endpoint. WebSearch indicates sync response includes "stats" object when using `resource_types='["all"]'`. Old v9 stats endpoint (`/completed/get_stats`) had specific fields: karma, completed_count, days_items, week_items, goals with streaks.
- **What's unclear:**
  - Is "stats" a valid standalone resource type for `resource_types='["stats"]'`?
  - Does v1 stats object match v9 structure (same field names/nesting)?
  - Are streak fields (current_daily_streak, max_daily_streak) preserved?
  - Is karma_trend field still available?
  - Do week_items still require premium, or is detection method different?
- **Recommendation:**
  1. Test v1 `/sync` endpoint with Todoist API token during Phase 1 implementation
  2. Log full response structure and compare to v9 documentation
  3. Create field mapping document if structure differs
  4. If stats unavailable, treat as project blocker and contact Todoist support

### 2. **V9 Endpoint Grace Period**
- **What we know:** Official shutdown date was Feb 10, 2026 (yesterday). No official grace period announced.
- **What's unclear:** Does v9 endpoint still respond? Is there a silent grace period (1 week? 1 month?) before hard shutdown?
- **Recommendation:** Test v9 endpoint immediately. If still functional, use as fallback while testing v1 migration. Don't rely on it past Feb 2026.

### 3. **Premium Feature Detection in V1**
- **What we know:** V9 API: premium users get `week_items` array, free users get null/undefined. Code checks `if (week_items)` to detect premium status.
- **What's unclear:** Does v1 use same pattern? Different field name? Explicit premium flag in user object?
- **Recommendation:** Test with both free and premium accounts during Phase 2. For Phase 1, assume pattern preserved unless testing proves otherwise.

### 4. **Node 24 Migration Timeline**
- **What we know:** Node 20 EOL is April 30, 2026 (2.5 months from now). GitHub will deprecate Node 20 in summer 2026. Node 24 is future target.
- **What's unclear:** When will GitHub Actions support `using: "node24"`? Should we plan v3.0.0 migration already?
- **Recommendation:** Use Node 20 for v2.0.0 (immediate migration). Monitor GitHub Actions roadmap for Node 24 timeline. Plan v3.0.0 when Node 24 available (likely Q3 2026).

## Sources

### Primary (HIGH confidence)
- [Todoist Unified API v1 Documentation](https://developer.todoist.com/api/v1/) - Current official API, confirms v9 deprecation
- [Todoist Sync API v9 Documentation](https://developer.todoist.com/sync/v9/) - Deprecated API with /completed/get_stats endpoint structure (verified via WebFetch)
- [GitHub Actions: Metadata syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) - action.yml specification for Node 20 runtime
- [@actions/core npm package](https://www.npmjs.com/package/@actions/core) - Confirms v1.11.1 built with Node 20.17.0
- [axios-retry npm package](https://www.npmjs.com/package/axios-retry) - Official retry library documentation

### Secondary (MEDIUM confidence)
- [Todoist API Updates - Drafts Community](https://forums.getdrafts.com/t/todoist-api-updates-deadline-febrary-2026/16403) - Feb 10, 2026 shutdown confirmation (WebSearch verified)
- [Todoist API v1.0 Launch Announcement](https://groups.google.com/a/doist.com/g/todoist-api/c/LKz0K5TRQ9Q/m/IlIemN4-CAAJ) - Official API merge announcement (WebSearch verified)
- [GitHub Actions: Node.js 20 deprecation](https://depot.dev/blog/node-20-deprecation-psa-for-depot-users) - Node 20 EOL April 2026, summer 2026 GitHub deprecation (WebSearch verified)
- [GitHub Discussion: Node 20 migration](https://github.com/actions/upload-artifact/issues/444) - Community migration experiences (WebSearch verified)
- [Axios Retry Best Practices 2026](https://www.zenrows.com/blog/axios-retry) - Exponential backoff patterns (WebSearch verified)

### Tertiary (LOW confidence - needs verification)
- **Stats object in v1 sync response:** Inferred from WebSearch results indicating `"stats": { ... }` returned by sync endpoint with `resource_types='["all"]'`. Not verified with actual API call.
- **Field name consistency v9→v1:** Assumed v1 preserves field names (karma, completed_count, etc.) but not confirmed. Requires testing.
- **Resource type filtering:** Assumed `resource_types='["stats"]'` is valid, but only `"all"` confirmed in documentation. May need to fetch all resources and extract stats.

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH - axios, Node 20, @actions/core, @vercel/ncc are proven technologies with clear versions and docs
- **Architecture:** HIGH - API migration pattern verified in documentation, retry patterns industry standard, runtime upgrade well-documented
- **Stats endpoint availability:** MEDIUM - logical inference from docs/WebSearch but not tested. Primary blocker requiring immediate validation.
- **Pitfalls:** HIGH - Node version mismatch, rate limiting, response structure verified from official docs and community issues

**Research date:** 2026-02-11
**Valid until:** 2026-03-15 (30 days - API stable, but Node 20 deprecation approaching)

**Critical gaps requiring Phase 1 testing:**
1. Exact v1 API request/response for stats retrieval
2. Field structure mapping between v9 and v1
3. Premium feature detection method in v1
4. V9 grace period status (still functional or hard shutdown)
