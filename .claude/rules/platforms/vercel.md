---
description: Vercel platform rules — project linking, vercel.json, environments and env vars, preview and production deployments, Functions (Node vs Edge, Fluid compute), crons, Routing Middleware, CDN caching, storage, domains, monorepos, cost and security guardrails, testing against previews. Apply to Vercel config and function code.
paths:
  - "vercel.json"
  - ".vercel/**"
  - "**/api/**"
  - "middleware.ts"
  - "proxy.ts"
  - "**/*.vercel.*"
---

# Vercel

## When this applies

Apply to every file matching the globs when `PROJECT.md` declares Vercel as the
deployment platform, whatever the framework. Next.js specifics live in
`platforms/nextjs.mdc`; Cloudflare Workers in `platforms/cloudflare-workers.mdc`;
pipeline stages, promotion path, DNS/TLS and budgets in `modules/infra.mdc`;
function structure, error mapping and webhooks in `modules/integrations.mdc`; job
idempotency and locks in `modules/background-jobs.mdc`. Team, plan tier, regions,
production branch and budgets live in `PROJECT.md`. Limits change; verify against
`vercel.com/docs/limits` before relying on a number below.

## Non-negotiables

- **Fluid compute is the runtime model** (default since April 2025): one
  instance serves concurrent invocations, so module-level state is shared across
  requests. Never store request data in a global; create clients once at module
  scope and register pools with `attachDatabasePool`.
- **Duration and memory are decisions, not defaults.** Fluid defaults to 300 s
  (Pro/Enterprise max 800 s). Set `maxDuration` per route to the smallest value
  that works; a runaway function bills active CPU and provisioned memory.
- **4.5 MB request and response body limit; 250 MB uncompressed bundle.**
  Uploads go straight to Blob or object storage with a client token; large
  responses stream; no fixtures, docs or unused SDKs in the bundle.
- **Read-only filesystem; only `/tmp` is writable**, ephemeral and shared by
  concurrent invocations. Never rely on it between requests.
- **Secrets never ship to the client.** Only public-prefixed variables
  (`NEXT_PUBLIC_*`, `VITE_*`) reach the browser; everything else lives in Vercel
  env vars, never in `vercel.json` or source.
- **Production deploys only from the production branch** (`main` unless
  `PROJECT.md` says otherwise); no `vercel --prod` from a laptop.
- **Billing traps**: invocations and active CPU, image transformations and
  cache writes, data transfer, build minutes, runtime cache reads. Cache at the
  CDN, set Spend Management, and state the cost impact in the PR.

## Project layout and config files

```
vercel.json          source of truth: rewrites, redirects, headers, crons, functions, regions
.vercel/             created by `vercel link`; gitignored (project and org ids)
.env.example         every variable name, no values; mirrors Vercel env per environment
api/                 framework-agnostic Functions, one file per route, Node by default
middleware.ts        Routing Middleware (Next.js uses proxy.ts, see platforms/nextjs.mdc)
```

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "functions": { "api/**/*.ts": { "maxDuration": 30 } },
  "crons": [{ "path": "/api/cron/reconcile", "schedule": "*/15 * * * *" }],
  "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Content-Type-Options", "value": "nosniff" }] }],
  "redirects": [{ "source": "/old", "destination": "/new", "permanent": true }],
  "ignoreCommand": "npx turbo-ignore --fallback=HEAD^1"
}
```

- **`vercel.json` is the single config source**: nothing it can express is set
  only in the dashboard; a dashboard change is mirrored in the file the same day
  (`modules/infra.mdc`, "No click-ops"). Keep `$schema` so editors validate it.
- **`regions` sits next to the database** (ids in `PROJECT.md`); one region unless data is replicated.
- **Env vars per environment** (Development, Preview, Production) via
  `vercel env add NAME <environment>` or the dashboard, pulled with
  `vercel env pull .env.local`, every name listed in `.env.example`. Preview never
  holds production credentials; mark secrets as sensitive.

| Concern | Tool |
|---|---|
| CLI | `vercel` (link, env, build, dev, deploy, promote, rollback, logs) |
| Config validation | `$schema` in `vercel.json`; `vercel build` in CI |
| Lint / typecheck / unit | the language rule's tooling; `pnpm check` runs all three |
| E2E and performance | Playwright and Lighthouse CI against the preview URL |

## Patterns

### Functions
- **Node runtime by default.** Edge only for a route with no Node dependency
  and a documented latency reason; Edge must start responding within 25 s and
  has no `fs`, no native modules and a small bundle budget.
- **Pooled, serverless-friendly database clients**: HTTP or pooled drivers
  (Neon serverless, Supabase, Upstash), one module-scope pool passed to
  `attachDatabasePool` from `@vercel/functions`, sized for Fluid concurrency.
- **Stream long responses**; lean imports and lazy-loaded SDKs keep cold starts short.
- **Post-response work goes to `waitUntil`** (`@vercel/functions`; Next.js 15.1+
  uses `after()`): analytics, cache writes, webhooks. It shares the function
  deadline; anything longer goes to a queue or a cron.

### Cron jobs
```ts
import { timingSafeEqual } from "node:crypto";

