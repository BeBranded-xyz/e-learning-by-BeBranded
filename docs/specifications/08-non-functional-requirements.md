# 08 — Non-functional requirements

## Security

Security is a first-class requirement. The module runs inside other companies' products and handles their employees' data, and this repository is public. The rules below are mandatory, not guidelines.

### Application security

- **The server is the source of truth** for every decision: access, completion, grading. No progress state is ever accepted from the client as is.
- **Input validation**: every request body, query string and route parameter is parsed with Zod. Unknown fields are rejected.
- **SQL**: parameterized queries only (Kysely). No string-built SQL anywhere, including migrations that take parameters.
- **Tenant isolation**: `tenant_id` is enforced by the storage layer on every query, not left to individual handlers. Tests assert that no data crosses tenants.
- **Rich content (BlockNote)**:
  - documents are validated against the module's block schema on write: allowed block types only, no raw HTML block, maximum size and depth;
  - link and media URLs go through a protocol allowlist (`https:`, `http:`, `mailto:`), so `javascript:` and `data:` URLs are rejected;
  - documents are also limited in total JSON size, nesting and table cells, measured iteratively so a hostile document cannot exhaust the stack;
  - image and file blocks may only point to files uploaded through the module (`elearning-file:<id>`); external and `data:` URLs are rejected, and audio and video blocks stay rejected (video lessons carry videos). When a lesson is rendered, each file is resolved to a short-lived signed URL; a file of another tenant, or a deleted one, renders nothing;
  - server-side rendering escapes all text, and the rendered HTML then goes through an allowlist-based sanitizer (`sanitize-html`, MIT) as defense in depth. Colors and alignment are emitted as data attributes from validated enums, never as inline styles;
  - lesson pages ship a strict **Content Security Policy** recommendation in the integration guide.
