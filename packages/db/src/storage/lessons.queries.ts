import type { Kysely } from "kysely";

import type {
  CourseId,
  LessonDetail,
  LessonId,
  LessonPatch,
  LessonSummary,
  TenantScope,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { toLessonDetail, toLessonSummary } from "./mappers.js";
import { hasChanges, insertedAny, jsonColumn } from "./patch.js";
import { ownedBy, readableContent } from "./tenant-filters.js";

const SUMMARY_COLUMNS = [
  "id",
  "tenant_id",
  "chapter_id",
  "course_id",
  "type",
  "title",
  "position",
  "status",
  "is_required",
  "estimated_minutes",
  "created_at",
  "updated_at",
] as const;

/** Lessons of the courses, without their content (one query per course tree). */
export async function listLessons(
  db: Kysely<DB>,
  scope: TenantScope,
  courseIds: readonly CourseId[],
): Promise<LessonSummary[]> {
  if (courseIds.length === 0) return [];
  const rows = await db
    .selectFrom("lessons")
    .innerJoin("chapters", "chapters.id", "lessons.chapter_id")
    .select(SUMMARY_COLUMNS.map((column) => `lessons.${column}` as const))
    .where("lessons.course_id", "in", courseIds)
    .where(readableContent("lessons.tenant_id", scope))
    .orderBy("chapters.position")
    .orderBy("lessons.position")
    .orderBy("lessons.id")
    .execute();
  return rows.map(toLessonSummary);
}

export async function findLesson(
  db: Kysely<DB>,
  scope: TenantScope,
  id: LessonId,
): Promise<LessonDetail | null> {
  const row = await db
    .selectFrom("lessons")
    .selectAll()
    .where("id", "=", id)
    .where(readableContent("lessons.tenant_id", scope))
    .executeTakeFirst();
  return row === undefined ? null : toLessonDetail(row);
}

/** Inserts the lesson only into a chapter the tenant owns; false otherwise. */
export async function insertLesson(
  db: Kysely<DB>,
  scope: TenantScope,
  lesson: LessonDetail,
): Promise<boolean> {
  const result = await db
    .insertInto("lessons")
    .columns([
      "id",
      "tenant_id",
      "chapter_id",
      "course_id",
      "type",
      "title",
      "position",
      "status",
      "is_required",
      "estimated_minutes",
      "content",
      "content_schema_version",
      "settings",
    ])
    .expression(
      db
        .selectFrom("chapters")
        .select((eb) => [
          eb.val(lesson.id).as("id"),
          "chapters.tenant_id",
          "chapters.id as chapter_id",
          "chapters.course_id",
          eb.val(lesson.type).as("type"),
          eb.val(lesson.title).as("title"),
          eb.val(lesson.position).as("position"),
          eb.val(lesson.status).as("status"),
          eb.val(lesson.isRequired).as("is_required"),
          eb.val(lesson.estimatedMinutes).as("estimated_minutes"),
          eb.val(jsonColumn(lesson.content)).as("content"),
          eb.val(lesson.contentSchemaVersion).as("content_schema_version"),
          eb.val(JSON.stringify(lesson.settings)).as("settings"),
        ])
        .where("chapters.id", "=", lesson.chapterId)
        .where(ownedBy("chapters.tenant_id", scope)),
    )
    .executeTakeFirst();
  return insertedAny(result);
}

export async function updateLesson(
  db: Kysely<DB>,
  scope: TenantScope,
  id: LessonId,
  patch: LessonPatch,
): Promise<boolean> {
  if (!hasChanges(patch)) return false;
  const { chapterId, content, settings } = patch;
  let query = db
    .updateTable("lessons")
    .set({
      chapter_id: chapterId,
      title: patch.title,
      position: patch.position,
      status: patch.status,
      is_required: patch.isRequired,
      estimated_minutes: patch.estimatedMinutes,
      content: content === undefined ? undefined : jsonColumn(content),
      content_schema_version: patch.contentSchemaVersion,
      settings: settings === undefined ? undefined : JSON.stringify(settings),
    })
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope));
  if (chapterId !== undefined) {
    // lessons.course_id is a copy of the chapter's course: a move never leaves the course.
    query = query.where((eb) =>
      eb.exists(
        eb
          .selectFrom("chapters")
          .select("chapters.id")
          .where("chapters.id", "=", chapterId)
          .whereRef("chapters.course_id", "=", "lessons.course_id")
          .where(ownedBy("chapters.tenant_id", scope)),
      ),
    );
  }
  const result = await query.executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

export async function deleteLesson(
  db: Kysely<DB>,
  scope: TenantScope,
  id: LessonId,
): Promise<boolean> {
  const result = await db
    .deleteFrom("lessons")
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .executeTakeFirst();
  if (result.numDeletedRows === 0n) return false;
  await db.deleteFrom("access_rules").where("target_id", "=", id).execute();
  return true;
}
