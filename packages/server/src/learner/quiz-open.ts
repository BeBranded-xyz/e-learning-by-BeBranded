import {
  AppError,
  attemptEligibility,
  attemptExpiresAt,
  isPastDeadline,
  quizAttemptIdSchema,
} from "@bebranded/elearning-core";
import type {
  Eligibility,
  QuizAttempt,
  QuizStanding,
  StorageTransaction,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentQuizAttempt } from "../presenters/quiz.presenters.js";
import { loadAccessibleLesson } from "../services/lesson-access.js";
import type { AccessibleLesson } from "../services/lesson-access.js";
import { applyLessonProgress } from "../services/progress.js";
import { closeAttempt, voidAttempt } from "../services/quiz-attempts.js";
import type { ReadyQuiz } from "../services/quiz-attempts.js";
import {
  loadLessonQuiz,
  presentationOf,
  quizNotReady,
  requireQuizLesson,
  seedOf,
  surveyOf,
} from "../services/quiz.js";

type Opened =
  | { readonly kind: "opened"; readonly attempt: QuizAttempt; readonly created: boolean }
  | { readonly kind: "refused"; readonly eligibility: Exclude<Eligibility, { ok: true }> };

type Input = { accessible: AccessibleLesson; lessonQuiz: ReadyQuiz };

/**
 * Closes an open attempt that can no longer be resumed: voided when the quiz
 * changed, expired (at its deadline) when its time ran out. Returns the open
 * attempt to resume, or null.
 */
async function settleOpenAttempt(
  tx: StorageTransaction,
  context: RequestContext,
  input: Input & { open: QuizAttempt },
): Promise<QuizAttempt | null> {
  const { open, lessonQuiz } = input;
  if (open.quizVersion !== lessonQuiz.quiz.version) {
    await voidAttempt(tx, context, open);
    return null;
  }
  if (open.expiresAt !== null && isPastDeadline(open.expiresAt, context.now())) {
    // Closed at its deadline, so the cooldown does not depend on when the learner came back.
    const closedAt = open.expiresAt;
    await closeAttempt(tx, context, { ...input, attempt: open, answers: null, closedAt });
    return null;
  }
  return open;
}

function newAttempt(context: RequestContext, input: Input, standing: QuizStanding): QuizAttempt {
  const id = quizAttemptIdSchema.parse(context.newId());
  const startedAt = context.now();
  const { settings, quiz } = input.lessonQuiz;
  return {
    id,
    quizId: quiz.id,
    lessonId: input.accessible.lesson.id,
    learnerId: context.learner.learnerId,
    attemptNumber: standing.closedAttempts + 1,
    status: "open",
    quizVersion: quiz.version,
    seed: seedOf(id),
    shuffleQuestions: settings.shuffleQuestions,
    shuffleOptions: settings.shuffleOptions,
    startedAt,
    expiresAt: attemptExpiresAt(startedAt, settings),
    closedAt: null,
    answers: null,
    questionResults: null,
    score: null,
    passed: null,
  };
}

async function openInTransaction(
  tx: StorageTransaction,
  context: RequestContext,
  input: Input,
): Promise<Opened> {
  const { accessible } = input;
  // Enrollment first, like every progress write: two tabs cannot open two attempts.
  await applyLessonProgress(tx, context, {
    course: accessible.course,
    lesson: accessible.lesson,
    progressLessons: accessible.view.progressLessons,
    target: "in_progress",
  });
  const key = [context.scope, context.learner.learnerId, accessible.lesson.id] as const;
  const before = await tx.findQuizStanding(...key);
  const open =
    before.openAttempt === null
      ? null
      : await settleOpenAttempt(tx, context, { ...input, open: before.openAttempt });
  if (open !== null) return { kind: "opened", attempt: open, created: false };
  const standing = await tx.findQuizStanding(...key);
  const eligibility = attemptEligibility(standing, input.lessonQuiz.settings, context.now());
  if (!eligibility.ok) return { kind: "refused", eligibility };
  const attempt = newAttempt(context, input, standing);
  if (!(await tx.insertQuizAttempt(context.scope, attempt))) {
    throw new AppError("internal", "lesson_progress_missing", "The lesson was not started.");
  }
  return { kind: "opened", attempt, created: true };
}

function refusal(eligibility: Exclude<Eligibility, { ok: true }>, now: Date): AppError {
  if (eligibility.code === "attempts_exhausted") {
    return new AppError(
      "conflict",
      "attempts_exhausted",
      "You have used every attempt at this quiz.",
    );
  }
  const retryAfterSeconds = Math.ceil((eligibility.nextAttemptAt.getTime() - now.getTime()) / 1000);
  return new AppError("rate_limit", "cooldown", "Wait before your next attempt.", {
    details: {
      next_attempt_at: eligibility.nextAttemptAt.toISOString(),
      retry_after_seconds: retryAfterSeconds,
    },
  });
}

/**
 * POST /v1/lessons/:id/quiz/attempts: opens an attempt, or resumes the open
 * one (spec 07, "Attempts"). The survey carries no answer.
 */
export async function openQuizAttempt(
  context: RequestContext,
  lessonId: string | undefined,
): Promise<Response> {
  const accessible = await loadAccessibleLesson(context, lessonId);
  requireQuizLesson(accessible.lesson);
  const lessonQuiz = await loadLessonQuiz(context, accessible.lesson);
  const { quiz } = lessonQuiz;
  if (quiz === null) throw quizNotReady();
  const input = { accessible, lessonQuiz: { ...lessonQuiz, quiz } };
  const outcome = await context.storage.transaction((tx) => openInTransaction(tx, context, input));
  if (outcome.kind === "refused") throw refusal(outcome.eligibility, context.now());
  const survey = surveyOf(presentationOf(quiz, outcome.attempt));
  return json(
    presentQuizAttempt(outcome.attempt, survey),
    context.requestId,
    outcome.created ? 201 : 200,
  );
}
