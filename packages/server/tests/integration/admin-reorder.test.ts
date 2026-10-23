import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp, readJson } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

let t: TestApp;

type Tree = { chapters: { id: string; position: number; lessons: { id: string }[] }[] };

async function admin(method: string, path: string, body?: unknown) {
  const response = await t.request(method, `/v1/admin/${path}`, { as: "admin", body });
  return { status: response.status, body: await readJson(response) };
}

async function create(path: string, body: unknown): Promise<string> {
  return String((await admin("POST", path, body)).body.id);
}

/** A course with chapters A (lessons a1, a2) and B (lesson b1). */
async function aCourse(slug: string) {
  const course = await create("courses", { slug, title: slug });
  const chapterA = await create("chapters", { course_id: course, title: "A", position: 0 });
  const chapterB = await create("chapters", { course_id: course, title: "B", position: 1 });
  const lesson = (chapter_id: string, title: string, position: number) =>
    create("lessons", { chapter_id, title, position });
  const a1 = await lesson(chapterA, "a1", 0);
  const a2 = await lesson(chapterA, "a2", 1);
  const b1 = await lesson(chapterB, "b1", 0);
  return { course, chapterA, chapterB, a1, a2, b1 };
}

function outline(tree: unknown) {
  return (tree as Tree).chapters.map((chapter) => ({
    id: chapter.id,
    position: chapter.position,
    lessons: chapter.lessons.map((lesson) => lesson.id),
  }));
}

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.database.drop();
});

describe("POST /v1/admin/reorder", () => {
  it("swaps chapters and moves a lesson to another chapter in one call", async () => {
    const c = await aCourse("reorder-move");

    const response = await admin("POST", "reorder", {
      course_id: c.course,
      chapters: [
        { id: c.chapterB, lesson_ids: [c.a2, c.b1] },
        { id: c.chapterA, lesson_ids: [c.a1] },
      ],
    });

    const expected = [
      { id: c.chapterB, position: 0, lessons: [c.a2, c.b1] },
      { id: c.chapterA, position: 1, lessons: [c.a1] },
    ];
    expect(response.status).toBe(200);
    expect(outline(response.body)).toEqual(expected);
    expect(outline((await admin("GET", `courses/${c.course}`)).body)).toEqual(expected);
  });

  it("is idempotent: sending the stored order again changes nothing", async () => {
    const c = await aCourse("reorder-same");
    const order = {
      course_id: c.course,
      chapters: [
        { id: c.chapterA, lesson_ids: [c.a1, c.a2] },
        { id: c.chapterB, lesson_ids: [c.b1] },
      ],
    };

    const first = await admin("POST", "reorder", order);
    const second = await admin("POST", "reorder", order);

    expect(second).toEqual(first);
  });

  it("serializes concurrent reorders: the result is one of the two orders, never a mix", async () => {
    const c = await aCourse("reorder-race");
    const first = [
      { id: c.chapterB, lesson_ids: [c.b1, c.a1] },
      { id: c.chapterA, lesson_ids: [c.a2] },
    ];
    const second = [
      { id: c.chapterA, lesson_ids: [c.a2, c.a1, c.b1] },
      { id: c.chapterB, lesson_ids: [] },
    ];
    const asOutline = (order: typeof first) =>
      order.map((chapter, position) => ({
        id: chapter.id,
        position,
        lessons: chapter.lesson_ids,
      }));

    const responses = await Promise.all([
      admin("POST", "reorder", { course_id: c.course, chapters: first }),
      admin("POST", "reorder", { course_id: c.course, chapters: second }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect([asOutline(first), asOutline(second)]).toContainEqual(
      outline((await admin("GET", `courses/${c.course}`)).body),
    );
  });

  it("answers 409 tree_out_of_date when a chapter or lesson is missing or unknown", async () => {
    const c = await aCourse("reorder-stale");
    const other = await aCourse("reorder-other");

    const missingLesson = await admin("POST", "reorder", {
      course_id: c.course,
      chapters: [
        { id: c.chapterA, lesson_ids: [c.a1] },
        { id: c.chapterB, lesson_ids: [c.b1] },
      ],
    });
    const foreignLesson = await admin("POST", "reorder", {
      course_id: c.course,
      chapters: [
        { id: c.chapterA, lesson_ids: [c.a1, c.a2, other.a1] },
        { id: c.chapterB, lesson_ids: [c.b1] },
      ],
    });
    const missingChapter = await admin("POST", "reorder", {
      course_id: c.course,
      chapters: [{ id: c.chapterA, lesson_ids: [c.a1, c.a2, c.b1] }],
    });

    for (const response of [missingLesson, foreignLesson, missingChapter]) {
      expect(response).toMatchObject({
        status: 409,
        body: { error: { code: "tree_out_of_date" } },
      });
    }
    expect(outline((await admin("GET", `courses/${c.course}`)).body)).toEqual([
      { id: c.chapterA, position: 0, lessons: [c.a1, c.a2] },
      { id: c.chapterB, position: 1, lessons: [c.b1] },
    ]);
  });

  it("answers 400 when an id appears twice", async () => {
    const c = await aCourse("reorder-twice");

    const response = await admin("POST", "reorder", {
      course_id: c.course,
      chapters: [
        { id: c.chapterA, lesson_ids: [c.a1, c.a2] },
        { id: c.chapterB, lesson_ids: [c.b1, c.a1] },
      ],
    });

    expect(response).toMatchObject({ status: 400, body: { error: { code: "validation_failed" } } });
  });

  it("answers 400 for a malformed body and 404 for an unknown course", async () => {
    const unknown = await admin("POST", "reorder", {
      course_id: "00000000-0000-4000-8000-000000000000",
      chapters: [],
    });
    const malformed = await admin("POST", "reorder", { course_id: "x", chapters: "y" });

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it("refuses non-admins", async () => {
    const c = await aCourse("reorder-learner");

    const response = await t.request("POST", "/v1/admin/reorder", {
      as: "staff",
      body: { course_id: c.course, chapters: [] },
    });

    expect(response.status).toBe(403);
  });
});
