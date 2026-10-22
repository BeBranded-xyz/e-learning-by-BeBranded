---
name: health-check
description: Run the automatable parts of the monthly maintenance ritual from core/maintenance.mdc - dependency and vulnerability state, dead code, orphan TODOs, oversized files and functions, stale docs, registry accuracy, expired flags and debt, skipped and flaky tests, test plan status - and produce a prioritized report with PR-ready fixes. Use monthly or whenever asked for a codebase health review.
---

# /health-check

Read-only by default: produce the report first. Apply fixes only when asked,
one category per commit.

## Checks

1. **Dependencies**: outdated (`pnpm outdated` / `cargo outdated` / `pip list
   --outdated` / `go list -u -m all`), vulnerabilities (audit tools per
   `core/dependencies.mdc`), unused (`knip`, `depcheck`, `cargo-udeps`,
   `deptry`), license violations, lockfile drift.
2. **Dead code**: unused exports, orphan files, unreachable code,
   commented-out blocks (`grep -rnE '^\s*//\s*(const|let|function|import|return|if)'`
   and language equivalents).
3. **TODO / FIXME without a linked issue**: `grep -rnE 'TODO|FIXME' | grep -vE '\(#[0-9]+\)'`.
4. **Suppressed diagnostics** without justification: `@ts-ignore`,
   `eslint-disable`, `# noqa`, `#[allow`, `@Suppress`, `// nolint`.
5. **Size limits**: files over 300 lines, functions over 50 lines (use the
   linter's complexity rules or a quick script); list against the documented
   exemptions in `PROJECT.md`.
6. **Skipped, focused, or flaky tests**: `\.skip|\.only|xit\(|@Ignore|@pytest.mark.skip`
   without `SKIP(#...)`; CI flaky-retry stats if available.
7. **Test plan**: run the `/test-plan` audit; report blocking items and
   coverage/mutation trend.
8. **Backlog**: `BACKLOG.md` exists and was updated in the last 30 days; items older than 90 days; "Missing tests" items without a task; done items to prune.
9. **Registries**: `FUNCTIONS_REGISTRY.md` rows vs actual functions and
   routes; `FEATURE_FLAGS.md` flags vs flags referenced in code; `DEBT.md`
   items past deadline; `MIGRATIONS_CHANGELOG.md` vs migration files.
10. **Docs freshness**: any doc with `Last updated` older than 90 days;
   `PROJECT.md` structure section vs the real tree; `README` commands that no
   longer exist in `package.json`/`Makefile`; `.env.example` vs env vars read
   in code (`process.env.X`, `os.environ["X"]`, `env::var("X")`).
11. **Database** (if module active): unused indexes, missing FK indexes,
    tables without RLS or without policies, advisors output for Supabase.
12. **Observability**: alert rules exist for the conditions in
    `modules/observability.mdc`; error tracker noise (top 10 unresolved
    issues by volume); log volume trend.
13. **Ruleset version**: compare `.ruleset-version` with the ruleset repo's
    current commit (`git ls-remote <source> HEAD`, the source URL is in the
    file; use a local clone when it says `unknown`). Read the source ruleset's `CHANGELOG.md` (installed copy:
    `docs/reference/ruleset-changelog.md`) and report relevant migration steps
    before proposing an update with the installed target. An installed SHA is
    not proof that project-owned config or migration tasks have been updated.
14. **Secrets and access** (report only): last rotation dates in
    `PROJECT.md`; CI secrets referenced but unused.

## Report

Group findings by severity (blocking / should fix this month / nice to have),
each with the file or command evidence and the one-line fix. End with the
list of PRs you propose to open, in order.
