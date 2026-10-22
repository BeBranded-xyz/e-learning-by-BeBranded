---
description: Supabase platform rules — local stack, CLI migrations, generated types, the three clients, RLS testing, Edge Functions, Storage, Auth, Realtime, cron, branching, pooling, advisors. Apply to Supabase config, migrations and client code.
paths:
  - "supabase/**"
  - "**/supabase*"
---

# Supabase

## When this applies

Apply to every file matching the globs when `PROJECT.md` declares Supabase. This
is the Supabase-specific layer on top of `modules/database.mdc` (migrations,
RLS, query patterns, table standard) and `modules/auth.mdc` (sessions, route
protection); those rules are not repeated here. Serverless function structure
follows `modules/integrations.mdc`. Project ref, region, bucket names and env var
names live in `PROJECT.md`.

## Non-negotiables

- **Schema changes go through CLI migrations only.** Never the dashboard SQL
  editor or Table editor for anything that must exist tomorrow. A change made in
  the dashboard is captured with `supabase db diff` and committed, or reverted.
- **The secret (service role) key never leaves trusted server code.** It bypasses
  RLS. It is never in a client bundle, an Edge Function called by browsers
  without its own auth, or a log line.
- **RLS on every table in exposed schemas**, enabled in the creating migration
  (see `modules/database.mdc`). Advisors must report zero security findings
  before merge.
- **Region is chosen at project creation and cannot change.** Pick it for data
  residency (GDPR: EU region) and record it in `PROJECT.md`.
- **Never point local tooling or tests at production.** `supabase link` is for
  `db push` and type generation in CI; day-to-day work is on `supabase start`.
- **Billing and limit traps**: Edge Function wall-clock and memory, Storage
  egress, Realtime connections, pg_net queue size, compute-tier connection cap.

## Project layout and config files

```
supabase/
  config.toml                 local stack + per-function settings (verify_jwt, etc.)
  migrations/                 YYYYMMDDHHMMSS_name.sql (see modules/database.mdc)
  seed.sql                    dev seed; extra files listed in [db.seed] sql_paths
  functions/
    _shared/                  typed wrappers, cors.ts, supabase-client.ts, errors.ts
    <name>/index.ts           Deno entry (thin) + handler + queries + README.md
    deno.json                 import map and tasks
  tests/database/             pgTAP: 000-setup.sql, 001-<topic>.sql ...
  templates/                  auth email templates referenced from config.toml
src/
  lib/supabase/
    client.ts                 createBrowserClient (publishable key)
    server.ts                 createServerClient with cookies (import "server-only")
    admin.ts                  secret key client (import "server-only", documented uses)
  types/database.types.ts     generated, never edited (header says so)
```

| Concern | Tool |
|---|---|
| CLI | `supabase` (pinned in `package.json` devDependencies) |
| Types | `supabase gen types typescript --local > src/types/database.types.ts` |
| DB tests | `supabase test db` (pgTAP) |
| SQL lint | `supabase db lint` in `pnpm check` |
| Edge Function lint/format/test | `deno lint`, `deno fmt --check`, `deno test` |
| Check command | `pnpm check` = app typecheck + lint + unit tests + `supabase db lint`; `pnpm test:db` and `pnpm test:functions` run in CI |

## Patterns

### Migrations and types
- **New change**: `supabase migration new <name>`, write SQL with the header from
  `modules/database.mdc`, `supabase db reset` to prove the whole chain, regenerate
  types, commit migration + types in one PR.
- **Prototyped in the local Studio**: `supabase db diff -f <name>` produces the
  migration; review the diff by hand (remove noise, add comments) before commit.
- **Never `db push` from a laptop to production**; CI does it on merge after
  `db reset` and pgTAP pass. `supabase migration list` must match between repo
  and remote; a drift is a blocker.
- **Types are generated after every migration**; CI fails if
  `supabase gen types` output differs from the committed file.

