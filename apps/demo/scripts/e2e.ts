// End-to-end run: a real PostgreSQL (Testcontainers, or ELEARNING_E2E_DATABASE_URL),
// migrations, demo content, a production build of the demo, then Playwright.
// Usage: pnpm --filter @bebranded/elearning-demo test:e2e [playwright args]
import { spawnSync } from "node:child_process";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import { DEFAULT_SCHEMA, migrate, postgresStorage } from "@bebranded/elearning-db";

import { ensureDemoVideo } from "./demo-video.js";
import { seedDemo } from "./seed-demo.js";

async function database(): Promise<{ url: string; stop: () => Promise<void> }> {
  const external = process.env.ELEARNING_E2E_DATABASE_URL;
  if (external !== undefined && external !== "")
    return { url: external, stop: () => Promise.resolve() };
  const container = await new PostgreSqlContainer("postgres:14-alpine").start();
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop();
    },
  };
}

async function prepare(url: string): Promise<void> {
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 1 }) }),
  });
  const storage = postgresStorage({ connectionString: url });
  try {
    ensureDemoVideo();
    await migrate(db, { schema: DEFAULT_SCHEMA });
    await seedDemo(storage);
  } finally {
    await storage.close();
    await db.destroy();
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): number {
  return spawnSync(command, args, { stdio: "inherit", env }).status ?? 1;
}

process.env.DEMO_VIDEO_FIXTURE = "1";
const db = await database();
let status: number;
try {
  await prepare(db.url);
  const env = {
    ...process.env,
    ELEARNING_DATABASE_URL: db.url,
    DEMO_PUBLIC_URL: "http://127.0.0.1:3100",
  };
  status = 0;
  if (process.env.E2E_SKIP_BUILD !== "1") {
    // Next resolves the published package entries in dist, not Vitest's source condition.
    status = run(
      "pnpm",
      ["--dir", "../..", "exec", "turbo", "run", "build", "--filter=./packages/**"],
      env,
    );
    if (status === 0) status = run("next", ["build"], env);
  }
  if (status === 0) status = run("playwright", ["test", ...process.argv.slice(2)], env);
} finally {
  await db.stop();
}
process.exitCode = status;
