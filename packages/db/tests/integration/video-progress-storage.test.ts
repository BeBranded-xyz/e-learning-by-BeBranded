import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Chapter, Course, LessonDetail, VideoProgress } from "@bebranded/elearning-core";

import {
  aChapter,
  aCourse,
  aLesson,
  learner,
  otherLearner,
  tenantA,
  tenantB,
} from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;
let course: Course;
let chapter: Chapter;

/** A video lesson the learner has started (video progress hangs off lesson progress). */
async function aStartedLesson(learnerId = learner): Promise<LessonDetail> {
  const lesson = aLesson(chapter, { type: "video", content: null, settings: {} });
  await database.storage.transaction(async (tx) => {
    await tx.insertLesson(tenantA, lesson);
    await tx.saveLessonProgress(tenantA, {
      lessonId: lesson.id,
      learnerId,
      courseId: course.id,
      status: "in_progress",
      startedAt: new Date("2026-03-01T10:00:00Z"),
      completedAt: null,
    });
  });
  return lesson;
}

function accept(lesson: LessonDetail, sessionId: string, seq: number, overrides = {}) {
  const key = { lessonId: lesson.id, learnerId: learner, sessionId, seq, ...overrides };
  return database.storage.transaction((tx) => tx.acceptVideoHeartbeat(tenantA, key));
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

describe("acceptVideoHeartbeat", () => {
  it("accepts increasing sequence numbers and ignores replays", async () => {
    const lesson = await aStartedLesson();
    const session = randomUUID();

    const results = [
      await accept(lesson, session, 0),
      await accept(lesson, session, 0),
      await accept(lesson, session, 2),
      await accept(lesson, session, 1),
      await accept(lesson, session, 3),
    ];

    expect(results).toEqual([true, false, true, false, true]);
  });

  it("tracks each player session separately", async () => {
    const lesson = await aStartedLesson();

    expect(await accept(lesson, randomUUID(), 5)).toBe(true);
    expect(await accept(lesson, randomUUID(), 1)).toBe(true);
  });

  it("does not let another learner's session block this learner", async () => {
    const lesson = await aStartedLesson();
    await database.storage.transaction((tx) =>
      tx.saveLessonProgress(tenantA, {
        lessonId: lesson.id,
        learnerId: otherLearner,
        courseId: course.id,
        status: "in_progress",
        startedAt: new Date("2026-03-01T10:00:00Z"),
        completedAt: null,
      }),
    );
    const session = randomUUID();
    await accept(lesson, session, 9, { learnerId: otherLearner });

    expect(await accept(lesson, session, 1)).toBe(true);
  });

  it("refuses heartbeats for a lesson not started, or from another tenant", async () => {
    const lesson = await aStartedLesson();
    const notStarted = aLesson(chapter, { type: "video", content: null, settings: {} });
    await database.storage.transaction((tx) => tx.insertLesson(tenantA, notStarted));
    const key = { lessonId: lesson.id, learnerId: learner, sessionId: randomUUID(), seq: 1 };

    expect(await accept(notStarted, randomUUID(), 1)).toBe(false);
    expect(await database.storage.transaction((tx) => tx.acceptVideoHeartbeat(tenantB, key))).toBe(
      false,
    );
  });

  it("accepts a sequence number once under concurrent replays", async () => {
    const lesson = await aStartedLesson();
    const session = randomUUID();

    const results = await Promise.all(Array.from({ length: 5 }, () => accept(lesson, session, 4)));

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("video progress", () => {
  it("returns null before the first heartbeat and when the lesson was not started", async () => {
    const lesson = await aStartedLesson();
    const notStarted = aLesson(chapter, { type: "video", content: null, settings: {} });
    await database.storage.transaction((tx) => tx.insertLesson(tenantA, notStarted));

    expect(await database.storage.findVideoProgress(tenantA, learner, lesson.id)).toBeNull();
    expect(
      await database.storage.transaction((tx) =>
        tx.lockOrCreateVideoProgress(tenantA, learner, notStarted.id),
      ),
    ).toBeNull();
  });

  it("creates empty progress, then saves and reads it back", async () => {
    const lesson = await aStartedLesson();
    const saved: VideoProgress = {
      lessonId: lesson.id,
      learnerId: learner,
      watchedRanges: [
        [0, 42.5],
        [60, 75.25],
      ],
      watchedSeconds: 57.75,
      coverage: 0.48125,
      lastPosition: 75.25,
      budgetBaselineAt: new Date("2026-03-01T10:02:00Z"),
      suspiciousEvents: 2,
    };

    const created = await database.storage.transaction(async (tx) => {
      const progress = await tx.lockOrCreateVideoProgress(tenantA, learner, lesson.id);
      await tx.saveVideoProgress(tenantA, saved);
      return progress;
    });

    expect(created).toEqual({
      lessonId: lesson.id,
      learnerId: learner,
      watchedRanges: [],
      watchedSeconds: 0,
      coverage: 0,
      lastPosition: 0,
      budgetBaselineAt: null,
      suspiciousEvents: 0,
    });
    expect(await database.storage.findVideoProgress(tenantA, learner, lesson.id)).toEqual(saved);
  });

  it("hides progress from another tenant and another learner", async () => {
    const lesson = await aStartedLesson();
    await database.storage.transaction((tx) =>
      tx.lockOrCreateVideoProgress(tenantA, learner, lesson.id),
    );

    expect(await database.storage.findVideoProgress(tenantB, learner, lesson.id)).toBeNull();
    expect(await database.storage.findVideoProgress(tenantA, otherLearner, lesson.id)).toBeNull();
  });

  it("serializes concurrent read-modify-write cycles with the lock", async () => {
    const lesson = await aStartedLesson();
    const increment = () =>
      database.storage.transaction(async (tx) => {
        const progress = await tx.lockOrCreateVideoProgress(tenantA, learner, lesson.id);
        if (progress === null) throw new Error("lesson not started");
        await tx.saveVideoProgress(tenantA, {
          ...progress,
          suspiciousEvents: progress.suspiciousEvents + 1,
        });
      });

    await Promise.all([increment(), increment(), increment()]);

    const progress = await database.storage.findVideoProgress(tenantA, learner, lesson.id);
    expect(progress?.suspiciousEvents).toBe(3);
  });

  it("deletes video progress and sessions with the lesson", async () => {
    const lesson = await aStartedLesson();
    await accept(lesson, randomUUID(), 1);
    await database.storage.transaction((tx) =>
      tx.lockOrCreateVideoProgress(tenantA, learner, lesson.id),
    );

    await database.storage.transaction((tx) => tx.deleteLesson(tenantA, lesson.id));

    const table = (name: string) => sql.id(database.schema, name);
    const orphans = await sql<{ count: string }>`
      SELECT count(*) AS count FROM ${table("video_sessions")} AS s
      WHERE NOT EXISTS (
        SELECT 1 FROM ${table("lesson_progress")} AS p WHERE p.id = s.lesson_progress_id
      )`.execute(database.admin);
    expect(orphans.rows[0]?.count).toBe("0");
    expect(await database.storage.findVideoProgress(tenantA, learner, lesson.id)).toBeNull();
  });
});
