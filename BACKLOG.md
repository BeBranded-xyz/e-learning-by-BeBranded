# Backlog

> The single list of everything this project still has to do, so nothing is
> forgotten (`core/ai-workflow.mdc`, "Backlog"). Anything noticed but not done
> in the current task goes here immediately: follow-ups, ideas, bugs seen in
> passing, tests still missing, docs to write, questions for the client.
> Reviewed at every planning session and monthly (`core/maintenance.mdc`).
> If the project uses an external tracker (GitHub Issues, Linear, Notion),
> this file lists the tracker link per item and stays the index.

Last updated: 2026-10-23
Tracker: this file only (GitHub Issues once outside contributors arrive)

## Now (committed for the current iteration)

| ID | Task | Type | Priority | Owner | Link | Added | Notes |
|---|---|---|---|---|---|---|---|
| B-001 | Re-run `init.sh --target claude,codex --update` from AI-Dev-Rules `main` once its PRs #1, #2, #3 are merged; commit the new `.ruleset-version` | ops | P1 | maintainers | AI-Dev-Rules #1–#3 | 2026-10-22 | Current install comes from a local integration of those PRs |

## Next

| ID | Task | Type | Priority | Owner | Link | Added | Notes |
|---|---|---|---|---|---|---|---|
| B-012 | Phase 1 remaining packages: server + next, react, apps/demo with e2e | feature | P1 | maintainers | `docs/specifications/09-roadmap.md` | 2026-10-22 | One pull request per package |
| B-013 | Before the first publish: API Extractor report, publint, @arethetypeswrong/cli, pack listing test, consumer fixture apps from the tarball | test | P1 | maintainers | `modules/library-publishing` | 2026-10-22 | Blocks B-003 |
| B-014 | Mutation testing with Stryker on changed files (floors in `TEST_PLAN.md`) | test | P2 | maintainers | `TEST_PLAN.md` #4 | 2026-10-22 | |
| B-015 | CI matrix: Node 22.12 and 24, Linux and macOS | ops | P2 | maintainers | `TEST_PLAN.md` #46 | 2026-10-22 | |
| B-016 | Typecheck the code examples of package READMEs in CI | docs | P3 | maintainers | `modules/library-publishing` | 2026-10-22 | |
| B-017 | CI database matrix: PostgreSQL 14 (lowest) and the latest major | test | P2 | maintainers | `TEST_PLAN.md` #46 | 2026-10-23 | Tests use 14 today |
| B-018 | Opt-in RLS policies migration for direct Supabase reads, with `can_access` SQL mirroring core, and policy tests (anonymous, owner, other user) | feature | P3 | maintainers | spec 05, "RLS" | 2026-10-23 | Tables currently default-deny for every role but the owner |
| B-019 | GDPR: `deleteLearnerData`, `exportLearnerData`, retention purge job for inactive learners | feature | P2 | maintainers | spec 08, `modules/data-lifecycle` | 2026-10-23 | Not in the phase 1 roadmap; needed before a production pilot |
| B-020 | Audit suppression GHSA-vfj7-8cjw-p6xm (braces, dev-only via kysely-codegen) expires 2026-11-22: upgrade when a patched version exists, or re-justify | debt | P2 | maintainers | `pnpm-workspace.yaml` | 2026-10-23 | No patched version published |
| B-021 | Re-enable `exactOptionalPropertyTypes` in `packages/editor` when BlockNote's types support it | debt | P3 | maintainers | `PROJECT.md` exceptions | 2026-10-23 | Check on every BlockNote upgrade |
| B-022 | Authoring menu (phase 4): hide heading levels 4 to 6 and media blocks until uploads exist, so authors cannot insert what the validator rejects | feature | P2 | maintainers | spec 08 | 2026-10-23 | |
| B-023 | Content stylesheet for rendered lessons (`el-*` classes, data-attribute colors and alignment, `--el-*` tokens), shipped with `@bebranded/elearning-react` | feature | P1 | maintainers | spec 04, section 6 | 2026-10-23 | With the react package |
| B-003 | Write the delivery plan (packages as units, trusted publishing, one publisher) before adding a release workflow | docs | P2 | maintainers | `modules/library-publishing` | 2026-10-22 | `release.yml` template is manual-only until then |
| B-004 | Design-system decisions: component catalogue, themes, icon set, enforcement | docs | P2 | maintainers | `PROJECT.md` section 4 | 2026-10-22 | |
| B-005 | Evaluate the `audit-trail` module for admin actions (content publishing, access rules, assignments) | question | P2 | maintainers | | 2026-10-22 | |
| B-006 | Evaluate the `data-fetching` module for the React packages | question | P3 | maintainers | | 2026-10-22 | |

