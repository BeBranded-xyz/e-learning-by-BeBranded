# Test Plan

> Status of every test category from `docs/reference/testing-catalogue.md`.
> Every category is **required by default** (`core/testing.mdc`). Status is one of:
> `active` (tool + command + gate filled in), `planned YYYY-MM-DD` (blocking after
> that date), or `N/A: <reason>` (must be accepted by a reviewer).
> Gates: `commit` | `pr` | `pre-prod` | `deploy` | `prod`.

Last updated: 2026-10-22
Owner: BeBranded maintainers

> Specification stage: there is no code yet, so most categories are `planned`
> for the roadmap phase that introduces the code they test
> (`docs/specifications/09-roadmap.md`). Phases have no dates and run in
> order (spec 09, Q13); a planned category becomes blocking when its phase starts.

## Check command

`make check` runs gitleaks (history and working tree), the relative doc link
check, `git diff --check`, then `pnpm check`: Prettier, ESLint, typecheck,
Vitest with coverage floors, knip, and the license allowlist. CI runs the same
suites as separate jobs (`.github/workflows/ci.yml`) behind one `gate` check.

## Coverage and mutation thresholds

| Layer | Coverage target | Coverage floor | Mutation score floor |
|---|---|---|---|
| Business logic / data access | 100% lines and branches | 95% | 80% |
| Handlers / components | 100% | 85% | 70% |
| UI glue | as high as the framework allows | 70% | 60% |

Floors only go up; the target is always the maximum. Edit here and in the CI
config in the same PR. Tests that cannot be written yet are listed in
`BACKLOG.md` under "Missing tests".


## Foundations

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 1 | Static Analysis | active | Prettier, ESLint (typescript-eslint strict, size limits), tsc strict, knip, gitleaks, doc link check | `make check` | commit | |
| 2 | Unit Tests | active | Vitest | `pnpm test:unit` | commit | core: access, progress, schemas, events. Other packages join as they land |
| 3 | Property-Based Testing | active | fast-check | `pnpm test:unit` | commit | canAccess (child never wider than parent, deny wins, order independence), progress bounds, status monotony |
| 4 | Mutation Testing | planned phase 1 | Stryker | `pnpm stryker run --incremental` | pr | core and server packages first |
| 5 | Component / Module Tests | active | Vitest + Testing Library (jsdom), fake HTTP boundary | `pnpm test:component` | commit | Catalog, course page, lesson player, My training: loading, empty, error, interactions, cache refresh |
| 6 | Integration Tests | active | Vitest + Testcontainers (PostgreSQL 14) or `ELEARNING_TEST_DATABASE_URL` | `pnpm test:integration` | commit | Real Postgres, one schema per test file, never mocked |
| 7 | API Tests | active | Vitest with real Request/Response and PostgreSQL | `pnpm test:integration` | commit | Every learner and admin route, error envelope, status codes (400, 401, 403, 404, 405, 409, 413, 415, 500), headers, request id |
| 8 | Contract Tests | planned phase 1 | Zod schemas + API report (API Extractor) | `pnpm test:contract` | pr | Public API and HTTP contract |
| 9 | End-to-End (E2E) Tests | active | Playwright on apps/demo (Chromium, desktop and Pixel 7 viewports), PostgreSQL through Testcontainers | `pnpm test:e2e` | pr | Course completion lesson by lesson, self-enrollment, access per role, drafts hidden, signed-out state, API boundary; video lesson played for real (synthetic ffmpeg stream): completion by watching, skip refused, forged heartbeat truncated, speed capped; quiz passed (lesson and course completed, corrections), failed until the attempts run out (corrections hidden), no answer in any response and forged answers scoring 0, SurveyJS form audited by axe |
| 10 | UI / Frontend Tests | active | Testing Library, user-event | `pnpm test:component` | commit | Behavior by role and label, never implementation |
| 11 | Visual Regression Testing | planned phase 1 | Playwright screenshots | `pnpm test:visual` | pr | Includes host themes and exports (spec 10) |
| 12 | Accessibility Testing | active | axe-core in component tests and @axe-core/playwright in E2E (WCAG 2.0 to 2.2 A and AA), eslint-plugin-jsx-a11y-x | `pnpm test:component`, `pnpm test:e2e` | commit, pr | Every screen of the journeys audited in the real browser |
| 13 | Regression Testing | active | Vitest | `pnpm test:unit` | commit | Every bug fix starts with a failing test |
| 14 | Smoke Tests | planned phase 1 | Playwright | `pnpm test:smoke` | pr | Consumer fixture apps from the packed tarball |
| 15 | Sanity Tests | active | Vitest | `pnpm test:unit` | commit | |

