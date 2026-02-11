---
phase: 01-api-migration-foundation
plan: 01
subsystem: github-action
tags: [infrastructure, runtime-upgrade, dependencies]
dependency_graph:
  requires: []
  provides:
    - node-20-runtime
    - upgraded-dependencies
    - axios-retry-support
  affects:
    - action-execution
    - bundle-build
tech_stack:
  added:
    - "@actions/core@1.11.1"
    - "axios@1.13.5"
    - "axios-retry@4.5.0"
    - "@vercel/ncc@0.38.4 (via npx)"
  removed:
    - "@actions/core@1.2.5"
    - "axios@0.20.0"
    - "@zeit/ncc@0.22.3"
  patterns:
    - "npx for build tools"
    - "node 20 runtime"
key_files:
  created: []
  modified:
    - "action.yml"
    - "package.json"
    - "package-lock.json"
    - "dist/index.js"
decisions:
  - what: "Use npx instead of local devDependency for @vercel/ncc"
    why: "Local installation failed in Node 24 environment, npx provides reliable alternative"
    impact: "Build requires network access but works consistently"
  - what: "Downgrade @actions/core from 3.0.0 to 1.11.1"
    why: "Version 3.0.0 uses ESM exports incompatible with ncc bundler's CommonJS expectations"
    impact: "Compatible with Node 20, maintains CommonJS compatibility"
  - what: "Accept moderate npm audit vulnerabilities in transitive dependencies"
    why: "Vulnerabilities in @actions/http-client's undici dependency, no fix available without major version changes"
    impact: "Acceptable risk - plan only required no high/critical vulnerabilities"
metrics:
  duration_minutes: 5
  tasks_completed: 3
  commits: 4
  files_modified: 4
  deviations: 1
  completed_at: "2026-02-11T21:27:40Z"
---

# Phase 01 Plan 01: Node 20 Runtime Upgrade Summary

**One-liner:** Upgraded GitHub Action from deprecated Node 12 to Node 20 runtime with compatible dependencies and build tooling.

## Execution Overview

Successfully upgraded the GitHub Action runtime from Node 12 (deprecated) to Node 20, updated all dependencies to compatible versions, and rebuilt the action bundle. All verification checks passed.

## Tasks Completed

### Task 1: Update action.yml runtime to Node 20
- **Commit:** `516ce99`
- **Changes:** Modified `action.yml` to declare `using: "node20"` instead of `node12`
- **Verification:** ✓ Grep confirmed Node 20 declaration
- **Status:** ✓ Complete

### Task 2: Upgrade npm dependencies for Node 20 compatibility
- **Commits:** `f000753`, `12c7bfb`
- **Changes:**
  - Upgraded @actions/core: 1.2.5 → 1.11.1 (Node 20 compatible)
  - Upgraded axios: 0.20.0 → 1.13.5 (security patches)
  - Added axios-retry: 4.5.0 (for rate limit handling)
  - Replaced @zeit/ncc with @vercel/ncc via npx (rebranded package)
  - Added Node engine constraint: `"engines": { "node": ">=20.0.0" }`
  - Updated build script to use `npx --yes @vercel/ncc@0.38.4`
- **Verification:** ✓ npm ls shows all packages installed, npm audit shows 0 high/critical vulnerabilities
- **Status:** ✓ Complete

### Task 3: Rebuild bundle and verify
- **Commit:** `10e66ae`
- **Changes:**
  - Rebuilt dist/index.js with new dependencies
  - Bundle size: 1.4MB (increased from ~300KB due to axios-retry and updated dependencies)
  - Syntax verified with `node --check`
