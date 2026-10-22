---
description: Testing standard - maximal coverage by default across every test category, test plan, gates per pipeline stage, test quality rules. Project-agnostic. Always applies.
---

# Testing

Applies to every project. The goal is to **break the program against tests
until it stops breaking**, so that as few defects as possible survive to
production or to human testing. Human testing is the last net, never the first.

The full catalogue of test categories, with what each detects, lives in
`docs/reference/testing-catalogue.md` (72 categories). This rule makes that
catalogue **mandatory by default** and says how to apply it.

## Principle: maximal by default

- **Every category in the catalogue is required** for every project unless the
  project's `TEST_PLAN.md` marks it `N/A` with a one-line justification that a
  reviewer accepts. "We did not have time" is not a justification.
- **The burden of proof is on skipping**, not on testing.
- **Write the maximum, not the minimum.** For every unit: every branch, every
  error path, every boundary value, every invalid input, every concurrent
  interleaving that is plausible. The tables below are floors; the target is
  that no reachable line, branch, or state transition is untested. When in
  doubt, add the test.
- **A behavior without a test does not exist.** Untested code is treated as a
  bug in review.
- **Tests are the specification.** When a test and the code disagree, decide
  which is right explicitly; never edit a test to make it pass without
  understanding why it failed.

## The test plan

Every project has a `TEST_PLAN.md` at the root (template in
`templates/TEST_PLAN.md`). It lists all 72 categories with, for each: status
(`active` / `planned <date>` / `N/A <reason>`), tooling, command, where it runs
(commit / PR / pre-prod / deploy / prod), and owner. `PROJECT.md` links to it.

- **Create it in the first PR of the project** with the `/test-plan` skill.
- **Update it in the same PR** as any change to tooling, commands, or status.
- **Review it monthly** (`maintenance.mdc`): every `planned` past its date is a
  blocker; every `N/A` is re-justified.

## What every change must add

| Change touches | Required tests (minimum) |
|---|---|
| Pure logic, utility, hook | Unit (happy, edge, boundary, negative, error) + property-based when inputs form a domain + mutation score check |
| Component / view | Component tests (render, states, interactions, a11y with axe) + visual regression snapshot + Storybook story |
| API route / server action / function | API tests (happy, validation, authn, authz, not found, conflict) + contract test against the schema + fuzz of inputs + error-envelope test |
| DB schema / migration | Migration up + down test on a clean DB and on a seeded DB, RLS policy tests (anon, owner, other user), constraint tests, query plan check on new indexes |
| External integration / webhook | Wrapper unit tests with recorded fixtures, signature validation tests, retry/backoff/timeout tests with fake clock, idempotency (run twice), contract test against the provider schema |
| Background job / cron | Handler unit tests, idempotency, retry, timeout, concurrency (two workers), dead-letter path |
| Auth / session / permissions | Authentication tests (login, logout, expiry, refresh, lockout), authorization tests per role and per resource (IDOR), rate-limit tests |
| User journey | E2E for the journey on the desktop and mobile viewport, accessibility audit of every screen in the journey, visual regression |
| Performance-sensitive path | Benchmark with a threshold that fails CI, load test scenario updated |
| Config / env / deploy | Configuration tests (missing/invalid env fails fast at boot), smoke test, rollback test |
| Localized content, dates, money | Locale/timezone/DST/currency matrix tests, pseudo-localization |
| Bug fix | A failing regression test written **before** the fix, committed with it |

The right-hand column is the floor, never the target. Add every further test
the change makes possible; a reviewer may ask why a plausible test is missing,
never why one was added.

## Gates by pipeline stage

Each gate runs everything from the previous gates. A red gate blocks. Never
disable a gate to merge or ship.

**On every commit (local hook, fast, under ~2 minutes)**
- Formatting, lint, typecheck, compiler checks
- Unit tests (with property-based tests)
- Secret scanning
- Dead-code and unused-dependency detection

**On every pull request (CI)**
- Component tests, accessibility tests (axe), visual regression
- Integration tests against real local services (DB, cache, queue) in containers
- API tests, contract tests, OpenAPI lint
- Database tests, migration up/down tests, RLS tests
- Idempotency and concurrency tests
- E2E critical paths on desktop and mobile viewports
- Mutation testing on changed files (score threshold in `TEST_PLAN.md`)
- Dependency vulnerability scan, license scan, SAST, container and IaC scan
- Fuzzing of changed boundaries (time-boxed)
- Performance benchmarks with thresholds; Lighthouse CI budgets for web
- Coverage per layer must not decrease

**Before production (release branch or pre-prod environment)**
- Full E2E suite across the browser and device matrix
- Load, stress, spike, and soak tests against a production-like environment
- DAST scan; authentication and authorization test suites; injection suite
- Failure injection: dependency down, slow, returning garbage; timeout and retry
  behavior; failover
- Backup restore drill and rollback test on the release candidate
- Upgrade test from the currently deployed version; configuration tests
- Localization, date/time, currency matrix
- Business-logic and acceptance suites; critical business-flow tests
- Exploratory testing session logged with findings (human, after all of the above)

