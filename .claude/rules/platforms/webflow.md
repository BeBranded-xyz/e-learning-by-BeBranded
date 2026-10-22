---
description: Webflow platform rules — what lives in Webflow vs code, CMS schema, Data API wrapper, webhooks, custom code, Webflow Cloud, naming, SEO, forms, publishing discipline, backups, testing. Apply to Webflow integration code and custom code.
paths:
  - "**/webflow/**"
  - "**/*.webflow.*"
---

# Webflow

## When this applies

Apply to every file matching the globs when `PROJECT.md` declares Webflow as
the marketing site, CMS, or host for a light app. Third-party wrapper, webhook
and rate-limit rules come from `modules/integrations.mdc`; the app code that
talks to Webflow follows `languages/typescript.mdc` and its platform rule
(`platforms/nextjs.mdc`, `platforms/cloudflare-workers.mdc`). Site id,
collection ids, staging domain, plan tier and the custom code budget live in
`PROJECT.md`. Webflow limits and API shapes change; verify against the current
docs before relying on a number below.

## Non-negotiables

- **Publish is a deploy.** Publishing pushes design, CMS and custom code changes
  to the selected domains at once; treat it with the same discipline as a
  production release (checklist, review, no Friday-evening publishes).
- **Business logic, auth and secrets never live in Webflow.** Webflow holds
  design, static pages, CMS content and forms; everything else runs in code
  behind an API the site calls.
- **Data API rate limit is per token per minute** (60 on Starter/Basic, 120 on
  CMS/Business plans); a `429` carries `Retry-After`. The wrapper throttles and
  backs off; nothing else calls the API.
- **Custom code slots are capped** (10,000 characters per head and footer slot,
  site-wide and per page). Inline snippets stay tiny and load versioned files
  from your own host.
- **Webhooks are only signed when created through the API** (site token or
  OAuth app secret). Dashboard-created webhooks are unsigned; do not use them
  for anything that triggers writes.
- **The staging domain (`*.webflow.io`) is a real public URL**: `noindex`, test
  endpoints only. Site API tokens are per site, least privilege, one per integration.

## Project layout and config files

```
webflow/
  README.md                  what lives in Webflow vs code; publish checklist
  cms-schema.md              collections, fields, references, slugs (mirrors PROJECT.md)
  custom-code/
    site-head.html           versioned copy of the site-wide head slot
    site-footer.html         versioned copy of the site-wide footer slot
    pages/<slug>.head.html   page-level slots, one file each
  scripts/
    src/                     TypeScript source for site scripts
    dist/                    built, hashed bundles served from your host or CDN
  redirects.csv              301 map (source, destination), the only source of truth
  deploy/                    scripts that push custom code and redirects via the Data API
src/lib/webflow/
  client.ts                  the single typed wrapper (throttle, retry, pagination)
  schemas/                   zod schemas for items, form submissions, webhook payloads
  webhooks.ts                signature verification
```

| Concern | Tool |
|---|---|
| API client | `webflow-api` SDK (built-in backoff) wrapped in `client.ts`, or plain `fetch` behind the same wrapper |
| Scripts build | Vite or esbuild to `scripts/dist/` with content hashes |
| Lint / format | Biome or ESLint + Prettier for `scripts/src`; `html-validate` for custom code slots |
| Link and redirect checks | `lychee` or `linkinator` against staging |
| Check command | `pnpm check` = typecheck + lint + wrapper unit tests + custom code size check |

## Patterns

### Boundary between Webflow and code
| Stays in Webflow | Lives in code |
|---|---|
| Layout, styles, components, interactions | Auth, sessions, user data |
| Static pages, CMS collections and items | Payments, bookings, anything transactional |
| Native forms (lead capture) | Form processing, CRM sync, email sending |
| SEO fields, 301 redirects (from `redirects.csv`) | Search, personalization, API-backed widgets |

Connection points: a script loaded from custom code calls your API (CORS
allowlist on the API, no credentials in the script); webhooks notify your
backend; the backend writes CMS items through the wrapper. Light apps that must
share the site's domain deploy on **Webflow Cloud** mounted at a path (see
`PROJECT.md`); anything with its own database or long-running work does not.

### CMS schema
- **`cms-schema.md` is the contract**: every collection with its display name,
  slug, fields (type, required, unique), references, and which system owns each
  field. Update it in the same PR as a schema change; `PROJECT.md` links to it.
- **Reference by id, not by name**; keep collection and field ids in a
  constants file (`webflow.constants.ts`) refreshed by a script.

### Data API wrapper
```ts
export async function listItems<T>(collectionId: string, schema: z.ZodType<T>, signal?: AbortSignal) {
  const items: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await request(`/collections/${collectionId}/items`, { limit: PAGE_SIZE, offset }, signal);
    items.push(...page.items.map((raw) => schema.parse(raw)));
    if (items.length >= page.pagination.total) return items;
  }
}
```
- One module; every call parses the response with a schema and returns typed
  values. `request()` respects `X-RateLimit-Remaining`, sleeps on `Retry-After`,
  retries 429/5xx with exponential backoff, and forwards an `AbortSignal`.
- **Paginate with `limit` and `offset` until `pagination.total`**; never assume
  a single page.
- **Writes are staged then published**: create or update items, then publish
  the items explicitly; never auto-publish the whole site from a sync job.

### Webhooks
- Create webhooks through the API from a deploy script, one per trigger type
  you consume (`form_submission`, `collection_item_created`,
  `collection_item_changed`, `collection_item_deleted`, `site_publish`, ...).
- Verify `x-webflow-signature` as HMAC-SHA256 of `${x-webflow-timestamp}:${rawBody}`
  with the token secret, compare in constant time, reject timestamps older than
  five minutes. Failure is a high-severity event.
