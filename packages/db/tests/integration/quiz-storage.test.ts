import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  Chapter,
  Course,
  LearnerId,
  LessonDetail,
  Quiz,
  QuizAttempt,
} from "@bebranded/elearning-core";

import {
  aChapter,
  aCourse,
  aDefinition,
  aLesson,
  aQuiz,
  aVersion,
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

const quizLesson = () => aLesson(chapter, { type: "quiz", content: null, settings: {} });

async function start(lesson: LessonDetail, learnerId: LearnerId) {
  await database.storage.transaction((tx) =>
    tx.saveLessonProgress(tenantA, {
      lessonId: lesson.id,
      learnerId,
      courseId: course.id,
      status: "in_progress",
      startedAt: new Date("2026-03-01T10:00:00Z"),
      completedAt: null,
    }),
  );
}

/** A quiz lesson with its quiz, started by `learner`. */
async function aStartedQuiz(): Promise<Quiz> {
  const lesson = quizLesson();
  const quiz = aQuiz(lesson);
  await database.storage.transaction(async (tx) => {
    await tx.insertLesson(tenantA, lesson);
    await tx.saveQuiz(tenantA, quiz);
  });
  await start(lesson, learner);
  return quiz;
}

const insert = (attempt: QuizAttempt) =>
  database.storage.transaction((tx) => tx.insertQuizAttempt(tenantA, attempt));
const close = (attempt: QuizAttempt) =>
  database.storage.transaction((tx) => tx.closeQuizAttempt(tenantA, attempt));
const standing = (quiz: Quiz, learnerId = learner) =>
  database.storage.findQuizStanding(tenantA, learnerId, quiz.lessonId);

function graded(attempt: QuizAttempt, score: number, closedAt: string): QuizAttempt {
  return {
    ...attempt,
    status: "submitted",
    closedAt: new Date(closedAt),
    answers: { q1: true },
    questionResults: [{ questionId: "q-1", name: "q1", earned: score, possible: 1 }],
    score,
    passed: score >= 0.8,
  };
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

describe("saveQuiz and findQuiz", () => {
  it("stores the editor document and the definition, and replaces them in place", async () => {
    const lesson = quizLesson();
    const quiz = aQuiz(lesson);
    await database.storage.transaction((tx) => tx.insertLesson(tenantA, lesson));

    const saved = await database.storage.transaction((tx) => tx.saveQuiz(tenantA, quiz));
    const edited = { ...aQuiz(lesson), definition: aDefinition("Edited?"), version: aVersion("b") };
    await database.storage.transaction((tx) => tx.saveQuiz(tenantA, edited));

    expect(saved).toBe(true);
    expect(await database.storage.findQuiz(tenantA, lesson.id)).toEqual({
      ...edited,
      id: quiz.id,
    });
  });

  it("refuses lessons of other tenants, other lesson types and missing lessons", async () => {
    const textLesson = aLesson(chapter);
    const lesson = quizLesson();
    await database.storage.transaction(async (tx) => {
      await tx.insertLesson(tenantA, textLesson);
      await tx.insertLesson(tenantA, lesson);
    });

    const results = await database.storage.transaction(async (tx) => [
      await tx.saveQuiz(tenantB, aQuiz(lesson)),
      await tx.saveQuiz(tenantA, aQuiz(textLesson)),
      await tx.saveQuiz(tenantA, aQuiz(aLesson(chapter))),
    ]);

    expect(results).toEqual([false, false, false]);
    expect(await database.storage.findQuiz(tenantA, lesson.id)).toBeNull();
  });

  it("hides a tenant's quiz from other tenants", async () => {
    const quiz = await aStartedQuiz();

    expect(await database.storage.findQuiz(tenantB, quiz.lessonId)).toBeNull();
  });

  it("refuses a stored definition that is not a valid quiz", async () => {
    const quiz = await aStartedQuiz();
    await sql`UPDATE ${sql.id(database.schema, "quizzes")} SET definition = '{"questions": []}' WHERE id = ${quiz.id}`.execute(
      database.admin,
    );

    await expect(database.storage.findQuiz(tenantA, quiz.lessonId)).rejects.toThrow();
  });
});

describe("quiz attempts", () => {
  it("opens an attempt only once the learner has started the lesson", async () => {
    const quiz = await aStartedQuiz();

    expect(await insert(anAttempt(quiz, otherLearner))).toBe(false);
    expect(await insert(anAttempt(quiz, learner))).toBe(true);
  });

  it("allows at most one open attempt per learner and lesson", async () => {
    const quiz = await aStartedQuiz();
    await insert(anAttempt(quiz, learner));

    await expect(insert(anAttempt(quiz, learner))).rejects.toMatchObject({
      kind: "conflict",
      code: "quiz_attempt_open",
    });
  });

  it("summarizes closed attempts and returns the open one", async () => {
    const quiz = await aStartedQuiz();
    const first = anAttempt(quiz, learner);
    await insert(first);
    await close(graded(first, 0.5, "2026-03-01T10:05:00Z"));
    // Closing again is ignored: a closed attempt is never rewritten.
    await close(graded(first, 1, "2026-03-01T11:00:00Z"));
    const second = anAttempt(quiz, learner, { attemptNumber: 2 });
    await insert(second);
    await close(graded(second, 0.9, "2026-03-01T10:30:00Z"));
    const voided = anAttempt(quiz, learner, { attemptNumber: 3 });
    await insert(voided);
    await close({ ...voided, status: "voided", closedAt: new Date("2026-03-01T12:00:00Z") });
    const open = anAttempt(quiz, learner, { attemptNumber: 3, seed: 7 });
    await insert(open);

    expect(await standing(quiz)).toEqual({
      closedAttempts: 2,
      extraAttempts: 0,
      lastClosedAt: new Date("2026-03-01T10:30:00Z"),
      bestScore: 0.9,
      passed: true,
      openAttempt: open,
    });
  });

  it("starts empty, and keeps each learner's attempts apart", async () => {
    const quiz = await aStartedQuiz();
    await start({ ...quizLesson(), id: quiz.lessonId }, otherLearner);
    const theirs = anAttempt(quiz, otherLearner);
    await insert(theirs);
    await close(graded(theirs, 0.2, "2026-03-01T10:05:00Z"));

    expect(await standing(quiz)).toEqual({
      closedAttempts: 0,
      extraAttempts: 0,
      lastClosedAt: null,
      bestScore: null,
      passed: false,
      openAttempt: null,
    });
    expect(await database.storage.findQuizStanding(tenantB, otherLearner, quiz.lessonId)).toEqual(
      expect.objectContaining({ closedAttempts: 0 }),
    );
  });

  it("locks only the learner's own attempt", async () => {
    const quiz = await aStartedQuiz();
    const attempt = anAttempt(quiz, learner, { expiresAt: new Date("2026-03-01T10:30:00Z") });
    await insert(attempt);

    const results = await database.storage.transaction(async (tx) => [
      await tx.lockQuizAttempt(tenantA, learner, attempt.id),
      await tx.lockQuizAttempt(tenantA, otherLearner, attempt.id),
      await tx.lockQuizAttempt(tenantB, learner, attempt.id),
    ]);

    expect(results).toEqual([attempt, null, null]);
  });

  it("closes an attempt once and never rewrites a closed one", async () => {
    const quiz = await aStartedQuiz();
    const attempt = anAttempt(quiz, learner);
    await insert(attempt);
    const submitted = graded(attempt, 0.8, "2026-03-01T10:10:00Z");

    await close(submitted);
    await close({ ...submitted, score: 0, passed: false });

    const locked = await database.storage.transaction((tx) =>
      tx.lockQuizAttempt(tenantA, learner, attempt.id),
    );
    expect(locked).toEqual(submitted);
  });

  it("counts the learners who took the quiz, once each", async () => {
    const quiz = await aStartedQuiz();
    await start({ ...quizLesson(), id: quiz.lessonId }, otherLearner);
    for (const [learnerId, number] of [
      [learner, 1],
      [learner, 2],
      [otherLearner, 1],
    ] as const) {
      const attempt = anAttempt(quiz, learnerId, { attemptNumber: number });
      await insert(attempt);
      await close(graded(attempt, 0.5, "2026-03-01T10:05:00Z"));
    }
    await insert(anAttempt(quiz, learner, { attemptNumber: 3 }));

    expect(await database.storage.countQuizLearners(tenantA, quiz.lessonId)).toBe(2);
    expect(await database.storage.countQuizLearners(tenantB, quiz.lessonId)).toBe(0);
  });

  it("deletes attempts with their lesson", async () => {
    const quiz = await aStartedQuiz();
    await insert(anAttempt(quiz, learner));

    await database.storage.transaction((tx) => tx.deleteLesson(tenantA, quiz.lessonId));

    const rows = await sql<{
      count: string;
    }>`SELECT count(*) FROM ${sql.id(database.schema, "quiz_attempts")} WHERE quiz_id = ${quiz.id}`.execute(
      database.admin,
    );
    expect(rows.rows[0]?.count).toBe("0");
  });
});
