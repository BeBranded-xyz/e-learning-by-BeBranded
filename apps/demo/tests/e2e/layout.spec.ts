import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Spacing and layout from the design system (spec 11, "Spacing"), checked in a
// real browser under the shell's CSS reset, on desktop and mobile.

/** The design's spacing unit in pixels, as the module's root computes it. */
async function spaceUnit(page: Page): Promise<number> {
  return page
    .locator(".el-root")
    .first()
    .evaluate((root) => {
      const probe = document.createElement("div");
      probe.style.width = "var(--el-space-unit)";
      root.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    });
}

/** The vertical gap between each child of `container` and the next one, in pixels. */
async function gapsBetweenChildren(container: Locator): Promise<number[]> {
  return container.evaluate((element) => {
    const boxes = [...element.children]
      .map((child) => child.getBoundingClientRect())
      .filter((box) => box.height > 0);
    return boxes.slice(1).map((box, index) => Math.round(box.top - (boxes[index]?.bottom ?? 0)));
  });
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("layout", () => {
  test("learner pages keep one step of space between blocks and never scroll sideways", async ({
    page,
    signInAs,
  }) => {
    await signInAs("staff");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Workplace safety", exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Workplace safety", exact: true }).click();
    await expect(page.getByText("0 of 2 required lessons done")).toBeVisible();
    const step = (await spaceUnit(page)) * 4;

    expect(step).toBe(16);
    expect(
      Math.min(...(await gapsBetweenChildren(page.locator(".el-course-header")))),
    ).toBeGreaterThanOrEqual(step);
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Welcome", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Why safety matters" })).toBeVisible();
    expect(
      Math.min(...(await gapsBetweenChildren(page.locator(".el-lesson")))),
    ).toBeGreaterThanOrEqual(step);
    await expectNoHorizontalScroll(page);
  });

  test("back-office pages line fields up and never scroll sideways", async ({ page, signInAs }) => {
    await signInAs("admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Edit Fire safety check", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Fire safety check" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    // Each field of an inline form keeps its label above its control, whatever the row wraps to.
    await page.getByRole("tab", { name: "Access", exact: true }).click();
    const assign = page.getByRole("form", { name: "Assign" });
    const label = await assign.getByText("Role", { exact: true }).boundingBox();
    const input = await assign.getByLabel("Role").boundingBox();

    expect(Math.round(label?.x ?? 0)).toBe(Math.round(input?.x ?? -1));
    expect(label?.y ?? 0).toBeLessThan(input?.y ?? -1);

    await page.getByRole("tab", { name: "Structure", exact: true }).click();
    await page.getByRole("link", { name: "Fire safety quiz", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Fire safety quiz" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
