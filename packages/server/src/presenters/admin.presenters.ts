import type {
  AccessRule,
  Chapter,
  Course,
  LessonDetail,
  LessonSummary,
  TenantScope,
} from "@bebranded/elearning-core";

const iso = (date: Date | null) => (date === null ? null : date.toISOString());

/** Shared-catalog content is visible to every tenant but editable only by its owner (null tenant). */
const editable = (tenantId: string | null, scope: TenantScope) => tenantId === scope.tenantId;

export function presentAdminCourse(course: Course, scope: TenantScope) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    cover_image_url: course.coverImageUrl,
    status: course.status,
    published_at: iso(course.publishedAt),
    enrollment_mode: course.enrollmentMode,
    completion_rule: course.completionRule,
    locale: course.locale,
    metadata: course.metadata,
    editable: editable(course.tenantId, scope),
  };
}

export function presentChapter(chapter: Chapter) {
  return {
    id: chapter.id,
    course_id: chapter.courseId,
    title: chapter.title,
    position: chapter.position,
    status: chapter.status,
  };
}

function presentLessonSummary(lesson: LessonSummary) {
  return {
    id: lesson.id,
    course_id: lesson.courseId,
    chapter_id: lesson.chapterId,
    type: lesson.type,
    title: lesson.title,
    position: lesson.position,
    status: lesson.status,
    is_required: lesson.isRequired,
    estimated_minutes: lesson.estimatedMinutes,
  };
}

export function presentLessonDetail(lesson: LessonDetail) {
  return {
    ...presentLessonSummary(lesson),
    content: lesson.content,
    content_schema_version: lesson.contentSchemaVersion,
    settings: lesson.settings,
  };
}

function presentAudience(rule: AccessRule) {
  const { audience } = rule;
  return audience.type === "learner"
    ? { type: "learner", learner_id: audience.learnerId }
    : audience;
}

export function presentAccessRule(rule: AccessRule) {
  return {
    id: rule.id,
    target_type: rule.targetType,
    target_id: rule.targetId,
    effect: rule.effect,
    audience: presentAudience(rule),
  };
}

export function presentCourseTree(
  course: Course,
  tree: { chapters: Chapter[]; lessons: LessonSummary[]; rules: AccessRule[] },
  scope: TenantScope,
) {
  return {
    ...presentAdminCourse(course, scope),
    chapters: tree.chapters.map((chapter) => ({
      ...presentChapter(chapter),
      lessons: tree.lessons
        .filter((lesson) => lesson.chapterId === chapter.id)
        .map(presentLessonSummary),
    })),
    access_rules: tree.rules.map(presentAccessRule),
  };
}
