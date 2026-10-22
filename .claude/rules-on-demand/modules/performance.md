---
description: Performance — budgets, measurement, caching layers, N+1 and payload rules, async offloading, memory, cold starts, and performance testing in CI. Apply when PROJECT.md declares performance budgets or the project serves users at scale.
---

# Performance

## When this applies

Apply when `PROJECT.md` lists this module as active or declares performance
budgets. The budgets themselves, the runtime (Node, Python, Go, edge, ...), the
cache infrastructure, and the load-test environment are project facts and live
in `PROJECT.md`. Frontend rendering rules are in `modules/frontend.mdc`; index
and query rules in `modules/database.mdc`; this module covers budgets,
measurement, backend and caching behavior, and regression prevention.

Client-to-database read and write patterns (round trips, prefetch, optimistic UI) are in `data-fetching.mdc`.

## Principles

- **Budgets first.** A performance target that is not written down and checked
  in CI does not exist.
- **Measure before optimizing.** No optimization PR without a profile or
  benchmark showing the problem and a measurement showing the fix.
- **Optimize the slowest tier first**: network round trips, then database, then
  serialization, then CPU. Micro-optimizing code that waits on I/O is waste.
- **Every cache is a correctness decision.** A cache without a documented
  invalidation rule is a bug that has not surfaced yet.
- **Regressions are caught by machines**, not by users: thresholds fail the build.

## Rules

### Budgets

`PROJECT.md` declares budgets in a table with this shape; every row is checked
by an automated test or monitor named in the same row.

| Budget | Typical default | Measured by |
|---|---|---|
| p95 latency, read endpoints | 300 ms | load test + APM |
| p95 latency, write endpoints | 800 ms | load test + APM |
| p95 latency, search / reports | 2 s | load test + APM |
| DB query time, single query | 50 ms p95 | slow-query log |
| Background job duration | per job class | job metrics |
| Page weight (initial, gzipped) | 500 kB | Lighthouse CI |
| JS bundle (initial, gzipped) | 200 kB | bundler budget |
| Core Web Vitals | LCP 2.5 s, INP 200 ms, CLS 0.1 | Lighthouse CI + RUM |
| Serverless cold start | 500 ms | platform metrics |

- **Budgets are per class of work**, not one global number; a new endpoint or
  job declares its class in the PR.
- **Budgets move only in PRs** that update `PROJECT.md` with the reason.

### Measurement

- **Profile with the runtime's native tool** before changing code: Node
  `--cpu-prof` / `--heap-prof` or clinic, Python `cProfile` / `py-spy`, Go
  `pprof`, browser DevTools Performance panel, database `EXPLAIN (ANALYZE, BUFFERS)`.
- **Trace every request** with spans for DB, cache, and outbound calls
  (`modules/observability.mdc`); a span shows where the time went, a log does not.
- **Record the baseline** (numbers, environment, dataset size) in the PR
  description for any performance change; before and after, same conditions.
- **Benchmark against realistic data volume**; an empty table hides every
  problem. Seed the benchmark dataset from a script committed with the tests.

### Backend

- **Detect and forbid N+1 queries**: enable the ORM's query logger in tests and
  assert the query count for list endpoints (for example at most 3 queries per
  request regardless of page size).
- **Batch reads and writes**: use `IN (...)` lookups, a data-loader pattern, or
  bulk inserts; never loop a query per item.
- **Paginate every collection read** (`modules/api-design.mdc`); never load an
  unbounded result set into memory.
- **Set timeouts on every outbound call and query**; no call without a deadline.
  Fail fast and surface a `504`-class error rather than pile up.
- **Move slow work off the request path**: email, PDF generation, image
  processing, third-party sync, and anything over ~200 ms run as background jobs
  with a `202` response and a status endpoint.
- **Avoid serialization waste**: return only the fields the client asked for or
  the schema defines; never serialize full ORM graphs.

### Caching layers

| Layer | Use for | Default TTL | Invalidation |
|---|---|---|---|
| Browser (`Cache-Control`) | static assets, immutable builds | 1 year with content hash; `no-store` for authenticated HTML | new hash on deploy |
| CDN / edge | public pages, public API `GET` | 60 s with `stale-while-revalidate` | purge by tag or URL on write |
| Application (Redis / in-memory) | computed views, hot lookups, sessions | 5 min | delete key on the owning write; version key on schema change |
| Database (materialized views, query cache) | expensive aggregates | refresh schedule | refresh on write or cron |

- **Cache keys are namespaced and versioned**: `{app}:{v1}:{entity}:{id}` (or the
  tenant-prefixed variant declared in `PROJECT.md`). Never a raw user-supplied
  string as a key.
- **Never cache per-user data at a shared layer** (CDN, shared app cache) unless
  the key includes the user or tenant id and the response sets `Cache-Control:
  private`.
