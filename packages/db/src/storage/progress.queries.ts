import type { Kysely } from "kysely";

import type {
  CourseId,
  Enrollment,
  LearnerId,
  LessonId,
  LessonProgress,
  TenantScope,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { toEnrollment, toLessonProgress } from "./mappers.js";
import { ownedBy } from "./tenant-filters.js";

// Learner data always belongs to the learner's own tenant (never shared).

export async function listLessonProgress(
  db: Kysely<DB>,
  scope: TenantScope,
  learnerId: LearnerId,
  lessonIds: readonly LessonId[],
): Promise<LessonProgress[]> {
  if (lessonIds.length === 0) return [];
  const rows = await db
    .selectFrom("lesson_progress")
    .selectAll()
    .where("learner_id", "=", learnerId)
    .where("lesson_id", "in", lessonIds)
    .where(ownedBy("lesson_progress.tenant_id", scope))
    .execute();
  return rows.map(toLessonProgress);
}

export async function saveLessonProgress(
  db: Kysely<DB>,
  scope: TenantScope,
  progress: LessonProgress,
): Promise<void> {
  const values = {
    status: progress.status,
    started_at: progress.startedAt,
    completed_at: progress.completedAt,
  };
  await db
    .insertInto("lesson_progress")
    .values({
      ...values,
      tenant_id: scope.tenantId,
      lesson_id: progress.lessonId,
      course_id: progress.courseId,
      learner_id: progress.learnerId,
    })
    .onConflict((oc) =>
      oc
        .columns(["lesson_id", "learner_id"])
        .doUpdateSet(values)
        .where(ownedBy("lesson_progress.tenant_id", scope)),
    )
    .execute();
}

function enrollmentQuery(
  db: Kysely<DB>,
  scope: TenantScope,
  courseId: CourseId,
  learnerId: LearnerId,
) {
  return db
    .selectFrom("enrollments")
    .selectAll()
    .where("course_id", "=", courseId)
    .where("learner_id", "=", learnerId)
    .where(ownedBy("enrollments.tenant_id", scope));
}

export async function findEnrollment(
  db: Kysely<DB>,
  scope: TenantScope,
  key: { courseId: CourseId; learnerId: LearnerId },
  options: { forUpdate: boolean },
): Promise<Enrollment | null> {
  const query = enrollmentQuery(db, scope, key.courseId, key.learnerId);
  const row = await (options.forUpdate ? query.forUpdate() : query).executeTakeFirst();
  return row === undefined ? null : toEnrollment(row);
}

export async function listEnrollments(
  db: Kysely<DB>,
  scope: TenantScope,
  learnerId: LearnerId,
): Promise<Enrollment[]> {
  const rows = await db
    .selectFrom("enrollments")
    .selectAll()
    .where("learner_id", "=", learnerId)
    .where(ownedBy("enrollments.tenant_id", scope))
    .orderBy("created_at")
    .orderBy("id")
    .execute();
  return rows.map(toEnrollment);
}

export async function saveEnrollment(
  db: Kysely<DB>,
  scope: TenantScope,
  enrollment: Enrollment,
): Promise<void> {
  const values = {
    source: enrollment.source,
    assigned_by: enrollment.assignedBy,
    due_at: enrollment.dueAt,
    started_at: enrollment.startedAt,
    completed_at: enrollment.completedAt,
    progress: enrollment.progress,
  };
  await db
    .insertInto("enrollments")
    .values({
      ...values,
      id: enrollment.id,
      tenant_id: scope.tenantId,
      course_id: enrollment.courseId,
      learner_id: enrollment.learnerId,
    })
    .onConflict((oc) =>
      oc
        .columns(["course_id", "learner_id"])
        .doUpdateSet(values)
        .where(ownedBy("enrollments.tenant_id", scope)),
    )
    .execute();
}
