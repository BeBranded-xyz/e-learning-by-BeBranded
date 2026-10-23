import type {
  ApiChapter,
  ApiCourse,
  ApiCourseSummary,
  ApiEnrollment,
  ApiLesson,
  ApiLessonVideo,
  ApiProgress,
  ApiVideoHeartbeat,
  ApiVideoProgress,
  Course,
  CourseProgress,
  Enrollment,
  LessonDetail,
  LessonProgressStatus,
  VideoProgress,
} from "@bebranded/elearning-core";

import type { ChapterView, CourseView } from "../services/course-view.js";
import { effectiveSettings } from "../services/lesson-settings.js";
import type { LessonVideo } from "../services/video.js";

// API bodies use snake_case fields and ISO 8601 UTC dates (modules/api-design.mdc).

const iso = (date: Date | null) => (date === null ? null : date.toISOString());

export function presentEnrollment(enrollment: Enrollment | null): ApiEnrollment | null {
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

export function presentCourseSummary(
  course: Course,
  enrollment: Enrollment | null,
): ApiCourseSummary {
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

function presentProgress(progress: CourseProgress): ApiProgress {
  return {
    completed_required: progress.completedRequired,
    total_required: progress.totalRequired,
    ratio: progress.ratio,
    is_complete: progress.isComplete,
  };
}

function presentChapter({ chapter, lessons }: ChapterView): ApiChapter {
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

export function presentCourseView(view: CourseView): ApiCourse {
  return {
    ...presentCourseSummary(view.course, view.enrollment),
    chapters: view.chapters.map(presentChapter),
    progress: presentProgress(view.progress),
  };
}

function presentVideoProgress(progress: VideoProgress | null): ApiVideoProgress {
  return {
    watched_seconds: progress?.watchedSeconds ?? 0,
    coverage: progress?.coverage ?? 0,
    last_position: progress?.lastPosition ?? 0,
    watched_ranges: progress?.watchedRanges ?? [],
  };
}

function presentLessonVideo({ asset, progress, playback }: LessonVideo): ApiLessonVideo {
  return {
    status: asset?.status ?? "uploading",
    duration_seconds: asset?.durationSeconds ?? null,
    thumbnail_url: asset?.thumbnailUrl ?? null,
    captions: asset?.captions ?? [],
    playback:
      playback === null
        ? null
        : { type: playback.type, url: playback.url, expires_at: playback.expiresAt.toISOString() },
    progress: presentVideoProgress(progress),
  };
}

export function presentHeartbeat(outcome: {
  accepted: boolean;
  status: LessonProgressStatus;
  progress: VideoProgress | null;
}): ApiVideoHeartbeat {
  return {
    accepted: outcome.accepted,
    status: outcome.status,
    progress: presentVideoProgress(outcome.progress),
  };
}

export function presentLesson(
  lesson: LessonDetail,
  html: string,
  status: LessonProgressStatus,
  video: LessonVideo | null,
): ApiLesson {
  return {
    id: lesson.id,
    course_id: lesson.courseId,
    chapter_id: lesson.chapterId,
    type: lesson.type,
    title: lesson.title,
    estimated_minutes: lesson.estimatedMinutes,
    is_required: lesson.isRequired,
    html,
    settings: effectiveSettings(lesson.type, lesson.settings),
    status,
    video: video === null ? null : presentLessonVideo(video),
    quiz: null,
  };
}
