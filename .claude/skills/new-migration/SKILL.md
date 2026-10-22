---
name: new-migration
description: Create a database migration that follows modules/database.mdc - timestamped file with the mandatory header, RLS enabled and policies for new tables, indexes on foreign keys, comments, rollback, changelog entry, regenerated types, and the up/down/up and RLS tests. Use whenever the schema or reference data changes.
---

# /new-migration <short_description>

## Steps

1. Read `PROJECT.md` (DB, migrations directory, type generation command) and
   `modules/database.mdc`. If Supabase, also `platforms/supabase.mdc`.
2. Decide: schema, data, or both. Data migrations go in a separate file.
   Breaking changes follow expand/contract; this migration is one step of it
   and says which.
3. Create `<migrations dir>/<UTC YYYYMMDDHHMMSS>_<snake_case_description>.sql`
   (or the project's format) starting with the mandatory header block from
   `modules/database.mdc`.
4. Write the change:
   - `CREATE TABLE ... IF NOT EXISTS` with `id`, `created_at`, `updated_at`,
     `updated_at` trigger, `COMMENT ON` for non-obvious columns.
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same file, plus at
     least one policy named `{table}_{action}_{scope}`.
   - An index on every foreign key; partial indexes for state filters.
   - Constraints (NOT NULL, CHECK, UNIQUE, FK with explicit ON DELETE).
   - Enums: append only; document each value.
   - Keep the file under 200 lines; split otherwise.
5. Rollback: document the reverse in the header for additive changes; for
   destructive ones create `rollbacks/<same name>.sql`.
6. Run the full chain locally: reset, migrate up, rollback, migrate up, then
   migrate on a seeded DB. All must succeed.
7. Regenerate DB types and commit them.
8. Write tests (`core/testing.mdc` "DB schema / migration" row): up/down/up,
   RLS for anon / owner / other user (pgTAP or the project's harness),
   constraint tests, and `EXPLAIN` check that new indexes are used by the
   queries that motivated them.
9. Add the entry to `MIGRATIONS_CHANGELOG.md`.
10. Update data-access files and schemas that the change affects; never leave
    the app reading a column that no longer exists.
11. Run `/check`. Report which steps ran.

## Never

- Modify an applied migration.
- Disable RLS, even temporarily.
- Hardcode generated ids in data migrations.
- Use the dashboard SQL editor for schema changes.
