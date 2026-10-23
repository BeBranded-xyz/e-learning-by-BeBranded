import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp, readJson } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;
let chapterId: string;
let lessonId: string;
const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const document = (text: string) => [
  {
    id: "p1",
    type: "paragraph",
    props,
    content: [{ type: "text", text, styles: {} }],
    children: [],
  },
];

async function admin(method: string, path: string, body?: unknown) {
  const response = await t.request(method, `/v1/admin/${path}`, { as: "admin", body });
  return { status: response.status, body: response.status === 204 ? {} : await readJson(response) };
}

async function published(): Promise<string[]> {
  const rows = await sql<{ target: string }>`
    SELECT payload->>'targetType' AS target FROM ${sql.id(t.database.schema, "event_outbox")}
    WHERE type = 'content.published' ORDER BY created_at`.execute(t.database.admin);
  return rows.rows.map((row) => row.target);
}

beforeAll(async () => {
  t = await createTestApp();
  const course = await admin("POST", "courses", { slug: "editing", title: "Editing" });
  chapterId = String(
    (
      await admin("POST", "chapters", {
        course_id: String(course.body.id),
        title: "Draft",
        position: 0,
      })
    ).body.id,
  );
  lessonId = String(
    (
      await admin("POST", "lessons", {
        chapter_id: chapterId,
        title: "Draft lesson",
        position: 0,
        content: document("v1"),
      })
    ).body.id,
  );
});

afterAll(async () => {
  await t.database.drop();
});

describe("editing chapters", () => {
  it("renames, reorders and publishes a chapter, emitting content.published once", async () => {
    const renamed = await admin("PATCH", `chapters/${chapterId}`, { title: "Basics", position: 2 });
    await admin("PATCH", `chapters/${chapterId}`, { status: "published" });
    await admin("PATCH", `chapters/${chapterId}`, { status: "published" });

    expect(renamed).toMatchObject({
      status: 200,
      body: { title: "Basics", position: 2, status: "draft" },
    });
    expect(await published()).toEqual(["chapter"]);
  });

  it("answers 404 for a missing chapter and 400 for an empty patch", async () => {
    expect(
      (await admin("PATCH", "chapters/00000000-0000-4000-8000-000000000000", { title: "x" }))
        .status,
    ).toBe(404);
    expect((await admin("PATCH", `chapters/${chapterId}`, {})).status).toBe(400);
    expect(
      (
        await admin("POST", "chapters", {
          course_id: "00000000-0000-4000-8000-000000000000",
          title: "x",
          position: 0,
        })
      ).status,
    ).toBe(404);
  });
});

