# Feature Landscape

**Domain:** GitHub Actions - README Productivity Stats
**Researched:** 2026-02-11
**Confidence:** MEDIUM

## Current State Analysis

**Existing Features (using deprecated Sync API v9):**
- Karma points (with humanized formatting)
- Daily tasks completed (today)
- Weekly tasks completed (premium only)
- Total completed tasks count
- Longest daily streak

**Migration Challenge:** Todoist Sync API v9 is deprecated and will shut down in early 2026. The new unified Todoist API v1 does **NOT** provide productivity statistics endpoints.

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Karma Points Display | Core Todoist feature, users actively track this | LOW | Currently available via Sync API; migration strategy needed |
| Daily Tasks Completed | Shows today's progress, immediate feedback | LOW | Currently available; needs migration path |
| Total Completed Tasks | All-time achievement counter | LOW | Basic metric users expect to see |
| Current Daily Streak | Gamification element, motivation booster | MEDIUM | Users rely on this for accountability |
| Longest Streak Record | Personal best, achievement tracking | MEDIUM | Historical data important for user morale |
| Auto-update on Schedule | Set-and-forget automation | LOW | GitHub Actions cron, existing pattern works |
| README Tag-based Injection | Non-invasive README updates | LOW | Standard pattern across similar actions |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Customizable Stats Tags | Let users design their own layouts (like SiddharthShyniben fork) | MEDIUM | 18+ custom tags for granular control of what/where to display |
| Weekly Tasks (Non-Premium Fallback) | Show weekly stats without premium if possible | HIGH | Investigate if calculable from other endpoints |
| Karma Trend Indicator | Show if karma is going up/down | MEDIUM | Available in Sync API `karma_trend` field |
| Karma Activity Log | Recent karma changes with reasons | MEDIUM | Shows _why_ karma changed (completed task, overdue penalty, etc.) |
| Streak Start/End Dates | Contextualize streak duration | LOW | More detail than just count |
| Weekly Streak Display | Alternative to daily for different goal styles | MEDIUM | For users with weekly rather than daily goals |
| SVG Card Support | Pretty formatted card vs plain text | HIGH | Similar to github-readme-stats rendering |
| Multiple Display Formats | Compact (10k) vs full (10,000) numbers | LOW | Humanize-plus already does this |
| Non-Premium Feature Parity | Work fully without Todoist premium | HIGH | Differentiate from "premium-only" competitors |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time Updates | GitHub Actions rate limits, unnecessary API calls | Stick to scheduled updates (hourly/daily cron) |
| Individual Task Lists | Privacy concerns, clutters README, not what users want | Focus on aggregate stats only |
| Project-level Breakdown | Too granular, exposes personal organization | Keep it high-level user stats |
| Direct Sync API Integration | API is being deprecated Feb 2026 | Research alternative approaches (see below) |
| External Service Dependency | Avoid creating hosted service like Vercel instances | Pure GitHub Action, runs in user's repo |
| Image Generation Service | Reliability issues, rate limiting | Either static SVG in Actions or text-based |

## Feature Dependencies

```
Auto-update on Schedule
    └──requires──> README Tag-based Injection
    └──requires──> Stats Data Source (CRITICAL BLOCKER)

All Stats Features
    └──requires──> Stats Data Source
        └──options──> 1. Sync API v9 (DEPRECATED, Feb 2026)
                      2. Unified API v1 (NO STATS ENDPOINTS)
                      3. Alternative approach (TBD)

Karma Trend Indicator ──enhances──> Karma Points Display

Streak Start/End Dates ──enhances──> Current Daily Streak

Weekly Tasks ──conflicts with──> Non-Premium Support (premium-only in Sync API)
```

### Critical Dependency Notes

**Stats Data Source is a BLOCKER:**
- Sync API v9 provides `completed/get_stats` endpoint with all needed data
- Sync API v9 shutting down early 2026 (deadline passed or imminent)
- Unified API v1 has **NO productivity statistics endpoints**
- REST API v2 (deprecated) also has **NO statistics endpoints**

**This is a CRITICAL issue requiring immediate investigation.**

## Migration Challenges & Alternatives

### Problem
Current implementation uses Sync API v9 endpoint: `https://api.todoist.com/sync/v9/completed/get_stats`

