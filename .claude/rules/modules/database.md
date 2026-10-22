---
description: Relational database rules — migrations, RLS, clients, query patterns. Generic, with Postgres/Supabase examples. Apply when the project uses a relational DB.
paths:
  - "**/migrations/**"
  - "**/*.queries.ts"
  - "**/*.repo.ts"
  - "supabase/**"
---

# Database

Apply this module when `PROJECT.md` declares a relational database. Examples use
Postgres/Supabase; the principles hold for any SQL database. Concrete identifiers
(project ref, region, table names, env var names) live in `PROJECT.md`.

## Clients & access

Use the **minimum-privilege client** for each context. A typical setup has three:

| Client | Where | Privilege |
|---|---|---|
| Browser/client | Client-side code | Public key, RLS-enforced |
| Server | Server components / handlers / actions | Public key + request auth, RLS-enforced |
| Admin / privileged | Trusted server code, functions, crons | Secret key, **bypasses RLS** |

**Rules**:
- **Never import the privileged/admin client into client code.** Enforce with lint.
- **Use the admin client only when RLS would block a legitimate operation**
  (cron cleanup, cross-user merge, sync). **Document why** with a code comment.
- **Never expose admin-client results to a client** without filtering.
- **Type the client** with generated DB types; never hand-write row types.
- Read connection details from env, never hardcode. Application queries go
  through the connection pooler; migrations use the direct connection.

How the UI consumes these queries (one round trip per screen, optimistic mutations, caching) is in `data-fetching.mdc`.

## Query patterns

Keep all queries in dedicated data-access files (`*.queries.ts` / `*.repo.ts`),
never inline in UI or route handlers.

- **One concern per function** — fetch, write, and transform stay separate.
- **Always handle the error path explicitly**; never silently swallow.
- **Select only the columns you need**; never `SELECT *` on wide tables.
- **Always filter by an indexed column**; never scan whole tables.
- **Paginate** list/collection reads; never load an unbounded set into memory.
- **Prefer views** when they encapsulate business logic, and **atomic functions
  (RPC / stored procedures)** for operations that must be race-free.
- **Derive types from generated DB types** for rows, inserts, and updates.

## Query efficiency

Every query costs a round-trip, pool capacity, and (offline-first apps) sync
bandwidth. Queries that serve no purpose are bugs:

- **Every query must have a consumer.** Never fetch "just in case", and delete
  dead queries in the same PR as the refactor that orphaned them.
- **No N+1**: batch with joins or `IN` lists instead of per-row round-trips.
- **Don't refetch unchanged data** — go through the cache layer declared in
  `PROJECT.md` and invalidate precisely, never blanket-refetch on every render.
- **Combine writes that must succeed together** into one statement or RPC
  instead of sequential client-side calls.
- **Push aggregation to the database** (views, `GROUP BY`) — never pull raw
  rows to aggregate in application code.

## Migrations

- **Location**: a single migrations directory; one concern per migration.
- **Naming**: `YYYYMMDDHHMMSS_short_description` (UTC timestamp + snake_case).
- **Never modify an applied migration.** Create a new one instead.
- **Idempotent where possible**: `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `DROP ... IF EXISTS`.
- **Test the full chain locally** (e.g. `supabase db reset`) before committing.
- **Regenerate and commit DB types** in the same PR as the migration.

Every migration starts with a header:

```sql
-- Migration: YYYYMMDDHHMMSS_short_description
-- Author: [name]
-- Date: YYYY-MM-DD
-- Description: [2-3 sentences: what and why]
-- Dependencies: [prior migrations, or "none"]
-- Rollback: [how to reverse]
--
-- Changes:
--   - [table/column/index/policy affected]
```

Maintain a human-readable migration changelog (entry per migration: date, type,
tables affected, summary, breaking yes/no, related PR).

### Rollback strategy
- **Additive** (new tables/columns/indexes/functions): document the `DROP` in the
  header. No separate file needed.
- **Destructive** (drop column, alter type, drop table): create a paired rollback
  file in a `rollbacks/` directory. Never run destructive migrations without review.

### Breaking schema changes (expand/contract)
1. Add the new structure alongside the old (dual-write).
2. Update code to write both.
3. Backfill the new structure.
4. Update code to read the new structure.
5. Drop the old structure.

Never collapse these into one PR unless downtime is acceptable and authorized.

## Row Level Security (RLS)

When the DB supports it (e.g. Supabase/Postgres), **RLS is mandatory**:

- **RLS is non-negotiable and admits no exceptions.** Policies are always
  active and written defensively — default deny, least privilege — in every
  environment including local and staging. No "temporary" bypass, no table
  shipped "we'll add policies later", no weakening a policy to unblock a
  feature: if RLS blocks a legitimate operation, fix the policy or use the
  documented privileged client, never loosen security.
- **Enable RLS in the same migration that creates the table.** Never "for now".
- **Default deny**: a table with no policy is inaccessible. Define at least one.
- **Descriptive policy names**: `{table}_{action}_{scope}` (e.g.
  `orders_select_own`, `products_select_public`).
- **Test every policy** against: unauthenticated, owner, and a different user.
- **Never disable RLS in production.** Use the privileged client (documented) to
  bypass when genuinely needed.
- If a query unexpectedly returns no rows, suspect RLS first.

## Table creation standard

```sql
CREATE TABLE my_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns ...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "my_table_select_own"
  ON my_table FOR SELECT
  TO authenticated
  USING (/* ownership condition */);

