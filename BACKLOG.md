# Backlog

> The single list of everything this project still has to do, so nothing is
> forgotten (`core/ai-workflow.mdc`, "Backlog"). Anything noticed but not done
> in the current task goes here immediately: follow-ups, ideas, bugs seen in
> passing, tests still missing, docs to write, questions for the client.
> Reviewed at every planning session and monthly (`core/maintenance.mdc`).
> If the project uses an external tracker (GitHub Issues, Linear, Notion),
> this file lists the tracker link per item and stays the index.

Last updated: 2026-10-24
Tracker: this file only (GitHub Issues once outside contributors arrive)

## Now (committed for the current iteration)

| ID | Task | Type | Priority | Owner | Link | Added | Notes |
|---|---|---|---|---|---|---|---|
| B-038 | Live contract test against a dedicated Cloudflare Stream test account (recorded fixtures only for now) | test | P3 | maintainers | spec 06 | 2026-10-23 | Maintainer decision: simulations first |
| B-039 | Purge `video_sessions` rows untouched for 24 h (only live sessions need `last_seq`), as a scheduled function the host triggers; add to the data lifecycle inventory | ops | P2 | maintainers | `modules/data-lifecycle`, spec 03 | 2026-10-23 | One row per player load; cascades with lesson progress meanwhile |
| B-042 | Refresh an expired playback URL mid-session (sessions longer than the video + 15 min): refetch the lesson and swap the source at the current position | feature | P3 | maintainers | spec 06 | 2026-10-23 | `VideoPlayer` keeps its first URL |
| B-043 | Bundle budget check for `@bebranded/elearning-react` (30 kB gzip, excluding hls.js), so a static import of hls.js would fail CI | test | P2 | maintainers | spec 08, "Performance" | 2026-10-23 | hls.js is a dynamic import today |
| B-047 | Formatted quiz prompts and options (bold, links, code) instead of plain text, rendered safely in SurveyJS | feature | P3 | maintainers | spec 07, "Authoring" | 2026-10-23 | Formatting is dropped today |
| B-048 | Add `quiz_attempts` (answers, scores) to the data lifecycle inventory and to `deleteLearnerData` / `exportLearnerData` (B-019) | ops | P2 | maintainers | `modules/data-lifecycle` | 2026-10-23 | Attempts cascade with lesson_progress |
| B-049 | Recommended rate limit for quiz attempt opening and submission in the `rateLimit` hook (B-028) | feature | P2 | maintainers | spec 08 | 2026-10-23 | Attempt limits and cooldowns already bound grading |
| B-053 | Delete orphan uploaded files (no document points to them for 24 h, or their lesson was deleted) through `FileStorage.delete`, as a scheduled function the host triggers; add `files` to the data lifecycle inventory | ops | P2 | maintainers | spec 04 section 4, `modules/data-lifecycle` | 2026-10-24 | Uploads are kept today |
| B-054 | S3-compatible (R2, S3) and Supabase Storage `FileStorage` adapters (spec 04, section 4) | feature | P3 | maintainers | spec 04 | 2026-10-24 | Hosts implement the port themselves for now |
| B-055 | Optional `resolveLearners(ids)` host hook so reports and the back-office show names next to `learner_id` (spec 04, section 1) | feature | P2 | maintainers | spec 04 | 2026-10-24 | Reports list ids only |
| B-056 | Paginate and aggregate reports in SQL for large tenants (reports load every enrollment or attempt of one course or quiz) | feature | P3 | maintainers | `modules/performance`, B-025 | 2026-10-24 | Fine for pilot sizes |
| B-057 | Content tree drag and drop is pointer-only (the move buttons are the accessible path, WCAG 2.5.7); revisit with an accessible sortable pattern if authors ask, and remove the `no-static-element-interactions` suppression in `DropZone.tsx` | debt | P3 | maintainers | `modules/frontend` | 2026-10-24 | |
| B-058 | E2E of the back-office video upload: the demo's fake video provider answers an external upload URL; add a local upload endpoint to the fake provider (form and tus) and drive the uploader in Playwright | test | P2 | maintainers | `TEST_PLAN.md` #9 | 2026-10-24 | Component tests cover both protocols |
| B-059 | Usability sessions with content authors on the editor and back-office before the phase 5 pilot; findings become regression tests | test | P1 | maintainers | `TEST_PLAN.md` #59 | 2026-10-24 | Needs people; cannot be automated |
| B-061 | Create columns by dragging a block onto another block's left or right edge (spec 10, "Editing behavior"); the slash menu is the only way today | feature | P3 | maintainers | spec 10, ADR-0001 | 2026-10-24 | Needs a drop target on block edges |
| B-062 | Playwright journeys for the remaining column behaviors: drag a block between columns and out of the list, resize with the pointer, remove a column until the list dissolves | test | P2 | maintainers | spec 10 "Testing", `TEST_PLAN.md` #9, #47 | 2026-10-24 | Creating, typing, keyboard resize and the learner layout are covered (`columns.spec.ts`); the rest by editor tests on a mounted editor |
| B-065 | Visual regression of exported PDF pages (Playwright screenshots of rendered pages) and validation of .docx files in LibreOffice headless, per spec 10 "Testing" | test | P2 | maintainers | spec 10, `TEST_PLAN.md` #11 | 2026-10-24 | Text extraction and XML structure are tested today |
| B-066 | Back-office download of a single lesson (drafts included) from the lesson editor page; admins download the whole course today | feature | P3 | maintainers | spec 10 | 2026-10-24 | Lesson detail payload has no `export_formats` |
| B-064 | Split `packages/react/src/styles.css` (304 lines, over the 300-line limit since phase 3) by area (layout, content, player, course), each imported by `styles.css` as `columns.css` is | debt | P3 | maintainers | `core/code-standards` | 2026-10-24 | Grew by its `@import` only |
| B-001 | Re-run `init.sh --target claude,codex --update` from AI-Dev-Rules `main` once its PRs #1, #2, #3 are merged; commit the new `.ruleset-version` | ops | P1 | maintainers | AI-Dev-Rules #1–#3 | 2026-10-22 | Current install comes from a local integration of those PRs |

