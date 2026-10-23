# 04 — Host integration

This document describes the **contract** between the module and the product that embeds it. It boils down to five ports (identity, storage, video, files, events), plus route mounting and theming.

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

export const { GET, POST, PATCH, DELETE } = createElearningRouteHandler(elearning);
```

Components are Client Components: the page that renders them can stay a Server Component. Links point to the host's own routes through `courseHref` and `lessonHref`.

```tsx
// app/training/[courseSlug]/page.tsx
import { ElearningProvider, CoursePage } from "@bebranded/elearning-react";
import "@bebranded/elearning-react/styles.css";

export default function Page({ params }) {
  return (
    <ElearningProvider apiBase="/api/elearning" theme={hostTheme} locale="en">
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
  createDirectUpload(input: { maxDurationSeconds: number }): Promise<{ uploadUrl: string; assetId: string }>;
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

- The server enforces an **allowlist of MIME types** (images, PDF by default) and a **maximum size** before issuing an upload URL.
- Files are served through short-lived signed URLs, so a private bucket works.
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

## 6. Branding and theming

Every component reads **CSS custom properties** prefixed with `--el-`. The host sets them globally or through the `theme` prop of `<ElearningProvider>`.

```ts
const hostTheme = {
  colors: {
    primary: "#5B3DF5",
    primaryForeground: "#FFFFFF",
    background: "#FFFFFF",
    surface: "#F7F7F9",
    text: "#111111",
    muted: "#6B7280",
    success: "#16A34A",
    danger: "#DC2626",
    border: "#E5E7EB",
  },
  radius: "8px",
  fontFamily: "inherit",
  darkMode: "media", // "media" | "class" | "off"
};
```

- **No imposed CSS dependency.** Styles ship as plain CSS with low specificity (`:where()`), so the host can override them.
- The BlockNote editor and the rendered lesson content are themed with the same tokens.
- **Headless** mode: every component also exposes a hook (`useCourse`, `useLessonPlayer`, `useQuiz`…), so the host can rebuild the UI with its own design system.
- Override slots (`components={{ LessonHeader: MyHeader }}`) let the host replace a part without rewriting everything.
- An optional Tailwind preset maps the `--el-*` tokens to the host's tokens.

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
| POST | `/v1/admin/videos/uploads` | `{ lesson_id, max_duration_seconds }`: a one-time direct upload URL; uploading again replaces the lesson's video |
| POST | `/v1/admin/reorder` | `{ course_id, chapters: [{ id, lesson_ids }] }`: the full new order of one owned course. Chapters and lessons are renumbered from 0 and lessons may move between chapters of the course, in one transaction. The body must name every chapter and lesson of the course exactly once: an unknown or missing id answers 409 `tree_out_of_date` (reload and retry), a repeated id 400. Answers the course tree. A moved lesson inherits its new chapter's access rules |
| POST | `/v1/admin/access-rules` | Rule on an owned course, chapter or lesson |
| DELETE | `/v1/admin/access-rules/:id` | Remove a rule |
| POST | `/v1/admin/assignments` | `{ course_id, audience, due_at? }`: assign a course of the tenant or of the shared catalog to a `role`, a `grade_min` or a `learner` (`{ type: "learner", learner_id }`). 409 `audience_without_access` when the course rules do not let that audience in (spec 05). A learner is enrolled at once (`source: assigned`, taking over an existing enrollment and keeping its progress); a role or grade enrolls matching learners on their next visit (`source: auto`, never changing an existing enrollment). Emits `enrollment.assigned` per enrolled learner. 201, or 200 when the same audience was already assigned (the due date is updated) |
| GET | `/v1/admin/courses/:id/assignments` | The tenant's assignments of a readable course |
| DELETE | `/v1/admin/assignments/:id` | Remove an assignment; the enrollments it created are kept |

Publishing a course, chapter or lesson emits `content.published` once. Admins only write their own tenant's content: shared-catalog and other tenants' content answers 404. Then extra quiz attempts in phase 4. Plus `POST /v1/admin/files/uploads` (editor images and attachments) and `GET /v1/admin/reports/*` (tracking per course or per learner, CSV export).

**System**

`POST /v1/webhooks/video` receives the video provider's webhooks. It needs no learner session and no `Origin`: the provider's signature authenticates it (401 `invalid_signature` otherwise, logged as an error). Verified events are answered 200, even for unknown assets, so the provider stops retrying. A late `processing` event never moves a ready video back.

**Errors**

Every input is validated with Zod. Every error uses one envelope, `{ "error": { "code", "message", "details"?, "request_id" } }`, and the response carries the same `X-Request-Id`. Messages never include stack traces, SQL or internal identifiers; 5xx answers always say `internal_error`.

| Status | Codes |
|--------|-------|
| 400 | `validation_failed`, `invalid_json`, `invalid_content`, `invalid_settings` |
| 401 | `unauthenticated`, `invalid_signature` (video webhook) |
| 403 | `forbidden` (admin route without `isAdmin`), `origin_not_allowed` (CSRF check) |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 409 | `completion_not_manual` (a video or quiz lesson cannot be marked as done), `slug_taken`, `not_a_video_lesson`, `video_not_ready`, `video_asset_in_use`, `not_a_quiz_lesson`, `quiz_not_ready`, `attempts_exhausted`, `quiz_changed` (the quiz was edited while the attempt was open; the attempt is voided), `quiz_attempt_open` |
| 413 | `payload_too_large` |
| 429 | `cooldown` (with `Retry-After` and `details.next_attempt_at`) |
| 415 | `unsupported_media_type` |
| 500 | `internal_error` |
