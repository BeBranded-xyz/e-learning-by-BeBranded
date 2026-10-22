---
description: Error handling - error taxonomy, typed errors, reason codes, user-facing vs technical messages, what reaches the tracker. Project-agnostic. Always applies.
---

# Error Handling

Applies to every project and language. Language-specific mechanics (exceptions,
`Result`, error values) are in the language rules; this rule fixes the model
they all implement. Status-code mapping is in `integrations.mdc`, capture
mechanics in `observability.mdc`.

## Error taxonomy

Every error in the system belongs to exactly one class. The class decides how
it is handled, logged, and shown.

| Class | Meaning | Handling | Tracker |
|---|---|---|---|
| **Validation** | Caller sent bad input | Reject early with field-level detail; 400 | No |
| **Authorization** | Caller may not do this | Deny; 401/403; never reveal existence | No (log at warn) |
| **Not found** | Target does not exist | 404 | No |
| **Conflict** | State forbids the action (already booked, version mismatch) | 409 with reason code | No |
| **Rate limit** | Caller too fast | 429 with `Retry-After` | No |
| **Upstream** | Third party failed or timed out | Retry per policy; 502/504; degrade if possible | Yes |
| **Internal** | Our bug or invariant violation | Fail the request; 500; generic message | Yes, always |
| **Fatal** | Process cannot continue (config missing, DB unreachable at boot) | Crash loudly at startup | Yes, page |

Expected errors (validation, authz, not found, conflict, rate limit) are part of
normal operation and are **never** captured as exceptions in the tracker. A
spike in them is a metric, not an incident.

## Typed errors

- **Define one error type per class**, in one module per package (e.g.
  `lib/errors`), with a machine-readable `code` and an optional `details`
  object. Never throw or return bare strings.
- **Every error carries a stable `code`** in `snake_case` (`no_stock`,
  `slot_taken`, `upstream_timeout`). Codes are an API contract: document them,
  never rename without a deprecation.
- **Wrap, do not replace.** When re-raising from a lower layer, keep the cause
  (`cause`, `%w`, `from`, `source()`); never lose the original stack.
- **Errors cross layer boundaries as typed values**, never as HTTP responses or
  UI strings. Only the entry point (route, action, CLI) maps class to
  status/exit code, and only the UI maps code to a user message.

```ts
export class AppError extends Error {
  constructor(
    readonly kind: "validation" | "authz" | "not_found" | "conflict" | "rate_limit" | "upstream" | "internal",
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
```

## Result vs throw

- **Expected outcomes are values.** When a function has a legitimate failure
  path the caller must decide on (not found, conflict, validation), return a
  `Result`/`Either`/`Option`, or a discriminated union, so the type system
  forces the caller to handle it.
- **Unexpected failures throw/panic.** Invariant violations, programmer errors,
  and unrecoverable infrastructure failures propagate as exceptions to the
  boundary that can fail the whole operation.
- **Never use exceptions for control flow.** Never catch an exception just to
  convert it to a return value unless you are at a library boundary.
- **Never swallow.** An empty `catch`, `except: pass`, `_ = err`, `.unwrap_or_default()`
  hiding a real failure is a bug. Handle, wrap and rethrow, or capture and
  degrade explicitly with a comment saying why degrading is safe.

## Boundaries

At every boundary (HTTP handler, server action, job handler, CLI, webhook,
message consumer):

1. **Validate input with a schema** before any logic. Schema failure is a
   validation error with field paths.
2. **Wrap the whole handler** in a single top-level catch that maps error class
   to response, captures internal/upstream errors with context, and never leaks
   stack traces, SQL, or internal identifiers to the caller.
3. **Attach a request id** to the response and every log line so a user report
   can be matched to a trace.
4. **Return one error envelope shape** everywhere (see `api-design.mdc`):
   `{ error: { code, message, details?, request_id } }`.

## User-facing messages

- **Users see messages, not errors.** The UI maps `code` to a localized,
  actionable message ("This slot was just taken. Pick another."), never the
  technical `message`.
- **Every code has a default user message** in the locale files; a missing
  mapping falls back to a generic message and is logged as a bug.
- **Never show**: stack traces, SQL, provider names, internal ids, or "unknown
  error" when a code exists.
- **Offer the next step**: retry, go back, contact support with the request id.

## Retries, timeouts, and degradation

- **Every outbound call has a timeout.** No unbounded network or DB call.
- **Retry only idempotent operations**, only on transient classes (timeout,
  429, 5xx, connection reset), with exponential backoff and jitter, and a
  bounded attempt count. Non-idempotent operations need an idempotency key
  before they can be retried.
- **Circuit-break** a dependency that keeps failing; fail fast with an
  upstream error and a degraded-mode path where the product allows it.
- **Degrade explicitly**: when a best-effort step fails (analytics, marketing
  sync, cache warm), log it, capture it, continue, and never fail the user's
  primary action. Mark such steps in code as best-effort.
- **Partial failure in batches** is reported per item, never as an all-or-nothing
  boolean, and the batch is resumable.

## Resource safety

- Release what you acquire (files, locks, connections, transactions) in a
  `finally`/`defer`/`Drop`/context manager, on every path.
- Roll back transactions on any error; never leave a transaction open across an
  await that may fail.
- Cancel in-flight work when the caller goes away (abort signals, contexts).

## Logging and capture

- Log expected errors at `warn` with code and ids; log internal and upstream at
  `error` with the captured exception. Never log at `error` for a 4xx.
- Include: request id, error code, entity ids, attempt number. Exclude: PII,
  secrets, raw bodies.
- Capture internal and upstream errors in the tracker with `feature` and
  `action` tags (`observability.mdc`). Capture once, at the boundary, not at
  every layer.

## Testing errors

Error paths are tested with the same rigor as happy paths:
- **Every error class an entry point can return has a test** asserting status,
  envelope shape, `code`, and that no internal detail leaks.
- **Every retry policy has a test** with a fake clock: transient failure then
  success, exhaustion, non-retryable failure not retried.
- **Every timeout has a test** that the call is abandoned and the resource
  released.
- **Every best-effort step has a test** proving the primary action still
  succeeds when it fails.
- **Fuzz boundary inputs** (malformed JSON, wrong types, huge payloads, unicode)
  and assert only validation errors result, never 500s.
- **Contract tests** assert the set of codes an endpoint emits matches its
  documentation.

## Checklist when touching error paths
- [ ] Error belongs to one class and carries a stable `code`
- [ ] Expected outcomes returned as typed values; unexpected ones thrown
- [ ] No swallowed errors; degradation is explicit and commented
- [ ] Boundary validates input, maps class to status, attaches request id
- [ ] No stack trace, SQL, or internal id reaches the client
- [ ] User message mapped from code and localized
- [ ] Timeouts on every outbound call; retries only when idempotent
- [ ] Resources released on every path; transactions rolled back
- [ ] Logged at the right level with ids, no PII; captured once at the boundary
- [ ] Tests cover each error class, retry, timeout, best-effort, and fuzzed input
