import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { addLesson, createVisibleCourse } from "./admin-steps";
import { expect, test } from "./fixtures";

/** Drags a block by BlockNote's handle and drops it at a point of `target` (fractions of its box). */
async function dragBlock(
  page: Page,
  block: Locator,
  target: Locator,
  at: { x: number; y: number },
) {
  await block.hover();
  const handle = page.locator('.bn-side-menu [draggable="true"]');
  await expect(handle).toBeVisible();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (from === null || to === null) throw new Error("nothing to drag");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width * at.x, to.y + to.height * at.y, { steps: 12 });
  await page.mouse.up();
}

const paragraph = (editor: Locator, text: string) =>
  editor
    .locator(".bn-block-outer")
    .filter({ has: editor.page().getByText(text, { exact: true }) })
    .last();

test.describe("columns by dragging", () => {
  // SKIP(B-062): dragging blocks needs a pointer; BlockNote shows no drag handle on touch screens.
  test.skip(({ isMobile }) => isMobile, "Drag handles need a pointer");

  test("an author drops blocks on an edge, between columns, resizes and removes a column", async ({
    page,
    signInAs,
  }) => {
    test.setTimeout(120_000);
    await signInAs("admin");
    await createVisibleCourse(page, `Drag ${randomUUID().slice(0, 8)}`);
    await addLesson(page, "Basics", "Layout", "Text");
    await page.getByRole("link", { name: "Layout", exact: true }).click();
    const editor = page.locator(".bn-editor");
    await editor.click();
    for (const text of ["First", "Second", "Third"]) {
      await page.keyboard.type(text);
      await page.keyboard.press("Enter");
    }

    // Dropping "Third" on the right edge of "First" makes two columns.
    await dragBlock(page, paragraph(editor, "Third"), paragraph(editor, "First"), {
      x: 0.95,
      y: 0.5,
    });
    const columns = editor.locator(".el-columns > .el-column");
    await expect(columns).toHaveCount(2);
    await expect(columns.nth(0)).toContainText("First");
    await expect(columns.nth(1)).toContainText("Third");

    // BlockNote's own drag moves "Second" into the right column, under "Third".
    await dragBlock(page, paragraph(editor, "Second"), paragraph(editor, "Third"), {
      x: 0.5,
      y: 0.9,
    });
    await expect(columns.nth(1)).toContainText("Second");
    await expect(columns.nth(0)).not.toContainText("Second");

    // The resize handle moves width from the right column to the left one.
    const resize = editor.getByRole("separator", { name: "Resize the columns" }).first();
    const box = await resize.boundingBox();
    if (box === null) throw new Error("no resize handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const grow = (index: number) =>
      columns.nth(index).evaluate((element: HTMLElement) => Number(element.style.flexGrow));
    expect(await grow(0)).toBeGreaterThan(await grow(1));

    await page.getByRole("button", { name: "Save the content" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    // Deleting the left column's only block removes it; one column left dissolves the list.
    await paragraph(editor, "First").hover();
    await page.locator('.bn-side-menu [draggable="true"]').click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(editor.locator(".el-columns")).toHaveCount(0);
    await expect(editor).toContainText("Third");
    await expect(editor).toContainText("Second");

    await page.getByRole("button", { name: "Save the content" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  });
});