## Later / ideas

| ID | Task | Type | Priority | Link | Added | Notes |
|---|---|---|---|---|---|---|
| B-009 | Upstream to AI-Dev-Rules: the Claude pre-commit hook runs the current project's check even for a commit in another repository (`cd other && git commit`) | debt | P3 | | 2026-10-22 | Found during adoption |
| B-010 | Upstream to AI-Dev-Rules: `--update` re-adds project templates the project deleted on purpose (workflows, `renovate.json`); no opt-out | debt | P3 | | 2026-10-22 | Worked around by keeping workflows manual-only |
| B-011 | Upstream to AI-Dev-Rules: library variants of the web-app templates (runbook, functions registry, test plan phase statuses) | debt | P3 | | 2026-10-22 | |

## Missing tests (from `TEST_PLAN.md` gaps and review findings)

| ID | Area | Test to add | Category | Link | Added |
|---|---|---|---|---|---|
| | No code yet | Every planned category in `TEST_PLAN.md` starts with its phase | | `TEST_PLAN.md` | 2026-10-22 |

## Questions / decisions pending

| ID | Question | Who decides | Blocking | Asked on | Link |
|---|---|---|---|---|---|
| Q-001 | Which host product pilots the module? | Maxime | Phase 5 | 2026-10-22 | spec 09, Q4 |
| Q-003 | Install the Renovate app on the organization, or keep Dependabot | Maxime | No | 2026-10-22 | `core/dependencies` |

## Done (last 30 days, then prune)

| ID | Task | Closed on | PR |
|---|---|---|---|
| | Technical specifications 01–10, repository security baseline | 2026-10-22 | direct commits before branch protection |
| | AI-Dev-Rules adoption (Claude Code and Codex) | 2026-10-22 | #1 |
| | `@bebranded/elearning-editor`: block schema, lesson document validation (core), HTML renderer | 2026-10-23 | this PR |
| | `@bebranded/elearning-db`: migrations, `elearning migrate`, `postgresStorage` | 2026-10-23 | #4 |
| B-002 | Monorepo bootstrap: pnpm, Turborepo, TypeScript 6, ESLint, Prettier, Vitest, Changesets, `pnpm check`, CI, plus `@bebranded/elearning-core` | 2026-10-22 | #3 |
| B-008 | Dependabot npm ecosystem | 2026-10-22 | #3 |
| B-007 | `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), issue templates, `CODEOWNERS` | 2026-10-22 | #2 |
| Q-002 | Business email in history: acceptable, no history rewrite | 2026-10-22 | decision |
| Q-004 | Learner export built, off by default per course (spec 09, Q12) | 2026-10-22 | decision |
| Q-005 | Conduct contact: the maintainer's business address | 2026-10-22 | #2 |
| Q-006 | No phase dates: phases run in order (spec 09, Q13) | 2026-10-22 | decision |

## Conventions

- Types: `feature` | `bug` | `test` | `debt` | `docs` | `ops` | `question`.
- Priority: `P0` blocking, `P1` this iteration, `P2` next, `P3` someday.
- Debt items with a deadline live in `DEBT.md` and are only linked here.
- Flags with a removal date live in `FEATURE_FLAGS.md` and are only linked here.
- One line per item; details go in the linked issue or a short note.
