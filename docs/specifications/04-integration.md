# 04 — Host integration

This document describes the **contract** between the module and the product that embeds it. It boils down to five ports (identity, storage, video, files, events), plus route mounting and theming.

Last updated: 2026-10-25

## Integration example (Next.js App Router)

```ts
// lib/elearning.ts — server-only
import "server-only";
import { createElearning } from "@bebranded/elearning-server";
import { postgresStorage } from "@bebranded/elearning-db";
import { cloudflareStream } from "@bebranded/elearning-video";
import { getSession } from "@/lib/auth"; // host auth
import { fileStorage } from "@/lib/storage"; // host file storage (S3, R2, Supabase Storage…)

export const elearning = createElearning({
  // All secrets come from environment variables, never from source code.
  storage: postgresStorage({
    connectionString: process.env.ELEARNING_DATABASE_URL!, // host DB or dedicated DB
    schema: "elearning",
  }),
  video: cloudflareStream({
    accountId: process.env.CF_ACCOUNT_ID!,
    apiToken: process.env.CF_STREAM_API_TOKEN!,
    signingKeyId: process.env.CF_STREAM_SIGNING_KEY_ID!,
    signingKey: process.env.CF_STREAM_SIGNING_KEY!,
    webhookSecret: process.env.CF_STREAM_WEBHOOK_SECRET!,
  }),
  files: fileStorage,
  identity: async (request) => {
    const session = await getSession(request);
    if (!session) return null;
    return {
      learnerId: session.user.id,
      tenantId: session.user.companyId,  // null for single-tenant hosts
      roles: session.user.roles,         // e.g. ["employee", "manager"]
      grade: session.user.grade,         // e.g. 3 (optional)
      isAdmin: session.user.roles.includes("training_admin"),
      displayName: session.user.name,
      locale: session.user.locale,
    };
  },
  events: {
    "course.completed": async (e) => { /* e.g. issue a certificate in the ERP */ },
  },
});
```

```ts
// app/api/elearning/[...path]/route.ts
import { createElearningRouteHandler } from "@bebranded/elearning-next";
import { elearning } from "@/lib/elearning";

export const { GET, POST, PATCH, PUT, DELETE } = createElearningRouteHandler(elearning);
```

Components are Client Components: the page that renders them can stay a Server Component. Links point to the host's own routes through `courseHref` and `lessonHref`.

Hosts that switch identity without a full page reload pass an opaque `sessionKey`
to `ElearningProvider` (and `ElearningAdminProvider`). It changes on login, logout,
tenant switches and permission changes. Changing this key or `apiBase` remounts
the query cache and child state and cancels old queries; late responses cannot
populate the new session. The key contains no token or personal data. Omitting
it is supported for hosts whose identity is fixed for the lifetime of the provider.

```tsx
// app/training/[courseSlug]/page.tsx
import { ElearningProvider, CoursePage } from "@bebranded/elearning-react";
import "@bebranded/elearning-react/styles.css";

export default function Page({ params }) {
  return (
    <ElearningProvider apiBase="/api/elearning" design={design} ui={hostKit} locale="en">
      <CoursePage slug={params.courseSlug} lessonHref={(lesson) => `/training/${params.courseSlug}/${lesson.id}`} />
    </ElearningProvider>
  );
}
```

The module ships an `.env.example` listing every variable name with empty values. Real values belong to the host's secret management (Vercel environment variables, Doppler, etc.).

## 1. Identity: `IdentityResolver`

```ts
type IdentityResolver = (request: Request) => Promise<Learner | null>;

interface Learner {
  learnerId: string;        // opaque, stable identifier in the host
  tenantId: string | null;
  roles: string[];          // host roles, used as is by access rules
  grade?: number | null;    // ordered hierarchy or skill level
  isAdmin: boolean;         // back-office access
  displayName?: string;
  locale?: string;
}
```

- Called **on every request** and never cached by the module. The host stays in control of revocation.
- `null` → 401.
- The module stores **no personal data** beyond `learner_id` (plus an optional cached `display_name` for the admin view, which can be disabled).
- To show names and emails in the tracking dashboard, the host can optionally provide `resolveLearners(ids) → LearnerProfile[]`.

## 2. Data modes

The **same migrations** and the **same schema** serve both modes. Only the connection changes.

