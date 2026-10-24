import type { Page } from "@playwright/test";

import { expect } from "./fixtures";

// Back-office steps shared by the journeys: they drive the admin UI like an author.

async function createCourse(page: Page, title: string): Promise<string> {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
  const form = page.getByRole("form", { name: "New course" });
  await form.getByLabel("Title").fill(title);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  return page.url();
}

export async function addLesson(page: Page, chapter: string, title: string, type: "Text" | "Quiz") {
  const item = page.getByRole("listitem", { name: chapter });
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
  const rules = page.getByRole("region", { name: "Who can see it" }).first();
  await rules.getByRole("button", { name: "Add a rule" }).click();
  await expect(rules.getByText("Allow: Everyone")).toBeVisible();
  await page.getByLabel("New chapter title").fill("Basics");
  await page.getByRole("button", { name: "Add a chapter" }).click();
  const chapter = page.getByRole("listitem", { name: "Basics" });
  await chapter.getByRole("button", { name: "Publish" }).click();
  await expect(chapter.getByRole("button", { name: "Back to draft" })).toBeVisible();
  return courseUrl;
}
