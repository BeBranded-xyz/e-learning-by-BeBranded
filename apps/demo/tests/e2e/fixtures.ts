import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

type Persona = "staff" | "manager" | "admin";

/** Signs in as a demo persona with a fresh learner id, so tests never share progress. */
export const test = base.extend<{
  signInAs: (persona: Persona) => Promise<void>;
  feedbackStub: undefined;
}>({
  feedbackStub: [
    async ({ context }, use) => {
      await context.route("https://app.usedashly.com/widget/v1.js", (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: 'document.documentElement.dataset.feedbackLoaded = "true";',
        }),
      );
      await use(undefined);
    },
    { auto: true },
  ],
  signInAs: async ({ context, baseURL }, use) => {
    await use(async (persona) => {
      const url = baseURL ?? "";
      await context.addCookies([
        { name: "demo_persona", value: persona, url },
        { name: "demo_learner_suffix", value: randomUUID().replaceAll("-", "").slice(0, 16), url },
      ]);
    });
  },
});

export { expect };

/** Fails on any WCAG 2.x A or AA violation found by axe. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}
