import { defineConfig } from "vitest/config";

// One root config with one project per test layer (TEST_PLAN.md):
// - unit: pure code next to the source, no network, no database;
// - integration: real PostgreSQL (Testcontainers, or ELEARNING_TEST_DATABASE_URL).
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
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.types.ts", "**/index.ts"],
      reporter: ["text-summary", "lcov"],
      // Per-layer floors (core/testing.mdc). They only go up.
      thresholds: {
        "packages/core/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
      },
    },
  },
});