## Next

| ID | Task | Type | Priority | Owner | Link | Added | Notes |
|---|---|---|---|---|---|---|---|
| B-013 | Before the first publish: API Extractor report, publint, @arethetypeswrong/cli, pack listing test, consumer fixture apps from the tarball | test | P1 | maintainers | `modules/library-publishing` | 2026-10-22 | Blocks B-003 |
| B-014 | Mutation testing with Stryker on changed files (floors in `TEST_PLAN.md`) | test | P2 | maintainers | `TEST_PLAN.md` #4 | 2026-10-22 | |
| B-015 | CI matrix: Node 22.12 and 24, Linux and macOS | ops | P2 | maintainers | `TEST_PLAN.md` #46 | 2026-10-22 | |
| B-016 | Typecheck the code examples of package READMEs in CI | docs | P3 | maintainers | `modules/library-publishing` | 2026-10-22 | |
| B-017 | CI database matrix: PostgreSQL 14 (lowest) and the latest major | test | P2 | maintainers | `TEST_PLAN.md` #46 | 2026-10-23 | Tests use 14 today |
| B-018 | Opt-in RLS policies migration for direct Supabase reads, with `can_access` SQL mirroring core, and policy tests (anonymous, owner, other user) | feature | P3 | maintainers | spec 05, "RLS" | 2026-10-23 | Tables currently default-deny for every role but the owner |
| B-019 | GDPR: `deleteLearnerData`, `exportLearnerData`, retention purge job for inactive learners | feature | P2 | maintainers | spec 08, `modules/data-lifecycle` | 2026-10-23 | Not in the phase 1 roadmap; needed before a production pilot |
| B-020 | Audit suppression GHSA-vfj7-8cjw-p6xm (braces, dev-only via kysely-codegen) expires 2026-11-22: upgrade when a patched version exists, or re-justify | debt | P2 | maintainers | `pnpm-workspace.yaml` | 2026-10-23 | No patched version published |
| B-021 | Re-enable `exactOptionalPropertyTypes` in `packages/editor` and `packages/admin` when BlockNote's types support it | debt | P3 | maintainers | `PROJECT.md` exceptions | 2026-10-23 | Check on every BlockNote upgrade |
| B-025 | Cursor pagination for collection routes (`limit`, `next_cursor`); today collections return everything with `next_cursor: null` | feature | P2 | maintainers | `modules/api-design` | 2026-10-23 | Catalogs are small in phase 1 |
| B-026 | `Idempotency-Key` on admin creates; `ETag` / `If-Match` on admin edits of shared content | feature | P2 | maintainers | `modules/api-design` | 2026-10-23 | Learner actions are idempotent by state already |
| B-027 | OpenAPI document generated from the Zod schemas, committed and diffed in CI, Spectral lint | feature | P2 | maintainers | `modules/api-design` | 2026-10-23 | |
| B-028 | `rateLimit` hook and recommended limits (spec 08) | feature | P2 | maintainers | spec 08 | 2026-10-23 | |
| B-030 | Size budget in CI for `@bebranded/elearning-react` (size-limit, < 30 kB gzip with TanStack Query) | test | P2 | maintainers | `PROJECT.md` section 12 | 2026-10-23 | Measured by hand in the PR |
| B-031 | Server Component variants of the catalog, course page and lesson (data fetched on the server, no client JS for text lessons), per spec 08 | feature | P2 | maintainers | spec 08, "Performance" | 2026-10-23 | Phase 1 ships Client Components |
| B-032 | Storybook (or Ladle) stories for every exported component, with visual regression | test | P2 | maintainers | `modules/frontend`, `TEST_PLAN.md` #11 | 2026-10-23 | |
| B-033 | Dark mode options (`darkMode: "media" \| "class" \| "off"`) and theme contrast warnings (spec 04, spec 08) | feature | P3 | maintainers | spec 04, section 6 | 2026-10-23 | Styles follow prefers-color-scheme today |
| B-034 | Upstream to AI-Dev-Rules: the pre-commit hook mistakes `grep -n` (or any `-n`) in a chained command for `git commit -n` and blocks it | debt | P3 | | | 2026-10-23 | Hit while committing a fix |
| B-035 | Nonce-based Content Security Policy in apps/demo and in the integration guide (spec 08) | feature | P2 | maintainers | spec 08 | 2026-10-23 | Needs Next.js proxy middleware |
| B-036 | E2E on Firefox and WebKit (iOS Safari ≥ 16 target) | test | P2 | maintainers | `TEST_PLAN.md` #44, #45 | 2026-10-23 | |
| B-052 | Role and grade assignments do not set a due date on an existing self enrollment; decide whether they should | question | P3 | maintainers | spec 05 | 2026-10-24 | Pending lookup skips enrolled courses |
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
| Q-001 | Which host product pilots the module? Still undecided on 2026-10-23; the demo app stays the only host | Maxime | Phase 5 | 2026-10-22 | spec 09, Q4 |