| | Mode A: embedded database | Mode B: dedicated database |
|---|---|---|
| Where | `elearning` schema in the host product's Postgres / Supabase database | Postgres database or Supabase project of its own |
| When to choose it | Default. Allows SQL joins between host data and progress (ERP reporting). | The host is not on Postgres, training data must be isolated, or several products share one catalog. |
| User link | Optional FK from `learner_id` to the host's users table | No FK. `learner_id` is opaque. |
| Transactions | Can share the host's transaction (`storage.withTransaction(hostTx)`) | Independent |
| Migrations | `pnpm elearning migrate --schema elearning` in the host pipeline | Same, against the dedicated database |

With Supabase in mode A, the `elearning` schema is **not exposed** through PostgREST by default: access goes through the server handlers. Direct exposure with RLS policies is a documented opt-in (see [05 — Permissions](05-permissions.md#rls)).

## 3. Video: `VideoProvider`

```ts
interface VideoProvider {
  createDirectUpload(input: { maxDurationSeconds: number; sizeBytes?: number }): Promise<{ uploadUrl: string; assetId: string; protocol: "form" | "tus" }>;
  getAsset(assetId: string): Promise<{ status: AssetStatus; durationSeconds: number | null; thumbnailUrl: string | null }>;
  createPlaybackToken(assetId: string, opts: { learnerId: string; ttlSeconds: number }): Promise<PlaybackSource>;
  deleteAsset(assetId: string): Promise<void>;
  verifyWebhook(request: Request): Promise<VideoWebhookEvent | null>;
}
```

`assetId` is always the provider's identifier, never the module's `video_assets.id`. `createPlaybackToken` returns a `PlaybackSource` (`{ type: "hls", url, expiresAt }`), and `verifyWebhook` returns `null` when the signature or timestamp is invalid. The types live in `elearning-core`.

Details in [06 — Video](06-video.md).

## 4. Files: `FileStorage`

Images and attachments inserted in the editor go through a port implemented by the host:

```ts
interface FileStorage {
  createUpload(input: { tenantId: string | null; mimeType: string; sizeBytes: number }): Promise<{ uploadUrl: string; key: string }>;
  getReadUrl(key: string, opts: { ttlSeconds: number }): Promise<string>;
  delete(key: string): Promise<void>;
}
```

- The server enforces an **allowlist of MIME types** (PNG, JPEG, GIF, WebP and PDF by default; `fileUploads.mimeTypes`) and a **maximum size** (10 MB by default; `fileUploads.maxBytes`) before issuing an upload URL. Types a browser runs as a page (SVG, HTML, XHTML) cannot be allowed.
- The browser sends the file with an HTTP `PUT` to the upload URL, with the file's `Content-Type`. The module stores the key in `files` and the document points to the file as `elearning-file:<id>`.
- Saving a lesson or a quiz checks that every file it points to was uploaded by the admin's tenant (400 `invalid_content`, issue `unknown_file`).
- Files are served through short-lived signed URLs (1 hour), so a private bucket works. They are signed when a lesson or a quiz attempt is rendered; a file that cannot be signed is left out and logged as a warning.
- Ready-made adapters are planned for S3-compatible storage (AWS S3, Cloudflare R2) and Supabase Storage.

## 5. Events: `EventSink`

The module emits business events. The host subscribes to them to trigger its own actions: certificates, notifications, HR record updates in the ERP, etc.

| Event | Main payload |
|-------|--------------|
| `lesson.started` | learnerId, lessonId, courseId |
| `lesson.completed` | learnerId, lessonId, courseId |
| `quiz.attempt_submitted` | learnerId, lessonId, courseId, attemptId, attemptNumber, outcome (`graded` \| `expired`), score, passed |
| `course.started` | learnerId, courseId |
| `course.completed` | learnerId, courseId, completedAt |
| `enrollment.assigned` | learnerId, courseId, assignedBy, dueAt |
| `content.published` | targetType, targetId |

- Events are written to `event_outbox` **in the same transaction** as the state change, then delivered to the handlers (at least once, with retries and backoff). Host handlers must be **idempotent** (every event has an `id`).
- Delivery can be in-process (function) or through a signed HTTP webhook (HMAC), depending on configuration.
- The in-process relay claims one event immediately before delivery with a 60 s
  lease. A handler receives `{ signal }` as its second argument and has a 30 s
  deadline; it must propagate cancellation to its I/O. An expired handler is
  retried with backoff. The storage acknowledgement includes `{ id, attempts }`,
  so a stale worker cannot overwrite a newer claim. Delivery remains at least
  once: cancellation cannot undo external side effects, which hosts deduplicate
  by event id. Custom storage adapters must implement this fencing contract.

## 6. Branding and theming

One design file (`elearning.design.ts`, validated by `defineDesign`) declares colors in light and dark, fonts, radius and brand, and drives the learner UI, the back-office and the exports. The module draws its buttons, cards, fields, badges, alerts, progress bars and tables through a swappable UI kit; shadcn/ui is the first kit. See [11 — Design system](11-design-system.md).

- **No imposed CSS dependency.** The packages ship plain CSS in the `elearning` cascade layer, with low specificity (`:where()`), driven by `--el-*` variables, so any host CSS wins. A Tailwind host orders the layers: `@layer theme, base, elearning, components, utilities;`.
- The BlockNote editor and the rendered lesson content are themed with the same variables.
- **Headless** mode: every component also exposes a hook (`useCourse`, `useLessonPlayer`, `useQuiz`…), so the host can rebuild the UI with its own design system.

## 7. i18n

- UI strings in en and fr, extensible through `messages` in the provider.
- Course content is single-language per course (the `locale` field). Multiple languages within one course are out of scope for v1.

## 8. API surface

All routes are relative to the mount point (e.g. `/api/elearning`) and versioned with a `/v1` prefix. `/v1/admin/*` routes require `isAdmin`. Request and response bodies are JSON with `snake_case` fields and ISO 8601 UTC dates; collections are wrapped as `{ "data": [...], "next_cursor": null }`. `GET` never changes state, with one exception: the catalog, a course page and My training first turn the learner's pending course assignments into enrollments (spec 05), which is idempotent.

**Learner**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/v1/courses` | Catalog filtered by access rules, with the learner's enrollment |
| GET | `/v1/courses/:slug` | Accessible chapters › lessons tree, with lesson statuses and progress |
| POST | `/v1/courses/:id/enroll` | Self-enroll (201, or 200 when already enrolled) |
| GET | `/v1/lessons/:id` | Lesson rendered to HTML, settings with defaults filled; for a video lesson, `video` with status, duration, captions, a signed `playback` URL once ready, and the learner's progress (resume position, watched ranges); for a quiz lesson, `quiz` with its rules and the learner's standing (attempts used and remaining, next attempt time, best score, `passed`, open attempt), never a question |
| POST | `/v1/lessons/:id/start` | Record that the learner opened the lesson (enrolls on first start in a self-enroll course) |
| POST | `/v1/lessons/:id/complete` | Mark a text lesson as done |
| POST | `/v1/lessons/:id/video-progress` | Video heartbeat: `{ session_id, seq, ranges, position, playback_rate }`. Answers `{ accepted, status, progress }`; `accepted` is false for a replayed `seq`. Completes the lesson at its threshold |
| POST | `/v1/lessons/:id/quiz/attempts` | Open an attempt (201), or resume the open one (200): `{ id, attempt_number, started_at, expires_at, survey }`, where `survey` is SurveyJS JSON without answers ([07](07-quizzes.md#security-correct-answers-never-reach-the-client)) |
| POST | `/v1/lessons/:id/quiz/attempts/:attemptId/submit` | `{ answers }` in SurveyJS shape. Answers `{ outcome, score, passed, points_earned, points_possible, status, best_score, attempts_remaining, next_attempt_at, corrections }`; a passing attempt completes the lesson. A retried submission gets the stored result |
| GET | `/v1/me/progress` | Learner dashboard ("My training") |
| GET | `/v1/lessons/:id/export?format=pdf\|docx` | The lesson as a PDF or Word attachment ([10](10-editor-extensions.md#export)); learners only when the course has `allow_learner_export`, admins always, drafts included |
| GET | `/v1/courses/:id/export?format=pdf\|docx` | The course: cover, contents, then every lesson the requester can open (the whole tree for admins) |

Content the learner cannot see answers **404, exactly like content that does not exist**, so ids reveal nothing. An assignment-only course stays invisible until the learner is assigned.

**Admin**

| Method | Route | Purpose |
|--------|-------|---------|
| GET, POST | `/v1/admin/courses` | List (tenant and shared catalog, with `editable`), create a draft |
| GET, PATCH, DELETE | `/v1/admin/courses/:id` | Tree with drafts and rules; edit or publish (`published_at` set once); delete with its tree |
| POST | `/v1/admin/chapters` | Create in an owned course |
| PATCH, DELETE | `/v1/admin/chapters/:id` | Edit or publish; delete with its lessons |
| POST | `/v1/admin/lessons` | Create a text, video or quiz lesson; content and settings validated against the type. Video and quiz lessons start as drafts |
| GET, PATCH, DELETE | `/v1/admin/lessons/:id` | Stored document and video for the editor; edit or publish (a video lesson only once its video is ready, a quiz lesson once its questions are saved); delete |
| GET, PUT | `/v1/admin/lessons/:id/quiz` | The quiz editor document, its version and `learners_attempted` (the edit warning); `PUT { document }` validates it and derives the graded definition |
| GET, POST | `/v1/admin/lessons/:id/quiz/attempt-grants` | List the tenant's grants (`?learner_id=` for one learner); `{ learner_id, extra_attempts }` grants 1 to 100 extra attempts and answers the grant with the learner's `attempts_used` and `attempts_remaining` (spec 07) |
| POST | `/v1/admin/videos/uploads` | `{ lesson_id, max_duration_seconds, size_bytes? }`: a one-time direct upload URL and its `upload_protocol` (`form`, or `tus` for files over 200 MB); uploading again replaces the lesson's video |
| POST | `/v1/admin/reorder` | `{ course_id, chapters: [{ id, lesson_ids }] }`: the full new order of one owned course. Chapters and lessons are renumbered from 0 and lessons may move between chapters of the course, in one transaction. The body must name every chapter and lesson of the course exactly once: an unknown or missing id answers 409 `tree_out_of_date` (reload and retry), a repeated id 400. Answers the course tree. A moved lesson inherits its new chapter's access rules |
| POST | `/v1/admin/files/uploads` | `{ mime_type, size_bytes }`: `{ file: { id, url, mime_type, size_bytes, created_at }, upload: { url, method: "PUT", headers } }` for an editor image or attachment; 415 `file_type_not_allowed`, 413 `file_too_large` |
| GET | `/v1/admin/files/:id` | The file with a signed `read_url` and `read_url_expires_at`, for the editor |
| POST | `/v1/admin/access-rules` | Rule on an owned course, chapter or lesson |
| DELETE | `/v1/admin/access-rules/:id` | Remove a rule |
| POST | `/v1/admin/assignments` | `{ course_id, audience, due_at? }`: assign a course of the tenant or of the shared catalog to a `role`, a `grade_min` or a `learner` (`{ type: "learner", learner_id }`). 409 `audience_without_access` when the course rules do not let that audience in (spec 05). A learner is enrolled at once (`source: assigned`, taking over an existing enrollment and keeping its progress); a role or grade enrolls matching learners on their next visit (`source: auto`, never changing an existing enrollment). Emits `enrollment.assigned` per enrolled learner. 201, or 200 when the same audience was already assigned (the due date is updated) |
| GET | `/v1/admin/courses/:id/assignments` | The tenant's assignments of a readable course |
| DELETE | `/v1/admin/assignments/:id` | Remove an assignment; the enrollments it created are kept |
| GET | `/v1/admin/reports/courses/:id` | Tracking of a readable course for the tenant's learners: `{ course, summary: { enrolled, started, completed, overdue, average_progress }, data: [enrollment rows] }`. A row is overdue past its due date while not completed |
| GET | `/v1/admin/reports/learners/:learnerId` | One learner's enrollments in the tenant, with course titles, and the same summary |
| GET | `/v1/admin/reports/quizzes/:lessonId` | Quiz reporting ([07](07-quizzes.md#reporting)) |

Publishing a course, chapter or lesson emits `content.published` once. Admins only write their own tenant's content: shared-catalog and other tenants' content answers 404.

**System**

`POST /v1/webhooks/video` receives the video provider's webhooks. It needs no learner session and no `Origin`: the provider's signature authenticates it (401 `invalid_signature` otherwise, logged as an error). Verified events are answered 200, even for unknown assets, so the provider stops retrying. A late `processing` event never moves a ready video back.

Every report also downloads as CSV with `?format=csv` (`text/csv`, RFC 4180, an attachment, never cached). Text cells that a spreadsheet would run as a formula (starting with `=`, `+`, `-`, `@`, tab or carriage return) are prefixed with `'`. Reports only list the module's opaque `learner_id`; names come from the host.

**Errors**

Every input is validated with Zod. Every error uses one envelope, `{ "error": { "code", "message", "details"?, "request_id" } }`, and the response carries the same `X-Request-Id`. Messages never include stack traces, SQL or internal identifiers; 5xx answers always say `internal_error`.

| Status | Codes |
|--------|-------|
| 400 | `validation_failed`, `invalid_json`, `invalid_content`, `invalid_settings`, `export_format_unavailable`, `export_too_large` |
| 401 | `unauthenticated`, `invalid_signature` (video webhook) |
| 403 | `forbidden` (admin route without `isAdmin`), `origin_not_allowed` (CSRF check), `export_not_allowed` |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 409 | `export_not_configured`, `completion_not_manual` (a video or quiz lesson cannot be marked as done), `slug_taken`, `not_a_video_lesson`, `video_not_ready`, `video_asset_in_use`, `not_a_quiz_lesson`, `quiz_not_ready`, `attempts_exhausted`, `quiz_changed` (the quiz was edited while the attempt was open; the attempt is voided), `quiz_attempt_open` |
| 413 | `payload_too_large`, `file_too_large` |
| 429 | `cooldown` (with `Retry-After` and `details.next_attempt_at`), `export_busy` |
| 415 | `unsupported_media_type`, `file_type_not_allowed` |
| 500 | `internal_error` |
| 502 | `export_timeout` |

## Demo shell and localization

The demonstration opens directly as the learner persona. A compact toolbar shows
“Learning by BeBranded” on the left, role and language selectors, then the
BeBranded website link and an accessible icon-only GitHub link at the right edge.
Controls wrap on small screens. The legacy `/sign-in` URL redirects to the catalog.
Explicit signed-out and invalid persona cookies resolve to no identity.

English and French cover the shell, learner components, back-office and editor.
The demo follows the browser language on first visit and stores an explicit choice
in a cookie; locale changes preserve the current route and persona. Host products
pass their locale to `ElearningProvider` / `AdminProvider`; UI kits and templates
receive localized labels from those providers. Course content has an independent
`locale`: changing interface language does not machine-translate authored lessons.
The seed includes a French course and two locally served, attributed video excerpts
with the same verified-progress path as provider videos (see the root README).

Validated toolbar screenshots: [desktop](../screenshots/demo-desktop.png) and
[mobile](../screenshots/demo-mobile.png). The native BlockNote menus use the locale
at editor creation. An in-place language switch preserves the current unsaved
document; native menus adopt the new locale when the editor next opens (live
dictionary replacement is tracked in B-080).

## Course authoring workspace

The back-office provides a persistent left navigation and a course outline. The
hierarchy is course → chapters → lessons (the parts of a chapter). Whole course
and lesson cards are links; chapter cards disclose their lessons and editing
controls with a keyboard-operable button. Creation actions identify what they add.

A course workspace separates Structure, Settings, Completion, Access, Tracking and
Preview using linked keyboard-accessible tabs. The demo creates courses on
`/admin/courses/new` with title, slug, summary, language and enrollment mode;
new courses remain drafts with no implicit access grant. Reusable catalogs and
sidebars accept `createHref`; omitting it retains inline creation. Section navigation is reflected in the host URL. Settings include course
language and enrollment mode; access explains default deny, inheritance and the
difference between visibility and assignment. Chapters can be renamed, ordered,
published and given their own audience rules. Lessons have content, validation,
access and preview views with links back to the course outline.

Course completion is either all accessible required lessons or a configurable
percentage of accessible required lessons (1–100%). Optional or inaccessible
lessons do not enter that denominator; a course with zero counted lessons never
completes. Recorded completion dates remain final. Text lessons can require scroll
to end; videos expose watched percentage, seeking, playback speed and background
pause; quizzes expose passing score, attempts, cooldown, time limit and correction
policy. These settings use the existing server-validated schemas.

GET /v1/admin/lessons/:id/preview returns sanitized saved content, optional signed
video playback and an answer-free quiz survey, including drafts. It is admin-only,
tenant-scoped and read-only: no enrollment, viewing heartbeat or quiz attempt is
created. Preview clearly labels saved content and provides desktop/mobile widths.
It reuses learner content, video and quiz rendering. Unsaved edits are explicitly
saved before refreshing preview; preview never publishes content or simulates
permission eligibility. Access remains configured and enforced separately.

The demo supplies a bounded local video upload provider so authors can upload and
preview real media without a provider account. Uploads require the demo admin,
same-origin requests and a signed, expiring one-time URL, enforce a size limit,
and are transcoded with a deadline. Media is stored with the demo's persistent
uploaded files; provider metadata and ready status are saved through the module's
storage boundary. The runtime image includes the encoder for this demo adapter.

## Demo feedback widget

The demo root layout optionally loads the supplied Dashly widget script from
`https://app.usedashly.com/widget/v1.js` asynchronously after hydration. One
script instance is mounted per document across learner, administration and
sign-in screens. The vendor widget provides the feedback/help launcher.
`DEMO_DASHLY_WIDGET_KEY` configures its public embed identifier at runtime;
it is omitted when unset or blank and malformed identifiers fail validation.
The real workspace identifier stays in private hosting configuration, never
in this public repository. Published packages do not include this integration.
An unavailable vendor script must not block the demo. Browser tests intercept
the widget with a synthetic identifier and never submit external tickets.
