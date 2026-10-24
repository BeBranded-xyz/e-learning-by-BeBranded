import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createElearning } from "../../src/index.js";
import { fakeFileStorage } from "../support/fake-files.js";
import { createTestApp, readJson } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

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

describe("without a file storage", () => {
  it("answers 500 file_storage_not_configured to an upload", async () => {
    const bare = await createTestApp();
    try {
      const response = await bare.request("POST", "/v1/admin/files/uploads", {
        as: "admin",
        body: { mime_type: "image/png", size_bytes: 1 },
      });

      expect(response.status).toBe(500);
      expect(bare.logs.at(-1)?.meta?.error).toMatchObject({ code: "file_storage_not_configured" });
    } finally {
      await bare.database.drop();
    }
  });
});

describe("when the file storage fails to sign a read URL", () => {
  it("still renders the lesson, without the file, and logs a warning", async () => {
    const failing = fakeFileStorage({ failReads: true });
    const app = await createTestApp({ files: failing.storage });
    try {
      const make = (path: string, body: unknown) =>
        app.request("POST", `/v1/admin/${path}`, { as: "admin", body }).then(readJson);
      const course = await make("courses", { slug: "f", title: "F" });
      await app.request("PATCH", `/v1/admin/courses/${String(course.id)}`, {
        as: "admin",
        body: { status: "published" },
      });
      const chapter = await make("chapters", {
        course_id: course.id,
        title: "C",
        position: 0,
        status: "published",
      });
      await make("access-rules", {
        target_type: "course",
        target_id: course.id,
        effect: "allow",
        audience: { type: "everyone" },
      });
      const file = (await make("files/uploads", { mime_type: "image/png", size_bytes: 1 }))
        .file as Record<string, unknown>;
      const lesson = await make("lessons", {
        chapter_id: chapter.id,
        type: "text",
        title: "T",
        position: 0,
        status: "published",
        content: [image(String(file.url))],
      });

      const response = await app.request("GET", `/v1/lessons/${String(lesson.id)}`, {
        as: "staff",
      });

      expect(response.status).toBe(200);
      expect((await readJson(response)).html).toBe("");
      expect(app.logs).toContainEqual(
        expect.objectContaining({ level: "warn", message: "file read url could not be created" }),
      );
    } finally {
      await app.database.drop();
    }
  });
});

describe("file upload configuration", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.database.drop();
  });

  it.each([["image/svg+xml"], ["text/html"], ["IMAGE/PNG"]])(
    "rejects %s as an allowed type",
    (type) => {
      expect(() =>
        createElearning({
          storage: app.database.storage,
          identity: () => Promise.resolve(null),
          fileUploads: { mimeTypes: [type] },
        }),
      ).toThrow();
    },
  );

  it("applies a host's own limit", async () => {
    const small = await createTestApp({
      files: fakeFileStorage().storage,
      fileUploads: { maxBytes: 100 },
    });
    try {
      const response = await small.request("POST", "/v1/admin/files/uploads", {
        as: "admin",
        body: { mime_type: "image/png", size_bytes: 101 },
      });

      expect(response.status).toBe(413);
    } finally {
      await small.database.drop();
    }
  });
});
