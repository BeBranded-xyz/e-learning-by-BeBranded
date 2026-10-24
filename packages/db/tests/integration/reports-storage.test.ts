import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enrollmentIdSchema } from "@bebranded/elearning-core";
import type {
  Chapter,
  Course,
  Enrollment,
  LearnerId,
  LessonDetail,
  Quiz,
  QuizAttempt,
  TenantScope,
} from "@bebranded/elearning-core";

import {
  aChapter,
  aCourse,
  aLesson,
  aQuiz,
  anAttempt,
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

function anEnrollment(learnerId: LearnerId, overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: enrollmentIdSchema.parse(randomUUID()),
    courseId: course.id,
    learnerId,
    source: "self",
    assignedBy: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    progress: 0,
    ...overrides,
  };
}

const enroll = (scope: TenantScope, enrollment: Enrollment) =>
  database.storage.transaction((tx) => tx.saveEnrollment(scope, enrollment));

async function start(scope: TenantScope, lesson: LessonDetail, learnerId: LearnerId) {
  await database.storage.transaction((tx) =>
    tx.saveLessonProgress(scope, {
      lessonId: lesson.id,
      learnerId,
      courseId: course.id,
      status: "in_progress",
      startedAt: new Date("2026-03-01T10:00:00Z"),
      completedAt: null,
    }),
  );
}

async function aQuizLesson(): Promise<{ lesson: LessonDetail; quiz: Quiz }> {
  const lesson = aLesson(chapter, { type: "quiz", content: null, settings: {} });
  const quiz = aQuiz(lesson);
  await database.storage.transaction(async (tx) => {
    await tx.insertLesson(tenantA, lesson);
    await tx.saveQuiz(tenantA, quiz);
  });
  return { lesson, quiz };
}

async function closed(scope: TenantScope, attempt: QuizAttempt, closedAt: string, score = 1) {
  const result: QuizAttempt = {
    ...attempt,
    status: "submitted",
    closedAt: new Date(closedAt),
    answers: { q1: true },
    questionResults: [{ questionId: "q-1", name: "q1", earned: score, possible: 1 }],
    score,
    passed: score >= 0.8,
  };
  await database.storage.transaction(async (tx) => {
    await tx.insertQuizAttempt(scope, attempt);
    await tx.closeQuizAttempt(scope, result);
  });
  return result;
}

describe("listCourseEnrollments", () => {
  it("lists the tenant's enrollments of the course, never another tenant's", async () => {
    const mine = anEnrollment(learner, { progress: 0.5 });
    await enroll(tenantA, mine);
    await enroll(tenantB, anEnrollment(otherLearner));

    expect(await database.storage.listCourseEnrollments(tenantA, course.id)).toEqual([mine]);
    expect(await database.storage.listCourseEnrollments(tenantB, course.id)).toHaveLength(1);
  });
});

describe("listClosedQuizAttempts", () => {
  it("lists submitted attempts in closing order, without open or other tenants' ones", async () => {
    const { lesson, quiz } = await aQuizLesson();
    await start(tenantA, lesson, learner);
    await start(tenantA, lesson, otherLearner);
    await start(tenantB, lesson, learner);
    const late = await closed(
      tenantA,
      anAttempt(quiz, learner, { attemptNumber: 1 }),
      "2026-03-01T12:00:00Z",
    );
    const early = await closed(
      tenantA,
      anAttempt(quiz, otherLearner, { attemptNumber: 1 }),
      "2026-03-01T11:00:00Z",
      0.5,
    );
    await closed(tenantB, anAttempt(quiz, learner, { attemptNumber: 1 }), "2026-03-01T10:30:00Z");
    await database.storage.transaction((tx) =>
      tx.insertQuizAttempt(tenantA, anAttempt(quiz, learner, { attemptNumber: 2 })),
    );

    const attempts = await database.storage.listClosedQuizAttempts(tenantA, lesson.id);

    expect(attempts).toEqual([early, late]);
  });
});