## Done (last 30 days, then prune)

| ID | Task | Closed on | PR |
|---|---|---|---|
| | Technical specifications 01–10, repository security baseline | 2026-10-22 | direct commits before branch protection |
| | AI-Dev-Rules adoption (Claude Code and Codex) | 2026-10-22 | #1 |
| B-063 | Column resize handle named in the editor's language (`createLessonEditorSchema`, en and fr in the back-office) | 2026-10-24 | this PR |
| | Export UI: download buttons on course and lesson pages and in the back-office, learner-export setting in course settings, demo exporter (Playwright) and journeys for exports and columns; phase 4b complete | 2026-10-24 | this PR |
| | Multi-column layout: spike go (ADR-0001), core validation, editor blocks with resize, slash items, learner, HTML and Word rendering; lesson and quiz editor schemas no longer share blocks | 2026-10-24 | this PR |
| B-022 | Authoring menu hides headings 4 to 6, audio and video | 2026-10-24 | #35 |
| B-041 | Back-office warning for a ready video without captions | 2026-10-24 | #35 |
| B-046 | Quiz authoring UI: question types in the slash menu, question panel, already-taken warning | 2026-10-24 | #35 |
| B-040 | Resumable tus uploads for videos over 200 MB (server and Cloudflare adapter #33, browser uploader #35) | 2026-10-24 | #33, #35 |
| B-060 | Phase 4, back-office: file uploads, extra attempts, reports, tus, `@bebranded/elearning-admin` (courses, tree, rules, assignments, lesson, video and quiz editors, reports), demo back-office and e2e; phase 4 complete | 2026-10-24 | #29–#36, this PR |
| B-045 | Reports: course and learner tracking, quiz reporting with per-question correct rate, CSV export | 2026-10-24 | #32 |
| B-044 | Admin grant of extra quiz attempts per learner, append-only grants | 2026-10-24 | #31 |
| B-051 | Course assignments: storage and `canAssign`, then the admin API with enrollment on the next visit | 2026-10-24 | #26, #28 |
| B-029 | Admin reorder endpoint `POST /v1/admin/reorder` (phase 4 starts) | 2026-10-23 | #25 |
| B-050 | Phase 3, quizzes: core conversion, presentation and grading, editor question blocks, db tables, server attempts and admin save, `<Quiz>` on SurveyJS, demo quiz and anti-cheat e2e; phase 3 complete | 2026-10-23 | #19–#24 |
| B-037 | Phase 2, video: core rules, db tables, `@bebranded/elearning-video` (Cloudflare Stream), server endpoints and webhook, `<VideoPlayer>`, demo video and anti-cheat e2e; phase 2 complete | 2026-10-23 | #11–#16, #18 |
| B-012 | Phase 1: apps/demo with fake multi-role auth and Playwright journeys; phase 1 complete | 2026-10-23 | #9 |
| B-023 | Content stylesheet for rendered lessons, shipped with `@bebranded/elearning-react` | 2026-10-23 | #8 |
| | `@bebranded/elearning-react`: provider, theme, i18n (en, fr), catalog, course page, lesson player, My training | 2026-10-23 | #8 |
| B-024 | Admin API: courses, chapters, lessons (validated content), access rules, publishing | 2026-10-23 | #7 |
| | `@bebranded/elearning-server` learner API, event delivery, and `@bebranded/elearning-next` | 2026-10-23 | #6 |
| | `@bebranded/elearning-editor`: block schema, lesson document validation (core), HTML renderer | 2026-10-23 | #5 |
| | `@bebranded/elearning-db`: migrations, `elearning migrate`, `postgresStorage` | 2026-10-23 | #4 |
| B-002 | Monorepo bootstrap: pnpm, Turborepo, TypeScript 6, ESLint, Prettier, Vitest, Changesets, `pnpm check`, CI, plus `@bebranded/elearning-core` | 2026-10-22 | #3 |
| B-008 | Dependabot npm ecosystem | 2026-10-22 | #3 |
| B-007 | `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), issue templates, `CODEOWNERS` | 2026-10-22 | #2 |
| Q-002 | Business email in history: acceptable, no history rewrite | 2026-10-22 | decision |
| Q-004 | Learner export built, off by default per course (spec 09, Q12) | 2026-10-22 | decision |
| Q-005 | Conduct contact: the maintainer's business address | 2026-10-22 | #2 |
| Q-003 | Keep Dependabot, no Renovate | 2026-10-23 | decision |
| | Phase 1 decisions confirmed: own HTML renderer (D11), default-deny RLS, Node >= 22.12, audit suppression until 2026-11-22 | 2026-10-23 | decision |
| Q-006 | No phase dates: phases run in order (spec 09, Q13) | 2026-10-22 | decision |

## Conventions

- Types: `feature` | `bug` | `test` | `debt` | `docs` | `ops` | `question`.
- Priority: `P0` blocking, `P1` this iteration, `P2` next, `P3` someday.
- Debt items with a deadline live in `DEBT.md` and are only linked here.
- Flags with a removal date live in `FEATURE_FLAGS.md` and are only linked here.
- One line per item; details go in the linked issue or a short note.
