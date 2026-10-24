import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import type { Download, Page } from "@playwright/test";

import { addLesson, createVisibleCourse } from "./admin-steps";
import { expect, expectAccessible, test } from "./fixtures";

/**
 * Clicks a download button until the file arrives. The server prepares at most
 * 2 exports at once per tenant and answers export_busy beyond; desktop and
 * mobile journeys run at the same time, so a click may need a second try,
 * as a learner would do.
 */
async function downloaded(page: Page, click: () => Promise<void>): Promise<Download> {
  let file: Download | undefined;
  await expect(async () => {
    const download = page.waitForEvent("download", { timeout: 10_000 });
    await click();
    file = await download;
  }).toPass({ timeout: 75_000 });
  if (file === undefined) throw new Error("no download");
  return file;
}

const head = async (download: Download, length: number) =>
  (await readFile(await download.path())).subarray(0, length).toString("latin1");

test.describe("exports", () => {
  test("a learner downloads the course as PDF and a lesson as Word", async ({ page, signInAs }) => {
    test.setTimeout(90_000);
    await signInAs("staff");
    await page.goto("/training/workplace-safety");
    const course = page.getByRole("group", { name: "Download the course" });
    await expect(course).toBeVisible();
    await expectAccessible(page);

    const pdf = await downloaded(page, () =>
      course.getByRole("button", { name: "Download PDF" }).click(),
    );
    expect(pdf.suggestedFilename()).toBe("workplace-safety.pdf");
    expect(await head(pdf, 5)).toBe("%PDF-");

    await page.getByRole("link", { name: "Fire procedures", exact: true }).click();
    const lesson = page.getByRole("group", { name: "Download the lesson" });
    const word = await downloaded(page, () =>
      lesson.getByRole("button", { name: "Download Word (.docx)" }).click(),
    );
    expect(word.suggestedFilename()).toMatch(/^workplace-safety-[0-9a-f]{8}\.docx$/);
    expect(await head(word, 2)).toBe("PK");
  });

  test("a course that does not allow it offers no download, and the API refuses", async ({
    page,
    signInAs,
  }) => {
    await signInAs("staff");
    await page.goto("/training/fire-safety-check");
    await expect(page.getByRole("heading", { level: 1, name: "Fire safety check" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Download the course" })).toHaveCount(0);

    const course = (await (
      await page.request.get("/api/elearning/v1/courses/fire-safety-check")
    ).json()) as { id: string; export_formats: string[] };
    const refused = await page.request.get(
      `/api/elearning/v1/courses/${course.id}/export?format=pdf`,
    );

    expect(course.export_formats).toEqual([]);
    expect(refused.status()).toBe(403);
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe(
      "export_not_allowed",
    );
  });

  test("an admin downloads a draft course and lesson, and lets learners download it", async ({
    page,
    signInAs,
  }) => {
    test.setTimeout(90_000);
    const title = `Export ${randomUUID().slice(0, 8)}`;
    await signInAs("admin");
    const courseUrl = await createVisibleCourse(page, title);

    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    const word = await downloaded(page, () =>
      page
        .getByRole("group", { name: "Download the course" })
        .getByRole("button", { name: "Download Word (.docx)" })
        .click(),
    );
    expect(await head(word, 2)).toBe("PK");

    await page.getByRole("tab", { name: "Structure", exact: true }).click();
    await addLesson(page, "Basics", "Draft notes", "Text");
    await page.getByRole("link", { name: "Draft notes", exact: true }).click();
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    const lessonPdf = await downloaded(page, () =>
      page
        .getByRole("group", { name: "Download the lesson" })
        .getByRole("button", { name: "Download PDF" })
        .click(),
    );
    expect(await head(lessonPdf, 5)).toBe("%PDF-");
    await page.goto(courseUrl);

    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("form", { name: title });
    await settings.getByRole("checkbox", { name: /Learners can download/ }).check();
    await settings.getByRole("button", { name: "Save" }).click();
    await expect(settings.getByText("Saved")).toBeVisible();
    await settings.getByRole("button", { name: "Publish" }).click();
    await expect(settings.getByText("Published")).toBeVisible();

    await signInAs("staff");
    await page.goto("/");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("group", { name: "Download the course" })).toBeVisible();
  });
});
