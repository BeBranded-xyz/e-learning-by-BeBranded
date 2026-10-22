---
description: Error tracking, tracing, and structured logging. Generic, with Sentry examples. Apply when the project has an error/observability tool.
---

# Observability

Error tracking, tracing, and structured logging. Examples use Sentry; the
principles apply to any equivalent tool. Whether one is configured, the DSNs, and
the per-feature tags/spans are project-specific — see `PROJECT.md`.

**Never use `console.log` for error reporting.** Capture exceptions through the
error tracker or a structured logger.

## SDK per runtime

Use the SDK matching each runtime (server, client/browser, edge/serverless
runtime). Read every DSN and config value from env — **never hardcode a DSN**.

```
ERROR_DSN                 # server-side
PUBLIC_ERROR_DSN          # client
ENVIRONMENT               # production | preview | development
TRACES_SAMPLE_RATE        # e.g. 0.1 prod, 1.0 dev
PROFILES_SAMPLE_RATE      # e.g. 0.1 prod, 1.0 dev
RELEASE                   # set by CI (commit SHA or tag)
```

Document each variable in `.env.example` and the deployment docs.

## Exception tracking

- **Capture in every catch block** where the error is meaningful; never swallow
  with empty `catch {}`.
- **Add context** via a scope: feature tag, action tag, and technical identifiers
  (entity ids), never raw PII.
- **Re-throw after capturing** when the caller still needs to react.

```ts
try {
  return await lockProduct(productId, sessionId);
} catch (error) {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "cart");
    scope.setContext("cart", { productId, sessionId }); // ids only
    Sentry.captureException(error);
  });
  throw error;
}
```

At every serverless/function entry point: init the SDK, wrap the request in a
top-level try/catch, and open a span for the request.

## Tracing

Open spans for meaningful work: outbound API calls, DB queries, sync calls,
expensive computation, document generation, email sending. Use a clear operation
(`op`) and name, and attach technical attributes (ids, not PII).

Define a small, consistent set of `op` values for the project (e.g. `http.client`,
`http.server`, `db.query`, `db.function`, `<service>.read`, `<service>.write`,
`sync.in`, `sync.out`). Keep the project's span vocabulary in `PROJECT.md`.

```ts
return Sentry.startSpan({ op: "http.client", name: `GET ${endpoint}` }, async (span) => {
  span.setAttribute("entity.id", id);
  return fetchThing(id);
});
```

## Structured logging

- Enable structured logs and forward `warn`/`error` console calls to the tracker;
  do **not** forward `log`/`info` in production (too noisy).
- Every log line carries context (ids), and a level: `trace`/`debug` for dev
  detail, `info` for milestones, `warn` for degraded-but-recoverable, `error` for
  caught exceptions, `fatal` for must-page conditions.
- Never log secrets, passwords, tokens, full sessions, or raw email/message bodies.

## PII

**Never send raw PII to the error tracker.**
- Identify users by id only (`setUser({ id })`), never email/name.
- Contexts carry technical fields only.
- Configure a `beforeSend` hook that scrubs PII from messages and stack traces as
  a safety net; keep the scrubbing function in one module and unit-test it.

## Where capture is mandatory

- Every catch block (with context).
- Serverless/function entry points (init + top-level try/catch + request span).
- Route handlers and error boundaries.
- Auth failures, sync failures, email failures, third-party failures — each with a
  distinguishing `feature` tag.

## What the tracker does NOT replace

- **The audit log** (e.g. a sync-log table): persistent structured history lives in
  your DB; the tracker captures the exception. Both are required.
- **User-facing errors**: users see friendly messages/toasts, not raw events.
- **Expected validation errors**: handled as 4xx, not captured as exceptions —
  unless they indicate a real bug (client/server schema mismatch).

## Sample rates & releases

- Sampling: dev `1.0`, preview ~`0.5`, production ~`0.1`; tune to volume/quota and
  document changes.
- Set `RELEASE` to the commit SHA in CI for every deploy; upload source maps during
  the build; tag releases with the environment.

## Testing

- **PII scrubbing** (`beforeSend`) has unit tests with emails, phone numbers,
  tokens, and names in messages, contexts, and stack traces.
- **Capture is asserted**: integration tests for each mandatory capture point
  use a test transport and assert the event, tags, and absence of PII.
- **Spans**: a test per instrumented operation asserts `op`, name, and
  attributes; missing spans on outbound calls fail.
- **Log level discipline**: tests assert 4xx logs at `warn` and 5xx at `error`,
  with request id and entity ids present.
- **Alert rules** are versioned (as code or exported config) and a synthetic
  failure at the pre-production gate proves each alert fires and routes.
- **Health and synthetic checks** are tested against a broken dependency to
  prove they go red.

## Alerts

Configure alerts for: any `fatal`; elevated error rate on functions (short
window); sync failures persisting beyond a threshold; and any occurrence of
high-severity events (e.g. webhook signature failures). Keep routing/escalation in
the deployment docs.

## Checklist when touching observability code
- [ ] SDK initialized per runtime; DSNs and sample rates read from env
- [ ] Every meaningful catch captures with `feature` and `action` tags and ids only
- [ ] Function entry points: init, top-level try/catch, request span
- [ ] Spans on outbound calls, DB queries, jobs, with the project's `op` vocabulary
- [ ] Logs structured, levelled correctly, with request and entity ids, no PII
- [ ] `beforeSend` scrubbing in one tested module
- [ ] `RELEASE` set in CI; source maps uploaded
- [ ] Alerts exist for fatal, error-rate, sync failures, and high-severity events
- [ ] Tests assert capture, span attributes, scrubbing, and alert routing
