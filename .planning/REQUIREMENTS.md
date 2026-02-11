# Requirements: Todoist Readme V2

**Defined:** 2026-02-11
**Core Value:** Users can automatically showcase their Todoist productivity stats in their GitHub profile README without manual updates.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### API Migration

- [ ] **API-01**: Action verifies stats endpoint availability before proceeding
- [ ] **API-02**: Action connects to Todoist unified API v1 with bearer token auth
- [ ] **API-03**: Action handles API errors gracefully with clear error messages
- [ ] **API-04**: Action respects rate limits (no silent failures)

### Stats Display

- [ ] **STAT-01**: User can display karma points in README
- [ ] **STAT-02**: User can display tasks completed today
- [ ] **STAT-03**: User can display total completed tasks
- [ ] **STAT-04**: User can display current daily streak
- [ ] **STAT-05**: User can display longest streak record
- [ ] **STAT-06**: User can display tasks completed this week (premium)
- [ ] **STAT-07**: User can customize which stats display via tags (granular control)

### Infrastructure

- [ ] **INFR-01**: Action runs on Node 20 runtime
- [ ] **INFR-02**: Action auto-detects committer from GitHub actor (not hardcoded)
- [ ] **INFR-03**: Action uses README template tags for content injection
- [ ] **INFR-04**: Action skips commit when no changes detected

### Distribution

- [ ] **DIST-01**: Action published to GitHub Marketplace
- [ ] **DIST-02**: README includes complete usage examples
- [ ] **DIST-03**: README includes migration guide from v1 to v2

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Stats

- **STAT-08**: User can display karma trend indicator (up/down)
- **STAT-09**: User can display streak start/end dates
- **STAT-10**: User can display karma activity log

### Visual Enhancements

- **VIS-01**: User can display stats as SVG card
- **VIS-02**: User can choose from multiple themes

### Reliability

- **REL-01**: Action retries with exponential backoff on rate limits
- **REL-02**: Action validates inputs with helpful error messages

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| OAuth login flow | Users already have API tokens, keeping it simple |
| Task list display | Out of scope for stats display, different use case |
| Multiple README targets | Single README.md sufficient for v1 |
| Real-time webhooks | Cron-based updates are sufficient |
| Multi-language README | Adds complexity, defer to community demand |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 1 | Pending |
| STAT-01 | Phase 2 | Pending |
| STAT-02 | Phase 2 | Pending |
| STAT-03 | Phase 2 | Pending |
| STAT-04 | Phase 2 | Pending |
| STAT-05 | Phase 2 | Pending |
| STAT-06 | Phase 2 | Pending |
| STAT-07 | Phase 2 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 3 | Pending |
| INFR-03 | Phase 3 | Pending |
| INFR-04 | Phase 3 | Pending |
| DIST-01 | Phase 4 | Pending |
| DIST-02 | Phase 4 | Pending |
| DIST-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after roadmap creation*
