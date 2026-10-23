import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppError } from "@bebranded/elearning-core";
import { fakeVideoProvider } from "@bebranded/elearning-video/testing";

import { createTestApp, readJson } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

const WEBHOOK_SECRET = "fake-webhook-secret";
const provider = fakeVideoProvider({
  playbackUrl: (assetId) => `https://videos.example.com/${assetId}.m3u8`,
  webhookSecret: WEBHOOK_SECRET,
});

let t: TestApp;
let chapterId: string;

async function create(
  path: string,
  body: Record<string, unknown>,
  as: "admin" | "staff" = "admin",
) {
  const response = await t.request("POST", `/v1/admin/${path}`, { as, body });
  return { status: response.status, body: await readJson(response) };
}

async function aVideoLesson(settings: Record<string, unknown> = {}) {
  const lesson = await create("lessons", {
    chapter_id: chapterId,
    type: "video",
    title: "Video",
    position: 0,
    settings,
  });
  expect(lesson.status).toBe(201);
  return String(lesson.body.id);
}

function webhook(body: unknown, secret = WEBHOOK_SECRET) {
  return t.request("POST", "/v1/webhooks/video", {
    headers: { authorization: `Bearer ${secret}` },
    body,
  });
}

beforeAll(async () => {
  t = await createTestApp({ video: provider });
  const course = await create("courses", { slug: "videos", title: "Videos" });
  const chapter = await create("chapters", {
    course_id: String(course.body.id),
    title: "C",
    position: 0,
  });
  chapterId = String(chapter.body.id);
});

afterAll(async () => {
  await t.database.drop();
});

describe("video lessons", () => {
  it("creates a draft video lesson with its settings validated and completed", async () => {
    const lesson = await create("lessons", {
      chapter_id: chapterId,
      type: "video",
      title: "Intro",
      position: 0,
      settings: { allowSeeking: false },
    });

    expect(lesson.status).toBe(201);
    expect(lesson.body).toMatchObject({
      type: "video",
      status: "draft",
      video: null,
      settings: {
        allowSeeking: false,
        completionThreshold: 0.95,
        maxPlaybackRate: 2,
        pauseWhenHidden: false,
      },
    });
  });

  it.each([
    ["a playback rate over 4", "video", { maxPlaybackRate: 16 }],
    ["a text option on a video lesson", "video", { requireScrollToEnd: true }],
    ["a video option on a text lesson", "text", { allowSeeking: false }],
  ])("refuses %s", async (_name, type, settings) => {
    const lesson = await create("lessons", {
      chapter_id: chapterId,
      type,
      title: "Bad",
      position: 0,
      settings,
    });

    expect(lesson.status).toBe(400);
    expect(lesson.body).toMatchObject({ error: { code: "invalid_settings" } });
  });

  it("refuses to create a published video lesson, which has no video yet", async () => {
    const lesson = await create("lessons", {
      chapter_id: chapterId,
      type: "video",
      title: "Too early",
      position: 0,
      status: "published",
    });

    expect(lesson.status).toBe(409);
    expect(lesson.body).toMatchObject({ error: { code: "video_not_ready" } });
  });

  it("validates new settings against the lesson's type on update", async () => {
    const id = await aVideoLesson();

    const response = await t.request("PATCH", `/v1/admin/lessons/${id}`, {
      as: "admin",
      body: { settings: { maxPlaybackRate: 0.5 } },
    });

    expect(response.status).toBe(400);
  });
});

