import { randomUUID } from "node:crypto";

import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { assertSchemaUpToDate, migrate } from "../../src/migrations/migrate.js";
import { loadMigrations } from "../../src/migrations/migration-files.js";

let pool: pg.Pool;
let db: Kysely<Record<string, never>>;
const schemas: string[] = [];

function newSchema(): string {
  const schema = `mig_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  schemas.push(schema);
  return schema;
}

beforeAll(() => {
  pool = new pg.Pool({ connectionString: inject("databaseUrl"), max: 5 });
  db = new Kysely({ dialect: new PostgresDialect({ pool }) });
});

afterAll(async () => {
  for (const schema of schemas)
    await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
  await db.destroy();
});

describe("migrate", () => {
  it("applies every shipped migration on a clean database", async () => {
    const files = await loadMigrations();
    const report = await migrate(db, { schema: newSchema() });

    expect(report.applied).toEqual(files.map((file) => file.name));
    expect(report.alreadyApplied).toEqual([]);
  });

  it("is idempotent: a second run applies nothing", async () => {
    const schema = newSchema();
    await migrate(db, { schema });

    const second = await migrate(db, { schema });

    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toHaveLength((await loadMigrations()).length);
  });

  it("serializes concurrent runs so each migration is applied once", async () => {
    const schema = newSchema();
    const files = await loadMigrations();

    const reports = await Promise.all([
      migrate(db, { schema }),
      migrate(db, { schema }),
      migrate(db, { schema }),
    ]);

    expect(reports.flatMap((report) => report.applied).sort()).toEqual(
      files.map((file) => file.name),
    );
  });

  it("applies only the new migrations of an upgrade", async () => {
    const schema = newSchema();
    const files = await loadMigrations();
    await migrate(db, { schema, files: files.slice(0, 1) });

    const report = await migrate(db, { schema, files });

    expect(report.applied).toEqual(files.slice(1).map((file) => file.name));
  });

  it("refuses to run when an applied migration was modified", async () => {
    const schema = newSchema();
    const files = await loadMigrations();
    await migrate(db, { schema, files });
    const [first, ...rest] = files;
    if (first === undefined) throw new Error("no migration shipped");
    const modified = [{ ...first, checksum: "0".repeat(64) }, ...rest];

    await expect(migrate(db, { schema, files: modified })).rejects.toMatchObject({
      code: "migration_modified",
    });
  });

  it("refuses to run when the database has a migration this version does not ship", async () => {
    const schema = newSchema();
    const files = await loadMigrations();
    await migrate(db, { schema, files });

    await expect(migrate(db, { schema, files: files.slice(0, 1) })).rejects.toMatchObject({
      code: "unknown_migration",
    });
  });

  it("rolls back a failing migration entirely", async () => {
    const schema = newSchema();
    const broken = [
      {
        name: "20990101000000_broken",
        sql: "CREATE TABLE ok_table (id int); SELECT 1/0;",
        checksum: "x",
      },
    ];

    await expect(migrate(db, { schema, files: broken })).rejects.toThrow();

    const exists = await sql<{ present: boolean }>`
      SELECT to_regclass(${`${schema}.ok_table`}) IS NOT NULL AS present`.execute(db);
    expect(exists.rows[0]?.present).toBe(false);
    await expect(migrate(db, { schema, files: [] })).resolves.toEqual({
      applied: [],
      alreadyApplied: [],
    });
  });

  it.each(["Elearning", "e-learning", "1schema", "a".repeat(64), 'x"; DROP SCHEMA public; --'])(
    "rejects the schema name %j",
    async (schema) => {
      await expect(migrate(db, { schema })).rejects.toMatchObject({ code: "invalid_schema_name" });
    },
  );
});

describe("assertSchemaUpToDate", () => {
  it("passes once every migration is applied", async () => {
    const schema = newSchema();
    await migrate(db, { schema });

    await expect(assertSchemaUpToDate(db, { schema })).resolves.toBeUndefined();
  });

  it("fails with schema_out_of_date on a database that was never migrated", async () => {
    await expect(assertSchemaUpToDate(db, { schema: newSchema() })).rejects.toMatchObject({
      code: "schema_out_of_date",
    });
  });

  it("fails with schema_out_of_date when a migration is missing", async () => {
    const schema = newSchema();
    const files = await loadMigrations();
    await migrate(db, { schema, files: files.slice(0, 1) });

    await expect(assertSchemaUpToDate(db, { schema, files })).rejects.toMatchObject({
      code: "schema_out_of_date",
    });
  });
});
