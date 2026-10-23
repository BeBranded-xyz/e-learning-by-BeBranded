import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enrollmentIdSchema, learnerIdSchema, tenantIdSchema } from "@bebranded/elearning-core";
import type { AssignmentAudience, Course, TenantScope } from "@bebranded/elearning-core";

import { aCourse, anAssignment, learner, tenantA, tenantB } from "../support/factories.js";
import { createTestDatabase } from "../support/test-database.js";
import type { TestDatabase } from "../support/test-database.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

const sales: AssignmentAudience = { type: "role", role: "sales" };
const grade3: AssignmentAudience = { type: "grade_min", grade: 3 };
const learnerAudience: AssignmentAudience = { type: "learner", learnerId: learner };

async function aStoredCourse(tenant: TenantScope = tenantA): Promise<Course> {
  const course = aCourse(tenant.tenantId);
  await database.storage.transaction((tx) => tx.insertCourse(course));
  return course;
}

function save(scope: TenantScope, assignment: ReturnType<typeof anAssignment>) {
  return database.storage.transaction((tx) => tx.saveCourseAssignment(scope, assignment));
}

function enroll(course: Course, learnerId = learner) {
  return database.storage.transaction((tx) =>
    tx.saveEnrollment(tenantA, {
      id: enrollmentIdSchema.parse(randomUUID()),
      courseId: course.id,
      learnerId,
      source: "self",
      assignedBy: null,
      dueAt: null,
      startedAt: null,
      completedAt: null,
      progress: 0,
    }),
  );
}

describe("saveCourseAssignment", () => {
  it("stores an assignment and lists it with its course", async () => {
    const course = await aStoredCourse();
    const assignment = anAssignment(course, sales, { dueAt: new Date("2026-12-31T00:00:00Z") });

    const stored = await save(tenantA, assignment);

    expect(stored).toEqual(assignment);
    expect(await database.storage.listCourseAssignments(tenantA, course.id)).toEqual([assignment]);
  });

  it.each<[string, AssignmentAudience]>([
    ["a role", sales],
    ["a grade", grade3],
    ["a learner", learnerAudience],
  ])("round-trips %s audience", async (_label, audience) => {
    const course = await aStoredCourse();
    const assignment = anAssignment(course, audience);

    expect(await save(tenantA, assignment)).toEqual(assignment);
  });

  it("updates the due date and assigner of the same audience, keeping its id", async () => {
    const course = await aStoredCourse();
    const first = await save(tenantA, anAssignment(course, sales));
    const again = anAssignment(course, sales, {
      dueAt: new Date("2027-01-15T00:00:00Z"),
      assignedBy: learnerIdSchema.parse("admin-2"),
    });

    const stored = await save(tenantA, again);

    expect(stored).toEqual({ ...first, dueAt: again.dueAt, assignedBy: again.assignedBy });
    expect(await database.storage.listCourseAssignments(tenantA, course.id)).toEqual([stored]);
  });

  it("keeps one assignment per tenant for a shared course", async () => {
    const shared = aCourse(null);
    await database.storage.transaction((tx) => tx.insertCourse(shared));

    await save(tenantA, anAssignment(shared, sales));
    await save(tenantB, anAssignment(shared, sales));

    expect(await database.storage.listCourseAssignments(tenantA, shared.id)).toHaveLength(1);
    expect(await database.storage.listCourseAssignments(tenantB, shared.id)).toHaveLength(1);
  });

  it("rejects an unknown course (foreign key)", async () => {
    await expect(save(tenantA, anAssignment(aCourse(tenantA.tenantId), sales))).rejects.toThrow();
  });

  it("is deleted with its course", async () => {
    const course = await aStoredCourse();
    await save(tenantA, anAssignment(course, sales));

    await database.storage.transaction((tx) => tx.deleteCourse(tenantA, course.id));

    expect(await database.storage.listCourseAssignments(tenantA, course.id)).toEqual([]);
  });
});

