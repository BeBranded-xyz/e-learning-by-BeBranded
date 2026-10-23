import { AppError, assignmentIdSchema, canAssign, courseIdSchema } from "@bebranded/elearning-core";
import type { AssignmentAudience, CourseAssignment } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json, noContent } from "../http/responses.js";
import { presentAssignment } from "../presenters/admin.presenters.js";
import { enrollFromAssignment } from "../services/assignments.js";
import { createAssignmentBody } from "./assignments.schemas.js";
import type { CreateAssignmentBody } from "./assignments.schemas.js";
import { found, parseId } from "./ids.js";
import { parseBody } from "./parse-body.js";

function toAudience(body: CreateAssignmentBody["audience"]): AssignmentAudience {
  return body.type === "learner" ? { type: "learner", learnerId: body.learner_id } : body;
}

const audienceWithoutAccess = () =>
  new AppError(
    "conflict",
    "audience_without_access",
    "The access rules of this course do not let this audience see it.",
  );

/**
 * POST /v1/admin/assignments (spec 05): assigns a course of the tenant or of
 * the shared catalog. Refused with 409 when the audience cannot access the
 * course. A learner is enrolled at once; roles and grades on their next
 * visit. Assigning the same audience again updates the due date (200).
 */
export async function createAssignment(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createAssignmentBody);
  const course = found(await context.storage.findCourseById(context.scope, body.course_id));
  const audience = toAudience(body.audience);
  const rules = await context.storage.listAccessRules(context.scope, [course.id]);
  if (!canAssign(audience, course.id, rules)) throw audienceWithoutAccess();
  const assignment: CourseAssignment = {
    id: assignmentIdSchema.parse(context.newId()),
    courseId: course.id,
    audience,
    dueAt: body.due_at,
    assignedBy: context.learner.learnerId,
    createdAt: context.now(),
  };
  const stored = await context.storage.transaction(async (tx) => {
    const saved = await tx.saveCourseAssignment(context.scope, assignment);
    if (audience.type === "learner") {
      await enrollFromAssignment(tx, context, saved, {
        learnerId: audience.learnerId,
        source: "assigned",
      });
    }
    return saved;
  });
  const status = stored.id === assignment.id ? 201 : 200;
  return json(presentAssignment(stored), context.requestId, status);
}

/** GET /v1/admin/courses/:id/assignments: the tenant's assignments of a readable course. */
export async function listAssignments(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const courseId = parseId(courseIdSchema, rawId);
  found(await context.storage.findCourseById(context.scope, courseId));
  const assignments = await context.storage.listCourseAssignments(context.scope, courseId);
  return json({ data: assignments.map(presentAssignment), next_cursor: null }, context.requestId);
}

/** DELETE /v1/admin/assignments/:id: enrollments already created are kept. */
export async function deleteAssignment(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(assignmentIdSchema, rawId);
  found(await context.storage.transaction((tx) => tx.deleteCourseAssignment(context.scope, id)));
  return noContent(context.requestId);
}
