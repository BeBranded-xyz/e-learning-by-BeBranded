import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Quiz, QuizAttempt } from "@bebranded/elearning-core";

import {
  aChapter,
  aCourse,
  aLesson,
  aQuiz,
  anAttempt,
  learner,
  tenantA,
} from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;
let quiz: Quiz;

beforeAll(async () => {
  database = await createTestDatabase();
  const course = aCourse(tenantA.tenantId);
  const chapter = aChapter(course);
  const lesson = aLesson(chapter, { type: "quiz", content: null, settings: {} });
  quiz = aQuiz(lesson);
  await database.storage.transaction(async (tx) => {
    await tx.insertCourse(course);
    await tx.insertChapter(tenantA, chapter);
    await tx.insertLesson(tenantA, lesson);
    await tx.saveQuiz(tenantA, quiz);
    await tx.saveLessonProgress(tenantA, {
      lessonId: lesson.id,
      learnerId: learner,
      courseId: course.id,
      status: "in_progress",
      startedAt: new Date("2026-03-01T10:00:00Z"),
      completedAt: null,
    });
  });
});

afterAll(async () => {
  await database.drop();
});

/** Inserts an open attempt, then forces column values past the storage layer. */
async function forceAttempt(columns: Record<string, unknown>) {
  const attempt: QuizAttempt = anAttempt(quiz, learner);
  await database.storage.transaction((tx) => tx.insertQuizAttempt(tenantA, attempt));
  const assignments = sql.join(
    Object.entries(columns).map(([column, value]) => sql`${sql.ref(column)} = ${value}`),
  );
  try {
    await sql`UPDATE ${sql.id(database.schema, "quiz_attempts")} SET ${assignments} WHERE id = ${attempt.id}`.execute(
      database.admin,
    );
  } finally {
    await sql`DELETE FROM ${sql.id(database.schema, "quiz_attempts")} WHERE id = ${attempt.id}`.execute(
      database.admin,
    );
  }
}

describe("quiz_attempts constraints", () => {
  it.each([
    [
      "a score above 1",
      { status: "submitted", closed_at: "2026-03-01T10:05:00Z", score: 1.5, passed: true },
    ],
    [
      "a negative score",
      { status: "submitted", closed_at: "2026-03-01T10:05:00Z", score: -0.1, passed: false },
    ],
    [
      "a submitted attempt without a score",
      { status: "submitted", closed_at: "2026-03-01T10:05:00Z" },
    ],
    ["a closed attempt still marked open", { closed_at: "2026-03-01T10:05:00Z" }],
    ["a submitted attempt without a closing time", { status: "submitted", score: 1, passed: true }],
    [
      "a voided attempt with a score",
      { status: "voided", closed_at: "2026-03-01T10:05:00Z", score: 1, passed: true },
    ],
    ["an unknown status", { status: "paused" }],
    ["a seed beyond 32 bits", { shuffle_seed: 4_294_967_296 }],
    ["a deadline before the start", { expires_at: "2026-03-01T09:00:00Z" }],
    ["a version that is not a SHA-256", { quiz_version: "v1" }],
    ["answers that are not an object", { answers: "[]" }],
  ])("rejects %s", async (_label, columns) => {
    await expect(forceAttempt(columns)).rejects.toThrow(/violates check constraint/);
  });
});

describe("quizzes constraints", () => {
  it.each([
    ["a definition that is not an object", { definition: "[]" }],
    ["an editor document that is not an array", { editor_document: "{}" }],
    ["no question", { question_count: 0 }],
  ])("rejects %s", async (_label, columns) => {
    const assignments = sql.join(
      Object.entries(columns).map(([column, value]) => sql`${sql.ref(column)} = ${value}`),
    );

    await expect(
      sql`UPDATE ${sql.id(database.schema, "quizzes")} SET ${assignments} WHERE id = ${quiz.id}`.execute(
        database.admin,
      ),
    ).rejects.toThrow(/violates check constraint/);
  });
});
