# Migrations Changelog

> Human-readable history of every schema and data migration
> (`modules/database.mdc`). One entry per migration file, added in the same PR.
> Applied migrations are never modified; a correction is a new migration.

Last updated: 2026-10-22

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

None yet. The first migration lands in phase 1 (`@bebranded/elearning-db`).
