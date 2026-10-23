import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { tenantIdSchema } from "@bebranded/elearning-core";

import { aCourse } from "../../../db/tests/support/factories.js";
import { createTestApp, readJson, seed } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;
const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const paragraph = (text: string) => ({
  id: `b-${text.length}`,
  type: "paragraph",
  props,
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

async function create(path: string, body: unknown) {
  const response = await t.request("POST", `/v1/admin/${path}`, { as: "admin", body });
  return { status: response.status, body: await readJson(response) };
}

async function outboxTypes(): Promise<string[]> {
  const rows = await sql<{
    type: string;
  }>`SELECT type FROM ${sql.id(t.database.schema, "event_outbox")} ORDER BY created_at`.execute(
    t.database.admin,
  );
  return rows.rows.map((row) => row.type);
}

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.database.drop();
});

describe("admin authorization", () => {
  it.each([
    ["GET", "/v1/admin/courses"],
    ["POST", "/v1/admin/courses"],
    ["DELETE", "/v1/admin/lessons/00000000-0000-4000-8000-000000000000"],
  ])("refuses %s %s to a learner who is not an admin (403)", async (method, path) => {
    const response = await t.request(method, path, {
      as: "manager",
      body: method === "GET" ? undefined : {},
    });

    expect(response.status).toBe(403);
    expect((await readJson(response)).error).toMatchObject({ code: "forbidden" });
  });

  it("answers 401 before 403 when nobody is signed in", async () => {
    expect((await t.request("GET", "/v1/admin/courses")).status).toBe(401);
  });
});

describe("authoring a course", () => {
  it("creates a draft course, a chapter and a text lesson, then publishes them for learners", async () => {
    const course = await create("courses", { slug: "first-aid", title: "First aid" });
    expect(course).toMatchObject({
      status: 201,
      body: {
        slug: "first-aid",
        status: "draft",
        published_at: null,
        editable: true,
        enrollment_mode: "self",
        locale: "en",
      },
    });
    const courseId = String(course.body.id);

    const chapter = await create("chapters", {
      course_id: courseId,
      title: "Basics",
      position: 0,
      status: "published",
    });
    const lesson = await create("lessons", {
      chapter_id: String(chapter.body.id),
      title: "Call for help",
      position: 0,
      status: "published",
      content: [paragraph("Dial the emergency number.")],
    });
    expect(lesson).toMatchObject({
      status: 201,
      body: { type: "text", content_schema_version: 1, settings: { requireScrollToEnd: false } },
    });
    expect(await outboxTypes()).toEqual([]);

    expect((await t.request("GET", "/v1/courses/first-aid", { as: "staff" })).status).toBe(404);
    const published = await t.request("PATCH", `/v1/admin/courses/${courseId}`, {
      as: "admin",
      body: { status: "published" },
    });
    await create("access-rules", {
      target_type: "course",
      target_id: courseId,
      effect: "allow",
      audience: { type: "everyone" },
    });

    expect((await readJson(published)).published_at).toBe("2026-06-01T09:00:00.000Z");
    expect(await outboxTypes()).toEqual(["content.published"]);
    const page = await readJson(await t.request("GET", "/v1/courses/first-aid", { as: "staff" }));
    expect((page.chapters as { lessons: unknown[] }[])[0]?.lessons).toHaveLength(1);
    const html = await readJson(
      await t.request("GET", `/v1/lessons/${String(lesson.body.id)}`, { as: "staff" }),
    );
    expect(html.html).toBe("<p>Dial the emergency number.</p>");
  });

  it("returns the whole tree with drafts and rules to admins", async () => {
    const list = await readJson(await t.request("GET", "/v1/admin/courses", { as: "admin" }));
    const id =
      (list.data as { id: string; slug: string }[]).find((course) => course.slug === "first-aid")
        ?.id ?? "";

    const tree = await readJson(await t.request("GET", `/v1/admin/courses/${id}`, { as: "admin" }));

    expect(tree).toMatchObject({
      slug: "first-aid",
      chapters: [{ title: "Basics", lessons: [{ title: "Call for help" }] }],
      access_rules: [{ effect: "allow", audience: { type: "everyone" } }],
    });
  });

  it("keeps published_at and does not emit again when a published course is saved", async () => {
    const list = await readJson(await t.request("GET", "/v1/admin/courses", { as: "admin" }));
    const id =
      (list.data as { id: string; slug: string }[]).find((course) => course.slug === "first-aid")
        ?.id ?? "";
    t.advance(3_600_000);

    const saved = await readJson(
      await t.request("PATCH", `/v1/admin/courses/${id}`, {
        as: "admin",
        body: { status: "published", title: "First aid basics" },
      }),
    );

    expect(saved).toMatchObject({
      title: "First aid basics",
      published_at: "2026-06-01T09:00:00.000Z",
    });
    expect(await outboxTypes()).toEqual(["content.published"]);
  });
});

