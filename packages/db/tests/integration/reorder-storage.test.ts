import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aChapter, aCourse, aLesson, tenantA, tenantB } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

async function aTree(tenant = tenantA) {
  const course = aCourse(tenant.tenantId);
  const first = aChapter(course, { position: 0 });
  const second = aChapter(course, { position: 1 });
  const lesson = aLesson(first);
  await database.storage.transaction(async (tx) => {
    await tx.insertCourse(course);
    await tx.insertChapter(tenant, first);
    await tx.insertChapter(tenant, second);
    await tx.insertLesson(tenant, lesson);
  });
  return { course, first, second, lesson };
}

describe("lockCourse", () => {
  it("returns an owned course", async () => {
    const { course } = await aTree();

    expect(await database.storage.transaction((tx) => tx.lockCourse(tenantA, course.id))).toEqual(
      course,
    );
  });

  it("returns null for another tenant's or a shared-catalog course", async () => {
    const { course } = await aTree(tenantB);
    const shared = aCourse(null);
    await database.storage.transaction((tx) => tx.insertCourse(shared));
    const sharedScope = { ...tenantA, includeShared: true };

    const locked = await database.storage.transaction(async (tx) => [
      await tx.lockCourse(tenantA, course.id),
      await tx.lockCourse(sharedScope, shared.id),
    ]);

    expect(locked).toEqual([null, null]);
  });
});

describe("moving a lesson", () => {
  it("moves a lesson to another chapter of its course", async () => {
    const { second, lesson } = await aTree();

    const moved = await database.storage.transaction((tx) =>
      tx.updateLesson(tenantA, lesson.id, { chapterId: second.id, position: 3 }),
    );

    expect(moved).toBe(true);
    expect(await database.storage.findLesson(tenantA, lesson.id)).toMatchObject({
      chapterId: second.id,
      position: 3,
    });
  });

  it("refuses a chapter of another course, even of the same tenant", async () => {
    const { lesson } = await aTree();
    const other = await aTree();

    const moved = await database.storage.transaction((tx) =>
      tx.updateLesson(tenantA, lesson.id, { chapterId: other.first.id }),
    );

    expect(moved).toBe(false);
    expect((await database.storage.findLesson(tenantA, lesson.id))?.chapterId).toBe(
      lesson.chapterId,
    );
  });

  it("refuses to move another tenant's lesson", async () => {
    const { second, lesson } = await aTree(tenantB);

    const moved = await database.storage.transaction((tx) =>
      tx.updateLesson(tenantA, lesson.id, { chapterId: second.id }),
    );

    expect(moved).toBe(false);
  });
});