- **Verification:** ✓ Bundle exists, has recent timestamp, passes syntax check
- **Status:** ✓ Complete

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] npm install not installing @vercel/ncc locally**
- **Found during:** Task 2
- **Issue:** @vercel/ncc package wouldn't install in node_modules despite being in package.json devDependencies. Multiple installation attempts (fresh install, cache clear, force flag) all failed silently. The package appeared in package-lock.json but not in filesystem.
- **Root cause:** Unknown npm/Node 24 environment interaction preventing devDependency installation
- **Fix:** Changed build script to use `npx --yes @vercel/ncc@0.38.4` instead of local installation. Removed @vercel/ncc from devDependencies since npx will fetch it as needed.
- **Files modified:** package.json (build script and devDependencies)
- **Commit:** `12c7bfb`
- **Impact:** Build now requires network access to fetch ncc, but works reliably. No impact on action runtime since build happens before deployment.

**2. [Rule 1 - Bug] @actions/core v3.0.0 incompatible with ncc bundler**
- **Found during:** Task 3
- **Issue:** When building with @actions/core v3.0.0, ncc failed with error: "Package path . is not exported from package @actions/core"
- **Root cause:** @actions/core v3.0.0 uses ESM exports field, but ncc bundler expects CommonJS module resolution
- **Fix:** Downgraded to @actions/core v1.11.1 which supports Node 20 but uses CommonJS-compatible exports
- **Files modified:** package.json, package-lock.json
- **Commit:** `12c7bfb`
- **Impact:** Still meets Node 20 compatibility requirement (v1.10.0+ per plan), bundle builds successfully

## Verification Results

All plan verification criteria met:

- ✓ action.yml contains `using: "node20"`
- ✓ package.json shows @actions/core >= 1.10.0 (1.11.1)
- ✓ package.json shows axios >= 1.6.0 (1.13.5)
- ✓ package.json shows axios-retry (4.5.0)
- ✓ dist/index.js exists and has recent modification time
- ✓ `node --check dist/index.js` passes
- ✓ No high/critical npm audit vulnerabilities (2 moderate in transitive deps)

## Success Criteria Met

✓ Action runtime upgraded to Node 20 with all dependencies compatible
✓ Bundle builds successfully
✓ Ready for API migration in Plan 02

## Key Insights

1. **npx is more reliable than local devDependencies for build tools** - Especially in containerized or CI environments where npm behavior may be unpredictable
2. **@actions/core v3.x uses ESM** - Breaking change for bundlers expecting CommonJS. v1.x branch is LTS for CommonJS compatibility
3. **Node 20 support doesn't mean Node 24 compatibility** - Some packages/tools may have issues with bleeding-edge Node versions
4. **Transitive dependency vulnerabilities are common** - Focus on direct dependency security and accept moderate issues in locked transitive deps

## Next Steps

This plan completed the Node 20 runtime upgrade. The action can now execute on current GitHub Actions runners. Plan 02 should proceed with migrating the API endpoint from v9 to v1.

## Self-Check

Verifying claimed artifacts exist:

```bash
# Check created files exist
[ -f "action.yml" ] && echo "FOUND: action.yml" || echo "MISSING: action.yml"
[ -f "package.json" ] && echo "FOUND: package.json" || echo "MISSING: package.json"
[ -f "dist/index.js" ] && echo "FOUND: dist/index.js" || echo "MISSING: dist/index.js"

# Check commits exist
git log --oneline --all | grep -q "516ce99" && echo "FOUND: 516ce99" || echo "MISSING: 516ce99"
git log --oneline --all | grep -q "f000753" && echo "FOUND: f000753" || echo "MISSING: f000753"
git log --oneline --all | grep -q "12c7bfb" && echo "FOUND: 12c7bfb" || echo "MISSING: 12c7bfb"
git log --oneline --all | grep -q "10e66ae" && echo "FOUND: 10e66ae" || echo "MISSING: 10e66ae"
```

## Self-Check: PASSED

All files and commits verified to exist:
- ✓ action.yml
- ✓ package.json  
- ✓ dist/index.js
- ✓ Commit 516ce99
- ✓ Commit f000753
- ✓ Commit 12c7bfb
- ✓ Commit 10e66ae
