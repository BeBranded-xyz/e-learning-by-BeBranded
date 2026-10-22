---
name: check
description: Run the project's full local verification (format, lint, typecheck, unit, integration, and the PR-gate suites that can run locally) and report exactly what passed, failed, or could not run. Use before any commit, before reporting a task done, or when asked to verify.
---

# /check

Runs the commit gate and as much of the PR gate as the local machine allows
(`core/testing.mdc`), then reports faithfully (`core/ai-workflow.mdc`).

## Steps

1. Read `PROJECT.md` section 2 and `TEST_PLAN.md` "Check command" to find the
   check command and the per-category commands. If `.claude/check-command`
   exists, it wins.
2. Run the check command. Capture full output.
3. If it is green, run in order, each with its own captured output, skipping a
   step only when `TEST_PLAN.md` marks its category `N/A` or the tooling is
   absent locally:
   - dead code / unused deps (`knip`, `depcheck`, `cargo-udeps`, `deptry`, ...)
   - secret scan (`gitleaks detect --no-git` or the project tool)
   - dependency audit (`pnpm audit --audit-level=high`, `cargo audit`, `pip-audit`, `govulncheck`, ...)
   - database tests and migration up/down/up on a clean local DB
   - contract tests and OpenAPI lint
   - component + accessibility + visual tests
   - E2E critical paths on desktop and mobile projects
   - mutation testing on changed files (`--incremental` / `--since`)
   - fuzz on changed boundaries, time-boxed to 5 minutes
   - benchmarks with thresholds
4. Do not fix anything during the run. Collect results first.
5. Report a table: step, command, result (pass / fail / not run), duration.
   For every failure include the last relevant lines of output. For every
   "not run" say why (tool missing, category N/A, needs credentials).
6. Only then propose fixes, one failure at a time, and re-run the affected
   step after each fix.

## Rules

- Never mark a step passed without having run it in this session.
- Never edit a test to make it pass before understanding the failure.
- Never use `--no-verify`, skip flags, or suppress diagnostics to get green.
- If the check command itself is missing, stop and propose adding it to
  `package.json` / `Makefile` per the language rule, then continue.
