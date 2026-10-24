import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { learnerIdSchema } from "@bebranded/elearning-core";
import type { Chapter, Course, LessonDetail } from "@bebranded/elearning-core";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { fakeFileStorage } from "../support/fake-files.js";
import { EXPORT_IMAGE, recordingExporter } from "../support/recording-exporter.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { LearnerName, TestApp } from "../support/test-app.js";

const scope = { tenantId: tenant, includeShared: false };
const FILE = EXPORT_IMAGE;
const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const paragraph = (id: string, text: string) => ({
  id,
  type: "paragraph",
  props,
  content: [{ type: "text", text, styles: {} }],
  children: [],
});
const image = {
  id: "img",
  type: "image",
  props: {
    textAlignment: "left",
    backgroundColor: "default",
    name: "map.png",
    url: `elearning-file:${FILE}`,
    caption: "",
    showPreview: true,
  },
  children: [],
};

const recorder = recordingExporter();
let t: TestApp;
let open: Course;
let closed: Course;
let chapter: Chapter;
let text: LessonDetail;
let draft: LessonDetail;
let quiz: LessonDetail;
let hidden: LessonDetail;

function get(path: string, as: LearnerName = "staff") {
  return t.request("GET", path, { as });
}

beforeAll(async () => {
  const files = fakeFileStorage();
  t = await createTestApp({
    exporter: recorder.exporter,
    files: { ...files.storage, read: () => Promise.resolve(new Uint8Array([1, 2, 3])) },
    exportLessonUrl: ({ courseSlug, lessonId }) =>
      `https://host.example.com/training/${courseSlug}/${lessonId}`,
  });
  open = aCourse(tenant, { slug: "exportable", title: "Exportable", allowLearnerExport: true });
  closed = aCourse(tenant, { slug: "locked", title: "Locked" });
  chapter = aChapter(open, { title: "Basics" });
  const closedChapter = aChapter(closed);
  text = aLesson(chapter, {
    title: "Read me",
    position: 0,
    content: [paragraph("p", "Know your exits."), image],
  });
  draft = aLesson(chapter, {
    title: "Draft lesson",
    position: 1,
    status: "draft",
    content: [paragraph("d", "Not yet")],
  });
  quiz = aLesson(chapter, {
    title: "Check",
    type: "quiz",
    position: 2,
    content: null,
    settings: {},
  });
  hidden = aLesson(chapter, {
    title: "Managers only",
    position: 3,
    content: [paragraph("h", "Secret")],
  });
  await seed(t.database, [
    {
      course: open,
      chapters: [chapter],
      lessons: [text, draft, quiz, hidden],
      rules: [
        rule(open, "course", "allow"),
        rule(hidden, "lesson", "allow", { type: "role", role: "manager" }),
      ],
    },
    {
      course: closed,
      chapters: [closedChapter],
      lessons: [aLesson(closedChapter)],
      rules: [rule(closed, "course", "allow")],
    },
  ]);
  await t.database.storage.transaction((tx) =>
    tx.insertFile(scope, {
      id: FILE,
      storageKey: "uploads/map",
      mimeType: "image/png",
      sizeBytes: 3,
      uploadedBy: learnerIdSchema.parse("admin-1"),
      createdAt: new Date("2026-06-01T08:00:00Z"),
    }),
  );
});

afterAll(async () => {
  await t.database.drop();
});

const last = () => recorder.documents.at(-1);