## Performance Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 16 | Load Testing | planned phase 5 | k6 on apps/demo |  | pre-prod | Heartbeat, catalog, quiz submission endpoints |
| 17 | Stress Testing | planned phase 5 | k6 |  | pre-prod |  |
| 18 | Spike Testing | planned phase 5 | k6 |  | pre-prod | Many learners starting a video at once |
| 19 | Soak / Endurance Testing | planned phase 5 | k6 |  | pre-prod | Outbox growth, memory |
| 20 | Scalability Testing | N/A: the module runs inside host processes; scaling is the host's. Per-request cost is covered by 16 |  |  |  |  |

## Reliability Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 21 | Failure Injection | planned phase 2 | Vitest with fake adapters | `pnpm test:resilience` | pr | Video provider, file storage, event sink down or slow |
| 22 | Timeout Testing | planned phase 2 | Vitest, fake clock | `pnpm test:resilience` | pr | Provider calls, PDF render timeout |
| 23 | Retry Testing | active (outbox) / planned phase 2 (providers) | Vitest, injected clock | `pnpm test:integration` | commit | Failed delivery retried after backoff with the same event id; backoff bounds and cap |
| 24 | Failover Testing | N/A: no infrastructure owned by the module |  |  |  |  |
| 25 | Recovery Testing | planned phase 2 | Vitest + Testcontainers | `pnpm test:integration` | pr | Outbox redelivery after crash |
| 26 | Disaster Recovery Testing | N/A: data lives in the host's or a dedicated database operated by the host |  |  |  |  |
| 27 | Chaos Engineering | N/A: no running service of our own |  |  |  |  |

## Security Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 28 | SAST | planned phase 1 | CodeQL, eslint-plugin-security |  | pr |  |
| 29 | DAST | planned phase 5 | ZAP baseline on apps/demo |  | pre-prod |  |
| 30 | Dependency Security Testing | active | Dependabot alerts and updates (npm, actions), pnpm audit, license allowlist | `pnpm audit --audit-level=high && pnpm check:licenses` | pr | |
| 31 | Authentication Testing | active | Vitest | `pnpm test:integration` | commit | No identity gives 401; invalid identity gives a generic 500; the resolver runs on every request |
| 32 | Authorization Testing | active | Vitest + Testcontainers | `pnpm test:integration` | commit | Every audience type, deny wins, drafts and archived hidden, child never wider than parent, tenant crossing on reads and admin writes, shared catalog read-only, admin routes refused to non-admins, 404 instead of 403 for hidden content |
| 33 | Injection Testing | active (content, SQL) / planned phase 1 (handlers) | Vitest, fast-check | `pnpm test:unit` | commit | XSS payloads and fuzzed text through the renderer, hostile links and schemes, CSS values in props, SQL injection through tenant filters. SSRF in exports: phase 4b |
| 34 | Web Security Testing | active (headers, CSRF) / planned (CSP) | Playwright | `pnpm test:e2e` | pr | Cross-origin writes refused, admin routes refused to learners, X-Frame-Options, nosniff, no X-Powered-By. Nonce-based CSP: B-035 |
| 35 | Secret Scanning | active | gitleaks (CI full history + pre-commit hook), GitHub push protection | `make check` | commit | Workflow `Secret scan`, required check |
| 36 | Penetration Testing | planned before 1.0.0 | external tester |  | pre-prod |  |

## Advanced Bug Detection

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 37 | Fuzz Testing | active (documents) / planned phase 1 (routes) | fast-check | `pnpm test:unit` | commit | Arbitrary JSON into `validateLessonDocument` never throws; arbitrary text never yields an executable tag. Route inputs with the server package |
| 38 | Differential Testing | planned phase 3 | Vitest | `pnpm test:unit` | pr | Editor document → SurveyJS conversion vs reference fixtures |

## Database Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 39 | Database Tests | active | Vitest + Testcontainers | `pnpm test:integration` | commit | Check constraints (including NULL handling), FKs, unique keys, updated_at triggers, RLS enabled with default deny for other roles. Optional RLS policies: B-018 |
| 40 | Migration Testing | active | Vitest + Testcontainers | `pnpm test:integration` | commit | Clean DB, idempotent re-run, upgrade from an earlier subset, concurrent runs, modified or unknown applied migration, failed migration rolls back. Upgrade on previous release data: from the first release (B-013) |

