---
description: External integrations — serverless functions, webhooks, third-party APIs, and data sync. Generic. Apply when the project talks to external services or has a serverless backend.
paths:
  - "**/functions/**"
  - "**/webhooks/**"
  - "**/sync/**"
---

# Integrations, Functions & Sync

Apply when `PROJECT.md` declares external services, a serverless backend, or a
sync with an external source of truth. The actual services, table/base IDs, field
mappings, and business invariants live in `PROJECT.md`.

## Serverless function structure

Each function lives in its own directory with an entry point and a mandatory
`README.md`. Split anything non-trivial; the same size limits apply as the rest
of the codebase (300 lines/file, 50 lines/function, 3 nesting levels).

```
functions/{name}/
  index            (HTTP entry: parse, validate, respond — thin)
  handler          (business logic — no HTTP knowledge)
  queries          (data access)
  {name}.types     (request/response types)
  README.md        (mandatory)
```

- **Entry point does three things only**: parse the request, validate it (schema),
  format the response. Handle CORS preflight on client-facing functions.
- **Wrap the handler in try/catch at the entry**; never let exceptions reach the
  runtime. Return proper status codes; never leak stack traces to the client.
- **Handlers take typed inputs, return typed outputs** — no request/response
  objects. They may orchestrate other handlers.
- **Shared code in a `_shared/` module**: every external API goes through a typed,
  tested wrapper. Never call a third-party SDK/`fetch` directly from business logic.

### Error → status mapping

| Situation | Status |
|---|---|
| Validation failure | 400 |
| Unauthorized / forbidden | 401 / 403 |
| Not found | 404 |
| Conflict (already locked/booked) | 409 |
| Rate limited | 429 |
| Internal error | 500 |
| Upstream (third-party) failure | 502 |

Include a machine-readable reason code in error bodies:
`{ error: "no_stock", message: "..." }`. Log 4xx at `warn`, 5xx at `error`.

### Function auth categories

| Category | Auth |
|---|---|
| Client-facing | Public key + RLS + request auth |
| Service-to-service | Signed short-lived token (shared secret) |
| Webhook | Signature/HMAC validation |
| Cron / internal | Not externally reachable; defensive secret in path/header |

### Function registry

Maintain a registry (e.g. `FUNCTIONS_REGISTRY.md`): function · purpose · called
by · auth · status. Every new function is added in the same PR. To remove one,
mark it `DEAD — Remove by YYYY-MM-DD`, verify no callers, then delete. Review
monthly; the "Called by" column must stay accurate.

## Native SDKs first

- **Always use the provider's official, first-party SDK** for the project's
  language (Stripe, Supabase, Anthropic, Cloudflare, Google, Vercel, Webflow,
  Sentry, ...). Never hand-roll HTTP calls against an API that ships an
  official SDK, and never add a community wrapper on top of one.
- **Raw HTTP only when no official SDK exists** for the language, and then
  behind the same typed wrapper module, with the endpoint list documented in
  the wrapper's README and a note in `PROJECT.md` section 14.
- **On mobile, prefer the provider's native platform SDK** (Swift / Kotlin)
  over a JavaScript bridge when both exist; the bridge is the exception and
  needs a documented reason.
- **Use the platform's native primitives** (the framework's fetch and cache,
  the database's official client, the runtime's crypto) instead of
  third-party re-implementations.
- **Pin the SDK version, read its changelog before upgrading**, and verify the
  installed version's API before writing code against it
  (`dependencies.mdc`).

## Third-party API usage

- **All calls go through one typed wrapper module per service.** Never scatter raw
  calls across business logic.
