---
description: API design — REST conventions, error envelope, pagination, idempotency, versioning, OpenAPI from schemas, webhooks-out. Apply when the project exposes an HTTP, RPC, or GraphQL API.
paths:
  - "**/api/**"
  - "**/routes/**"
  - "**/openapi*"
  - "**/*.proto"
---

# API Design

## When this applies

Apply when `PROJECT.md` declares an API surface (public, partner, or internal
between services) and to every file matching the globs. REST over JSON is the
default; RPC and GraphQL projects follow the same principles with the variants in
their subsection. The base URL, auth scheme, rate-limit tiers, and the list of
API consumers live in `PROJECT.md`. Serverless entry-point structure, the
error-to-status mapping, and third-party call rules live in
`modules/integrations.mdc` and are not repeated here.

## Principles

- **The schema is the source of truth.** Request and response schemas are code;
  the OpenAPI document, the client types, and the validation derive from them.
- **Additive evolution.** A released endpoint never breaks; it gains fields or a
  successor gets a new major version.
- **Boring HTTP.** Standard methods, status codes, and headers; never invent a
  custom mechanism when an RFC covers the case.
- **Every response is machine-readable**, including every error; a consumer
  never has to parse prose to act.

## Rules

### Resources and URLs

| Element | Convention | Example |
|---|---|---|
| Collection | plural noun, kebab-case | `/v1/purchase-orders` |
| Single resource | collection + opaque id | `/v1/purchase-orders/po_8f2k` |
| Sub-collection | max 2 levels of nesting | `/v1/orders/{id}/items` |
| Action (non-CRUD) | `POST` + verb on the resource | `POST /v1/orders/{id}/cancel` |
| Query params | `snake_case` | `?created_after=2025-01-01` |
| JSON fields | `snake_case`, never mixed | `"created_at"` |
| Ids | opaque strings, prefixed by type | `usr_…`, `ord_…` |

- **Never put verbs in a path** except for non-CRUD actions. **Never expose
  sequential integer ids** or internal database keys.

### HTTP methods

| Method | Use | Safe | Idempotent | Success |
|---|---|---|---|---|
| `GET` | read | yes | yes | 200 |
| `POST` | create or action | no | with `Idempotency-Key` | 201 (create) / 200 or 202 (action) |
| `PUT` | full replace | no | yes | 200 |
| `PATCH` | partial update (JSON merge patch) | no | yes | 200 |
| `DELETE` | remove | no | yes | 204, or 200 with the final resource |

- **`GET` never mutates state**, including counters or "last seen" fields.
### Status codes and errors

Use the mapping in `modules/integrations.mdc` for the base cases. Additions used
by this module: `201`, `202`, `204`, `304` (ETag match), `412` (precondition
failed), `413` (payload too large), `415` / `406` (content negotiation), `428`
(precondition required).

