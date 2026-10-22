import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enrollmentIdSchema, learnerIdSchema } from "@bebranded/elearning-core";
import type { Course, Enrollment, LessonDetail, LessonProgress } from "@bebranded/elearning-core";

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
let lesson: LessonDetail;

function anEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: enrollmentIdSchema.parse(randomUUID()),
    courseId: course.id,
    learnerId: learner,
    source: "self",
    assignedBy: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    progress: 0,
    ...overrides,
  };
}

function aProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    lessonId: lesson.id,
    learnerId: learner,
    courseId: course.id,
    status: "in_progress",
    startedAt: new Date("2026-03-01T10:00:00Z"),
    completedAt: null,
    ...overrides,
  };
}

beforeAll(async () => {
  database = await createTestDatabase();
  course = aCourse(tenantA.tenantId);
  const chapter = aChapter(course);
  lesson = aLesson(chapter);
  await database.storage.transaction(async (tx) => {
    await tx.insertCourse(course);
    await tx.insertChapter(tenantA, chapter);
    await tx.insertLesson(tenantA, lesson);
  });
});

afterAll(async () => {
  await database.drop();
});

describe("lesson progress", () => {
  it("inserts then updates the progress of a learner (upsert)", async () => {
    await database.storage.transaction((tx) => tx.saveLessonProgress(tenantA, aProgress()));
    const completed = aProgress({
      status: "completed",
      completedAt: new Date("2026-03-01T10:05:00Z"),
    });
    await database.storage.transaction((tx) => tx.saveLessonProgress(tenantA, completed));

    expect(await database.storage.listLessonProgress(tenantA, learner, [lesson.id])).toEqual([
      completed,
    ]);
  });

  it("keeps each learner's progress separate", async () => {
    await database.storage.transaction((tx) =>
      tx.saveLessonProgress(tenantA, aProgress({ learnerId: otherLearner })),
    );

    const rows = await database.storage.listLessonProgress(tenantA, otherLearner, [lesson.id]);

    expect(rows.map((row) => row.learnerId)).toEqual([otherLearner]);
  });

  it("never returns progress of another tenant", async () => {
    expect(await database.storage.listLessonProgress(tenantB, learner, [lesson.id])).toEqual([]);
    expect(await database.storage.listLessonProgress(tenantA, learner, [])).toEqual([]);
  });

  it("rejects a completed status without completion date (database constraint)", async () => {
    await expect(
      database.storage.transaction((tx) =>
        tx.saveLessonProgress(tenantA, aProgress({ status: "completed", completedAt: null })),
      ),
    ).rejects.toThrow();
  });
});

describe("enrollments", () => {
  it("creates, finds, lists and updates an enrollment", async () => {
    const enrollment = anEnrollment({
      source: "assigned",
      assignedBy: learnerIdSchema.parse("admin-1"),
      dueAt: new Date("2026-12-31T00:00:00Z"),
    });
    await database.storage.transaction((tx) => tx.saveEnrollment(tenantA, enrollment));
    const progressed = {
      ...enrollment,
      progress: 0.5,
      startedAt: new Date("2026-03-02T00:00:00Z"),
    };
    await database.storage.transaction((tx) => tx.saveEnrollment(tenantA, progressed));

    expect(await database.storage.findEnrollment(tenantA, course.id, learner)).toEqual(progressed);
    expect(await database.storage.listEnrollments(tenantA, learner)).toEqual([progressed]);
  });

  it("returns null and an empty list for another tenant", async () => {
    expect(await database.storage.findEnrollment(tenantB, course.id, learner)).toBeNull();
    expect(await database.storage.listEnrollments(tenantB, learner)).toEqual([]);
  });

  it("serializes concurrent transactions on the same enrollment with lockEnrollment", async () => {
    const enrollment = anEnrollment({ learnerId: otherLearner });
    await database.storage.transaction((tx) => tx.saveEnrollment(tenantA, enrollment));
    const order: string[] = [];

    const increment = (label: string) =>
      database.storage.transaction(async (tx) => {
        const locked = await tx.lockEnrollment(tenantA, course.id, otherLearner);
        if (locked === null) throw new Error("enrollment missing");
        order.push(`${label}:read:${locked.progress}`);
        await tx.saveEnrollment(tenantA, { ...locked, progress: locked.progress + 0.25 });
      });
    await Promise.all([increment("a"), increment("b")]);

    expect(
      (await database.storage.findEnrollment(tenantA, course.id, otherLearner))?.progress,
    ).toBe(0.5);
    expect(order.map((entry) => entry.split(":").slice(1).join(":")).sort()).toEqual([
      "read:0",
      "read:0.25",
    ]);
  });

  it("returns null when locking a missing enrollment", async () => {
    const locked = await database.storage.transaction((tx) =>
      tx.lockEnrollment(tenantA, course.id, learnerIdSchema.parse("nobody")),
    );

    expect(locked).toBeNull();
  });
});

describe("lockOrCreateEnrollment", () => {
  it("creates the enrollment once under concurrent first requests and returns the same row", async () => {
    const learnerId = learnerIdSchema.parse("concurrent-learner");

    const rows = await Promise.all(
      Array.from({ length: 5 }, () =>
        database.storage.transaction((tx) =>
          tx.lockOrCreateEnrollment(tenantA, anEnrollment({ learnerId })),
        ),
      ),
    );

    expect(new Set(rows.map((row) => row.id)).size).toBe(1);
    expect(await database.storage.listEnrollments(tenantA, learnerId)).toHaveLength(1);
  });

  it("returns the existing enrollment untouched", async () => {
    const learnerId = learnerIdSchema.parse("existing-learner");
    const existing = anEnrollment({
      learnerId,
      progress: 0.5,
      startedAt: new Date("2026-04-01T00:00:00Z"),
    });
    await database.storage.transaction((tx) => tx.saveEnrollment(tenantA, existing));

    const row = await database.storage.transaction((tx) =>
      tx.lockOrCreateEnrollment(tenantA, anEnrollment({ learnerId })),
    );

    expect(row).toEqual(existing);
  });

  it("refuses to hand out an enrollment of the same learner id in another tenant", async () => {
    const learnerId = learnerIdSchema.parse("shared-id");
    await database.storage.transaction((tx) =>
      tx.saveEnrollment(tenantB, anEnrollment({ learnerId })),
    );

    await expect(
      database.storage.transaction((tx) =>
        tx.lockOrCreateEnrollment(tenantA, anEnrollment({ learnerId })),
      ),
    ).rejects.toThrow("enrollment belongs to another tenant");
  });
});
