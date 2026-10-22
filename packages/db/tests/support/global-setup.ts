import type { TestProject } from "vitest/node";

import { startTestPostgres } from "./postgres.js";
import type {} from "./vitest-context.js";

/** One PostgreSQL for the whole integration run; each test file gets its own schema. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = await startTestPostgres();
  project.provide("databaseUrl", database.url);
  return () => database.stop();
}
