import type { TestProject } from "vitest/node";

import { startTestPostgres } from "./postgres.js";

declare module "vitest" {
  // Declaration merging needs an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** One PostgreSQL for the whole integration run; each test file gets its own schema. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = await startTestPostgres();
  project.provide("databaseUrl", database.url);
  return () => database.stop();
}
