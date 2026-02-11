# Phase 3: Git Operations Modernization - Research

**Researched:** 2026-02-11
**Domain:** GitHub Actions git operations and identity management
**Confidence:** HIGH

## Summary

Phase 3 focuses on modernizing the git commit workflow in a GitHub Action by replacing hardcoded author credentials with dynamic detection from GitHub Actions context, using proper git configuration scopes, and implementing smart change detection to avoid empty commits. The current implementation (lines 311-324 in index.js) uses hardcoded author information ("Abhishek Naidu" and "example@gmail.com") with global git config scope, which is considered bad practice for reusable GitHub Actions.

The GitHub Actions context provides `github.actor` (username) and `github.actor_id` (numeric user ID) that can be used to construct proper noreply email addresses in the format `{USER-ID}+{USERNAME}@users.noreply.github.com`. Git config should use `--local` scope instead of `--global` to prevent configuration leakage to other workflow steps. Change detection can be implemented using `git diff-index --quiet HEAD` to exit early when no changes exist, avoiding unnecessary commits and API calls.

**Primary recommendation:** Use `github.actor_id` and `github.actor` from GitHub Actions context to construct noreply email addresses, configure git with `--local` scope, and implement `git diff-index --quiet HEAD` for change detection.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @actions/core | Current | GitHub Actions integration | Official GitHub Actions toolkit for input/output/logging |
| child_process (spawn) | Node built-in | Git command execution | Already used in exec.js, native Node.js approach |
| GitHub Actions context | N/A (runtime) | Access workflow metadata | Standard way to access actor, event, and repository context |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs | Node built-in | File comparison for change detection | To verify README changed before git operations |
| @actions/github | Latest | Advanced GitHub API access | NOT needed for this phase - context is available via environment variables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| noreply email | github.event.pusher.email | Only available in push events, not workflow_dispatch or schedule triggers |
| git diff-index | fs.readFileSync comparison | Less reliable, doesn't catch git staging issues |
| @actions/github | Direct environment variables | @actions/github adds dependency overhead for simple context access |

**Installation:**
No new dependencies required - all functionality available via existing Node.js built-ins and GitHub Actions runtime environment.

## Architecture Patterns

### Recommended Implementation Structure
```
commitReadme()
├── detectChanges()        // Check if README actually changed
├── getActorIdentity()     // Extract from GitHub context
├── configureGit()         // Set local git config
└── executeCommit()        // Add, commit, push sequence
```

