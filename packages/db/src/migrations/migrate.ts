import { sql } from "kysely";
import type { Kysely } from "kysely";

import { AppError } from "@bebranded/elearning-core";

import { assertSchemaName } from "../schema-name.js";
import { loadMigrations } from "./migration-files.js";
import type { MigrationFile } from "./migration-files.js";

export type MigrationReport = {
  readonly applied: readonly string[];
  readonly alreadyApplied: readonly string[];
};

type AppliedMigration = { name: string; checksum: string };

// The runner only issues raw SQL, so it accepts a Kysely instance of any database type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely<any> is the documented way to accept any database type
type AnyDatabase = Kysely<any>;

async function ensureMigrationsTable(db: AnyDatabase, schema: string): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.id(schema)}`.execute(db);
  await sql`REVOKE ALL ON SCHEMA ${sql.id(schema)} FROM PUBLIC`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(schema, "schema_migrations")} (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`ALTER TABLE ${sql.id(schema, "schema_migrations")} ENABLE ROW LEVEL SECURITY`.execute(
    db,
  );
}

async function listApplied(db: AnyDatabase, schema: string): Promise<AppliedMigration[]> {
  const result = await sql<AppliedMigration>`
    SELECT name, checksum FROM ${sql.id(schema, "schema_migrations")} ORDER BY name`.execute(db);
  return result.rows;
}

/** Applied migrations must be byte-identical to the shipped files. */
function assertUnchanged(
  applied: readonly AppliedMigration[],
  files: readonly MigrationFile[],
): void {
  const byName = new Map(files.map((file) => [file.name, file]));
  for (const row of applied) {
    const file = byName.get(row.name);
    if (file === undefined) {
      throw new AppError(
        "conflict",
        "unknown_migration",
        `Applied migration ${row.name} is not shipped by this version`,
      );
    }
    if (file.checksum !== row.checksum) {
      throw new AppError(
        "conflict",
        "migration_modified",
        `Applied migration ${row.name} was modified`,
      );
    }
  }
}

async function applyOne(db: AnyDatabase, schema: string, file: MigrationFile): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await sql`SET LOCAL search_path TO ${sql.id(schema)}`.execute(trx);
    // Trusted SQL shipped in the package, never built from input.
    await sql.raw(file.sql).execute(trx);
    await sql`
      INSERT INTO ${sql.id(schema, "schema_migrations")} (name, checksum)
      VALUES (${file.name}, ${file.checksum})`.execute(trx);
  });
}

/**
 * Applies the pending migrations in order, each in its own transaction. A
 * session advisory lock serializes concurrent runs (parallel deploys).
 */
export async function migrate(
  db: AnyDatabase,
  options: { schema: string; files?: readonly MigrationFile[] },
): Promise<MigrationReport> {
  const schema = assertSchemaName(options.schema);
  const files = options.files ?? (await loadMigrations());
  return db.connection().execute(async (conn) => {
    const lockKey = `elearning:migrate:${schema}`;
    await sql`SELECT pg_advisory_lock(hashtext(${lockKey}))`.execute(conn);
    try {
      await ensureMigrationsTable(conn, schema);
      const applied = await listApplied(conn, schema);
      assertUnchanged(applied, files);
      const done = new Set(applied.map((row) => row.name));
      const pending = files.filter((file) => !done.has(file.name));
      for (const file of pending) {
        await applyOne(conn, schema, file);
      }
      return { applied: pending.map((file) => file.name), alreadyApplied: [...done] };
    } finally {
      await sql`SELECT pg_advisory_unlock(hashtext(${lockKey}))`.execute(conn);
    }
  });
}

/** Startup check (spec 02): the database must have every shipped migration. */
export async function assertSchemaUpToDate(
  db: AnyDatabase,
  options: { schema: string; files?: readonly MigrationFile[] },
): Promise<void> {
  const schema = assertSchemaName(options.schema);
  const files = options.files ?? (await loadMigrations());
  const exists = await sql<{ present: boolean }>`
    SELECT to_regclass(${`${schema}.schema_migrations`}) IS NOT NULL AS present`.execute(db);
  const applied = exists.rows[0]?.present === true ? await listApplied(db, schema) : [];
  assertUnchanged(applied, files);
  const missing = files.length - applied.length;
  if (missing > 0) {
    throw new AppError(
      "internal",
      "schema_out_of_date",
      `The ${schema} schema is missing ${missing} migration(s); run "elearning migrate"`,
    );
  }
}
