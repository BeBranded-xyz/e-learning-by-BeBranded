import { courseIdSchema } from "@bebranded/elearning-core";
import type { Course } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { httpErrors } from "../http/http-error.js";
import { json } from "../http/responses.js";
import { presentCourseSummary, presentCourseView } from "../presenters/learner.presenters.js";
import { isCourseVisible, loadCourseView } from "../services/course-view.js";

/** GET /v1/courses: published courses the learner may see, with their enrollment. */
export async function listCatalog(context: RequestContext): Promise<Response> {
  const { storage, scope, learner } = context;
  const courses = (await storage.listCourses(scope)).filter(
    (course) => course.status === "published",
  );
  const [rules, enrollments] = await Promise.all([
    storage.listAccessRules(
      scope,
      courses.map((course) => course.id),
    ),
    storage.listEnrollments(scope, learner.learnerId),
  ]);
  const enrollmentByCourse = new Map(
    enrollments.map((enrollment) => [enrollment.courseId, enrollment]),
  );
  const data = courses
    .filter((course) =>
      isCourseVisible(course, rules, context, enrollmentByCourse.get(course.id) ?? null),
    )
    .map((course) => presentCourseSummary(course, enrollmentByCourse.get(course.id) ?? null));
  return json({ data, next_cursor: null }, context.requestId);
}

async function findVisibleCourse(context: RequestContext, find: () => Promise<Course | null>) {
  const course = await find();
  const view = course === null ? null : await loadCourseView(context, course);
  if (view === null) throw httpErrors.notFound();
  return view;
}

/** GET /v1/courses/:slug: the course tree the learner may see, with progress. */
export async function getCourse(
  context: RequestContext,
  slug: string | undefined,
): Promise<Response> {
  const view = await findVisibleCourse(context, () =>
    context.storage.findCourseBySlug(context.scope, slug ?? ""),
  );
  return json(presentCourseView(view), context.requestId);
}

export async function findVisibleCourseById(context: RequestContext, rawId: string | undefined) {
  const id = courseIdSchema.safeParse(rawId);
  if (!id.success) throw httpErrors.notFound();
  return findVisibleCourse(context, () => context.storage.findCourseById(context.scope, id.data));
}
