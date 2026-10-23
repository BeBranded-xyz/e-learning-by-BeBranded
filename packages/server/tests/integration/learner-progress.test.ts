import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { learnerIdSchema } from "@bebranded/elearning-core";
import type { Chapter, Course, LessonDetail } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;
let course: Course;
let chapter: Chapter;
let first: LessonDetail;
let second: LessonDetail;
let optional: LessonDetail;
let video: LessonDetail;
let hidden: LessonDetail;

async function outboxTypes(): Promise<string[]> {
  const rows = await sql<{ type: string }>`
    SELECT type FROM ${sql.id(t.database.schema, "event_outbox")} ORDER BY occurred_at, type`.execute(
    t.database.admin,
  );
  return rows.rows.map((row) => row.type);
}

beforeAll(async () => {
  t = await createTestApp();
  course = aCourse(tenant, { slug: "safety" });
  chapter = aChapter(course);
  first = aLesson(chapter, {
    position: 0,
    title: "First",
    content: [
      {
        id: "b1",
        type: "paragraph",
        props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
        content: [{ type: "text", text: "Wear <gloves>", styles: { bold: true } }],
        children: [],
      },
    ],
  });
  second = aLesson(chapter, { position: 1, title: "Second", content: null });
  optional = aLesson(chapter, { position: 2, title: "Optional", isRequired: false });
  video = aLesson(chapter, { position: 3, title: "Video", type: "video", isRequired: false });
  hidden = aLesson(chapter, { position: 4, title: "Managers", isRequired: true });
  await seed(t.database, [
    {
      course,
      chapters: [chapter],
      lessons: [first, second, optional, video, hidden],
      rules: [
        rule(course, "course", "allow"),
        rule(hidden, "lesson", "allow", { type: "role", role: "manager" }),
      ],
    },
  ]);
});

afterAll(async () => {
  await t.database.drop();
});

describe("GET /v1/lessons/:id", () => {
  it("returns the lesson rendered to escaped HTML", async () => {
    const response = await t.request("GET", `/v1/lessons/${first.id}`, { as: "staff" });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: first.id,
      title: "First",
      type: "text",
      status: "not_started",
      course_id: course.id,
    });
    expect(body.html).toBe("<p><strong>Wear &lt;gloves&gt;</strong></p>");
  });

  it("renders nothing and logs an error when stored content is invalid (written around the API)", async () => {
    await sql`UPDATE ${sql.id(t.database.schema, "lessons")} SET content = ${JSON.stringify([{ id: "x", type: "html", props: {}, content: "<script>alert(1)</script>", children: [] }])}::jsonb WHERE id = ${optional.id}`.execute(
      t.database.admin,
    );

    const body = await readJson(
      await t.request("GET", `/v1/lessons/${optional.id}`, { as: "staff" }),
    );

    expect(body.html).toBe("");
    expect(t.logs).toContainEqual(
      expect.objectContaining({ level: "error", message: "stored lesson content is invalid" }),
    );
  });

  it("does not change any state (GET is safe)", async () => {
    await t.request("GET", `/v1/lessons/${second.id}`, { as: "staff" });

    expect(
      await t.database.storage.listLessonProgress(
        { tenantId: tenant, includeShared: false },
        learnerIdSchema.parse("staff-1"),
        [second.id],
      ),
    ).toEqual([]);
  });

  it.each([
    ["a lesson the learner cannot see", () => hidden.id],
    ["an unknown lesson", () => "00000000-0000-4000-8000-000000000000"],
    ["an id that is not a uuid", () => "1 OR 1=1"],
  ])("answers 404 for %s", async (_label, id) => {
    expect(
      (await t.request("GET", `/v1/lessons/${encodeURIComponent(id())}`, { as: "staff" })).status,
    ).toBe(404);
  });

  it("answers 404 to a learner of another tenant", async () => {
    expect((await t.request("GET", `/v1/lessons/${first.id}`, { as: "otherTenant" })).status).toBe(
      404,
    );
  });
});