Every error, on every endpoint, uses one envelope:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body is invalid.",
    "details": [{ "field": "email", "code": "invalid_format", "message": "..." }],
    "request_id": "req_01J8…"
  }
}
```

- **`code` is the machine-readable reason code** (`snake_case`, stable, listed in
  the OpenAPI document). Consumers branch on `code`, never on `message`.
- **`details` is optional** and structured; validation errors list every failing
  field, not only the first one.
- **`message` is safe to display** and contains no internal names, SQL, or paths.
  **Never return `200` with an error body.**

### Pagination, filtering, sorting

- **Collections are always wrapped**: `{ "data": [...], "next_cursor": "…" | null }`.
  Never return a bare array.
- **Cursor-based pagination is the default**: `?limit=20&cursor=…`; cursors are
  opaque base64url. Offset pagination only for admin screens, documented as such.
- **Cap `limit`**: default 20, max 100 (override in `PROJECT.md`); exceeding it
  returns `400 limit_too_large`, never a silent clamp.
- **Filters are named query params**: equality `?status=active`, ranges with
  `_gte` / `_lte` suffixes, lists as repeated params. Unknown params return `400`.
- **Sorting**: `?sort=-created_at,name`; only schema-listed fields are sortable;
  the default sort is stable (ties broken by id).

### Concurrency and idempotency

- **Every `POST` that creates accepts `Idempotency-Key`** (a client UUID). Store
  key, request hash, and response for at least 24 hours; replay returns the stored
  response. Same key with a different body returns `409 idempotency_key_conflict`.
- **Every single-resource `GET` returns an `ETag`.** `PUT`, `PATCH`, and `DELETE`
  on resources that can be edited concurrently require `If-Match`; a mismatch
  returns `412 precondition_failed`, a missing header returns `428`.

### Versioning and deprecation

- **Major version in the URL prefix**: `/v1/…`. One major version per contract;
  no header or query versioning.
- **Additive changes only within a major**: new optional fields, new endpoints,
  new enum values only where the schema declares the enum open. Removing or
  renaming a field, changing a type, or tightening validation is a new major.
- **Deprecation is announced in-band**: `Deprecation: true`,
  `Sunset: <HTTP-date>`, and `Link: <docs-url>; rel="deprecation"` on every
  response of the deprecated endpoint, at least 6 months before the sunset date.

### Headers, rate limits, CORS, content

- **Request ids**: accept `X-Request-Id` from trusted clients, else generate one
  at the edge; echo it in the response header, the error envelope, and every log
  line (see `modules/observability.mdc`).
- **Rate-limit headers on every response**: `RateLimit-Limit`,
  `RateLimit-Remaining`, `RateLimit-Reset`; `429` also carries `Retry-After`.
  Limits are per consumer, never per IP alone, and tiers live in `PROJECT.md`.
- **CORS**: explicit origin allowlist from env; never `*` with credentials;
  preflight handled at the entry point before auth.
- **Content negotiation**: `application/json; charset=utf-8` by default; reject
  other request bodies with `415`; honor `Accept` and return `406` otherwise.
- **Timestamps are ISO 8601 UTC with `Z`**; money is integer minor units plus a
  currency code (see `modules/i18n.mdc`).

### Schemas, OpenAPI, and shared types

- **One schema per request and response** in the central schema location
  (`lib/schemas/`, per `core/code-standards.mdc`), reused by the handler for
  validation and by the generator for the spec.
- **OpenAPI is generated from the schemas** (for example zod-to-openapi, FastAPI,
  or the framework's generator). The generated file is committed; CI regenerates
  it and fails on any diff. **Never hand-edit the spec.** Every operation has an
  `operationId`, auth requirement, its error `code` list, and one example.
- **Client and server share types**: the client imports generated types from the
  spec or a shared package. Hand-written duplicates of API types are forbidden.

### RPC, tRPC, and GraphQL variants

- **tRPC**: procedures named `resource.verb`; inputs and outputs use the same
  central schemas; errors map to `TRPCError` codes and carry the envelope `code`
  in `cause`.
- **gRPC / protobuf**: package versioned `<name>.v1`; field numbers are never
  reused (mark removed ones `reserved`); `buf lint` and `buf breaking` run in CI.
- **GraphQL**: no URL versioning; retire fields with `@deprecated(reason:)` plus
  a sunset date; Relay-style connections; errors carry `extensions.code` and
  `extensions.request_id`; enforce depth and complexity limits.

### Webhooks out

When the API emits events to consumers:

```json
{
  "id": "evt_01J8…",
  "type": "order.completed",
  "created_at": "2025-03-01T10:15:00Z",
  "api_version": "v1",
  "data": { "id": "ord_…" }
}
```

- **`type` is `resource.event` in past tense**, listed in the OpenAPI document.
- **Sign every delivery**: `Webhook-Timestamp` plus `Webhook-Signature` =
  HMAC-SHA256 over `timestamp.body`, one secret per endpoint, two secrets active
  during rotation. Consumers must reject timestamps older than 5 minutes.
- **Retry on non-2xx** with exponential backoff and jitter for at least 24 hours;
  after that, dead-letter, alert, and expose the failure to the consumer.
  Deliveries are at-least-once; the event `id` is the deduplication key.

### Tooling

- **OpenAPI lint**: Spectral with a committed ruleset (naming, envelope, required
  `operationId`, examples). **Proto**: `buf`. **Validation**: the project's
  schema library. **Spec diff**: `oasdiff` or equivalent against the last
  released spec.
- **Single check command**: the project's `check` script (for example
  `pnpm check`) runs typecheck, lint, spec regeneration, spec lint, and tests.

## Testing

- **Contract tests**: every response of every endpoint is validated against its
  schema in the test suite; a mismatch fails the build.
- **Per-endpoint API tests**, minimum cases: happy path, validation failure
  (`400` with full `details`), unauthenticated (`401`), forbidden (`403`),
  not-found (`404`), conflict (`409` / `412`), and the `Idempotency-Key` replay.
- **Backward-compatibility tests**: `oasdiff breaking` (or equivalent) against the
  previous released spec in CI; a breaking change requires a new major.
- **Fuzz tests** of request inputs with Schemathesis (from the spec) or
  property-based generators; no `500` may result from any input.
- **Webhook tests**: signature verification, timestamp rejection, retry schedule,
  duplicate delivery handled by the reference consumer.
- **Performance tests** per endpoint class against the budgets in
  `modules/performance.mdc`.

## Checklist when touching API code

- [ ] Resource path is a plural noun; actions are `POST` + verb; nesting <= 2
- [ ] Request and response schemas live in the central schema location and drive validation
- [ ] OpenAPI regenerated and committed; Spectral lint passes; no hand edits
- [ ] Every error uses the single envelope with a documented `code` and `request_id`
- [ ] Collections wrapped in `data` with cursor pagination and a capped `limit`
- [ ] Creating `POST` accepts `Idempotency-Key`; edits use `ETag` / `If-Match`
- [ ] Change is additive, or a new major with `Deprecation` / `Sunset` on the old one
- [ ] Rate-limit headers, request id, CORS allowlist, and body size limit in place
- [ ] Client types derived from the spec; no hand-written duplicates
- [ ] Outbound webhooks signed, retried, and documented with their event types
- [ ] Endpoint tests cover happy, validation, auth, not-found, conflict, replay
- [ ] Backward-compat diff, Spectral lint, and fuzz run green in CI
