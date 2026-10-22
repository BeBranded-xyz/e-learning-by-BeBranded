# 03 — Data model

All tables live in a **dedicated PostgreSQL schema**, `elearning` by default (configurable). This holds whether the schema sits in the host product's database or in a dedicated one (see [04 — Integration](04-integration.md#2-data-modes)).

## Conventions

- `uuid` primary keys (`gen_random_uuid()`).
- `created_at` / `updated_at` as `timestamptz` on every table.
- **`tenant_id text null`** on every content and progress table. It serves multi-company hosts (an ERP serving several companies). It stays `null` for single-tenant hosts.
- **`learner_id text not null`** is the opaque identifier of the user in the host product. There is **no foreign key** to the host's users table, so a dedicated database works. In embedded mode, the host may add an FK if it wants to.
- Ordering positions (`position`) are integers. Reordering runs in a single transaction.

## Schema

```mermaid
erDiagram
  courses ||--o{ chapters : contains
  chapters ||--o{ lessons : contains
  lessons ||--o| video_assets : "video"
  lessons ||--o| quizzes : "quiz"
  courses ||--o{ access_rules : "restricted by"
  chapters ||--o{ access_rules : "restricted by"
  lessons ||--o{ access_rules : "restricted by"
  courses ||--o{ enrollments : ""
  lessons ||--o{ lesson_progress : ""
  lesson_progress ||--o| video_progress : ""
  quizzes ||--o{ quiz_attempts : ""
```

### Content

**`courses`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | text null | |
| slug | text | unique per tenant |
| title | text | |
| summary | text null | |
| cover_image_url | text null | |
| status | enum `draft` \| `published` \| `archived` | |
| published_at | timestamptz null | |
| completion_rule | jsonb | e.g. `{ "type": "all_required_lessons" }` |
| locale | text | `en`, `fr`… |
| metadata | jsonb | free-form field for the host |

**`chapters`**: `id`, `course_id` FK, `title`, `position`, `status`.

**`lessons`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| chapter_id | uuid FK | |
| type | enum `text` \| `video` \| `quiz` | |
| title | text | |
| position | int | |
| status | enum `draft` \| `published` | |
| is_required | bool | counts toward course completion (default `true`) |
| estimated_minutes | int null | |
| content | jsonb null | **BlockNote document** (array of blocks). Main body for `text` lessons, accompanying notes for `video` and `quiz`. Validated against the module's block schema before writing. |
| content_schema_version | int | version of the block schema used, for future content migrations |
| settings | jsonb | e.g. video: `{ "completionThreshold": 0.95, "allowSeeking": false, "maxPlaybackRate": 2 }` |

**`video_assets`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| lesson_id | uuid FK unique | |
| provider | text | `cloudflare-stream`, `mux`, `bunny` |
| provider_asset_id | text | |
| status | enum `uploading` \| `processing` \| `ready` \| `error` | updated by webhook |
| duration_seconds | numeric null | **source of truth** for coverage. Comes from the provider, never from the client. |
| thumbnail_url | text null | |
| captions | jsonb | subtitle tracks `[{ lang, url }]` |

**`quizzes`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| lesson_id | uuid FK unique | |
| definition | jsonb | **Full** SurveyJS JSON, correct answers included. Never sent to the client as is. |
| editor_document | jsonb | BlockNote document used by the quiz editor, the source of `definition` |
| passing_score | numeric | between 0 and 1, e.g. `0.8` |
| max_attempts | int null | `null` = unlimited |
| cooldown_minutes | int | minimum delay between attempts |
| time_limit_minutes | int null | |
| shuffle_questions | bool | |
| show_correction | enum `never` \| `after_attempt` \| `after_pass` | |

**`files`**: `id`, `tenant_id`, `storage_key`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`. Images and attachments uploaded from the editor are stored through the host's `FileStorage` port. Only the key is stored here.

### Access

**`access_rules`**: see [05 — Permissions](05-permissions.md).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | text null | |
| target_type | enum `course` \| `chapter` \| `lesson` | |
| target_id | uuid | |
| effect | enum `allow` \| `deny` | |
| audience_type | enum `everyone` \| `role` \| `grade_min` \| `learner` | |
| audience_value | text null | role name, grade level or `learner_id` |

### Progress

**`enrollments`**: `id`, `tenant_id`, `course_id`, `learner_id`, `source` (`self` \| `assigned` \| `auto`), `assigned_by` null, `due_at` null, `started_at`, `completed_at` null, `progress` numeric (0–1, denormalized). Unique on (`course_id`, `learner_id`).

**`lesson_progress`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| lesson_id | uuid FK | |
| learner_id | text | |
| status | enum `not_started` \| `in_progress` \| `completed` | |
| started_at / completed_at | timestamptz | |
| | | unique (`lesson_id`, `learner_id`) |

**`video_progress`**

| Column | Type | Notes |
|--------|------|-------|
| lesson_progress_id | uuid PK/FK | |
| watched_ranges | jsonb | merged intervals in seconds, e.g. `[[0, 42.5], [60, 120]]` |
| watched_seconds | numeric | length of the union, denormalized |
| coverage | numeric | `watched_seconds / duration_seconds` |
| last_position | numeric | to resume playback |
| last_heartbeat_at | timestamptz | used by the plausibility check |
| suspicious_events | int | count of rejected or truncated heartbeats |

**`quiz_attempts`**: `id`, `quiz_id`, `learner_id`, `started_at`, `submitted_at`, `shuffle_seed`, `answers` jsonb, `score` numeric, `passed` bool, `quiz_version` (hash of the definition at the time of the attempt).

### Technical tables

- **`schema_migrations`**: applied migrations (name, checksum, date).
- **`event_outbox`**: events to deliver to the host product (`id`, `type`, `payload`, `created_at`, `delivered_at`, `attempts`). It guarantees that an event is not lost if the host's hook fails (outbox pattern).

## Computation rules

- **`text` lesson**: `completed` when the learner clicks "Mark as done" or reaches the end of the lesson. Option `requireScrollToEnd`.
- **`video` lesson**: `completed` when `coverage ≥ completionThreshold` (default 0.95).
- **`quiz` lesson**: `completed` when at least one attempt has `passed = true`.
- **Chapter or course progress**: number of `is_required` lessons that are `completed`, divided by the number of `is_required` lessons **the learner can access**. Lessons the learner cannot access do not count against them.
- `enrollments.progress` and `completed_at` are recomputed in the same transaction as any change to `lesson_progress`.

## Publishing and content changes

- Learners only see `published` content whose parents are all `published`.
- Editing a published lesson does **not** reset existing progress.
- A quiz attempt keeps the `quiz_version` it used, so editing a quiz later does not change a historical score.
- `content_schema_version` lets future releases migrate stored BlockNote documents when the block schema changes (migration script shipped in `elearning-db`).
- Full content versioning (revision history) is out of scope for v1.