This provides:
- `karma`, `karma_trend`, `karma_last_update`, `karma_update_reasons`
- `completed_count`
- `days_items[]` (daily breakdown)
- `week_items[]` (weekly breakdown, premium only)
- `goals.current_daily_streak`, `goals.max_daily_streak`
- `goals.current_weekly_streak`, `goals.max_weekly_streak`

### Unified API v1 Status
According to official documentation (verified 2026-02-11):
- **REST endpoints:** Projects, Sections, Tasks, Comments, Labels only
- **No stats endpoints:** No karma, streaks, or productivity metrics
- **Sync endpoint exists:** Mentioned for "some actions only available via /sync"

### Possible Approaches

**Option A: Continue using Sync endpoint in unified API**
- Unified API mentions `/sync` endpoint "used by first-party clients"
- **Needs verification:** Does `/sync/v9/completed/get_stats` still work under unified API?
- Risk: Could be removed without notice

**Option B: Calculate stats from available endpoints**
- Query completed tasks via unified API
- Calculate streaks/counts locally
- **Problem:** Karma calculation algorithm is proprietary, can't replicate
- **Problem:** No historical completion data structure documented

**Option C: Screen scraping productivity view**
- Todoist has web UI at todoist.com showing stats
- **Highly discouraged:** Fragile, against ToS, rate limiting issues
- Only viable if API completely removed

**Option D: User provides stats manually**
- Configuration-based rather than API-based
- **Not viable:** Defeats automation purpose

## MVP Recommendation

### Immediate (v1.0 - Migration Release)

**PRIORITY 1: Verify stats availability**
1. Test if Sync API `/sync/v9/completed/get_stats` still works post-deprecation
2. Contact Todoist support for official guidance on stats access
3. Document findings in phase-specific research

**If stats endpoint still accessible:**
- Karma Points Display
- Daily Tasks Completed
- Total Completed Tasks
- Current Daily Streak
- Longest Streak Record

**If stats endpoint unavailable:**
- Research Phase required before any implementation

### After Migration Validation (v1.1+)

Add when stats source is stable:
- Karma Trend Indicator (up/down arrow)
- Streak Start/End Dates
- Weekly Streak Display
- Customizable Stats Tags (18+ tag system like SiddharthShyniben fork)

### Future Consideration (v2+)

Only if API supports and user demand exists:
- SVG Card Rendering (similar to github-readme-stats)
- Multiple Theme Support
- Karma Activity Log display
- Multi-language README support
- Advanced formatting options

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Blocker |
|---------|------------|---------------------|----------|---------|
| Stats Data Source Resolution | CRITICAL | HIGH | P0 | Migration blocker |
| Karma Points Display | HIGH | LOW | P1 | Depends on data source |
| Daily Tasks Completed | HIGH | LOW | P1 | Depends on data source |
| Current Daily Streak | HIGH | LOW | P1 | Depends on data source |
| Total Completed Tasks | HIGH | LOW | P1 | Depends on data source |
| Longest Streak | MEDIUM | LOW | P1 | Depends on data source |
| Auto-update Schedule | HIGH | LOW | P1 | None |
| Customizable Tags | MEDIUM | MEDIUM | P2 | Data source + tag system design |
| Karma Trend Indicator | MEDIUM | LOW | P2 | Data source |
| Weekly Tasks Display | MEDIUM | LOW | P2 | Premium check, data source |
| SVG Card Rendering | LOW | HIGH | P3 | Design system, rendering engine |

**Priority key:**
- P0: Critical blocker, must resolve before any work
- P1: Must have for migration release
- P2: Should have, add when data source stable
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Original todoist-readme | SiddharthShyniben Fork | WakaTime Stats Actions | Our Approach |
|---------|-------------------------|------------------------|------------------------|--------------|
| Karma Display | ✅ Fixed format | ✅ Customizable tags | ❌ N/A | Match current, explore tags |
| Daily Tasks | ✅ Fixed format | ✅ Customizable tags | ❌ N/A | Match current |
| Weekly Tasks | ✅ Premium only | ✅ Premium only | ❌ N/A | Investigate non-premium option |
| Streaks | ✅ Longest only | ✅ Current + longest + dates | ❌ N/A | Enhanced display |
| Total Completed | ✅ Yes | ✅ Yes | ❌ N/A | Match current |
| Customization | ❌ Fixed output | ✅ 18+ custom tags | ✅ Multiple card types | Learn from fork |
| SVG Cards | ❌ Text only | ⚠️ User-created SVG | ✅ Generated cards | Consider for v2+ |
| Themes | ❌ None | ❌ None | ✅ 40+ themes | Consider for v2+ |
| Caching | ❌ Always updates | ❌ Always updates | ✅ Configurable cache | Not needed for daily stats |
| Self-hosting | ✅ GitHub Actions | ✅ GitHub Actions | ⚠️ Mixed (Vercel issues) | Stick to Actions |

