# Functions & Endpoints Registry

> Every serverless function, API route, server action, job, and cron in the
> project. Updated in the same PR that adds, changes, or removes one
> (`modules/integrations.mdc`). Reviewed monthly (`core/maintenance.mdc`):
> the "Called by" column must stay accurate. To remove an entry, first mark it
> `DEAD - remove by YYYY-MM-DD`, verify no callers, then delete.

Last updated: 2026-10-23

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
| `deliverEvents` | `elearning.deliverEvents()`, called by the host | Delivers outbox events to the host's handlers, with backoff | Host job or after-request hook | internal | active | maintainers | spec 04, section 5 |

## API routes / server actions

Paths are relative to the host's mount point. Auth: `client` = the host's session, resolved by `IdentityResolver` on every request.

| Name | Method + path | Purpose | Called by | Auth | Status | Owner | Docs |
|---|---|---|---|---|---|---|---|
| `listCatalog` | GET `/v1/courses` | Visible courses with enrollment | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |
| `getCourse` | GET `/v1/courses/:slug` | Visible course tree with progress | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |
| `enroll` | POST `/v1/courses/:id/enroll` | Self-enrollment | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |
| `getLesson` | GET `/v1/lessons/:id` | Lesson HTML and status | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |
| `startLesson` | POST `/v1/lessons/:id/start` | Lesson opened | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |
| `completeLesson` | POST `/v1/lessons/:id/complete` | Text lesson done | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |
| `myProgress` | GET `/v1/me/progress` | Learner's enrollments | `@bebranded/elearning-react` | client | active | maintainers | spec 04, section 8 |

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
