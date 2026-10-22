---
description: Points to PROJECT.md as the single source of project-specific truth and explains how the ruleset is organized and activated. Always applies.
---

# Project Identity

The single source of project-specific truth is **`PROJECT.md`** at the repo root.

**Before making any architectural or stack-dependent decision, read `PROJECT.md`.**
It declares what the project is, how it runs, the check command, the actual
tech stack, the languages and conventions, the repo structure, the business
invariants, the budgets, and which rules are active.

## How this ruleset is organized

| Directory | Applies | Activated by |
|---|---|---|
| `core/` | Always | Nothing to do: identity, AI workflow, code standards, error handling, testing, security, dependencies, git workflow (`maintenance` is on demand) |
| `languages/` | Files of that language | `PROJECT.md` section 9, plus file globs |
| `platforms/` | Files of that platform | `PROJECT.md` section 9, plus file globs |
| `modules/` | A concern the project has | `PROJECT.md` section 9 |

- Every rule is **project-agnostic**. Whenever a rule needs a concrete fact
  (a table name, a project ref, a domain, a business invariant, a deployment
  target, a budget) that fact lives in `PROJECT.md`, not in the rule.
- A rule for a technology the project does not use is ignored.
- A language rule takes precedence over `code-standards.mdc` for naming and
  may override size limits with a documented reason. A platform rule layers
  on the modules it touches and references them rather than repeating them.
- **Testing is maximal by default** (`testing.mdc`): every category of
  `docs/reference/testing-catalogue.md` is required unless `TEST_PLAN.md`
  justifies otherwise.

## Companion documents every project keeps

| File | Purpose |
|---|---|
| `PROJECT.md` | Identity sheet (this rule's subject) |
| `TEST_PLAN.md` | Status, tool, command, gate for every test category |
| `BACKLOG.md` | Every remaining task, question, and missing test; updated every task |
| `docs/FUNCTIONS_REGISTRY.md` | Every function, route, webhook, job |
| `docs/MIGRATIONS_CHANGELOG.md` | Human-readable migration history |
| `docs/FEATURE_FLAGS.md` | Flags with removal dates |
| `docs/DEBT.md` | Deliberate shortcuts with deadlines |
| `docs/RUNBOOK.md` | Alerts, procedures, kill switches |
| `docs/adr/` | Architecture decision records |

## Keeping it current

- When the stack, structure, conventions, tooling, or a key decision changes,
  update `PROJECT.md` (and `TEST_PLAN.md` when testing tooling changes)
  **in the same PR** as the change.
- Never hardcode project-specific facts back into the generic rules. If you
  find yourself wanting to, add the fact to `PROJECT.md` and reference it.
- Never put secrets in `PROJECT.md`: only public identifiers and rotation
  dates.
- Everything is written and maintained in English: code, identifiers,
  comments, commits, rules, and technical documentation.

## Checklist when updating project identity

- [ ] Stack, commands, structure, and public identifiers match the project
- [ ] Active languages, platforms, and modules reflect actual requirements
- [ ] Project-specific facts and exceptions are documented in `PROJECT.md`
- [ ] Companion documents and referenced rule paths exist and are current
- [ ] No secrets included; changes delivered with the implementation
