---
description: Durable audit trail for permission changes, administrative actions, and critical business operations — event contracts, trusted actors, access, retention, and failure policy.
---

# Audit Trail

## When this applies

Activate `audit-trail` in `PROJECT.md` when the project supports sensitive
administrative, permission, or business operations. List the covered operations,
event schema, sink, owners, reader roles, retention, and failure policy there or
in its linked audit catalogue. Operational telemetry remains in
`observability.mdc`; retention/deletion follows `data-lifecycle.mdc`.

## Event contract

- Maintain a versioned, typed catalogue of audited actions. Include permission
  grants/revocations, administrative changes, impersonation, sensitive exports,
  and business operations identified as critical by the project.
- Each event includes a unique event ID, server timestamp, trusted actor identity
  and actor type, action, target type/ID, outcome, and request/operation correlation
  ID. Include tenant scope and reason code where applicable.
- Resolve actors from authenticated server context. Never trust client-provided
  `actor_id`, role, timestamp, or tenant claims without authorization checks.
- For service accounts and background jobs, record the executing service and
  originating actor/operation when known; never fabricate a human identity.
- Represent attempted, denied, failed, and completed outcomes explicitly. Do not
  record success before the authoritative operation commits.
- Record only necessary field changes from an explicit allowlist. Never serialize
  whole request bodies, entities, authentication tokens, or arbitrary exceptions.
- Secret values, passwords, session tokens, and payment credentials never enter
  audit records. Minimize personal data and restrict any necessary identifiers.

## Reliable recording

- Write successful mutation events atomically with the mutation where possible,
  or use a transactional outbox for delivery to a separate audit sink.
- Define failure policy per operation. Critical operations that require durable
  evidence must fail before mutation if neither an audit record nor an outbox
  entry can be persisted. Never commit and then pretend a logging error undid it.
- Denials and failed attempts have a durable recording path independent of the
  rolled-back business transaction. Define rate limits without silently dropping
  required evidence; alert on recording gaps or exhausted storage.
- Delivery retries are idempotent by event ID. Preserve event time and correlation
  across retries; distinguish occurrence time from ingestion time.
- Track delivery lag and failures. Reconcile committed operations/outbox entries
  with the sink; define an alert and recovery procedure in the runbook.
- Audit recording must not turn a retry of an operation into a second business
  action. Follow the operation's existing idempotency contract.

## Integrity and access

- Ordinary application roles can append authorized events but cannot edit or
  delete historical entries. Reads use dedicated, least-privilege permissions.
- Enforce tenant and role scope on every audit query and export. Access to the
  application entity does not automatically grant access to its audit history.
- Audit sensitive access to or exports of the audit trail itself using a bounded
  mechanism that does not recursively generate an event for each event write.
- Corrections append a linked correcting event; never silently rewrite history.
- Privileged retention/deletion jobs use separate credentials, restricted scope,
  and recorded execution. "Append-only" does not authorize infinite retention.
- Protect the sink from ordinary administrators where the threat model requires
  it. Document integrity guarantees and their limits; a normal table is not
  automatically tamper-proof against database administrators.
- Index approved lookup fields and paginate exports; do not expose an unbounded
  search endpoint or a public storage link to audit data.

## Lifecycle

- Specify retention and permitted readers by event category. Apply expiry to
  replicas, exports, and backups according to the data lifecycle inventory.
- Coordinate account deletion with the declared retention policy. Keep only
  necessary evidence and pseudonymize identifiers where the policy permits.
- Version schema changes compatibly so older events remain interpretable; do
  not discard history because a field or entity was renamed.
- Operational log sampling must never implicitly sample required audit events.

## Testing

- Exercise each audited operation and verify actor, target, scope, correlation,
  outcome, and allowed changes; include service actors and impersonation.
- Verify denied/failed operations are not represented as successful and rolled
  back mutations cannot leave a successful audit event.
- Simulate unavailable sinks, outbox failures, retries, duplicates, and restarts;
  assert the declared failure policy and recovery without duplicate actions.
- Test forged actor/tenant fields, unauthorized reads/exports, and attempted
  edits/deletes by normal application roles.
- Check redaction against representative secret and personal-data payloads;
  ensure sensitive fields never enter the stored event or failure logs.
- Verify retention execution, correction chains, schema compatibility, and
  alerting on delivery lag. Record commands and gates in `TEST_PLAN.md`.

## Checklist when changing sensitive operations

- [ ] Audited action and failure policy listed in the catalogue
- [ ] Actor and scope come from trusted server context
- [ ] Typed event includes target, outcome, time, and correlation
- [ ] Successful evidence and mutation are coordinated durably
- [ ] Failed attempts survive rollback; retries cannot duplicate business actions
- [ ] Secrets excluded; necessary personal data minimized and access-controlled
- [ ] Reads/exports tenant-scoped; historical events protected from normal writes
- [ ] Retention, correction, recovery, and monitoring procedures documented
- [ ] Failure, authorization, redaction, and lifecycle tests pass
