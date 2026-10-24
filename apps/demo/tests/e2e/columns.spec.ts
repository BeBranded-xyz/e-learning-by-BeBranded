import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { addLesson, createVisibleCourse } from "./admin-steps";
import { expect, expectAccessible, test } from "./fixtures";

/** Writes a two-column lesson in the editor, widens the left column to 60%, and publishes. */
async function writeColumns(page: Page) {
  await page.getByRole("link", { name: "Layout" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Layout" })).toBeVisible();
  const editor = page.locator(".bn-editor");
  await editor.click();
  await page.keyboard.type("Before the columns");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/columns");
  await expect(page.getByRole("option", { name: "2 columns" })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Left side");
  await editor.locator(".el-column").nth(1).locator(".bn-inline-content").first().click();
  await page.keyboard.type("Right side");

  const handle = editor.getByRole("separator", { name: "Resize columns" }).first();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  await page.getByRole("button", { name: "Save the content" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.getByRole("form", { name: "Layout" }).getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("button", { name: "Back to draft" })).toBeVisible();
}

test.describe("columns", () => {
  test("an author lays a lesson out in columns, and learners read them", async ({
    page,
    signInAs,
  }, testInfo) => {
    test.setTimeout(120_000);
    const title = `Columns ${randomUUID().slice(0, 8)}`;
    await signInAs("admin");
    const courseUrl = await createVisibleCourse(page, title);
    await addLesson(page, "Basics", "Layout", "Text");
    await writeColumns(page);
    await page.goto(courseUrl);
    await page.getByRole("form", { name: title }).getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("form", { name: title }).getByText("Published")).toBeVisible();

    await signInAs("staff");
    await page.goto("/");
    await page.getByRole("link", { name: title }).click();
    await page.getByRole("link", { name: "Layout" }).click();
    const columns = page.locator(".el-columns > .el-column");
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0)).toHaveText("Left side");
    await expect(columns.nth(1)).toHaveText("Right side");
    await expect(columns.nth(0)).toHaveAttribute("data-width", "60");
    await expect(columns.nth(1)).toHaveAttribute("data-width", "40");
    await expectAccessible(page);

    const left = await columns.nth(0).boundingBox();
    const right = await columns.nth(1).boundingBox();
    if (left === null || right === null) throw new Error("columns are not laid out");
    if (testInfo.project.name === "mobile") {
      // Too narrow for two 14rem columns: they stack, in reading order.
      expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
    } else {
      expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
      expect(left.width / (left.width + right.width)).toBeCloseTo(0.6, 1);
    }
  });

  test("the seeded lesson shows its columns", async ({ page, signInAs }) => {
    await signInAs("staff");
    await page.goto("/training/workplace-safety");
    await page.getByRole("link", { name: "Fire procedures" }).click();

    await expect(page.locator(".el-columns > .el-column")).toHaveCount(2);
    await expect(page.getByRole("heading", { level: 3, name: "Don't" })).toBeVisible();
  });
});
