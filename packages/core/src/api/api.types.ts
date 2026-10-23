import type { JsonValue } from "../ports/storage.types.js";
import type { LessonProgressStatus } from "../progress/progress.js";

/**
 * The learner API contract (spec 04, section 8): JSON bodies with snake_case
 * fields and ISO 8601 UTC dates. The server presenters are typed against
 * these, and the React client consumes them, so the two cannot drift.
 */

export type ApiCollection<T> = { readonly data: readonly T[]; readonly next_cursor: string | null };

export type ApiEnrollment = {
  readonly id: string;
  readonly course_id: string;
  readonly source: "self" | "assigned" | "auto";
  readonly progress: number;
  readonly due_at: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
};

export type ApiCourseSummary = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly cover_image_url: string | null;
  readonly locale: string;
  readonly enrollment_mode: "self" | "assignment_only";
  readonly enrollment: ApiEnrollment | null;
};

export type ApiLessonType = "text" | "video" | "quiz";

export type ApiCourseLesson = {
  readonly id: string;
  readonly title: string;
  readonly type: ApiLessonType;
  readonly position: number;
  readonly is_required: boolean;
  readonly estimated_minutes: number | null;
  readonly status: LessonProgressStatus;
};

export type ApiChapter = {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly lessons: readonly ApiCourseLesson[];
};

export type ApiProgress = {
  readonly completed_required: number;
  readonly total_required: number;
  readonly ratio: number;
  readonly is_complete: boolean;
};

export type ApiCourse = ApiCourseSummary & {
  readonly chapters: readonly ApiChapter[];
  readonly progress: ApiProgress;
};

export type ApiLesson = {
  readonly id: string;
  readonly course_id: string;
  readonly chapter_id: string;
  readonly type: ApiLessonType;
  readonly title: string;
  readonly estimated_minutes: number | null;
  readonly is_required: boolean;
  /** Rendered and sanitized on the server; safe to insert as HTML. */
  readonly html: string;
  readonly settings: Readonly<Record<string, JsonValue>>;
  readonly status: LessonProgressStatus;
};

export type ApiLessonProgress = {
  readonly status: LessonProgressStatus;
  readonly enrollment: ApiEnrollment;
};

export type ApiErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
    readonly request_id: string;
  };
};
