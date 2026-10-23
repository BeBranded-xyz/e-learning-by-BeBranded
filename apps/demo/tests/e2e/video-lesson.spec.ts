import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, expectAccessible, test } from "./fixtures";

const LESSON = "Using a fire extinguisher";

/** Opens the video lesson and waits until the stream is ready to play. */
async function openVideoLesson(page: Page): Promise<string> {
  await page.goto("/training/video-basics");
  await page.getByRole("link", { name: LESSON }).click();
  const video = page.getByLabel(`Video: ${LESSON}`);
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(1);
  return page.url().split("/").at(-1) ?? "";
}

/** Plays muted (allowed without a gesture) at the lesson's top speed. */
function play(page: Page, rate = 2) {
  return page.getByLabel(`Video: ${LESSON}`).evaluate(async (element: HTMLVideoElement, speed) => {
    element.muted = true;
    element.playbackRate = speed;
    await element.play();
  }, rate);
}

test.describe("video lesson", () => {
  test("watching the whole video completes the lesson", async ({ page, signInAs }) => {
    test.setTimeout(60_000);
    await signInAs("staff");
    await openVideoLesson(page);
    await expectAccessible(page);

    await play(page);

    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByText(/\d+% watched/)).toHaveText(/^(9[5-9]|100)% watched/);
    await page.getByRole("link", { name: "Back to the course" }).click();
    await expect(page.getByText("Course completed")).toBeVisible();
  });

  test("skipping ahead is refused and does not count", async ({ page, signInAs }) => {
    await signInAs("staff");
    await openVideoLesson(page);
    const video = page.getByLabel(`Video: ${LESSON}`);
    await play(page, 1);
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
      .toBeGreaterThan(1);

    await video.evaluate((element: HTMLVideoElement) => {
      element.currentTime = 28;
    });

    await expect(page.getByText(/You can't skip ahead in this video./)).toBeVisible();
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
      .toBeLessThan(10);
    await video.evaluate((element: HTMLVideoElement) => {
      element.pause();
    });
    await expect(page.getByText(/^\d+% watched/)).not.toHaveText(/^(9[5-9]|100)%/);
    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeHidden();
  });

  test("a forged claim of the whole video is truncated by the server", async ({
    page,
    signInAs,
    baseURL,
  }) => {
    await signInAs("staff");
    const lessonId = await openVideoLesson(page);

    const response = await page.request.post(
      `/api/elearning/v1/lessons/${lessonId}/video-progress`,
      {
        headers: { origin: baseURL ?? "" },
        data: {
          session_id: randomUUID(),
          seq: 0,
          ranges: [[0, 30]],
          position: 30,
          playback_rate: 16,
        },
      },
    );
    const body = (await response.json()) as {
      status: string;
      progress: { watched_seconds: number };
    };

    expect(response.status()).toBe(200);
    expect(body.status).toBe("in_progress");
    expect(body.progress.watched_seconds).toBeLessThan(30);
    await page.reload();
    await expect(page.getByLabel(`Video: ${LESSON}`)).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Lesson done" })).toBeHidden();
  });

  test("the player caps the speed at the lesson's maximum", async ({ page, signInAs }) => {
    await signInAs("staff");
    await openVideoLesson(page);
    const video = page.getByLabel(`Video: ${LESSON}`);

    await video.evaluate((element: HTMLVideoElement) => {
      element.playbackRate = 16;
    });

    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.playbackRate))
      .toBe(2);
  });

  test("the demo video route serves only its own files", async ({ request }) => {
    const playlist = await request.get("/demo-video/video.m3u8");
    const traversal = await request.get("/demo-video/..%2F..%2Fpackage.json");
    const unknown = await request.get("/demo-video/seg99.m4s");

    expect(playlist.status()).toBe(200);
    expect(playlist.headers()["content-type"]).toBe("application/vnd.apple.mpegurl");
    expect(traversal.status()).toBe(404);
    expect(unknown.status()).toBe(404);
  });
});
