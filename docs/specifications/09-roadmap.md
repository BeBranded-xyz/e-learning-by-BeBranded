# 09 — Roadmap and open questions

## Phases

### Phase 0: specification

- [x] Vision, scope, architecture, data model
- [x] Editor choice (BlockNote), npm scope (`@bebranded`), language (English)
- [x] Repository security baseline (secret scanning, push protection, Dependabot, branch protection)
- [ ] Remaining open questions below
- [ ] Pilot host product

### Phase 1: foundations *(done)*

- [x] Monorepo (pnpm, Turborepo, Changesets, CI, license check, CodeQL)
- [x] `core`: types, Zod schemas, `canAccess`, progress computation
- [x] `db`: initial migrations, `postgresStorage`, `migrate` CLI
- [x] `server` + `next`: identity, catalog, courses, text lessons, completion
- [x] `editor`: block schema, content validation, server-side rendering
- [x] `react`: provider, theming, catalog, course page, text lesson player
- [x] `apps/demo` with fake multi-role auth

**Deliverable**: a course made of text lessons, with access rules and progress, running in the demo app.

### Phase 2: video *(done)*

- [x] `video`: Cloudflare Stream adapter (direct upload, webhooks, signed tokens)
- [x] `<VideoPlayer>` with segment tracking, heartbeats and resume
- [x] Server-side plausibility and merging, anti-cheat e2e tests

**Deliverable**: video lessons with verified completion.

### Phase 3: quizzes *(done)*

- Question custom blocks in the editor, `editorDocumentToQuiz()` conversion
- Redaction and server-side grading, attempts, cooldown, shuffling
- `<Quiz>` built on SurveyJS Form Library
- Corrections and explanations

**Deliverable**: graded quizzes with a passing score.

### Phase 4: back-office *(done)*

- [x] Content tree (drag & drop, and move buttons), BlockNote lesson editor with file uploads
- [x] Video uploads (resumable tus above 200 MB) and the quiz editor
- [x] Access-rule and assignment management, extra quiz attempts
- [x] Learner tracking, reports, CSV export
- [x] `@bebranded/elearning-admin`, and the demo's back-office with end-to-end journeys

**Deliverable**: all content managed without touching code.

### Phase 4b: editor extensions

- [x] Multi-column spike (time-boxed to 3 days): nested columns, drag & drop, cursor movement. Go / no-go on the full implementation, or the simpler fallback. **Go** ([ADR-0001](../adr/0001-multi-column-layout-blocks.md)).
- [x] Multi-column layout: validation, editor blocks and resizing, learner, PDF and Word rendering
- [x] `ExportDocument` and HTML renderer, then PDF (Chromium adapters) and DOCX (`docx`)
- [x] Export routes on the server, with the per-course learner setting
- [x] Export security tests (no network from the renderer, SSRF, limits)
- [x] Clean-room checkbox in the pull request template
- [ ] Export buttons on the learner pages and in the back-office, the learner-export setting in course settings, demo and end-to-end journeys (columns and exports)

**Deliverable**: multi-column lessons, and lessons and courses exportable to PDF and Word. See [10 — Editor extensions](10-editor-extensions.md).

### Phase 5: first host product in production

- Integration in the pilot product, integration time measured
- Events, outbox and webhooks
- Public documentation, first npm release `1.0.0`

### Phase 6: second host product, then beyond

- Integration in a 2nd product (proves reusability)
- Mux and Bunny adapters
- Then, as needed: certificates, learning paths and prerequisites, finer admin roles (team manager), due-date reminders, multi-language courses

## Decisions made

| # | Question | Decision |
|---|----------|----------|
| Q1 | npm scope | `@bebranded/elearning-*`. The `@bebranded` scope already belongs to BeBranded. |
| Q2 | Rich-text format | **BlockNote** (Notion-like block editor), documents stored as BlockNote JSON. The quiz editor reuses it. |
| Q7 | Language | **English everywhere**: code, docs, specifications, commit messages. |
| Q12 | Learner export of lessons to PDF and Word | Built, **off by default** per course (`allowLearnerExport = false`). Admins and authors can always export; an admin turns learner export on per course. |
| Q13 | Phase dates | No dates: every phase is built, in order. A `planned phase N` test category becomes blocking when phase N starts. |

## Open questions

| # | Question | Options | Proposal |
|---|----------|---------|----------|
| Q3 | Multi-tenant from v1? | Yes (`tenant_id` everywhere), no | Yes: cheap now, expensive later, and ERPs need it |
| Q4 | Pilot host product | ERP, client web app… | To be decided. Ideally a Supabase product with roles already in place. |
| Q5 | Default video provider | Cloudflare Stream, Mux, Bunny | Cloudflare Stream (already in our stack) |
| Q6 | Supported front-end frameworks | React only, React + Web Components | React only in v1, headless mode for the rest |
| Q8 | SCORM / xAPI | Out of scope, SCORM import, xAPI emission | Out of scope for v1. Revisit if a client brings existing SCORM content. |
| Q9 | Presence check during videos? | No, random question, idle detection | No in v1 (see [06 — Video](06-video.md)) |
| Q10 | BlockNote UI kit for the admin editor | Mantine (`@blocknote/mantine`), shadcn (`@blocknote/shadcn`), Ariakit | Mantine by default (most complete, styles scoped to the editor). shadcn variant for hosts already on shadcn/ui. |
| Q11 | Default PDF adapter | Serverless Chromium (Vercel), Cloudflare Browser Rendering, Gotenberg | Serverless Chromium for Vercel hosts. Cloudflare Browser Rendering if cold starts or bundle size become a problem. |
