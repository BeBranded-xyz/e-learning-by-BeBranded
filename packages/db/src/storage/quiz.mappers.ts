import { z } from "zod";
import type { Selectable } from "kysely";

import {
  learnerIdSchema,
  lessonIdSchema,
  quizAnswersSchema,
  quizAttemptIdSchema,
  quizDefinitionSchema,
  quizIdSchema,
} from "@bebranded/elearning-core";
import type { Quiz, QuizAttempt } from "@bebranded/elearning-core";

import type { QuizAttempts, Quizzes } from "../database.gen.js";

// pg returns numeric and bigint columns as strings; they are parsed back to numbers here.
const numberSchema = z.coerce.number().pipe(z.number());
const statusSchema = z.enum(["open", "submitted", "expired", "voided"]);
const resultsSchema = z.array(
  z.strictObject({
    questionId: z.string(),
    name: z.string(),
    earned: z.number(),
    possible: z.number(),
  }),
);

export function toQuiz(row: Selectable<Quizzes>): Quiz {
  return {
    id: quizIdSchema.parse(row.id),
    lessonId: lessonIdSchema.parse(row.lesson_id),
    editorDocument: z.json().parse(row.editor_document),
    definition: quizDefinitionSchema.parse(row.definition),
    version: row.version,
  };
}

export type AttemptRow = Selectable<QuizAttempts> & { lesson_id: string; learner_id: string };

export function toQuizAttempt(row: AttemptRow): QuizAttempt {
  return {
    id: quizAttemptIdSchema.parse(row.id),
    quizId: quizIdSchema.parse(row.quiz_id),
    lessonId: lessonIdSchema.parse(row.lesson_id),
    learnerId: learnerIdSchema.parse(row.learner_id),
    attemptNumber: row.attempt_number,
    status: statusSchema.parse(row.status),
    quizVersion: row.quiz_version,
    seed: numberSchema.parse(row.shuffle_seed),
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    closedAt: row.closed_at,
    answers: row.answers === null ? null : quizAnswersSchema.parse(row.answers),
    questionResults:
      row.question_results === null ? null : resultsSchema.parse(row.question_results),
    score: row.score === null ? null : numberSchema.parse(row.score),
    passed: row.passed,
  };
}
