import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/** Lowest supported major (spec 08); CI may override with ELEARNING_TEST_DATABASE_URL. */
const POSTGRES_IMAGE = "postgres:14-alpine";

export type TestPostgres = { readonly url: string; stop(): Promise<void> };

/** A real PostgreSQL for tests: never a mock (core/testing.mdc). */
export async function startTestPostgres(): Promise<TestPostgres> {
  const external = process.env.ELEARNING_TEST_DATABASE_URL;
  if (external !== undefined && external !== "") {
    return { url: external, stop: () => Promise.resolve() };
  }
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    POSTGRES_IMAGE,
  ).start();
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop();
    },
  };
}
