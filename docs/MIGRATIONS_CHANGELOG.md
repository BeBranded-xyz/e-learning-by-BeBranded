# Migrations Changelog

> Human-readable history of every schema and data migration
> (`modules/database.mdc`). One entry per migration file, added in the same PR.
> Applied migrations are never modified; a correction is a new migration.

Last updated: 2026-10-24

## Format

```
## YYYYMMDDHHMMSS_short_description
- Date: YYYY-MM-DD
- Type: schema | data | schema+data
- Tables: table_a, table_b
- Summary: what and why, 1-3 sentences
- Breaking: no | yes (expand/contract step N of M)
- Rollback: documented in header | rollbacks/YYYYMMDDHHMMSS_short_description.sql
- RLS: policies added/changed
- Types regenerated: yes
- PR: #123
```

## Entries

## 20261023000100_content_tables
- Date: 2026-10-23
- Type: schema
- Tables: courses, chapters, lessons; function set_updated_at
- Summary: content tree of spec 03. Chapters and lessons copy the tenant (and lessons the course) of their parent so every query filters on its own row.
- Breaking: no
- Rollback: documented in header
- RLS: enabled, no permissive policy (only the owning role has access)
- Types regenerated: yes
- PR: phase 1, `@bebranded/elearning-db`

## 20261023000200_access_and_progress_tables
- Date: 2026-10-23
- Type: schema
- Tables: access_rules, enrollments, lesson_progress
- Summary: audience rules (spec 05), enrollments with denormalized progress, and lesson progress (status only moves forward; completed implies completed_at).
- Breaking: no
- Rollback: documented in header
- RLS: enabled, no permissive policy
- Types regenerated: yes
- PR: phase 1, `@bebranded/elearning-db`

## 20261023000300_event_outbox
- Date: 2026-10-23
- Type: schema
- Tables: event_outbox
- Summary: transactional outbox for host events (spec 04, section 5), with a lease column for at-least-once delivery by concurrent workers.
- Breaking: no
- Rollback: documented in header
- RLS: enabled, no permissive policy
- Types regenerated: yes
- PR: phase 1, `@bebranded/elearning-db`

## 20261023000400_video_tables
- Date: 2026-10-23
- Type: schema
- Tables: video_assets, video_progress, video_sessions
- Summary: video lessons (spec 06): one provider asset per lesson, learners' merged watched ranges and coverage, and one row per player session whose `last_seq` makes heartbeats idempotent. Progress and sessions cascade with `lesson_progress`.
- Breaking: no
- Rollback: documented in header
- RLS: enabled, no permissive policy
- Types regenerated: yes
- PR: phase 2, `@bebranded/elearning-db`

## 20261023000500_video_budget_baseline
- Date: 2026-10-23
- Type: comment
- Tables: video_progress
- Summary: `last_heartbeat_at` now stores the baseline of the plausibility budget, which keeps the time a heartbeat did not use. Existing values stay valid baselines.
- Breaking: no
- Rollback: documented in header
- RLS: unchanged
- Types regenerated: yes
- PR: phase 2, budget carry-over fix

## 20261023000600_quiz_tables
- Date: 2026-10-23
- Type: schema
- Tables: quizzes, quiz_attempts
- Summary: quizzes (editor document, graded definition, version hash) and learners' attempts (spec 03, spec 07). Attempts hang off lesson_progress and cascade with it; a partial unique index allows one open attempt per learner and lesson; CHECK constraints tie status, closing time and score together.
- Breaking: no
- Rollback: documented in header
- RLS: enabled on both tables, no policy (default deny, as every table)
- Types regenerated: yes
- PR: #21

## 20261024000100_course_assignments
- Date: 2026-10-24
- Type: schema
- Tables: course_assignments
- Summary: courses assigned by an admin to a learner, a role or a minimum grade, with an optional due date (spec 03, spec 05). One row per tenant, course and audience; rows cascade with their course. An index on (tenant, audience) serves the lookup of a visiting learner's pending assignments.
- Breaking: no
- Rollback: documented in header
- RLS: enabled, no policy (default deny, as every table)
- Types regenerated: yes
- PR: #26

## 20261024000200_files
- Date: 2026-10-24
- Type: schema
- Tables: files
- Summary: images and attachments uploaded from the lesson editor through the host's `FileStorage` port (spec 03, spec 04 section 4). Only the storage key, MIME type, size and uploader are kept; the storage key is unique.
- Breaking: no
- Rollback: documented in header
- RLS: enabled, no policy (default deny, as every table)
- Types regenerated: yes
- PR: this PR