### The three clients
| Client | File | Key | Use |
|---|---|---|---|
| Browser | `lib/supabase/client.ts` | publishable | client components, Realtime, Storage uploads via signed URLs |
| Server | `lib/supabase/server.ts` | publishable + user cookies | Server Components, actions, route handlers (RLS applies) |
| Admin | `lib/supabase/admin.ts` | secret | crons, webhooks, sync, cross-user merges; each import site has a comment saying why |

- Use `@supabase/ssr`: `createBrowserClient` and `createServerClient` with the
  cookie `getAll` / `setAll` adapters; refresh the session in `proxy.ts` (Next.js)
  or the framework equivalent so server reads never see an expired token.
- **`auth.getUser()` on the server, never `getSession()` alone**: only
  `getUser()` verifies the JWT with the Auth server.
- Type every client with `Database` from the generated file; derive `Row`,
  `Insert`, `Update` types from `Tables<"name">` helpers, never by hand.

### Edge Functions (Deno)
- Layout per `modules/integrations.mdc`: `index.ts` parses, validates and
  responds; `handler.ts` holds logic; `_shared/` holds the typed wrappers.
- **`verify_jwt`** stays `true` (default) for user-facing functions; set
  `[functions.<name>] verify_jwt = false` in `config.toml` only for webhooks and
  public endpoints, which then validate a signature or a shared secret themselves.
- Build the caller-scoped client from the `Authorization` header so RLS applies;
  use the secret key only in functions that are not reachable by end users.
- **CORS**: shared `corsHeaders` from `_shared/cors.ts`, allowlist of origins from
  env, preflight handled before auth.
- **Secrets** via `supabase secrets set --env-file supabase/.env.production`
  (file gitignored); local values in `supabase/.env` loaded by `functions serve`.
  Never `Deno.env.get` outside one validated `env.ts`.

### Storage
- **Buckets are private by default**; a public bucket needs a written reason in
  `PROJECT.md`. Access goes through RLS policies on `storage.objects` keyed by
  path prefix (`<user_id>/...`).
- **Reads via `createSignedUrl` (short TTL), uploads via `createSignedUploadUrl`**
  minted on the server after validating type, size and ownership; never let the
  client choose an arbitrary path.
- Set `file_size_limit` and `allowed_mime_types` on the bucket; validate the
  magic bytes server-side for anything that will be served back.

### Auth
- **PKCE flow** for browser and SSR (`flowType: "pkce"` is the `@supabase/ssr`
  default); the `/auth/callback` route exchanges the code and redirects to the
  stored return path only if it is a relative URL.
- **Custom claims through the custom access token hook** (Postgres function
  registered in `config.toml` `[auth.hook.custom_access_token]`); read them from
  `auth.jwt()` in RLS policies. Never put PII in claims.
- **Email templates versioned in `supabase/templates/`** and referenced in
  `config.toml`; use the send-email hook to route through the project's email
  provider (see `modules/auth.mdc`).

### Realtime
- **Private channels only** (`{ config: { private: true } }`) with RLS policies
  on `realtime.messages` using `realtime.topic()`; call `realtime.setAuth()` after
  login and on token refresh.
- **Never broadcast PII or full rows**; broadcast ids and a change kind, let the
  client refetch through RLS. Prefer Broadcast from database triggers over
  Postgres Changes for anything with more than a few subscribers.

### Background work in Postgres
| Need | Use |
|---|---|
| Enforce an invariant or derive a column | Trigger (synchronous, transactional) |
| Notify an external system that something happened | Database webhook (`pg_net`), fire-and-forget, receiver refetches |
| Reliable async work with retries | Queue (`pgmq`) or an Edge Function consumer polled by cron |
| Scheduled job | `pg_cron` `cron.schedule('job_name', '...', $$ select ... $$)` in a migration |

- Every cron job is idempotent, logs to an audit table, and has an alert on
  missed runs (`cron.job_run_details`).