describe("editing lessons", () => {
  it("returns the stored document to the editor", async () => {
    const lesson = await admin("GET", `lessons/${lessonId}`);

    expect(lesson.body).toMatchObject({
      id: lessonId,
      title: "Draft lesson",
      content: document("v1"),
      status: "draft",
    });
  });

  it("replaces the content after validating it, and keeps other fields", async () => {
    const updated = await admin("PATCH", `lessons/${lessonId}`, {
      content: document("v2"),
      estimated_minutes: 8,
    });

    expect(updated.body).toMatchObject({
      title: "Draft lesson",
      content: document("v2"),
      estimated_minutes: 8,
      content_schema_version: 1,
    });
  });

  it("can clear the content", async () => {
    expect((await admin("PATCH", `lessons/${lessonId}`, { content: null })).body).toMatchObject({
      content: null,
    });
  });

  it("rejects invalid content on update without changing the lesson", async () => {
    const rejected = await admin("PATCH", `lessons/${lessonId}`, {
      content: [{ id: "x", type: "image", props: {}, children: [] }],
      title: "Changed",
    });

    expect(rejected.status).toBe(400);
    expect((await admin("GET", `lessons/${lessonId}`)).body).toMatchObject({
      title: "Draft lesson",
    });
  });

  it("publishes a lesson, emitting content.published, and rejects unknown settings", async () => {
    await admin("PATCH", `lessons/${lessonId}`, {
      status: "published",
      settings: { requireScrollToEnd: true },
    });

    expect(await published()).toEqual(["chapter", "lesson"]);
    expect((await admin("GET", `lessons/${lessonId}`)).body).toMatchObject({
      settings: { requireScrollToEnd: true },
    });
    expect(
      (await admin("PATCH", `lessons/${lessonId}`, { settings: { autoplay: true } })).status,
    ).toBe(400);
  });

  it("answers 404 for a lesson in a missing chapter, and for missing lessons", async () => {
    expect(
      (
        await admin("POST", "lessons", {
          chapter_id: "00000000-0000-4000-8000-000000000000",
          title: "x",
          position: 0,
        })
      ).status,
    ).toBe(404);
    expect((await admin("GET", "lessons/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect(
      (await admin("PATCH", "lessons/00000000-0000-4000-8000-000000000000", { title: "x" })).status,
    ).toBe(404);
  });
});

describe("access rules", () => {
  it.each([
    ["role", { type: "role", role: "manager" }],
    ["grade", { type: "grade_min", grade: 2 }],
  ])("creates a %s rule on a chapter and a lesson", async (_label, audience) => {
    const onChapter = await admin("POST", "access-rules", {
      target_type: "chapter",
      target_id: chapterId,
      effect: "allow",
      audience,
    });
    const onLesson = await admin("POST", "access-rules", {
      target_type: "lesson",
      target_id: lessonId,
      effect: "deny",
      audience,
    });

    expect(onChapter).toMatchObject({ status: 201, body: { target_type: "chapter", audience } });
    expect(onLesson).toMatchObject({
      status: 201,
      body: { target_type: "lesson", effect: "deny" },
    });
  });

  it.each([
    [
      "a missing target",
      {
        target_type: "lesson",
        target_id: "00000000-0000-4000-8000-000000000000",
        effect: "allow",
        audience: { type: "everyone" },
      },
      404,
    ],
    [
      "an unknown audience",
      {
        target_type: "chapter",
        target_id: "00000000-0000-4000-8000-000000000000",
        effect: "allow",
        audience: { type: "group" },
      },
      400,
    ],
    [
      "an unknown target type",
      {
        target_type: "quiz",
        target_id: "00000000-0000-4000-8000-000000000000",
        effect: "allow",
        audience: { type: "everyone" },
      },
      400,
    ],
  ])("rejects %s", async (_label, body, status) => {
    expect((await admin("POST", "access-rules", body)).status).toBe(status);
  });

  it("answers 404 when deleting a rule twice", async () => {
    const created = await admin("POST", "access-rules", {
      target_type: "chapter",
      target_id: chapterId,
      effect: "allow",
      audience: { type: "everyone" },
    });

    expect((await admin("DELETE", `access-rules/${String(created.body.id)}`)).status).toBe(204);
    expect((await admin("DELETE", `access-rules/${String(created.body.id)}`)).status).toBe(404);
  });
});

describe("deleting", () => {
  it("deletes a lesson, a chapter, a rule and a course, then answers 404", async () => {
    const course = await admin("POST", "courses", { slug: "to-delete", title: "Delete" });
    const chapter = await admin("POST", "chapters", {
      course_id: String(course.body.id),
      title: "C",
      position: 0,
    });
    const lesson = await admin("POST", "lessons", {
      chapter_id: String(chapter.body.id),
      title: "L",
      position: 0,
    });
    const ruleBody = await admin("POST", "access-rules", {
      target_type: "lesson",
      target_id: String(lesson.body.id),
      effect: "deny",
      audience: { type: "learner", learner_id: "staff-1" },
    });
    expect(ruleBody.body.audience).toEqual({ type: "learner", learner_id: "staff-1" });

    const statuses = [
      (
        await t.request("DELETE", `/v1/admin/access-rules/${String(ruleBody.body.id)}`, {
          as: "admin",
        })
      ).status,
      (await t.request("DELETE", `/v1/admin/lessons/${String(lesson.body.id)}`, { as: "admin" }))
        .status,
      (await t.request("DELETE", `/v1/admin/chapters/${String(chapter.body.id)}`, { as: "admin" }))
        .status,
      (await t.request("DELETE", `/v1/admin/courses/${String(course.body.id)}`, { as: "admin" }))
        .status,
      (await t.request("DELETE", `/v1/admin/courses/${String(course.body.id)}`, { as: "admin" }))
        .status,
    ];

    expect(statuses).toEqual([204, 204, 204, 204, 404]);
  });

  it("answers 404 for malformed ids", async () => {
    expect((await t.request("GET", "/v1/admin/lessons/not-a-uuid", { as: "admin" })).status).toBe(
      404,
    );
    expect(
      (await t.request("DELETE", "/v1/admin/access-rules/1%20OR%201=1", { as: "admin" })).status,
    ).toBe(404);
  });
});
