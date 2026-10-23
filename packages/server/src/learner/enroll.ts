import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentEnrollment } from "../presenters/learner.presenters.js";
import { newEnrollment, refreshEnrollment } from "../services/progress.js";
import { findVisibleCourseById } from "./catalog.js";

/**
 * POST /v1/courses/:id/enroll: self-enrollment (spec 05). Idempotent: an
 * existing enrollment is returned with 200, a new one with 201. An
 * assignment-only course is invisible until assigned, so it answers 404.
 */
export async function enroll(
  context: RequestContext,
  courseId: string | undefined,
): Promise<Response> {
  const view = await findVisibleCourseById(context, courseId);
  if (view.enrollment !== null) return json(presentEnrollment(view.enrollment), context.requestId);
  const enrollment = await context.storage.transaction(async (tx) => {
    const stored = await tx.lockOrCreateEnrollment(
      context.scope,
      newEnrollment(context, view.course),
    );
    return refreshEnrollment(tx, context, stored, view.progressLessons);
  });
  return json(presentEnrollment(enrollment), context.requestId, 201);
}
