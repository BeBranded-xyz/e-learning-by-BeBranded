import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, expectAccessible, test } from "./fixtures";

// A 1x1 PNG, generated: synthetic content only.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function createCourse(page: Page, title: string): Promise<string> {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
  const form = page.getByRole("form", { name: "New course" });
  await form.getByLabel("Title").fill(title);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  return page.url();
}

async function addLesson(page: Page, chapter: string, title: string, type: "Text" | "Quiz") {
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

async function buildCourse(page: Page, title: string): Promise<string> {
  const courseUrl = await createCourse(page, title);
  const rules = page.getByRole("region", { name: "Who can see it" }).first();
  await rules.getByRole("button", { name: "Add a rule" }).click();
  await expect(rules.getByText("Allow: Everyone")).toBeVisible();
  await page.getByLabel("New chapter title").fill("Basics");
  await page.getByRole("button", { name: "Add a chapter" }).click();
  const chapter = page.getByRole("listitem", { name: "Basics" });
  await chapter.getByRole("button", { name: "Publish" }).click();
  await expect(chapter.getByRole("button", { name: "Back to draft" })).toBeVisible();
  await addLesson(page, "Basics", "Welcome", "Text");
  await addLesson(page, "Basics", "Check", "Quiz");
  return courseUrl;
}

async function writeTextLesson(page: Page) {
  await page.getByRole("link", { name: "Welcome" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Welcome" })).toBeVisible();
  const editor = page.locator(".bn-editor");
  await editor.click();
  await page.keyboard.type("Hello from the editor");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/image");
  await page.keyboard.press("Enter");
  await page
    .locator(".bn-file-panel input[type=file], .bn-panel input[type=file]")
    .first()
    .setInputFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
  await expect(editor.locator("img")).toHaveCount(1);
  await page.getByRole("button", { name: "Save the content" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page
    .getByRole("form", { name: "Welcome" })
    .getByRole("button", { name: "Publish" })
    .click();
  await expect(page.getByRole("button", { name: "Back to draft" })).toBeVisible();
}

async function writeQuizLesson(page: Page, courseUrl: string) {
  await page.goto(courseUrl);
  await page.getByRole("link", { name: "Check" }).click();
  await page.locator(".bn-editor").click();
  await page.keyboard.type("/true or false");
  await page.keyboard.press("Enter");
  await page.keyboard.type("The meeting point is outside");
  const panel = page.getByRole("complementary", { name: "Question settings" });
  await expect(
    panel.getByRole("group", { name: /Question 1: The meeting point is outside/ }),
  ).toBeVisible();
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/quiz") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save the questions" }).click();
  const answer = await saved;
  expect(answer.status(), await answer.text()).toBe(200);
  await expect(page.getByText("1 question(s) saved.")).toBeVisible();
  await page.getByRole("form", { name: "Check" }).getByRole("button", { name: "Publish" }).click();
  await expect(
    page.getByRole("form", { name: "Check" }).getByRole("button", { name: "Back to draft" }),
  ).toBeVisible();
}

test.describe("back-office", () => {
  test("only the training admin opens it", async ({ page, signInAs }) => {
    await signInAs("staff");
    await page.goto("/admin");

    await expect(page.getByText("Only the training admin can open the back-office.")).toBeVisible();
  });

  test("an admin builds a course without code, and a learner takes it", async ({
    page,
    signInAs,
  }) => {
    test.setTimeout(120_000);
    const title = `Onboarding ${randomUUID().slice(0, 8)}`;
    await signInAs("admin");
    const courseUrl = await buildCourse(page, title);
    await expectAccessible(page);

    await page.getByRole("button", { name: "Move Check up" }).click();
    await expect(
      page.getByRole("listitem", { name: "Basics" }).getByRole("link").first(),
    ).toHaveText("Check");

    await writeTextLesson(page);
    await writeQuizLesson(page, courseUrl);
    await page.goto(courseUrl);
    await page.getByRole("form", { name: title }).getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("form", { name: title }).getByText("Published")).toBeVisible();

    await signInAs("staff");
    await page.goto("/");
    await page.getByRole("link", { name: title }).click();
    await page.getByRole("link", { name: "Welcome" }).click();
    await expect(page.getByText("Hello from the editor")).toBeVisible();
    // The picture loads lazily, so below the fold (mobile) it loads only once scrolled to.
    // The lesson may re-render meanwhile: every poll finds the picture again.
    await expect
      .poll(() =>
        page.locator(".el-figure img").evaluate((img: HTMLImageElement) => {
          img.scrollIntoView();
          return img.naturalWidth;
        }),
      )
      .toBe(1);
    await page.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeVisible();

    await signInAs("admin");
    await page.goto(courseUrl);
    const tracking = page.getByRole("region", { name: "Tracking" });
    await expect(tracking.getByRole("table")).toContainText("demo-staff-");
    const csv = await page.request.get(
      (await tracking.getByRole("link", { name: "Download CSV" }).getAttribute("href")) ?? "",
    );
    expect(csv.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(await csv.text()).toContain("demo-staff-");
  });
});
