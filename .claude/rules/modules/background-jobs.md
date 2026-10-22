---
description: Background jobs - crons, queues, and workers. Idempotency, retries, dead-letter queues, locks, payloads, timeouts, graceful shutdown, observability, outbox pattern. Apply to job, queue, worker, and cron code.
paths:
  - "**/jobs/**"
  - "**/queues/**"
  - "**/workers/**"
  - "**/cron/**"
---

# Background Jobs, Queues & Crons

## When this applies

Apply to every file matching the globs, and whenever `PROJECT.md` declares a
queue, a scheduler, or worker processes. The provider (Vercel cron, Cloudflare
queues, BullMQ, pg_cron, Temporal, Inngest), queue names, schedules, and
retention windows live in `PROJECT.md`. Third-party wrappers, backoff on
upstream calls, and sync safety rules are in `modules/integrations.mdc`;
tracing and logging conventions are in `modules/observability.mdc`.

## Principles

- **Assume at-least-once delivery.** Every job can run twice, late, or
  concurrently with itself. Design for it; never hope against it.
- **Idempotent by construction**, not by luck: a deterministic job id, a dedupe
  key, and handlers whose second run is a no-op.
- **Small payloads, big handlers**: the message carries ids; the handler loads
  the current state.
- **Failure is a first-class path**: bounded retries, then a dead-letter queue
  that someone is alerted about.
- **The schedule is configuration; the logic is code.**

## Rules

### Idempotency

- **Every job has a deterministic `jobId`** derived from its business key
  (`invoice-send:{invoiceId}:{periodKey}`), never a random UUID. Enqueue with
  that id so the queue deduplicates.
- **Handlers check state before acting**: read the target record, return early
  if the work is done, write the outcome atomically with a marker
  (`processed_at`, or a unique `idempotency_key` column).
- **External side effects carry an idempotency key** (payment, email, webhook
  call) derived from the job id and passed to the provider wrapper.
- **Never rely on "it only runs once"** from any provider; treat exactly-once
  claims as at-least-once plus dedupe.

### Retries, timeouts, and dead letters

| Setting | Rule |
|---|---|
| Retry policy | Exponential backoff with full jitter, base 1 s, cap 5 min |
| Max attempts | 5 by default; per-job override declared next to the handler |
| Timeout | Explicit per job, never the provider default, shorter than the visibility timeout |
| Visibility timeout | Longer than the p99 job duration; extended by heartbeat for long jobs |
| Dead-letter queue | Mandatory; alert on first message; retention 14 days minimum |
| Non-retryable errors | Typed error class; straight to the DLQ with a reason code |

- **Distinguish transient from permanent failures** with typed errors; a
  validation error never retries.
- **A DLQ message is an incident**: it carries the job id, attempt count, last
  reason code, and a replay command. Replay is deliberate, never automatic.
- **Timeouts propagate**: pass an abort signal or deadline into every I/O call
  inside the handler.

### Locks and singleton crons

