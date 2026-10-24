import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attemptGrantIdSchema, learnerIdSchema } from "@bebranded/elearning-core";
import type {
  Chapter,
  LessonDetail,
  QuizAttemptGrant,
  TenantScope,
} from "@bebranded/elearning-core";

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
let chapter: Chapter;

const admin = learnerIdSchema.parse("admin-1");

beforeAll(async () => {
  database = await createTestDatabase();
  const course = aCourse(tenantA.tenantId);
  chapter = aChapter(course);
  await database.storage.transaction(async (tx) => {
    await tx.insertCourse(course);
    await tx.insertChapter(tenantA, chapter);
  });
});

afterAll(async () => {
  await database.drop();
});

async function aQuizLesson(): Promise<LessonDetail> {
  const lesson = aLesson(chapter, { type: "quiz", content: null, settings: {} });
  await database.storage.transaction((tx) => tx.insertLesson(tenantA, lesson));
  return lesson;
}

function aGrant(lesson: LessonDetail, overrides: Partial<QuizAttemptGrant> = {}): QuizAttemptGrant {
  return {
    id: attemptGrantIdSchema.parse(randomUUID()),
    lessonId: lesson.id,
    learnerId: learner,
    extraAttempts: 1,
    grantedBy: admin,
    createdAt: new Date("2026-10-24T09:00:00.000Z"),
    ...overrides,
  };
}

const grant = (scope: TenantScope, value: QuizAttemptGrant) =>
  database.storage.transaction((tx) => tx.insertQuizAttemptGrant(scope, value));

describe("quiz attempt grants", () => {
  it("lists a lesson's grants oldest first, and one learner's only on request", async () => {
    const lesson = await aQuizLesson();
    const first = aGrant(lesson, { extraAttempts: 2 });
    const second = aGrant(lesson, {
      learnerId: otherLearner,
      createdAt: new Date("2026-10-24T10:00:00.000Z"),
    });
    await grant(tenantA, second);
    await grant(tenantA, first);

    expect(await database.storage.listQuizAttemptGrants(tenantA, lesson.id)).toEqual([
      first,
      second,
    ]);
    expect(await database.storage.listQuizAttemptGrants(tenantA, lesson.id, otherLearner)).toEqual([
      second,
    ]);
  });

  it("adds every grant of the learner to their standing", async () => {
    const lesson = await aQuizLesson();
    await grant(tenantA, aGrant(lesson, { extraAttempts: 2 }));
    await grant(tenantA, aGrant(lesson, { extraAttempts: 3 }));
    await grant(tenantA, aGrant(lesson, { learnerId: otherLearner, extraAttempts: 50 }));

    const standing = await database.storage.findQuizStanding(tenantA, learner, lesson.id);

    expect(standing.extraAttempts).toBe(5);
  });

  it("keeps grants inside their tenant", async () => {
    const lesson = await aQuizLesson();
    await grant(tenantB, aGrant(lesson, { extraAttempts: 4 }));

    expect(await database.storage.listQuizAttemptGrants(tenantA, lesson.id)).toEqual([]);
    expect(
      (await database.storage.findQuizStanding(tenantA, learner, lesson.id)).extraAttempts,
    ).toBe(0);
    expect(
      (await database.storage.findQuizStanding(tenantB, learner, lesson.id)).extraAttempts,
    ).toBe(4);
  });

  it("deletes grants with their lesson", async () => {
    const lesson = await aQuizLesson();
    await grant(tenantA, aGrant(lesson));

    await database.storage.transaction((tx) => tx.deleteLesson(tenantA, lesson.id));

    expect(await database.storage.listQuizAttemptGrants(tenantA, lesson.id)).toEqual([]);
  });

  it.each([0, 101, -1])("refuses %i extra attempts", async (extraAttempts) => {
    const lesson = await aQuizLesson();

    await expect(grant(tenantA, aGrant(lesson, { extraAttempts }))).rejects.toThrow(
      /quiz_attempt_grants/,
    );
  });
});
