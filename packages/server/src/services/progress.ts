import {
  advanceLessonStatus,
  computeProgress,
  enrollmentIdSchema,
} from "@bebranded/elearning-core";
import type {
  Course,
  Enrollment,
  LessonId,
  LessonProgress,
  LessonProgressStatus,
  LessonSummary,
  ProgressLesson,
  StorageTransaction,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { emit } from "./events.js";

export type ProgressInput = {
  readonly course: Course;
  readonly lesson: LessonSummary;
  /** Course lessons with the learner's access, computed before the transaction. */
  readonly progressLessons: readonly ProgressLesson[];
  readonly target: Exclude<LessonProgressStatus, "not_started">;
};

export type ProgressOutcome = {
  readonly status: LessonProgressStatus;
  readonly enrollment: Enrollment;
};

export function newEnrollment(context: RequestContext, course: Course): Enrollment {
  return {
    id: enrollmentIdSchema.parse(context.newId()),
    courseId: course.id,
    learnerId: context.learner.learnerId,
    source: "self",
    assignedBy: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    progress: 0,
  };
}

/** Recomputes the denormalized course progress and completes the enrollment once. */
export async function refreshEnrollment(
  tx: StorageTransaction,
  context: RequestContext,
  enrollment: Enrollment,
  progressLessons: readonly ProgressLesson[],
): Promise<Enrollment> {
  const rows = await tx.listLessonProgress(
    context.scope,
    context.learner.learnerId,
    progressLessons.map((lesson) => lesson.id),
  );
  const statuses = new Map<LessonId, LessonProgressStatus>(
    rows.map((row) => [row.lessonId, row.status]),
  );
  const course = await tx.findCourseById(context.scope, enrollment.courseId);
  const progress = computeProgress(progressLessons, statuses, course?.completionRule);
  const completedNow = progress.isComplete && enrollment.completedAt === null;
  const updated = {
    ...enrollment,
    progress: progress.ratio,
    completedAt: completedNow ? context.now() : enrollment.completedAt,
  };
  await tx.saveEnrollment(context.scope, updated);
  if (completedNow) {
    await emit(tx, context, "course.completed", {
      learnerId: updated.learnerId,
      courseId: updated.courseId,
      completedAt: context.now().toISOString(),
    });
  }
  return updated;
}

async function saveLesson(
  tx: StorageTransaction,
  context: RequestContext,
  input: ProgressInput,
  current: LessonProgress | undefined,
) {
  const previous = current?.status ?? "not_started";
  const status = advanceLessonStatus(previous, input.target);
  if (status === previous) return status;
  const now = context.now();
  await tx.saveLessonProgress(context.scope, {
    lessonId: input.lesson.id,
    learnerId: context.learner.learnerId,
    courseId: input.course.id,
    status,
    startedAt: current?.startedAt ?? now,
    completedAt: status === "completed" ? now : null,
  });
  const payload = {
    learnerId: context.learner.learnerId,
    lessonId: input.lesson.id,
    courseId: input.course.id,
  };
  if (previous === "not_started") await emit(tx, context, "lesson.started", payload);
  if (status === "completed") await emit(tx, context, "lesson.completed", payload);
  return status;
}

/**
 * Moves a lesson forward for the learner and keeps the enrollment in sync,
 * inside `tx`, with the enrollment row locked first (no lost update when the
 * same learner completes two lessons at once). Never moves backwards.
 */
export async function applyLessonProgress(
  tx: StorageTransaction,
  context: RequestContext,
  input: ProgressInput,
): Promise<ProgressOutcome> {
  let enrollment = await tx.lockOrCreateEnrollment(
    context.scope,
    newEnrollment(context, input.course),
  );
  const [current] = await tx.listLessonProgress(context.scope, context.learner.learnerId, [
    input.lesson.id,
  ]);
  const status = await saveLesson(tx, context, input, current);
  if (enrollment.startedAt === null) {
    enrollment = { ...enrollment, startedAt: context.now() };
    await emit(tx, context, "course.started", {
      learnerId: enrollment.learnerId,
      courseId: enrollment.courseId,
    });
  }
  return {
    status,
    enrollment: await refreshEnrollment(tx, context, enrollment, input.progressLessons),
  };
}

/** `applyLessonProgress` in its own transaction. */
export function recordLessonProgress(
  context: RequestContext,
  input: ProgressInput,
): Promise<ProgressOutcome> {
  return context.storage.transaction((tx) => applyLessonProgress(tx, context, input));
}
