# @bebranded/elearning-db

PostgreSQL migrations and storage adapter of the BeBranded e-learning module.
All tables live in their own schema (`elearning` by default), in the host's
database or a dedicated one.

```sh
pnpm add @bebranded/elearning-db pg
```

## Migrations

Run them in CI or at deploy time, with the connection string in
`ELEARNING_DATABASE_URL`:

```sh
pnpm elearning migrate --schema elearning
```

The command is safe to run concurrently (advisory lock) and refuses to start
when an applied migration was modified. At startup, call
`storage.assertSchemaUpToDate()` to fail fast when a migration is missing.

## Storage adapter

```ts
import { postgresStorage } from "@bebranded/elearning-db";

// Dedicated pool…
const storage = postgresStorage({ connectionString: process.env.ELEARNING_DATABASE_URL ?? "" });
// …or the host's own pg Pool (left open on close).
const shared = postgresStorage({ pool: hostPool, schema: "elearning" });
```

Every table has row level security enabled with no permissive policy: only the
role that owns the tables can access them. Use the same role for migrations
and for the module.

Migrations are embedded in the package code (no file access at runtime), so
it bundles with Next.js, Turbopack, webpack or esbuild like any module.

Requires Node.js 22.12 or later and PostgreSQL 14 or later. MIT licensed.