**During deployment**
- Health checks, smoke tests, synthetic checks on critical journeys
- Canary with automated rollback on error-rate or latency breach

**In production, continuously**
- Error monitoring, uptime, synthetic E2E, RUM, tracing, metrics, security
  monitoring, business KPI monitoring with alerts (`observability.mdc`)

## Placement, naming, structure

- **Unit and component tests are colocated** with the code
  (`format-price.test.ts` next to `format-price.ts`). Integration, contract,
  E2E, load, and security suites live in `tests/<category>/`.
- **Test file names mirror the unit under test.** Test names state behavior:
  `"rejects a slot that is already booked"`, not `"test1"`.
- **Arrange, act, assert**, in that order, visibly separated. One behavior per
  test; several asserts are fine when they describe one outcome.
- **Fixtures and factories in `tests/fixtures/` and `tests/factories/`**, typed,
  producing valid objects by default with explicit overrides. Never share
  mutable fixtures between tests.
- **No logic in tests**: no loops building expectations, no conditionals, no
  helpers that hide the assertion. Parameterized/table-driven tests are the
  exception and must read as a table.

## What to mock, what never to mock

- **Mock at the boundary you own**: the typed wrapper around a third party, the
  clock, randomness, the network. Use recorded fixtures for provider responses
  and refresh them on a schedule.
- **Never mock the database, the query builder, or the framework** in
  integration tests. Run the real thing locally in a container.
- **Never mock the unit under test's own collaborators** in the same module to
  make a unit test pass; that tests the mock.
- **Inject time and ids.** Any code that reads the clock or generates ids takes
  them as dependencies so tests are deterministic.
- **No network in unit tests.** A unit test that hits the network fails the
  build.

## Test quality rules

- **Deterministic**: no `sleep`, no timing-dependent asserts, no ordering
  assumptions on sets, no dependence on test order or shared state.
- **Isolated**: each integration test runs in its own transaction or its own
  schema/database and cleans up. Parallel-safe by construction.
- **Fast where it counts**: unit suite under a minute; long suites are tagged
  and run at the right gate, never skipped.
- **Snapshot tests only for serialized output with a stable schema** (rendered
  email, generated document, API envelope). Never snapshot a whole component
  tree as a substitute for assertions; update snapshots only after reading the
  diff.
- **No skipped tests without an issue**: `skip`/`only`/`xit`/`@Ignore` are
  blocked in CI unless annotated `// SKIP(#issue): reason`.
- **Flaky tests are bugs.** A test that fails intermittently is quarantined the
  same day with an issue, root-caused within the week, and never retried into
  green as a permanent fix.
- **Assert the negative too.** Every "it does X" has a sibling "it does not do
  X when Y" where a wrong condition is plausible.

## Coverage and mutation

- **Coverage targets are per layer**, set in `TEST_PLAN.md`, and can only go
  up. Target is 100% line and branch coverage on business logic and data
  access; floors: business logic and data access 95%, handlers and components
  85%, UI glue 70%. Global averages hide holes and are not used. Every
  uncovered line in business logic needs a comment saying why it cannot be
  reached in a test.
- **Mutation testing is the real measure.** Run it on changed files in every
  PR and on the whole codebase weekly. A mutation score below the threshold on
  changed files blocks the PR.
- **Coverage is never a target to game**: no tests without asserts, no tests
  that only call code.

## Security testing is part of testing

Every project runs, at the gates above: secret scanning, SAST, dependency and
container scanning, DAST against a deployed pre-prod, an authentication suite,
an authorization suite (every role against every resource, including IDOR and
privilege escalation), an injection suite (SQL, NoSQL, command, XSS, SSRF,
path traversal, template), web security headers checks, and fuzzing of every
external boundary. Penetration testing by a human happens before a major
launch and yearly. Details in `security.mdc`.

## Human testing comes last

Exploratory testing, usability testing, and UAT happen **only after every
automated gate is green**. Their purpose is to find what automation cannot:
confusing flows, wrong assumptions, missing features. Every defect they find
produces a regression test before it is fixed, so it is caught by automation
next time.

## Tooling by ecosystem

The language and platform rules name the tools. The check command runs the
commit-gate suites; CI workflows in `templates/github/workflows/` run the rest.
`TEST_PLAN.md` records the actual commands.

## Checklist when touching tests or testable code
- [ ] `TEST_PLAN.md` exists, is current, and every category is `active` or justified
- [ ] Every changed behavior has tests per the "what every change must add" table, plus every further test the change allows
- [ ] Missing tests that could not be written now are in `BACKLOG.md` (Missing tests section)
- [ ] Bug fixes carry a regression test written before the fix
- [ ] Error paths, edge cases, and negatives tested, not only happy paths
- [ ] Integration tests use real local services; unit tests use no network
- [ ] Time, ids, and randomness injected; no sleeps or order dependence
- [ ] No skipped or focused tests without a linked issue
- [ ] Coverage per layer did not drop; mutation score on changed files meets threshold
- [ ] Security suites and fuzzing included for any changed boundary
- [ ] Commit gate and PR gate run in this session and green
