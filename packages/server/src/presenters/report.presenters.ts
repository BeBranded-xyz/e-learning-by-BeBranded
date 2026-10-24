import { isOverdue } from "@bebranded/elearning-core";
import type {
  Course,
  CourseReportSummary,
  Enrollment,
  QuizReport,
} from "@bebranded/elearning-core";

import type { CsvValue } from "../http/csv.js";

const iso = (date: Date | null) => (date === null ? null : date.toISOString());

export const ENROLLMENT_COLUMNS = [
  "learner_id",
  "course_id",
  "source",
  "assigned_by",
  "due_at",
  "started_at",
  "completed_at",
  "progress",
  "overdue",
] as const;

export function presentEnrollmentRow(enrollment: Enrollment, now: Date) {
  return {
    learner_id: enrollment.learnerId,
    course_id: enrollment.courseId,
    source: enrollment.source,
    assigned_by: enrollment.assignedBy,
    due_at: iso(enrollment.dueAt),
    started_at: iso(enrollment.startedAt),
    completed_at: iso(enrollment.completedAt),
    progress: enrollment.progress,
    overdue: isOverdue(enrollment, now),
  };
}

export type EnrollmentRow = ReturnType<typeof presentEnrollmentRow>;

export function enrollmentCsvRow(row: EnrollmentRow): CsvValue[] {
  return ENROLLMENT_COLUMNS.map((column) => row[column]);
}

export function presentCourseSummary(summary: CourseReportSummary) {
  return {
    enrolled: summary.enrolled,
    started: summary.started,
    completed: summary.completed,
    overdue: summary.overdue,
    average_progress: summary.averageProgress,
  };
}

export function presentReportCourse(course: Course) {
  return { id: course.id, slug: course.slug, title: course.title, status: course.status };
}

export const QUIZ_LEARNER_COLUMNS = [
  "learner_id",
  "attempts",
  "best_score",
  "passed",
  "last_attempt_at",
] as const;

export function presentQuizReport(report: QuizReport) {
  return {
    learners: report.learners,
    attempts: report.attempts,
    pass_rate: report.passRate,
    average_score: report.averageScore,
    average_attempts: report.averageAttempts,
    questions: report.questions.map((question) => ({
      question_id: question.questionId,
      prompt: question.prompt,
      answered: question.answered,
      correct_rate: question.correctRate,
    })),
    learners_results: report.perLearner.map((learner) => ({
      learner_id: learner.learnerId,
      attempts: learner.attempts,
      best_score: learner.bestScore,
      passed: learner.passed,
      last_attempt_at: learner.lastAttemptAt.toISOString(),
    })),
  };
}
