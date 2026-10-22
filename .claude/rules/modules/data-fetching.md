---
description: Data fetching between the UI and the database - fastest possible reads, safe optimistic UI and explicit pending states, one clean data layer. Apply when a frontend reads or writes application data.
paths:
  - "**/*.queries.*"
  - "**/*.mutations.*"
  - "**/queries/**"
  - "**/mutations/**"
  - "**/hooks/use*"
  - "**/loaders/**"
  - "**/actions/**"
---

# Data Fetching (UI to database)

Apply when `PROJECT.md` declares a frontend that reads or writes application
data. Query mechanics live in `database.mdc`, component rules in
`frontend.mdc`, budgets in `performance.mdc`. This rule fixes the contract
between them: **reads meet their latency budgets, writes give immediate honest
feedback, and the data layer stays readable.** This module owns the mutation
feedback policy; other UI rules refer here.

## Principles

1. **Latency is a feature.** A read that takes longer than its budget in
   `PROJECT.md` (default p95: 200 ms end to end) is a bug, not a tuning
   opportunity.
2. **Every action gives immediate feedback.** Safe mutations may update
   optimistically; other mutations show pending until the server confirms.
3. **One data layer, one shape.** The UI never knows which database, SDK, or
   transport is behind a query. Swapping the backend touches one directory.
4. **Fetch once, share everywhere.** The same data is never requested twice in
   one screen; the cache is the single source of truth on the client.

## Rules

### Where data access lives