describe("POST /v1/admin/videos/uploads and the video webhook", () => {
  it("uploads, waits for the webhook, then publishes", async () => {
    const id = await aVideoLesson();

    const upload = await create("videos/uploads", { lesson_id: id, max_duration_seconds: 600 });
    const assetId = String(upload.body.upload_url).split("/").at(-1) ?? "";
    const tooEarly = await t.request("PATCH", `/v1/admin/lessons/${id}`, {
      as: "admin",
      body: { status: "published" },
    });
    const received = await webhook({ assetId, status: "ready", durationSeconds: 42 });
    const published = await t.request("PATCH", `/v1/admin/lessons/${id}`, {
      as: "admin",
      body: { status: "published" },
    });

    expect(upload.status).toBe(201);
    expect(upload.body.video).toMatchObject({ provider: "fake", status: "uploading" });
    expect(tooEarly.status).toBe(409);
    expect(await readJson(received)).toEqual({ received: true });
    expect(published.status).toBe(200);
    expect(await readJson(published)).toMatchObject({
      status: "published",
      video: { status: "ready", duration_seconds: 42 },
    });
  });

  it("replaces the lesson's video, keeping its id and deleting the old file", async () => {
    const id = await aVideoLesson();
    const first = await create("videos/uploads", { lesson_id: id });
    const firstAsset = String(first.body.upload_url).split("/").at(-1) ?? "";

    const second = await create("videos/uploads", { lesson_id: id });

    expect((second.body.video as { id: string }).id).toBe((first.body.video as { id: string }).id);
    expect(provider.assets.has(firstAsset)).toBe(false);
  });

  it("keeps the new upload when deleting the old file fails", async () => {
    const failing = createTestApp({
      video: { ...provider, deleteAsset: () => Promise.reject(new Error("provider down")) },
    });
    const app = await failing;
    const course = await app.request("POST", "/v1/admin/courses", {
      as: "admin",
      body: { slug: "fail", title: "F" },
    });
    const chapter = await app.request("POST", "/v1/admin/chapters", {
      as: "admin",
      body: { course_id: (await readJson(course)).id, title: "C", position: 0 },
    });
    const lesson = await app.request("POST", "/v1/admin/lessons", {
      as: "admin",
      body: { chapter_id: (await readJson(chapter)).id, type: "video", title: "V", position: 0 },
    });
    const lessonId = (await readJson(lesson)).id;
    const upload = () =>
      app.request("POST", "/v1/admin/videos/uploads", {
        as: "admin",
        body: { lesson_id: lessonId },
      });

    await upload();
    const replaced = await upload();

    expect(replaced.status).toBe(201);
    expect(app.logs.at(-1)).toMatchObject({
      level: "warn",
      message: "replaced video could not be deleted at the provider",
    });
    await app.database.drop();
  });

  it.each([
    ["a text lesson", "text", 409, "not_a_video_lesson"],
    ["a missing lesson", "missing", 404, "not_found"],
  ])("refuses an upload for %s", async (_name, kind, status, code) => {
    const lessonId =
      kind === "missing"
        ? "00000000-0000-4000-8000-000000000000"
        : String(
            (await create("lessons", { chapter_id: chapterId, title: "T", position: 0 })).body.id,
          );

    const upload = await create("videos/uploads", { lesson_id: lessonId });

    expect(upload.status).toBe(status);
    expect(upload.body).toMatchObject({ error: { code } });
  });

  it("refuses uploads to non-admins and invalid durations", async () => {
    const id = await aVideoLesson();

    expect((await create("videos/uploads", { lesson_id: id }, "staff")).status).toBe(403);
    expect(
      (await create("videos/uploads", { lesson_id: id, max_duration_seconds: 0 })).status,
    ).toBe(400);
  });

  it("answers 502 when the provider cannot create an upload", async () => {
    const id = await aVideoLesson();
    vi.spyOn(provider, "createDirectUpload").mockRejectedValueOnce(
      new AppError("upstream", "video_provider_timeout", "timeout"),
    );

    const upload = await create("videos/uploads", { lesson_id: id });

    expect(upload.status).toBe(502);
    // 5xx answers stay generic; the real code goes to the logs with the request id.
    expect(upload.body).toMatchObject({ error: { code: "internal_error" } });
    expect(t.logs.at(-1)?.meta?.error).toMatchObject({ code: "video_provider_timeout" });
  });

  it("rejects a webhook with a bad signature and logs it as an error", async () => {
    const response = await webhook({ assetId: "x", status: "ready" }, "forged");

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ error: { code: "invalid_signature" } });
    expect(
      t.logs.some(
        (log) => log.level === "error" && log.message === "video webhook signature rejected",
      ),
    ).toBe(true);
  });

  it("acknowledges a verified webhook for an unknown asset", async () => {
    const response = await webhook({ assetId: "unknown", status: "ready", durationSeconds: 1 });

    expect(response.status).toBe(200);
    expect(t.logs.at(-1)).toMatchObject({ level: "warn", message: "video webhook ignored" });
  });

  it("refuses other methods on the webhook route", async () => {
    expect((await t.request("GET", "/v1/webhooks/video")).status).toBe(405);
  });
});

describe("without a video provider", () => {
  let bare: TestApp;

  beforeAll(async () => {
    bare = await createTestApp();
  });

  afterAll(async () => {
    await bare.database.drop();
  });

  it("has no webhook route and answers uploads with a configuration error", async () => {
    const course = await bare.request("POST", "/v1/admin/courses", {
      as: "admin",
      body: { slug: "none", title: "N" },
    });
    const chapter = await bare.request("POST", "/v1/admin/chapters", {
      as: "admin",
      body: { course_id: (await readJson(course)).id, title: "C", position: 0 },
    });
    const lesson = await bare.request("POST", "/v1/admin/lessons", {
      as: "admin",
      body: { chapter_id: (await readJson(chapter)).id, type: "video", title: "V", position: 0 },
    });

    const upload = await bare.request("POST", "/v1/admin/videos/uploads", {
      as: "admin",
      body: { lesson_id: (await readJson(lesson)).id },
    });
    const hook = await bare.request("POST", "/v1/webhooks/video", { body: {} });

    expect(upload.status).toBe(500);
    expect(await readJson(upload)).toMatchObject({ error: { code: "internal_error" } });
    expect(bare.logs.find((log) => log.level === "error")?.meta?.error).toMatchObject({
      code: "video_provider_not_configured",
    });
    expect(hook.status).toBe(404);
  });
});
