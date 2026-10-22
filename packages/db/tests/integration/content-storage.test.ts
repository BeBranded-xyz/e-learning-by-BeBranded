import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { TenantScope } from "@bebranded/elearning-core";

import {
  aChapter,
  aCourse,
  aLesson,
  anAllowRule,
  singleTenant,
  tenantA,
  tenantB,
} from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;
const sharedForA: TenantScope = { ...tenantA, includeShared: true };

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

describe("courses", () => {
  it("stores and reads back a course with every field", async () => {
    const course = aCourse(tenantA.tenantId, {
      summary: "About safety",
      metadata: { code: "S-1" },
    });
    await database.storage.transaction((tx) => tx.insertCourse(course));

    expect(await database.storage.findCourseById(tenantA, course.id)).toEqual(course);
    expect(await database.storage.findCourseBySlug(tenantA, course.slug)).toEqual(course);
  });

  it("returns null for an unknown course", async () => {
    expect(await database.storage.findCourseBySlug(tenantA, "does-not-exist")).toBeNull();
  });

  it("never returns a course of another tenant", async () => {
    const course = aCourse(tenantB.tenantId);
    await database.storage.transaction((tx) => tx.insertCourse(course));

    expect(await database.storage.findCourseById(tenantA, course.id)).toBeNull();
    expect(await database.storage.findCourseBySlug(tenantA, course.slug)).toBeNull();
    expect((await database.storage.listCourses(tenantA)).map((c) => c.id)).not.toContain(course.id);
  });

  it("shows the shared catalog only when includeShared is set", async () => {
    const shared = aCourse(null);
    await database.storage.transaction((tx) => tx.insertCourse(shared));

    expect(await database.storage.findCourseById(tenantA, shared.id)).toBeNull();
    expect(await database.storage.findCourseById(sharedForA, shared.id)).toEqual(shared);
    expect(await database.storage.findCourseById(singleTenant, shared.id)).toEqual(shared);
  });

  it("prefers the tenant's course when a shared course has the same slug", async () => {
    const shared = aCourse(null, { slug: "onboarding" });
    const own = aCourse(tenantA.tenantId, { slug: "onboarding" });
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(shared);
      await tx.insertCourse(own);
    });

    expect((await database.storage.findCourseBySlug(sharedForA, "onboarding"))?.id).toBe(own.id);
  });

  it("rejects a duplicate slug within one tenant", async () => {
    const first = aCourse(tenantA.tenantId, { slug: "duplicate" });
    await database.storage.transaction((tx) => tx.insertCourse(first));

    await expect(
      database.storage.transaction((tx) =>
        tx.insertCourse(aCourse(tenantA.tenantId, { slug: "duplicate" })),
      ),
    ).rejects.toThrow();
  });

  it("updates only the given fields of an owned course", async () => {
    const course = aCourse(tenantA.tenantId, { status: "draft", publishedAt: null });
    await database.storage.transaction((tx) => tx.insertCourse(course));
    const publishedAt = new Date("2026-02-01T00:00:00Z");

    const updated = await database.storage.transaction((tx) =>
      tx.updateCourse(tenantA, course.id, { status: "published", publishedAt }),
    );

    expect(updated).toBe(true);
    expect(await database.storage.findCourseById(tenantA, course.id)).toEqual({
      ...course,
      status: "published",
      publishedAt,
    });
  });

  it("updates the JSON fields of a course", async () => {
    const course = aCourse(tenantA.tenantId);
    await database.storage.transaction((tx) => tx.insertCourse(course));
    const patch = {
      completionRule: { type: "all_required_lessons" as const },
      metadata: { owner: "hr" },
    };

    await database.storage.transaction((tx) => tx.updateCourse(tenantA, course.id, patch));

    expect(await database.storage.findCourseById(tenantA, course.id)).toEqual({
      ...course,
      ...patch,
    });
  });

  it("returns false for an empty patch without touching the row", async () => {
    const course = aCourse(tenantA.tenantId);
    await database.storage.transaction((tx) => tx.insertCourse(course));

    expect(
      await database.storage.transaction((tx) => tx.updateCourse(tenantA, course.id, {})),
    ).toBe(false);
  });

  it("refuses to update or delete a course of another tenant or of the shared catalog", async () => {
    const other = aCourse(tenantB.tenantId);
    const shared = aCourse(null);
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(other);
      await tx.insertCourse(shared);
    });

    const results = await database.storage.transaction(async (tx) => [
      await tx.updateCourse(tenantA, other.id, { title: "Hijacked" }),
      await tx.updateCourse(sharedForA, shared.id, { title: "Hijacked" }),
      await tx.deleteCourse(tenantA, other.id),
      await tx.deleteCourse(sharedForA, shared.id),
    ]);

    expect(results).toEqual([false, false, false, false]);
    expect((await database.storage.findCourseById(tenantB, other.id))?.title).toBe(other.title);
  });
});