## Ecosystem Insights

### Similar Actions Patterns

**WakaTime-based actions** show common patterns:
- Configurable update frequency (cron-based)
- Tag-based README injection (`<!-- WAKATIME:START -->`)
- Multiple display formats (bar charts, tables, cards)
- Theme support (40+ themes in some implementations)
- Privacy controls (public profile requirement)
- Language-specific filtering

**GitHub stats actions** demonstrate:
- SVG card generation for visual appeal
- Caching to reduce API calls
- Self-hosting options to avoid rate limits
- Customizable metrics selection
- Pin card style displays

### Key Differences from Competitors

**WakaTime advantages:**
- Active API, no deprecation concerns
- Rich time-tracking data
- Strong visual presentation options

**Todoist challenges:**
- API deprecation creates uncertainty
- Limited stats endpoints even when available
- Premium-only features create tier complexity

**Our positioning:**
- Simpler use case (task completion vs time tracking)
- Gaming/motivation focus (karma, streaks) vs analytics
- Must solve data access problem first

## Research Gaps & Open Questions

### Critical Questions for Phase-Specific Research

1. **Does Sync API still work?**
   - Test `/sync/v9/completed/get_stats` with current auth
   - Check if unified API redirects/proxies to sync
   - Contact Todoist developer support

2. **Alternative stats access?**
   - Undocumented unified API endpoints?
   - GraphQL API possibility?
   - Official statistics export feature?

3. **Premium feature detection?**
   - How to detect if user has premium?
   - Can we calculate weekly from daily data?
   - Graceful degradation strategy?

4. **Rate limiting & quotas?**
   - What are current API limits?
   - How frequently can we poll?
   - Caching strategy needed?

### Lower Priority Questions

1. How do users want to customize output? (Survey existing users)
2. What additional stats would users value? (Feature requests)
3. Is SVG rendering worth the complexity? (Compare with text-based simplicity)
4. Multi-language support demand? (International user base)

## Sources

### Todoist API Documentation
- [Todoist Sync API v9 Reference](https://developer.todoist.com/sync/v9/) - MEDIUM confidence (deprecated but currently documented)
- [Todoist REST API v1 Reference](https://developer.todoist.com/rest/v1/) - HIGH confidence (official, current)
- [Todoist REST API v2 Reference](https://developer.todoist.com/rest/v2/) - MEDIUM confidence (deprecated)
- [Todoist Unified API v1](https://developer.todoist.com/api/v1/) - HIGH confidence (current official API)

### Todoist Features
- [Use the Productivity view in Todoist](https://www.todoist.com/help/articles/use-the-productivity-view-in-todoist-6S63uAa9) - HIGH confidence (official help docs)
- [Introduction to Karma](https://todoist.com/help/articles/introduction-to-karma) - HIGH confidence (official help docs)
- [Todoist Karma](https://www.todoist.com/karma) - HIGH confidence (official product page)

### API Deprecation
- [Todoist API Updates (deadline February 2026) - Drafts Community](https://forums.getdrafts.com/t/todoist-api-updates-deadline-febrary-2026/16403) - MEDIUM confidence (third-party forum, but specific date)
- [Todoist API changes - Drafts Community](https://forums.getdrafts.com/t/todoist-api-changes/16352) - MEDIUM confidence (community discussion)

### Competitor Analysis
- [SiddharthShyniben/todoist-readme](https://github.com/SiddharthShyniben/todoist-readme) - HIGH confidence (verified GitHub repo)
- [Todoist Readme Action - GitHub Marketplace](https://github.com/marketplace/actions/todoist-readme) - HIGH confidence (original action)
- [Profile Readme Development Stats](https://github.com/marketplace/actions/profile-readme-development-stats) - HIGH confidence (WakaTime competitor)
- [anmol098/waka-readme-stats](https://github.com/anmol098/waka-readme-stats) - HIGH confidence (popular WakaTime action)
- [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats) - HIGH confidence (visual stats cards reference)

---
*Feature research for: Todoist README GitHub Action Migration*
*Researched: 2026-02-11*
*Critical Finding: Stats API availability is primary blocker for migration*
