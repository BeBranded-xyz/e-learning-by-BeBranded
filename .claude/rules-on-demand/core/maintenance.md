---
description: Ongoing maintenance and technical debt - weekly, monthly, and quarterly rituals, debt tracking, safe refactoring, health metrics, sunset procedure, docs decay. Apply when doing maintenance or refactoring work.
---

# Maintenance & Technical Debt

## When this applies

Apply when `PROJECT.md` lists this module as active, when the task is
maintenance, cleanup, refactoring, upgrading, or debt work, and when the
`/health-check` skill runs. Owners, cadence overrides, SLO error budgets, and
the on-call rotation live in `PROJECT.md`. Dependency policy is in
`core/dependencies.mdc`; flag lifecycle in `modules/releases.mdc`; backups and
drift detection in `modules/infra.mdc`; dead-code rules in
`core/code-standards.mdc`.

## Principles

- **Maintenance is scheduled work**, not leftover time; it has a ritual, an
  owner, and a record.
- **Every shortcut is logged the day it is taken**, with a deadline that is
  enforced.
- **Refactoring is behavior-preserving and separate** from features.
- **Unused things are removed**, not kept just in case: code, flags, indexes,
  dependencies, docs, access.
- **What is not measured decays**; watch a small set of health metrics.

## Rules

### Weekly

- **CI health**: review failed and flaky runs on `main`; a flaky test is fixed
  or quarantined with a linked issue within the week, never retried into green.
- **Alert triage**: every alert that fired is classified (actionable, noisy,
  missing runbook); noisy alerts are tuned or deleted the same week.
- **Dependency PRs**: review and merge the week's Renovate PRs
  (`core/dependencies.mdc`); none older than 30 days.
- **Error tracker inbox**: new issues assigned or resolved; nothing left unassigned.

### Monthly ritual

Run in one session; record the result in `docs/maintenance/YYYY-MM.md` (or the
location in `PROJECT.md`). The `/health-check` skill produces the automated
half of this report.

- [ ] Dependencies: audit clean, unused packages removed, majors planned
- [ ] Dead code: unused exports, orphan files, unreachable branches removed
- [ ] Orphan TODOs: every `TODO`/`FIXME` has a linked open issue; expired
      `@deprecated` markers deleted
- [ ] Registries accurate: functions, jobs, flags, env vars match reality
- [ ] Docs freshness: every doc with `Last updated` older than 90 days is
      re-read and updated, marked `> [OUTDATED]`, or deleted
- [ ] Feature flags: none at 100% for more than 30 days; unused flags removed;
      kill switches listed
- [ ] Database: unused indexes dropped, slow queries reviewed (`modules/database.mdc`)
- [ ] Log volume: top emitters reviewed, debug-level noise removed, cost checked
- [ ] Error budget: SLO burn reviewed; if exhausted, the next sprint is
      reliability work
- [ ] Backup restore drill performed and timed (`modules/infra.mdc`)
- [ ] Cost review against budget alerts
- [ ] `DEBT.md` reviewed: overdue items escalated, closed items removed

### Quarterly

- **Secret rotation** for every credential in `.env.example` and CI
  (`core/security.mdc`); record the date in `PROJECT.md`.
- **Access review**: every human and service account on the forge, cloud,
  database, and SaaS tools is still needed and least-privileged; leavers removed.
- **License review** of the dependency tree (`core/dependencies.mdc`).
- **Load test rerun** at the target load in `PROJECT.md`; compare with the
  previous quarter.
- **Disaster recovery test**: restore into a fresh environment from backups
  and IaC alone; measure against RPO and RTO.
- **Rollback drill** (`modules/releases.mdc`).
- **Onboarding re-run**: a newcomer (or a teammate acting as one) follows the
  README from a clean machine; every friction point becomes a doc fix the
  same week.
- **Eval and adversarial suite review** for AI features (`modules/ai-features.mdc`).

### Debt tracking

- **Every deliberate shortcut is logged in `DEBT.md`** (created from
  `templates/DEBT.md`) in the same PR that introduces it. No entry, no merge.
- **An entry has** an id, description, location, owner, date taken, deadline,
  removal plan, and the reason the shortcut was acceptable.
- **Deadlines are enforced like `@deprecated`**: an overdue item blocks new
  feature work in that area until it is removed or re-dated by the owner with
  a new reason. Re-dating twice escalates to the project lead.
- **Debt is prioritized by interest**: how often the area changes and how many
  incidents it caused, not by how ugly it looks.

```markdown
| ID | Description | Location | Owner | Taken | Deadline | Removal plan |
|---|---|---|---|---|---|---|
| D-014 | Sync retries inline instead of queued | `sync/orders.ts` | @owner | 2026-03-02 | 2026-05-01 | Move to `jobs/` with outbox (#231) |
```

### Safe refactoring

- **Characterization tests first**: before touching untested code, write tests
  that pin its current behavior (bugs included); refactor only once they are green.
- **Strangler pattern for module replacement**: new implementation behind the
  same interface, traffic moved gradually (flag or routing), old module
  deleted when zero usage is measured.
- **Refactor and feature never in the same commit** (`core/github-workflow.mdc`);
  the refactor PR ships first and is behavior-preserving by construction.