describe("chapters and lessons", () => {
  it("lists a course tree in position order, without lesson content", async () => {
    const course = aCourse(tenantA.tenantId);
    const second = aChapter(course, { position: 1, title: "Second" });
    const first = aChapter(course, { position: 0, title: "First" });
    const lessonB = aLesson(first, { position: 1, title: "B" });
    const lessonA = aLesson(first, { position: 0, title: "A" });
    const lessonC = aLesson(second, { position: 0, title: "C", content: null });
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertChapter(tenantA, second);
      await tx.insertChapter(tenantA, first);
      for (const lesson of [lessonB, lessonC, lessonA]) await tx.insertLesson(tenantA, lesson);
    });

    const chapters = await database.storage.listChapters(tenantA, [course.id]);
    const lessons = await database.storage.listLessons(tenantA, [course.id]);

    expect(chapters.map((chapter) => chapter.title)).toEqual(["First", "Second"]);
    expect(lessons.map((lesson) => lesson.title)).toEqual(["A", "B", "C"]);
    expect(lessons[0]).not.toHaveProperty("content");
    expect(await database.storage.findLesson(tenantA, lessonA.id)).toEqual(lessonA);
  });

  it("returns empty lists for no course ids", async () => {
    expect(await database.storage.listChapters(tenantA, [])).toEqual([]);
    expect(await database.storage.listLessons(tenantA, [])).toEqual([]);
  });

  it("refuses a chapter in another tenant's course and a lesson in another tenant's chapter", async () => {
    const course = aCourse(tenantB.tenantId);
    const chapter = aChapter(course);
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertChapter(tenantB, chapter);
    });

    const inserted = await database.storage.transaction(async (tx) => [
      await tx.insertChapter(tenantA, aChapter(course)),
      await tx.insertLesson(tenantA, aLesson(chapter)),
    ]);

    expect(inserted).toEqual([false, false]);
    expect(
      await database.storage.transaction((tx) => tx.deleteLesson(tenantA, aLesson(chapter).id)),
    ).toBe(false);
    expect(await database.storage.listChapters(tenantB, [course.id])).toHaveLength(1);
  });

  it("copies the tenant and course of the parent on insert", async () => {
    const course = aCourse(tenantA.tenantId);
    const chapter = aChapter(course);
    const lesson = aLesson(chapter);
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertChapter(tenantA, chapter);
      await tx.insertLesson(tenantA, lesson);
    });

    expect(await database.storage.findLesson(tenantB, lesson.id)).toBeNull();
    expect((await database.storage.findLesson(tenantA, lesson.id))?.courseId).toBe(course.id);
  });

  it("updates and deletes lessons and chapters, with their access rules", async () => {
    const course = aCourse(tenantA.tenantId);
    const chapter = aChapter(course);
    const lesson = aLesson(chapter);
    const lessonRule = anAllowRule(tenantA.tenantId, lesson, "lesson");
    const chapterRule = anAllowRule(tenantA.tenantId, chapter, "chapter");
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertChapter(tenantA, chapter);
      await tx.insertLesson(tenantA, lesson);
      await tx.insertAccessRule(lessonRule);
      await tx.insertAccessRule(chapterRule);
    });

    const updated = await database.storage.transaction(async (tx) => [
      await tx.updateLesson(tenantA, lesson.id, { title: "Renamed", content: null, settings: {} }),
      await tx.updateChapter(tenantA, chapter.id, { title: "Renamed chapter" }),
      await tx.updateLesson(tenantA, lesson.id, {}),
      await tx.updateChapter(tenantA, chapter.id, {}),
    ]);
    expect(updated).toEqual([true, true, false, false]);
    const content = [{ type: "heading", content: "New" }];
    await database.storage.transaction((tx) =>
      tx.updateLesson(tenantA, lesson.id, { content, isRequired: false }),
    );
    expect(await database.storage.findLesson(tenantA, lesson.id)).toMatchObject({
      content,
      isRequired: false,
      settings: {},
    });
    await database.storage.transaction((tx) =>
      tx.updateLesson(tenantA, lesson.id, { content: null }),
    );
    expect(await database.storage.findLesson(tenantA, lesson.id)).toMatchObject({
      title: "Renamed",
      content: null,
      settings: {},
    });
    expect((await database.storage.findChapter(tenantA, chapter.id))?.title).toBe(
      "Renamed chapter",
    );

    expect(await database.storage.transaction((tx) => tx.deleteLesson(tenantA, lesson.id))).toBe(
      true,
    );
    expect(await database.storage.findAccessRule(tenantA, lessonRule.id)).toBeNull();
    expect(await database.storage.transaction((tx) => tx.deleteChapter(tenantA, chapter.id))).toBe(
      true,
    );
    expect(await database.storage.findAccessRule(tenantA, chapterRule.id)).toBeNull();
    expect(await database.storage.transaction((tx) => tx.deleteChapter(tenantA, chapter.id))).toBe(
      false,
    );
    expect(await database.storage.transaction((tx) => tx.deleteLesson(tenantA, lesson.id))).toBe(
      false,
    );
  });

  it("deletes a course with its whole tree and every access rule of the tree", async () => {
    const course = aCourse(tenantA.tenantId);
    const chapter = aChapter(course);
    const lesson = aLesson(chapter);
    const ruleIds = [
      anAllowRule(tenantA.tenantId, course),
      anAllowRule(tenantA.tenantId, chapter, "chapter"),
      anAllowRule(tenantA.tenantId, lesson, "lesson"),
    ];
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(course);
      await tx.insertChapter(tenantA, chapter);
      await tx.insertLesson(tenantA, lesson);
      for (const rule of ruleIds) await tx.insertAccessRule(rule);
    });

    expect(await database.storage.transaction((tx) => tx.deleteCourse(tenantA, course.id))).toBe(
      true,
    );

    expect(await database.storage.findLesson(tenantA, lesson.id)).toBeNull();
    expect(await database.storage.findChapter(tenantA, chapter.id)).toBeNull();
    expect(
      await database.storage.listAccessRules(tenantA, [course.id, chapter.id, lesson.id]),
    ).toEqual([]);
  });
});
