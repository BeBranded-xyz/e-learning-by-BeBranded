# Backlog

> The single list of everything this project still has to do, so nothing is
> forgotten (`core/ai-workflow.mdc`, "Backlog"). Anything noticed but not done
> in the current task goes here immediately: follow-ups, ideas, bugs seen in
> passing, tests still missing, docs to write, questions for the client.
> Reviewed at every planning session and monthly (`core/maintenance.mdc`).
> If the project uses an external tracker (GitHub Issues, Linear, Notion),
> this file lists the tracker link per item and stays the index.

Last updated: 2026-10-25
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
| B-053 | Delete orphan uploaded files (no document points to them for 24 h, or their lesson was deleted) through `FileStorage.delete`, as a scheduled function the host triggers; add `files` to the data lifecycle inventory | ops | P2 | maintainers | spec 04 section 4, `modules/data-lifecycle` | 2026-10-24 | Uploads and locally encoded demo videos are kept today |
| B-054 | S3-compatible (R2, S3) and Supabase Storage `FileStorage` adapters (spec 04, section 4) | feature | P3 | maintainers | spec 04 | 2026-10-24 | Hosts implement the port themselves for now |
| B-055 | Optional `resolveLearners(ids)` host hook so reports and the back-office show names next to `learner_id` (spec 04, section 1) | feature | P2 | maintainers | spec 04 | 2026-10-24 | Reports list ids only |
| B-056 | Paginate and aggregate reports in SQL for large tenants (reports load every enrollment or attempt of one course or quiz) | feature | P3 | maintainers | `modules/performance`, B-025 | 2026-10-24 | Fine for pilot sizes |
| B-057 | Content tree drag and drop is pointer-only (the move buttons are the accessible path, WCAG 2.5.7); revisit with an accessible sortable pattern if authors ask, and remove the `no-static-element-interactions` suppression in `DropZone.tsx` | debt | P3 | maintainers | `modules/frontend` | 2026-10-24 | |
| B-059 | Usability sessions with content authors on the editor and back-office before the phase 5 pilot; findings become regression tests | test | P1 | maintainers | `TEST_PLAN.md` #59 | 2026-10-24 | Needs people; cannot be automated |
| B-067 | Deploy the public demo automatically after each merge into `main` (CI job, only when `apps/demo` or a package it uses changed), with a smoke test and the previous image kept for rollback | ops | P2 | maintainers | `modules/deployments`, `modules/infra` | 2026-10-24 | Redeployed by hand with a script on the server today |
| B-068 | Nonce the design file's `<style>` elements (the demo layout's and the provider's `nonce` prop) once the nonce-based CSP lands (B-035); shadcn's Progress also sets an inline style | security | P2 | maintainers | spec 08, spec 11 | 2026-10-24 | The demo sends no CSP yet |
| B-069 | Spacing of the PDF and Word exports from the design's `spacing` unit (`export-css.ts` and the Word styles still use fixed px and pt) | feature | P3 | maintainers | spec 10, spec 11 "Spacing" | 2026-10-24 | The screen UI follows the design file since the spacing PR |
| B-070 | Extend the spacing guard to the rest of the design-system literals in the module's CSS (font sizes, line heights, control heights, border widths) once the design file has type and size scales | feature | P3 | maintainers | `modules/design-system` | 2026-10-24 | Only spacing is tokenized today |
| B-071 | shadcn Progress draws a sliver of its indicator at 0% on some cards (rounded indicator translated -100%); hide the indicator at 0 in the kit | bug | P3 | maintainers | spec 11 | 2026-10-24 | Seen in the spacing audit, catalog page |
| B-072 | Look at the default kit in a real browser (a demo switch or the B-032 catalogue): its fields became one box (`el-field`) and are only covered by component tests | test | P2 | maintainers | spec 11, B-032 | 2026-10-24 | The demo runs the shadcn kit only |
| B-001 | Re-run `init.sh --target claude,codex --update` from AI-Dev-Rules `main` once its PRs #1, #2, #3 are merged; commit the new `.ruleset-version` | ops | P1 | maintainers | AI-Dev-Rules #1–#3 | 2026-10-22 | Current install comes from a local integration of those PRs |

