import type {
  AccessRule,
  Chapter,
  Course,
  LessonSummary,
  StorageReads,
  TenantScope,
} from "@bebranded/elearning-core";

export type CourseTree = { chapters: Chapter[]; lessons: LessonSummary[]; rules: AccessRule[] };

/** The whole tree of a course, drafts included, with every access rule of the tree. */
export async function loadCourseTree(
  reads: StorageReads,
  scope: TenantScope,
  course: Course,
): Promise<CourseTree> {
  const [chapters, lessons] = await Promise.all([
    reads.listChapters(scope, [course.id]),
    reads.listLessons(scope, [course.id]),
  ]);
  const ids = [
    course.id,
    ...chapters.map((chapter) => chapter.id),
    ...lessons.map((lesson) => lesson.id),
  ];
  const rules = await reads.listAccessRules(scope, ids);
  return { chapters, lessons, rules };
}
