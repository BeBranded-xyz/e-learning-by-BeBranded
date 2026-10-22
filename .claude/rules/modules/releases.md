---
description: Versioning and release management - semver, signed tags, automated changelog, feature flags, progressive delivery, rollback, mobile store releases. Apply to changelog and release files.
paths:
  - "CHANGELOG.md"
  - "**/release*"
  - ".github/workflows/release*"
---

# Releases & Versioning

## When this applies

Apply to every file matching the globs and to any work that ships code to
users. The release tool, flag registry, SLO thresholds, canary steps, and store
accounts live in `PROJECT.md`. Branching, commits, and the hotfix procedure are
in `core/github-workflow.mdc`; pipelines and environments in
`modules/infra.mdc`; migrations in `modules/database.mdc`. Deployment triggers
and affected-unit selection follow `modules/deployments.mdc`. Versioning jobs
must not independently redeploy the application or require redeploying all units.
For published packages, `modules/library-publishing.mdc` replaces the canary,
progressive delivery, and rollback sections.

**This rule is the authority on `CHANGELOG.md`.** It supersedes any hand-written
changelog format: `core/github-workflow.mdc` defers here, the changelog is
generated from conventional commits, nobody edits `CHANGELOG.md` by hand, and
the "commit messages are release-note quality" box in the PR documentation
checklist is satisfied by a correctly typed and scoped conventional commit.

## Principles

- **A release is a tagged, signed, reproducible artifact**, not a point in time.
- **Ship small and often**; a release that is hard to roll back is too big.
- **Incomplete work ships dark** behind a flag; a branch is not a hiding place.
- **Every release is verified after deploy** and rolled back automatically when
  it breaks the SLO.
- **Rollback is practiced**, not theoretical.

## Rules

### Versioning

Semantic versioning everywhere; the version is derived from commits, never
typed by hand.

| Commit type | Library bump | App bump |
|---|---|---|
| `feat` | minor | minor |
| `fix`, `perf` | patch | patch |
| `feat!` or `BREAKING CHANGE:` footer | major | major only when a public API, data format, or supported platform changes |
| `refactor`, `chore`, `docs`, `ci`, `test`, `style` | none | none |

- **Libraries** follow semver strictly against their public API; a type-level
  break is a break.
- **Apps** may use calendar versioning if `PROJECT.md` says so; bump rules
  still map from commit types.
- **`0.x` is not an excuse**: a breaking change in `0.x` still bumps minor and
  is called out in the release notes.
- **The version lives in one place** (`package.json`, `pyproject.toml`,
  `Cargo.toml`, or `VERSION`) and is injected into builds and traces.

### Tags and release notes

- **Every release is a git tag `vX.Y.Z`**, signed (`git tag -s` with an SSH or
  GPG key registered on the forge), created by the release tool, never by hand.
- **Release notes are generated** from conventional commits by the tool chosen
  in `PROJECT.md`: `release-please` (default for apps and monorepos),
  `changesets` (multi-package libraries), or `semantic-release`.
- **`CHANGELOG.md` is automated and never hand-written**; a PR that edits it
  manually is rejected. Write the user-facing sentence in the commit subject.
- **Scopes in commits become sections** in the notes; a user-facing change
  without a scope is a review comment.
- **The release PR** (or release commit) is the single review point: version
  bump, notes, and tag in one place.

### Release branches

- **Deploy affected units after a PR merges into `main`**, continuously.
  Run impact analysis on every merge, independently of whether release notes
  or a new version are generated. Rollout and rollback are scoped to selected units.
- **Default: release from `main`**, continuously. Create `release/X.Y` only
  when `PROJECT.md` requires supporting more than one version in production
  (on-prem, mobile, SDKs).
- **Release branches receive cherry-picks only**, from commits already merged
  to `main`; never develop on a release branch.
- **Delete the branch** when the version leaves support.

### Feature flags

- **Incomplete work ships behind a flag**, merged to `main` continuously; no
  long-lived feature branches.
- **Flag lifecycle**: create (registered in the `PROJECT.md` flag registry with
  owner, purpose, creation date, planned removal date) -> ship dark (off in
  production) -> enable gradually (internal users, 1%, 10%, 50%, 100%) ->
  remove within 30 days of reaching 100%.
- **A flag past its removal date is treated like an expired `@deprecated`**
  (`core/code-standards.mdc`): the next PR touching the area removes it.
- **Flags are evaluated in one module**, typed, with a default that is safe
  when the flag service is unreachable.
- **No flag nesting** beyond one level and no logic keyed on flag names
  outside the evaluation module.
- **Kill switches** for risky paths (new payment provider, new queue) are flags
  too; they stay after rollout and are registered as permanent.

### Progressive delivery

- **Canary first**: 5% of traffic (or one instance) for 15 minutes, then 25%,
  50%, 100%, each step gated on the signals below. `PROJECT.md` may tighten
  these steps, never loosen them.
