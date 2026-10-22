---
name: release
description: Prepare and verify a release per modules/releases.mdc - confirm every gate is green, feature flags and debt deadlines are respected, migrations are release-safe, the release PR / tag is produced from conventional commits, canary and rollback are ready, and post-release verification is planned. Use when asked to release, cut a version, or ship to production.
---

# /release [version]

Releasing is outward-facing. Every step that deploys, tags, or publishes
requires explicit confirmation from the user before it runs.

## Pre-flight (read-only, report before doing anything)

1. `git status` clean, on `main` (or the release branch), up to date.
2. CI on the release commit: commit gate, PR gate, and the pre-production
   workflow all green. Paste the run links. A red or missing run stops here.
3. `TEST_PLAN.md`: no `planned` category past its date.
4. `DEBT.md`: no open item past its deadline.
5. `FEATURE_FLAGS.md`: no flag past its removal date; list flags that this
   release enables or removes.
6. Migrations since the last tag: each is either additive or a documented
   expand/contract step; destructive steps have a rollback file and were
   tested (`MIGRATIONS_CHANGELOG.md`).
7. Rollback plan exists and was exercised on the release candidate
   (pre-production workflow `data-and-config` job).
8. Exploratory testing session for this release logged in `TEST_PLAN.md`
   "Human testing".
9. Draft release notes from conventional commits since the last tag
   (`git log <last tag>..HEAD --pretty=format:'%s'`) grouped by type; flag any
   commit whose message is not release-note quality.

Report the pre-flight as a table. Stop on any failure.

## Release (each step confirmed)

1. Run the release tool declared in `PROJECT.md` (release-please PR merge,
   `changeset version`, or `semantic-release`). Never hand-edit
   `CHANGELOG.md`.
2. Verify the tag exists and is signed.
3. Trigger the deploy workflow; watch the canary window (error rate, p95
   latency, smoke and synthetic checks) until promotion or automatic
   rollback.
4. Post-release verification: smoke suite against production, error tracker
   release marked and source maps uploaded, dashboards checked.
5. Mobile: staged rollout percentages and phased release settings confirmed.

## After

- Record the release in `PROJECT.md` if the stack or a decision changed.
- Open follow-up issues for flags to remove and debt that became due.
- Report: version, what shipped, verification results, anything not verified.
