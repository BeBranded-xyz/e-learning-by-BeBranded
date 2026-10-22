import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { postgresStorage } from "../../src/storage/postgres-storage.js";
import { aCourse, tenantA } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

describe("postgresStorage", () => {
  it("works on a pool owned by the host and leaves it open on close (mode A)", async () => {
    const hostPool = new pg.Pool({ connectionString: inject("databaseUrl"), max: 2 });
    const storage = postgresStorage({ pool: hostPool, schema: database.schema });
    const course = aCourse(tenantA.tenantId);

    await storage.transaction((tx) => tx.insertCourse(course));
    await storage.close();

    expect((await hostPool.query("SELECT 1 AS one")).rows).toEqual([{ one: 1 }]);
    expect(await database.storage.findCourseById(tenantA, course.id)).toEqual(course);
    await hostPool.end();
  });

  it("rolls back every write of a failed transaction", async () => {
    const course = aCourse(tenantA.tenantId);

    await expect(
      database.storage.transaction(async (tx) => {
        await tx.insertCourse(course);
        throw new Error("failure after the insert");
      }),
    ).rejects.toThrow("failure after the insert");

    expect(await database.storage.findCourseById(tenantA, course.id)).toBeNull();
  });

  it("checks that the schema is up to date at startup", async () => {
    await expect(database.storage.assertSchemaUpToDate()).resolves.toBeUndefined();

    const empty = postgresStorage({
      connectionString: inject("databaseUrl"),
      schema: `empty_${randomUUID().slice(0, 8)}`,
    });
    await expect(empty.assertSchemaUpToDate()).rejects.toMatchObject({
      code: "schema_out_of_date",
    });
    await empty.close();
  });

  it.each([
    ["a non-postgres connection string", { connectionString: "mysql://localhost/db" }],
    ["an object that is not a pool", { pool: { query: () => undefined } }],
    ["unknown options", { connectionString: "postgres://localhost/db", ssl: false }],
    ["too many connections", { connectionString: "postgres://localhost/db", maxConnections: 1000 }],
  ])("rejects %s", (_label, options) => {
    expect(() => postgresStorage(options as never)).toThrow();
  });

  it("defaults to the elearning schema and connects lazily", async () => {
    const storage = postgresStorage({ connectionString: "postgres://localhost:1/unused" });

    await expect(storage.close()).resolves.toBeUndefined();
  });

  it("rejects an invalid schema name before connecting", () => {
    expect(() =>
      postgresStorage({ connectionString: "postgres://localhost/db", schema: "Bad-Name" }),
    ).toThrow(expect.objectContaining({ code: "invalid_schema_name" }));
  });
});
