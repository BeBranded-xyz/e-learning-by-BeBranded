import { canAccess, computeProgress } from "@bebranded/elearning-core";
import type {
  AccessRule,
  Chapter,
  Course,
  CourseProgress,
  Enrollment,
  LessonId,
  LessonProgressStatus,
  LessonSummary,
  ProgressLesson,
} from "@bebranded/elearning-core";

import type { RequestContext } from "../context.js";

type LessonView = { readonly lesson: LessonSummary; readonly status: LessonProgressStatus };
export type ChapterView = { readonly chapter: Chapter; readonly lessons: readonly LessonView[] };

export type CourseView = {
  readonly course: Course;
  readonly chapters: readonly ChapterView[];
  readonly progressLessons: readonly ProgressLesson[];
  readonly progress: CourseProgress;
  readonly enrollment: Enrollment | null;
};

const node = (id: string, status: string) => ({ id, published: status === "published" });

/**
 * A course is visible when the access rules allow it (spec 05) and, for an
 * assignment-only course, when the learner has been enrolled.
 */
export function isCourseVisible(
  course: Course,
  rules: readonly AccessRule[],
  context: RequestContext,
  enrollment: Enrollment | null,
): boolean {
  const decision = canAccess(context.learner, { course: node(course.id, course.status) }, rules);
  return decision.allowed && (course.enrollmentMode === "self" || enrollment !== null);
}

function canSeeLesson(
  context: RequestContext,
  path: { course: Course; chapter: Chapter; lesson: LessonSummary },
  rules: readonly AccessRule[],
): boolean {
  const contentPath = {
    course: node(path.course.id, path.course.status),
    chapter: node(path.chapter.id, path.chapter.status),
    lesson: node(path.lesson.id, path.lesson.status),
  };
  return canAccess(context.learner, contentPath, rules).allowed;
}

function visibilityOf(
  context: RequestContext,
  course: Course,
  chapters: readonly Chapter[],
  rules: readonly AccessRule[],
) {
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return (lesson: LessonSummary): boolean => {
    const chapter = chapterById.get(lesson.chapterId);
    return chapter !== undefined && canSeeLesson(context, { course, chapter, lesson }, rules);
  };
}

/** Chapters in order with their visible lessons; chapters left empty are omitted. */
function buildChapterViews(
  chapters: readonly Chapter[],
  visibleLessons: readonly LessonSummary[],
  statuses: ReadonlyMap<LessonId, LessonProgressStatus>,
): ChapterView[] {
  return chapters
    .map((chapter) => ({
      chapter,
      lessons: visibleLessons
        .filter((lesson) => lesson.chapterId === chapter.id)
        .map((lesson) => ({ lesson, status: statuses.get(lesson.id) ?? "not_started" })),
    }))
    .filter((view) => view.lessons.length > 0);
}

/**
 * Loads the learner's view of one course with a fixed number of queries
 * (chapters, lessons, rules, progress, enrollment), whatever its size.
 * Returns null when the course is not visible to the learner.
 */
export async function loadCourseView(
  context: RequestContext,
  course: Course,
): Promise<CourseView | null> {
  const { storage, scope, learner } = context;
  const [chapters, lessons, enrollment] = await Promise.all([
    storage.listChapters(scope, [course.id]),
    storage.listLessons(scope, [course.id]),
    storage.findEnrollment(scope, course.id, learner.learnerId),
  ]);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const ids = [course.id, ...chapters.map((chapter) => chapter.id), ...lessonIds];
  const [rules, progressRows] = await Promise.all([
    storage.listAccessRules(scope, ids),
    storage.listLessonProgress(scope, learner.learnerId, lessonIds),
  ]);
  if (!isCourseVisible(course, rules, context, enrollment)) return null;

  const statuses = new Map<LessonId, LessonProgressStatus>(
    progressRows.map((row) => [row.lessonId, row.status]),
  );
  const visible = visibilityOf(context, course, chapters, rules);
  const progressLessons = lessons.map((lesson) => ({
    id: lesson.id,
    isRequired: lesson.isRequired,
    accessible: visible(lesson),
  }));
  return {
    course,
    chapters: buildChapterViews(chapters, lessons.filter(visible), statuses),
    progressLessons,
    progress: computeProgress(progressLessons, statuses),
    enrollment,
  };
}
