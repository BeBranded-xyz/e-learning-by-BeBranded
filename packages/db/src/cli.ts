import { parseArgs } from "node:util";

import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { z } from "zod";

import { isAppError } from "@bebranded/elearning-core";

import { migrate } from "./migrations/migrate.js";
import { DEFAULT_SCHEMA } from "./schema-name.js";

const USAGE = `Usage: elearning migrate [--schema <name>]

Applies the pending e-learning migrations to ELEARNING_DATABASE_URL.
  --schema   PostgreSQL schema (default: ${DEFAULT_SCHEMA})
`;

const envSchema = z.object({
  ELEARNING_DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
});

/** Never prints the connection string: only known error shapes are described. */
export function describeFailure(error: unknown): string {
  if (isAppError(error)) return `${error.code}: ${error.message}`;
  if (error instanceof pg.DatabaseError)
    return `PostgreSQL error ${error.code ?? "(no code)"}: ${error.message}`;
  return "Migration failed. Check that the database is reachable.";
}

type CliIo = { out: (text: string) => void; err: (text: string) => void };

/** Returns the process exit code (sysexits: 64 usage, 78 configuration, 1 failure). */
export async function runCli(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  io: CliIo,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { schema: { type: "string" } },
    });
  } catch {
    io.err(USAGE);
    return 64;
  }
  if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "migrate") {
    io.err(USAGE);
    return 64;
  }
  const config = envSchema.safeParse(env);
  if (!config.success) {
    io.err("ELEARNING_DATABASE_URL is missing or is not a postgres:// connection string\n");
    return 78;
  }
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: config.data.ELEARNING_DATABASE_URL, max: 1 }),
    }),
  });
  try {
    const report = await migrate(db, { schema: parsed.values.schema ?? DEFAULT_SCHEMA });
    io.out(
      `Applied ${report.applied.length} migration(s), ${report.alreadyApplied.length} already applied.\n`,
    );
    for (const name of report.applied) io.out(`  + ${name}\n`);
    return 0;
  } catch (error) {
    io.err(`${describeFailure(error)}\n`);
    return 1;
  } finally {
    await db.destroy();
  }
}
