---
description: Next.js platform rules — App Router, Server Components, Server Actions, caching, proxy, env vars, Vercel and self-hosted deployment, testing. Apply to Next.js app code and config.
paths:
  - "next.config.*"
  - "**/app/**"
  - "**/pages/**"
  - "middleware.ts"
  - "proxy.ts"
---

# Next.js

## When this applies

Apply to every file matching the globs when `PROJECT.md` declares Next.js as the
app framework. Language rules live in `languages/typescript.mdc`; generic layering,
naming and size limits in `core/code-standards.mdc`; database clients in
`modules/database.mdc`; sessions and route protection in `modules/auth.mdc`. This
file adds what is specific to Next.js. The Next.js major version, hosting target
and mount path live in `PROJECT.md`; verify any API against the docs for that
version before using it.

## Non-negotiables

- **App Router only.** `pages/` is legacy; never add a new page there. If the
  project still has `pages/`, migrate route by route and never mix both for the
  same URL.
- **Server Components by default.** `"use client"` goes on leaf components that
  need state, effects, browser APIs or event handlers. Never on a layout, page or
  data-fetching component.
- **No data fetching in `useEffect`.** Fetch on the server (async Server
  Component, route handler) or through the query library declared in `PROJECT.md`.
- **Never trust the proxy for authorization.** Every Server Action and route
  handler re-checks the session; a matcher change silently removes proxy coverage.
- **Secrets never reach the client bundle.** Only `NEXT_PUBLIC_*` variables are
  inlined client-side; everything else is server-only and must stay that way.
- **Test against a production build.** `next dev` differs from `next build &&
  next start` in caching, streaming and error handling.
- **Billing traps on Vercel**: uncached dynamic routes, unscoped `remotePatterns`
  and a proxy without a matcher all bill per invocation. Cache deliberately.

## Project layout and config files

```
app/
  (marketing)/ (app)/        route groups, one per audience; shared layouts inside
  api/<resource>/route.ts    thin route handlers (external callers, webhooks)
  <segment>/
    page.tsx layout.tsx      Server Components; compose, do not compute
    loading.tsx error.tsx    Suspense and error boundaries per segment
    actions.ts               Server Actions for this segment ("use server")
components/                  shared UI (client leaves marked "use client")
lib/
  env.ts                     validated env (see languages/typescript.mdc)
  schemas/ services/ queries/
  cache-tags.ts              every cacheTag / revalidateTag string as a constant
proxy.ts                     root (or src/), Node runtime, thin
next.config.ts               typed with NextConfig; no secrets
```

| Concern | Tool |
|---|---|
| Lint | `eslint-config-next` (or Biome with the React and Next rules) |
| Typecheck | `tsc --noEmit`; `typedRoutes: true` in `next.config.ts` |
| Bundle analysis | `@next/bundle-analyzer`, run on demand and in a weekly CI job |
| Check command | `pnpm check` = typecheck + lint + unit tests; `pnpm test:e2e` for Playwright |

Import `server-only` at the top of every module that reads secrets or uses a
privileged client; import `client-only` in modules that touch `window`.

## Patterns

### Components and data flow
- **Fetch in the Server Component closest to where data is used**; parallel
  fetches with `Promise.all`, request-level dedupe with `React.cache`.
- **Streaming**: wrap slow subtrees in `<Suspense fallback={...}>`; `loading.tsx`
  is the segment-level default. Never block the whole page on one slow fetch.
- **`error.tsx` per segment** (client component) reports to the error tracker
  and offers `reset()`; `global-error.tsx` at the root. `not-found.tsx` for 404.

### Server Actions
```ts
"use server";
import { getSession } from "@/lib/auth/session";
import { orderSchema } from "@/lib/schemas/order";

export async function createOrder(input: unknown): Promise<Result<OrderId>> {
  const session = await getSession();
  if (!session) return err({ code: "unauthorized" });
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return err({ code: "validation", issues: parsed.error.issues });
  return ordersService.create(session.user.id, parsed.data);
}
```
- **Validate `input` as `unknown` with a schema**; never type it as the form shape.
- **Auth and authorization inside the action**, first statement.
- **Return typed `Result` values**; never throw for expected failures, never
  return raw DB rows or error objects with stack traces.
- **One action per mutation, in `actions.ts` next to the segment**; actions call
  services, never queries directly.
- **After a mutation** call `updateTag` / `revalidateTag` / `revalidatePath`
  with a constant from `lib/cache-tags.ts`, then `redirect` if needed.

### Route handlers
- **Thin**: parse, validate, call a service, respond. Same error-to-status table
  as `modules/integrations.mdc`. Reserve them for external callers (webhooks,
  mobile, third parties); internal UI mutations use Server Actions.
- Verify webhook signatures on the raw body (`await request.text()`) before
  parsing. Return `Response.json` with a reason code on error.

### Caching
| Need | Use |
|---|---|
| Cache a fetch across requests | `fetch(url, { next: { revalidate, tags } })` |
| Cache a non-fetch function, survive deploys | `unstable_cache(fn, keys, { revalidate, tags })` |
| Cache a component or function in the static shell | `"use cache"` + `cacheLife()` + `cacheTag()` (requires `cacheComponents: true`) |
| Force dynamic | read `cookies()` / `headers()` / `searchParams`, or `connection()` |
| Invalidate after a mutation | `updateTag(tag)` in the action; `revalidateTag` / `revalidatePath` elsewhere |

- **Every `"use cache"` scope sets an explicit `cacheLife`**; the default profile
  is not a decision. Never read `cookies()` or `headers()` inside a cached scope;
  read outside and pass values as arguments.
- **Tag everything you may need to invalidate**; tags are constants, never
  string literals in components.
