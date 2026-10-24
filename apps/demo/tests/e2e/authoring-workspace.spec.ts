import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addLesson, createVisibleCourse } from "./admin-steps";
import { expect, expectAccessible, test } from "./fixtures";

const section = async (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true }).click();

async function videoFixture() {
  const dir = path.join(process.cwd(), ".demo-video-test");
  return Buffer.concat(
    await Promise.all([
      readFile(path.join(dir, "opening-init.mp4")),
      readFile(path.join(dir, "opening-seg00.m4s")),
    ]),
  );
}

test("an author builds, configures and previews a draft course with a real upload", async ({
  page,
  signInAs,
}, info) => {
  test.setTimeout(120_000);
  await signInAs("admin");
  const title = `Authoring ${randomUUID().slice(0, 8)}`;
  const courseUrl = await createVisibleCourse(page, title);
  await addLesson(page, "Basics", "Read this first", "Text");
  await addLesson(page, "Basics", "Watch the demonstration", "Video");
  await expectAccessible(page);
  await page.getByRole("link", { name: "Read this first", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Content", exact: true });
  await editor.click();
  await page.keyboard.type("A clear introduction for learners.");
  await page.getByRole("button", { name: "Save the content" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await section(page, "Preview");
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  await expect(preview.getByText("A clear introduction for learners.")).toBeVisible();
  await preview.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Mobile", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectAccessible(page);
  await page.screenshot({ path: info.outputPath("lesson-preview.png"), fullPage: true });

  await page.goto(courseUrl);
  await section(page, "Completion");
  await page.getByLabel("Complete the course when").selectOption("percentage");
  await page.getByLabel("Required course completion (%)").fill("80");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await section(page, "Structure");
  await page.getByRole("link", { name: "Watch the demonstration", exact: true }).click();
  const uploadResponse = page.waitForResponse(
    (response) => response.url().includes("/demo-media/") && response.request().method() === "POST",
  );
  await page
    .getByLabel("Choose a video file")
    .setInputFiles({ name: "demo.mp4", mimeType: "video/mp4", buffer: await videoFixture() });
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(200);
  await expect(page.getByText(/The video is ready/)).toBeVisible({ timeout: 90_000 });
  await section(page, "Completion");
  await page.getByLabel("Video that must be watched (%)").fill("80");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await section(page, "Preview");
  const video = page.locator(".el-author-preview video");
  await expect(video).toBeVisible();
  await video.evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
  });
  await expect
    .poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThan(0);
  await video.evaluate((video: HTMLVideoElement) => {
    video.pause();
  });
  await expectAccessible(page);
  await page.screenshot({ path: info.outputPath("video-preview.png"), fullPage: true });
  await page.goto(courseUrl);
  await expect(
    page.locator(".el-author-heading").getByText("Draft", { exact: true }),
  ).toBeVisible();
});

test("upload and preview endpoints reject unsigned media and non-admin requests", async ({
  page,
  signInAs,
}) => {
  await signInAs("staff");
  await page.goto("/");
  const id = randomUUID();
  const upload = await page.request.post(`/demo-media/${id}/upload`, {
    data: "invalid",
    headers: { origin: "https://evil.example.com" },
  });
  expect(upload.status()).toBe(403);
  expect((await page.request.get(`/demo-media/${id}/video.m3u8`)).status()).toBe(404);
  const preview = await page.request.get(`/api/elearning/v1/admin/lessons/${id}/preview`);
  expect(preview.status()).toBe(403);
});
