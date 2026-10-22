# e-learning by BeBranded

This project uses the shared AI development ruleset. Read in this order:

1. `@PROJECT.md` (the only file with project-specific facts)
2. `@TEST_PLAN.md` (status of every test category; maximal testing is the default)
3. `@BACKLOG.md` (what is still to do; add every discovery, close what you finish)
4. The rules in `.claude/rules/` (loaded automatically; core rules always apply,
   language / platform / module rules apply per `PROJECT.md` section 9)

## Non-negotiables

- Work per `.claude/rules/core/ai-workflow.md`: read `PROJECT.md` first, plan
  multi-file changes, write tests with the code, run the check command before
  reporting done, never claim an unrun verification.
- Check command: `make check`. It must be green before any commit.
- Tests: the maximum the change allows, across the categories in
  `core/testing.md` ("what every change must add" is the floor). Bug fixes
  start with a failing regression test.
- Backlog: anything noticed but not done goes in `BACKLOG.md` in the same
  turn; close items you finish.
- Never touch production data or services from a development task.
- Never run destructive commands (reset, drop, force-push, mass delete)
  without explicit confirmation.
- Code, identifiers, comments, commits, and docs are in English.

## Project-specific rules

- **This repository is public and MIT.** Everything committed is published
  forever. Never commit credentials, client or client-project names, internal
  identifiers (CRM, project-management, cloud account or project IDs), internal
  URLs, personal email addresses, or real personal data. Examples use
  `example.com` and obviously fake values. See `modules/open-source`.
- **Before the first commit in a clone**, run `git config core.hooksPath .githooks`
  and commit with the GitHub noreply address.
- **Git workflow**: work on a `feat/`, `fix/`, `docs/`, or `chore/` branch, open a
  pull request, and squash-merge it yourself once the required checks are green.
  `main` refuses direct pushes.
- **Clean room**: never read, copy, summarize, or translate the source of
  `@blocknote/xl-*`, SurveyJS Creator, or any GPL, AGPL, or commercial
  implementation of a feature we rebuild
  (`docs/specifications/10-editor-extensions.md`).
- **Specifications first**: a change of behavior updates
  `docs/specifications/` in the same pull request.

## Commands

| Task | Command |
|---|---|
| Check (spec stage: secret scan, doc links, whitespace) | `make check` |
| Install, dev server, E2E, DB, build | none yet: added in phase 1 with the pnpm workspace |

## Skills

`/check`, `/test-plan`, `/new-migration`, `/new-function`, `/release`,
`/health-check` are available in `.claude/skills/`. Use them instead of
re-deriving the procedure.

## Hooks

- Pre-commit: blocks recognized `git commit` calls when the check command is
  missing, blank, or fails. Never bypass with `--no-verify`.
- Pre-write: blocks secret-like strings in code, docs, examples, and fixtures.
  These tool hooks complement CI; they do not cover other editors or shell writes.

## On-demand rules

These rules have no file pattern. Read them when `PROJECT.md` marks the module active or the task touches the topic:

- @.claude/rules-on-demand/core/maintenance.md
- @.claude/rules-on-demand/modules/audit-trail.md
- @.claude/rules-on-demand/modules/data-lifecycle.md
- @.claude/rules-on-demand/modules/deployments.md
- @.claude/rules-on-demand/modules/library-publishing.md
- @.claude/rules-on-demand/modules/open-source.md
- @.claude/rules-on-demand/modules/performance.md
