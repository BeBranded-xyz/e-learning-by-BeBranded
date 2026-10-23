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
  /** The lesson's settings, with the defaults of its type filled in. */
  readonly settings: Readonly<Record<string, JsonValue>>;
  readonly status: LessonProgressStatus;
  /** Video lessons only; null for other types. */
  readonly video: ApiLessonVideo | null;
};

export type ApiVideoAssetStatus = "uploading" | "processing" | "ready" | "error";

export type ApiPlayback = {
  readonly type: "hls";
  /** Signed for this learner; stops working at `expires_at`. */
  readonly url: string;
  readonly expires_at: string;
};

export type ApiVideoProgress = {
  readonly watched_seconds: number;
  /** Between 0 and 1. */
  readonly coverage: number;
  /** Where to resume playback, in seconds. */
  readonly last_position: number;
  /** Sorted, merged intervals already watched, in seconds. */
  readonly watched_ranges: readonly (readonly [number, number])[];
};

export type ApiLessonVideo = {
  readonly status: ApiVideoAssetStatus;
  readonly duration_seconds: number | null;
  readonly thumbnail_url: string | null;
  readonly captions: readonly { readonly lang: string; readonly url: string }[];
  /** Null until the video is ready. */
  readonly playback: ApiPlayback | null;
  readonly progress: ApiVideoProgress;
};

/** Answer to `POST /lessons/:id/video-progress`. */
export type ApiVideoHeartbeat = {
  /** False when the heartbeat was a replay of one already received. */
  readonly accepted: boolean;
  readonly status: LessonProgressStatus;
  readonly progress: ApiVideoProgress;
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
