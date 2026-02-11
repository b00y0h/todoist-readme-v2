# Phase 04: Marketplace Publishing - Research

**Researched:** 2026-02-11
**Domain:** GitHub Marketplace Publishing, GitHub Actions Release Management
**Confidence:** HIGH

## Summary

GitHub Marketplace publishing for GitHub Actions is a straightforward process with specific requirements around metadata, naming, and versioning. The critical success factor is implementing the major version tag strategy correctly—users expect to reference actions via major version tags (v1, v2) that automatically point to the latest compatible release within that major version.

Publishing requires a public repository with an action.yml metadata file, acceptance of the GitHub Marketplace Developer Agreement, and two-factor authentication. Actions appear in marketplace search immediately upon publication without GitHub review, making the process fast but placing responsibility on maintainers for quality and documentation.

The most overlooked aspect is proper migration documentation. Users upgrading from v1 to v2 need clear guidance on breaking changes and upgrade steps, yet this is often missing even in popular GitHub-maintained actions. Best practice is prominent migration guidance in the README with explicit warnings about deprecated versions.

**Primary recommendation:** Use semantic versioning with automated major version tag management (actions-tagger), create comprehensive README with migration guide, and establish a release workflow that bundles compiled code separately from development branches.

## Standard Stack

### Core Publishing Requirements
| Component | Specification | Purpose | Why Required |
|-----------|---------------|---------|--------------|
| action.yml | YAML metadata file at repo root | Defines action inputs, outputs, runtime | GitHub Marketplace requirement |
| Public repository | GitHub public repo | Host action code | Marketplace only accepts public actions |
| Semantic versioning | MAJOR.MINOR.PATCH format | Track compatibility and changes | GitHub Actions versioning convention |
| 2FA enabled | Two-factor authentication | Security requirement | Marketplace publishing prerequisite |
| Developer Agreement | GitHub Marketplace terms | Legal acceptance | Required before first publish |

### Supporting Tools
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| actions-tagger | v2+ | Auto-update major version tags | Every release to maintain v1, v2 tags |
| @vercel/ncc | 0.38.4 | Bundle Node.js action for distribution | Node.js actions requiring dependencies |
| github-action-readme-generator | Latest | Auto-generate usage docs from action.yml | Keep README inputs/outputs in sync |

### Alternatives Considered
| Standard Approach | Alternative | Tradeoff |
|-------------------|-------------|----------|
| actions-tagger | Manual git tag management | Manual = error-prone, easy to forget minor tags |
| Semantic versioning | Calendar versioning | SemVer expected by ecosystem, breaking changes unclear with CalVer |
| README migration guide | Separate MIGRATION.md file | Separate file gets missed, inline section more visible |

**Installation (for actions-tagger):**
```yaml
# Add to .github/workflows/release.yml
- uses: Actions-R-Us/actions-tagger@v2
  with:
    publish_latest_tag: true
```

## Architecture Patterns

### Recommended Repository Structure
```
.
├── action.yml              # Metadata file (REQUIRED at root)
├── README.md               # Usage docs with migration guide
├── CHANGELOG.md            # Release notes organized by version
├── index.js                # Source code (development)
├── dist/
│   └── index.js           # Bundled code (released versions only)
├── .github/
│   └── workflows/
│       ├── ci.yml         # Test on PRs and commits
│       └── release.yml    # Publish on release creation
└── node_modules/          # NOT committed to main branch
```

### Pattern 1: Major Version Tag Strategy
**What:** Maintain v1, v2, v3 tags pointing to latest compatible release
**When to use:** Every semantic version release
**Why:** Users expect `uses: owner/action@v2` to get latest v2.x.x automatically

**Example workflow:**
```yaml
# .github/workflows/release.yml
name: Release
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      # Bundle the code
      - run: |
          npm ci
          npx @vercel/ncc build index.js -o dist

      # Commit bundled code to release branch
      - run: |
          git config --local user.name "github-actions[bot]"
          git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add dist/
          git commit -m "chore: bundle for release ${{ github.event.release.tag_name }}"
          git push

      # Update major version tags (v1, v2, etc.)
      - uses: Actions-R-Us/actions-tagger@v2
        with:
          publish_latest_tag: true
```

