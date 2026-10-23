import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LessonDetail } from "@bebranded/elearning-core";
import { fakeVideoProvider } from "@bebranded/elearning-video/testing";

import { aChapter, aCourse, aLesson, aVideoAsset } from "../../../db/tests/support/factories.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

const scope = { tenantId: tenant, includeShared: false };
const provider = fakeVideoProvider({
  playbackUrl: (assetId) => `https://videos.example.com/${assetId}/video.m3u8`,
  webhookSecret: "fake-webhook-secret",
});

let t: TestApp;
let lessons: Record<"free" | "strict" | "pending" | "text" | "hidden", LessonDetail>;

beforeAll(async () => {
  t = await createTestApp({ video: provider });
  const course = aCourse(tenant, { slug: "video-course" });
  const chapter = aChapter(course);
  const videoLesson = (position: number, settings = {}) =>
    aLesson(chapter, { position, type: "video", content: null, settings });
  lessons = {
    free: videoLesson(0),
    strict: videoLesson(1, { allowSeeking: false, maxPlaybackRate: 1, completionThreshold: 0.9 }),
    pending: videoLesson(2),
    text: aLesson(chapter, { position: 3 }),
    hidden: videoLesson(4),
  };
  await seed(t.database, [
    {
      course,
      chapters: [chapter],
      lessons: Object.values(lessons),
      rules: [
        rule(course, "course", "allow"),
        rule(lessons.hidden, "lesson", "allow", { type: "role", role: "manager" }),
      ],
    },
  ]);
  await t.database.storage.transaction(async (tx) => {
    for (const lesson of [lessons.free, lessons.strict, lessons.hidden]) {
      const ready = { status: "ready", durationSeconds: 60 } as const;
      await tx.saveVideoAsset(scope, aVideoAsset(lesson, { ...ready, providerAssetId: lesson.id }));
    }
    await tx.saveVideoAsset(scope, aVideoAsset(lessons.pending));
  });
});

afterAll(async () => {
  await t.database.drop();
});

type Beat = { session?: string; seq: number; ranges: [number, number][]; position?: number };

function heartbeat(lesson: LessonDetail, beat: Beat, as: "staff" | "manager" = "staff") {
  return t.request("POST", `/v1/lessons/${lesson.id}/video-progress`, {
    as,
    body: {
      session_id: beat.session ?? SESSION,
      seq: beat.seq,
      ranges: beat.ranges,
      position: beat.position ?? beat.ranges.at(-1)?.[1] ?? 0,
      playback_rate: 1,
    },
  });
}

const SESSION = randomUUID();

async function start(lesson: LessonDetail, as: "staff" | "manager" = "staff") {
  expect((await t.request("POST", `/v1/lessons/${lesson.id}/start`, { as })).status).toBe(200);
}

describe("GET /v1/lessons/:id for a video lesson", () => {
  it("returns a signed playback URL, the video's duration, empty progress and default settings", async () => {
    const response = await t.request("GET", `/v1/lessons/${lessons.free.id}`, { as: "manager" });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({
      completionThreshold: 0.95,
      allowSeeking: true,
      maxPlaybackRate: 2,
      pauseWhenHidden: false,
    });
    expect(body.video).toEqual({
      status: "ready",
      duration_seconds: 60,
      thumbnail_url: null,
      captions: [],
      playback: {
        type: "hls",
        url: `https://videos.example.com/${lessons.free.id}/video.m3u8`,
        expires_at: expect.any(String) as string,
      },
      progress: { watched_seconds: 0, coverage: 0, last_position: 0, watched_ranges: [] },
    });
  });

  it("gives no playback URL while the video is processing", async () => {
    const body = await readJson(
      await t.request("GET", `/v1/lessons/${lessons.pending.id}`, { as: "staff" }),
    );

    expect(body.video).toMatchObject({ status: "uploading", playback: null });
  });

  it("has no video block for a text lesson", async () => {
    const body = await readJson(
      await t.request("GET", `/v1/lessons/${lessons.text.id}`, { as: "staff" }),
    );

    expect(body.video).toBeNull();
  });
});

