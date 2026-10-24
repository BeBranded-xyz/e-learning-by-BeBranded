export { AppError, ErrorKind, isAppError, type ErrorDetails } from "./errors.js";
export { err, ok } from "./result.js";
export type { Err, Ok, Result } from "./result.js";

export {
  accessRuleIdSchema,
  assignmentIdSchema,
  attemptGrantIdSchema,
  chapterIdSchema,
  courseIdSchema,
  enrollmentIdSchema,
  fileIdSchema,
  learnerIdSchema,
  lessonIdSchema,
  tenantIdSchema,
  quizAttemptIdSchema,
  quizIdSchema,
  videoAssetIdSchema,
} from "./content/ids.js";
export type {
  AccessRuleId,
  AssignmentId,
  AttemptGrantId,
  ChapterId,
  CourseId,
  EnrollmentId,
  FileId,
  LearnerId,
  LessonId,
  TenantId,
  QuizAttemptId,
  QuizId,
  VideoAssetId,
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
  COLUMN_RULES,
  FILE_URL_PREFIX,
  LESSON_DOCUMENT_LIMITS,
  calloutVariantSchema,
  colorSchema,
  fileUrlSchema,
  inlineContentSchema,
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
export { collectFileIds, fileIdFromUrl, fileUrl } from "./content/file-references.js";
export type { ContentIssue, ContentIssueCode } from "./content/lesson-document.js";

export {
  accessEffectSchema,
  accessRuleSchema,
  accessTargetTypeSchema,
  assignmentAudienceSchema,
  audienceSchema,
} from "./access/access.schemas.js";
export type {
  AccessEffect,
  AccessRule,
  AccessTargetType,
  AssignmentAudience,
  Audience,
} from "./access/access.schemas.js";
export { audienceMatches, canAccess } from "./access/can-access.js";
export { canAssign } from "./access/can-assign.js";
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

export {
  QUESTION_NAME,
  QUIZ_LIMITS,
  quizAnswersSchema,
  quizDefinitionSchema,
  quizLessonSettingsSchema,
  quizQuestionSchema,
  showCorrectionSchema,
} from "./quiz/quiz.schemas.js";
export type {
  QuizAnswers,
  QuizDefinition,
  QuizLessonSettings,
  QuizQuestion,
  QuizQuestionKind,
  ShowCorrection,
} from "./quiz/quiz.schemas.js";
export { QUESTION_BLOCK_TYPES, questionBlockSchema } from "./quiz/quiz-document.schemas.js";
export type { QuestionBlock, QuestionBlockType } from "./quiz/quiz-document.schemas.js";
export { editorDocumentToQuiz, plainText, questionProblem } from "./quiz/quiz-document.js";
export type { QuizDocument } from "./quiz/quiz-document.js";
export { presentQuiz } from "./quiz/present.js";
export type {
  PresentationOptions,
  PresentedOption,
  PresentedQuestion,
  QuizPresentation,
} from "./quiz/present.js";
export { gradeQuiz, isPassing, normalizeAnswer } from "./quiz/grade.js";
export type { QuestionResult, QuizGrade } from "./quiz/grade.js";
export { buildCorrections, toSurveyJson } from "./quiz/survey.js";
export type {
  QuizCorrection,
  RenderBlocks,
  SurveyChoice,
  SurveyElement,
  SurveyJson,
} from "./quiz/survey.js";
export {
  QUIZ_TIMING,
  attemptEligibility,
  attemptExpiresAt,
  attemptsRemaining,
  cooldownEndsAt,
  isPastDeadline,
} from "./quiz/attempts.js";
export type { AttemptHistory, Eligibility } from "./quiz/attempts.js";

export { isOverdue, summarizeEnrollments } from "./reports/course-report.js";
export type { CourseReportSummary } from "./reports/course-report.js";
export { summarizeQuizAttempts } from "./reports/quiz-report.js";
export type { QuizLearnerResult, QuizQuestionStats, QuizReport } from "./reports/quiz-report.js";

export { toExportBlocks } from "./export/to-export-blocks.js";
export {
  EXPORT_LIMITS,
  buildCourseExport,
  buildLessonExport,
  countExportBlocks,
  exportImageIds,
  lessonSection,
  walkExport,
} from "./export/export-document.js";
export type { ExportChapter, ExportLesson } from "./export/export-document.js";
export type {
  ExportAlignment,
  ExportBlock,
  ExportDocument,
  ExportListItem,
  ExportSection,
  ExportTableCell,
  ExportText,
} from "./export/export-document.types.js";

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
  DirectUpload,
  PlaybackSource,
  VideoAssetSnapshot,
  VideoProvider,
  VideoUploadProtocol,
  VideoWebhookEvent,
} from "./ports/video-provider.types.js";
export type {
  VideoAsset,
  VideoCaption,
  VideoHeartbeatKey,
  VideoProgress,
  VideoStorageReads,
  VideoStorageWrites,
} from "./ports/video-storage.types.js";

export type {
  AssignmentStorageReads,
  AssignmentStorageWrites,
  CourseAssignment,
} from "./ports/assignment-storage.types.js";

export type { DocumentExporter, ExportFormat, ExportedFile } from "./ports/exporter.types.js";
export type { ReportStorageReads } from "./ports/report-storage.types.js";

export type {
  FileStorage,
  FileStorageReads,
  FileStorageWrites,
  StoredFile,
} from "./ports/file-storage.types.js";

export type {
  Quiz,
  QuizAttempt,
  QuizAttemptGrant,
  QuizAttemptStatus,
  QuizStanding,
  QuizStorageReads,
  QuizStorageWrites,
} from "./ports/quiz-storage.types.js";

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
  ApiLessonVideo,
  ApiPlayback,
  ApiVideoAssetStatus,
  ApiVideoHeartbeat,
  ApiVideoProgress,
  ApiProgress,
} from "./api/api.types.js";
export type {
  ApiAccessRule,
  ApiAdminChapter,
  ApiAdminCourse,
  ApiAdminFile,
  ApiAdminLesson,
  ApiAdminLessonSummary,
  ApiAdminQuiz,
  ApiAdminVideo,
  ApiAssignment,
  ApiAttemptGrant,
  ApiAttemptGrantResult,
  ApiAudience,
  ApiCourseReport,
  ApiCourseTree,
  ApiEnrollmentReportRow,
  ApiFileUpload,
  ApiLearnerReport,
  ApiQuizReport,
  ApiReportSummary,
  ApiStoredFile,
  ApiVideoUpload,
} from "./api/admin-api.types.js";
export type {
  ApiLessonQuiz,
  ApiOpenQuizAttempt,
  ApiQuizAttempt,
  ApiQuizCorrection,
  ApiQuizResult,
} from "./api/quiz-api.types.js";

export type { ApiLessonPreview } from "./api/admin-api.types.js";