## Concurrency Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 41 | Race Condition Testing | active (enrollment, progress) / planned phase 2 (heartbeats, quizzes) | Vitest + Testcontainers | `pnpm test:integration` | commit | Racing first requests create one enrollment and one course.started; concurrent completions keep counts right; outbox claims never overlap |
| 42 | Deadlock Testing | planned phase 2 | Testcontainers | `pnpm test:concurrency` | pr | Progress recomputation transactions |
| 43 | Idempotency Testing | active | Vitest + Testcontainers | `pnpm test:integration` | commit | start, complete and enroll repeated give the same state and no duplicate event; migrations re-run |

## Compatibility Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 44 | Browser Testing | active (Chromium) / planned (Firefox, WebKit) | Playwright | `pnpm test:e2e` | pr | B-036 |
| 45 | Device Testing | planned phase 4 | Playwright device emulation |  | pre-prod | iOS Safari ≥ 16 |
| 46 | Operating System Testing | planned phase 1 | CI matrix Linux + macOS |  | pr | Node ≥ 22.12 |
| 47 | Responsive Testing | active | Playwright viewports | `pnpm test:e2e` | pr | Every journey on desktop and mobile; columns (phase 4b) to add |

## Internationalization

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 48 | Localization Testing | active | Vitest | `pnpm test:unit` | commit | Every English message has a French one; host overrides; locale fallback; dates in UTC and percentages per locale |
| 49 | Date / Time Testing | planned phase 1 | Vitest with fixed time zones | `pnpm test:i18n` | pr | Due dates, cooldowns, DST |
| 50 | Currency / Number Testing | N/A: the module handles no money; numbers are scores and durations, covered by 2 |  |  |  |  |

## Deployment Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 51 | Installation Testing | planned phase 1 | Consumer fixture apps from `pnpm pack` | `pnpm test:consumers` | pr | Per supported Next.js and React major |
| 52 | Upgrade Testing | planned phase 1 | Testcontainers | `pnpm test:upgrade` | pr | Previous minor's schema and data |
| 53 | Rollback Testing | planned phase 2 | Testcontainers | `pnpm test:upgrade` | pr | Previous package version against the new additive schema |
| 54 | Configuration Testing | active | Vitest | `pnpm test:unit` | commit | createElearning and postgresStorage reject invalid options at startup; defaults documented |

## Business Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 55 | Acceptance Testing | planned phase 1 | Playwright on apps/demo | `pnpm test:acceptance` | pre-prod |  |
| 56 | User Acceptance Testing (UAT) | planned phase 5 | pilot host product |  | pre-prod |  |
| 57 | Business Logic Testing | planned phase 1 | Vitest | `pnpm test:unit` | commit | Invariants in PROJECT.md section 7 |

## Human Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 58 | Exploratory Testing | planned phase 2 | session notes |  | pre-prod | Every release |
| 59 | Usability Testing | planned phase 4 | sessions with content authors |  | pre-prod | Editor and back-office |

## Production Testing & Monitoring

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 60 | Error Monitoring | N/A as a service: the host owns monitoring. Logger and onMetric hook calls tested under 2 (planned phase 1) |  |  |  |  |
| 61 | Logging | N/A as a service, see 60. Redaction of sensitive keys tested under 2 |  |  |  |  |
| 62 | Metrics Monitoring | N/A as a service, see 60 |  |  |  |  |
| 63 | Distributed Tracing | N/A as a service, see 60 |  |  |  |  |
| 64 | Real User Monitoring (RUM) | N/A: no user-facing deployment of our own |  |  |  |  |
| 65 | Synthetic Monitoring | N/A until apps/docs is deployed |  |  |  |  |
| 66 | Uptime Monitoring | N/A until apps/docs is deployed |  |  |  |  |
| 67 | Business KPI Monitoring | N/A: business KPIs belong to host products |  |  |  |  |

## Release Safety

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 68 | Feature Flags | N/A: no feature flags; unstable APIs ship on a separate entry point |  |  |  |  |
| 69 | Canary Deployment | N/A: packages are not deployed with traffic; pre-releases use the `next` dist-tag (library-publishing) |  |  |  |  |
| 70 | Blue/Green Deployment | N/A: see 69 |  |  |  |  |
| 71 | Shadow Traffic | N/A: see 69 |  |  |  |  |
| 72 | Automated Rollback | N/A: a broken version is fixed forward and deprecated on npm (library-publishing) |  |  |  |  |

## Human testing (after all automated gates are green)

| Activity | Cadence | Last run | Findings logged in |
|---|---|---|---|
| Exploratory session | every release | not yet | GitHub issues, label `exploratory` |
| Usability test | before 1.0.0, then yearly | not yet | `docs/` |
| UAT sign-off | every release, in the pilot host | not yet | `docs/` |
| Penetration test | before 1.0.0 + yearly | not yet | private advisory |