- **Stampede protection**: single-flight locking or request coalescing on cache
  miss for any key with high concurrency; add jitter to TTLs so keys do not
  expire together.
- **Invalidate on the owning write**, in the same code path, never "eventually
  by TTL" for data users edit. Document the rule next to the cache read.
- **Serve stale on backend failure** when correctness allows; log it at `warn`.

### Database

- **Every filter, join, and sort column is indexed**; verify with `EXPLAIN` before
  merging a new query pattern and attach the plan to the PR.
- **Connection pooling is mandatory** (pooler in front of the database for
  serverless); pool size is bounded and declared in `PROJECT.md`.
- **Slow-query logging is on** in every environment with the budget threshold.
- Migrations, index conventions, and RLS cost rules: `modules/database.mdc`.

### Payload sizes

- **Compress responses** (Brotli or gzip) at the edge or server for anything over
  1 kB; never compress already-compressed media.
- **Field selection**: support `?fields=` or a typed projection so clients do not
  download what they do not render; default responses exclude large blobs.
- **Stream large results** (CSV export, logs) instead of buffering; bound every
  request and response body.

### Memory

- **No unbounded in-process collections**: caches, queues, and maps have a
  maximum size and an eviction policy (LRU or TTL).
- **Release resources deterministically**: close streams, clear timers, remove
  listeners; a long-running process is heap-snapshotted in CI to catch growth.
- **Do not hold request-scoped data in module scope** (globals, singletons) on
  shared runtimes; it leaks across requests.

### Serverless and cold starts

- **Minimize the init path**: lazy-import heavy SDKs inside handlers, keep
  bundles small (tree-shaken, no dev dependencies), avoid top-level `await` on
  network calls.
- **Reuse connections across invocations** (client created once at module load,
  pooler for DB); never open a connection per request.
- **Keep warm only where the budget justifies it** (provisioned concurrency or
  scheduled pings) and document the cost in `PROJECT.md`.

### Tooling

- **Load / stress**: k6 (preferred) or autocannon; scripts committed under
  `tests/perf/`. **Frontend**: Lighthouse CI with a budget file. **Benchmarks**:
  the runtime's benchmark harness (Vitest `bench`, `pytest-benchmark`, Go
  `testing.B`, Criterion) with stored baselines. **Profilers** per runtime as
  listed under Measurement. **APM / RUM**: the tracing tool from
  `modules/observability.mdc`.
- **Single check command**: the project's `check` script runs unit and
  benchmark threshold tests; `perf:load` runs the k6 suite against a preview.

## Testing

| Test type | Definition | Required when |
|---|---|---|
| Benchmark | micro/meso benchmark with a stored baseline and a failure threshold (for example +20 %) | any hot-path function, parser, serializer |
| Load | expected peak traffic for 10 minutes; p95 within budget, error rate < 0.1 % | every release of a service with budgets |
| Stress | ramp beyond peak until failure; record the breaking point and recovery | before launch and after capacity changes |
| Spike | 5-10x peak for 1-2 minutes, then back | anything exposed to campaigns, launches, or cron bursts |
| Soak | peak traffic for 4-8 hours; memory and latency must stay flat | long-running services, before major releases |

- **Performance tests run in CI**: benchmarks and Lighthouse CI on every PR; k6
  load tests on merge to the release branch against a preview environment with a
  production-like dataset, never against production.
- **Thresholds fail the build**: k6 `thresholds`, Lighthouse CI `assert` budgets,
  and benchmark comparisons all exit non-zero on breach.
- **N+1 and query-count tests** for every list endpoint.
- **Cache tests**: hit and miss paths, invalidation on write, stampede
  coalescing under concurrent misses, TTL jitter.
- **Timeout tests**: a slow dependency yields a bounded, well-formed error.
- **Production monitoring of every budget**: APM p95 per endpoint class, RUM
  Core Web Vitals, slow-query log, job duration, and cold-start metrics, with
  alerts at the budget threshold routed per `modules/observability.mdc`.

## Checklist when touching performance-sensitive code

- [ ] The affected budget class is identified and the budget is in `PROJECT.md`
- [ ] A profile or benchmark shows the problem; before/after numbers are in the PR
- [ ] No N+1: query count asserted for list paths; reads and writes batched
- [ ] Every outbound call and query has a timeout; slow work is a background job
- [ ] Cache has a namespaced key, TTL, documented invalidation, and stampede guard
- [ ] Per-user data never cached at a shared layer without a user-scoped key
- [ ] New query pattern comes with an `EXPLAIN` plan and the needed index
- [ ] Responses compressed, projected, paginated, and bounded in size
- [ ] No unbounded in-memory collection; resources released deterministically
- [ ] Cold-start path lean: lazy imports, reused connections
- [ ] Benchmark, k6, or Lighthouse CI threshold covers the change and passes
- [ ] Production monitor and alert exist for the budget this change affects
