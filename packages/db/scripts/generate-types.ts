// Regenerates src/database.gen.ts from a freshly migrated PostgreSQL.
// Usage: pnpm --filter @bebranded/elearning-db db:types [--verify]
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import { migrate } from "../src/migrations/migrate.js";
import { startTestPostgres } from "../tests/support/postgres.js";

const SCHEMA = "elearning";
const outFile = fileURLToPath(new URL("../src/database.gen.ts", import.meta.url));
const verify = process.argv.includes("--verify");

const database = await startTestPostgres();
const db = new Kysely<Record<string, never>>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: database.url }) }),
});
try {
  await migrate(db, { schema: SCHEMA });
  execFileSync(
    "kysely-codegen",
    [
      "--dialect=postgres",
      `--default-schema=${SCHEMA}`,
      `--include-pattern=${SCHEMA}.*`,
      `--out-file=${outFile}`,
      ...(verify ? ["--verify"] : []),
    ],
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: database.url } },
  );
} finally {
  await db.destroy();
  await database.stop();
}