CREATE TRIGGER trg_my_table_updated
  BEFORE UPDATE ON my_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON COLUMN my_table.some_field IS 'What it stores and why';
CREATE INDEX idx_my_table_some_fk ON my_table (some_fk_id);
```

## Functions, triggers, indexes, enums

- **Functions**: `SECURITY DEFINER` only when elevated privileges are needed, and
  always set `search_path` explicitly (`SET search_path = public, pg_temp;`).
  Comment every function (purpose, params, return). Keep bodies under 50 lines.
- **Triggers**: name `trg_{table}_{action}`.
- **Indexes**: one for every foreign key (Postgres does not add these
  automatically); partial indexes for state-filtered queries; name
  `idx_{table}_{columns|purpose}`; drop unused ones.
- **Enums**: define at the top of the introducing migration; only ever append
  values (never reorder); document each value.

## Data migrations
- Separate data migrations from schema migrations when possible.
- Make them idempotent; batch large ones (>10k rows) inside explicit transactions.
- Never hardcode generated IDs; look up by stable keys.

## Performance & monitoring
- Index foreign keys and common filter columns; use partial indexes for hot,
  filtered reads.
- Profile slow queries with the planner (`EXPLAIN ANALYZE`).
- Watch the connection pool; alert on sustained high usage.
- Verify backup retention and point-in-time recovery match the plan before
  relying on them.

## Testing

Database changes are maximal-testing areas (`testing.mdc`, row "DB schema /
migration"). Tools per platform: pgTAP, testcontainers, the project's harness.
- **Migration chain**: reset, up, down, up on a clean DB; up on a seeded DB;
  every migration runs twice without error (idempotency).
- **RLS**: every policy tested as anonymous, owner, and another user, for
  select, insert, update, delete. A table without a policy test fails CI.
- **Constraints**: NOT NULL, CHECK, UNIQUE, FK ON DELETE behavior asserted.
- **Functions and triggers**: unit tests per function including error paths
  and `SECURITY DEFINER` boundaries; `updated_at` trigger asserted.
- **Queries**: each data-access function tested against the real local DB
  (never a mocked client), including empty result, pagination boundaries,
  and concurrent writes (`SELECT ... FOR UPDATE`, unique violations).
- **Performance**: `EXPLAIN` in a test for hot queries asserts the intended
  index is used; a seeded volume test for tables expected to grow.
- **Backup and restore drill** at the pre-production gate.

## Checklist when touching DB code
- [ ] Correct-privilege client for the context; admin use documented
- [ ] Query in a data-access file, not inline
- [ ] Generated types used; no hand-written row types
- [ ] Errors handled explicitly
- [ ] RLS verified for affected tables
- [ ] Migration added with header; RLS + comments + indexes on new tables
- [ ] Full migration chain runs clean locally; types regenerated and committed
- [ ] Migration changelog + rollback (if destructive) added
- [ ] `.env.example` updated for any new variable
