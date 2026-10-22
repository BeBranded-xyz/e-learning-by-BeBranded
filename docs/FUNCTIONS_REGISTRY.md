# Functions & Endpoints Registry

> Every serverless function, API route, server action, job, and cron in the
> project. Updated in the same PR that adds, changes, or removes one
> (`modules/integrations.mdc`). Reviewed monthly (`core/maintenance.mdc`):
> the "Called by" column must stay accurate. To remove an entry, first mark it
> `DEAD - remove by YYYY-MM-DD`, verify no callers, then delete.

Last updated: 2026-10-22

## Auth categories

| Category | Auth mechanism |
|---|---|
| client | Public key + RLS + request auth |
| service | Signed short-lived token (shared secret) |
| webhook | Signature / HMAC validation |
| internal | Not externally reachable; defensive secret in path/header |

## Functions

| Name | Path / trigger | Purpose | Called by | Auth | Status | Owner | Docs |
|---|---|---|---|---|---|---|---|
| | | None yet. The planned routes are listed in `docs/specifications/04-integration.md`, section 8. | | | | | |

## API routes / server actions

| Name | Method + path | Purpose | Called by | Auth | Status | Owner | Docs |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Webhooks (inbound)

| Provider | Path | Events | Signature scheme | Handler | Status |
|---|---|---|---|---|---|
| | | | | | |

## Jobs and crons

| Name | Schedule / queue | Purpose | Idempotency key | Timeout | Alert on | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

## Dead entries (pending removal)

| Name | Marked on | Remove by | Verified no callers | PR |
|---|---|---|---|---|
| | | | | |
