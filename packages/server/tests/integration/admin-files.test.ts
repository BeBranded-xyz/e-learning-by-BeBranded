import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fileIdSchema, learnerIdSchema, tenantIdSchema } from "@bebranded/elearning-core";

import { fakeFileStorage } from "../support/fake-files.js";
import { createTestApp, readJson } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

const files = fakeFileStorage();
let t: TestApp;
let chapterId: string;
let courseId: string;

async function post(path: string, body: unknown, as: "admin" | "staff" = "admin") {
  const response = await t.request("POST", `/v1/admin/${path}`, { as, body });
  return { status: response.status, body: await readJson(response) };
}

async function upload(mimeType = "image/png", sizeBytes = 2_048) {
  return post("files/uploads", { mime_type: mimeType, size_bytes: sizeBytes });
}

async function uploadedUrl(): Promise<string> {
  const response = await upload();
  expect(response.status).toBe(201);
  return String((response.body.file as Record<string, unknown>).url);
}

const image = (url: string) => ({
  id: "img",
  type: "image",
  props: {
    textAlignment: "left",
    backgroundColor: "default",
    name: "chart.png",
    url,
    caption: "Chart",
    showPreview: true,
  },
  children: [],
});

function errorOf(body: Record<string, unknown>): Record<string, unknown> {
  return body.error as Record<string, unknown>;
}

beforeAll(async () => {
  t = await createTestApp({ files: files.storage });
  const course = await post("courses", { slug: "files", title: "Files" });
  courseId = String(course.body.id);
  const chapter = await post("chapters", {
    course_id: courseId,
    title: "C",
    position: 0,
    status: "published",
  });
  chapterId = String(chapter.body.id);
  await post("access-rules", {
    target_type: "course",
    target_id: courseId,
    effect: "allow",
    audience: { type: "everyone" },
  });
  await t.request("PATCH", `/v1/admin/courses/${courseId}`, {
    as: "admin",
    body: { status: "published" },
  });
});

afterAll(async () => {
  await t.database.drop();
});

describe("POST /v1/admin/files/uploads", () => {
  it("answers an upload URL and the url a document stores", async () => {
    const response = await upload("image/webp", 4_096);

    expect(response.status).toBe(201);
    const file = response.body.file as Record<string, unknown>;
    expect(file).toMatchObject({ mime_type: "image/webp", size_bytes: 4_096 });
    expect(file.url).toBe(`elearning-file:${String(file.id)}`);
    const answer = response.body.upload as Record<string, unknown>;
    expect(answer.url).toMatch(/^https:\/\/files\.example\.com\/uploads\/\d+\?put=1$/);
    expect(answer).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/webp" } });
    expect(files.uploads.at(-1)).toEqual({
      tenantId: "tenant-a",
      mimeType: "image/webp",
      sizeBytes: 4_096,
    });
  });

  it("normalizes the MIME type to lowercase", async () => {
    const response = await upload("Application/PDF");

    expect(response.status).toBe(201);
    expect((response.body.file as Record<string, unknown>).mime_type).toBe("application/pdf");
  });

  it.each(["image/svg+xml", "text/html", "application/x-msdownload", "image/png; x=1"])(
    "refuses the type %s with 415 before asking the storage",
    async (mimeType) => {
      const before = files.uploads.length;

      const response = await upload(mimeType);

      expect(response.status).toBe(415);
      expect(errorOf(response.body).code).toBe("file_type_not_allowed");
      expect(files.uploads).toHaveLength(before);
    },
  );

  it("refuses a file over the size limit with 413", async () => {
    const response = await upload("image/png", 10_485_761);

    expect(response.status).toBe(413);
    expect(errorOf(response.body)).toMatchObject({
      code: "file_too_large",
      details: { max_bytes: 10_485_760 },
    });
  });

  it.each([
    ["a zero size", { mime_type: "image/png", size_bytes: 0 }],
    ["a fractional size", { mime_type: "image/png", size_bytes: 1.5 }],
    ["a missing type", { size_bytes: 10 }],
    ["an unknown field", { mime_type: "image/png", size_bytes: 10, key: "../x" }],
  ])("refuses %s with 400", async (_label, body) => {
    const response = await post("files/uploads", body);

    expect(response.status).toBe(400);
    expect(errorOf(response.body).code).toBe("validation_failed");
  });

  it("is admin only", async () => {
    expect(
      (await post("files/uploads", { mime_type: "image/png", size_bytes: 1 }, "staff")).status,
    ).toBe(403);
  });
});