- **Singleton crons take a distributed lock** (`SELECT ... FOR UPDATE SKIP
  LOCKED`, advisory lock, Redis `SET NX PX`, or the provider's overlap guard)
  keyed on the cron name.
- **Locks have a TTL** slightly above the job timeout; never a lock without an
  expiry, never a lock released only on success.
- **If the lock is held, skip and log** at `info`; do not queue behind it.

### Payloads and naming

- **Payloads carry ids, not blobs**: no full records, files, or rendered
  content. Target size under 4 KB.
- **Payloads are schema-validated** on enqueue and on consume with the shared
  schema (`lib/schemas/`); an invalid payload goes to the DLQ instead of
  throwing inside the loop.
- **Job names are versioned** (`order.confirm.v2`); a non-backward-compatible
  payload change is a new version, and the old handler stays until drained.
- **One handler per job name, one file per handler**, exported from a registry
  file mapping name to handler, schema, timeout, and attempts.

```ts
export const sendInvoiceJob = defineJob({
  name: "invoice.send.v1",
  schema: z.object({ invoiceId: z.string().uuid() }),
  timeoutMs: 30_000,
  attempts: 5,
  handler: async ({ invoiceId }, ctx) => {
    const invoice = await invoices.findById(invoiceId);
    if (!invoice || invoice.sentAt) return { skipped: true };
    await mailer.send(invoice, { idempotencyKey: ctx.jobId, signal: ctx.signal });
    await invoices.markSent(invoiceId, ctx.jobId);
    return { skipped: false };
  },
});
```

### Graceful shutdown

- **Workers handle `SIGTERM`**: stop taking new jobs, finish or checkpoint
  in-flight ones within the platform grace period, then exit 0.
- **Long jobs checkpoint progress** in the database so a resumed run continues
  instead of restarting.
- **Never exit with jobs mid-flight** without releasing locks or letting the
  visibility timeout return them to the queue.

### Cron rules

- **Schedules are in UTC**; a local-time requirement is converted in code with
  the timezone from `PROJECT.md`, never by shifting the cron expression.
- **Overlap protection is mandatory** (lock above); a run exceeding its
  interval is alerted on.
- **Catch-up policy is explicit** per cron: skip missed runs, run once, or run
  each missed slot. Default is skip.
- **No business logic in the schedule definition**: the cron entry enqueues a
  job or calls one handler; everything else is testable code.
- **Every cron is registered** in `FUNCTIONS_REGISTRY.md` ("Jobs and crons" section: name, schedule, owner,
  timeout, last reviewed), reviewed with the function registry from
  `modules/integrations.mdc`.

### Outbox pattern

- **Never write to the database and enqueue as two separate steps.** Write the
  domain change and an `outbox` row in the same transaction; a relay publishes
  outbox rows to the queue and marks them sent.
- **Outbox rows carry the job name, payload, and idempotency key**; the relay
  is itself idempotent and runs as a singleton cron or a CDC consumer.
- **Inbound webhooks go through an inbox table** the same way: persist first,
  process from the table (`modules/integrations.mdc`).

### Observability

- **Job id, job name, attempt, and queue name in every log line** (structured).
- **One span per job execution**, child spans for I/O, linked to the enqueuing
  request's trace id.
- **Metrics per queue**: depth, age of oldest message, throughput, failure
  rate, p95 duration, DLQ size. Alert on age of oldest and DLQ size.
- **No PII in payloads or logs**; ids only.

### Scheduling providers

| Provider | Use for | Non-negotiables |
|---|---|---|
| Vercel cron | Simple HTTP-triggered schedules | Handler protected by a secret header, runs under the function timeout, enqueues rather than performs long work |
| Cloudflare cron triggers / Queues | Edge schedules and queues | Declared in `wrangler.*`, `max_retries` and DLQ set, batch size explicit |
| pg_cron / Supabase | DB-local maintenance and enqueue | Function is `SECURITY DEFINER` with a fixed `search_path`, logged to a jobs table |
| BullMQ (Redis) | Application queues with workers | Redis persistence on, `removeOnComplete` bounded, lock duration above job timeout |
| Temporal / Inngest | Multi-step workflows with durable state | Deterministic workflow code, idempotent activities, versioned workflows |

### Tooling

Language toolchain per `languages/*.mdc`. Test runner with fake timers (Vitest
or Jest fake timers, `freezegun` or `time-machine`, `tokio::time::pause`).
Local queue via `docker compose` (Redis, Postgres) for integration tests. Load
testing with `k6` or `autocannon` driving the enqueue path. The project's single
check command (`make check` / `pnpm check`) runs everything below except load
and chaos tests, which run in a scheduled workflow.

## Testing

- **Unit tests of handlers** with a fake clock and mocked wrappers: happy path,
  skipped path, permanent error, transient error.
- **Idempotency tests**: run the handler twice with the same payload and assert
  one side effect and an identical end state.
- **Retry and timeout tests**: assert the backoff schedule, max attempts, DLQ
  routing, and that the abort signal cancels I/O.
- **Concurrency tests**: two workers consume the same job id simultaneously
  against a real queue in a container; exactly one side effect.
- **Lock tests**: a singleton cron with a held lock skips; an expired lock is
  reacquired.
- **Outbox tests**: transaction rollback leaves no outbox row; a relay crash
  between publish and mark-sent produces a duplicate that dedupes.
- **Chaos tests**: kill the worker mid-job (`SIGKILL`) and assert the job is
  redelivered and completes without double effects.
- **Load tests** of queue throughput and age-of-oldest at the target load in
  `PROJECT.md`; rerun quarterly (`core/maintenance.mdc`).
- **Schema tests**: invalid payloads are rejected on enqueue and routed to the
  DLQ on consume.

## Checklist when touching background job code

- [ ] Deterministic job id and dedupe key; handler is a no-op on second run
- [ ] Payload is ids only, schema-validated on enqueue and consume
- [ ] Job name versioned; old handler kept until drained
- [ ] Explicit timeout, attempts, backoff with jitter; typed permanent errors
- [ ] DLQ configured with alert; replay command documented
- [ ] Singleton cron holds a TTL lock; overlap skips and logs
- [ ] Cron in UTC, catch-up policy declared, no logic in the schedule
- [ ] DB write and enqueue share a transaction via the outbox
- [ ] Graceful shutdown drains or checkpoints in-flight work
- [ ] Job id in every log line; span per job; queue metrics and alerts wired
- [ ] Idempotency, concurrency, and retry tests present
- [ ] `FUNCTIONS_REGISTRY.md` (jobs section) and `PROJECT.md` updated
