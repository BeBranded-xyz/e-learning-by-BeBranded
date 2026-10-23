export { AppError, ErrorKind, isAppError } from "./errors.js";
export type { ErrorDetails } from "./errors.js";
export { err, ok } from "./result.js";
export type { Err, Ok, Result } from "./result.js";

export {
  accessRuleIdSchema,
  chapterIdSchema,
  courseIdSchema,
  enrollmentIdSchema,
  learnerIdSchema,
  lessonIdSchema,
  tenantIdSchema,
} from "./content/ids.js";
export type {
  AccessRuleId,
  ChapterId,
  CourseId,
  EnrollmentId,
  LearnerId,
  LessonId,
  TenantId,
} from "./content/ids.js";

export {
  chapterSchema,
  chapterStatusSchema,
  completionRuleSchema,
  courseSchema,
  courseStatusSchema,
  enrollmentModeSchema,
  lessonSchema,
  lessonStatusSchema,
  lessonTypeSchema,
  localeSchema,
  slugSchema,
  textLessonSettingsSchema,
} from "./content/content.schemas.js";
export type {
  Chapter,
  ChapterStatus,
  CompletionRule,
  Course,
  CourseStatus,
  EnrollmentMode,
  Lesson,
  LessonStatus,
  LessonType,
  TextLessonSettings,
} from "./content/content.schemas.js";

export {
  ALLOWED_URL_PROTOCOLS,
  LESSON_DOCUMENT_LIMITS,
  calloutVariantSchema,
  colorSchema,
  lessonBlockSchema,
  lessonDocumentSchema,
  safeUrlSchema,
} from "./content/lesson-document.schemas.js";
export type {
  CalloutVariant,
  Color,
  InlineContent,
  LessonBlock,
  LessonDocument,
  LinkContent,
  StyledText,
  TableContent,
  TextStyles,
} from "./content/lesson-document.types.js";
export { validateLessonDocument } from "./content/lesson-document.js";
export type { ContentIssue, ContentIssueCode } from "./content/lesson-document.js";

export {
  accessEffectSchema,
  accessRuleSchema,
  accessTargetTypeSchema,
  audienceSchema,
} from "./access/access.schemas.js";
export type {
  AccessEffect,
  AccessRule,
  AccessTargetType,
  Audience,
} from "./access/access.schemas.js";
export { audienceMatches, canAccess } from "./access/can-access.js";
export type {
  AccessDecision,
  AccessDenialReason,
  ContentNode,
  ContentPath,
} from "./access/can-access.js";

export { learnerSchema } from "./identity/learner.js";
export type { IdentityResolver, Learner, LearnerInput } from "./identity/learner.js";

export { advanceLessonStatus, computeProgress } from "./progress/progress.js";
export type { CourseProgress, LessonProgressStatus, ProgressLesson } from "./progress/progress.js";

export { videoAssetStatusSchema, videoLessonSettingsSchema } from "./video/video.schemas.js";
export type { VideoAssetStatus, VideoLessonSettings, WatchedRange } from "./video/video.schemas.js";
export { clampRanges, computeCoverage, mergeRanges, rangesLength } from "./video/ranges.js";
export { VIDEO_TRACKING, applyHeartbeat } from "./video/heartbeat.js";
export type {
  Heartbeat,
  HeartbeatOutcome,
  HeartbeatVideo,
  VideoProgressState,
} from "./video/heartbeat.js";

export { eventTypes, parseEventPayload } from "./events/events.js";
export type { DomainEvent, EventHandlers, EventPayload, EventType } from "./events/events.js";

export type {
  ChapterPatch,
  CoursePatch,
  Enrollment,
  EnrollmentSource,
  EventOutbox,
  JsonValue,
  LessonDetail,
  LessonPatch,
  LessonProgress,
  LessonSummary,
  PendingEvent,
  StorageAdapter,
  StorageReads,
  StorageTransaction,
  StorageWrites,
  TenantScope,
} from "./ports/storage.types.js";

export type {
  PlaybackSource,
  VideoAssetSnapshot,
  VideoProvider,
  VideoWebhookEvent,
} from "./ports/video-provider.types.js";

export type {
  ApiChapter,
  ApiCollection,
  ApiCourse,
  ApiCourseLesson,
  ApiCourseSummary,
  ApiEnrollment,
  ApiErrorBody,
  ApiLesson,
  ApiLessonProgress,
  ApiLessonType,
  ApiProgress,
} from "./api/api.types.js";