describe("GET /v1/admin/files/:id", () => {
  it("answers a signed read URL for the editor", async () => {
    const url = await uploadedUrl();
    const id = url.replace("elearning-file:", "");

    const response = await t.request("GET", `/v1/admin/files/${id}`, { as: "admin" });

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body).toMatchObject({ id, url, read_url_expires_at: "2026-06-01T10:00:00.000Z" });
    expect(body.read_url).toMatch(/\?sig=read$/);
  });

  it.each(["not-a-uuid", "00000000-0000-4000-8000-000000000000"])(
    "answers 404 for %s",
    async (id) => {
      expect((await t.request("GET", `/v1/admin/files/${id}`, { as: "admin" })).status).toBe(404);
    },
  );
});

describe("documents pointing to files", () => {
  it("stores a lesson with an uploaded image and renders it with a signed URL", async () => {
    const url = await uploadedUrl();
    const lesson = await post("lessons", {
      chapter_id: chapterId,
      type: "text",
      title: "Illustrated",
      position: 0,
      status: "published",
      content: [image(url)],
    });
    expect(lesson.status).toBe(201);

    const response = await t.request("GET", `/v1/lessons/${String(lesson.body.id)}`, {
      as: "staff",
    });

    const html = String((await readJson(response)).html);
    expect(html).toMatch(
      /<img src="https:\/\/files\.example\.com\/uploads\/\d+\?sig=read" alt="Chart"/,
    );
    expect(files.reads.at(-1)?.ttlSeconds).toBe(3_600);
  });

  it("refuses a lesson pointing to a file that was never uploaded", async () => {
    const response = await post("lessons", {
      chapter_id: chapterId,
      type: "text",
      title: "Broken",
      position: 1,
      content: [image("elearning-file:00000000-0000-4000-8000-000000000000")],
    });

    expect(response.status).toBe(400);
    expect(errorOf(response.body)).toMatchObject({
      code: "invalid_content",
      details: { issues: [expect.objectContaining({ code: "unknown_file" })] },
    });
  });

  it("refuses a lesson update pointing to another tenant's file", async () => {
    const other = fileIdSchema.parse("4b1a7c2e-9d3f-4e5a-8b6c-7d8e9f0a1b2c");
    await t.database.storage.transaction((tx) =>
      tx.insertFile(
        { tenantId: tenantIdSchema.parse("tenant-b"), includeShared: false },
        {
          id: other,
          storageKey: "uploads/other-tenant",
          mimeType: "image/png",
          sizeBytes: 1,
          uploadedBy: learnerIdSchema.parse("admin-9"),
          createdAt: new Date("2026-06-01T08:00:00Z"),
        },
      ),
    );
    const lesson = await post("lessons", {
      chapter_id: chapterId,
      type: "text",
      title: "T",
      position: 2,
    });

    const response = await t.request("PATCH", `/v1/admin/lessons/${String(lesson.body.id)}`, {
      as: "admin",
      body: { content: [image(`elearning-file:${other}`)] },
    });

    expect(response.status).toBe(400);
  });

  it("signs the files of quiz context blocks in the learner's survey", async () => {
    const url = await uploadedUrl();
    const lesson = await post("lessons", {
      chapter_id: chapterId,
      type: "quiz",
      title: "Q",
      position: 3,
    });
    const lessonId = String(lesson.body.id);
    const saved = await t.request("PUT", `/v1/admin/lessons/${lessonId}/quiz`, {
      as: "admin",
      body: { document: [image(url), trueFalse()] },
    });
    expect(saved.status).toBe(200);
    await t.request("PATCH", `/v1/admin/lessons/${lessonId}`, {
      as: "admin",
      body: { status: "published" },
    });
    await t.request("POST", `/v1/lessons/${lessonId}/start`, { as: "staff" });

    const attempt = await t.request("POST", `/v1/lessons/${lessonId}/quiz/attempts`, {
      as: "staff",
    });

    expect(attempt.status).toBe(201);
    expect(JSON.stringify(await readJson(attempt))).toMatch(
      /files\.example\.com\/uploads\/\d+\?sig=read/,
    );
  });

  it("refuses a quiz whose context points to an unknown file", async () => {
    const lesson = await post("lessons", {
      chapter_id: chapterId,
      type: "quiz",
      title: "Q2",
      position: 4,
    });

    const saved = await t.request("PUT", `/v1/admin/lessons/${String(lesson.body.id)}/quiz`, {
      as: "admin",
      body: {
        document: [image("elearning-file:00000000-0000-4000-8000-000000000000"), trueFalse()],
      },
    });

    expect(saved.status).toBe(400);
  });
});

function trueFalse() {
  return {
    id: "q1",
    type: "trueFalseQuestion",
    props: { points: 1, explanation: "", answer: true },
    content: [{ type: "text", text: "The sky is blue", styles: {} }],
    children: [],
  };
}