- Treat the payload as a notification: validate with a schema, then refetch the
  item through the wrapper before acting; process idempotently by item id and
  `lastUpdated`.

### Custom code and scripts
- **Every slot is versioned in `webflow/custom-code/`** and pushed by the
  deploy script (or pasted from the file by a reviewer); the Designer is never
  the only copy. A CI check fails when a slot exceeds its character budget.
- Inline code is limited to a loader: one `<script type="module" defer src=...>`
  pointing at a hashed bundle, plus consent and analytics snippets (or a hosted
  script registered through the Custom Code API with `integrityHash` + `version`).
- **No secrets, no API keys, no user ids in custom code**; the script talks to
  your API, which holds the credentials.
- No jQuery dependency unless a Webflow feature in use requires it; write plain
  TypeScript, wait for `DOMContentLoaded`, and target elements by
  `data-*` attributes, never by class names (classes are design, not hooks).

### Design conventions
- **Class naming follows one documented convention** (Client-First by default;
  `PROJECT.md` names the one in use). Components for anything repeated, style
  variables for colors, spacing and type.
- **Interactions**: prefer CSS transitions; limit scroll-triggered animations
  to a few elements per page; respect `prefers-reduced-motion`; never animate
  layout properties on large sections.
- **Accessibility**: semantic elements, one `h1` per page, alt text on every
  CMS image field (required field), focus-visible styles, form labels bound to
  inputs, contrast checked in the Designer.
- **Core Web Vitals**: Webflow-hosted images with responsive variants and lazy
  loading; the LCP image eager; fonts uploaded and subset; third-party scripts
  deferred and behind consent; embeds sized to avoid CLS.

### SEO, forms, localization
- Meta title and description per page and per CMS template with CMS bindings;
  OG image field on every collection; canonical set; sitemap auto-generated and
  submitted; `robots.txt` blocks the staging domain.
- **301 redirects live in `redirects.csv`** and are pushed through the
  redirects API by the deploy script; a redirect check runs after every publish.
- **Forms**: reCAPTCHA or Turnstile enabled, a consent checkbox required when
  collecting personal data, submissions forwarded by webhook to your backend
  (which stores them and syncs the CRM); the staging site posts to a test
  endpoint. Never rely on Webflow form notifications alone.
- **Localization**: use Webflow Localization when the plan includes it; every
  CMS write specifies `cmsLocaleId`; hreflang verified after publish.

## Local development and testing

Design work happens in the Designer on a staging-only state; script work runs
locally with `vite dev` injected into the staging site through a local loader
snippet. Webflow has no local runtime, so **the staging domain is the test
environment**: it points at test API endpoints and a test CRM (see
`modules/integrations.mdc`).

| Category | Tool | What it covers |
|---|---|---|
| Unit | Vitest + msw | wrapper (throttle, backoff, pagination, schema parsing), webhook signature, slug rules |
| Contract | recorded API and webhook fixtures | item and submission payload shapes after each Webflow API change |
| Custom code | size check script, `html-validate` | slot budgets, valid markup, no inline secrets |
| E2E | Playwright against the staging domain | navigation, CMS pages render, forms submit to the test endpoint, consent flow |
| Visual regression | Playwright `toHaveScreenshot` (or Percy/Chromatic) on key templates | after every publish, desktop and mobile |
| Accessibility | `@axe-core/playwright` on each template | WCAG issues on real pages |
| Performance | Lighthouse CI against staging, then production after publish | LCP, CLS, INP budgets from `PROJECT.md` |
| Links and redirects | `lychee` / `linkinator` plus a redirect map test | no broken links, every `redirects.csv` row resolves |


## Deployment and environments

- **Environments**: staging domain (`*.webflow.io`) and the production custom
  domains; publish to staging first, run the checks, then publish to production
  domains. Webflow Cloud apps get an environment per branch with their own env
  vars.
- **Publish checklist** (in `webflow/README.md`): CMS changes reviewed (no
  drafts accidentally published), custom code files match the slots, redirects
  pushed, forms tested on staging, Lighthouse and visual regression green,
  someone available to roll back.
- **Never publish unreviewed CMS changes to production**: content editors work
  in drafts; a reviewer publishes items or the site.
- **Backups and rollback**: Webflow site versions restore design and content;
  scripts roll back by re-pointing the loader to the previous bundle; schedule a
  weekly CMS export per collection through the wrapper into your own storage.

## Observability on this platform

- Site scripts report errors to the browser SDK of the error tracker with the
  page path as a tag; no PII, no form values.
- The backend logs every webhook (type, item id, result) to the audit table and
  every wrapper call with status and remaining rate limit; alert on signature
  failures, sustained 429s, and failed CMS writes.

## Checklist when touching Webflow code

- [ ] Logic, auth and secrets are in code, not in Webflow; the site only calls an API
- [ ] `cms-schema.md` and constants updated for any collection or field change
- [ ] All API calls go through the wrapper: throttle, backoff, pagination, schema parsing
- [ ] Webhook created via API; signature and timestamp verified; processing idempotent
- [ ] Custom code versioned in the repo, within budget, loader only, no secrets, no class hooks
- [ ] Naming convention respected; interactions minimal; reduced motion honored
- [ ] Meta, OG, canonical, alt text set; `redirects.csv` updated and pushed
- [ ] Forms protected, consent captured, submissions routed to the backend
- [ ] Tested on staging: Playwright, visual regression, axe, Lighthouse, links
- [ ] Publish checklist followed; no unreviewed CMS items go live
- [ ] Backups scheduled; site id, collection ids and domains recorded in `PROJECT.md`