describe("listCourseAssignments", () => {
  it("does not list another tenant's assignments", async () => {
    const course = await aStoredCourse();
    await save(tenantA, anAssignment(course, sales));

    expect(await database.storage.listCourseAssignments(tenantB, course.id)).toEqual([]);
  });
});

describe("deleteCourseAssignment", () => {
  it("deletes the tenant's assignment only", async () => {
    const course = await aStoredCourse();
    const assignment = await save(tenantA, anAssignment(course, sales));

    const byOther = await database.storage.transaction((tx) =>
      tx.deleteCourseAssignment(tenantB, assignment.id),
    );
    const byOwner = await database.storage.transaction((tx) =>
      tx.deleteCourseAssignment(tenantA, assignment.id),
    );

    expect([byOther, byOwner]).toEqual([false, true]);
    expect(await database.storage.listCourseAssignments(tenantA, course.id)).toEqual([]);
  });
});

describe("listPendingAssignments", () => {
  // A tenant of its own: no other test adds assignments to it.
  const tenantC: TenantScope = { tenantId: tenantIdSchema.parse("tenant-c"), includeShared: false };
  const pending = (overrides: { roles?: string[]; grade?: number | null } = {}) =>
    database.storage.listPendingAssignments(tenantC, {
      learnerId: learner,
      roles: overrides.roles ?? [],
      grade: overrides.grade ?? null,
    });

  async function assigned(audience: AssignmentAudience) {
    const course = await aStoredCourse(tenantC);
    return save(tenantC, anAssignment(course, audience));
  }

  it("matches the learner by id, role and minimum grade", async () => {
    const byId = await assigned(learnerAudience);
    const byRole = await assigned(sales);
    const byGrade = await assigned(grade3);
    await assigned({ type: "role", role: "manager" });
    await assigned({ type: "grade_min", grade: 4 });
    await assigned({ type: "learner", learnerId: learnerIdSchema.parse("someone-else") });

    const ids = (await pending({ roles: ["sales"], grade: 3 })).map((a) => a.id);

    expect(ids.sort()).toEqual([byId.id, byRole.id, byGrade.id].sort());
    expect((await pending()).map((a) => a.id)).toEqual([byId.id]);
  });

  it("skips courses the learner is already enrolled in", async () => {
    const course = await aStoredCourse(tenantA);
    await save(tenantA, anAssignment(course, { type: "role", role: "support" }));
    const scope = tenantA;
    const before = await database.storage.listPendingAssignments(scope, {
      learnerId: learner,
      roles: ["support"],
      grade: null,
    });

    await enroll(course);
    const after = await database.storage.listPendingAssignments(scope, {
      learnerId: learner,
      roles: ["support"],
      grade: null,
    });

    expect(before.map((a) => a.courseId)).toContain(course.id);
    expect(after.map((a) => a.courseId)).not.toContain(course.id);
  });

  it("ignores another tenant's assignments", async () => {
    const course = await aStoredCourse(tenantA);
    await save(tenantA, anAssignment(course, { type: "role", role: "auditor" }));

    expect(await pending({ roles: ["auditor"] })).not.toContainEqual(
      expect.objectContaining({ courseId: course.id }),
    );
  });
});

describe("course_assignments constraints", () => {
  async function forceAudience(type: string, value: string) {
    const course = await aStoredCourse();
    const assignment = await save(tenantA, anAssignment(course, sales));
    await sql`UPDATE ${sql.id(database.schema, "course_assignments")}
      SET audience_type = ${type}, audience_value = ${value}
      WHERE id = ${assignment.id}`.execute(database.admin);
  }

  it.each([
    ["everyone", "x"],
    ["grade_min", "three"],
    ["grade_min", "12345"],
    ["role", ""],
  ])("rejects audience %s with value %j", async (type, value) => {
    await expect(forceAudience(type, value)).rejects.toThrow(/course_assignments/);
  });
});
