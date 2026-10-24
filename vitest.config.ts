import { fileURLToPath } from "node:url";

import { defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

// Workspace packages resolve to their TypeScript sources through this export
// condition, so tests never depend on a previous build. Published consumers
// do not set it and get `dist`.
const sourceCondition = "@bebranded/source";

// One root config with one project per test layer (TEST_PLAN.md):
// - unit: pure code next to the source, no network, no database;
// - integration: real PostgreSQL (Testcontainers, or ELEARNING_TEST_DATABASE_URL),
//   one schema per test file.
export default defineConfig({
  resolve: { conditions: [sourceCondition, ...defaultServerConditions] },
  ssr: { resolve: { conditions: [sourceCondition, ...defaultServerConditions] } },
  test: {
    // Bound browser-emulation memory and contention on developer machines and CI.
    maxWorkers: 4,
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
          name: "component",
          environment: "jsdom",
          include: ["packages/*/src/**/*.test.tsx"],
          setupFiles: ["packages/react/tests/setup.ts", "packages/admin/tests/setup.ts"],
          // jsdom with BlockNote editors and axe audits of whole pages: a full parallel run
          // took a page audit past the 5 s default (CourseAdmin, 5.4 s).
          testTimeout: 15_000,
        },
      },
      {
        // The demo's shadcn kit and registry (spec 11); `@/` is the demo's root, as in its tsconfig.
        resolve: { alias: { "@": fileURLToPath(new URL("./apps/demo", import.meta.url)) } },
        test: {
          name: "demo",
          environment: "jsdom",
          include: ["apps/demo/{registry,lib}/**/*.test.{ts,tsx}"],
          setupFiles: ["packages/react/tests/setup.ts"],
          testTimeout: 15_000,
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
      // bin.ts only forwards process arguments to the tested runCli; browser-guard.ts only
      // throws, and is what browser bundles get instead of the server entry points.
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.types.ts",
        "**/*.gen.ts",
        "**/index.ts",
        "**/bin.ts",
        "**/browser-guard.ts",
      ],
      reporter: ["text-summary", "lcov"],
      // Per-layer floors (core/testing.mdc). They only go up.
      thresholds: {
        "packages/core/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "packages/db/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "packages/editor/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "packages/video/src/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "packages/export/src/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        "packages/server/src/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "packages/next/src/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "packages/react/src/**": { lines: 85, branches: 85, functions: 85, statements: 85 },
        "packages/admin/src/**": { lines: 85, branches: 85, functions: 85, statements: 85 },
      },
    },
  },
});
