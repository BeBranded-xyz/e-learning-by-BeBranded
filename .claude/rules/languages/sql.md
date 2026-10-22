---
description: SQL rules — sqlfluff formatting, explicit columns and joins, CTEs, NULL semantics, transactions and locking, constraints, dialect differences, EXPLAIN discipline, pgTAP and migration tests. Complements modules/database.mdc. Apply to every .sql file.
paths:
  - "**/*.sql"
---

# SQL

## When this applies

Apply to every file matching the globs, and to SQL embedded in application
code (query builders, raw strings, ORM escape hatches). This rule covers the
SQL language itself. Migrations structure, headers, rollbacks,
expand/contract, RLS policies, client privilege levels, and index naming are
defined in `modules/database.mdc` and are not repeated here; follow that file
for anything under `migrations/`. The dialect in use (Postgres, MySQL,
SQLite/D1) lives in `PROJECT.md`.

## Toolchain

| Role | Tool | Notes |
|---|---|---|
| Version manager | database engine pinned in the container / `PROJECT.md` | Local engine version equals production major |
| Package manager | none; migration tool from `PROJECT.md` | Extensions declared in a migration |
| Formatter | `sqlfluff format` | `.sqlfluff` at root with `dialect` set; templater for ORM files when relevant |
| Linter | `sqlfluff lint` | Rules `all` with documented exclusions; `squawk` for Postgres migration safety |
| Type checker | none; the engine is the type checker | `sqlc` / `sqlx` / `kysely` codegen when the stack supports it |
| Test runner | `pgTAP` (Postgres), `mysql-test` equivalents, or the app test runner | See Testing |
| Check command | `make check` | `sqlfluff lint` + `squawk` + migration up/down + SQL tests |

- **`.sqlfluff` sets `dialect`, `max_line_length = 100`, lowercase
  identifiers, uppercase keywords.** Format on save; CI fails on diff.

## Project layout

```
db/  (or supabase/, or the framework's directory from PROJECT.md)
  migrations/            (see modules/database.mdc)
  rollbacks/
  seeds/
    <NN>_<topic>.sql     (idempotent, ordered, dev/test only)
  queries/
    <domain>/<verb>_<noun>.sql   (named queries for sqlc / sqlx / raw use)
  functions/             (stored procedures, one file each, re-runnable)
  tests/
    <topic>.sql          (pgTAP) or *.test.* in the app runner
```


## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Tables | `snake_case`, plural | `order_items` |
| Columns | `snake_case`, singular; booleans `is_`/`has_` | `is_active`, `shipped_at` |
| Primary key | `id` | `id uuid` / `id bigint` |
| Foreign key | `<referenced_singular>_id` | `customer_id` |
| Timestamps | `<event>_at` (`timestamptz`) | `created_at`, `deleted_at` |
| Constraints | `<table>_<columns>_<type>` | `orders_customer_id_fkey`, `orders_total_check` |
| Views | `v_<purpose>` (materialized: `mv_`) | `v_open_orders` |
| Functions | `verb_noun` | `lock_product` |
| CTE names | descriptive noun | `recent_orders`, not `t1` |


## Language idioms and rules

### Formatting and readability
- **Keywords UPPERCASE, identifiers lowercase**, one clause per line, one
  column per line in lists longer than three.
- **Explicit column lists always**: in `SELECT`, in `INSERT INTO t (...)`,
  in `RETURNING`. **Never `SELECT *`** outside `EXISTS (...)` and ad-hoc
  console work.
- **Joins are explicit** (`INNER JOIN ... ON`, `LEFT JOIN ... ON`); never a
  comma join, never `NATURAL JOIN`, never `USING` on tables with drifting
  column names. Always qualify columns when more than one table is present.
- **CTEs over nested subqueries** once a query has more than one level; each
  CTE is a named step. Prefer a view or function when a CTE chain is reused.
- **`ORDER BY` names columns, never ordinals**; every `LIMIT` has an
  `ORDER BY`; paginate with keyset (`WHERE (created_at, id) < (...)`) over
  large `OFFSET`.

### NULL semantics
- **Compare with `IS [NOT] NULL`; never `= NULL`.** Remember `NOT IN (subquery)`
  returns nothing if the subquery yields a NULL; use `NOT EXISTS`.
- **Columns are `NOT NULL` by default**; a nullable column needs a comment
  stating what NULL means.

### Constraints as the first line of defence
- **Every invariant that can be expressed in the schema is**: `NOT NULL`,
  `UNIQUE`, `CHECK`, `FOREIGN KEY ... ON DELETE <explicit action>`,
  `EXCLUDE` for ranges. Application validation is a second layer, never the
  only one.
- **`ON DELETE` is always explicit** (`RESTRICT`, `CASCADE`, `SET NULL`) and
  chosen deliberately; cascades on business tables are commented.
- **Money is `numeric(precision, scale)` or integer minor units; never
  `float`.** Time is `timestamptz` (UTC), never a naive timestamp.

### Transactions, isolation, locking
- **Every multi-statement write is one transaction**, started and ended by
  the application layer or function, never left implicit.
- **Keep transactions short**: no network calls, no user waits, no heavy
  reads inside a write transaction.
- **Default isolation is `READ COMMITTED`**; use `REPEATABLE READ` or
  `SERIALIZABLE` only for documented invariants, and retry on serialization
  failure (`40001`) with bounded attempts.
- **`SELECT ... FOR UPDATE`** to claim a row before a read-modify-write;
  **`FOR UPDATE SKIP LOCKED`** for queue/worker patterns; **`FOR NO KEY
  UPDATE`** when only non-key columns change.
