import type {
  Course,
  CourseProgress,
  Enrollment,
  LessonDetail,
  LessonProgressStatus,
} from "@bebranded/elearning-core";

import type { ChapterView, CourseView } from "../services/course-view.js";

// API bodies use snake_case fields and ISO 8601 UTC dates (modules/api-design.mdc).

const iso = (date: Date | null) => (date === null ? null : date.toISOString());

export function presentEnrollment(enrollment: Enrollment | null) {
  if (enrollment === null) return null;
  return {
    id: enrollment.id,
    course_id: enrollment.courseId,
    source: enrollment.source,
    progress: enrollment.progress,
    due_at: iso(enrollment.dueAt),
    started_at: iso(enrollment.startedAt),
    completed_at: iso(enrollment.completedAt),
  };
}

export function presentCourseSummary(course: Course, enrollment: Enrollment | null) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    cover_image_url: course.coverImageUrl,
    locale: course.locale,
    enrollment_mode: course.enrollmentMode,
    enrollment: presentEnrollment(enrollment),
  };
}

function presentProgress(progress: CourseProgress) {
  return {
    completed_required: progress.completedRequired,
    total_required: progress.totalRequired,
    ratio: progress.ratio,
    is_complete: progress.isComplete,
  };
}

function presentChapter({ chapter, lessons }: ChapterView) {
  return {
    id: chapter.id,
    title: chapter.title,
    position: chapter.position,
    lessons: lessons.map(({ lesson, status }) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      position: lesson.position,
      is_required: lesson.isRequired,
      estimated_minutes: lesson.estimatedMinutes,
      status,
    })),
  };
}

export function presentCourseView(view: CourseView) {
  return {
    ...presentCourseSummary(view.course, view.enrollment),
    chapters: view.chapters.map(presentChapter),
    progress: presentProgress(view.progress),
  };
}

export function presentLesson(lesson: LessonDetail, html: string, status: LessonProgressStatus) {
  return {
    id: lesson.id,
    course_id: lesson.courseId,
    chapter_id: lesson.chapterId,
    type: lesson.type,
    title: lesson.title,
    estimated_minutes: lesson.estimatedMinutes,
    is_required: lesson.isRequired,
    html,
    settings: lesson.settings,
    status,
  };
}