describe("GET /v1/lessons/:id/export", () => {
  it("streams the file as an attachment and never caches it", async () => {
    const response = await get(`/v1/lessons/${text.id}/export?format=pdf`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="exportable-${text.id.slice(0, 8)}.pdf"`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("FILE");
  });

  it("builds the lesson from its content, with the host's link and its course", async () => {
    await get(`/v1/lessons/${text.id}/export?format=docx`);

    expect(last()).toMatchObject({ title: "Read me", subtitle: "Exportable", isCourse: false });
    expect(last()?.sections[0]).toMatchObject({
      url: `https://host.example.com/training/exportable/${text.id}`,
      blocks: [{ type: "paragraph" }, { type: "image", fileId: FILE }],
    });
  });

  it("reads images through the file storage", async () => {
    await get(`/v1/lessons/${text.id}/export?format=pdf`);

    expect([...(recorder.images.at(-1) ?? [])]).toEqual([1, 2, 3]);
  });

  it("never exports quiz questions", async () => {
    await get(`/v1/lessons/${quiz.id}/export?format=pdf`);

    expect(last()?.sections[0]?.blocks).toEqual([]);
  });

  it.each([
    ["a draft lesson", () => draft.id],
    ["a lesson the learner cannot see", () => hidden.id],
    ["an unknown lesson", () => "00000000-0000-4000-8000-000000000000"],
  ])("answers 404 to a learner for %s", async (_label, id) => {
    expect((await get(`/v1/lessons/${id()}/export?format=pdf`)).status).toBe(404);
  });

  it("lets an admin export a draft", async () => {
    expect((await get(`/v1/lessons/${draft.id}/export?format=pdf`, "admin")).status).toBe(200);
  });

  it("answers 403 export_not_allowed to a learner when the course does not allow it", async () => {
    const [lesson] = await t.database.storage.listLessons(scope, [closed.id]);
    const response = await get(`/v1/lessons/${lesson?.id ?? ""}/export?format=pdf`);

    expect(response.status).toBe(403);
    expect((await readJson(response)).error).toMatchObject({ code: "export_not_allowed" });
    expect((await get(`/v1/lessons/${lesson?.id ?? ""}/export?format=pdf`, "admin")).status).toBe(
      200,
    );
  });

  it.each([[""], ["?format=html"], ["?format=PDF"]])(
    "answers 400 to the query %j",
    async (query) => {
      const response = await get(`/v1/lessons/${text.id}/export${query}`);

      expect(response.status).toBe(400);
      expect((await readJson(response)).error).toMatchObject({ code: "validation_failed" });
    },
  );
});

describe("GET /v1/courses/:id/export", () => {
  it("exports every lesson the learner can open, chapter by chapter", async () => {
    const response = await get(`/v1/courses/${open.id}/export?format=pdf`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="exportable.pdf"',
    );
    expect(last()?.sections.map((section) => section.title)).toEqual([
      "Basics",
      "Read me",
      "Check",
    ]);
  });

  it("gives the manager the lesson reserved to managers", async () => {
    await get(`/v1/courses/${open.id}/export?format=pdf`, "manager");

    expect(last()?.sections.map((section) => section.title)).toContain("Managers only");
  });

  it("gives an admin the whole tree, drafts included", async () => {
    await get(`/v1/courses/${open.id}/export?format=docx`, "admin");

    expect(last()?.sections.map((section) => section.title)).toEqual([
      "Basics",
      "Read me",
      "Draft lesson",
      "Check",
      "Managers only",
    ]);
    expect(last()).toMatchObject({ isCourse: true, title: "Exportable" });
  });

  it("answers 404 to another tenant and 403 when learners may not export", async () => {
    expect((await get(`/v1/courses/${open.id}/export?format=pdf`, "otherTenant")).status).toBe(404);
    expect((await get(`/v1/courses/${closed.id}/export?format=pdf`)).status).toBe(403);
  });
});

describe("export formats on the course page", () => {
  it("lists the formats only where the requester may export", async () => {
    const formats = async (slug: string, as: LearnerName) =>
      (await readJson(await get(`/v1/courses/${slug}`, as))).export_formats;

    expect(await formats("exportable", "staff")).toEqual(["pdf", "docx"]);
    expect(await formats("locked", "staff")).toEqual([]);
  });
});

describe("allow_learner_export in the admin API", () => {
  it("defaults to false and can be turned on", async () => {
    const created = await readJson(
      await t.request("POST", "/v1/admin/courses", {
        as: "admin",
        body: { slug: "new-one", title: "New" },
      }),
    );
    expect(created.allow_learner_export).toBe(false);

    const updated = await readJson(
      await t.request("PATCH", `/v1/admin/courses/${String(created.id)}`, {
        as: "admin",
        body: { allow_learner_export: true },
      }),
    );

    expect(updated.allow_learner_export).toBe(true);
  });
});
