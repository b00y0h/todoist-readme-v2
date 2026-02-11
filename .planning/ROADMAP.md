# Roadmap: Todoist Readme V2

## Overview

This roadmap transforms a broken GitHub Action into a working, published marketplace action through urgent API migration and systematic modernization. Phase 1 addresses the critical API deprecation blocker, Phase 2 restores all stats display features, Phase 3 modernizes git operations, and Phase 4 prepares for marketplace publication. The journey prioritizes functionality first, then polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: API Migration Foundation** - Establish working connection to Todoist API v1 and upgrade runtime
- [x] **Phase 2: Stats Retrieval & Display** - Restore all productivity stats features with improved error handling
- [ ] **Phase 3: Git Operations Modernization** - Remove hardcoded credentials and refactor git automation
- [ ] **Phase 4: Marketplace Publishing** - Prepare documentation, branding, and release for marketplace

## Phase Details

### Phase 1: API Migration Foundation
**Goal**: Action successfully connects to Todoist API v1 and retrieves productivity stats on Node 20 runtime
**Depends on**: Nothing (first phase)
**Requirements**: API-01, API-02, API-03, API-04, INFR-01
**Success Criteria** (what must be TRUE):
  1. Action runs on Node 20 runtime without deprecation warnings
  2. Action authenticates with Todoist API v1 using bearer token
  3. Action retrieves productivity stats data from working endpoint
  4. Action displays clear error messages when API requests fail
  5. Action respects rate limits and doesn't fail silently
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Upgrade runtime to Node 20 and update dependencies
- [x] 01-02-PLAN.md — Migrate API from v9 to v1 with error handling and rate limits

### Phase 2: Stats Retrieval & Display
**Goal**: Users see all productivity stats (karma, daily tasks, weekly tasks, streaks, total) in their README with proper formatting
**Depends on**: Phase 1
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06, STAT-07
**Success Criteria** (what must be TRUE):
  1. User can see karma points displayed in README
  2. User can see tasks completed today displayed in README
  3. User can see total completed tasks displayed in README
  4. User can see current daily streak displayed in README
  5. User can see longest streak record displayed in README
  6. Premium user can see tasks completed this week in README
  7. Non-premium user sees graceful fallback when weekly stats unavailable
  8. User can customize which stats display via granular tags
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Add current streak display and extract reusable stat formatters
- [ ] 02-02-PLAN.md — Implement granular tag customization system

### Phase 3: Git Operations Modernization
**Goal**: Action commits README changes using correct author identity auto-detected from GitHub context
**Depends on**: Phase 1
**Requirements**: INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. Action auto-detects committer name from GitHub actor
  2. Action auto-detects committer email from GitHub actor ID
  3. Action correctly injects stats between README template markers
  4. Action skips commit when no changes detected
  5. Git config uses local scope and doesn't leak to other workflow steps
**Plans:** 1 plan

Plans:
- [ ] 03-01-PLAN.md — Modernize git commit workflow with actor detection and change detection

### Phase 4: Marketplace Publishing
**Goal**: Action is published to GitHub Marketplace with complete documentation and proper versioning
**Depends on**: Phase 2, Phase 3
**Requirements**: DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. Action appears in GitHub Marketplace search results
  2. Action has complete README with usage examples
  3. Action has migration guide for users upgrading from v1
  4. Action has v2.0.0 release tag with changelog
  5. Action follows semantic versioning with major version tag strategy
**Plans**: TBD

Plans:
- [ ] To be planned

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. API Migration Foundation | 2/2 | ✓ Complete | 2026-02-11 |
| 2. Stats Retrieval & Display | 2/2 | ✓ Complete | 2026-02-11 |
| 3. Git Operations Modernization | 0/1 | Not started | - |
| 4. Marketplace Publishing | 0/TBD | Not started | - |
