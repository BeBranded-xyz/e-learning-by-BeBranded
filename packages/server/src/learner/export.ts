import {
  buildCourseExport,
  buildLessonExport,
  courseIdSchema,
  lessonIdSchema,
} from "@bebranded/elearning-core";
import type { Course, LessonDetail } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { found, parseId } from "../admin/ids.js";
import { loadCourseTree } from "../services/course-tree.js";
import { loadCourseView } from "../services/course-view.js";
import {
  assertMayExport,
  exportFormatOf,
  requireExporter,
  sendExport,
  toExportLesson,
} from "../services/export.js";
import { loadAccessibleLesson } from "../services/lesson-access.js";

/** The lesson as its requester may see it: any lesson for an admin, an accessible one otherwise. */
async function lessonFor(
  context: RequestContext,
  rawId: string | undefined,
): Promise<{ lesson: LessonDetail; course: Course }> {
  if (!context.learner.isAdmin) return loadAccessibleLesson(context, rawId);
  const lesson = found(
    await context.storage.findLesson(context.scope, parseId(lessonIdSchema, rawId)),
  );
  const course = found(await context.storage.findCourseById(context.scope, lesson.courseId));
  return { lesson, course };
}

/** GET /v1/lessons/:id/export?format=pdf|docx (spec 10). */
export async function exportLesson(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const format = exportFormatOf(context);
  const exporter = requireExporter(context, format);
  const { lesson, course } = await lessonFor(context, rawId);
  assertMayExport(context, course);
  const document = buildLessonExport({
    lesson: toExportLesson(context, course, lesson),
    courseTitle: course.title,
    locale: course.locale,
    exportedAt: context.now(),
  });
  return sendExport(context, {
    document,
    format,
    exporter,
    filename: `${course.slug}-${lesson.id.slice(0, 8)}`,
  });
}

/** Chapters and lesson ids in order: the whole tree for admins, what the learner can open otherwise. */
async function outline(context: RequestContext, course: Course) {
  if (context.learner.isAdmin) {
    const tree = await loadCourseTree(context.storage, context.scope, course);
    return tree.chapters.map((chapter) => ({
      title: chapter.title,
      lessonIds: tree.lessons
        .filter((lesson) => lesson.chapterId === chapter.id)
        .map((lesson) => lesson.id),
    }));
  }
  const view = found(await loadCourseView(context, course));
  return view.chapters.map((chapter) => ({
    title: chapter.chapter.title,
    lessonIds: chapter.lessons.map((entry) => entry.lesson.id),
  }));
}

/** GET /v1/courses/:id/export?format=pdf|docx: a cover, contents, then every accessible lesson. */
export async function exportCourse(
  context: RequestContext,
  rawId: string | undefined,
): Promise<Response> {
  const format = exportFormatOf(context);
  const exporter = requireExporter(context, format);
  const course = found(
    await context.storage.findCourseById(context.scope, parseId(courseIdSchema, rawId)),
  );
  const chapters = await outline(context, course);
  assertMayExport(context, course);
  const withLessons = await Promise.all(
    chapters.map(async (chapter) => ({
      title: chapter.title,
      lessons: (
        await Promise.all(
          chapter.lessonIds.map((id) => context.storage.findLesson(context.scope, id)),
        )
      )
        .filter((lesson): lesson is LessonDetail => lesson !== null)
        .map((lesson) => toExportLesson(context, course, lesson)),
    })),
  );
  const document = buildCourseExport({
    course,
    chapters: withLessons,
    locale: course.locale,
    exportedAt: context.now(),
  });
  return sendExport(context, { document, format, exporter, filename: course.slug });
}
