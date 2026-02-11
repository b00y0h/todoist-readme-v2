# Codebase Concerns

**Analysis Date:** 2026-02-11

## Tech Debt

**Outdated Node Runtime:**
- Issue: `action.yml` specifies deprecated `node12` runtime which reached end-of-life in April 2022
- Files: `/workspace/action.yml` (line 21)
- Impact: GitHub Actions will soon stop accepting `node12` runs; action will fail in CI/CD environments
- Fix approach: Migrate to `node20` or later runtime and rebuild distribution with `npm run build`

**No Error Handling in Main Flow:**
- Issue: `main()` function in `index.js` has no try-catch, letting unhandled promise rejections crash silently
- Files: `index.js` (lines 10-17, 129-131)
- Impact: Axios errors, network failures, and invalid API responses crash with no logging; GitHub Actions will show unclear failures
- Fix approach: Wrap async main call in try-catch with core.error() logging; add validation for API response structure

**Dependency Deprecation and Security:**
- Issue: Multiple dependencies are severely outdated and unmaintained:
  - `axios@0.20.0` (released Sept 2020, current is 1.6+) - known vulnerabilities
  - `humanize-plus@1.8.2` (last update 2016)
  - `child_process@1.0.2` (polyfill for built-in Node module, unnecessary)
  - `process@0.11.10` (2016 polyfill, unnecessary in modern Node)
  - `@zeit/ncc@0.22.3` (dev dependency, 3+ years old)
- Files: `/workspace/package.json` (lines 6-14)
- Impact: Known CVEs in axios; vulnerabilities in npm audit; code won't work with modern npm/Node versions
- Fix approach: Update axios to latest, remove polyfills (child_process/process are built-in), update @zeit/ncc to current version

**Missing/Outdated Built Distribution:**
- Issue: `npm run build` output should be committed, but dist file may be out of sync with source
- Files: `/workspace/dist/index.js` vs `/workspace/index.js`
- Impact: If source changes but dist isn't rebuilt, GitHub Actions runs old code
- Fix approach: Ensure build is run before commits; add pre-commit hook or CI check

**Hardcoded Committer Credentials:**
- Issue: Git committer username and email hardcoded instead of being configurable
- Files: `/workspace/index.js` (lines 114-115)
- Impact: All commits appear to come from "Abhishek Naidu" regardless of who ran the action; not configurable per user
- Fix approach: Make committer name/email configurable via action inputs or use GitHub Action default bot credentials

**Unused/Dead Code:**
- Issue: Commented-out code blocks left in production (lines 54-57, 122)
- Files: `/workspace/index.js`
- Impact: Confusion about intent; unclear if code is incomplete
- Fix approach: Remove commented code; use git history if recovery needed

## Known Bugs

**Premium User Flag Not Validated:**
- Symptoms: PREMIUM input accepts any string value, code checks `if (PREMIUM == "true")` - strings like "yes" or "1" silently treated as false
- Files: `/workspace/index.js` (line 34)
- Trigger: User sets PREMIUM input to any value other than exact string "true"
- Workaround: Document that only "true" works; use exact value in action invocation

**Potential Array Index Out of Bounds:**
- Symptoms: Code accesses `days_items[0]`, `week_items[0]`, `goals.max_daily_streak` without validating arrays/objects exist
- Files: `/workspace/index.js` (lines 30, 36, 47)
- Trigger: Todoist API returns empty arrays or missing fields; unexpected response structure
- Workaround: Manual API testing shows fields exist, but no defensive checks present

**Incorrect Tag Parsing Edge Case:**
- Symptoms: `buildReadme()` assumes comment tags exist in exact format; malformed tags cause process.exit(1) with no README written
- Files: `/workspace/index.js` (lines 79-102)
- Trigger: User has different comment format, extra spaces, or missing closing tag
- Workaround: Error message shows expected format; user must add exact format to README

**Exit Code Misuse for Control Flow:**
- Symptoms: Code uses `process.exit(0)` and `process.exit(1)` for normal control flow (lines 69, 73, 101, 126), mixing success states with error states
- Files: `/workspace/index.js`
- Impact: Hard to distinguish expected exits from error exits; confuses GitHub Actions job status
- Fix approach: Use proper return/return value handling instead of process.exit in main flow

## Security Considerations

