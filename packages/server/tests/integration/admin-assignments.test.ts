import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { learnerIdSchema } from "@bebranded/elearning-core";
import type { Audience, Course, DomainEvent, TenantScope } from "@bebranded/elearning-core";

import { aCourse } from "../../../db/tests/support/factories.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { LearnerName, TestApp } from "../support/test-app.js";

let t: TestApp;
const assigned: DomainEvent[] = [];
const scope: TenantScope = { tenantId: tenant, includeShared: false };
const DUE = "2026-07-01T00:00:00.000Z";

beforeEach(async () => {
  assigned.length = 0;
  t = await createTestApp({
    events: {
      "enrollment.assigned": (event) => {
        assigned.push(event);
        return Promise.resolve();
      },
    },
  });
});

afterEach(async () => {
  await t.database.drop();
});

/** An assignment-only course: invisible until assigned. Everyone may access it by default. */
async function aCourseWith(
  slug: string,
  rules: Audience[] = [{ type: "everyone" }],
  status = "published",
) {
  const course = aCourse(tenant, {
    slug,
    enrollmentMode: "assignment_only",
    allowLearnerExport: false,
    status: status === "published" ? "published" : "draft",
  });
  await seed(t.database, [
    { course, rules: rules.map((audience) => rule(course, "course", "allow", audience)) },
  ]);
  return course;
}

async function assign(course: Course, audience: unknown, extra: Record<string, unknown> = {}) {
  const response = await t.request("POST", "/v1/admin/assignments", {
    as: "admin",
    body: { course_id: course.id, audience, ...extra },
  });
  return { status: response.status, body: await readJson(response) };
}

async function catalogSlugs(as: LearnerName): Promise<string[]> {
  const body = await readJson(await t.request("GET", "/v1/courses", { as }));
  return (body.data as { slug: string }[]).map((course) => course.slug);
}

function enrollmentOf(course: Course, learner: string) {
  return t.database.storage.findEnrollment(scope, course.id, learnerIdSchema.parse(learner));
}

describe("POST /v1/admin/assignments to a role or a grade", () => {
  it("enrolls matching learners on their next visit, with the due date", async () => {
    const course = await aCourseWith("for-managers");

    const created = await assign(course, { type: "role", role: "manager" }, { due_at: DUE });

    expect(created).toMatchObject({
      status: 201,
      body: {
        course_id: course.id,
        audience: { type: "role", role: "manager" },
        due_at: DUE,
        assigned_by: "admin-1",
      },
    });
    expect(await enrollmentOf(course, "manager-1")).toBeNull();
    expect(await catalogSlugs("manager")).toContain("for-managers");
    expect(await enrollmentOf(course, "manager-1")).toMatchObject({
      source: "auto",
      dueAt: new Date(DUE),
      assignedBy: "admin-1",
    });
    expect(await catalogSlugs("staff")).not.toContain("for-managers");
  });

  it("enrolls on a visit of My training or of the course page too", async () => {
    const course = await aCourseWith("by-grade");
    await assign(course, { type: "grade_min", grade: 3 });

    const page = await t.request("GET", "/v1/courses/by-grade", { as: "manager" });
    const mine = await readJson(await t.request("GET", "/v1/me/progress", { as: "manager" }));

    expect(page.status).toBe(200);
    expect((mine.data as { slug: string }[]).map((entry) => entry.slug)).toContain("by-grade");
  });

  it("emits enrollment.assigned once per enrolled learner", async () => {
    const course = await aCourseWith("events");
    await assign(course, { type: "role", role: "staff" }, { due_at: DUE });

    await catalogSlugs("staff");
    await catalogSlugs("staff");
    await t.app.deliverEvents();

    expect(assigned.map((event) => event.payload)).toEqual([
      { learnerId: "staff-1", courseId: course.id, assignedBy: "admin-1", dueAt: DUE },
    ]);
  });

  it("keeps the assignment pending while the learner cannot access the course", async () => {
    const course = aCourse(tenant, { slug: "not-for-managers", enrollmentMode: "assignment_only" });
    await seed(t.database, [
      {
        course,
        rules: [
          rule(course, "course", "allow"),
          rule(course, "course", "deny", { type: "role", role: "manager" }),
        ],
      },
    ]);
    expect((await assign(course, { type: "grade_min", grade: 3 })).status).toBe(201);

    expect(await catalogSlugs("manager")).not.toContain("not-for-managers");
    expect(await enrollmentOf(course, "manager-1")).toBeNull();
  });

  it("can be prepared on a draft course, enrolling once it is published", async () => {
    const course = await aCourseWith("draft", [{ type: "everyone" }], "draft");
    expect((await assign(course, { type: "role", role: "staff" })).status).toBe(201);

    await catalogSlugs("staff");
    const before = await enrollmentOf(course, "staff-1");
    await t.request("PATCH", `/v1/admin/courses/${course.id}`, {
      as: "admin",
      body: { status: "published" },
    });
    const slugs = await catalogSlugs("staff");

    expect(before).toBeNull();
    expect(slugs).toContain("draft");
  });

  it("does not change an existing enrollment", async () => {
    const course = await aCourseWith("already", [{ type: "everyone" }]);
    await t.database.storage.transaction((tx) =>
      tx.updateCourse(scope, course.id, { enrollmentMode: "self" }),
    );
    await t.request("POST", `/v1/courses/${course.id}/enroll`, { as: "staff" });

    await assign(course, { type: "role", role: "staff" }, { due_at: DUE });
    await catalogSlugs("staff");

    expect(await enrollmentOf(course, "staff-1")).toMatchObject({ source: "self", dueAt: null });
  });
});