### Pattern 1: GitHub Actions Context Access
**What:** Access workflow context via process.env or github context object
**When to use:** Need workflow actor, repository, or event information
**Example:**
```javascript
// Direct environment variable access (works in any GitHub Action)
const actor = process.env.GITHUB_ACTOR;
const actorId = process.env.GITHUB_ACTOR_ID;

// Construct noreply email
const email = `${actorId}+${actor}@users.noreply.github.com`;
const name = actor;
```
**Source:** [GitHub Actions context documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts) and [GitHub community discussion #40405](https://github.com/orgs/community/discussions/40405)

### Pattern 2: Local Git Configuration Scope
**What:** Use `--local` flag instead of `--global` for repository-specific git config
**When to use:** Always in GitHub Actions to prevent config leakage between workflow steps
**Example:**
```javascript
// DON'T: Global scope pollutes other steps
await exec("git", ["config", "--global", "user.email", email]);

// DO: Local scope isolated to current repository
await exec("git", ["config", "--local", "user.email", email]);
await exec("git", ["config", "--local", "user.name", name]);
```
**Source:** [Git configuration scopes documentation](https://git-scm.com/docs/git-config) and [Configure git credentials action](https://github.com/marketplace/actions/configure-git-credentials)

### Pattern 3: Change Detection Before Commit
**What:** Use `git diff-index --quiet HEAD` to detect if staged changes exist
**When to use:** Before committing to avoid empty commits and unnecessary workflow runs
**Example:**
```javascript
// Check if there are staged changes
// Exit code 0 = no changes, Exit code 1 = changes exist
const { exitCode } = await exec("git", ["diff-index", "--quiet", "HEAD", "--"], {
  ignoreReturnCode: true
});

if (exitCode === 0) {
  core.info("No changes detected, skipping commit");
  return;
}
```
**Source:** [git-diff-index documentation](https://git-scm.com/docs/git-diff-index) and [codegenes.net git diff-index explanation](https://www.codegenes.net/blog/what-does-this-git-diff-index-quiet-head-mean/)

### Pattern 4: Noreply Email Construction
**What:** Use GitHub's standardized noreply email format for bot/action commits
**When to use:** When committing from GitHub Actions without user's actual email
**Example:**
```javascript
// For GitHub Actions bot (not actor)
const botEmail = "41898282+github-actions[bot]@users.noreply.github.com";
const botName = "github-actions[bot]";

// For workflow actor (user who triggered workflow)
const actorEmail = `${process.env.GITHUB_ACTOR_ID}+${process.env.GITHUB_ACTOR}@users.noreply.github.com`;
const actorName = process.env.GITHUB_ACTOR;
```
**Source:** [GitHub community discussion #26560](https://github.com/orgs/community/discussions/26560) and [Email addresses reference](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)

### Anti-Patterns to Avoid
- **Hardcoded credentials:** Never hardcode author name/email - breaks for all other users
- **Global git config in actions:** Leaks configuration to subsequent workflow steps
- **Committing without change detection:** Wastes GitHub Actions minutes and creates noise
- **Using github.event.pusher.email:** Only available in push events, fails for schedule/workflow_dispatch triggers
- **Attempting to get real user email:** Privacy violation, use noreply addresses instead

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Change detection | File content comparison | `git diff-index --quiet HEAD` | Git knows about staging area, index, and uncommitted changes - file comparison misses edge cases |
| Email validation | Regex email validators | GitHub noreply format | GitHub's noreply format is guaranteed valid and provides attribution |
| Git config isolation | Manual config save/restore | `--local` scope flag | Git's built-in scoping handles isolation correctly and atomically |
| Commit identity detection | Parsing git log or API calls | GitHub Actions environment variables | Runtime environment provides reliable, pre-validated context |

**Key insight:** Git and GitHub Actions provide battle-tested primitives for these operations. Custom solutions introduce bugs around edge cases (empty repositories, merge commits, detached HEAD states, concurrent workflows).

## Common Pitfalls

### Pitfall 1: Using --global Scope in GitHub Actions
**What goes wrong:** Global git config persists across workflow steps and can affect other actions in the same job that make git commits.
**Why it happens:** Most git tutorials teach `--global` as the default for user setup, developers copy this pattern into Actions.
**How to avoid:** Always use `--local` scope in GitHub Actions workflows. Local config is stored in `.git/config` and isolated to the current repository checkout.
**Warning signs:**
- Other actions in workflow show unexpected committer identity
- Multi-repository workflows commit with wrong author
- Workflow logs show "warning: unable to access global config"

**Source:** [Git configuration best practices](https://medium.com/@yadavprakhar1809/understanding-the-three-levels-of-git-config-local-global-and-system-e95c26aac8ee) and [Configure git credentials action](https://github.com/marketplace/actions/configure-git-credentials)

### Pitfall 2: Empty Commits on Unchanged Files
**What goes wrong:** Action creates commit even when README content unchanged, leading to commit spam and wasted CI minutes.
**Why it happens:** Writing file back even when content identical, or not checking git diff before commit.
**How to avoid:**
1. Compare new content with old content before writing file (current implementation has this)
2. After staging, use `git diff-index --quiet HEAD` to verify changes exist before commit
**Warning signs:**
- Multiple identical commits with same timestamp
- Workflow runs every time but README unchanged
- Git history shows commits with no actual diff

**Source:** [Simon Willison's TIL - Commit if file changed](https://til.simonwillison.net/github-actions/commit-if-file-changed)

### Pitfall 3: Missing GITHUB_ACTOR_ID Environment Variable
**What goes wrong:** `GITHUB_ACTOR_ID` environment variable not available in older GitHub Actions runners or certain trigger types.
**Why it happens:** Variable was added relatively recently to GitHub Actions, may not exist in all contexts.
**How to avoid:**
- Use fallback logic if `GITHUB_ACTOR_ID` is undefined
- For scheduled workflows, actor is last person to edit workflow file
- Consider using generic bot identity as fallback
**Warning signs:**
- Email becomes `undefined+username@users.noreply.github.com`
- Commits don't show up with proper attribution in GitHub UI
- Workflow logs show "GITHUB_ACTOR_ID is not set"

**Mitigation:**
```javascript
const actorId = process.env.GITHUB_ACTOR_ID || '41898282'; // fallback to github-actions bot ID
const actor = process.env.GITHUB_ACTOR || 'github-actions[bot]';
```

**Source:** [GitHub Actions context reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)

### Pitfall 4: Template Tag Marker Assumptions
**What goes wrong:** Assuming README template markers exist or are correctly formatted when injecting content.
**Why it happens:** Current code has good error handling in `buildReadme()` but could fail silently in edge cases.
**How to avoid:** Already handled in current implementation - `buildReadme()` checks for marker existence and exits with error if not found.
**Warning signs:**
- Silent failures where stats not injected
- README corrupted with malformed content
- Tags partially present (START without END)

**Current mitigation:** Existing code properly validates markers and exits with clear error messages. Phase 3 should preserve this behavior.

## Code Examples

Verified patterns from official sources and existing codebase:

### Detecting Actor Identity
```javascript
// Source: GitHub Actions environment variables
// https://docs.github.com/en/actions/reference/workflows-and-actions/contexts

function getActorIdentity() {
  const actor = process.env.GITHUB_ACTOR;
  const actorId = process.env.GITHUB_ACTOR_ID;

  if (!actor || !actorId) {
    // Fallback to github-actions bot for safety
    return {
      name: 'github-actions[bot]',
      email: '41898282+github-actions[bot]@users.noreply.github.com'
    };
  }

  return {
    name: actor,
    email: `${actorId}+${actor}@users.noreply.github.com`
  };
}
```

### Configuring Git with Local Scope
```javascript
// Source: Git documentation and GitHub Actions best practices
// https://git-scm.com/docs/git-config

async function configureGit(identity) {
  // Use --local to prevent config leakage
  await exec("git", ["config", "--local", "user.email", identity.email]);
  await exec("git", ["config", "--local", "user.name", identity.name]);
}
```

### Detecting Changes Before Commit
```javascript
// Source: git-diff-index documentation
// https://git-scm.com/docs/git-diff-index

async function hasChanges() {
  try {
    // --quiet implies --exit-code
    // Returns exit code 0 if no changes, 1 if changes exist
    await exec("git", ["diff-index", "--quiet", "HEAD", "--"]);
    // Exit code 0 = no changes
    return false;
  } catch (error) {
    // Exit code 1 = changes exist
    if (error.code === 1) {
      return true;
    }
    // Other errors (e.g., no HEAD on new repo)
    throw error;
  }
}
```

### Complete Modern Commit Function
```javascript
// Combining all patterns
async function commitReadme() {
  // 1. Check if changes exist
  const changed = await hasChanges();
  if (!changed) {
    core.info("No changes to commit, skipping");
    return;
  }

  // 2. Get actor identity from GitHub context
  const identity = getActorIdentity();
  core.info(`Committing as ${identity.name} <${identity.email}>`);

  // 3. Configure git with local scope
  await configureGit(identity);

  // 4. Execute commit sequence
  const commitMessage = "Update Todoist stats";
  await exec("git", ["add", README_FILE_PATH]);
  await exec("git", ["commit", "-m", commitMessage]);
  await exec("git", ["push"]);

  core.info("README updated successfully");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded author info | Dynamic actor detection | 2020+ | Actions work for all users without modification |
| --global git config | --local git config | Always recommended | Prevents config pollution between workflow steps |
| Always commit | Change detection first | Best practice | Reduces noise commits and wasted CI minutes |
| Real email addresses | Noreply format | GitHub privacy standards | Protects user privacy, maintains attribution |
| Manual identity parsing | GITHUB_ACTOR environment vars | Built into Actions runtime | Reliable, no parsing errors |

**Deprecated/outdated:**
- **github.event.pusher.email**: Only works for push events, not schedule or workflow_dispatch triggers
- **Hardcoded bot emails without user ID**: Commits don't link to GitHub accounts properly
- **Global git config in CI**: Never recommended, causes cross-contamination in multi-step workflows

## Open Questions

1. **Should we use github.actor or github-actions[bot] as committer?**
   - What we know: Both are valid, github.actor attributes to triggering user, bot is neutral
   - What's unclear: User preference for who appears as committer in their README updates
   - Recommendation: Use github.actor (triggering user) since they configured the action and it's their profile README

2. **Fallback behavior when GITHUB_ACTOR_ID missing?**
   - What we know: Variable may not exist in all contexts (older runners, certain triggers)
   - What's unclear: How common is this issue in practice with Node 20 runtime
   - Recommendation: Add defensive fallback to github-actions[bot] identity if env vars missing

3. **Should change detection be double-checked?**
   - What we know: Current code compares README content before writing (line 264), git diff-index adds second layer
   - What's unclear: Whether file comparison is sufficient or git diff-index adds meaningful safety
   - Recommendation: Keep file comparison, add git diff-index as additional safety check before commit

## Sources

### Primary (HIGH confidence)
- [GitHub Actions Contexts Reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts) - Official GitHub documentation for github.actor and github.actor_id
- [git-diff-index Documentation](https://git-scm.com/docs/git-diff-index) - Official Git documentation for change detection
- [git-config Documentation](https://git-scm.com/docs/git-config) - Official Git documentation for configuration scopes
- [GitHub Email Addresses Reference](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference) - Official documentation for noreply email format

### Secondary (MEDIUM confidence)
- [GitHub Community Discussion #40405](https://github.com/orgs/community/discussions/40405) - Get user email from GitHub action
- [GitHub Community Discussion #26560](https://github.com/orgs/community/discussions/26560) - GitHub Actions bot email address
- [Medium: Understanding Git Config Levels](https://medium.com/@yadavprakhar1809/understanding-the-three-levels-of-git-config-local-global-and-system-e95c26aac8ee) - Configuration scope best practices
- [Simon Willison's TIL](https://til.simonwillison.net/github-actions/commit-if-file-changed) - Practical GitHub Actions patterns
- [codegenes.net: git diff-index explanation](https://www.codegenes.net/blog/what-does-this-git-diff-index-quiet-head-mean/) - Detailed explanation of git diff-index usage

### Tertiary (LOW confidence)
- None - all findings verified with official sources or multiple credible sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - GitHub Actions context and git commands are well-documented and stable
- Architecture: HIGH - Patterns verified in official docs and widely-used marketplace actions
- Pitfalls: MEDIUM-HIGH - Based on community discussions and observed issues, some edge cases theoretical

**Research date:** 2026-02-11
**Valid until:** 90 days (2026-05-12) - Git and GitHub Actions APIs are stable, slow-moving
