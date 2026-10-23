import { buildCorrections, gradeQuiz, isPassing } from "@bebranded/elearning-core";
import type {
  QuizAnswers,
  QuizAttempt,
  QuizCorrection,
  QuizStanding,
  StorageTransaction,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import type { AccessibleLesson } from "./lesson-access.js";
import { emit } from "./events.js";
import { presentationOf } from "./quiz.js";
import type { LessonQuiz } from "./quiz.js";

export type ReadyQuiz = LessonQuiz & { readonly quiz: NonNullable<LessonQuiz["quiz"]> };

/**
 * Closes an open attempt as graded or expired, and emits
 * `quiz.attempt_submitted`. An expired attempt scores 0 on every question.
 */
export async function closeAttempt(
  tx: StorageTransaction,
  context: RequestContext,
  input: {
    accessible: AccessibleLesson;
    lessonQuiz: ReadyQuiz;
    attempt: QuizAttempt;
    answers: QuizAnswers | null;
    closedAt: Date;
  },
): Promise<QuizAttempt> {
  const { attempt, lessonQuiz, answers } = input;
  const grade = gradeQuiz(presentationOf(lessonQuiz.quiz, attempt), answers ?? {});
  const expired = answers === null;
  const score = expired ? 0 : grade.score;
  const closed: QuizAttempt = {
    ...attempt,
    status: expired ? "expired" : "submitted",
    closedAt: input.closedAt,
    answers,
    questionResults: expired ? grade.questions.map((q) => ({ ...q, earned: 0 })) : grade.questions,
    score,
    passed: !expired && isPassing(score, lessonQuiz.settings.passingScore),
  };
  await tx.closeQuizAttempt(context.scope, closed);
  await emit(tx, context, "quiz.attempt_submitted", {
    learnerId: context.learner.learnerId,
    lessonId: input.accessible.lesson.id,
    courseId: input.accessible.course.id,
    attemptId: closed.id,
    attemptNumber: closed.attemptNumber,
    outcome: expired ? "expired" : "graded",
    score,
    passed: closed.passed ?? false,
  });
  return closed;
}

/** Voids an attempt opened on an older version of the quiz: it does not count. */
export async function voidAttempt(
  tx: StorageTransaction,
  context: RequestContext,
  attempt: QuizAttempt,
): Promise<void> {
  await tx.closeQuizAttempt(context.scope, {
    ...attempt,
    status: "voided",
    closedAt: context.now(),
  });
}

/**
 * Corrections, when the lesson's `showCorrection` allows them for this
 * attempt (spec 07): after every attempt, or once the learner has passed.
 */
export function correctionsFor(
  lessonQuiz: ReadyQuiz,
  attempt: QuizAttempt,
  standing: QuizStanding,
): QuizCorrection[] | null {
  const rule = lessonQuiz.settings.showCorrection;
  const allowed = rule === "after_attempt" || (rule === "after_pass" && standing.passed);
  if (!allowed || attempt.quizVersion !== lessonQuiz.quiz.version) return null;
  return buildCorrections(presentationOf(lessonQuiz.quiz, attempt), attempt.questionResults ?? []);
}
