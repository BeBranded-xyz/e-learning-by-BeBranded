# Project Identity

> **This is the only file that should contain project-specific facts.**
> The rules in `.claude/rules/` are project-agnostic and defer to this file.
> Keep it up to date in the same PR whenever the stack, structure, or a key
> decision changes. **This repository is public**: never put secrets, client
> names, internal identifiers, or internal URLs here.

Last updated: 2026-10-25

---

## 1. What this project is

- **Name**: e-learning by BeBranded
- **One-line description**: an embeddable, themeable e-learning module (courses,
  verified video, quizzes, progress, role-based access) that host web products
  install as npm packages.
- **Domain / problem**: several products need user training. Instead of
  rebuilding it per product, one versioned module is installed everywhere and
  receives fixes through semver updates. Non-trivial parts: trustworthy
  completion (video watch verification, server-side grading), permission rules
  driven by the host's roles, and two data modes (host database or dedicated).
- **Status**: phases 1 to 4 (foundations, video, quizzes, back-office) complete;
  nothing published to npm yet. See
  `docs/specifications/09-roadmap.md`.
- **License**: MIT, copyright BeBranded. Public repository.

## 2. How it runs

- **Primary runtime**: TypeScript packages consumed by Next.js (App Router) host
  products; server handlers use Web `Request`/`Response`.
- **Entry points**: the `@bebranded/elearning-*` packages; later `apps/demo`
  (fictional host, e2e bed) and `apps/docs` (public docs).
- **Local dev command(s)**: `corepack pnpm --filter @bebranded/elearning-demo dev` (with `ELEARNING_DATABASE_URL` and the demo seed, see the README).
- **End-to-end**: `corepack pnpm test:e2e` (Playwright on `apps/demo`, desktop and mobile, PostgreSQL through Testcontainers).
- **Check command**: `make check`: gitleaks on history and working tree,
  relative doc links, `git diff --check`, then `pnpm check` (Prettier, ESLint,
  typecheck, Vitest with coverage floors, knip, license allowlist).
- **Toolchain**: Node 24 for development (`.node-version`), packages support
  Node ≥ 22.12; pnpm 10 through Corepack (`corepack pnpm`); TypeScript 6
  (typescript-eslint does not support TypeScript 7 yet).
- **Build / start**: `corepack pnpm build` (Turborepo, `tsc` per package).
- **Workspace resolution**: each package exports a `@bebranded/source`
  condition pointing to `src/index.ts`. TypeScript (`customConditions`),
  ESLint, Vitest and `tsx` use it, so checks never depend on a previous build.
  Published consumers do not set it and resolve `dist`.
- **Deployment target**: the npm registry (packages). `apps/demo` runs as one
  container (`apps/demo/Dockerfile`) behind a reverse proxy with automatic TLS,
  at https://e-learning.bebranded.xyz. Hosting for `apps/docs` is undecided.
- **What triggers a deploy**: a reviewed PR merged into protected `main`; the
  Changesets release PR, once merged, publishes the affected packages from CI.

## 3. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript (strict) | |
| App framework (hosts, demo) | Next.js App Router | Hosts ≥ 14 |
| UI | React ≥ 18.2 | Learner and admin components; data through TanStack Query |
| Editor | BlockNote core (MPL-2.0, unmodified) | `@blocknote/xl-*` forbidden (GPL/commercial) |
| Lesson rendering | Own HTML renderer + `sanitize-html` | Spec 02, D11; no DOM, runs on Node and edge |
| Quiz rendering | SurveyJS Form Library (MIT) | SurveyJS Creator forbidden (commercial) |
| Validation | Zod | |
| Database | PostgreSQL ≥ 14 (Supabase compatible), schema `elearning` | Kysely, raw SQL migrations |
| Authentication | none: provided by the host through `IdentityResolver` | |
| File storage | host-provided `FileStorage` port | S3/R2 and Supabase Storage adapters planned |
| Video | Cloudflare Stream (default), Mux, Bunny | `VideoProvider` port |
| Export | headless Chromium (PDF) through host-provided adapters, `docx` (Word) | `@bebranded/elearning-export`, spec 10, clean-room |
| Monitoring / errors | host-injected logger and `onMetric` hook | |
| Background jobs | event outbox, delivery triggered by the host | |
| Demo feedback | Optional Dashly embed, runtime `DEMO_DASHLY_WIDGET_KEY` | Demo only; workspace identifier kept in private hosting configuration |
| Feature flags | none | |
| Release tooling | Changesets, npm trusted publishing with provenance | |
| Monorepo | pnpm workspaces + Turborepo | |
| Tests | Vitest, fast-check, Testing Library, Playwright, Testcontainers | |
| LLM provider | none | |

