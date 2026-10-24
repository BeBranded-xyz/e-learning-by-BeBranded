import type { AccessEffect, AccessTargetType } from "../access/access.schemas.js";
import type {
  ChapterStatus,
  CompletionRule,
  CourseStatus,
  EnrollmentMode,
  LessonStatus,
} from "../content/content.schemas.js";
import type { ExportFormat } from "../ports/exporter.types.js";
import type { EnrollmentSource, JsonValue } from "../ports/storage.types.js";
import type { ApiLessonType, ApiVideoAssetStatus } from "./api.types.js";

// Admin API contract (spec 04, section 8): implemented by the server presenters,
// consumed by @bebranded/elearning-admin. snake_case fields, ISO 8601 dates.

export type ApiAdminCourse = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly cover_image_url: string | null;
  readonly status: CourseStatus;
  readonly published_at: string | null;
  readonly enrollment_mode: EnrollmentMode;
  /** Learners may export to PDF and Word (spec 10); admins always can. */
  readonly allow_learner_export: boolean;
  readonly completion_rule: CompletionRule;
  readonly locale: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  /** False for shared-catalog content, which only its owner edits. */
  readonly editable: boolean;
};

export type ApiAdminChapter = {
  readonly id: string;
  readonly course_id: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
};

export type ApiAdminLessonSummary = {
  readonly id: string;
  readonly course_id: string;
  readonly chapter_id: string;
  readonly type: ApiLessonType;
  readonly title: string;
  readonly position: number;
  readonly status: LessonStatus;
  readonly is_required: boolean;
  readonly estimated_minutes: number | null;
};

export type ApiAdminVideo = {
  readonly id: string;
  readonly provider: string;
  readonly status: ApiVideoAssetStatus;
  readonly duration_seconds: number | null;
  readonly thumbnail_url: string | null;
  readonly captions: readonly { readonly lang: string; readonly url: string }[];
};

export type ApiAdminLesson = ApiAdminLessonSummary & {
  readonly content: JsonValue | null;
  readonly content_schema_version: number;
  readonly settings: Readonly<Record<string, JsonValue>>;
  readonly video: ApiAdminVideo | null;
};

export type ApiAudience =
  | { readonly type: "everyone" }
  | { readonly type: "role"; readonly role: string }
  | { readonly type: "grade_min"; readonly grade: number }
  | { readonly type: "learner"; readonly learner_id: string };

export type ApiAccessRule = {
  readonly id: string;
  readonly target_type: AccessTargetType;
  readonly target_id: string;
  readonly effect: AccessEffect;
  readonly audience: ApiAudience;
};

export type ApiAssignment = {
  readonly id: string;
  readonly course_id: string;
  readonly audience: Exclude<ApiAudience, { type: "everyone" }>;
  readonly due_at: string | null;
  readonly assigned_by: string;
  readonly created_at: string;
};

export type ApiCourseTree = ApiAdminCourse & {
  readonly chapters: readonly (ApiAdminChapter & {
    readonly lessons: readonly ApiAdminLessonSummary[];
  })[];
  readonly access_rules: readonly ApiAccessRule[];
  /** The formats the course can be exported to; empty without an exporter (spec 10). */
  readonly export_formats: readonly ExportFormat[];
};

export type ApiAdminQuiz = {
  readonly lesson_id: string;
  readonly document: JsonValue | null;
  readonly question_count: number;
  readonly version: string | null;
  /** Learners who already took the quiz: the edit warning of spec 07. */
  readonly learners_attempted: number;
};

export type ApiStoredFile = {
  readonly id: string;
  /** What a document stores: `elearning-file:<id>`. */
  readonly url: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly created_at: string;
};

export type ApiFileUpload = {
  readonly file: ApiStoredFile;
  readonly upload: {
    readonly url: string;
    readonly method: "PUT";
    readonly headers: Readonly<Record<string, string>>;
  };
};

export type ApiAdminFile = ApiStoredFile & {
  readonly read_url: string;
  readonly read_url_expires_at: string;
};

export type ApiVideoUpload = {
  readonly upload_url: string;
  readonly upload_protocol: "form" | "tus";
  readonly video: ApiAdminVideo;
};

export type ApiAttemptGrant = {
  readonly id: string;
  readonly lesson_id: string;
  readonly learner_id: string;
  readonly extra_attempts: number;
  readonly granted_by: string;
  readonly created_at: string;
};

/** The answer to a grant: the grant and the learner's standing after it. */
export type ApiAttemptGrantResult = ApiAttemptGrant & {
  readonly attempts_used: number;
  /** Null when the quiz has unlimited attempts. */
  readonly attempts_remaining: number | null;
};

export type ApiEnrollmentReportRow = {
  readonly learner_id: string;
  readonly course_id: string;
  readonly source: EnrollmentSource;
  readonly assigned_by: string | null;
  readonly due_at: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly progress: number;
  readonly overdue: boolean;
};

export type ApiReportSummary = {
  readonly enrolled: number;
  readonly started: number;
  readonly completed: number;
  readonly overdue: number;
  readonly average_progress: number | null;
};

export type ApiCourseReport = {
  readonly course: Pick<ApiAdminCourse, "id" | "slug" | "title" | "status">;
  readonly summary: ApiReportSummary;
  readonly data: readonly ApiEnrollmentReportRow[];
  readonly next_cursor: string | null;
};

export type ApiLearnerReport = {
  readonly learner_id: string;
  readonly summary: ApiReportSummary;
  readonly data: readonly (ApiEnrollmentReportRow & { readonly course_title: string | null })[];
  readonly next_cursor: string | null;
};

export type ApiQuizReport = {
  readonly lesson_id: string;
  readonly title: string;
  readonly learners: number;
  readonly attempts: number;
  readonly pass_rate: number | null;
  readonly average_score: number | null;
  readonly average_attempts: number | null;
  readonly questions: readonly {
    readonly question_id: string;
    readonly prompt: string;
    readonly answered: number;
    readonly correct_rate: number | null;
  }[];
  readonly learners_results: readonly {
    readonly learner_id: string;
    readonly attempts: number;
    readonly best_score: number;
    readonly passed: boolean;
    readonly last_attempt_at: string;
  }[];
};