## Next

| ID | Task | Type | Priority | Owner | Link | Added | Notes |
|---|---|---|---|---|---|---|---|
| B-078 | Close remaining overdue test gates and schedule pilot-dependent tests | test | P2 | maintainers | `TEST_PLAN.md`, Missing tests below | 2026-10-24 | Explicit inventory replaces obsolete phase-only promises; no absent script is advertised as runnable |
| B-079 | Skip unknown outbox event types before reserving a claim | bug | P3 | maintainers | `packages/db/src/storage/outbox.queries.ts` | 2026-10-24 | A newer event type can consume a single claim and end this relay pass early; older supported events resume on a subsequent pass. Add a mixed-version regression |
| B-080 | Refresh native BlockNote dictionaries on an in-place locale switch without losing unsaved editor content | feature | P3 | maintainers | `packages/admin/src/lesson/` | 2026-10-24 | Editor menus use the locale at mount; surrounding product controls switch immediately. Reopening the editor applies the new native dictionary |
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
| B-034 | Upstream to AI-Dev-Rules: the pre-commit hook mistakes `grep -n` (or any `-n`) in a chained command for `git commit -n` and blocks it | debt | P3 | | | 2026-10-23 | Hit while committing a fix |
| B-035 | Nonce-based Content Security Policy in apps/demo and in the integration guide (spec 08) | feature | P2 | maintainers | spec 08 | 2026-10-23 | Needs Next.js proxy middleware |
| B-036 | E2E on Firefox and WebKit (iOS Safari ≥ 16 target) | test | P2 | maintainers | `TEST_PLAN.md` #44, #45 | 2026-10-23 | |
| B-052 | Role and grade assignments do not set a due date on an existing self enrollment; decide whether they should | question | P3 | maintainers | spec 05 | 2026-10-24 | Pending lookup skips enrolled courses |
| B-003 | Write the delivery plan (packages as units, trusted publishing, one publisher) before adding a release workflow | docs | P2 | maintainers | `modules/library-publishing` | 2026-10-22 | `release.yml` template is manual-only until then |
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

| B-014 | Mutation testing | Stryker against domain/server behavior; enforce mutation floors | Mutation | `TEST_PLAN.md` #4 | 2026-10-24 |
| B-013 | Package release safety | Public API reports, packed consumer smoke/installation, and previous-version upgrade/rollback fixtures after a versioned baseline exists | Contract, smoke, installation, upgrade | `TEST_PLAN.md` #8, #14, #51–53 | 2026-10-24 |
| B-015 | Runtime compatibility | Node 22/24 and macOS/Linux CI matrix | OS compatibility | `TEST_PLAN.md` #46 | 2026-10-24 |
| B-078 | Outstanding security and resilience suites | CodeQL; route fuzz/injection corpus; provider retry contracts; deadlock contention; DST and cooldown boundaries; recorded exploratory session | #23, #28, #33, #37, #42, #49, #58 | `TEST_PLAN.md` | 2026-10-24 |
| B-078 | Pilot gates | Load/stress/spike/soak, ZAP, UAT and usability with real participants; set dates when pilot is selected; external penetration test before 1.0 | #16–19, #29, #36, #56, #59 | `TEST_PLAN.md`, Q-001 | 2026-10-24 |
| B-032 | Visual regression | Component stories and screenshot baselines | Visual | `TEST_PLAN.md` #11 | 2026-10-24 |
| B-036 | Browser matrix | Firefox and WebKit/iOS journeys | Browser/device | `TEST_PLAN.md` #44–45 | 2026-10-24 |

## Questions / decisions pending