- **Never cache responses that depend on the session** without the session id in
  the key. Never cache the admin client's output.

### Routing, SEO, assets
- **Metadata API**: `export const metadata` for static, `generateMetadata` for
  dynamic; `app/sitemap.ts`, `app/robots.ts`, `opengraph-image.tsx`. Canonical
  and `alternates.languages` set once in the root layout via `metadataBase`.
- **`next/image` for every raster image** with explicit `width`/`height` or
  `fill`, `sizes` on responsive images, `priority` on the LCP image only.
  `remotePatterns` in `next.config.ts` is an allowlist, never `**`.
- **`next/font`** for every font (`next/font/google` or `/local`); no `<link>`
  to font CDNs; `display: "swap"`.
- **i18n**: locale as the first path segment (`app/[locale]/`), negotiated in
  `proxy.ts` from `Accept-Language` and a cookie, translations loaded server-side
  (`next-intl` or the library in `PROJECT.md`). Never hardcode strings in UI.

### Proxy (formerly middleware)
- **File is `proxy.ts` exporting `proxy`** on Next.js 16+; `middleware.ts` is
  deprecated (migrate with `npx @next/codemod@canary middleware-to-proxy .`).
  It runs on the Node runtime; no `runtime` export.
- **Keep it thin**: redirects, locale negotiation, session cookie refresh, header
  injection. No DB queries, no heavy imports, no business logic.
- **Always export a `matcher`** that excludes `_next/static`, `_next/image`,
  `favicon.ico`, `sitemap.xml`, `robots.txt` and public assets.

### Runtime and env
- **Node runtime by default.** `export const runtime = "edge"` only for a route
  that has no Node dependency and a documented latency reason; edge has no `fs`,
  limited CPU and no Node built-ins.
- **`lib/env.ts` validates `process.env` once** (server schema + client schema
  with only `NEXT_PUBLIC_*` keys). Client code imports the client schema only.
- **Monorepo**: `transpilePackages` for internal packages, `outputFileTracingRoot`
  at the workspace root, one `next.config.ts` per app.

## Local development and testing

`pnpm dev` for iteration; **all tests that touch rendering or caching run against
`pnpm build && pnpm start`**. Point the app at the local database and mocked
third parties (see `modules/integrations.mdc`); never at production.

| Category | Tool | What it covers |
|---|---|---|
| Unit | Vitest | services, schemas, cache-key helpers, metadata generators |
| Component | Testing Library + `user-event` | client components by role and label |
| Server Actions | Vitest, call the action with `unknown` input | unauthorized, invalid, happy path, tag invalidation called |
| Route handlers | Vitest, invoke `GET`/`POST` with a `Request` | status codes, schema of body, signature rejection |
| Proxy | `next/experimental/testing/server` (`unstable_doesProxyMatch`) | matcher coverage, redirects, rewrites |
| E2E | Playwright against `next start` | critical journeys, desktop and mobile, auth flows |
| Accessibility | `@axe-core/playwright` in E2E | every page template |
| Performance | Lighthouse CI (`@lhci/cli`) on preview URL | LCP, CLS, INP budgets stated in `PROJECT.md` |
| Bundle size | `@next/bundle-analyzer` + size-limit or `next build` output diff in CI | first-load JS per route, fail on regression |

- `pnpm check` runs typecheck, lint and unit tests; `pnpm test:e2e` runs in CI on
  every PR against the preview deployment or a local production build.

## Deployment and environments

- **Vercel (default)**: every branch gets a preview deployment; production deploys
  from the branch named in `PROJECT.md`. Env vars are set per environment
  (Development, Preview, Production) in Vercel and mirrored in `.env.example`;
  preview uses non-production databases and API keys, never production ones.
- **ISR and on-demand revalidation** are the cache backend on Vercel; a route
  with `revalidate` set is the cheap path. Verify with `x-vercel-cache` headers.
- **Self-hosted**: `output: "standalone"` in `next.config.ts`, Docker image built
  from `.next/standalone` plus `public/` and `.next/static`; set
  `cacheHandler` and `cacheMaxMemorySize: 0` when running more than one instance
  so ISR shares a store (Redis or equivalent); configure `images.loader` or a
  reverse proxy for image optimization.

## Observability on this platform

- Error tracker SDK initialized in `instrumentation.ts` (server and edge) and
  `instrumentation-client.ts` (browser); `onRequestError` exported from
  `instrumentation.ts` reports uncaught server errors with route context.
- `error.tsx` and `global-error.tsx` capture and report before rendering the
  fallback. Server Actions report failures with the action name as a tag.
- Track Web Vitals with `useReportWebVitals` or the platform analytics named in
  `PROJECT.md`; alert on LCP and INP regressions after deploys.

## Checklist when touching Next.js code

- [ ] Server Component by default; `"use client"` only on a leaf that needs it
- [ ] No fetch in `useEffect`; data fetched on the server or via the query library
- [ ] Server Action validates `unknown` input with a schema and checks auth first
- [ ] Action returns a typed `Result`; cache tags invalidated from constants
- [ ] Route handler is thin, maps errors to status codes, verifies signatures
- [ ] Every `"use cache"` scope has `cacheLife` and `cacheTag`; no request APIs inside
- [ ] `proxy.ts` has a matcher, stays thin, and is not the only auth check
- [ ] No secret outside `lib/env.ts`; `server-only` on privileged modules
- [ ] `next/image`, `next/font`, Metadata API used; no raw `<img>`, `<link>` fonts
- [ ] `loading.tsx` / `error.tsx` present for new segments; Suspense around slow trees
- [ ] Tests added per the table; E2E and Lighthouse run against a production build
- [ ] `.env.example` and Vercel env per environment updated
