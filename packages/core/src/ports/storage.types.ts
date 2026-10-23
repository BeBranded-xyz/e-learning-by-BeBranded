import type { AccessRule } from "../access/access.schemas.js";
import type { Chapter, Course, Lesson } from "../content/content.schemas.js";
import type {
  AccessRuleId,
  ChapterId,
  CourseId,
  EnrollmentId,
  LearnerId,
  LessonId,
  TenantId,
} from "../content/ids.js";
import type { DomainEvent } from "../events/events.js";
import type { LessonProgressStatus } from "../progress/progress.js";
import type { VideoStorageReads, VideoStorageWrites } from "./video-storage.types.js";

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * Tenant isolation is enforced by the storage layer (spec 05): every read and
 * write takes a scope. With `includeShared`, content whose `tenantId` is null
 * is visible to every tenant (the `sharedCatalog` option).
 */
export type TenantScope = {
  readonly tenantId: TenantId | null;
  readonly includeShared: boolean;
};

export type LessonSummary = Lesson & { readonly courseId: CourseId };

export type LessonDetail = LessonSummary & {
  readonly content: JsonValue | null;
  readonly contentSchemaVersion: number;
  readonly settings: Readonly<Record<string, JsonValue>>;
};

export type LessonProgress = {
  readonly lessonId: LessonId;
  readonly learnerId: LearnerId;
  readonly courseId: CourseId;
  readonly status: LessonProgressStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
};

export type EnrollmentSource = "self" | "assigned" | "auto";

export type Enrollment = {
  readonly id: EnrollmentId;
  readonly courseId: CourseId;
  readonly learnerId: LearnerId;
  readonly source: EnrollmentSource;
  readonly assignedBy: LearnerId | null;
  readonly dueAt: Date | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  /** Between 0 and 1, recomputed with every lesson progress change. */
  readonly progress: number;
};

export type PendingEvent = DomainEvent & { readonly attempts: number };

/** Patches may carry `undefined` for "unchanged" (fields of a partial request body). */
type Patch<T> = { readonly [K in keyof T]?: T[K] | undefined };

export type CoursePatch = Patch<Omit<Course, "id" | "tenantId">>;
export type ChapterPatch = Patch<Pick<Chapter, "title" | "position" | "status">>;
export type LessonPatch = Patch<
  Pick<
    LessonDetail,
    | "title"
    | "position"
    | "status"
    | "isRequired"
    | "estimatedMinutes"
    | "content"
    | "contentSchemaVersion"
    | "settings"
  >
>;

export type StorageReads = {
  listCourses(scope: TenantScope): Promise<Course[]>;
  findCourseById(scope: TenantScope, id: CourseId): Promise<Course | null>;
  findCourseBySlug(scope: TenantScope, slug: string): Promise<Course | null>;
  listChapters(scope: TenantScope, courseIds: readonly CourseId[]): Promise<Chapter[]>;
  findChapter(scope: TenantScope, id: ChapterId): Promise<Chapter | null>;
  /** Lessons without their content, ordered by chapter then position. */
  listLessons(scope: TenantScope, courseIds: readonly CourseId[]): Promise<LessonSummary[]>;
  findLesson(scope: TenantScope, id: LessonId): Promise<LessonDetail | null>;
  listAccessRules(scope: TenantScope, targetIds: readonly string[]): Promise<AccessRule[]>;
  findAccessRule(scope: TenantScope, id: AccessRuleId): Promise<AccessRule | null>;
  listLessonProgress(
    scope: TenantScope,
    learnerId: LearnerId,
    lessonIds: readonly LessonId[],
  ): Promise<LessonProgress[]>;
  findEnrollment(
    scope: TenantScope,
    courseId: CourseId,
    learnerId: LearnerId,
  ): Promise<Enrollment | null>;
  listEnrollments(scope: TenantScope, learnerId: LearnerId): Promise<Enrollment[]>;
} & VideoStorageReads;

export type StorageWrites = {
  /** Locks the learner's enrollment row until the transaction ends. */
  lockEnrollment(
    scope: TenantScope,
    courseId: CourseId,
    learnerId: LearnerId,
  ): Promise<Enrollment | null>;
  /**
   * Inserts `enrollment` unless the learner already has one for the course,
   * then returns the stored row, locked until the transaction ends. Safe
   * under concurrency: two first requests end up with the same row.
   */
  lockOrCreateEnrollment(scope: TenantScope, enrollment: Enrollment): Promise<Enrollment>;
  saveEnrollment(scope: TenantScope, enrollment: Enrollment): Promise<void>;
  saveLessonProgress(scope: TenantScope, progress: LessonProgress): Promise<void>;
  /** Written in the same transaction as the change it describes (outbox). */
  appendEvent(event: DomainEvent): Promise<void>;
  insertCourse(course: Course): Promise<void>;
  updateCourse(scope: TenantScope, id: CourseId, patch: CoursePatch): Promise<boolean>;
  deleteCourse(scope: TenantScope, id: CourseId): Promise<boolean>;
  /** False when the parent course does not exist or belongs to another tenant. */
  insertChapter(scope: TenantScope, chapter: Chapter): Promise<boolean>;
  updateChapter(scope: TenantScope, id: ChapterId, patch: ChapterPatch): Promise<boolean>;
  deleteChapter(scope: TenantScope, id: ChapterId): Promise<boolean>;
  /** False when the parent chapter does not exist or belongs to another tenant. */
  insertLesson(scope: TenantScope, lesson: LessonDetail): Promise<boolean>;
  updateLesson(scope: TenantScope, id: LessonId, patch: LessonPatch): Promise<boolean>;
  deleteLesson(scope: TenantScope, id: LessonId): Promise<boolean>;
  insertAccessRule(rule: AccessRule): Promise<void>;
  deleteAccessRule(scope: TenantScope, id: AccessRuleId): Promise<boolean>;
} & VideoStorageWrites;

export type StorageTransaction = StorageReads & StorageWrites;

export type EventOutbox = {
  /**
   * Oldest undelivered events due at `now`. Claimed events are leased until
   * `leaseUntil`, so concurrent workers never deliver the same event twice at
   * the same time; an unacknowledged event becomes due again after the lease.
   */
  claimPendingEvents(limit: number, now: Date, leaseUntil: Date): Promise<PendingEvent[]>;
  markEventDelivered(id: string, at: Date): Promise<void>;
  markEventFailed(id: string, error: string, nextAttemptAt: Date): Promise<void>;
};

export type StorageAdapter = StorageReads & {
  transaction<T>(work: (tx: StorageTransaction) => Promise<T>): Promise<T>;
  outbox: EventOutbox;
  /** Fails with `schema_out_of_date` when migrations are missing. */
  assertSchemaUpToDate(): Promise<void>;
  close(): Promise<void>;
};
