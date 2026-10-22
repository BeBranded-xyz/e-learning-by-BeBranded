---
description: Persistent data lifecycle — ownership, retention, archival, deletion propagation, external copies, and safe restores. Activate for projects storing user or business data.
---

# Data Lifecycle

## When this applies

Apply when storing persistent user or business data, including uploaded files,
exports, search/vector indexes, analytics copies, and data sent to processors.
Activate `data-lifecycle` in `PROJECT.md`. Concrete durations, owners, stores,
exceptions, and procedures belong in that file or its linked inventory.
Security controls remain in `core/security.mdc`; backup mechanisms are covered
by `infra.mdc`; durable cleanup workers follow `background-jobs.mdc`.

## Inventory and ownership

- Every data category has an owner, purpose, authoritative store, dependent
  copies, retention period, and a deletion or anonymization procedure.
- Inventory all copies: database rows, object storage, caches, search/vector
  indexes, exports, event streams, third-party processors, and backups.
- New stores and integrations update the inventory in the same change. A copy
  without a documented lifecycle must not silently become permanent storage.
- Define retention from an explicit event (creation, last activity, closure),
  including timezone and cutoff semantics. Never use "keep forever" by default.
- Document approved retention exceptions and holds, their scope, owner, and
  review date. The agent does not invent legal or contractual retention periods.

## Retention and archival

- Enforce retention with scheduled, observable jobs. Set batch limits, retry
  behavior, and completion deadlines; alert on overdue deletion or archival.
- Archival preserves only necessary data, with restricted access and its own
  expiration. Moving records to another table does not complete deletion.
- Soft deletion is a product state, not proof of erasure. Define when tombstoned
  rows and associated objects are physically removed or irreversibly anonymized.
- Anonymization must account for indirect identifiers and linked copies; simple
  hashing of identifiers is not automatically irreversible anonymization.
- Preview and test environments use synthetic fixtures. Production copies must
  never enter them as an undocumented shortcut.

## Deletion workflow

- Authorize deletion against a trusted identity and ownership boundary. A user
  or tenant cannot request deletion of another's data by supplying its identifier.
- Record a durable request identifier, scope, status, deadline, and progress.
  Return accepted/pending until all required stores have acknowledged completion.
- Stop new writes and synchronization that could recreate the deleted data;
  coordinate with in-flight jobs, event consumers, and concurrent requests.
- Propagate removal to dependent rows, files, caches, indexes, exports under
  application control, and external processors. Track each destination separately.
- Use idempotent steps with bounded retries, resumable progress, and reconciliation.
  A partial failure must remain visible and retryable, never become false success.
- Retain only the minimal completion evidence needed by the declared policy;
  do not preserve the deleted payload in the deletion record or operational logs.
- Document copies outside application control and the applicable handling
  procedure. Do not promise removal from destinations the system cannot verify.

## Backups and restores

- Backups have a documented expiration and access policy. Explain any delay
  between removal from live stores and expiration from immutable backups.
- Keep minimal deletion markers for the relevant restore window, access-controlled
  and subject to their own retention, so a restore cannot resurrect deleted data.
- Apply deletion markers and retention cutoffs after a restore and before exposing
  restored data to users or restarting integrations and workers.
- A hold or exception must identify which data remains, why, who can access it,
  and when it is reviewed. Do not silently exempt the whole account.
- Test restore and purge procedures using synthetic data in isolated environments.

## Testing

- Verify retention immediately before, at, and after the cutoff with a controlled
  clock, including the timezone semantics declared in the inventory.
- Test authorization across users and tenants and rejection of forged scope.
- Exercise deletion across the real local database, object store, cache, and
  indexes used by the project; verify that no dependent application copy remains.
- Simulate processor failures, retries, duplicate requests, and interrupted jobs;
  assert resumability and accurate pending/failed/completed states.
- Test concurrent writes, delayed events, and synchronization after deletion to
  prove they cannot recreate data marked for removal.
- Restore a synthetic backup containing removed records; verify the deletion
  markers run before restored data becomes accessible.
- Test scoped holds, archival expiry, and minimal/redacted completion evidence.
- Record commands, coverage, and scheduled verification in `TEST_PLAN.md`.

## Checklist when changing persistent data

- [ ] Category, owner, copies, retention trigger, duration, and deadline documented
- [ ] New stores and processors included in the lifecycle inventory
- [ ] Archival and soft deletion have explicit final removal semantics
- [ ] Authorized deletion is durable, idempotent, resumable, and observable
- [ ] Dependent copies and delayed writes cannot leave or recreate orphan data
- [ ] Partial failure remains visible; completion reflects actual acknowledgements
- [ ] Backup expiry and restore deletion markers documented and tested
- [ ] Exceptions scoped, owned, dated, and reviewed
- [ ] Tests cover cutoffs, cross-user isolation, retries, races, and restore
