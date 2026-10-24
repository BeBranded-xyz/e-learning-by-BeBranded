import type { Kysely } from "kysely";

import type {
  CourseId,
  Enrollment,
  LessonId,
  QuizAttempt,
  TenantScope,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { toEnrollment } from "./mappers.js";
import { toQuizAttempt } from "./quiz.mappers.js";
import { ownedBy } from "./tenant-filters.js";

// Reports only cover the admin's own tenant: learner data never crosses tenants.

export async function listCourseEnrollments(
  db: Kysely<DB>,
  scope: TenantScope,
  courseId: CourseId,
): Promise<Enrollment[]> {
  const rows = await db
    .selectFrom("enrollments")
    .selectAll()
    .where("course_id", "=", courseId)
    .where(ownedBy("enrollments.tenant_id", scope))
    .orderBy("created_at")
    .orderBy("id")
    .execute();
  return rows.map(toEnrollment);
}

export async function listClosedQuizAttempts(
  db: Kysely<DB>,
  scope: TenantScope,
  lessonId: LessonId,
): Promise<QuizAttempt[]> {
  const rows = await db
    .selectFrom("quiz_attempts")
    .innerJoin("lesson_progress", "lesson_progress.id", "quiz_attempts.lesson_progress_id")
    .selectAll("quiz_attempts")
    .select(["lesson_progress.lesson_id", "lesson_progress.learner_id"])
    .where("lesson_progress.lesson_id", "=", lessonId)
    .where(ownedBy("lesson_progress.tenant_id", scope))
    .where("quiz_attempts.status", "in", ["submitted", "expired"])
    .orderBy("quiz_attempts.closed_at")
    .orderBy("quiz_attempts.id")
    .execute();
  return rows.map(toQuizAttempt);
}
