import { Kysely, PostgresDialect } from "kysely";
import type { PostgresPool } from "kysely";
import pg from "pg";
import { z } from "zod";

import type {
  StorageAdapter,
  StorageReads,
  StorageTransaction,
  StorageWrites,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { assertSchemaUpToDate } from "../migrations/migrate.js";
import { DEFAULT_SCHEMA, assertSchemaName } from "../schema-name.js";
import * as rules from "./access-rules.queries.js";
import * as assignments from "./assignments.queries.js";
import { withConflicts } from "./database-errors.js";
import * as content from "./content.queries.js";
import * as files from "./files.queries.js";
import * as lessons from "./lessons.queries.js";
import * as outbox from "./outbox.queries.js";
import * as progress from "./progress.queries.js";
import * as grants from "./quiz-grants.queries.js";
import * as quiz from "./quiz.queries.js";
import * as reports from "./reports.queries.js";
import * as video from "./video.queries.js";

const optionsSchema = z.union([
  z.strictObject({
    connectionString: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "Expected a postgres:// connection string"),
    schema: z.string().optional(),
    maxConnections: z.int().min(1).max(100).optional(),
  }),
  z.strictObject({
    /** A pg Pool owned by the host (mode A: share the host's connection pool). */
    pool: z.custom<PostgresPool>(
      (value) => typeof value === "object" && value !== null && "connect" in value,
      "Expected a pg Pool",
    ),
    schema: z.string().optional(),
  }),
]);

export type PostgresStorageOptions = z.input<typeof optionsSchema>;

function reads(db: Kysely<DB>): StorageReads {
  return {
    listCourses: (scope) => content.listCourses(db, scope),
    findCourseById: (scope, id) => content.findCourse(db, scope, { id }),
    findCourseBySlug: (scope, slug) => content.findCourse(db, scope, { slug }),
    listChapters: (scope, courseIds) => content.listChapters(db, scope, courseIds),
    findChapter: (scope, id) => content.findChapter(db, scope, id),
    listLessons: (scope, courseIds) => lessons.listLessons(db, scope, courseIds),
    findLesson: (scope, id) => lessons.findLesson(db, scope, id),
    listAccessRules: (scope, targetIds) => rules.listAccessRules(db, scope, targetIds),
    findAccessRule: (scope, id) => rules.findAccessRule(db, scope, id),
    listLessonProgress: (scope, learnerId, lessonIds) =>
      progress.listLessonProgress(db, scope, learnerId, lessonIds),
    findEnrollment: (scope, courseId, learnerId) =>
      progress.findEnrollment(db, scope, { courseId, learnerId }, { forUpdate: false }),
    listEnrollments: (scope, learnerId) => progress.listEnrollments(db, scope, learnerId),
    findVideoAsset: (scope, lessonId) => video.findVideoAsset(db, scope, lessonId),
    findVideoProgress: (scope, learnerId, lessonId) =>
      video.findVideoProgress(db, scope, { learnerId, lessonId }),
    findQuiz: (scope, lessonId) => quiz.findQuiz(db, scope, lessonId),
    findQuizStanding: (scope, learnerId, lessonId) =>
      quiz.findQuizStanding(db, scope, { learnerId, lessonId }),
    countQuizLearners: (scope, lessonId) => quiz.countQuizLearners(db, scope, lessonId),
    listQuizAttemptGrants: (scope, lessonId, learnerId) =>
      grants.listQuizAttemptGrants(db, scope, lessonId, learnerId),
    listCourseAssignments: (scope, courseId) =>
      assignments.listCourseAssignments(db, scope, courseId),
    listPendingAssignments: (scope, learner) =>
      assignments.listPendingAssignments(db, scope, learner),
    findFiles: (scope, ids) => files.findFiles(db, scope, ids),
    listCourseEnrollments: (scope, courseId) => reports.listCourseEnrollments(db, scope, courseId),
    listClosedQuizAttempts: (scope, lessonId) =>
      reports.listClosedQuizAttempts(db, scope, lessonId),
  };
}

