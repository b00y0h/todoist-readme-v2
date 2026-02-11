# Pitfalls Research

**Domain:** Todoist API Migration & GitHub Actions Marketplace Publishing
**Researched:** 2026-02-11
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: ID Type Mismatch - Treating String IDs as Integers

**What goes wrong:**
Code breaks when Todoist API returns string IDs (including UUIDs and new formats like `ar-xi-v-202403190000-202403192359-7814598409`) instead of numeric IDs. Type coercion fails, parseInt() returns NaN, database queries fail, and string comparisons break equality checks.

**Why it happens:**
Sync API v9 used numeric integer IDs (e.g., `7814598409`). The new unified API v1 migrated ALL IDs to strings and reserves the right to use non-numeric formats. Developers assume IDs are "numbers stored as strings" and attempt integer parsing or numeric operations.

**How to avoid:**
- Treat ALL IDs as opaque strings from day one
- Remove parseInt(), Number(), or numeric coercion on ID fields
- Use strict equality (===) for ID comparisons
- Update TypeScript types from `number` to `string` for all ID fields
- Never perform arithmetic or numeric comparisons on IDs

**Warning signs:**
- Code contains `parseInt(task.id)` or `Number(task.id)`
- Database schemas define ID columns as INTEGER or BIGINT
- Conditional logic like `if (id > 1000)` using IDs
- String concatenation issues when IDs contain special characters
- 400 Bad Request errors when passing IDs back to API

**Phase to address:**
Phase 1 (API Migration Foundation) - must be fixed before ANY API calls work correctly

