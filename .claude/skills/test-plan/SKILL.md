---
name: test-plan
description: Create or audit the project's TEST_PLAN.md against the 72-category testing catalogue. Fills tooling, commands, and gates per the active language and platform rules, flags every category that is not active, and proposes the concrete work to activate it. Use on a new project, when tooling changes, or for the monthly review.
---

# /test-plan

Maximal testing is the default (`core/testing.mdc`): every category in
`docs/reference/testing-catalogue.md` is required unless justified.

## Create (no `TEST_PLAN.md` yet)

1. Read `PROJECT.md` (stack, status, active modules) and the applicable
   language and platform rules; each names the tools per category.
2. Copy `templates/TEST_PLAN.md` to the repo root.
3. For every one of the 72 rows fill: status, tool, command, gate, using the
   rules' recommendations. Do not leave `{{active}}` placeholders.
4. For categories the stack cannot support (e.g. device testing on a CLI
   tool), set `N/A: <one-line reason>`.
5. For categories that need setup not yet in the repo, set
   `planned <date within 30 days>` and create one issue each with the setup
   steps.
6. Fill the check command and coverage/mutation thresholds; make sure the
   check command exists in the project (`package.json` script, `Makefile`
   target) and add it if missing.
7. Generate the CI workflows from `templates/github/workflows/` with the
   real commands, and link them from the plan.
8. Add the `TEST_PLAN.md` link to `PROJECT.md` section 10.

## Audit (plan exists)

1. Diff the plan's rows against the catalogue; add missing rows.
2. For each `active` row, verify the command exists and runs (dry-run or
   `--help`); mark broken ones and report.
3. For each `planned` row past its date: report as blocking.
4. For each `N/A` row: restate the reason; challenge it if the stack changed.
5. Compare coverage and mutation thresholds with the CI config; they must
   match and only ever increase.
6. Compare the check command in the plan, `PROJECT.md`, `CLAUDE.md`, and
   `.claude/check-command`; they must agree.
7. Update `Last updated`, report changes and the list of blocking items.

## Output

A summary table: category count by status (active / planned / N/A / broken),
the blocking items, and the PR-ready diff of `TEST_PLAN.md`.