export async function GET(request: Request): Promise<Response> {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const received = request.headers.get("authorization") ?? "";
  const ok = received.length === expected.length &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!process.env.CRON_SECRET || !ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await reconcileService.run({ trigger: "cron" }));
}
```
- **Declared in `vercel.json` `crons`**, path starts with `/`, one handler per
  job under `api/cron/`. Crons run on the production deployment only; Hobby is
  limited to daily schedules with hour-level precision.
- **`CRON_SECRET` set in Production** (32+ random bytes); Vercel sends it as
  `Authorization: Bearer`. A missing secret fails closed.
- **Idempotent and non-overlapping**: take a lock (DB row or Redis `SET NX`)
  keyed by job name, skip when held, finish well under `maxDuration`; a job that
  cannot finish enqueues the rest (`modules/background-jobs.mdc`).

### Routing Middleware
- **Thin**: redirects, rewrites, geo and locale routing, header injection,
  cookie-based bucketing. No database calls, no upstream `fetch` on the request
  path, no business logic; authorization is re-checked in the route it protects.
- **Always export a `matcher`** excluding static assets; without one it runs, and bills, on every request.
- Edge by default; `config = { runtime: "nodejs" }` only for an unavoidable Node dependency.

### Caching and CDN
| Need | Header or API |
|---|---|
| CDN cache, browser never | `Cache-Control: s-maxage=60, stale-while-revalidate=600` |
| Vercel CDN only, other CDNs differ | `Vercel-CDN-Cache-Control` (wins over `CDN-Cache-Control`) |
| Tag a response for purging | `Vercel-Cache-Tag: product-42,products` or `addCacheTag()` |
| Invalidate after a mutation | `invalidateByTag(tag)`; never `dangerouslyDeleteByTag` on hot tags |

- **Every dynamic route decides its cache policy explicitly**; `x-vercel-cache`
  (`HIT`, `MISS`, `STALE`, `BYPASS`) is asserted in tests for cached routes.
- **Never cache a response that varies by session**; never set a public cache
  header on a route that reads cookies.
- **Image optimization**: allowlist remote hosts, fixed `sizes`, never optimize
  user uploads at unbounded dimensions; transformations and cache writes are metered.

### Storage, domains, monorepos
- **Vercel Blob** for user files (client uploads via `handleUpload` tokens,
  private stores); **Postgres** through Neon or Supabase with a pooled URL;
  **Upstash Redis** for locks, counters and rate limits. Ids in `PROJECT.md`.
- **Domains**: Cloudflare DNS with the proxy off (DNS-only) unless `PROJECT.md`
  says otherwise; if proxied, SSL mode Full (strict), never Flexible (redirect
  loop with Vercel's HTTPS redirect). Every redirect in `vercel.json` has a test.
- **Monorepos**: one Vercel project per app with its Root Directory set,
  Turborepo remote cache linked, and an Ignored Build Step (`turbo-ignore` or
  `git diff --quiet HEAD^ HEAD ./`; exit 0 skips) so unaffected apps do not build.

## Local development and testing

`vercel dev` when the project relies on `vercel.json` routing, crons or
framework-agnostic `api/` functions; the framework dev server otherwise.
`vercel build` reproduces the production build locally and in CI. Run
`vercel env pull .env.local` after any env change; local runs point at the local
database and mocked providers, never production.

| Category | Tool | What it covers |
|---|---|---|
| Unit | the language rule's runner | handlers with a `Request`, cron auth (missing, wrong, valid), cache-tag helpers |
| Config | `vercel build` + JSON schema | `vercel.json` valid, globs match the functions, crons parse |
| Middleware | call the exported function with a `Request` | matcher coverage, redirects, no network call on the path |
| E2E | Playwright against the preview URL | critical journeys with the `x-vercel-protection-bypass` header |
| Cache and headers | HTTP assertions on the preview | `x-vercel-cache`, `Cache-Control`, security headers, every redirect |
| Performance | Lighthouse CI on the preview | LCP, CLS, INP budgets from `PROJECT.md` |
| Smoke | HTTP checks after promotion | `/healthz`, `/readyz`, one critical path on the production domain |

- **Bypass secret in CI only**: `VERCEL_AUTOMATION_BYPASS_SECRET` from Deployment
  Protection settings, sent as `x-vercel-protection-bypass` (plus
  `x-vercel-set-bypass-cookie: true` for browser flows). Never in the repo or a
  preview env var; rotated on leak.
- **Rollback drill** once per release cycle: `vercel rollback <deployment>` on a
  staging project, then `vercel rollback status`; time it and record the result.

## Deployment and environments

- **Preview per PR** with Deployment Protection on (Vercel Authentication or
  password); reviewers use preview comments; previews use preview env vars and
  non-production data.
- **Production from the production branch only**, after CI is green.
  `vercel promote <deployment>` moves a tested build to production without
  rebuilding; `vercel rollback <deployment>` restores the previous one instantly.
  Both are pipeline actions recorded with the deployment URL.
- **Skew protection on**; **rolling releases** for risky changes (`modules/releases.mdc`).
- **Spend Management set** with alerts and pause-on-limit (amount in
  `PROJECT.md`); Firewall on with managed rulesets, rate-limit rules on auth and
  form endpoints (or `checkRateLimit` from `@vercel/firewall`), bot protection
  on, Attack Challenge Mode as the incident switch.

## Observability on this platform

- **Web Analytics and Speed Insights enabled**; alert on LCP and INP regressions.
- **Structured JSON logs** with `request_id`, route, status, duration and ids
  only (no PII). Runtime log retention is short (hours on Hobby, days on Pro), so
  a **Log Drain** ships logs to the tool named in `PROJECT.md`.
- **Error tracker** with source maps uploaded at build and
  `VERCEL_GIT_COMMIT_SHA` as the release; `vercel logs --environment production
  --level error` and `vercel inspect <url> --logs` for triage.
- **Alerts** on 5xx rate, `FUNCTION_INVOCATION_TIMEOUT`, cron failures, spend thresholds.

## Checklist when touching Vercel code

- [ ] `vercel.json` updated (rewrites, redirects, headers, crons, functions, regions) and valid
- [ ] `.vercel/` and `.env*.local` gitignored; every env var in `.env.example` and set per environment
- [ ] No secret in `vercel.json`, source or a public-prefixed variable
- [ ] Function: Node unless justified, `maxDuration` set, pooled client, no request state in globals
- [ ] Bodies under 4.5 MB or uploaded directly to storage; long responses streamed
- [ ] Post-response work in `waitUntil` / `after`; long work in a queue or cron
- [ ] Cron: `CRON_SECRET` checked, idempotent, lock prevents overlap, finishes under `maxDuration`
- [ ] Middleware thin with a matcher; no DB or upstream calls; auth re-checked in the route
- [ ] Cache policy explicit per route; tags constant; `x-vercel-cache` asserted in tests
- [ ] Preview protected; E2E and Lighthouse run against the preview with the bypass header
- [ ] Production from the production branch; promote/rollback verified; smoke tests pass
- [ ] Spend Management, Firewall, Analytics, Speed Insights and Log Drain configured; cost stated in the PR