**Sources:**
- [Todoist Sync API v9 Documentation](https://developer.todoist.com/sync/v9/)
- [Todoist API v1 Migration Guide](https://developer.todoist.com/api/v1/)
- [GitHub Issue: api.add_comment returns 400 Client Error (new task ID formatting?)](https://github.com/Doist/todoist-api-python/issues/131)

---

### Pitfall 2: Node.js Version Declaration Mismatch

**What goes wrong:**
`action.yml` declares `using: "node12"` but GitHub Actions deprecated Node 12 and Node 16. Actions fail to run with deprecation warnings flooding logs, then stop executing entirely when GitHub removes Node 16 support. Users see "Node.js 16 actions are deprecated" errors even after updating dependencies.

**Why it happens:**
The `runs.using` field in `action.yml` is separate from `package.json` engines and controls what Node version GitHub Actions uses. Developers update npm packages and Node version locally but forget to update the action metadata file.

**How to avoid:**
- Update `action.yml` from `using: "node12"` to `using: "node20"`
- This is a MAJOR version breaking change requiring new release (v1 → v2)
- Verify @actions/* dependencies support Node 20 (upgrade to v4+ versions)
- Test action locally with Node 20 before publishing
- Update GitHub Actions runner to use Node 20 in workflows

**Warning signs:**
- Workflow logs show "Node.js 16 actions are deprecated" warnings
- Action metadata file shows `using: "node12"` or `using: "node16"`
- Dependencies use old @actions/core versions (< 1.10.0)
- Local testing uses different Node version than action declares

**Phase to address:**
Phase 1 (API Migration Foundation) - Node 20 update should happen alongside API migration as single breaking change release

**Sources:**
- [GitHub Actions: Node.js 16 to Node 20 Migration](https://github.com/actions/upload-artifact/issues/444)
- [GitHub Actions Runner Node.js Plan](https://github.com/orgs/community/discussions/160454)

---

### Pitfall 3: Archived Items Retrieval - Missing Data After Migration

**What goes wrong:**
Completed tasks and archived sections disappear from API responses after migrating from Sync API v9. Code expects completed items in the main sync response but gets empty arrays. Historical statistics become incomplete, "completed count" metrics show zero, and user-facing stats vanish.

**Why it happens:**
Sync API v9 included completed/archived items in standard sync responses. The new unified API v1 removed them from default responses and requires separate dedicated endpoint calls to `/archive/items` and `/archive/sections`. Developers migrate URLs but don't realize the response structure changed.

**How to avoid:**
- Replace single sync call with TWO separate calls:
  1. Main API call for active items
  2. `/archive/items` for completed tasks
  3. `/archive/sections` for archived sections
- Update response parsing to merge active + archived data
- Add specific tests for completed items retrieval
- Check if `completed_count` stat endpoint still exists or requires archive access

**Warning signs:**
- `completed_count` returns 0 or much lower than expected
- "Total completed tasks" stat missing or incomplete
- User complaints about missing historical data
- Tests for completed items start failing post-migration
- API responses have empty `items` array but user knows they have tasks

**Phase to address:**
Phase 2 (Stats Retrieval Refactoring) - after basic API connectivity works

**Sources:**
- [Todoist Sync API v9 Documentation](https://developer.todoist.com/sync/v9/)
- [Todoist API v1 Documentation](https://developer.todoist.com/api/v1/)

---

### Pitfall 4: Major Version Tag Management - Breaking Updates Don't Reach Users

**What goes wrong:**
Users pinned to `@v1` don't get critical bug fixes or security patches. Conversely, users get breaking changes unexpectedly when maintainers force-push v1 tag to incompatible code. Either way, production workflows break.

**Why it happens:**
GitHub Actions versioning requires maintainers to manually move major version tags (v1, v2) to new minor releases via force push. Most maintainers don't know this practice exists. Users expect semantic versioning but GitHub doesn't enforce it - tags are just git refs.

**How to avoid:**
- After publishing v2.1.0 release, force-push v2 tag to same commit:
  ```bash
  git tag -fa v2 -m "Update v2 tag to v2.1.0"
  git push origin v2 --force
  ```
- Document in README which version users should pin to (@v2 vs @v2.1.0 vs commit SHA)
- Consider using branches (v1 branch) instead of tags for major versions
- For security-critical actions, recommend users pin to commit SHA
- Automate major version tag updates with GitHub Actions workflow

**Warning signs:**
- Users report bugs you already fixed in minor releases
- GitHub Marketplace shows outdated version as "latest"
- Users pinned to @v1 but v1 tag points to old v1.0.0 not v1.5.3
- Confusion about which version users should reference

**Phase to address:**
Phase 4 (Marketplace Publishing) - establish pattern before first release

**Sources:**
- [GitHub Actions Toolkit: Action Versioning](https://github.com/actions/toolkit/blob/main/docs/action-versioning.md)
- [GitHub Discussion: Version Numbering for Actions](https://github.com/orgs/community/discussions/25248)

---

### Pitfall 5: Marketplace Publish Checkbox Missing - Silent Validation Failures

**What goes wrong:**
Developer creates GitHub release, expects action to publish to Marketplace, but nothing happens. Action remains unpublished, no error message appears, checkbox to "Publish to Marketplace" is missing or disabled.

**Why it happens:**
Multiple silent validation failures: (1) action.yaml vs action.yml filename mismatch, (2) GitHub Marketplace Developer Agreement not accepted, (3) repository has workflow files in root, (4) action name conflicts with existing action/user/category, (5) repository not public, (6) 2FA not enabled on account.

**How to avoid:**
- Use `action.yml` NOT `action.yaml` (GitHub is case-sensitive to filename)
- Accept GitHub Marketplace Developer Agreement BEFORE creating release
- Move workflow files out of root into `.github/workflows/`
- Verify action name uniqueness before publishing (search Marketplace)
- Ensure repository is public
- Enable 2FA on GitHub account
- Test metadata validation: check for "Everything looks good!" message in release draft
- Manually edit and re-check "Publish to Marketplace" box if automated release fails

**Warning signs:**
- Release created but action not in Marketplace search results
- No "Publish this Action to Marketplace" banner in release UI
- Checkbox disabled with no explanation
- 500 errors during publish attempt
- Metadata validation shows errors but no specific details

**Phase to address:**
Phase 4 (Marketplace Publishing) - validate BEFORE creating first release

**Sources:**
- [GitHub Docs: Publishing Actions in Marketplace](https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace)
- [GitHub Discussion: Can not publish action to marketplace](https://github.com/orgs/community/discussions/25694)
- [GitHub Discussion: Missing Publish Checkbox](https://github.com/orgs/community/discussions/24965)

---

### Pitfall 6: Rate Limiting Without Backoff - Silent Failures or Cascading Errors

**What goes wrong:**
Action hits 429 Rate Limited errors during high usage (1000+ requests in 15 minutes). Without retry logic, stats fail to update silently, or action crashes with unhelpful error. Users don't realize data is stale until hours/days later.

**Why it happens:**
Todoist limits 1000 requests per user per 15 minutes. GitHub Actions run on schedule (cron) causing burst traffic. Code assumes API calls always succeed. No exponential backoff implemented. Error handling doesn't distinguish transient (429) from permanent (401) failures.

**How to avoid:**
- Implement exponential backoff for 429 errors with Retry-After header
- Add specific error handling for rate limit responses
- Log rate limit warnings clearly (don't fail silently)
- Consider request throttling if making multiple API calls
- Cache responses when possible to reduce API calls
- Monitor rate limit headers in responses to track approaching limits
- Document rate limits in README for users with multiple repos

**Warning signs:**
- Intermittent failures during high-traffic times (start of hour when crons trigger)
- API calls succeed in testing but fail in production
- No retry logic in axios/fetch calls
- 429 errors in logs but code doesn't handle them
- Users report "stats not updating" sporadically

**Phase to address:**
Phase 2 (Stats Retrieval Refactoring) - add with API error handling

**Sources:**
- [Todoist REST API Reference](https://developer.todoist.com/rest/v1/)
- [Rollout: Todoist API Essentials](https://rollout.com/integration-guides/todoist/api-essentials)
- [GitHub Issue: Automatically backoff when rate limited](https://github.com/Doist/todoist-api-python/issues/38)

---

### Pitfall 7: Hardcoded Committer Credentials - Git Config Leakage

**What goes wrong:**
Current code hardcodes committer name/email (`"Abhishek Naidu"`, `"example@gmail.com"`). When users fork/reuse action, commits appear from wrong author. Git config pollution affects other workflow steps. Contributes to git history mess and breaks commit signing.

**Why it happens:**
Original developer copy-pasted git config commands without parameterizing. `git config --global` affects entire workflow runner environment, not just this action. Developers assume git config only affects current repo (it doesn't with --global flag).

**How to avoid:**
- Remove hardcoded credentials entirely
- Use `actions/github-script` or let GitHub Actions automatically configure git
- If git config needed, use `--local` not `--global` to scope to current repo
- OR accept inputs for committer name/email with sensible defaults:
  ```yaml
  inputs:
    COMMITTER_NAME:
      default: ${{ github.actor }}
    COMMITTER_EMAIL:
      default: ${{ github.actor }}@users.noreply.github.com
  ```
- Use git-auto-commit-action instead of manual git commands

**Warning signs:**
- Hardcoded strings in git config commands
- Use of `--global` flag in workflow commands
- Commits show wrong author when users install action
- Git config leaks into subsequent workflow steps

**Phase to address:**
Phase 3 (Git Operations Modernization) - fix during git workflow refactor

**Sources:**
- Research finding from codebase analysis
- Common pattern in GitHub Actions ecosystem

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using Sync API v9 endpoints after 2025 deadline | No code changes needed | API endpoints stop working, complete downtime | Never - API is deprecated and URLs will stop working |
| Keeping node12 runtime declaration | Avoids breaking change version | Action stops running when GitHub drops Node 16 support | Never - already in deprecation timeline |
| Skipping major version tag management | Less git complexity | Users don't get security fixes, or get breaking changes unexpectedly | Never - core to GitHub Actions user experience |
| Hardcoding API URLs instead of using constants | Faster initial development | Hard to update during migrations, error-prone find/replace | Only in prototypes, never in production |
| Synchronous API calls without error handling | Simpler code flow | Silent failures, no retry capability | Only if rate limits impossible to hit (rare) |
| Testing with personal API token only | Easy local testing | Misses auth failures, rate limit issues, premium vs free differences | Only for initial development, must add test matrix |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Todoist Auth | Storing API key in environment variables with logging enabled | Use GitHub Secrets, never log sensitive tokens, mask tokens with `::add-mask::` |
| Todoist /sync endpoint | Assuming sync endpoints work like REST endpoints | Sync API is command-based (POST with commands array), not resource-based (GET /items) |
| GitHub Actions checkout | Using actions/checkout without persist-credentials: false | Set `persist-credentials: false` to prevent token leakage in artifacts |
| Axios requests | Not setting timeout, causing hung workflows | Always set timeout (e.g., `timeout: 10000`) to fail fast |
| Git push operations | Using basic auth with personal tokens | Use GITHUB_TOKEN with proper permissions scope |
| Premium features | Assuming all users have premium (week_items) | Check feature availability in response, gracefully degrade for free users |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all archived items in single request | Slow response times, timeouts | Implement pagination, fetch only recent archives | Users with 1000+ completed tasks |
| No response caching between workflow runs | Hitting rate limits, slow execution | Cache API responses in workflow cache with TTL | Multiple repos using same API token |
| Synchronous git operations for every stat update | Long workflow times | Batch updates, skip commits if no change (already implemented) | Large README files or slow git operations |
| Building action with ncc on every commit | Slow CI builds, large git history | Build in GitHub Actions, only commit source | dist/ folder exceeds 10MB |
| Re-fetching user stats when nothing changed | Wasted API calls | Check last-modified or compare response hash before updating | Running hourly cron |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging TODOIST_API_KEY in debug output | API token exposed in workflow logs | Never log inputs marked as secrets, use `setSecret()` in @actions/core |
| Using actions/checkout default settings | GITHUB_TOKEN persisted in .git directory, leaked in artifacts | Set `persist-credentials: false` in checkout action |
| Overly permissive GITHUB_TOKEN | Action can write to all repos, modify secrets | Explicitly set minimum token permissions in workflow |
| Trusting third-party axios/request libraries | Supply chain attacks, token theft | Pin dependencies to exact versions, use npm audit, consider Dependabot |
| Not validating API responses | Malicious/malformed data injected into README | Validate response schema, sanitize output before writing to files |
| Exposing user stats in public artifacts | Privacy violation of task completion data | Never upload workflow artifacts containing user stats |
| Force-pushing without checking remote | Overwriting concurrent updates, data loss | Use git pull --rebase before push, or use GitHub API for updates |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent failures when API down | Stats never update, no indication why | Add workflow status badge, log visible errors, send failure notifications |
| No validation of README structure | Action fails with cryptic error if tags missing | Validate tags exist, show helpful error with exact comment format needed |
| Breaking changes in minor versions | User workflows suddenly break | Follow semantic versioning strictly, deprecate before removing |
| No example workflow in README | Users can't figure out how to use action | Include complete .yml example with all inputs documented |
| Premium features fail silently for free users | Confusing missing data | Detect premium status from API, log which features skipped |
| No migration guide from v9 to v1 | Users stuck on deprecated API | Provide step-by-step upgrade guide with code examples |
| Unclear error messages ("Request failed") | Users can't debug issues | Log specific errors: "Todoist API rate limited, retry in 300s" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **API Migration:** Verify ALL endpoints migrated (stats, completed, archive) — not just main URL changed
- [ ] **Node Version:** Check action.yml `using` field matches dependencies — not just package.json engines field
- [ ] **ID Handling:** Confirm IDs treated as strings everywhere — not just in API calls but also in comparisons, storage, logging
- [ ] **Rate Limiting:** Test behavior when rate limited — not just when API calls succeed
- [ ] **Error Handling:** Verify transient errors (429, 5xx) trigger retry — not just permanent errors (400, 401)
- [ ] **Premium Features:** Test with free account — not just premium account
- [ ] **Git Operations:** Confirm committer info parameterized — not hardcoded to original author
- [ ] **Major Version Tags:** Verify v1/v2 tags moved to latest release — not just created for initial release
- [ ] **Marketplace Listing:** Confirm action appears in Marketplace search — not just release created
- [ ] **Documentation:** Test example workflow from README on fresh fork — not just in original repo
- [ ] **Security:** Audit logs for secret leakage — not just code review
- [ ] **Artifact Safety:** Verify checkout directory not uploaded in artifacts — not just that artifacts work

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ID type mismatch breaks production | MEDIUM | 1. Hot-fix ID handling to accept strings, 2. Update DB schema if needed, 3. Patch release v2.0.1, 4. Force-update major version tag |
| Node 16 deprecation breaks action | LOW | 1. Update action.yml to node20, 2. Test locally, 3. Release new major version v3.0.0, 4. Document upgrade path |
| Archived items missing | MEDIUM | 1. Add /archive/items endpoint call, 2. Merge with active data, 3. Backfill stats if needed, 4. Patch release |
| Rate limit causes failures | LOW | 1. Add exponential backoff, 2. Catch 429 errors, 3. Log retry attempts, 4. Patch release |
| Major version tag not updated | LOW | 1. Force-push v2 tag to latest, 2. Notify users in changelog, 3. Document versioning practice |
| Marketplace publish failed | LOW | 1. Check validation errors, 2. Fix action.yml name/structure, 3. Accept Developer Agreement, 4. Manually re-publish |
| Hardcoded credentials leak | MEDIUM | 1. Immediately parameterize git config, 2. Document in migration guide, 3. Major version release |
| Token leaked in logs/artifacts | HIGH | 1. Revoke compromised token immediately, 2. Add token masking, 3. Security advisory, 4. Patch release ASAP |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ID type mismatch | Phase 1: API Migration Foundation | Integration tests with string IDs including non-numeric formats |
| Node version mismatch | Phase 1: API Migration Foundation | action.yml declares node20, dependencies use Node 20 compatible versions |
| Archived items missing | Phase 2: Stats Retrieval Refactoring | Tests verify completed_count matches sum of active + archived items |
| Major version tag management | Phase 4: Marketplace Publishing | Document versioning strategy, automate tag updates |
| Marketplace publish failures | Phase 4: Marketplace Publishing | Pre-publish validation checklist, successful Marketplace listing |
| Rate limiting | Phase 2: Stats Retrieval Refactoring | Chaos testing with rate limit simulation, retry logic validates |
| Hardcoded credentials | Phase 3: Git Operations Modernization | Git config uses inputs/defaults, not hardcoded strings |
| Token leakage | Phase 1: API Migration Foundation | Security audit of logs and artifacts, no sensitive data present |

## Sources

### Official Documentation
- [Todoist API v1 Documentation](https://developer.todoist.com/api/v1/)
- [Todoist Sync API v9 (Deprecated)](https://developer.todoist.com/sync/v9/)
- [Todoist REST API Reference](https://developer.todoist.com/rest/v1/)
- [GitHub Docs: Publishing Actions in Marketplace](https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace)
- [GitHub Docs: Automatic Token Authentication](https://docs.github.com/actions/security-guides/automatic-token-authentication)

### GitHub Discussions & Issues
- [GitHub Issue: Todoist migration to new API needed](https://github.com/n8n-io/n8n/issues/4430)
- [GitHub Issue: Publishing release doesn't publish to Marketplace](https://github.com/orgs/community/discussions/7941)
- [GitHub Issue: api.add_comment returns 400 Client Error (new task ID formatting)](https://github.com/Doist/todoist-api-python/issues/131)
- [GitHub Discussion: Can not publish action to marketplace](https://github.com/orgs/community/discussions/25694)
- [GitHub Discussion: Missing Publish Checkbox](https://github.com/orgs/community/discussions/24965)
- [GitHub Discussion: Node.js 16 to Node 20 Migration](https://github.com/actions/upload-artifact/issues/444)
- [GitHub Discussion: Version Numbering for Actions](https://github.com/orgs/community/discussions/25248)
- [GitHub Actions Toolkit: Action Versioning](https://github.com/actions/toolkit/blob/main/docs/action-versioning.md)

### Security Resources
- [StepSecurity: GITHUB_TOKEN Security Guide](https://www.stepsecurity.io/blog/github-token-how-it-works-and-how-to-secure-automatic-github-action-tokens)
- [BleepingComputer: GitHub Actions artifacts found leaking auth tokens](https://www.bleepingcomputer.com/news/security/github-actions-artifacts-found-leaking-auth-tokens-in-popular-projects/)
- [Arctiq: Top 10 GitHub Actions Security Pitfalls](https://arctiq.com/blog/top-10-github-actions-security-pitfalls-the-ultimate-guide-to-bulletproof-workflows)

### Community Resources
- [Rollout: Todoist API Essentials](https://rollout.com/integration-guides/todoist/api-essentials)
- [GitHub: todoist-api-typescript](https://github.com/Doist/todoist-api-typescript)
- [GitHub Actions Runner Node.js Plan](https://github.com/orgs/community/discussions/160454)

---
*Pitfalls research for: Todoist API Migration & GitHub Marketplace Publishing*
*Researched: 2026-02-11*
*Confidence: MEDIUM-HIGH (verified with official docs + community issues + codebase analysis)*
