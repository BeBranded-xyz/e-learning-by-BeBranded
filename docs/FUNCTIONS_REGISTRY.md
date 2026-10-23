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
| `listAdminCourses` | GET `/v1/admin/courses` | All courses of the tenant and the shared catalog | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `createCourse` | POST `/v1/admin/courses` | Create a draft course | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `getAdminCourse` | GET `/v1/admin/courses/:id` | Course tree with drafts and rules | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `updateCourse` | PATCH `/v1/admin/courses/:id` | Edit or publish a course | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `deleteCourse` | DELETE `/v1/admin/courses/:id` | Delete a course and its tree | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `createChapter` | POST `/v1/admin/chapters` | Create a chapter | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `updateChapter` | PATCH `/v1/admin/chapters/:id` | Edit or publish a chapter | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `deleteChapter` | DELETE `/v1/admin/chapters/:id` | Delete a chapter and its lessons | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `createLesson` | POST `/v1/admin/lessons` | Create a text lesson (validated content) | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `getAdminLesson` | GET `/v1/admin/lessons/:id` | Lesson with its stored document | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `updateLesson` | PATCH `/v1/admin/lessons/:id` | Edit or publish a lesson | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `deleteLesson` | DELETE `/v1/admin/lessons/:id` | Delete a lesson | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `createAccessRule` | POST `/v1/admin/access-rules` | Add an audience rule | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |
| `deleteAccessRule` | DELETE `/v1/admin/access-rules/:id` | Remove an audience rule | `@bebranded/elearning-admin` (phase 4), host scripts | client, `isAdmin` | active | maintainers | spec 04, section 8 |

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
