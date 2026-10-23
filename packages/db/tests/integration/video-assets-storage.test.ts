import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Chapter, Course, LessonDetail } from "@bebranded/elearning-core";

import {
  aChapter,
  aCourse,
  aLesson,
  aVideoAsset,
  singleTenant,
  tenantA,
  tenantB,
} from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;
let course: Course;
let chapter: Chapter;

async function aVideoLesson(): Promise<LessonDetail> {
  const lesson = aLesson(chapter, { type: "video", content: null, settings: {} });
  await database.storage.transaction((tx) => tx.insertLesson(tenantA, lesson));
  return lesson;
}

beforeAll(async () => {
  database = await createTestDatabase();
  course = aCourse(tenantA.tenantId);
  chapter = aChapter(course);
  await database.storage.transaction(async (tx) => {
    await tx.insertCourse(course);
    await tx.insertChapter(tenantA, chapter);
  });
});

afterAll(async () => {
  await database.drop();
});

describe("video assets", () => {
  it("saves the video of a lesson and reads it back", async () => {
    const lesson = await aVideoLesson();
    const asset = aVideoAsset(lesson, {
      captions: [{ lang: "fr", url: "https://example.com/fr.vtt" }],
    });

    const saved = await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, asset));

    expect(saved).toBe(true);
    expect(await database.storage.findVideoAsset(tenantA, lesson.id)).toEqual(asset);
  });

  it("returns null for a lesson without a video", async () => {
    const lesson = await aVideoLesson();

    expect(await database.storage.findVideoAsset(tenantA, lesson.id)).toBeNull();
  });

  it("replaces the video of a lesson, keeping the asset id", async () => {
    const lesson = await aVideoLesson();
    const first = aVideoAsset(lesson);
    await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, first));

    const second = aVideoAsset(lesson, { status: "ready", durationSeconds: 61.5 });
    await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, second));

    expect(await database.storage.findVideoAsset(tenantA, lesson.id)).toEqual({
      ...second,
      id: first.id,
    });
  });

  it("refuses a video for a lesson of another tenant, or a missing lesson", async () => {
    const lesson = await aVideoLesson();
    const missing = aLesson(chapter);

    const results = await database.storage.transaction(async (tx) => [
      await tx.saveVideoAsset(tenantB, aVideoAsset(lesson)),
      await tx.saveVideoAsset(singleTenant, aVideoAsset(lesson)),
      await tx.saveVideoAsset(tenantA, aVideoAsset(missing)),
    ]);

    expect(results).toEqual([false, false, false]);
    expect(await database.storage.findVideoAsset(tenantA, lesson.id)).toBeNull();
  });

  it("hides a tenant's video from another tenant", async () => {
    const lesson = await aVideoLesson();
    await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, aVideoAsset(lesson)));

    expect(await database.storage.findVideoAsset(tenantB, lesson.id)).toBeNull();
  });

  it("refuses the same provider asset on two lessons with a typed conflict", async () => {
    const [first, second] = [await aVideoLesson(), await aVideoLesson()];
    await database.storage.transaction((tx) =>
      tx.saveVideoAsset(tenantA, aVideoAsset(first, { providerAssetId: "shared-asset" })),
    );

    await expect(
      database.storage.transaction((tx) =>
        tx.saveVideoAsset(tenantA, aVideoAsset(second, { providerAssetId: "shared-asset" })),
      ),
    ).rejects.toMatchObject({ kind: "conflict", code: "video_asset_in_use" });
  });

  it("refuses a ready video without a duration (CHECK constraint)", async () => {
    const lesson = await aVideoLesson();

    await expect(
      database.storage.transaction((tx) =>
        tx.saveVideoAsset(tenantA, aVideoAsset(lesson, { status: "ready", durationSeconds: null })),
      ),
    ).rejects.toThrow(/video_assets_ready_duration/);
  });

  it("deletes the video with its lesson", async () => {
    const lesson = await aVideoLesson();
    await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, aVideoAsset(lesson)));

    await database.storage.transaction((tx) => tx.deleteLesson(tenantA, lesson.id));

    expect(await database.storage.findVideoAsset(tenantA, lesson.id)).toBeNull();
  });
});

describe("video webhooks", () => {
  it("updates the asset matching the provider and its asset id", async () => {
    const lesson = await aVideoLesson();
    const asset = aVideoAsset(lesson);
    await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, asset));
    const event = {
      assetId: asset.providerAssetId,
      status: "ready" as const,
      durationSeconds: 120.25,
      thumbnailUrl: "https://example.com/thumb.jpg",
    };

    const updated = await database.storage.transaction((tx) => tx.applyVideoWebhook("fake", event));

    const expected = {
      ...asset,
      status: "ready",
      durationSeconds: 120.25,
      thumbnailUrl: event.thumbnailUrl,
    };
    expect(updated).toEqual(expected);
    expect(await database.storage.findVideoAsset(tenantA, lesson.id)).toEqual(expected);
  });

  it("returns null for an unknown asset or another provider's asset", async () => {
    const lesson = await aVideoLesson();
    const asset = aVideoAsset(lesson);
    await database.storage.transaction((tx) => tx.saveVideoAsset(tenantA, asset));
    const event = { status: "error" as const, durationSeconds: null, thumbnailUrl: null };

    const results = await database.storage.transaction(async (tx) => [
      await tx.applyVideoWebhook("fake", { ...event, assetId: "unknown" }),
      await tx.applyVideoWebhook("other-provider", { ...event, assetId: asset.providerAssetId }),
    ]);

    expect(results).toEqual([null, null]);
    expect((await database.storage.findVideoAsset(tenantA, lesson.id))?.status).toBe("uploading");
  });
});