**API Key Exposure Risk:**
- Risk: TODOIST_API_KEY is passed via GitHub Actions input; ensure it's marked as secret in action.yml
- Files: `/workspace/action.yml` (line 7), `/workspace/index.js` (line 7)
- Current mitigation: GitHub Actions has `secret` input type, but action.yml doesn't explicitly mark it as secret-safe
- Recommendations:
  - Add `secret: true` to TODOIST_API_KEY input in action.yml (though it's implicit)
  - Ensure API key is never logged or output to stdout (currently safe - only used in Bearer token)
  - Add warning in README about storing API key as encrypted secret

**Git Push Without Authentication Context:**
- Risk: `git push` executed without explicit auth; relies on caller's git config or SSH key setup
- Files: `/workspace/index.js` (line 123)
- Current mitigation: Works in GitHub Actions environment with GITHUB_TOKEN context
- Recommendations:
  - Document that this action requires git credentials to be pre-configured (GITHUB_TOKEN or SSH key)
  - Consider adding GITHUB_TOKEN as explicit input for clarity

**No Input Validation:**
- Risk: Username input is accepted but never validated or used; no sanitization of any inputs
- Files: `/workspace/action.yml` (line 10-13)
- Current mitigation: None - but current usage doesn't expose risk
- Recommendations: Either use USERNAME input or remove it; validate TODOIST_API_KEY format if possible

## Performance Bottlenecks

**No Request Timeout or Retry Logic:**
- Problem: Axios request to Todoist API has no timeout set; network hangs will block action indefinitely
- Files: `/workspace/index.js` (lines 12-15)
- Cause: Basic axios() call with no configuration
- Improvement path: Add timeout (5-10 seconds), retry logic for transient failures, circuit breaker for persistent API issues

**Synchronous File I/O in GitHub Action:**
- Problem: `fs.readFileSync()` and `fs.writeFileSync()` block; if README is large, action stalls
- Files: `/workspace/index.js` (lines 58, 63)
- Cause: Using synchronous API instead of async
- Improvement path: Use fs.promises.readFile/writeFile for non-blocking I/O; minimal impact but cleaner

**No Caching of API Responses:**
- Problem: Every action run hits Todoist API; no cache prevents duplicate requests if workflow runs multiple times
- Files: `/workspace/index.js` (lines 12-16)
- Cause: No cache layer implemented
- Improvement path: Add simple file-based cache (optional, low priority for most users)

## Fragile Areas

**README Comment Tag Parsing:**
- Files: `/workspace/index.js` (lines 79-110)
- Why fragile: String-based index searching is brittle; doesn't handle:
  - Multiple comment sections
  - Comments with different spacing or formatting
  - Comments inside code blocks
  - Case sensitivity changes
- Safe modification: Add comprehensive tests for edge cases; consider regex-based parsing instead
- Test coverage: No tests exist; buildReadme() is untested

**Data Destructuring Without Type Validation:**
- Files: `/workspace/index.js` (line 24)
- Why fragile: `const { karma, completed_count, days_items, goals, week_items } = data` assumes all fields exist; API response changes break immediately
- Safe modification: Add explicit validation of data structure before destructuring
- Test coverage: No tests; only works if API response is in expected format

**Global Mutable State:**
- Files: `/workspace/index.js` (lines 19-20)
- Why fragile: `todoist` array and `jobFailFlag` are global; if main() calls happen in sequence, state leaks between calls
- Safe modification: Move to local variables or function parameters
- Test coverage: No tests; only works if main() called once per process

**Unhandled Promise Rejection:**
- Files: `/workspace/exec.js` (lines 3-21)
- Why fragile: spawn() child process error handling only covers 'error' event; doesn't handle uncaught errors in callback
- Safe modification: Add proper promise wrapper with timeout
- Test coverage: No tests for error conditions

## Test Coverage Gaps

**No Automated Tests:**
- What's not tested:
  - API response parsing and data transformation
  - README file parsing and rebuild logic
  - Git operations (add, commit, push)
  - Error handling and edge cases
  - Premium vs non-premium user logic
- Files: `index.js`, `exec.js` - no test files exist
- Risk: Any code change could break workflow; bugs only discovered in production (GitHub Actions runs)
- Priority: High - action directly modifies user repositories; correctness is critical

**Missing Integration Tests:**
- What's not tested:
  - Actual Todoist API calls
  - Real git operations
  - End-to-end workflow in GitHub Actions context
- Files: No integration test files
- Risk: API response format changes break action silently
- Priority: Medium - can use mock responses for unit tests first

## Scaling Limits

**Single File Update Only:**
- Current capacity: Only updates one README.md file
- Limit: Can't be used for multiple readmes or different file formats
- Scaling path: Generalize to accept configurable file path; support template patterns

**No Batching or Rate Limiting:**
- Current capacity: One API call per action run
- Limit: If used in multiple workflows, could hit Todoist rate limits
- Scaling path: Add optional batch update mode; implement rate limit awareness

## Dependencies at Risk

**Axios 0.20.0 Has Known Vulnerabilities:**
- Risk: CVEs in request handling; security patches not available in this version
- Impact: If Todoist API is compromised or action makes requests to other endpoints, vulnerability could be exploited
- Migration plan: Upgrade to axios 1.6+ or use native node-fetch/undici

**Polyfill Dependencies Not Needed:**
- Risk: `child_process` and `process` packages are polyfills for Node built-ins; unnecessary since Node 12+
- Impact: Extra dependencies increase attack surface; confuse dependency tree
- Migration plan: Remove from package.json; use built-in `child_process` module directly

**@zeit/ncc v0.22.3 is Abandoned:**
- Risk: Build tool no longer maintained; incompatible with latest Node versions
- Impact: Can't rebuild distribution with modern npm; build may fail
- Migration plan: Update to @vercel/ncc (successor) or alternative bundler

## Missing Critical Features

**No Dry-Run Mode:**
- Problem: No way to test action without actually modifying README and pushing to git
- Blocks: Users can't safely validate their setup without risking unwanted commits
- Workaround: Current code checks TEST_MODE environment variable (line 64), but not fully implemented or documented

**No Custom Commit Message:**
- Problem: Commit message is hardcoded ("Todoist updated."); not configurable per user
- Blocks: Users can't follow their repo's commit message conventions
- Workaround: None - requires code change

**No Scheduling Configuration:**
- Problem: Action runs on manual trigger or webhook; no built-in scheduling
- Blocks: Can't be set up to run automatically on schedule
- Workaround: User must create GitHub Actions workflow with schedule trigger
