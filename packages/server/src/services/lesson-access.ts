import { lessonIdSchema } from "@bebranded/elearning-core";
import type { Chapter, Course, LessonDetail } from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";
import { httpErrors } from "../http/http-error.js";
import { loadCourseView } from "./course-view.js";
import type { CourseView } from "./course-view.js";

export type AccessibleLesson = {
  readonly lesson: LessonDetail;
  readonly chapter: Chapter;
  readonly course: Course;
  readonly view: CourseView;
};

/**
 * Loads a lesson the learner may open. A lesson that does not exist and a
 * lesson the learner cannot see give the same 404, so ids leak nothing.
 */
export async function loadAccessibleLesson(
  context: RequestContext,
  rawId: string | undefined,
): Promise<AccessibleLesson> {
  const id = lessonIdSchema.safeParse(rawId);
  if (!id.success) throw httpErrors.notFound();
  const lesson = await context.storage.findLesson(context.scope, id.data);
  if (lesson === null) throw httpErrors.notFound();
  const course = await context.storage.findCourseById(context.scope, lesson.courseId);
  if (course === null) throw httpErrors.notFound();
  const view = await loadCourseView(context, course);
  const chapterView = view?.chapters.find((candidate) =>
    candidate.lessons.some((entry) => entry.lesson.id === lesson.id),
  );
  if (view === null || chapterView === undefined) throw httpErrors.notFound();
  return { lesson, chapter: chapterView.chapter, course, view };
}
