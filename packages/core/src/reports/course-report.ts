import type { Enrollment } from "../ports/storage.types.js";

export type CourseReportSummary = {
  readonly enrolled: number;
  readonly started: number;
  readonly completed: number;
  /** Enrollments past their due date and not completed. */
  readonly overdue: number;
  /** Mean progress between 0 and 1; null without enrollments. */
  readonly averageProgress: number | null;
};

export function isOverdue(enrollment: Enrollment, now: Date): boolean {
  return (
    enrollment.completedAt === null &&
    enrollment.dueAt !== null &&
    enrollment.dueAt.getTime() < now.getTime()
  );
}

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/** Tracking of one course (spec 04, reports): pure, so every entry point counts the same way. */
export function summarizeEnrollments(
  enrollments: readonly Enrollment[],
  now: Date,
): CourseReportSummary {
  const total = enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0);
  return {
    enrolled: enrollments.length,
    started: enrollments.filter((enrollment) => enrollment.startedAt !== null).length,
    completed: enrollments.filter((enrollment) => enrollment.completedAt !== null).length,
    overdue: enrollments.filter((enrollment) => isOverdue(enrollment, now)).length,
    averageProgress: enrollments.length === 0 ? null : round(total / enrollments.length),
  };
}