## 4. Languages & conventions

- **Everything in English**: code, identifiers, comments, commits, docs,
  specifications, issues.
- **User-facing UI strings**: English and French, extensible by hosts.
- **Commit messages**: conventional commits; commit with the GitHub noreply
  address.
- **Tone**: technical and factual. **Emojis** in code, commits, technical docs:
  not allowed.
- **Size limit overrides**: none. **Exemptions**: the 50-line function limit is not
  applied to `describe` callbacks in test files (each test stays small);
  enforced in `eslint.config.js`.

### Design system (projects with a UI)

- **Token source**: one design file, `elearning.design.ts`, validated by
  `defineDesign` (`packages/core`); it generates the `--el-*` variables, the
  shadcn variables of a host shell, and the export theme
  (`docs/specifications/11-design-system.md`, ADR-0002). The demo's is
  `apps/demo/elearning.design.ts`.
- **UI kit**: the module draws its primitives (button, card, badge, alert,
  progress, fields, table) through `UiKit` (`packages/react`); default kit in
  plain CSS, theme 1 is the shadcn/ui kit published as a shadcn registry by the
  demo (`/r/`).
- **Shared components**: `@bebranded/elearning-react` (learner, phase 1) and `@bebranded/elearning-admin` (back-office, phase 4), which reuses the learner provider, tokens, buttons and loading and error states.
- **API contract types**: `packages/core/src/api/api.types.ts` (learner) and `admin-api.types.ts` (admin), implemented by the server presenters and consumed by the React and admin clients. The authoring workspace uses a persistent
  navigation, keyboard tabs, dedicated demo creation route, localized language
  catalog and saved-draft preview endpoint; the demo encodes bounded local
  MP4/WebM uploads with ffmpeg/ffprobe.
- **Styling approach**: packages ship plain CSS in the `elearning` cascade
  layer, with low specificity (`:where()`), no imposed framework. The demo and the shadcn kit use Tailwind v4
  and shadcn/ui.
- **Spacing**: one unit in the design file (`spacing`), a fixed scale
  `--el-space-1` to `--el-space-8` in the packages and Tailwind's `--spacing`
  in the shell; literal spacing values fail the tests (spec 11, "Spacing").
- **Themes**: light and dark from the design file (`darkMode`: media, class or
  off).
