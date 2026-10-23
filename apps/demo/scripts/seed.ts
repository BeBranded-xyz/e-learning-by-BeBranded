// Usage: ELEARNING_DATABASE_URL=postgres://… pnpm --filter @bebranded/elearning-demo seed
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import { DEFAULT_SCHEMA, migrate, postgresStorage } from "@bebranded/elearning-db";

import { readEnv } from "../lib/env.js";
import { seedDemo } from "./seed-demo.js";

const { ELEARNING_DATABASE_URL: url } = readEnv();
const db = new Kysely<Record<string, never>>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 1 }) }),
});
const storage = postgresStorage({ connectionString: url });
try {
  await migrate(db, { schema: DEFAULT_SCHEMA });
  const created = await seedDemo(storage);
  process.stdout.write(created ? "Demo content created.\n" : "Demo content already present.\n");
} finally {
  await storage.close();
  await db.destroy();
}
