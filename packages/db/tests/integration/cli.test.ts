import { randomUUID } from "node:crypto";

import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterAll, describe, expect, inject, it } from "vitest";

import { runCli } from "../../src/cli.js";
import { loadMigrations } from "../../src/migrations/migration-files.js";

const schema = `cli_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
// The default schema is created in the shared test database: no other test uses it.
const defaultSchemaDatabase = "elearning";

function captureIo() {
  const output = { out: "", err: "" };
  return {
    output,
    io: {
      out: (text: string) => {
        output.out += text;
      },
      err: (text: string) => {
        output.err += text;
      },
    },
  };
}

afterAll(async () => {
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: inject("databaseUrl"), max: 1 }),
    }),
  });
  await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
  await sql`DROP SCHEMA IF EXISTS ${sql.id(defaultSchemaDatabase)} CASCADE`.execute(db);
  await db.destroy();
});

describe("elearning CLI", () => {
  it("migrates the given schema, then reports nothing left to apply", async () => {
    const env = { ELEARNING_DATABASE_URL: inject("databaseUrl") };
    const count = (await loadMigrations()).length;
    const first = captureIo();
    const second = captureIo();

    expect(await runCli(["migrate", "--schema", schema], env, first.io)).toBe(0);
    expect(await runCli(["migrate", "--schema", schema], env, second.io)).toBe(0);

    expect(first.output.out).toMatch(
      new RegExp(`^Applied ${count} migration\\(s\\), 0 already applied\\.`),
    );
    expect(first.output.out).toContain("+ 20261023000100_content_tables");
    expect(second.output.out).toBe(`Applied 0 migration(s), ${count} already applied.\n`);
  });

  it("uses the elearning schema by default", async () => {
    const { io, output } = captureIo();

    expect(await runCli(["migrate"], { ELEARNING_DATABASE_URL: inject("databaseUrl") }, io)).toBe(
      0,
    );
    expect(output.out).toMatch(/^Applied \d migration\(s\)/);
  });

  it.each([[[]], [["deploy"]], [["migrate", "extra"]], [["migrate", "--unknown"]]])(
    "prints the usage and exits 64 for %j",
    async (argv) => {
      const { io, output } = captureIo();

      expect(await runCli(argv, {}, io)).toBe(64);
      expect(output.err).toContain("Usage: elearning migrate");
    },
  );

  it.each([[{}], [{ ELEARNING_DATABASE_URL: "mysql://localhost/db" }]])(
    "exits 78 when the connection string is missing or invalid (%j)",
    async (env) => {
      const { io, output } = captureIo();

      expect(await runCli(["migrate"], env, io)).toBe(78);
      expect(output.err).toContain("ELEARNING_DATABASE_URL");
    },
  );

  it("reports a validation error without printing the connection string", async () => {
    const url = inject("databaseUrl");
    const { io, output } = captureIo();

    expect(
      await runCli(["migrate", "--schema", "Bad-Name"], { ELEARNING_DATABASE_URL: url }, io),
    ).toBe(1);
    expect(output.err).toContain("invalid_schema_name");
    expect(output.err).not.toContain(url);
  });

  it("fails cleanly, without the password, when the database is unreachable", async () => {
    const { io, output } = captureIo();
    const env = { ELEARNING_DATABASE_URL: "postgres://user:s3cr3t-value@127.0.0.1:1/db" };

    expect(await runCli(["migrate"], env, io)).toBe(1);
    expect(output.err).not.toContain("s3cr3t-value");
  });

  it("reports PostgreSQL errors with their code", async () => {
    const url = new URL(inject("databaseUrl"));
    url.pathname = "/database_that_does_not_exist";
    const { io, output } = captureIo();

    expect(await runCli(["migrate"], { ELEARNING_DATABASE_URL: url.toString() }, io)).toBe(1);
    expect(output.err).toMatch(/^PostgreSQL error 3D000:/);
  });
});