- **Quizzes**: correct answers never leave the server for learners (see [07 — Quizzes](07-quizzes.md#security-correct-answers-never-reach-the-client)).
- **Files**: MIME allowlist, size limit, server-generated storage keys (never the user's filename), private buckets with signed URLs.
- **Video**: signed, per-learner, short-lived playback URLs. Provider webhooks verified by signature, with timestamp checks against replay.
- **Outgoing webhooks**: HMAC-SHA256 signature plus timestamp, against replay.
- **CSRF**: state-changing routes require a JSON `Content-Type` and check `Origin` against an allowlist. Hosts using cookie sessions keep `SameSite=Lax` or stricter.
- **Rate limiting**: the module exposes a `rateLimit` hook that the host wires to its infrastructure (Upstash, Cloudflare…). Recommended limits are documented for heartbeats, quiz submissions and uploads.
- **Errors**: generic messages to clients. No stack traces, SQL or internal identifiers in responses. Details go to the server logs with a `requestId`.
- **Logging**: secrets, tokens, signed URLs and quiz answers are never logged. The logger redacts known sensitive keys.
- **No secrets client-side**: React packages only call the host's API. Server-only entry points map the `browser` export condition to a module that throws, so bundling them into client code fails at load. (The `server-only` package would also break plain Node, where the module must run.)

### Repository hygiene (public repository)

Nothing sensitive may ever be committed. A secret pushed once must be considered compromised, even if the commit is removed later.

- **Never commit**: credentials, API tokens, private keys, `.env` files, database dumps, real customer or learner data, internal URLs of client projects, names of client companies, screenshots of real client products.
- **Examples and fixtures** use obviously fake values (`example.com`, `00000000-0000-…`, `sk_test_xxx`-style placeholders that do not match real formats) and synthetic people.
- **`.env.example`** lists variable names with empty values only.
- **Secret scanning in CI**: [gitleaks](https://github.com/gitleaks/gitleaks) scans the full history on every push and pull request. A finding fails the build.
- **GitHub secret scanning and push protection** are enabled on the repository, so a push containing a known secret format is refused before it lands.
- **Local pre-commit scan** recommended for contributors (`gitleaks git --staged`), described in [CONTRIBUTING.md](../../CONTRIBUTING.md).
- **Commit identity**: contributors commit with their GitHub `noreply` email address.
- **If a secret leaks**: revoke and rotate it immediately at the provider, then clean history if needed. Rotation comes first, because history rewriting does not undo exposure.

### Supply chain

- **Dependency updates** through Dependabot (npm and GitHub Actions), with security updates enabled.
- **GitHub Actions pinned by commit SHA**, not by tag. Workflows run with `permissions: contents: read` by default and only elevate per job when needed.
- **Lockfile committed**, installs with `--frozen-lockfile`. Dependency install scripts are disabled by default (`pnpm` `onlyBuiltDependencies` allowlist).
- **Static analysis**: CodeQL on every pull request once code lands (phase 1).
- **npm publishing** via GitHub Actions with **trusted publishing (OIDC)** and **provenance**. No long-lived npm token is stored in the repository or in repository secrets. Two-factor authentication is required for every maintainer of the `@bebranded` npm scope.
- **Branch protection** on `main`: no force pushes, no deletion. Once CI exists: pull requests with passing checks required.
- **Vulnerability disclosure** through GitHub private vulnerability reporting (see [SECURITY.md](../../SECURITY.md)).

## Personal data (GDPR)

- The module only stores `learner_id` (a pseudonym from the module's point of view) and learning data. The `display_name` cache can be disabled.
- **Right to erasure**: `elearning.deleteLearnerData(learnerId)` deletes progress, attempts and enrollments.
- **Right of access / portability**: `elearning.exportLearnerData(learnerId)` produces a JSON export.
- **Retention**: configurable retention for the progress data of inactive learners, purged by a scheduled job (shipped as a function, triggered by the host).
- Data stays in the infrastructure chosen by the host (its own database or the dedicated one). The only third party involved is the video provider, which receives no personal data beyond an opaque identifier in the playback token.

## Accessibility

- Target: **WCAG 2.1 level AA** for every learner and admin component.
- Full keyboard navigation, visible focus, ARIA roles and labels, and checked contrast even with a host theme (the back-office warns when theme colors fail contrast requirements).
- Respects `prefers-reduced-motion`.
- Automated checks with axe-core in Playwright.

## Performance

- React components are **Server Component**-compatible: the catalog, the course page and text lessons render on the server. Only the video player, the quiz and interactive pieces are Client Components.
- Lesson content is rendered to HTML on the server, so **BlockNote is never loaded on learner pages**. SurveyJS is loaded on demand (`dynamic import`), only on quiz lessons.
- Target budget: under 30 kB gzip for `elearning-react`, excluding SurveyJS and hls.js.
- Course progress is fetched in **a single aggregated SQL query** (no N+1).
- Indexes on (`learner_id`, `lesson_id`), (`course_id`, `learner_id`), (`target_type`, `target_id`), and `tenant_id` on every table.

## Compatibility

- Node.js ≥ 22.12 (Node 20 reached end of life in April 2026, and Kysely 0.29 requires 22), React ≥ 18 (19 recommended), Next.js ≥ 14 (App Router).
- PostgreSQL ≥ 14 (Supabase, Neon, RDS, self-hosted).
- Browsers: last two versions of evergreen browsers, iOS Safari ≥ 16.

## Quality and testing

| Level | Tooling | Target |
|-------|---------|--------|
| Business rules (core) | Vitest + fast-check (property-based tests) | ≥ 95% coverage: access, interval merging, plausibility, grading, editor-to-SurveyJS conversion, content validation |
| Storage (db) | Vitest + ephemeral Postgres (Testcontainers) | Every query, forward migrations, tenant isolation |
| Handlers (server) | Vitest with real `Request` / `Response` objects | Every error code, access checks, no answer leakage |
| Components | Vitest + Testing Library | Key behaviors, accessibility |
| End-to-end | Playwright on `apps/demo` | Full learner journey, video and quiz anti-cheat scenarios, theming |
| Security | Dedicated test suite | XSS payloads in BlockNote documents, tenant crossing, forged heartbeats, quiz answer leakage |

- GitHub Actions CI: lint (ESLint + Prettier), typecheck, tests and build on every pull request.
- **Migration compatibility tests**: every release checks that migrations apply to a database at the previous version that already contains data.

## Licensing

- The module is licensed under **MIT**.
- **Allowed dependency licenses**: MIT, ISC, BSD-2/3-Clause, Apache-2.0, and **MPL-2.0 for unmodified dependencies** (needed for BlockNote). MPL-2.0 is a file-level copyleft: using the packages as dependencies places no obligation on our code. Only modified copies of MPL files would have to be published under MPL. We do not patch or vendor BlockNote source files.
- **Forbidden**: GPL, LGPL, AGPL, SSPL, BUSL and commercial licenses. This explicitly excludes:
  - **SurveyJS Creator** (commercial);
  - the **`@blocknote/xl-*` packages** (`xl-multi-column`, `xl-pdf-exporter`, `xl-docx-exporter`, `xl-ai`…), licensed GPL-3.0 or commercial. We build the equivalent features ourselves under **clean-room rules**: nobody reads their source (see [10 — Editor extensions](10-editor-extensions.md#clean-room-rules));
  - any code from ClassroomIO, LearnHouse or CourseLit (AGPL).
- **Dual-licensed dependencies** are allowed when one option is on the allowlist, and we use that option. Example: `jszip` (MIT or GPL-3.0), used under MIT.
- An automated license check in CI fails the build on any dependency outside the allowlist.
- **Zlib** is accepted for `pako` only (a dependency of `jszip`, used by `docx`), as a recorded exception: it is a permissive, notice-only license.
- Notable dependencies checked: BlockNote core / react / server-util (MPL-2.0), SurveyJS Form Library (MIT), hls.js (Apache-2.0), Kysely (MIT), Zod (MIT).

## Observability

- Injectable logger (`logger` in the config). Defaults to `console`, and the host can plug in pino or Sentry.
- Unexpected handler errors are logged with a `requestId`, and the learner gets a generic message.
- Counters exposed through an `onMetric` hook: rejected heartbeats, event delivery failures, request durations.

## Documentation

- `apps/docs`: step-by-step integration guide, configuration reference, API reference, theming guide, security guide (CSP, rate limits, secret handling), migration guides between major versions.
- `apps/demo`: a complete fictional host product, which is also the e2e test bed.
- CHANGELOG generated by Changesets.
- Everything in the repository (code, comments, docs, specifications, commit messages) is written in **English**.
