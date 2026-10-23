# Migrations Changelog

> Human-readable history of every schema and data migration
> (`modules/database.mdc`). One entry per migration file, added in the same PR.
> Applied migrations are never modified; a correction is a new migration.

Last updated: 2026-10-23

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