describe("POST /v1/admin/assignments to a learner", () => {
  it("enrolls the learner at once and emits enrollment.assigned", async () => {
    const course = await aCourseWith("for-one");

    const created = await assign(
      course,
      { type: "learner", learner_id: "staff-1" },
      { due_at: DUE },
    );
    await t.app.deliverEvents();

    expect(created).toMatchObject({
      status: 201,
      body: { audience: { type: "learner", learner_id: "staff-1" } },
    });
    expect(await enrollmentOf(course, "staff-1")).toMatchObject({
      source: "assigned",
      dueAt: new Date(DUE),
    });
    expect(assigned).toHaveLength(1);
    expect(await catalogSlugs("staff")).toContain("for-one");
  });

  it("takes over a self enrollment, keeping its progress", async () => {
    const course = await aCourseWith("self-first");
    await t.database.storage.transaction((tx) =>
      tx.updateCourse(scope, course.id, { enrollmentMode: "self" }),
    );
    await t.request("POST", `/v1/courses/${course.id}/enroll`, { as: "staff" });
    const before = await enrollmentOf(course, "staff-1");

    await assign(course, { type: "learner", learner_id: "staff-1" }, { due_at: DUE });

    expect(await enrollmentOf(course, "staff-1")).toEqual({
      ...before,
      source: "assigned",
      assignedBy: "admin-1",
      dueAt: new Date(DUE),
    });
  });
});

describe("assigning the same audience again", () => {
  it("updates the due date and answers 200 with the same assignment", async () => {
    const course = await aCourseWith("again");
    const first = await assign(course, { type: "role", role: "staff" });

    const second = await assign(course, { type: "role", role: "staff" }, { due_at: DUE });
    const list = await readJson(
      await t.request("GET", `/v1/admin/courses/${course.id}/assignments`, { as: "admin" }),
    );

    expect(second).toMatchObject({ status: 200, body: { id: first.body.id, due_at: DUE } });
    expect(list.data).toEqual([second.body]);
  });
});

describe("refusals", () => {
  it.each([
    ["a role the rules leave out", { type: "role", role: "staff" }],
    ["a grade the rules leave out", { type: "grade_min", grade: 9 }],
  ])("answers 409 audience_without_access for %s", async (_label, audience) => {
    const course = await aCourseWith("managers-only", [{ type: "role", role: "manager" }]);

    const response = await assign(course, audience);
    const list = await readJson(
      await t.request("GET", `/v1/admin/courses/${course.id}/assignments`, { as: "admin" }),
    );

    expect(response).toMatchObject({
      status: 409,
      body: { error: { code: "audience_without_access" } },
    });
    expect(list.data).toEqual([]);
  });

  it("accepts a learner who may hold an allowed role, refuses one denied by name", async () => {
    const course = await aCourseWith("managers-and-deny", [{ type: "role", role: "manager" }]);
    const someone = learnerIdSchema.parse("someone");
    const denySomeone = rule(course, "course", "deny", { type: "learner", learnerId: someone });
    await t.database.storage.transaction((tx) => tx.insertAccessRule(denySomeone));

    const mayBeManager = await assign(course, { type: "learner", learner_id: "nobody" });
    const deniedByName = await assign(course, { type: "learner", learner_id: "someone" });

    expect(mayBeManager.status).toBe(201);
    expect(deniedByName).toMatchObject({
      status: 409,
      body: { error: { code: "audience_without_access" } },
    });
  });

  it("answers 404 for an unknown course and 400 for a malformed body", async () => {
    const course = await aCourseWith("malformed");
    const unknown = { ...course, id: "00000000-0000-4000-8000-000000000000" } as Course;

    expect((await assign(unknown, { type: "role", role: "staff" })).status).toBe(404);
    expect((await assign(course, { type: "everyone" })).status).toBe(400);
    expect((await assign(course, { type: "role", role: "staff" }, { due_at: "soon" })).status).toBe(
      400,
    );
  });

  it("refuses non-admins", async () => {
    const course = await aCourseWith("staff-cannot");

    const response = await t.request("POST", "/v1/admin/assignments", {
      as: "staff",
      body: { course_id: course.id, audience: { type: "role", role: "staff" } },
    });

    expect(response.status).toBe(403);
  });
});

describe("GET /v1/admin/courses/:id/assignments and DELETE /v1/admin/assignments/:id", () => {
  it("lists, then deletes an assignment, keeping the enrollments it created", async () => {
    const course = await aCourseWith("listed");
    const created = await assign(course, { type: "learner", learner_id: "staff-1" });
    const path = `/v1/admin/assignments/${String(created.body.id)}`;

    const list = await readJson(
      await t.request("GET", `/v1/admin/courses/${course.id}/assignments`, { as: "admin" }),
    );
    const deleted = await t.request("DELETE", path, { as: "admin" });
    const again = await t.request("DELETE", path, { as: "admin" });

    expect(list).toEqual({ data: [created.body], next_cursor: null });
    expect([deleted.status, again.status]).toEqual([204, 404]);
    expect(await enrollmentOf(course, "staff-1")).not.toBeNull();
  });

  it("answers 404 for an unknown course or a malformed id", async () => {
    const list = await t.request(
      "GET",
      "/v1/admin/courses/00000000-0000-4000-8000-000000000000/assignments",
      { as: "admin" },
    );
    const remove = await t.request("DELETE", "/v1/admin/assignments/not-an-id", { as: "admin" });

    expect([list.status, remove.status]).toEqual([404, 404]);
  });
});
