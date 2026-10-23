import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** Critical journeys on desktop and mobile viewports (core/testing.mdc). */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI === "true",
  retries: 0,
  reporter: process.env.CI === "true" ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT.toString()}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `next start --port ${PORT.toString()} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT.toString()}/sign-in`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
