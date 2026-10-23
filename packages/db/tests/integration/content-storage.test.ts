import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { TenantScope } from "@bebranded/elearning-core";

import { aCourse, singleTenant, tenantA, tenantB } from "../support/factories.js";
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

  it("rejects a duplicate slug within one tenant with slug_taken, on insert and update", async () => {
    const first = aCourse(tenantA.tenantId, { slug: "duplicate" });
    const second = aCourse(tenantA.tenantId, { slug: "unique-one" });
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(first);
      await tx.insertCourse(second);
    });

    await expect(
      database.storage.transaction((tx) =>
        tx.insertCourse(aCourse(tenantA.tenantId, { slug: "duplicate" })),
      ),
    ).rejects.toMatchObject({ kind: "conflict", code: "slug_taken" });
    await expect(
      database.storage.transaction((tx) =>
        tx.updateCourse(tenantA, second.id, { slug: "duplicate" }),
      ),
    ).rejects.toMatchObject({ code: "slug_taken" });
  });

  it("allows the same slug in two tenants", async () => {
    await database.storage.transaction(async (tx) => {
      await tx.insertCourse(aCourse(tenantA.tenantId, { slug: "per-tenant" }));
      await tx.insertCourse(aCourse(tenantB.tenantId, { slug: "per-tenant" }));
    });

    expect(await database.storage.findCourseBySlug(tenantB, "per-tenant")).not.toBeNull();
  });

  it("lets other database errors through unchanged", async () => {
    const duplicateId = aCourse(tenantA.tenantId);
    await database.storage.transaction((tx) => tx.insertCourse(duplicateId));

    await expect(
      database.storage.transaction((tx) => tx.insertCourse({ ...duplicateId, slug: "other-slug" })),
    ).rejects.toMatchObject({ code: "23505", constraint: "courses_pkey" });
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