| ID | Question | Who decides | Blocking | Asked on | Link |
|---|---|---|---|---|---|
| Q-002 | The public demo lets anyone sign in as the admin persona and edit content or upload files. Reset it on a schedule (database and uploads), put it behind basic auth, or make the back-office read-only there? | Maxime | No | 2026-10-24 | `PROJECT.md` section 5 |
| Q-001 | Which host product pilots the module? Still undecided on 2026-10-23; the demo app stays the only host | Maxime | Phase 5 | 2026-10-22 | spec 09, Q4 |

## Done (last 30 days, then prune)

| ID | Task | Closed on | PR |
|---|---|---|---|
| B-086 | Immediate chapter-menu dismissal before native toggle dispatch, with deterministic regression coverage | 2026-10-25 | this PR |
| B-085 | Admin navigation, bounded scrolling, dedicated course creation, keyboard tabs, progressive chapter actions, spacing and localized language selection | 2026-10-25 | this PR |
| B-084 | Optional demo-wide Dashly help/feedback widget with private runtime configuration and cross-screen browser checks | 2026-10-25 | this PR |
| B-082 | Course authoring workspace: sidebar, chapter/lesson structure, validation controls, access guidance and read-only saved preview | 2026-10-24 | this PR |
| B-083 | Bounded local video uploads, encoding, signed HLS playback and browser verification | 2026-10-24 | this PR |
| B-058 | Back-office video upload driven end to end on desktop and mobile | 2026-10-24 | this PR |
| | Technical specifications 01–10, repository security baseline | 2026-10-22 | direct commits before branch protection |
| | AI-Dev-Rules adoption (Claude Code and Codex) | 2026-10-22 | #1 |
| B-081 | Local E2E preparation builds all workspace packages before Next, preventing stale dist code from invalidating browser verification; French native-editor regression exposed it | 2026-10-24 | this PR |
| B-073 | React cache and child-state isolation by API base and host session, including cancellation of previous-session requests | 2026-10-24 | this PR |
| B-074 | Export deadlines and caller cancellation reach images/PDF adapters; browser cleanup and real-work concurrency are regression-tested | 2026-10-24 | this PR |
| B-075 | Per-delivery outbox leases, bounded handlers and attempt-fenced acknowledgements; two-worker PostgreSQL and stale-claim regressions | 2026-10-24 | this PR |
| B-076 | Test inventory and branch-protection docs reconciled with implementation; remaining gaps explicitly tracked | 2026-10-24 | this PR |
| B-077 | AST-based workspace architecture checks and positive/negative fixtures run in lint and the existing CI gate | 2026-10-24 | this PR |
| | Compact demo toolbar, default learner profile, role/language switches, English/French shell and editor dictionaries, French example course, two attributed real video excerpts | 2026-10-24 | this PR |
| B-064 | `styles.css` of the React package split by area (`base`, `content`, `video`, `columns`, `export`), imported in the original order; the flattened CSS is identical | 2026-10-24 | this PR |
| B-063 | Column resize handle named in the editor's language (`createLessonEditorSchema`, en and fr in the back-office) | 2026-10-24 | this PR |
| B-066 | Back-office download of a single lesson, drafts included, from its lesson page | 2026-10-24 | this PR |
| B-065 | Export checks: PDF layout read back with pdfjs (found and fixed lesson headings printing smaller than body text), every exported .docx opened by LibreOffice in CI | 2026-10-24 | this PR |
| B-061 | Creating columns by dropping blocks on a block's edge, and a new column from a column list's edge | 2026-10-24 | this PR |
| B-062 | Browser journeys for column drags, pointer resize and removing a column | 2026-10-24 | this PR |
| B-004 | Design system: one design file (`defineDesign`), UI kits with a contract suite, shadcn/ui as theme 1 (registry), the demo rebuilt with it | 2026-10-24 | #49–#53 |
| B-033 | Dark mode (`darkMode`: media, class, off) and contrast warnings (`checkDesign`) | 2026-10-24 | #50 |
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
