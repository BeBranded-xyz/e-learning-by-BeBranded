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
check, and `git diff --check`. Phase 1 replaces it with `pnpm check`: format,
lint, typecheck, unit, and integration tests, plus the same checks.

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
| 1 | Static Analysis | active (docs) / planned phase 1 | gitleaks, doc link check; then ESLint, Prettier, tsc --strict | `make check` | commit | Spec stage covers docs only |
| 2 | Unit Tests | planned phase 1 | Vitest | `pnpm test:unit` | commit | Every core rule: access, progress, intervals, grading |
| 3 | Property-Based Testing | planned phase 1 | fast-check | `pnpm test:unit` | commit | Interval union, plausibility, canAccess, scoreQuiz |
| 4 | Mutation Testing | planned phase 1 | Stryker | `pnpm stryker run --incremental` | pr | core and server packages first |
| 5 | Component / Module Tests | planned phase 1 | Vitest + Testing Library | `pnpm test:component` | pr | react and admin components |
| 6 | Integration Tests | planned phase 1 | Vitest + Testcontainers (Postgres) | `pnpm test:integration` | pr | Real Postgres, never mocked |
| 7 | API Tests | planned phase 1 | Vitest with real Request/Response | `pnpm test:api` | pr | Every route, every error code |
| 8 | Contract Tests | planned phase 1 | Zod schemas + API report (API Extractor) | `pnpm test:contract` | pr | Public API and HTTP contract |
| 9 | End-to-End (E2E) Tests | planned phase 1 | Playwright on apps/demo | `pnpm test:e2e` | pr | Desktop and mobile viewports |
| 10 | UI / Frontend Tests | planned phase 1 | Testing Library | `pnpm test:component` | pr |  |
| 11 | Visual Regression Testing | planned phase 1 | Playwright screenshots | `pnpm test:visual` | pr | Includes host themes and exports (spec 10) |
| 12 | Accessibility Testing | planned phase 1 | axe-core in Playwright and Vitest | `pnpm test:a11y` | pr | WCAG 2.1 AA |
| 13 | Regression Testing | planned phase 1 | Vitest | `pnpm test:unit` | commit | Every bug fix starts with a failing test |
| 14 | Smoke Tests | planned phase 1 | Playwright | `pnpm test:smoke` | pr | Consumer fixture apps from the packed tarball |
| 15 | Sanity Tests | planned phase 1 | Vitest | `pnpm test:unit` | commit |  |

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
| 23 | Retry Testing | planned phase 2 | Vitest, fake clock | `pnpm test:resilience` | pr | Outbox delivery backoff |
| 24 | Failover Testing | N/A: no infrastructure owned by the module |  |  |  |  |
| 25 | Recovery Testing | planned phase 2 | Vitest + Testcontainers | `pnpm test:integration` | pr | Outbox redelivery after crash |
| 26 | Disaster Recovery Testing | N/A: data lives in the host's or a dedicated database operated by the host |  |  |  |  |
| 27 | Chaos Engineering | N/A: no running service of our own |  |  |  |  |

## Security Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 28 | SAST | planned phase 1 | CodeQL, eslint-plugin-security |  | pr |  |
| 29 | DAST | planned phase 5 | ZAP baseline on apps/demo |  | pre-prod |  |
| 30 | Dependency Security Testing | active (Dependabot alerts) / planned phase 1 | pnpm audit, license check | `pnpm audit --audit-level=high` | pr |  |
| 31 | Authentication Testing | planned phase 1 | Vitest | `pnpm test:api` | pr | IdentityResolver null → 401, identity never cached |
| 32 | Authorization Testing | planned phase 1 | Vitest + Testcontainers | `pnpm test:authz` | pr | Every audience rule, tenant crossing, IDOR, admin routes |
| 33 | Injection Testing | planned phase 1 | Vitest | `pnpm test:security` | pr | SQL, XSS in BlockNote documents, SSRF in exports |
| 34 | Web Security Testing | planned phase 1 | Playwright | `pnpm test:security` | pr | Recommended CSP and headers in apps/demo |
| 35 | Secret Scanning | active | gitleaks (CI full history + pre-commit hook), GitHub push protection | `make check` | commit | Workflow `Secret scan`, required check |
| 36 | Penetration Testing | planned before 1.0.0 | external tester |  | pre-prod |  |

## Advanced Bug Detection

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 37 | Fuzz Testing | planned phase 1 | fast-check, time-boxed fuzz of route inputs | `pnpm test:fuzz` | pr | Heartbeats, quiz answers, BlockNote documents |
| 38 | Differential Testing | planned phase 3 | Vitest | `pnpm test:unit` | pr | Editor document → SurveyJS conversion vs reference fixtures |

## Database Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 39 | Database Tests | planned phase 1 | Testcontainers | `pnpm test:db` | pr | Constraints, optional RLS policies |
| 40 | Migration Testing | planned phase 1 | Testcontainers | `pnpm test:db` | pr | Up on clean DB and on previous version with data |

## Concurrency Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 41 | Race Condition Testing | planned phase 2 | Vitest + Testcontainers | `pnpm test:concurrency` | pr | Parallel heartbeats, double quiz submission |
| 42 | Deadlock Testing | planned phase 2 | Testcontainers | `pnpm test:concurrency` | pr | Progress recomputation transactions |
| 43 | Idempotency Testing | planned phase 2 | Vitest | `pnpm test:concurrency` | pr | Heartbeat seq replay, outbox handlers |

## Compatibility Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 44 | Browser Testing | planned phase 1 | Playwright (chromium, firefox, webkit) |  | pre-prod |  |
| 45 | Device Testing | planned phase 4 | Playwright device emulation |  | pre-prod | iOS Safari ≥ 16 |
| 46 | Operating System Testing | planned phase 1 | CI matrix Linux + macOS |  | pr | Node ≥ 20 |
| 47 | Responsive Testing | planned phase 1 | Playwright viewports | `pnpm test:e2e` | pr | Columns stack below 640 px |

## Internationalization

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 48 | Localization Testing | planned phase 1 | Vitest, pseudo-locale | `pnpm test:i18n` | pr | en, fr |
| 49 | Date / Time Testing | planned phase 1 | Vitest with fixed time zones | `pnpm test:i18n` | pr | Due dates, cooldowns, DST |
| 50 | Currency / Number Testing | N/A: the module handles no money; numbers are scores and durations, covered by 2 |  |  |  |  |

## Deployment Testing

| # | Category | Status | Tool | Command | Gate | Notes |
|---|---|---|---|---|---|---|
| 51 | Installation Testing | planned phase 1 | Consumer fixture apps from `pnpm pack` | `pnpm test:consumers` | pr | Per supported Next.js and React major |
| 52 | Upgrade Testing | planned phase 1 | Testcontainers | `pnpm test:upgrade` | pr | Previous minor's schema and data |
| 53 | Rollback Testing | planned phase 2 | Testcontainers | `pnpm test:upgrade` | pr | Previous package version against the new additive schema |
| 54 | Configuration Testing | planned phase 1 | Vitest | `pnpm test:config` | pr | createElearning() rejects invalid options |

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
