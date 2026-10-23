import { sql } from "kysely";
import type { Kysely } from "kysely";

import type {
  LearnerId,
  LessonId,
  Quiz,
  QuizAttempt,
  QuizAttemptId,
  QuizStanding,
  TenantScope,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { lessonProgressOf } from "./learner-lesson.js";
import type { LearnerLesson } from "./learner-lesson.js";
import { insertedAny, jsonColumn } from "./patch.js";
import { toQuiz, toQuizAttempt } from "./quiz.mappers.js";
import { ownedBy, readableContent } from "./tenant-filters.js";

const CLOSED = ["submitted", "expired"] as const;

export async function findQuiz(
  db: Kysely<DB>,
  scope: TenantScope,
  lessonId: LessonId,
): Promise<Quiz | null> {
  const row = await db
    .selectFrom("quizzes")
    .selectAll()
    .where("lesson_id", "=", lessonId)
    .where(readableContent("quizzes.tenant_id", scope))
    .executeTakeFirst();
  return row === undefined ? null : toQuiz(row);
}

export async function saveQuiz(db: Kysely<DB>, scope: TenantScope, quiz: Quiz): Promise<boolean> {
  const replaced = {
    editor_document: JSON.stringify(quiz.editorDocument),
    definition: JSON.stringify(quiz.definition),
    version: quiz.version,
    question_count: quiz.definition.questions.length,
  };
  const result = await db
    .insertInto("quizzes")
    .columns([
      "id",
      "tenant_id",
      "lesson_id",
      "editor_document",
      "definition",
      "version",
      "question_count",
    ])
    .expression(
      db
        .selectFrom("lessons")
        .select((eb) => [
          eb.val(quiz.id).as("id"),
          "lessons.tenant_id",
          "lessons.id as lesson_id",
          eb.val(replaced.editor_document).as("editor_document"),
          eb.val(replaced.definition).as("definition"),
          eb.val(replaced.version).as("version"),
          eb.val(replaced.question_count).as("question_count"),
        ])
        .where("lessons.id", "=", quiz.lessonId)
        .where("lessons.type", "=", "quiz")
        .where(ownedBy("lessons.tenant_id", scope)),
    )
    .onConflict((oc) => oc.column("lesson_id").doUpdateSet(replaced))
    .executeTakeFirst();
  return insertedAny(result);
}

/** Attempts of the learner's lesson, with the lesson and learner of their progress row. */
function attempts(db: Kysely<DB>, scope: TenantScope) {
  return db
    .selectFrom("quiz_attempts")
    .innerJoin("lesson_progress", "lesson_progress.id", "quiz_attempts.lesson_progress_id")
    .where(ownedBy("lesson_progress.tenant_id", scope));
}

export async function findQuizStanding(
  db: Kysely<DB>,
  scope: TenantScope,
  key: LearnerLesson,
): Promise<QuizStanding> {
  const byLearner = attempts(db, scope)
    .where("lesson_progress.lesson_id", "=", key.lessonId)
    .where("lesson_progress.learner_id", "=", key.learnerId);
  const summary = await byLearner
    .where("quiz_attempts.status", "in", CLOSED)
    .select((eb) => [
      eb.fn.countAll<string>().as("closed"),
      eb.fn.max("quiz_attempts.closed_at").as("last_closed_at"),
      eb.fn.max("quiz_attempts.score").as("best_score"),
      sql<boolean>`coalesce(bool_or(quiz_attempts.passed), false)`.as("passed"),
    ])
    .executeTakeFirstOrThrow();
  const open = await byLearner
    .where("quiz_attempts.status", "=", "open")
    .selectAll("quiz_attempts")
    .select(["lesson_progress.lesson_id", "lesson_progress.learner_id"])
    .executeTakeFirst();
  return {
    closedAttempts: Number(summary.closed),
    lastClosedAt: summary.last_closed_at,
    bestScore: summary.best_score === null ? null : Number(summary.best_score),
    passed: summary.passed,
    openAttempt: open === undefined ? null : toQuizAttempt(open),
  };
}

export async function countQuizLearners(
  db: Kysely<DB>,
  scope: TenantScope,
  lessonId: LessonId,
): Promise<number> {
  const row = await attempts(db, scope)
    .where("lesson_progress.lesson_id", "=", lessonId)
    .where("quiz_attempts.status", "in", CLOSED)
    .select((eb) => eb.fn.count<string>("lesson_progress.learner_id").distinct().as("learners"))
    .executeTakeFirstOrThrow();
  return Number(row.learners);
}

export async function insertQuizAttempt(
  db: Kysely<DB>,
  scope: TenantScope,
  attempt: QuizAttempt,
): Promise<boolean> {
  const result = await db
    .insertInto("quiz_attempts")
    .columns([
      "id",
      "lesson_progress_id",
      "quiz_id",
      "tenant_id",
      "attempt_number",
      "status",
      "quiz_version",
      "shuffle_seed",
      "shuffle_questions",
      "shuffle_options",
      "started_at",
      "expires_at",
    ])
    .expression(
      lessonProgressOf(db, scope, attempt).select((eb) => [
        eb.val(attempt.id).as("id"),
        "lesson_progress.id as lesson_progress_id",
        eb.val(attempt.quizId).as("quiz_id"),
        "lesson_progress.tenant_id",
        eb.val(attempt.attemptNumber).as("attempt_number"),
        eb.val(attempt.status).as("status"),
        eb.val(attempt.quizVersion).as("quiz_version"),
        eb.val(attempt.seed).as("shuffle_seed"),
        eb.val(attempt.shuffleQuestions).as("shuffle_questions"),
        eb.val(attempt.shuffleOptions).as("shuffle_options"),
        eb.val(attempt.startedAt).as("started_at"),
        eb.val(attempt.expiresAt).as("expires_at"),
      ]),
    )
    .executeTakeFirst();
  return insertedAny(result);
}

export async function lockQuizAttempt(
  db: Kysely<DB>,
  scope: TenantScope,
  learnerId: LearnerId,
  attemptId: QuizAttemptId,
): Promise<QuizAttempt | null> {
  const row = await attempts(db, scope)
    .where("quiz_attempts.id", "=", attemptId)
    .where("lesson_progress.learner_id", "=", learnerId)
    .selectAll("quiz_attempts")
    .select(["lesson_progress.lesson_id", "lesson_progress.learner_id"])
    .forUpdate("quiz_attempts")
    .executeTakeFirst();
  return row === undefined ? null : toQuizAttempt(row);
}

export async function closeQuizAttempt(
  db: Kysely<DB>,
  scope: TenantScope,
  attempt: QuizAttempt,
): Promise<void> {
  await db
    .updateTable("quiz_attempts")
    .set({
      status: attempt.status,
      closed_at: attempt.closedAt,
      answers: jsonColumn(attempt.answers),
      question_results: jsonColumn(attempt.questionResults),
      score: attempt.score,
      passed: attempt.passed,
    })
    .where("id", "=", attempt.id)
    .where("status", "=", "open")
    .where(
      "lesson_progress_id",
      "in",
      lessonProgressOf(db, scope, attempt).select("lesson_progress.id"),
    )
    .execute();
}
