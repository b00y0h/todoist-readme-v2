# Project Research Summary

**Project:** Todoist README GitHub Action Migration
**Domain:** GitHub Actions - README Automation
**Researched:** 2026-02-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project involves migrating an existing GitHub Action that displays Todoist productivity statistics in user README files. The action currently uses Todoist's deprecated Sync API v9, which shut down February 10, 2026 (yesterday), creating an **urgent migration crisis**. The migration is complicated by a critical blocker: the productivity statistics endpoint (`/completed/get_stats`) exists only in Sync API v9, and there is no documented equivalent in the new unified API v1.

The recommended approach is to immediately test if the v9 stats endpoint still functions post-deprecation, then migrate to the unified API v1's `/sync` endpoint (which maintains backward compatibility with some Sync API features). Simultaneously, modernize the action by updating to Node 20 runtime, extracting hardcoded git credentials, and refactoring the codebase for maintainability. The GitHub Actions architecture itself is sound—the fetch-transform-persist pipeline pattern fits this use case perfectly and doesn't require major redesign.

The key risk is that productivity stats may be unavailable in the new API, requiring either a fallback to manual calculation (complex, loses karma data) or contact with Todoist support to confirm the migration path. Secondary risks include breaking changes from ID type mismatches (integers→strings), rate limiting without retry logic, and marketplace publishing pitfalls. Mitigation involves phased migration starting with critical API connectivity, followed by feature restoration, then polish for marketplace publication.

## Key Findings

### Recommended Stack

**Current implementation** uses deprecated Todoist Sync API v9 with axios for HTTP requests, humanize-plus for number formatting, and @actions/core for GitHub Actions integration. The action bundles with @zeit/ncc (now @vercel/ncc) and runs on Node 12 (deprecated).

**Core technologies:**
- **Todoist Unified API v1**: Official replacement for v9/v2 APIs — supports `/sync` endpoint that may preserve stats functionality
- **axios (^1.6.0+)**: HTTP client for API calls — already installed, just needs version upgrade for security
- **Node 20 runtime**: Current stable GitHub Actions runtime — required upgrade from Node 12/16 which are deprecated
- **@vercel/ncc**: Dependency bundler for fast action startup — renamed from @zeit/ncc, prevents npm install overhead
- **@actions/core (^1.10.0+)**: GitHub Actions SDK — needs upgrade to support Node 20

**Critical version requirement:** Node 20 in action.yml is mandatory (Node 16 deprecated, will stop working). API migration from v9 to v1 is also mandatory (v9 shutdown date passed).

**Migration confidence:** MEDIUM — Official docs confirm v9 deprecation and v1 existence, but the critical `/completed/get_stats` endpoint has no documented v1 replacement. The unified API v1 mentions a `/sync` endpoint "used by first-party clients" which may preserve stats access, but this requires practical verification.

### Expected Features

**Must have (table stakes):**
- Karma points display — core Todoist feature users actively track
- Daily tasks completed — immediate progress feedback
- Total completed tasks count — all-time achievement metric
- Current daily streak — gamification/motivation element
- Longest streak record — personal best tracking
- Auto-update on schedule — set-and-forget automation via GitHub Actions cron
- README tag-based injection — non-invasive updates using HTML comment markers

**Should have (competitive differentiators):**
- Customizable stats tags — 18+ custom tags for granular layout control (from SiddharthShyniben fork)
- Karma trend indicator — shows up/down movement (available in Sync API `karma_trend` field)
- Streak start/end dates — contextualizes streak duration beyond just count
- Weekly tasks display — with graceful fallback for non-premium users if possible

**Defer (v2+):**
- SVG card support — pretty formatted cards vs plain text (high complexity)
- Multiple themes — similar to github-readme-stats rendering
- Karma activity log — recent karma changes with reasons
- Multi-language README support

**Critical blocker:** All stats features depend on finding a working stats data source in the new API. The v9 `/completed/get_stats` endpoint provided karma, completed_count, daily/weekly breakdowns, and streak data in a single call. If this isn't available in v1, either through the `/sync` endpoint or an alternative, features must be calculated client-side (losing karma data entirely) or the project cannot proceed without Todoist support intervention.

### Architecture Approach

The existing single-file architecture with fetch-transform-persist pipeline is appropriate for this use case. No major redesign needed, just refactoring for clarity and maintainability.

**Major components:**
1. **API Integration Layer** — HTTP client (axios), bearer token auth, Todoist endpoint management. Extract to `lib/todoist-client.js` to isolate API version changes.
2. **Data Transformation Layer** — Extract stats from API response, format to markdown with emoji, humanize numbers. Extract to `lib/stats-formatter.js` for testing.
3. **README Template Processor** — Locate HTML comment markers (`<!-- TODO-IST:START -->`), inject formatted stats, detect changes. Extract to `lib/readme-updater.js`.
4. **Git Automation Layer** — Configure git identity (auto-detect from GitHub actor, not hardcoded), stage/commit/push changes. Refactor to `lib/git-committer.js` and remove hardcoded credentials.

