import { defineConfig } from "vitest/config";

// One root config with one project per test layer (TEST_PLAN.md):
// - unit: pure code next to the source, no network, no database;
// - integration: real PostgreSQL (Testcontainers, or ELEARNING_TEST_DATABASE_URL),
//   one schema per test file.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["packages/*/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["packages/*/tests/integration/**/*.test.ts"],
          globalSetup: ["packages/db/tests/support/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      // bin.ts only forwards process arguments to the tested runCli.
      exclude: ["**/*.test.{ts,tsx}", "**/*.types.ts", "**/*.gen.ts", "**/index.ts", "**/bin.ts"],
      reporter: ["text-summary", "lcov"],
      // Per-layer floors (core/testing.mdc). They only go up.
      thresholds: {
        "packages/core/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "packages/db/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
      },
    },
  },
});