- **All reads and writes go through `*.queries.*` / `*.mutations.*` files**
  (or the project's equivalent), typed from generated DB types and validated
  at the boundary. No inline queries in components, hooks, actions, or route
  handlers.
- **One query function per use case**, named after the screen or action it
  serves (`getOrderSummary`, `listOpenSlots`), never generic getters that
  return whole tables.
- **Components consume hooks, hooks consume query functions.** A component
  never imports the DB client, the fetch layer, or the SDK.
- **Query keys are centralized** in one `keys` module per domain
  (`orderKeys.detail(id)`), never string literals scattered in hooks.
- **Schemas for inputs and outputs** live next to the query; the hook's type
  is inferred from them.
- **The data layer uses the database's official client or SDK** (and the
  framework's native fetching and caching primitives), never a hand-written
  HTTP layer or a community wrapper around the official one
  (`integrations.mdc`, "Native SDKs first").

### Fastest possible reads

- **Select only the columns the screen renders.** No `select *`, no fetching a
  relation to read one field. Shape the response server-side (view, RPC,
  server component) so the client receives what it displays.
- **One round trip per screen.** Compose the data a screen needs into a single
  query, view, RPC, or server-side loader. Never chain dependent client
  requests (request waterfalls); if a second request depends on the first,
  move the join to the server.
- **Every filter hits an index** (`database.mdc`); `EXPLAIN` is part of the
  query's test.
- **Paginate everything that can grow**, cursor-based, with a hard maximum
  page size. Infinite lists use the query library's infinite mode, never
  manual offset math in the component.
- **Render on the server when the data is not user-interactive** (server
  components, loaders, ISR). Client fetching is for data that changes with
  user interaction or must stay live.
- **Prefetch what the user will need next**: on hover or in view for links,
  the next page of a list, the detail behind a row. Hydrate the client cache
  from the server render so the first paint has data and no spinner.
- **Deduplicate and cache**: identical in-flight requests are merged; a
  cached response is shown instantly and revalidated in the background
  (stale-while-revalidate). Set `staleTime` per query from how often the data
  really changes; never default to zero.
- **Debounce user-driven queries** (search, filters) and cancel the previous
  request with an abort signal when the input changes.
- **Batch reads** when a list needs per-row data: one query with an `IN`
  list or a server-side join, never N requests. A loop that issues queries
  fails review.
- **Real-time and offline are opt-in** (see the optional sections below);
  by default reads are request/response with caching.
- **Measure**: every query function opens a span (`observability.mdc`); the
  p95 per query is visible in a dashboard and alerts when it crosses the
  budget.

### Mutation feedback policy

- **Use optimistic updates only when the result is predictable, the action is
  low-risk, and rollback is reliable.** Typical examples are a local preference,
  a like, or a rename without external side effects. Document the choice next to
  the mutation; if eligibility is uncertain, show pending instead.
- **Wait for server confirmation** for money, permission changes, destructive
  or irreversible operations, scarce-resource reservations, and unpredictable
  generated results. Show progress immediately without claiming success or
  changing authoritative balances, access, availability, or status prematurely.
- Both modes preserve user input on failure, prevent accidental duplicate
  submission, and reconcile with the server's authoritative response.
- **Eligible optimistic sequence**: cancel in-flight queries for affected keys,
  snapshot the current cache, apply the optimistic update, send the request,
  on error undo only this mutation and show the mapped error message
  (`error-handling.mdc`), on settle invalidate the affected keys so the
  server truth replaces the guess.
- Serialize conflicting optimistic writes or track per-mutation patches/versions.
  A rollback must not restore an old snapshot over a newer successful change.
- **Optimistic updates are pure functions** (`applyOptimisticAddItem(cache,
  input)`), unit-tested, reused by the rollback logic and the tests.
- **Temporary fields** in eligible optimistic updates are visibly pending and
  replaced during reconciliation. Never invent authoritative financial totals,
  permissions, or final generated content; display pending until confirmed.
- **Idempotency keys on every optimistic write** so a retry after a network
  failure does not duplicate the action (`api-design.mdc`).
- **Conflicts are handled, not hidden**: a version or `updated_at` check on
  the server returns a conflict; the client re-fetches, shows what changed,
  and lets the user retry. Silent last-write-wins is forbidden for shared
  data.
- **Mutations return the updated entity** so the cache can be set from the
  response instead of a full refetch.
- **Forms** follow the mutation eligibility rule above. Preserve edits while
  pending where safe, prevent duplicate submission, and never clear input on failure.

### Optional: offline mode with a mutation queue

Off by default. Enable in `PROJECT.md` (section 9 notes) only when users
work without connectivity (field apps, mobile in poor coverage). When enabled:
- Reads are served from a persisted cache (IndexedDB, SQLite, MMKV) with a
  visible "offline, showing data from <time>" indicator.
- Only mutations explicitly approved as offline-safe enter a persisted queue,
  with idempotency keys, ordered replay, conflict handling, and retry/discard UI.
  The same optimistic eligibility policy applies; never queue money, permission,
  or irreversible actions for automatic execution on reconnect.
- Queue replay is tested: order, duplicates after a crash, conflict, and a
  server rejection of the first item not blocking the rest.

### Optional: systematic real-time

Off by default. Enable in `PROJECT.md` only for collaborative or live data
(shared boards, inventory counters, chat). When enabled:
- Subscriptions are scoped per screen and torn down on unmount; channels are
  authorized server-side (`security.mdc`) and never carry PII beyond need.
- Events patch the cache; a full refetch happens only on reconnect or on a
  gap in event ordering.
- Tests cover: event applied to the cache, out-of-order event, reconnect
  refetch, unauthorized channel rejected, and no leaked subscription after
  navigation.

### Loading, error, and empty states

- Every query hook exposes `data`, `isPending`, `error`, and the component
  renders all three states explicitly; a screen with data but no error state
  fails review.
- Use skeletons that match the final layout (no layout shift, `frontend.mdc`)
  and suspense boundaries at the smallest meaningful unit, never a whole-page
  spinner for one slow widget.
- Show cached data with a subtle refreshing indicator rather than replacing it
  with a spinner on revalidation.

### Keeping it clean

- **A query file reads top to bottom**: schema, key, query function, hook.
  Nothing else. Under 150 lines; split by use case beyond that.
- **No transformation in components**: derive view models in the query layer
  (`select` option or a mapper) so components receive display-ready data.
- **No conditional fetching logic in JSX**; `enabled` flags belong to the
  hook.
- **Invalidation rules are explicit and local**: each mutation lists the keys
  it touches; no global "invalidate everything".
- **Dead queries are deleted**: a query function with no hook and a hook with
  no component are removed in the same PR that orphaned them.
- **Server and client use the same schema and types**; a divergence is a bug.

### Security and correctness

- Authorization is enforced by the database or the server (`security.mdc`);
  the client filters for display only. A query that relies on the client to
  hide rows fails review.
- The cache is per user: clear it on logout and on account switch.
- Never cache secrets, tokens, or another user's data on the client.

## Testing

Data fetching is a maximal-testing area (`testing.mdc`):
- **Query functions**: integration tests against the real local database
  (never a mocked client) for result shape, empty result, pagination
  boundaries, and authorization (anon, owner, other user).
- **Latency**: a test per hot query asserts `EXPLAIN` uses the intended index
  and a seeded-volume benchmark stays under the budget; CI fails on
  regression.
- **Waterfalls**: a test or lint that counts requests per screen render; more
  than one dependent round trip fails.
- **Optimistic flows**: for eligible mutations, tests for immediate cache update,
  rollback on error with the mapped message, reconciliation on success,
  duplicate submission with the same idempotency key, conflicts, and overlapping
  writes where an older failure must not erase a newer success.
- **Confirmed flows**: test immediate pending feedback, no premature success or
  authoritative cache change, server rejection, timeout, retry, and final confirmation.
- **Hooks**: tested with the query library's test utilities and MSW-style
  request mocks at the HTTP boundary, covering pending, error, empty, cached,
  and refetch states, plus abort on input change.
- **E2E**: critical journeys assert the chosen optimistic or pending state
  before the network response, reconciliation on success, and safe recovery
  after rejection or timeout.
- **Performance budgets**: Lighthouse and RUM budgets for the screens that
  depend on these queries (`performance.mdc`).

## Checklist when touching data-fetching code
- [ ] Read or write lives in a `*.queries.*` / `*.mutations.*` file, typed and validated, via the official SDK
- [ ] Selects only rendered columns; one round trip per screen; no waterfall
- [ ] Filters hit an index; `EXPLAIN` asserted in a test; paginated if it can grow
- [ ] Server rendering or prefetch used where the data is not interactive
- [ ] `staleTime` set deliberately; requests deduplicated; search debounced and abortable
- [ ] Mutation mode justified: safe optimistic update or pending until confirmation
- [ ] Eligible optimistic update is pure and tested; rollback preserves newer writes; idempotency key sent
- [ ] Conflict path implemented and tested; no silent last-write-wins
- [ ] Loading, error, and empty states rendered; no layout shift
- [ ] Query keys centralized; invalidation explicit; dead queries removed
- [ ] Span per query; p95 under budget on the dashboard
- [ ] Integration, latency, optimistic, hook, and E2E tests added