### Connections
- App servers and Edge Functions use the **transaction-mode pooler (port 6543)**
  and disable prepared statements in the driver; long-lived servers may use
  session mode (5432). Migrations use the direct connection.

## Local development and testing

`supabase start` runs the whole stack in Docker; `supabase db reset` replays
migrations and seeds; `supabase functions serve` runs functions with hot reload
and `supabase/.env`. Local Studio and Inbucket (emails) replace the dashboard.

| Category | Tool | What it covers |
|---|---|---|
| Migration chain | `supabase db reset` in CI | every migration applies cleanly from zero |
| Policies and functions | pgTAP via `supabase test db` (`tests.authenticate_as`, `tests.create_supabase_user`, `tests.rls_enabled`) | each policy for anonymous, owner, other user; triggers; RPCs |
| Type drift | `supabase gen types` diff in CI | committed types match schema |
| Edge Function unit | `deno test` next to the handler | handler logic with fake queries |
| Edge Function integration | `deno test` against `supabase start` + `functions serve` | auth rejection, CORS, happy path, error codes |
| App integration | Vitest against the local stack | queries, actions, storage policies |
| E2E | Playwright against local stack or a preview branch | signup, login, core journeys |
| Security | advisors clean, `supabase db lint`, dependency audit | RLS gaps, `search_path`, exposed views |
| Performance | `EXPLAIN ANALYZE` on new queries, index advisor | no seq scan on large tables |

- **Seed strategy**: `seed.sql` holds reference data and a handful of test users
  created through `auth.users` inserts or the admin API in a setup script; large
  fixtures live in separate files listed in `[db.seed] sql_paths`. Seeds are
  idempotent and never contain real customer data.
- CI uses `supabase/setup-cli` in GitHub Actions: `supabase start`,
  `supabase db reset`, `supabase test db`, `deno test`, app tests, then stop.

## Deployment and environments

- **Branching for previews**: each PR gets a preview branch through the GitHub
  integration; migrations, seed, `config.toml` and functions deploy to it
  automatically. Preview branches have their own keys and URL; the app preview
  reads them from the deployment platform's per-branch env.
- **Merge to the production branch deploys**: migrations via `db push`, functions
  via `supabase functions deploy`, secrets via `supabase secrets set` from CI
  secrets. Nothing is deployed by hand.
- **Backups**: verify the plan's backup cadence and enable PITR for production
  with real users; test a restore into a fresh project once per quarter and
  record the date in `PROJECT.md`.

## Observability on this platform

- Structured logs from Edge Functions (`console.error(JSON.stringify({...}))`),
  never PII; the error tracker's Deno SDK initialized at the entry with the
  function name as a tag.
- Read Postgres, Auth, Storage and Edge logs through the dashboard Logs
  Explorer or the CLI/MCP `query_logs`; alerts on function error rate, auth
  failure spikes, and `cron.job_run_details` failures.
- **Advisors (`get_advisors` security and performance) run before every merge**
  touching the schema and weekly on a schedule; findings are fixed or documented
  with a linked issue.

## Checklist when touching Supabase code

- [ ] Schema change is a CLI migration with header; `db reset` clean; types regenerated and committed
- [ ] RLS enabled and policies written for the new table; pgTAP covers anon, owner, other user
- [ ] Advisors report no security findings; performance findings triaged
- [ ] Correct client for the context; admin client use documented and server-only
- [ ] Server code uses `auth.getUser()`; session refreshed in the proxy
- [ ] Edge Function: thin entry, validated input, CORS, `verify_jwt` decision recorded, README
- [ ] Secrets set through `supabase secrets set`; `.env.example` updated
- [ ] Storage: private bucket, path policy, signed URLs, size and MIME limits
- [ ] Realtime channel private with RLS; no PII in payloads
- [ ] Trigger vs webhook vs queue vs cron chosen per the table; jobs idempotent and logged
- [ ] Tests added per the table; CI runs the local stack
- [ ] Region, buckets and new identifiers recorded in `PROJECT.md`
