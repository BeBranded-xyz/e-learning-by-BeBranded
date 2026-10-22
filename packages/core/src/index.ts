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

export { eventTypes, parseEventPayload } from "./events/events.js";
export type { DomainEvent, EventHandlers, EventPayload, EventType } from "./events/events.js";
