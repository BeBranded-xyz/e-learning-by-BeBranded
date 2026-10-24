import { courseIdSchema } from "@bebranded/elearning-core";
import type { Course } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { json, noContent } from "../http/responses.js";
import { presentAdminCourse, presentCourseTree } from "../presenters/admin.presenters.js";
import { loadCourseTree } from "../services/course-tree.js";
import { exportFormatsFor } from "../services/export.js";
import { emitIfPublished } from "../services/publishing.js";
import { createCourseBody, updateCourseBody } from "./admin.schemas.js";
import { found, parseId } from "./ids.js";
import { assertNotEmpty, parseBody } from "./parse-body.js";

/** GET /v1/admin/courses: every course of the tenant, drafts included, plus the shared catalog. */
export async function listAdminCourses(context: RequestContext): Promise<Response> {
  const courses = await context.storage.listCourses(context.scope);
  return json(
    { data: courses.map((course) => presentAdminCourse(course, context.scope)), next_cursor: null },
    context.requestId,
  );
}

/** POST /v1/admin/courses: creates a draft course. It stays invisible until published and given an access rule. */
export async function createCourse(context: RequestContext): Promise<Response> {
  const body = await parseBody(context, createCourseBody);
  const course: Course = {
    id: courseIdSchema.parse(context.newId()),
    tenantId: context.scope.tenantId,
    slug: body.slug,
    title: body.title,
    summary: body.summary,
    coverImageUrl: body.cover_image_url,
    status: "draft",
    publishedAt: null,
    completionRule: body.completion_rule,
    enrollmentMode: body.enrollment_mode,
    allowLearnerExport: body.allow_learner_export,
    locale: body.locale,
    metadata: body.metadata,
  };
  await context.storage.transaction((tx) => tx.insertCourse(course));
  return json(presentAdminCourse(course, context.scope), context.requestId, 201);
}

/** GET /v1/admin/courses/:id: the whole tree, drafts included, with every access rule. */
export async function getAdminCourse(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const course = found(
    await context.storage.findCourseById(context.scope, parseId(courseIdSchema, rawId)),
  );
  const tree = await loadCourseTree(context.storage, context.scope, course);
  return json(
    presentCourseTree(course, tree, context.scope, exportFormatsFor(context, course)),
    context.requestId,
  );
}

/** PATCH /v1/admin/courses/:id. Publishing sets published_at once and emits content.published. */
export async function updateCourse(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(courseIdSchema, rawId);
  const body = await parseBody(context, updateCourseBody);
  assertNotEmpty(body);
  const updated = await context.storage.transaction(async (tx) => {
    const before = found(await tx.findCourseById(context.scope, id));
    const publishedAt =
      body.status === "published" && before.publishedAt === null ? context.now() : undefined;
    found(
      await tx.updateCourse(context.scope, id, {
        slug: body.slug,
        title: body.title,
        summary: body.summary,
        coverImageUrl: body.cover_image_url,
        status: body.status,
        publishedAt,
        enrollmentMode: body.enrollment_mode,
        allowLearnerExport: body.allow_learner_export,
        locale: body.locale,
        completionRule: body.completion_rule,
        metadata: body.metadata,
      }),
    );
    await emitIfPublished(tx, context, {
      targetType: "course",
      targetId: id,
      before: before.status,
      after: body.status,
    });
    return found(await tx.findCourseById(context.scope, id));
  });
  return json(presentAdminCourse(updated, context.scope), context.requestId);
}

/** DELETE /v1/admin/courses/:id: removes the course, its tree and its access rules. */
export async function deleteCourse(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const id = parseId(courseIdSchema, rawId);
  found(await context.storage.transaction((tx) => tx.deleteCourse(context.scope, id)));
  return noContent(context.requestId);
}