**Source:** [GitHub Actions Toolkit - Action Versioning](https://github.com/actions/toolkit/blob/main/docs/action-versioning.md)

### Pattern 2: README Migration Guide Section
**What:** Dedicated section in README explaining breaking changes and upgrade steps
**When to use:** Any major version release (v1 → v2, v2 → v3)
**Why:** Users need clear upgrade path, reduces support burden

**Example structure:**
```markdown
## Migration Guide

### Upgrading from v1 to v2

**Breaking Changes:**
- Input `PREMIUM` changed from boolean to string (`"true"`/`"false"`)
- Minimum Node.js runtime: Node 16 → Node 20
- Action now requires `contents: write` permission for commits

**Upgrade Steps:**

1. **Update action reference:**
   ```diff
   - uses: owner/action@v1
   + uses: owner/action@v2
   ```

2. **Update workflow permissions:**
   ```yaml
   permissions:
     contents: write
   ```

3. **Update PREMIUM input (if used):**
   ```diff
   - PREMIUM: true
   + PREMIUM: "true"
   ```

4. **Verify GitHub Actions runner version:**
   - Required: v2.327.1 or newer
   - Self-hosted runners: Update before upgrading

**Deprecation Notice:**
v1 will receive security updates until 2027-01-01. No new features will be backported.
```

**Source:** [actions/cache README - Migration Guidance](https://github.com/actions/cache)

### Pattern 3: Changelog Organization
**What:** CHANGELOG.md organized by semantic version with clear breaking change markers
**When to use:** Every release
**Why:** Provides historical reference, helps users understand version impact

**Example format:**
```markdown
# Changelog

## [2.0.0] - 2026-02-15

### Breaking Changes
- Changed Node.js runtime from Node 16 to Node 20
- Removed deprecated `USERNAME` input

### Added
- Support for granular stat tag customization
- Auto-detection of GitHub actor for commits

### Changed
- Improved error messages for API failures
- Updated rate limiting with exponential backoff

## [1.2.0] - 2025-08-10

### Added
- Support for weekly stats (premium users)

### Fixed
- Fixed edge case with empty streak data
```

**Source:** [Keep a Changelog](https://keepachangelog.com/) + GitHub ecosystem practices

### Anti-Patterns to Avoid

- **Bundled code in main branch:** Commit dist/ only to release tags/branches, not main. Prevents PR pollution and security risks from unreviewed compiled code.
- **Missing major version tags:** Users expect @v2 to work. Manual tagging is error-prone—use actions-tagger.
- **README-only migration docs:** Separate MIGRATION.md files get missed. Inline migration section in README ensures visibility.
- **"See releases for changes":** Users need context in README. Add prominent deprecation warnings for old versions.
- **action.yaml filename switching:** Changing between action.yml and action.yaml between releases breaks marketplace visibility of previous versions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Major version tag automation | Custom git tag scripts | actions-tagger | Handles v1, v2, latest tags + edge cases like existing tags |
| README documentation generation | Manual input/output tables | github-action-readme-generator | Auto-syncs with action.yml, prevents drift |
| Changelog generation | Manual release notes | Release Changelog Builder | Generates from commits, consistent formatting |
| Semantic version bumping | Manual version decisions | Git commit message conventions | Conventional commits determine MAJOR/MINOR/PATCH automatically |

**Key insight:** Release automation has many edge cases (existing tags, force-push scenarios, concurrent releases). Use battle-tested actions that handle these, don't reinvent.

## Common Pitfalls

### Pitfall 1: Runner Doesn't Apply Semantic Versioning Semantics
**What goes wrong:** Users reference `@v3.1` expecting "any v3.1.x version" but workflow fails with "ref not found"
**Why it happens:** GitHub Actions runner performs **literal tag matching**—it looks for exact tag "v3.1", not latest v3.1.x
**How to avoid:** Create all SemVer tag variants: v3.1.5 (specific), v3.1 (minor), v3 (major)
**Warning signs:** User reports "action not found" despite v3.1.5 tag existing

**Source:** [DevOps Journal - How GitHub Actions Versioning Works](https://devopsjournal.io/blog/2022/10/19/How-GitHub-Actions-versioning-works)

### Pitfall 2: Marketplace Publishing Checkbox Disabled
**What goes wrong:** "Publish to Marketplace" checkbox grayed out when creating release
**Why it happens:** Repository owner/organization hasn't accepted GitHub Marketplace Developer Agreement
**How to avoid:** Navigate to action.yml in GitHub UI—banner appears prompting agreement acceptance
**Warning signs:** Cannot check marketplace box, no error message explaining why

**Source:** [GitHub Docs - Publishing Actions in Marketplace](https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace)

### Pitfall 3: Sparse Migration Documentation
**What goes wrong:** Users upgrade to v2, workflows break, no clear upgrade path
**Why it happens:** Maintainers document *what changed* in changelog but not *how to upgrade*
**How to avoid:**
  - Add "Migration Guide" section to README with step-by-step upgrade instructions
  - Include breaking changes, required permission changes, input format changes
  - Provide before/after workflow examples
  - Add deprecation timeline for old versions
**Warning signs:** Issues asking "how do I upgrade to v2?" flood repo

**Example:** actions/checkout has minimal migration documentation in CHANGELOG, users rely on release notes

### Pitfall 4: Committing Dependencies to Main Branch
**What goes wrong:** node_modules or dist/ in main branch causes PR noise, security review burden
**Why it happens:** Misunderstanding GitHub's recommendation—dependencies should be committed to *release tags*, not main
**How to avoid:**
  - Exclude dist/ and node_modules/ from main branch (.gitignore)
  - Bundle code in release workflow, commit to release branch/tag only
  - Users reference release tags (v2.0.0) or major tags (v2), which have bundled code
**Warning signs:** Every PR shows massive dist/index.js changes, dependency updates cause huge diffs

**Source:** [GitHub Docs - Release and Maintain Actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions)

### Pitfall 5: Missing Branding Icons/Colors
**What goes wrong:** Action appears in marketplace with generic icon, harder to find/recognize
**Why it happens:** Branding section in action.yml is optional, easy to overlook
**How to avoid:** Add branding section with icon and color from allowed lists
**Warning signs:** Marketplace listing looks plain compared to similar actions

**Allowed colors:** white, black, yellow, blue, green, orange, red, purple, gray-dark
**Allowed icons:** 200+ from Feather v4.28.0 (activity, award, check, git-branch, etc.)
**Excluded icons:** coffee, columns, divide-*, frown, hexagon, key, meh, mouse-pointer, smile, tool, x-octagon

**Source:** [GitHub Docs - Metadata Syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)

## Code Examples

### Complete action.yml with Marketplace Metadata
```yaml
# Source: GitHub Docs - Metadata Syntax
name: 'Todoist Readme v2'
author: 'Your Name'
description: 'Updates README with your Todoist productivity stats using modern API'

# Branding for marketplace appearance
branding:
  icon: 'activity'
  color: 'red'

# Inputs define user-configurable parameters
inputs:
  TODOIST_API_KEY:
    description: 'Your Todoist API Key'
    required: true

  PREMIUM:
    description: 'Premium user flag ("true" or "false")'
    default: 'false'
    required: false

# Outputs can be used by subsequent workflow steps
outputs:
  stats_updated:
    description: 'Whether stats were updated (true/false)'

# Runtime configuration
runs:
  using: "node20"
  main: "dist/index.js"
```

### Release Workflow with Bundle and Tag Automation
```yaml
# Source: Composite of GitHub Actions best practices
name: Release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      # Install dependencies and bundle
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Bundle with ncc
        run: npx @vercel/ncc build index.js -o dist

      # Commit bundled code to release
      - name: Commit bundled code
        run: |
          git config --local user.name "github-actions[bot]"
          git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add dist/
          git commit -m "chore: bundle for ${{ github.event.release.tag_name }}"
          git tag -fa ${{ github.event.release.tag_name }} -m "Release ${{ github.event.release.tag_name }}"
          git push origin ${{ github.event.release.tag_name }} --force

      # Auto-update major version tags
      - uses: Actions-R-Us/actions-tagger@v2
        with:
          publish_latest_tag: true
```

### README Usage Section Template
```markdown
# Source: Common pattern across popular GitHub Actions

## Usage

Add this action to your workflow:

```yaml
name: Update Todoist Stats

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:

jobs:
  update-stats:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: your-username/todoist-readme@v2
        with:
          TODOIST_API_KEY: ${{ secrets.TODOIST_API_KEY }}
          PREMIUM: "true"
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `TODOIST_API_KEY` | ✓ | - | Your Todoist API token from [Integrations](https://todoist.com/prefs/integrations) |
| `PREMIUM` | | `"false"` | Set to `"true"` if you have Todoist Premium for weekly stats |

### Setup

1. Get your Todoist API token from [Integrations page](https://todoist.com/prefs/integrations)
2. Add token as repository secret: `Settings > Secrets > New secret`
   - Name: `TODOIST_API_KEY`
   - Value: Your API token
3. Add workflow file (above) to `.github/workflows/todoist.yml`
4. Add markers to your README.md:
   ```markdown
   <!-- TODO-IST:START -->
   <!-- TODO-IST:END -->
   ```

## Migration Guide

### Upgrading from v1 to v2

[See Pattern 2 example above for complete migration guide structure]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node 12/14/16 | Node 20 | 2024-2025 | Actions must update runtime, GitHub deprecating old Node versions |
| Hardcoded committer identity | GitHub actor auto-detection | Best practice | Commits correctly attributed to workflow runner |
| Manual major version tags | Automated via actions-tagger | Community tool | Reduced manual errors, consistent tagging |
| @actions/core 3.0.0 | @actions/core 1.11.1 | ESM compatibility | v3 ESM exports incompatible with ncc bundler |
| cache service v1 | cache service v2 | Feb 2025 | Deprecated packages fail after March 1, 2025 |

**Deprecated/outdated:**
- **Node 12/14/16 runtimes:** GitHub Actions runner no longer supports, minimum Node 20
- **actions/cache v2 and older:** Legacy cache service sunset Feb 1, 2025—upgrade to v4 required
- **Manual `git tag -fa v1` workflows:** Error-prone, use actions-tagger instead
- **action.yaml alternating with action.yml:** Breaks marketplace visibility between releases

## Open Questions

1. **What are the complete marketplace category options?**
   - What we know: Categories include CI/CD, Security, Deployment, Testing, Code Quality, Automation
   - What's unclear: Full official list not documented in GitHub Docs search results
   - Recommendation: Select categories from dropdown when publishing, documented categories: Continuous Integration, Deployment, Security, Code Quality, Testing, Monitoring, Project Management, Automation

2. **Does marketplace search ranking favor verified creators?**
   - What we know: Verified creator badge exists, indicates GitHub-verified partner (contact partnerships@github.com)
   - What's unclear: Whether verification affects search ranking or just badge display
   - Recommendation: Focus on good documentation and usage examples, verification is for partners

3. **Can we automate marketplace category selection?**
   - What we know: Categories selected via dropdown during release creation, not in action.yml
   - What's unclear: No API or action.yml field for automation
   - Recommendation: Select categories manually during first publish, persist across releases

## Sources

### Primary (HIGH confidence)
- [GitHub Docs - Publishing Actions in Marketplace](https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace) - Requirements, process
- [GitHub Docs - Metadata Syntax for GitHub Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions) - action.yml branding, inputs, outputs
- [GitHub Docs - Release and Maintain Actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions) - Best practices, versioning, testing
- [GitHub Actions Toolkit - Action Versioning](https://github.com/actions/toolkit/blob/main/docs/action-versioning.md) - Major version strategy, compatibility guarantees
- [actions/checkout CHANGELOG](https://github.com/actions/checkout/blob/main/CHANGELOG.md) - Real-world versioning example

### Secondary (MEDIUM confidence)
- [DevOps Journal - How GitHub Actions Versioning Works](https://devopsjournal.io/blog/2022/10/19/How-GitHub-Actions-versioning-works) - Runner behavior, literal tag matching
- [Actions-R-Us/actions-tagger](https://github.com/Actions-R-Us/actions-tagger) - Automation tool for major version tags
- [actions/cache README](https://github.com/actions/cache) - Migration documentation examples
- Multiple blog posts about GitHub Actions release automation (2026)

### Tertiary (LOW confidence)
- GitHub Marketplace category list - Inferred from search results, not official docs
- Verification badge impact on ranking - Not documented, assumed display-only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official GitHub documentation, established tools
- Architecture patterns: HIGH - GitHub official docs + toolkit guidance + real-world examples
- Common pitfalls: HIGH - Verified through official docs and real action repositories
- Marketplace categories: MEDIUM - Partial list from community, no official complete list found
- Automation tools: HIGH - actions-tagger is widely used, official recommendation pattern

**Research date:** 2026-02-11
**Valid until:** 2026-03-15 (30 days - stable domain, but GitHub may update marketplace requirements)
**Verification recommendation:** Before Phase 4 execution, verify actions-tagger compatibility with latest GitHub Actions runner