- **Lock rows in a consistent order** (by primary key) to avoid deadlocks;
  never lock inside a loop.

```sql
WITH next_job AS (
  SELECT id
  FROM jobs
  WHERE status = 'queued'
  ORDER BY created_at, id
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE jobs
SET status = 'running', started_at = now()
FROM next_job
WHERE jobs.id = next_job.id
RETURNING jobs.id, jobs.payload;
```

### EXPLAIN discipline

- **Every new or changed query touching a table above ~10k rows ships with
  its `EXPLAIN (ANALYZE, BUFFERS)` output** in the PR description, run on
  production-like data volume.
- **Sequential scans on large tables and nested-loop joins on unbounded sets
  are defects** unless justified in a comment.
- **An index added for a query is proven by the plan**, and its write cost
  is acknowledged; unused indexes are dropped.

### Dialect differences

| Concern | Postgres | MySQL | SQLite / D1 |
|---|---|---|---|
| Identifier quote | `"name"` | `` `name` `` | `"name"` |
| Boolean | `boolean` | `tinyint(1)` | integer 0/1 |
| UUID | `uuid`, `gen_random_uuid()` | `char(36)` / `binary(16)` | `text`, generate in app |
| Timestamps | `timestamptz` | `datetime(6)`, store UTC | `text` ISO-8601 UTC |
| Upsert | `ON CONFLICT ... DO UPDATE` | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE` |
| Returning | `RETURNING` | `LAST_INSERT_ID()` (8.0+: none) | `RETURNING` (3.35+) |
| Row locking | `FOR UPDATE [SKIP LOCKED]` | `FOR UPDATE [SKIP LOCKED]` (8.0+) | none; whole-DB lock |
| Enums | native `CREATE TYPE` | column `ENUM(...)` | `CHECK (col IN (...))` |
| Transactional DDL | yes | no | yes |

Write dialect-portable SQL only when `PROJECT.md` requires several engines;
otherwise use native features and name the dialect in the file header.

### Forbidden
- `SELECT *`, implicit joins, `= NULL`, ordinal `ORDER BY`, string-built SQL,
  `float` for money, naive timestamps, `DELETE`/`UPDATE` without `WHERE`,
  triggers hiding business logic, `WITH RECURSIVE` without a depth guard.

## Size limit overrides for SQL

| Scope | Limit | Reason |
|---|---|---|
| Query file | 100 lines | Longer queries become views or functions |
| Function / procedure body | 50 lines | Same as core function limit |

## Dependencies

- **Extensions are enabled in a migration** (`CREATE EXTENSION IF NOT EXISTS`)
  and listed in `PROJECT.md`; never assume one exists.
- **Audit**: `squawk` on migrations; the engine's advisor (e.g. Supabase
  advisors, `pg_stat_statements`) reviewed on a schedule.

## Testing

SQL tests live in `db/tests/` (pgTAP) or next to the app's data-access tests,
and run in `make check` against a disposable database.

| Category | Tool | Rule |
|---|---|---|
| Unit (functions, views, constraints) | `pgTAP` (`pg_prove`) or dialect equivalent | Every function and constraint: valid, invalid, boundary |
| Migration | migration tool up, down, up again | Every migration; schema diff empty after round trip |
| Integration | `testcontainers` (Postgres/MySQL) or in-memory SQLite/D1 (`miniflare`) | Real engine, same major version as prod |
| Property-based | app-level property tests over the query layer | Invariants like totals, ordering, pagination completeness |
| Concurrency | two-session tests for `FOR UPDATE`/`SKIP LOCKED` paths | Every locking pattern; deadlock-free |
| Performance | `EXPLAIN ANALYZE` assertions on plan shape (pgTAP `plan_ok` or scripted) | Hot queries from `PROJECT.md` |
| Security | RLS policy tests (see `modules/database.mdc`), `squawk` | Every table with policies |

- **Never test against production or a shared database**; each run creates
  and drops its own schema.
- **Seed data is minimal, deterministic, and referenced by stable keys**,
  never by autogenerated ids.

## Security specifics

- **Parameters, never interpolation**: `$1`/`?`/named binds for every value;
  identifiers from user input are whitelisted against a fixed list.
- **Least privilege roles**: the application role cannot `DROP`, `ALTER`, or
  read other schemas; migrations run under a separate role.
- **`SECURITY DEFINER` functions set `search_path`** (see
  `modules/database.mdc`) and validate every argument.
- **No secrets or PII in SQL files**, seeds, or comments; test data uses fake
  values.

## Checklist when touching SQL code

- [ ] `sqlfluff` clean; keywords upper, identifiers lower, dialect set
- [ ] Explicit column lists; no `SELECT *`; explicit qualified joins
- [ ] CTEs named by meaning; no nested subquery deeper than one level
- [ ] NULL handled with `IS NULL` / `NOT EXISTS`; nullable columns commented
- [ ] Constraints express every schema-level invariant; `ON DELETE` explicit
- [ ] Writes wrapped in short transactions; locking pattern chosen and ordered
- [ ] Money `numeric`/integer, time `timestamptz` UTC
- [ ] `EXPLAIN ANALYZE` attached for queries on large tables; indexes proven
- [ ] Parameters only; no interpolated values or identifiers
- [ ] pgTAP (or equivalent) tests added; migration up/down/up passes; seeds idempotent
- [ ] Migration/RLS rules from `modules/database.mdc` followed
