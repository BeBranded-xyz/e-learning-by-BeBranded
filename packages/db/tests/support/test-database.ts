import { randomUUID } from "node:crypto";

import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { inject } from "vitest";

import type { StorageAdapter } from "@bebranded/elearning-core";

import { migrate } from "../../src/migrations/migrate.js";
import { postgresStorage } from "../../src/storage/postgres-storage.js";
import type {} from "./vitest-context.js";

export type TestDatabase = {
  readonly url: string;
  readonly schema: string;
  readonly pool: pg.Pool;
  readonly admin: Kysely<Record<string, never>>;
  readonly storage: StorageAdapter;
  drop(): Promise<void>;
};

/** A freshly migrated schema, isolated from every other test file. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const url = inject("databaseUrl");
  const schema = `test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  const admin = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool }) });
  await migrate(admin, { schema });
  const storage = postgresStorage({ connectionString: url, schema, maxConnections: 5 });
  return {
    url,
    schema,
    pool,
    admin,
    storage,
    drop: async () => {
      await storage.close();
      await sql`DROP SCHEMA ${sql.id(schema)} CASCADE`.execute(admin);
      await admin.destroy();
    },
  };
}