function writes(db: Kysely<DB>): StorageWrites {
  return {
    lockEnrollment: (scope, courseId, learnerId) =>
      progress.findEnrollment(db, scope, { courseId, learnerId }, { forUpdate: true }),
    lockOrCreateEnrollment: (scope, enrollment) =>
      progress.lockOrCreateEnrollment(db, scope, enrollment),
    saveEnrollment: (scope, enrollment) => progress.saveEnrollment(db, scope, enrollment),
    saveLessonProgress: (scope, value) => progress.saveLessonProgress(db, scope, value),
    appendEvent: (event) => outbox.appendEvent(db, event),
    insertCourse: (course) => withConflicts(() => content.insertCourse(db, course)),
    lockCourse: (scope, id) => content.lockCourse(db, scope, id),
    updateCourse: (scope, id, patch) =>
      withConflicts(() => content.updateCourse(db, scope, id, patch)),
    deleteCourse: (scope, id) => content.deleteCourse(db, scope, id),
    insertChapter: (scope, chapter) => content.insertChapter(db, scope, chapter),
    updateChapter: (scope, id, patch) => content.updateChapter(db, scope, id, patch),
    deleteChapter: (scope, id) => content.deleteChapter(db, scope, id),
    insertLesson: (scope, lesson) => lessons.insertLesson(db, scope, lesson),
    updateLesson: (scope, id, patch) => lessons.updateLesson(db, scope, id, patch),
    deleteLesson: (scope, id) => lessons.deleteLesson(db, scope, id),
    insertAccessRule: (rule) => rules.insertAccessRule(db, rule),
    deleteAccessRule: (scope, id) => rules.deleteAccessRule(db, scope, id),
    saveVideoAsset: (scope, asset) => withConflicts(() => video.saveVideoAsset(db, scope, asset)),
    applyVideoWebhook: (provider, event) => video.applyVideoWebhook(db, provider, event),
    acceptVideoHeartbeat: (scope, key) => video.acceptVideoHeartbeat(db, scope, key),
    lockOrCreateVideoProgress: (scope, learnerId, lessonId) =>
      video.lockOrCreateVideoProgress(db, scope, { learnerId, lessonId }),
    saveVideoProgress: (scope, value) => video.saveVideoProgress(db, scope, value),
    saveQuiz: (scope, value) => quiz.saveQuiz(db, scope, value),
    insertQuizAttempt: (scope, attempt) =>
      withConflicts(() => quiz.insertQuizAttempt(db, scope, attempt)),
    lockQuizAttempt: (scope, learnerId, attemptId) =>
      quiz.lockQuizAttempt(db, scope, learnerId, attemptId),
    closeQuizAttempt: (scope, attempt) => quiz.closeQuizAttempt(db, scope, attempt),
    insertQuizAttemptGrant: (scope, grant) => grants.insertQuizAttemptGrant(db, scope, grant),
    saveCourseAssignment: (scope, assignment) =>
      assignments.saveCourseAssignment(db, scope, assignment),
    deleteCourseAssignment: (scope, id) => assignments.deleteCourseAssignment(db, scope, id),
    insertFile: (scope, file) => files.insertFile(db, scope, file),
  };
}

/**
 * PostgreSQL implementation of the storage port (spec 04, "Data modes"). Works
 * on the host's database (mode A) or a dedicated one (mode B).
 */
export function postgresStorage(input: PostgresStorageOptions): StorageAdapter {
  const options = optionsSchema.parse(input);
  const schema = assertSchemaName(options.schema ?? DEFAULT_SCHEMA);
  const ownsPool = "connectionString" in options;
  const pool = ownsPool
    ? new pg.Pool({ connectionString: options.connectionString, max: options.maxConnections ?? 10 })
    : options.pool;
  const root = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  const db = root.withSchema(schema);

  return {
    ...reads(db),
    transaction: (work) =>
      db.transaction().execute((trx) => {
        const tx: StorageTransaction = { ...reads(trx), ...writes(trx) };
        return work(tx);
      }),
    outbox: {
      claimPendingEvents: (limit, now, leaseUntil) =>
        outbox.claimPendingEvents(db, limit, now, leaseUntil),
      markEventDelivered: (id, at) => outbox.markEventDelivered(db, id, at),
      markEventFailed: (id, error, nextAttemptAt) =>
        outbox.markEventFailed(db, id, error, nextAttemptAt),
    },
    assertSchemaUpToDate: () => assertSchemaUpToDate(root, { schema }),
    // A pool passed by the host stays open: the host owns its lifecycle.
    close: () => (ownsPool ? root.destroy() : Promise.resolve()),
  };
}