describe("start and complete", () => {
  it("starting a lesson enrolls the learner and emits lesson.started and course.started", async () => {
    const response = await t.request("POST", `/v1/lessons/${first.id}/start`, { as: "staff" });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "in_progress",
      enrollment: { source: "self", progress: 0, completed_at: null },
    });
    expect(await outboxTypes()).toEqual(["course.started", "lesson.started"]);
  });

  it("is idempotent: starting again changes nothing and emits nothing", async () => {
    await t.request("POST", `/v1/lessons/${first.id}/start`, { as: "staff" });

    expect(await outboxTypes()).toEqual(["course.started", "lesson.started"]);
  });

  it("completing counts only accessible required lessons", async () => {
    t.advance(60_000);
    const body = await readJson(
      await t.request("POST", `/v1/lessons/${first.id}/complete`, { as: "staff" }),
    );

    // Required and visible to staff: First and Second (Managers is hidden, Optional and Video are optional).
    expect(body).toMatchObject({
      status: "completed",
      enrollment: { progress: 0.5, completed_at: null },
    });
    expect(await outboxTypes()).toEqual(["course.started", "lesson.started", "lesson.completed"]);
  });

  it("never moves a completed lesson back when it is started again", async () => {
    const body = await readJson(
      await t.request("POST", `/v1/lessons/${first.id}/start`, { as: "staff" }),
    );

    expect(body.status).toBe("completed");
  });

  it("completes the course once, when the last required lesson is done", async () => {
    t.advance(60_000);
    const done = await readJson(
      await t.request("POST", `/v1/lessons/${second.id}/complete`, { as: "staff" }),
    );
    await t.request("POST", `/v1/lessons/${second.id}/complete`, { as: "staff" });
    await t.request("POST", `/v1/lessons/${optional.id}/complete`, { as: "staff" });

    expect(done).toMatchObject({
      status: "completed",
      enrollment: { progress: 1, completed_at: "2026-06-01T09:02:00.000Z" },
    });
    expect((await outboxTypes()).filter((type) => type === "course.completed")).toEqual([
      "course.completed",
    ]);
  });

  it("shows the progress on the course page and in My training", async () => {
    const page = await readJson(await t.request("GET", "/v1/courses/safety", { as: "staff" }));
    const mine = await readJson(await t.request("GET", "/v1/me/progress", { as: "staff" }));

    expect(page.progress).toEqual({
      completed_required: 2,
      total_required: 2,
      ratio: 1,
      is_complete: true,
    });
    expect(mine.data).toMatchObject([{ slug: "safety", enrollment: { progress: 1 } }]);
  });

  it("refuses to mark a video lesson as done by hand", async () => {
    const response = await t.request("POST", `/v1/lessons/${video.id}/complete`, { as: "staff" });

    expect(response.status).toBe(409);
    expect((await readJson(response)).error).toMatchObject({ code: "completion_not_manual" });
  });

  it("answers 404 when completing a lesson the learner cannot see", async () => {
    expect(
      (await t.request("POST", `/v1/lessons/${hidden.id}/complete`, { as: "staff" })).status,
    ).toBe(404);
  });

  it("keeps the counts right when one learner completes two lessons at the same time", async () => {
    const [a, b] = await Promise.all([
      t.request("POST", `/v1/lessons/${first.id}/complete`, { as: "manager" }),
      t.request("POST", `/v1/lessons/${second.id}/complete`, { as: "manager" }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);
    const page = await readJson(await t.request("GET", "/v1/courses/safety", { as: "manager" }));
    // A manager also sees the "Managers" lesson: 2 of 3 required lessons.
    expect(page.progress).toEqual({
      completed_required: 2,
      total_required: 3,
      ratio: 2 / 3,
      is_complete: false,
    });
  });

  it("creates one enrollment and one course.started when the first requests race", async () => {
    const other = await createTestApp();
    await seed(other.database, [
      {
        course,
        chapters: [chapter],
        lessons: [first, second],
        rules: [rule(course, "course", "allow")],
      },
    ]);

    await Promise.all(
      [first, second, first].map((lesson) =>
        other.request("POST", `/v1/lessons/${lesson.id}/start`, { as: "staff" }),
      ),
    );

    const rows = await sql<{ type: string }>`
      SELECT type FROM ${sql.id(other.database.schema, "event_outbox")} WHERE type = 'course.started'`.execute(
      other.database.admin,
    );
    expect(rows.rows).toHaveLength(1);
    expect(
      await other.database.storage.listEnrollments(
        { tenantId: tenant, includeShared: false },
        learnerIdSchema.parse("staff-1"),
      ),
    ).toHaveLength(1);
    await other.database.drop();
  });
});

describe("POST /v1/courses/:id/enroll", () => {
  it("enrolls with 201, then returns the same enrollment with 200", async () => {
    const created = await t.request("POST", `/v1/courses/${course.id}/enroll`, {
      as: "otherTenant",
    });
    expect(created.status).toBe(404);

    const enrollCourse = aCourse(tenant, { slug: "enroll-me" });
    await seed(t.database, [
      { course: enrollCourse, rules: [rule(enrollCourse, "course", "allow")] },
    ]);
    const firstTime = await t.request("POST", `/v1/courses/${enrollCourse.id}/enroll`, {
      as: "staff",
    });
    const again = await t.request("POST", `/v1/courses/${enrollCourse.id}/enroll`, { as: "staff" });

    expect(firstTime.status).toBe(201);
    expect(again.status).toBe(200);
    expect((await readJson(again)).id).toBe((await readJson(firstTime)).id);
  });

  it("answers 404 for an assignment-only course the learner was not assigned", async () => {
    const assigned = aCourse(tenant, { slug: "assigned-only", enrollmentMode: "assignment_only" });
    await seed(t.database, [{ course: assigned, rules: [rule(assigned, "course", "allow")] }]);

    expect(
      (await t.request("POST", `/v1/courses/${assigned.id}/enroll`, { as: "staff" })).status,
    ).toBe(404);
  });

  it("answers 404 for an id that is not a uuid", async () => {
    expect((await t.request("POST", "/v1/courses/not-a-uuid/enroll", { as: "staff" })).status).toBe(
      404,
    );
  });
});

describe("GET /v1/me/progress", () => {
  it("hides enrollments of courses the learner can no longer see, without deleting them", async () => {
    const leaving = aCourse(tenant, { slug: "leaving" });
    const allow = rule(leaving, "course", "allow");
    await seed(t.database, [{ course: leaving, rules: [allow] }]);
    await t.request("POST", `/v1/courses/${leaving.id}/enroll`, { as: "manager" });

    await t.database.storage.transaction((tx) =>
      tx.deleteAccessRule({ tenantId: tenant, includeShared: false }, allow.id),
    );
    const mine = await readJson(await t.request("GET", "/v1/me/progress", { as: "manager" }));

    expect((mine.data as { slug: string }[]).map((entry) => entry.slug)).not.toContain("leaving");
    expect(
      await t.database.storage.findEnrollment(
        { tenantId: tenant, includeShared: false },
        leaving.id,
        learnerIdSchema.parse("manager-1"),
      ),
    ).not.toBeNull();
  });
});