**Key patterns:**
- **Fetch-Transform-Persist Pipeline**: Linear data flow (API → formatting → file write → git commit) perfect for single-purpose automation
- **HTML Comment Marker Template**: Safe content injection that preserves user's surrounding content
- **Git Committer Auto-Detection**: Use `GITHUB_ACTOR` and `GITHUB_ACTOR_ID` environment variables instead of hardcoded author
- **ncc Bundling**: Bundle dependencies into single `dist/index.js` for fast GitHub Actions startup

**Structure evolution:** Keep single-file pattern initially, extract to `lib/` modules during refactoring for better testability without over-engineering.

### Critical Pitfalls

1. **ID Type Mismatch (v9→v1)** — Sync API v9 used integer IDs (e.g., `7814598409`). Unified API v1 migrated ALL IDs to strings, including non-numeric formats like `ar-xi-v-202403190000-202403192359-7814598409`. **Avoid:** Treat all IDs as opaque strings, remove `parseInt()` or `Number()` coercion, use strict equality (===). **Impact:** Low for this project (stats endpoint returns metrics, not IDs), but must fix if using task/project IDs.

2. **Node.js Version Declaration Mismatch** — `action.yml` declares `using: "node12"` but GitHub deprecated Node 12 and Node 16. Actions stop running when runtime removed. **Avoid:** Update `action.yml` to `using: "node20"` and upgrade @actions/* dependencies to v4+. This is a MAJOR version breaking change requiring new release (v1→v2). **Critical:** Must happen in Phase 1 alongside API migration.

3. **Hardcoded Git Committer Credentials** — Current code hardcodes `"Abhishek Naidu"` and `"example@gmail.com"` causing commits from wrong author in users' repos. **Avoid:** Use `process.env.GITHUB_ACTOR` for name and `${GITHUB_ACTOR_ID}+${GITHUB_ACTOR}@users.noreply.github.com` for email. Use `--local` not `--global` git config to scope to current repo only.

4. **Major Version Tag Management** — Users pinned to `@v1` don't get bug fixes if v1 tag isn't force-pushed to new minor releases. **Avoid:** After publishing v2.1.0, force-push v2 tag: `git tag -fa v2 -m "Update v2 tag" && git push origin v2 --force`. Document versioning strategy before first release.

5. **Marketplace Publish Checkbox Missing** — GitHub silently fails to show "Publish to Marketplace" checkbox if: (a) file named `action.yaml` instead of `action.yml`, (b) Marketplace Developer Agreement not accepted, (c) workflow files in repo root, (d) action name conflicts, (e) repository not public, (f) 2FA not enabled. **Avoid:** Use `action.yml` filename, accept agreement before creating release, validate metadata shows "Everything looks good!"

6. **Rate Limiting Without Backoff** — Todoist limits 1000 requests per user per 15 minutes. Actions hitting 429 errors fail silently without retry. **Avoid:** Implement exponential backoff for 429 errors, respect Retry-After header, log rate limit warnings clearly.

7. **Archived Items Retrieval Missing** — Sync API v9 included completed items in standard sync. Unified API v1 requires separate `/archive/items` endpoint call. **Avoid:** If calculating stats client-side becomes necessary, fetch active + archived items separately and merge.

## Implications for Roadmap

Based on research, the migration requires 4 phases addressing urgent API migration first, then feature restoration, modernization, and finally publication.

### Phase 1: API Migration Foundation (URGENT)
**Rationale:** Migration deadline passed yesterday (Feb 10, 2026). V9 endpoints may stop working any moment. This phase establishes whether the project can proceed at all by resolving the critical stats endpoint blocker.

**Delivers:**
- Working connection to Todoist API (v1 or v9 endpoint still accessible)
- Node 20 runtime upgrade
- Basic authentication verification
- Confirmation that productivity stats are retrievable

**Addresses:**
- Must verify: Does `/sync/v9/completed/get_stats` still work post-deprecation?
- If not: Contact Todoist support for v1 stats endpoint guidance
- Alternative: Test unified API v1 `/sync` endpoint for stats access
- Fallback: Research if stats calculable from `/rest/v2/tasks` + `/archive/items`

**Avoids:**
- Pitfall #2: Node version mismatch (update action.yml to `using: "node20"`)
- Pitfall #1: ID type mismatch (if response includes IDs, handle as strings)
- Pitfall #8: Token leakage (security audit of logs/artifacts)

**Dependencies:** None — this is the foundation everything else depends on.

**Research Flag:** **HIGH PRIORITY** — This phase needs immediate research/testing before any implementation. Must discover actual stats endpoint in v1 API.

### Phase 2: Stats Retrieval Refactoring
**Rationale:** Once API connectivity works, restore all existing stats features with improved error handling and structure. Extract API client to isolate version-specific logic from business logic.

**Delivers:**
- All existing stats features working (karma, daily, weekly, total, streaks)
- Refactored API client module (`lib/todoist-client.js`)
- Error handling with retry logic for rate limits
- Premium feature detection with graceful degradation
- Response validation and data transformation

**Uses:**
- axios for HTTP requests with timeout configuration
- humanize-plus for number formatting
- Extracted stats-formatter module for testability

**Implements:**
- API Integration Layer (component from architecture research)
- Data Transformation Layer (component from architecture research)

**Avoids:**
- Pitfall #6: Rate limiting (implement exponential backoff for 429 errors)
- Pitfall #7: Archived items missing (if client-side calculation needed, fetch archives)
- Pitfall #3: No change detection (preserve existing behavior that skips commits when unchanged)

**Dependencies:** Phase 1 must confirm stats endpoint availability

**Research Flag:** MEDIUM — May need phase-specific research if stats calculation approach differs significantly from current v9 implementation.

### Phase 3: Git Operations Modernization
**Rationale:** Remove hardcoded credentials and improve git workflow to work correctly across all user repositories. This is independent of API changes and can be done in parallel with Phase 2.

**Delivers:**
- Auto-detected git committer (uses GITHUB_ACTOR)
- Refactored git automation module (`lib/git-committer.js`)
- Improved git config scoping (--local not --global)
- README template processor extraction (`lib/readme-updater.js`)

**Implements:**
- Git Automation Layer (component from architecture research)
- README Template Processor (component from architecture research)

**Avoids:**
- Pitfall #3: Hardcoded git credentials (use environment variables)
- Git config leakage into other workflow steps (use --local scope)

**Dependencies:** None — can proceed independently of API migration

**Research Flag:** SKIP — This is well-documented GitHub Actions pattern, no research needed.

### Phase 4: Marketplace Publishing
**Rationale:** After core functionality works and code is modernized, prepare for public distribution. This includes validation, documentation, branding, and release management.

**Delivers:**
- Updated action.yml with proper branding, description, author
- Complete README with usage examples and migration guide
- GitHub release with v2.0.0 tag (breaking changes from v1)
- Successful marketplace listing
- Versioning strategy documentation

**Avoids:**
- Pitfall #5: Marketplace publish checkbox missing (validate before release)
- Pitfall #4: Major version tag management (document strategy, automate tag updates)
- Missing migration guide (users need v1→v2 upgrade instructions)

**Dependencies:** Phases 1-3 complete with working, tested implementation

**Research Flag:** SKIP — Publishing process is well-documented, follows standard GitHub Actions patterns.

### Phase Ordering Rationale

- **Phase 1 first (URGENT):** API migration deadline passed. Must verify endpoint availability before any other work makes sense. This is a "go/no-go" decision point for the entire project.
- **Phase 2 depends on Phase 1:** Can't refactor stats retrieval until we know how stats are retrieved in v1 API.
- **Phase 3 independent:** Git operations can be modernized in parallel with API work since they're separate concerns.
- **Phase 4 last:** Can't publish until functionality works. Marketplace listing requires working action, complete documentation, proper versioning.

**Dependency chain:**
```
Phase 1 (API Foundation) → Phase 2 (Stats Refactoring) → Phase 4 (Publishing)
Phase 3 (Git Modernization) ────────────────────────────────┘
```

**Risk mitigation through ordering:**
- Addressing urgent API deadline first prevents complete project failure
- Isolating API changes (Phase 1) from feature restoration (Phase 2) allows incremental validation
- Separating git modernization (Phase 3) allows parallel work and reduces Phase 2 scope
- Deferring publication (Phase 4) until functionality proven prevents publishing broken action

### Research Flags

**Needs immediate research (Phase 1):**
- **API Migration Foundation** — CRITICAL blocker. Must discover how to access productivity stats in unified API v1. Test if v9 still works, investigate v1 `/sync` endpoint, potentially contact Todoist support. Cannot proceed without resolving this.

**May need phase-specific research (Phase 2):**
- **Stats Retrieval Refactoring** — MEDIUM priority. If stats calculation approach differs significantly from current implementation (e.g., requires client-side aggregation), need research on efficient aggregation patterns, pagination handling, rate limit optimization.

**Standard patterns, skip research:**
- **Phase 3 (Git Operations)** — Well-documented GitHub Actions patterns, no research needed
- **Phase 4 (Marketplace Publishing)** — Standard GitHub Actions publishing process, documented by GitHub

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Axios, Node 20, @vercel/ncc, @actions/core are proven technologies with clear upgrade paths. Only uncertainty is which Todoist API version/endpoint to use. |
| Features | MEDIUM | Feature requirements clear from existing implementation and competitor analysis. Uncertainty around which features are actually achievable if stats endpoint unavailable. |
| Architecture | HIGH | GitHub Actions patterns well-established. Fetch-transform-persist pipeline proven. Component extraction strategy straightforward. No significant architectural unknowns. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls well-documented from official sources and community issues. Confidence reduced slightly due to some being inferred from similar projects rather than direct experience with this specific action. |

**Overall confidence:** MEDIUM-HIGH

**Confidence rationale:**
- **HIGH confidence** in general approach: GitHub Actions architecture, git operations patterns, marketplace publishing process all well-documented
- **MEDIUM confidence** in API migration path: V9 deprecation confirmed but replacement endpoint unclear. V1 `/sync` endpoint mentioned but not documented for stats access
- **HIGH confidence** in pitfall prevention: Most critical issues verified through official documentation and community GitHub issues
- **LOW confidence** in timeline: If stats endpoint truly unavailable in v1, project may require significant rework or Todoist support intervention

### Gaps to Address

**Critical gaps (must resolve before Phase 1 implementation):**
- **Stats endpoint in unified API v1:** Exact endpoint/command to retrieve productivity stats unknown. V9 `/completed/get_stats` has no documented v1 equivalent. Testing required to determine if v1 `/sync` endpoint preserves this functionality. **Resolution:** Immediate API testing with real Todoist account, review official migration guide, contact Todoist support if endpoint not discoverable.

**Medium priority gaps (resolve during Phase 2):**
- **Response format changes:** Unknown if v1 stats response matches v9 structure (field names, nesting, data types). **Resolution:** API testing during Phase 2 implementation, update data transformation layer accordingly.
- **Premium feature detection:** Unknown how to detect premium status in v1 API responses. Current v9 implementation checks if `week_items` array present. **Resolution:** Review v1 user endpoint documentation, test with free and premium accounts.

**Lower priority gaps (can defer):**
- **Rate limit specifics:** Unclear if v1 has same 1000 req/15min limit as v9. **Resolution:** Review v1 docs during Phase 2 error handling implementation.
- **Archived items pagination:** Unknown if `/archive/items` endpoint (if needed) supports pagination, what limits apply. **Resolution:** Test during Phase 2 if client-side calculation becomes necessary.

## Sources

### Primary (HIGH confidence)
- [Todoist Unified API v1 Documentation](https://developer.todoist.com/api/v1/) — Current official API, confirms v9 deprecation
- [Todoist Sync API v9 Documentation](https://developer.todoist.com/sync/v9/) — Deprecated API containing `/completed/get_stats` endpoint
- [Todoist REST API v2 Documentation](https://developer.todoist.com/rest/v2/) — Deprecated API confirming no stats endpoints exist
- [GitHub Actions: Publishing to Marketplace](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace) — Official publishing process
- [GitHub Actions: Metadata syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) — action.yml specification
- [GitHub Actions Toolkit: Action Versioning](https://github.com/actions/toolkit/blob/main/docs/action-versioning.md) — Official versioning guidance

### Secondary (MEDIUM confidence)
- [Drafts Community: Todoist API Updates](https://forums.getdrafts.com/t/todoist-api-updates-deadline-febrary-2026/16403) — February 10, 2026 shutdown date confirmation
- [GitHub Issue: n8n Todoist migration](https://github.com/n8n-io/n8n/issues/4430) — Third-party migration experiences
- [GitHub Issue: ID format changes](https://github.com/Doist/todoist-api-python/issues/131) — New task ID formatting causing 400 errors
- [GitHub Discussion: Node 16→20 migration](https://github.com/actions/upload-artifact/issues/444) — Runtime deprecation timeline
- [GitHub Discussion: Marketplace publishing failures](https://github.com/orgs/community/discussions/25694) — Common validation issues
- [SiddharthShyniben/todoist-readme](https://github.com/SiddharthShyniben/todoist-readme) — Enhanced fork with customizable tags
- [anmol098/waka-readme-stats](https://github.com/anmol098/waka-readme-stats) — Comparable WakaTime-based action patterns

### Tertiary (LOW confidence - inferred)
- Sync endpoint availability in v1 based on documentation mentions of `/sync` for "first-party clients" — not practically verified
- Premium feature detection via `week_items` array presence — may change in v1
- Rate limit consistency between v9 and v1 — not explicitly documented

---
*Research completed: 2026-02-11*
*Ready for roadmap: yes*
*Critical note: Stats API availability is primary blocker requiring immediate resolution*