describe("POST /v1/lessons/:id/video-progress", () => {
  it("credits honest playback, ignores a replayed heartbeat, then completes the lesson", async () => {
    await start(lessons.free);
    t.advance(15_000);

    const firstBeat = await readJson(await heartbeat(lessons.free, { seq: 0, ranges: [[0, 15]] }));
    const replay = await readJson(await heartbeat(lessons.free, { seq: 0, ranges: [[0, 15]] }));

    expect(firstBeat).toMatchObject({ accepted: true, status: "in_progress" });
    expect(firstBeat.progress).toMatchObject({ watched_seconds: 15, coverage: 0.25 });
    expect(replay).toMatchObject({ accepted: false, progress: { watched_seconds: 15 } });

    for (const [seq, end] of [
      [1, 30],
      [2, 45],
      [3, 60],
    ] as const) {
      t.advance(15_000);
      await heartbeat(lessons.free, { seq, ranges: [[end - 15, end]] });
    }
    const lesson = await readJson(
      await t.request("GET", `/v1/lessons/${lessons.free.id}`, { as: "staff" }),
    );

    expect(lesson.status).toBe("completed");
    expect(lesson.video).toMatchObject({
      progress: { coverage: 1, last_position: 60, watched_ranges: [[0, 60]] },
    });
    const events = await sql<{ type: string }>`
      SELECT type FROM ${sql.id(t.database.schema, "event_outbox")}
      WHERE payload->>'lessonId' = ${lessons.free.id}`.execute(t.database.admin);
    expect(events.rows.map((row) => row.type).sort()).toEqual([
      "lesson.completed",
      "lesson.started",
    ]);
  });

  it("truncates a claim of the whole video after 15 seconds and logs it", async () => {
    await start(lessons.free, "manager");
    t.advance(15_000);

    const body = await readJson(
      await heartbeat(lessons.free, { seq: 0, ranges: [[0, 60]] }, "manager"),
    );

    expect(body).toMatchObject({ accepted: true, status: "in_progress" });
    expect(body.progress).toMatchObject({ watched_seconds: 33 });
    expect(t.logs.at(-1)).toMatchObject({
      level: "warn",
      message: "video heartbeat truncated or out of bounds",
    });
  });

  it("does not count a skip ahead when seeking is forbidden", async () => {
    await start(lessons.strict);
    t.advance(15_000);

    const body = await readJson(await heartbeat(lessons.strict, { seq: 0, ranges: [[30, 45]] }));

    expect(body.progress).toMatchObject({ watched_seconds: 0, coverage: 0 });
  });

  it("shares the time budget between parallel player sessions", async () => {
    await start(lessons.hidden, "manager");
    t.advance(15_000);

    await Promise.all([
      heartbeat(lessons.hidden, { session: randomUUID(), seq: 0, ranges: [[0, 30]] }, "manager"),
      heartbeat(lessons.hidden, { session: randomUUID(), seq: 0, ranges: [[30, 60]] }, "manager"),
    ]);

    const lesson = await readJson(
      await t.request("GET", `/v1/lessons/${lessons.hidden.id}`, { as: "manager" }),
    );
    expect(
      (lesson.video as { progress: { watched_seconds: number } }).progress.watched_seconds,
    ).toBeLessThanOrEqual(33);
  });

  it.each([
    ["a text lesson", () => lessons.text, 409, "not_a_video_lesson"],
    ["a video that is not ready", () => lessons.pending, 409, "video_not_ready"],
    ["a lesson the learner cannot see", () => lessons.hidden, 404, "not_found"],
  ])("refuses heartbeats for %s", async (_name, lesson, status, code) => {
    const response = await heartbeat(lesson(), { seq: 0, ranges: [[0, 1]] });

    expect(response.status).toBe(status);
    expect(await readJson(response)).toMatchObject({ error: { code } });
  });

  it.each([
    ["a reversed range", { ranges: [[10, 5]] }],
    ["a negative sequence number", { seq: -1 }],
    ["a session id that is not a UUID", { session_id: "abc" }],
    ["a range past the longest video", { ranges: [[0, 40_000]] }],
    ["an unknown field", { coverage: 1 }],
    ["too many ranges", { ranges: Array.from({ length: 101 }, () => [0, 1]) }],
  ])("rejects %s with a validation error", async (_name, override) => {
    const response = await t.request("POST", `/v1/lessons/${lessons.free.id}/video-progress`, {
      as: "staff",
      body: { session_id: SESSION, seq: 9, ranges: [], position: 0, playback_rate: 1, ...override },
    });

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({ error: { code: "validation_failed" } });
  });

  it("requires a signed-in learner, and hides other tenants' lessons", async () => {
    const anonymous = await t.request("POST", `/v1/lessons/${lessons.free.id}/video-progress`, {
      body: { session_id: SESSION, seq: 0, ranges: [], position: 0, playback_rate: 1 },
    });
    const otherTenant = await t.request("POST", `/v1/lessons/${lessons.free.id}/video-progress`, {
      as: "otherTenant",
      body: { session_id: SESSION, seq: 0, ranges: [], position: 0, playback_rate: 1 },
    });

    expect(anonymous.status).toBe(401);
    expect(otherTenant.status).toBe(404);
  });

  it("refuses manual completion of a video lesson", async () => {
    const response = await t.request("POST", `/v1/lessons/${lessons.strict.id}/complete`, {
      as: "staff",
    });

    expect(await readJson(response)).toMatchObject({ error: { code: "completion_not_manual" } });
  });
});
