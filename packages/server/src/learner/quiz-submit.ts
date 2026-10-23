import { z } from "zod";

import {
  AppError,
  isPastDeadline,
  quizAnswersSchema,
  quizAttemptIdSchema,
} from "@bebranded/elearning-core";
import type {
  LessonProgressStatus,
  QuizAnswers,
  QuizAttempt,
  StorageTransaction,
} from "@bebranded/elearning-core";

import { parseBody } from "../admin/parse-body.js";
import type { RequestContext } from "../context.js";
import { httpErrors } from "../http/http-error.js";
import { json } from "../http/responses.js";
import { presentQuizResult } from "../presenters/quiz.presenters.js";
import { loadAccessibleLesson } from "../services/lesson-access.js";
import type { AccessibleLesson } from "../services/lesson-access.js";
import { applyLessonProgress } from "../services/progress.js";
import { closeAttempt, correctionsFor, voidAttempt } from "../services/quiz-attempts.js";
import type { ReadyQuiz } from "../services/quiz-attempts.js";
import { loadLessonQuiz, quizNotReady, requireQuizLesson } from "../services/quiz.js";

/** 200 answers of up to 500 characters, with room for the JSON around them. */
const SUBMISSION_MAX_BYTES = 131_072;
const submissionBody = z.strictObject({ answers: quizAnswersSchema });

type Input = { accessible: AccessibleLesson; lessonQuiz: ReadyQuiz; answers: QuizAnswers };
type Submitted =
  | {
      readonly kind: "closed";
      readonly attempt: QuizAttempt;
      readonly status: LessonProgressStatus;
    }
  | { readonly kind: "changed" };

const quizChanged = () =>
  new AppError(
    "conflict",
    "quiz_changed",
    "This quiz was edited while you were taking it. Start a new attempt.",
  );

async function progressTo(
  tx: StorageTransaction,
  context: RequestContext,
  accessible: AccessibleLesson,
  target: "in_progress" | "completed",
) {
  const outcome = await applyLessonProgress(tx, context, {
    course: accessible.course,
    lesson: accessible.lesson,
    progressLessons: accessible.view.progressLessons,
    target,
  });
  return outcome.status;
}

async function submitInTransaction(
  tx: StorageTransaction,
  context: RequestContext,
  input: Input & { attemptId: QuizAttempt["id"] },
): Promise<Submitted> {
  const { accessible, lessonQuiz } = input;
  // Enrollment first, then the attempt row: the same lock order as opening.
  const started = await progressTo(tx, context, accessible, "in_progress");
  const attempt = await tx.lockQuizAttempt(
    context.scope,
    context.learner.learnerId,
    input.attemptId,
  );
  if (attempt?.lessonId !== accessible.lesson.id) throw httpErrors.notFound();
  if (attempt.status === "voided") return { kind: "changed" };
  // A retry of a submission that already went through gets the stored result.
  if (attempt.status !== "open") return { kind: "closed", attempt, status: started };
  if (attempt.quizVersion !== lessonQuiz.quiz.version) {
    await voidAttempt(tx, context, attempt);
    return { kind: "changed" };
  }
  const now = context.now();
  const late = isPastDeadline(attempt.expiresAt, now);
  const closed = await closeAttempt(tx, context, {
    accessible,
    lessonQuiz,
    attempt,
    answers: late ? null : input.answers,
    closedAt: now,
  });
  const status =
    closed.passed === true ? await progressTo(tx, context, accessible, "completed") : started;
  return { kind: "closed", attempt: closed, status };
}

/**
 * POST /v1/lessons/:id/quiz/attempts/:attemptId/submit: grades an attempt on
 * the server (spec 07). Past the time limit it expires with a score of 0. A
 * passing attempt completes the lesson; corrections follow `showCorrection`.
 */
export async function submitQuizAttempt(
  context: RequestContext,
  params: { lessonId: string | undefined; attemptId: string | undefined },
): Promise<Response> {
  const body = await parseBody(context, submissionBody, SUBMISSION_MAX_BYTES);
  const accessible = await loadAccessibleLesson(context, params.lessonId);
  requireQuizLesson(accessible.lesson);
  const attemptId = quizAttemptIdSchema.safeParse(params.attemptId);
  if (!attemptId.success) throw httpErrors.notFound();
  const loaded = await loadLessonQuiz(context, accessible.lesson);
  const { quiz } = loaded;
  if (quiz === null) throw quizNotReady();
  const lessonQuiz = { ...loaded, quiz };
  const input = { accessible, lessonQuiz, answers: body.answers, attemptId: attemptId.data };
  const outcome = await context.storage.transaction((tx) =>
    submitInTransaction(tx, context, input),
  );
  if (outcome.kind === "changed") throw quizChanged();
  const standing = await context.storage.findQuizStanding(
    context.scope,
    context.learner.learnerId,
    accessible.lesson.id,
  );
  return json(
    presentQuizResult({
      attempt: outcome.attempt,
      status: outcome.status,
      standing,
      settings: lessonQuiz.settings,
      corrections: correctionsFor(lessonQuiz, outcome.attempt, standing),
      now: context.now(),
    }),
    context.requestId,
  );
}
