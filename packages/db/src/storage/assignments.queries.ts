import { sql } from "kysely";
import type { Expression, Kysely, Selectable, SqlBool } from "kysely";

import {
  assignmentAudienceSchema,
  assignmentIdSchema,
  courseIdSchema,
  learnerIdSchema,
} from "@bebranded/elearning-core";
import type {
  AssignmentId,
  CourseAssignment,
  CourseId,
  Learner,
  TenantScope,
} from "@bebranded/elearning-core";

import type { CourseAssignments, DB } from "../database.gen.js";
import { audienceColumns, toAudience } from "./mappers.js";
import { ownedBy } from "./tenant-filters.js";

// Assignments always belong to the admin's own tenant, even for a shared course.

function toCourseAssignment(row: Selectable<CourseAssignments>): CourseAssignment {
  return {
    id: assignmentIdSchema.parse(row.id),
    courseId: courseIdSchema.parse(row.course_id),
    audience: assignmentAudienceSchema.parse(toAudience(row.audience_type, row.audience_value)),
    dueAt: row.due_at,
    assignedBy: learnerIdSchema.parse(row.assigned_by),
    createdAt: row.created_at,
  };
}

export async function listCourseAssignments(
  db: Kysely<DB>,
  scope: TenantScope,
  courseId: CourseId,
): Promise<CourseAssignment[]> {
  const rows = await db
    .selectFrom("course_assignments")
    .selectAll()
    .where("course_id", "=", courseId)
    .where(ownedBy("course_assignments.tenant_id", scope))
    .orderBy("created_at")
    .orderBy("id")
    .execute();
  return rows.map(toCourseAssignment);
}

type AssignedLearner = Pick<Learner, "learnerId" | "roles" | "grade">;

export async function listPendingAssignments(
  db: Kysely<DB>,
  scope: TenantScope,
  learner: AssignedLearner,
): Promise<CourseAssignment[]> {
  const rows = await db
    .selectFrom("course_assignments as a")
    .selectAll("a")
    .where(ownedBy("a.tenant_id", scope))
    .where((eb) => {
      const targets: Expression<SqlBool>[] = [
        eb.and([
          eb("a.audience_type", "=", "learner"),
          eb("a.audience_value", "=", learner.learnerId),
        ]),
      ];
      if (learner.roles.length > 0) {
        targets.push(
          eb.and([eb("a.audience_type", "=", "role"), eb("a.audience_value", "in", learner.roles)]),
        );
      }
      if (learner.grade !== null) {
        // CASE guards the cast: only grade values are digits (CHECK constraint).
        targets.push(
          sql<SqlBool>`CASE WHEN a.audience_type = 'grade_min' THEN a.audience_value::integer <= ${learner.grade} ELSE false END`,
        );
      }
      return eb.or(targets);
    })
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("enrollments as e")
            .select("e.id")
            .whereRef("e.course_id", "=", "a.course_id")
            .where("e.learner_id", "=", learner.learnerId),
        ),
      ),
    )
    .orderBy("a.created_at")
    .orderBy("a.id")
    .execute();
  return rows.map(toCourseAssignment);
}

export async function saveCourseAssignment(
  db: Kysely<DB>,
  scope: TenantScope,
  assignment: CourseAssignment,
): Promise<CourseAssignment> {
  const row = await db
    .insertInto("course_assignments")
    .values({
      id: assignment.id,
      tenant_id: scope.tenantId,
      course_id: assignment.courseId,
      // `everyone` is not an assignment audience, so the value is never null.
      audience_type: assignment.audience.type,
      audience_value: audienceColumns(assignment.audience).audience_value ?? "",
      due_at: assignment.dueAt,
      assigned_by: assignment.assignedBy,
      created_at: assignment.createdAt,
    })
    .onConflict((oc) =>
      oc
        .expression(sql`(coalesce(tenant_id, '')), course_id, audience_type, audience_value`)
        .doUpdateSet({ due_at: assignment.dueAt, assigned_by: assignment.assignedBy }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
  return toCourseAssignment(row);
}

export async function deleteCourseAssignment(
  db: Kysely<DB>,
  scope: TenantScope,
  id: AssignmentId,
): Promise<boolean> {
  const result = await db
    .deleteFrom("course_assignments")
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
}