- **Use stable identifiers, not display names**, in API calls (IDs survive
  renames; names don't). Keep a constants file of IDs and update it on schema drift.
- **Respect documented rate limits**: throttle (sleep between batches) and use
  **exponential backoff** on 429/5xx (e.g. 2s, 4s, 8s; escalate after N attempts).
- **Respect batch limits** (read and write page sizes); batch writes explicitly.
- **Handle pagination** with the provider's cursor/offset until exhausted.
- **Download expiring resources** (signed attachment URLs) immediately and
  re-store them in your own storage; never persist a temporary URL as canonical.
- **Validate inbound webhook signatures** before processing; a failure is a
  high-severity event. Webhooks often signal *that* a change happened — fetch the
  actual data afterward and **persist the cursor** so you can resume.
- **Map provider error codes** to actions (auth → rotate/alert; permission →
  check scopes; 422 → check payload/IDs; 429 → backoff).

## Data sync (external source of truth)

When an external system is the source of truth for some data and your DB mirrors
it, the sync must never corrupt either side.

### Core principles
1. **Declare ownership per field.** Every mapped field has one owning side; writes
   only flow in that direction. Document the ownership matrix in `PROJECT.md`.
2. **The external system owns business data; your DB owns application data**
   (accounts, sessions, ephemeral state). Define which is which per project.
3. **Never decrement a monotonic business counter.** When reconciling, take
   `MAX(current, incoming)`, never a delta that can go negative.
4. **Never downgrade a monotonic status.** Status ladders are upgrade-only; compare
   ordinal positions before writing.
5. **Never overwrite owned data with stale values.** When matching an existing
   record (e.g. by `LOWER(email)`), update only empty or own-side fields.
6. **Ephemeral state is never synced** (carts, locks, drafts) — only committed
   outcomes reach the external system.
7. **Never recompute the external system's derived/formula values** — read and
   store the computed result; don't replicate the formula.

### Reliability
- **Log every sync action** (direction, table, record id, action, status) to a
  persistent audit table — separate from, and in addition to, the error tracker.
- **Retry transient failures** with exponential backoff; persist terminal failures
  for manual review and escalate.
- **Idempotent processing**: running a sync twice must not corrupt data.
- **Don't put a third party on a critical path** — when an outbound sync fails,
  the user's local action still succeeds; reconcile later via retry/cron.

### Edge cases to design for
- A record deleted upstream while referenced locally → soft-delete locally,
  invalidate dependent state, notify affected users.
- An outcome created locally but the upstream sync fails → local record stays
  valid; failure logged; retry job reconciles; user sees no error.
- The same entity edited on both sides → each side wins for the fields it owns.

## Local testing & deployment
- **Never test against production external data.** Use a disposable test
  base/account; mock email and calendar/booking providers so nothing real is sent.
- Keep secrets in a local env file that is never committed.
- Deploy via CI on merge to the production branch; deploy only what changed; fail
  the pipeline on any deploy error.

## Testing

Integrations are maximal-testing areas (`testing.mdc`, rows "API route /
server action / function", "External integration / webhook", "Background job").
- **Wrapper unit tests** with recorded provider fixtures (refreshed on a
  schedule), covering success, each mapped error code, pagination, rate
  limit (429 then success), timeout, malformed response.
- **Function API tests**: happy, validation, unauthenticated, forbidden, not
  found, conflict, upstream failure (502), and the error envelope on a forced
  500 (no stack trace, no internal ids).
- **Contract tests**: request and response validated against the schema and
  the README's documented codes; provider payloads validated against the
  provider's published schema.
- **Webhooks**: valid signature, invalid signature, replayed event, out-of-order
  events, duplicate delivery (idempotent), cursor persisted and resumed.
- **Sync**: field ownership matrix enforced (a write in the wrong direction
  fails a test); monotonic counters and statuses never decrease; run twice
  yields the same state; audit log rows asserted; upstream deletion path.
- **Resilience**: retry with fake clock, backoff exhaustion, circuit breaker,
  best-effort step failure leaves the primary action successful.
- **Fuzzing** of every inbound boundary; **load test** of the function at
  the provider's rate limit; **E2E** of the user-visible journey.

## Checklist when touching an integration / function
- [ ] Entry → handler → queries structure; files <300, functions <50 lines
- [ ] Inputs validated with a schema; errors mapped to proper status codes
- [ ] Errors captured in the tracker with context; structured logs (no PII)
- [ ] README updated; registry updated if a function was added/removed
- [ ] Env vars declared and documented; no hardcoded secrets
- [ ] Third-party calls go through the shared wrapper; stable IDs used
- [ ] Rate limits, batch sizes, backoff respected
- [ ] Sync: field ownership respected; no decrement / downgrade / overwrite
- [ ] Sync: audit-log entry written; retry on transient failure
- [ ] Tests cover happy path and failure paths
