import type { Page } from "@playwright/test";

import { expect } from "./fixtures";

// Back-office steps shared by the journeys: they drive the admin UI like an author.

async function createCourse(page: Page, title: string): Promise<string> {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
  await page.locator(".el-author-create-card").click();
  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  const form = page.getByRole("form", { name: "New course" });
  await form.getByLabel("Title").fill(title);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  return page.url();
}

export async function addLesson(
  page: Page,
  chapter: string,
  title: string,
  type: "Text" | "Quiz" | "Video",
) {
  const item = page.getByRole("listitem", { name: chapter });
  const disclosure = item.locator(".el-author-add-lesson");
  if (!(await disclosure.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await disclosure.locator("summary").click();
  }
  await item.getByLabel("New lesson title").fill(title);
  await item.getByLabel("Lesson type").selectOption({ label: type });
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/admin/lessons") && response.request().method() === "POST",
  );
  await item.getByRole("button", { name: "Add a lesson" }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  await expect(item.getByRole("link", { name: title })).toBeVisible();
}

/** A course everyone can see, with a published "Basics" chapter; answers its admin URL. */
export async function createVisibleCourse(page: Page, title: string): Promise<string> {
  const courseUrl = await createCourse(page, title);
  await page.getByRole("tab", { name: "Access", exact: true }).click();
  const rules = page.getByRole("region", { name: "Access", exact: true });
  await rules.getByRole("button", { name: "Add a rule" }).click();
  await expect(rules.getByText("Allow: Everyone")).toBeVisible();
  await page.getByRole("tab", { name: "Structure", exact: true }).click();
  await page.getByLabel("New chapter title").fill("Basics");
  await page.getByRole("button", { name: "Add a chapter" }).click();
  const chapter = page.getByRole("listitem", { name: "Basics" });
  await chapter.getByLabel("Actions for Basics", { exact: true }).click();
  await chapter.getByRole("button", { name: "Publish" }).click();
  await expect(chapter.getByText("Published", { exact: true })).toBeVisible();
  await expect(chapter.locator(".el-chapter-actions")).not.toHaveAttribute("open", "");
  return courseUrl;
}
