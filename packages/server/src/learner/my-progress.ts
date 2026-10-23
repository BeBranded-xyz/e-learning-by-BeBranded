import type { RequestContext } from "../context.js";
import { json } from "../http/responses.js";
import { presentCourseSummary } from "../presenters/learner.presenters.js";
import { applyPendingAssignments } from "../services/assignments.js";
import { isCourseVisible } from "../services/course-view.js";

/**
 * GET /v1/me/progress: the learner's enrollments ("My training"). Courses
 * that are no longer visible keep their progress but are not listed (spec 05).
 */
export async function myProgress(context: RequestContext): Promise<Response> {
  await applyPendingAssignments(context);
  const { storage, scope, learner } = context;
  const [enrollments, courses] = await Promise.all([
    storage.listEnrollments(scope, learner.learnerId),
    storage.listCourses(scope),
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const rules = await storage.listAccessRules(
    scope,
    enrollments.map((enrollment) => enrollment.courseId),
  );
  const data = enrollments.flatMap((enrollment) => {
    const course = courseById.get(enrollment.courseId);
    if (course === undefined || !isCourseVisible(course, rules, context, enrollment)) return [];
    return [presentCourseSummary(course, enrollment)];
  });
  return json({ data, next_cursor: null }, context.requestId);
}
