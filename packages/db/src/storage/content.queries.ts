import type { Kysely } from "kysely";

import type {
  Chapter,
  ChapterId,
  ChapterPatch,
  Course,
  CourseId,
  CoursePatch,
  TenantScope,
} from "@bebranded/elearning-core";

import type { DB } from "../database.gen.js";
import { toChapter, toCourse } from "./mappers.js";
import { hasChanges, insertedAny } from "./patch.js";
import { ownedBy, readableContent } from "./tenant-filters.js";

// Courses and chapters. Lessons live in lessons.queries.ts.

export async function listCourses(db: Kysely<DB>, scope: TenantScope): Promise<Course[]> {
  const rows = await db
    .selectFrom("courses")
    .selectAll()
    .where(readableContent("courses.tenant_id", scope))
    .orderBy("title")
    .orderBy("id")
    .execute();
  return rows.map(toCourse);
}

export async function findCourse(
  db: Kysely<DB>,
  scope: TenantScope,
  by: { id: CourseId } | { slug: string },
): Promise<Course | null> {
  let query = db
    .selectFrom("courses")
    .selectAll()
    .where(readableContent("courses.tenant_id", scope));
  query = "id" in by ? query.where("id", "=", by.id) : query.where("slug", "=", by.slug);
  // A slug can exist both in the tenant and in the shared catalog: the tenant wins.
  const row = await query
    .orderBy("tenant_id", (ob) => ob.asc().nullsLast())
    .limit(1)
    .executeTakeFirst();
  return row === undefined ? null : toCourse(row);
}

export async function insertCourse(db: Kysely<DB>, course: Course): Promise<void> {
  await db
    .insertInto("courses")
    .values({
      id: course.id,
      tenant_id: course.tenantId,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      cover_image_url: course.coverImageUrl,
      status: course.status,
      published_at: course.publishedAt,
      completion_rule: JSON.stringify(course.completionRule),
      enrollment_mode: course.enrollmentMode,
      locale: course.locale,
      metadata: JSON.stringify(course.metadata),
    })
    .execute();
}

export async function updateCourse(
  db: Kysely<DB>,
  scope: TenantScope,
  id: CourseId,
  patch: CoursePatch,
): Promise<boolean> {
  if (!hasChanges(patch)) return false;
  const result = await db
    .updateTable("courses")
    .set({
      slug: patch.slug,
      title: patch.title,
      summary: patch.summary,
      cover_image_url: patch.coverImageUrl,
      status: patch.status,
      published_at: patch.publishedAt,
      completion_rule: patch.completionRule && JSON.stringify(patch.completionRule),
      enrollment_mode: patch.enrollmentMode,
      locale: patch.locale,
      metadata: patch.metadata && JSON.stringify(patch.metadata),
    })
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

/** Deletes the course, its chapters and lessons (FK cascade) and their access rules. */
export async function deleteCourse(
  db: Kysely<DB>,
  scope: TenantScope,
  id: CourseId,
): Promise<boolean> {
  const owned = await db
    .selectFrom("courses")
    .select("id")
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .forUpdate()
    .executeTakeFirst();
  if (owned === undefined) return false;
  // access_rules.target_id has no FK (the target table varies): clean up first.
  const chapterIds = db.selectFrom("chapters").select("id").where("course_id", "=", id);
  const lessonIds = db.selectFrom("lessons").select("id").where("course_id", "=", id);
  await db
    .deleteFrom("access_rules")
    .where((eb) =>
      eb.or([
        eb("target_id", "=", id),
        eb("target_id", "in", chapterIds),
        eb("target_id", "in", lessonIds),
      ]),
    )
    .execute();
  await db.deleteFrom("courses").where("id", "=", id).execute();
  return true;
}

export async function listChapters(
  db: Kysely<DB>,
  scope: TenantScope,
  courseIds: readonly CourseId[],
): Promise<Chapter[]> {
  if (courseIds.length === 0) return [];
  const rows = await db
    .selectFrom("chapters")
    .selectAll()
    .where("course_id", "in", courseIds)
    .where(readableContent("chapters.tenant_id", scope))
    .orderBy("course_id")
    .orderBy("position")
    .orderBy("id")
    .execute();
  return rows.map(toChapter);
}

export async function findChapter(
  db: Kysely<DB>,
  scope: TenantScope,
  id: ChapterId,
): Promise<Chapter | null> {
  const row = await db
    .selectFrom("chapters")
    .selectAll()
    .where("id", "=", id)
    .where(readableContent("chapters.tenant_id", scope))
    .executeTakeFirst();
  return row === undefined ? null : toChapter(row);
}

/** Inserts the chapter only into a course the tenant owns; false otherwise. */
export async function insertChapter(
  db: Kysely<DB>,
  scope: TenantScope,
  chapter: Chapter,
): Promise<boolean> {
  const result = await db
    .insertInto("chapters")
    .columns(["id", "tenant_id", "course_id", "title", "position", "status"])
    .expression(
      db
        .selectFrom("courses")
        .select((eb) => [
          eb.val(chapter.id).as("id"),
          "courses.tenant_id",
          "courses.id as course_id",
          eb.val(chapter.title).as("title"),
          eb.val(chapter.position).as("position"),
          eb.val(chapter.status).as("status"),
        ])
        .where("courses.id", "=", chapter.courseId)
        .where(ownedBy("courses.tenant_id", scope)),
    )
    .executeTakeFirst();
  return insertedAny(result);
}

export async function updateChapter(
  db: Kysely<DB>,
  scope: TenantScope,
  id: ChapterId,
  patch: ChapterPatch,
): Promise<boolean> {
  if (!hasChanges(patch)) return false;
  const result = await db
    .updateTable("chapters")
    .set({ title: patch.title, position: patch.position, status: patch.status })
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

export async function deleteChapter(
  db: Kysely<DB>,
  scope: TenantScope,
  id: ChapterId,
): Promise<boolean> {
  const lessonIds = db.selectFrom("lessons").select("id").where("chapter_id", "=", id);
  const owned = await db
    .selectFrom("chapters")
    .select("id")
    .where("id", "=", id)
    .where(ownedBy("tenant_id", scope))
    .forUpdate()
    .executeTakeFirst();
  if (owned === undefined) return false;
  await db
    .deleteFrom("access_rules")
    .where((eb) => eb.or([eb("target_id", "=", id), eb("target_id", "in", lessonIds)]))
    .execute();
  await db.deleteFrom("chapters").where("id", "=", id).execute();
  return true;
}
