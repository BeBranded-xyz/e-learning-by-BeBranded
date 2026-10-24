import type { CompletionRule } from "../content/content.schemas.js";
import type { LessonId } from "../content/ids.js";

export type LessonProgressStatus = "not_started" | "in_progress" | "completed";

const STATUS_ORDER: Record<LessonProgressStatus, number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
};

/**
 * Lesson progress only moves forward: a completed lesson never goes back to an
 * incomplete state (PROJECT.md, business invariants).
 */
export function advanceLessonStatus(
  current: LessonProgressStatus,
  next: LessonProgressStatus,
): LessonProgressStatus {
  return STATUS_ORDER[next] > STATUS_ORDER[current] ? next : current;
}

export type ProgressLesson = {
  readonly id: LessonId;
  readonly isRequired: boolean;
  /** Result of `canAccess` for the learner; inaccessible lessons do not count. */
  readonly accessible: boolean;
};

export type CourseProgress = {
  readonly completedRequired: number;
  readonly totalRequired: number;
  /** Between 0 and 1. 0 when the learner has no required lesson. */
  readonly ratio: number;
  readonly isComplete: boolean;
};

/**
 * Course or chapter progress (spec 03, "Computation rules"): completed
 * required lessons over the required lessons the learner can access.
 */
export function computeProgress(
  lessons: readonly ProgressLesson[],
  statuses: ReadonlyMap<LessonId, LessonProgressStatus>,
  rule: CompletionRule = { type: "all_required_lessons" },
): CourseProgress {
  const counted = lessons.filter((lesson) => lesson.isRequired && lesson.accessible);
  const completedRequired = counted.filter(
    (lesson) => statuses.get(lesson.id) === "completed",
  ).length;
  const totalRequired = counted.length;
  const ratio = totalRequired === 0 ? 0 : completedRequired / totalRequired;
  return {
    completedRequired,
    totalRequired,
    ratio,
    isComplete: totalRequired > 0 && ratio >= (rule.type === "percentage" ? rule.threshold : 1),
  };
}
