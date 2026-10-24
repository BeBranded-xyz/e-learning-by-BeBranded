import { courseIdSchema, learnerIdSchema, summarizeEnrollments } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { csvResponse, toCsv } from "../http/csv.js";
import { json } from "../http/responses.js";
import {
  ENROLLMENT_COLUMNS,
  enrollmentCsvRow,
  presentCourseSummary,
  presentEnrollmentRow,
  presentReportCourse,
} from "../presenters/report.presenters.js";
import { found, parseId } from "./ids.js";

/** `?format=csv` downloads the rows; anything else answers JSON. */
export function wantsCsv(context: RequestContext): boolean {
  return new URL(context.request.url).searchParams.get("format") === "csv";
}

/**
 * GET /v1/admin/reports/courses/:id: tracking of one readable course for the
 * tenant's learners (spec 04, section 8), with a summary; CSV with
 * `?format=csv`.
 */
export async function getCourseReport(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const course = found(
    await context.storage.findCourseById(context.scope, parseId(courseIdSchema, rawId)),
  );
  const enrollments = await context.storage.listCourseEnrollments(context.scope, course.id);
  const now = context.now();
  const rows = enrollments.map((enrollment) => presentEnrollmentRow(enrollment, now));
  if (wantsCsv(context)) {
    const csv = toCsv(ENROLLMENT_COLUMNS, rows.map(enrollmentCsvRow));
    return csvResponse(csv, `course-${course.slug}.csv`, context.requestId);
  }
  return json(
    {
      course: presentReportCourse(course),
      summary: presentCourseSummary(summarizeEnrollments(enrollments, now)),
      data: rows,
      next_cursor: null,
    },
    context.requestId,
  );
}

/**
 * GET /v1/admin/reports/learners/:learnerId: every enrollment of one learner
 * of the tenant, with the course titles; CSV with `?format=csv`.
 */
export async function getLearnerReport(
  context: RequestContext,
  rawLearnerId: string | undefined,
): Promise<Response> {
  const learnerId = parseId(learnerIdSchema, rawLearnerId);
  const [enrollments, courses] = await Promise.all([
    context.storage.listEnrollments(context.scope, learnerId),
    context.storage.listCourses(context.scope),
  ]);
  const byId = new Map(courses.map((course) => [course.id, course]));
  const now = context.now();
  const rows = enrollments.map((enrollment) => ({
    ...presentEnrollmentRow(enrollment, now),
    course_title: byId.get(enrollment.courseId)?.title ?? null,
  }));
  if (wantsCsv(context)) {
    const csv = toCsv(
      [...ENROLLMENT_COLUMNS, "course_title"],
      rows.map((row) => [...enrollmentCsvRow(row), row.course_title]),
    );
    return csvResponse(csv, "learner-report.csv", context.requestId);
  }
  return json(
    {
      learner_id: learnerId,
      summary: presentCourseSummary(summarizeEnrollments(enrollments, now)),
      data: rows,
      next_cursor: null,
    },
    context.requestId,
  );
}