- **Small green steps**: each commit compiles and passes the suite; no
  multi-day refactor branches. If a step cannot stay green, the step is too big.
- **Rename and move with tooling** (IDE refactor, `ts-morph`, `rope`,
  `gofmt -r`), never by hand across many files.
- **Public interfaces change last**: internals first, then the boundary, with a
  deprecation window for external consumers.

### Health metrics

Track these on a dashboard or in the monthly report; thresholds are defaults
that `PROJECT.md` may tighten.

| Metric | Watch | Act when |
|---|---|---|
| Test coverage per layer | Domain, data access, API, UI | Any layer below 80% or dropping two months in a row |
| Flaky test rate | Reruns needed / total runs on `main` | Above 1% |
| File size violations | Files over 300 lines, functions over 50 | Any new violation; trend not decreasing |
| Cyclomatic complexity | Functions over 10 | Any new violation |
| Build and CI time | Wall clock for the check command and the pipeline | Above 10 minutes, or 20% slower than last quarter |
| Open debt items | Count and overdue count | Any overdue |
| Dependency age | Updates pending over 30 days | Any |
| Docs staleness | Docs past 90 days | Any |

### Sunset procedure

For a feature, endpoint, function, job, or flag:

1. **Mark**: `@deprecated` with removal date and replacement, or `DEAD` in the
   registry; add a `DEBT.md` entry.
2. **Measure**: add a usage counter or log; wait one full business cycle
   (at least 30 days) and confirm zero usage.
3. **Remove**: delete code, tests, docs, flags, env vars, indexes, and registry
   rows in one PR; schema changes follow contract rules.
4. **Document**: changelog entry, `PROJECT.md` updated, users notified if it
   was external.

Never skip the measure step because "nobody uses it".

### Docs decay

- **`Last updated` is mandatory** on every doc and updated on every edit
  (`core/github-workflow.mdc`).
- **A doc older than 90 days is reviewed** in the monthly ritual; a doc nobody
  can review is deleted, not kept.
- **Docs that quote code are checked against the code**; snippets are copied
  from tested files, never edited in place inside the doc.
- **The README is the onboarding test**: if the quarterly re-run fails, the
  README is wrong, not the newcomer.

### The `/health-check` skill

- **Lives in `claude/skills/health-check/` of this ruleset** and is installed
  with the rules.
- **Runs the automatable parts** of the monthly ritual: audit, unused
  dependencies, dead exports, orphan TODOs, expired deprecations and flags,
  file and function size violations, docs past 90 days, registry drift, and
  log volume and error budget queries where the project exposes them.
- **Outputs a report** in the monthly format with pass or fail per item and
  the commands it ran; it never modifies code without a separate approval.
- **Runs in CI on a monthly schedule** and opens an issue with the report.

### Tooling

Language toolchain per `languages/*.mdc`. `knip` or `depcheck`, `deptry`,
`cargo udeps`, `go mod tidy -diff` for unused code and packages; complexity via
the language linter (`eslint` complexity rule, `ruff` C901, `clippy`,
`gocyclo`); flaky test detection via the runner's retry report; a docs
staleness script grepping `Last updated`. The project's single check command
(`make check` / `pnpm check`) runs the static parts; the `/health-check` skill
runs the rest.

## Testing

- **Characterization tests** before any refactor of untested code; kept
  afterwards as regression tests.
- **Refactor PRs run the full suite** (unit, integration, contract, E2E) with
  no test changes except additions; a refactor that needs to edit assertions
  is not behavior-preserving.
- **Flaky test quarantine has an expiry**; a quarantined test older than 30
  days is fixed or deleted.
- **Drills are tests**: restore, DR, rollback, load, and onboarding re-run each
  produce a recorded result and duration.
- **Sunset verification**: a test asserts the removed endpoint, job, or flag
  returns the expected not-found behavior and no code references remain.
- **Health-check self-test**: the skill runs against a fixture repo with known
  violations and reports all of them.

## Backlog hygiene

`BACKLOG.md` (or the indexed tracker) is reviewed in every monthly ritual:
close what shipped, re-prioritize or delete items older than 90 days, move
dated debt to `DEBT.md`, and turn every "Missing tests" item into a task for
the next iteration. A backlog that has not changed in a month is a signal the
project is unmaintained, not that it is complete.

## Checklist when touching maintenance code

- [ ] Weekly items done: CI health, alerts, dependency PRs, tracker inbox
- [ ] Monthly report written from the ritual list; `/health-check` output attached
- [ ] Every shortcut in this change has a `DEBT.md` entry with owner and deadline
- [ ] No overdue debt, expired `@deprecated`, or stale flag left in the area touched
- [ ] Characterization tests exist before refactoring untested code
- [ ] Refactor commits separate from feature commits; every step green
- [ ] Sunset followed mark -> measure -> remove -> document
- [ ] Docs touched carry an updated `Last updated`; docs past 90 days reviewed
- [ ] Registries (functions, jobs, flags, env vars) match reality
- [ ] Health metrics updated; any threshold breach has an owner
- [ ] Quarterly items due this quarter scheduled with an owner