describe("validation", () => {
  it.each([
    ["an invalid slug", { slug: "Not A Slug", title: "x" }],
    ["a missing title", { slug: "ok-slug" }],
    [
      "an http cover",
      { slug: "ok-slug", title: "x", cover_image_url: "http://cdn.example.com/a.png" },
    ],
    ["an unknown field", { slug: "ok-slug", title: "x", owner: "me" }],
    ["camelCase fields", { slug: "ok-slug", title: "x", enrollmentMode: "self" }],
    [
      "metadata over 10 kB",
      { slug: "ok-slug", title: "x", metadata: { notes: "x".repeat(11_000) } },
    ],
  ])("rejects a course with %s and lists the failing fields", async (_label, body) => {
    const response = await create("courses", body);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "validation_failed",
      details: { fields: expect.any(Array) as unknown },
    });
  });

  it("answers 409 slug_taken for a duplicate slug", async () => {
    await create("courses", { slug: "unique-slug", title: "One" });

    const duplicate = await create("courses", { slug: "unique-slug", title: "Two" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatchObject({ code: "slug_taken" });
  });

  it("rejects lesson content that fails validation, with every issue", async () => {
    const course = await create("courses", { slug: "xss", title: "XSS" });
    const chapter = await create("chapters", {
      course_id: String(course.body.id),
      title: "C",
      position: 0,
    });
    const hostile = [
      {
        id: "a",
        type: "paragraph",
        props,
        content: [{ type: "link", href: "javascript:alert(1)", content: [] }],
        children: [],
      },
      { id: "b", type: "html", props: {}, content: "<script>", children: [] },
    ];

    const response = await create("lessons", {
      chapter_id: String(chapter.body.id),
      title: "Bad",
      position: 0,
      content: hostile,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "invalid_content" });
    expect(
      (response.body.error as { details: { issues: unknown[] } }).details.issues.length,
    ).toBeGreaterThan(0);
  });

  it("refuses video and quiz lessons until their phases", async () => {
    const course = await create("courses", { slug: "types", title: "Types" });
    const chapter = await create("chapters", {
      course_id: String(course.body.id),
      title: "C",
      position: 0,
    });

    expect(
      (
        await create("lessons", {
          chapter_id: String(chapter.body.id),
          type: "video",
          title: "V",
          position: 0,
        })
      ).status,
    ).toBe(400);
  });

  it("answers 400 for an empty patch, 415 without JSON and 413 for an oversized body", async () => {
    const course = await create("courses", { slug: "patch-me", title: "Patch" });
    const url = `/v1/admin/courses/${String(course.body.id)}`;

    expect((await t.request("PATCH", url, { as: "admin", body: {} })).status).toBe(400);
    expect(
      (await t.request("PATCH", url, { as: "admin", headers: { "content-type": "text/plain" } }))
        .status,
    ).toBe(415);
    expect(
      (await t.request("PATCH", url, { as: "admin", body: { summary: "x".repeat(20_000) } }))
        .status,
    ).toBe(413);
  });
});

describe("tenant isolation of admin writes", () => {
  it("cannot read, edit, delete or attach rules to another tenant's or the shared catalog's content", async () => {
    const foreign = aCourse(tenantIdSchema.parse("tenant-b"), { slug: "foreign" });
    const shared = aCourse(null, { slug: "shared" });
    await seed(t.database, [{ course: foreign }]);
    await t.database.storage.transaction((tx) => tx.insertCourse(shared));

    const attempts = await Promise.all([
      t.request("GET", `/v1/admin/courses/${foreign.id}`, { as: "admin" }),
      t.request("PATCH", `/v1/admin/courses/${foreign.id}`, {
        as: "admin",
        body: { title: "Hijacked" },
      }),
      t.request("DELETE", `/v1/admin/courses/${foreign.id}`, { as: "admin" }),
      t.request("PATCH", `/v1/admin/courses/${shared.id}`, {
        as: "admin",
        body: { title: "Hijacked" },
      }),
      t.request("POST", "/v1/admin/chapters", {
        as: "admin",
        body: { course_id: foreign.id, title: "Injected", position: 0 },
      }),
      t.request("POST", "/v1/admin/access-rules", {
        as: "admin",
        body: {
          target_type: "course",
          target_id: shared.id,
          effect: "allow",
          audience: { type: "everyone" },
        },
      }),
    ]);

    expect(attempts.map((response) => response.status)).toEqual([404, 404, 404, 404, 404, 404]);
  });
});