- **Icons**: lucide (shadcn's set) in the demo and the shadcn kit; the packages
  draw no icon font.
- **Catalogue and enforcement**: the kit contract test suite (every primitive,
  every kit); the component catalogue with visual regression is B-032.
  (`BACKLOG.md`).

## 5. Environments & domains

| Environment | URL | What runs | Data |
|---|---|---|---|
| Public demo | https://e-learning.bebranded.xyz | `apps/demo` from `main`, its own PostgreSQL | Synthetic seed only. Anyone can sign in as the demo admin, so visitors can change it (Q-002) |

The demo is redeployed by hand from `main` with a deploy script kept on the
server, outside this public repository (B-067 automates it).

### CI/CD and deployment plan

- **Required checks / main branch protection**: ruleset "Protect main": PR
  required (squash only, threads resolved), required checks `gitleaks` and `All CI checks green`, no force
  push, no deletion.
- **Deployable units**: each `@bebranded/elearning-*` package (published to
  npm), `apps/docs`. Selection and publishing follow
  `modules/library-publishing` and `modules/deployments`; the plan is written
  in phase 1 before any release workflow exists.

## 6. Repository structure

```
.
├── AGENTS.md                 Entry point for Codex (generated rule index at the end)
├── CLAUDE.md                 Entry point for Claude Code
├── PROJECT.md                This file
├── TEST_PLAN.md              Status of every test category
├── BACKLOG.md                Everything still to do
├── README.md / LICENSE / SECURITY.md / CONTRIBUTING.md
├── Makefile                  `make check`
├── docs/
│   ├── specifications/       Technical specifications 01–10
│   ├── adr/                  Architecture decision records
│   ├── reference/            Testing catalogue, ruleset changelog (ruleset-owned)
│   └── *.md                  Registries: functions, migrations, flags, debt, runbook
├── scripts/                  check-doc-links.py (project), ruleset helper scripts
├── .claude/                  Rules, hooks, skills (ruleset-owned except settings.json)
├── .githooks/pre-commit      gitleaks on staged changes, for every editor and agent
└── .github/                  Workflows, Dependabot, PR template
```

- **Monorepo?**: yes from phase 1 (`packages/*`, `apps/*`), see
  `docs/specifications/02-architecture.md`.

### Configuration and architecture

- **Validated configuration boundaries**: `createElearning()` validates its
  options with Zod at startup; the module reads no environment variable itself.
- **Module owners, public APIs, allowed dependency graph**:
  `docs/specifications/02-architecture.md` (package table). `core` depends on
  nothing; adapters implement ports; `react` never imports server packages.
- **Architecture enforcement**: `pnpm check:architecture` (TypeScript AST import graph, public entry points and transitive client/server checks), included in lint and CI.

## 7. Data & source of truth

- **Application database**: the `elearning` schema, in the host database or a
  dedicated one (`docs/specifications/03-data-model.md`).
- **External source of truth**: the host product for identity, roles, grades;
  the video provider for asset duration and status.

### Business invariants

- The server decides completion, grading, and access; client state is never
  accepted as is.
- Correct quiz answers never reach a learner endpoint response.
- A completed lesson never goes back to an incomplete state; historical quiz
  scores are never recomputed.
- Content access is denied by default; `deny` rules always win; a child never
  grants more than its parent.
- Every query is scoped by `tenant_id` in the storage layer.
- Video coverage uses the provider's duration and server-checked, plausible
  intervals only.
- The module stores no personal data beyond the opaque `learner_id` (and an
  optional cached display name).

### Domain ownership and data governance

- **Authoritative rules**: pure functions in `@bebranded/elearning-core`
  (`canAccess`, progress, interval merging, plausibility, `gradeQuiz`,
  `toSurveyJson`, content validation).
- **Data lifecycle**: `deleteLearnerData`, `exportLearnerData`, configurable
  retention (`docs/specifications/08-non-functional-requirements.md`).

## 8. Public identifiers

| Key | Value |
|---|---|
| GitHub repository | `BeBranded-xyz/e-learning-by-BeBranded` (public) |
| npm scope | `@bebranded` (packages `@bebranded/elearning-*`) |
| Conduct and maintainer contact | `max@bebranded.xyz` (business address, published by the owner's decision) |

## 9. Active rules

Core rules always apply.

**Languages**
- [x] `typescript`
- [ ] `python` (only `scripts/check-doc-links.py`; applies to that file)
- [ ] `go`
- [ ] `rust`
- [ ] `php` (incl. WordPress)
- [ ] `swift` (iOS / macOS)
- [ ] `kotlin-android` (native Android)
- [ ] `react-native` (Expo)
- [x] `sql`
- [x] `shell`

**Platforms**
- [x] `nextjs`
- [x] `supabase` (mode A on Supabase hosts; the module must also work on plain Postgres)
- [ ] `cloudflare-workers`
- [ ] `webflow`
- [ ] `vercel`

**Modules**
- [x] `database`
- [x] `data-lifecycle`
- [ ] `audit-trail` (to evaluate for admin actions, see `BACKLOG.md`)
- [ ] `auth` (identity comes from the host)
- [x] `integrations` (video providers, webhooks, outbox delivery)
- [x] `api-design`
- [x] `frontend`
- [x] `design-system`
- [ ] `data-fetching` (to evaluate in phase 1)
- [x] `i18n`
- [x] `performance`
- [x] `background-jobs` (event outbox)
- [x] `observability`
- [x] `infra`
- [x] `deployments` (publishing is the deployment, per `library-publishing`)
- [x] `releases`
- [ ] `ai-features`
- [x] `library-publishing`
- [x] `open-source`
- [x] `maintenance`
- [ ] `graphify`

**Testing**: maximal by default. Status per category in `TEST_PLAN.md`.

## 10. Reference documents

| Doc | Purpose |
|---|---|
| `docs/specifications/` | Technical specifications |
| `TEST_PLAN.md` | Status, tooling, command, and gate for every test category |
| `BACKLOG.md` | Everything still to do |
| `docs/FUNCTIONS_REGISTRY.md` | Routes, webhooks, jobs (from phase 1) |
| `docs/MIGRATIONS_CHANGELOG.md` | Migration history (from phase 1) |
| `docs/FEATURE_FLAGS.md` | Flags (none) |
| `docs/DEBT.md` | Deliberate shortcuts |
| `docs/RUNBOOK.md` | Security and release incident procedures |
| `docs/adr/` | Architecture decision records |

### Ruleset adoption

- **Installed**: 2026-10-22, targets `claude,codex`, from a local integration
  of AI-Dev-Rules `main` plus open pull requests #1, #2, #3 (recorded SHA
  `3389e34` is local only). After they merge, run
  `init.sh --dest . --target claude,codex --update` from AI-Dev-Rules `main`
  (`BACKLOG.md` B-001).
- **Baseline**: nine implemented packages and the Next.js demo; `make check` covers static analysis, architecture, types, unit/component/integration suites, coverage and licenses. Browser journeys and release gates are tracked in `TEST_PLAN.md`.
- **Scoped exceptions**:
  - Dependabot instead of Renovate: maintainer decision (2026-10-23). It is
    built into GitHub and needs no organization app.
  - Workflow templates `pre-production.yml` and `release.yml` stay manual-only
    until their suites exist (`ci.yml` is live since phase 1).
  - RLS (`modules/database`): every table has RLS enabled but **no permissive
    policy**, so only the owning role used by the module can read or write.
    This is the module's default deny; the opt-in policies for direct Supabase
    reads (spec 05, "RLS") come in a later migration (`BACKLOG.md` B-018),
    off by default. Confirmed by the maintainer (2026-10-23).
    Owner: maintainers. Review: when B-018 lands.
  - `exactOptionalPropertyTypes` is off in `packages/editor`, `packages/admin` and
    the private `apps/demo` only (the code that types BlockNote editors; the demo
    type-checks the admin sources): BlockNote
    0.56's generic types (optional props such as `heading.isToggleable`) do not
    type-check with it. The editor package keeps every other strict option.
    Owner: maintainers. Review: on each BlockNote upgrade (`BACKLOG.md` B-021).
  - `pako` (`MIT AND Zlib`), a dependency of `jszip`, which `docx` needs for Word
    export, is a license exception in `scripts/check-licenses.mjs`. The Zlib license
    is permissive (keep the notice; no copyleft). Owner: maintainers. Review: on
    every `docx` major upgrade.
  - The license allowlist covers the dependency trees of the published
    packages (`packages/*`). The private demo app is not distributed; through
    Next.js it pulls `@img/sharp-libvips` (LGPL-3.0, optional image
    optimization), which never reaches a published package.
  - `Kysely<any>` in `packages/db/src/migrations/migrate.ts`: the migration
    runner only issues raw SQL and must accept any database type; documented
    inline.

## 11. Key architecture decisions

Recorded as D1–D10 in `docs/specifications/02-architecture.md`.

## 12. Budgets and thresholds

| Budget | Value |
|---|---|
| `@bebranded/elearning-react` bundle | < 30 kB gzip, excluding SurveyJS and hls.js |
| Course progress query | one aggregated SQL query |
| PDF export render timeout | 30 s |
| Coverage / mutation floors | see `TEST_PLAN.md` |

## 13. Secrets and access (dates only, never values)

No secret is used by this repository yet. npm publishing will use trusted
publishing (OIDC), so no registry token will be stored.

## 14. External systems — do not assume undocumented behavior

- Cloudflare Stream signed URLs, direct upload, and webhook signatures
- npm trusted publishing and provenance
- BlockNote public API and block schema (never its `xl-*` source)
- SurveyJS Form Library JSON schema
- Supabase PostgREST schema exposure and RLS behavior