- **Blue/green** where the platform has no traffic splitting: deploy green, run
  smoke tests, switch, keep blue warm for the rollback window.
- **Automated rollback triggers** (any one is enough):

| Signal | Default threshold |
|---|---|
| HTTP 5xx rate | Over 1% for 5 minutes, or 2x the previous release |
| p95 latency | Over 1.5x the previous release for 5 minutes |
| Error-tracker new issues | Any new issue with more than 10 events in 10 minutes |
| Health / readiness | Any instance failing 2 consecutive checks |
| Business metric | Conversion or job success rate drop declared in `PROJECT.md` |

- **Rollback is automatic** on a trigger; a human is paged, not asked first.
- **The rollback window is 24 hours**: the previous artifact stays deployable
  and the database stays compatible with it for at least that long.

### Database migration coordination

- **Expand/contract only** (`modules/database.mdc`): the release that adds a
  column ships before the release that writes it; the release that drops it
  ships after the release that stopped reading it.
- **Migrations run before the new code receives traffic** and stay backward
  compatible with the currently running version.
- **A release never contains a migration and its contract step together**; the
  contract step is its own release after the rollback window closes.
- **Data backfills are jobs** (`modules/background-jobs.mdc`), not migrations.

### Mobile store releases

- **Staged rollout on Android** (1% -> 10% -> 50% -> 100%) and **phased
  release on iOS**; halt on the triggers above using crash-free rate.
- **Minimum supported app version is enforced server-side**; an old client is
  told to update, never served a broken API.
- **Hotfix path**: expedited review request, patch version, staged rollout
  still applies; server-side flags are the first line of defense while the
  store reviews.
- **Store release notes are generated** from the same commits and edited for
  tone in the release PR.

### Release checklist

Run before promoting to production:

1. Pipeline green on the release commit; required checks per `PROJECT.md`.
2. Release PR reviewed: version, notes, migrations, and flags in this release.
3. Staging soak completed with production-like data volume.
4. Rollback target identified (previous tag) and verified deployable.
5. On-call aware; change window respected if `PROJECT.md` defines one.
6. Dashboards open on error rate, latency, and the business metric.

### Post-release verification

- **Smoke tests** against production right after the switch (`modules/infra.mdc`).
- **Synthetic checks** (login, one core flow, one API call) every minute for
  the first hour, then at the normal cadence.
- **Dashboards watched** through the canary window; the release is marked
  successful only after the last step passes.
- **Release annotated** in the error tracker and metrics (`modules/observability.mdc`).

### Rollback procedure

1. Trigger the platform rollback to the previous tag (one command or one
   button, documented in `PROJECT.md`).
2. Disable the release's feature flags.
3. Confirm health and SLO signals recover within 5 minutes.
4. Open an incident issue with the tag, the trigger, and the timeline.
5. Fix forward on a `hotfix/*` branch per `core/github-workflow.mdc`; never
   re-deploy the failed tag.

**Rollback is tested**: every quarter, and after any pipeline change, roll a
staging release back for real and record the time it took. A rollback that has
never been run does not count as a rollback strategy.

### Tooling

Release tool per `PROJECT.md` (`release-please`, `changesets`, or
`semantic-release`); `commitlint` enforcing conventional commits in CI and via
a commit hook; signed tags with keys verified on the forge; the flag provider
SDK behind one module. The project's single check command (`make check` /
`pnpm check`) includes `commitlint` on the PR's commits.

## Testing

- **Commit message tests**: `commitlint` in CI rejects non-conforming commits;
  a release-notes dry run (`release-please` or equivalent) on the PR.
- **Version derivation test**: a fixture set of commits produces the expected
  bump; runs whenever the release config changes.
- **Flag tests**: each flagged path tested on and off; default-safe behavior
  when the flag service is down.
- **Canary gate tests**: the verification gate fails on synthetic error-rate
  and latency breaches in staging.
- **Rollback drill**: quarterly staging rollback with recorded duration.
- **Migration compatibility tests**: the previous release's code runs against
  the new schema in CI.
- **Smoke and synthetic checks** as post-deploy tests, results kept per release.
- **Store rollout tests**: halt and resume of a staged rollout exercised on a
  test track before the first production use.

## Checklist when touching release code

- [ ] Main merge analyzed; only affected units selected; no duplicate hosting/CI deploy
- [ ] Version derived from commits; no hand-edited version or `CHANGELOG.md`
- [ ] Commits are conventional with scopes; breaking changes flagged
- [ ] Tag signed and created by the release tool
- [ ] Incomplete work behind a registered flag with a removal date
- [ ] Flags older than 30 days at 100% removed
- [ ] Canary steps and rollback triggers configured with the thresholds above
- [ ] Migration is expand-only and compatible with the previous release
- [ ] Rollback target verified deployable; procedure documented
- [ ] Post-release smoke, synthetic checks, and dashboards in place
- [ ] Release annotated in tracker and metrics
- [ ] Mobile: staged rollout and minimum version enforced
- [ ] `PROJECT.md` release section and flag registry updated
