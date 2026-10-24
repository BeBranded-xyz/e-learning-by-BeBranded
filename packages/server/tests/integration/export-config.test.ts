import { describe, expect, it } from "vitest";

import type { Chapter, Course, LessonDetail } from "@bebranded/elearning-core";
import { elearningExport } from "@bebranded/elearning-export";

import { aChapter, aCourse, aLesson } from "../../../db/tests/support/factories.js";
import { recordingExporter } from "../support/recording-exporter.js";
import { createTestApp, readJson, rule, seed, tenant } from "../support/test-app.js";
import type { TestApp } from "../support/test-app.js";

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const open: Course = aCourse(tenant, {
  slug: "exportable",
  title: "Exportable",
  allowLearnerExport: true,
});
const chapter: Chapter = aChapter(open);
const text: LessonDetail = aLesson(chapter, {
  content: [
    {
      id: "p",
      type: "paragraph",
      props,
      content: [{ type: "text", text: "Hi", styles: {} }],
      children: [],
    },
  ],
});

/** A fresh app with one exportable lesson, dropped after the test. */
async function withApp(
  options: Parameters<typeof createTestApp>[0],
  test: (app: TestApp) => Promise<void>,
) {
  const app = await createTestApp(options);
  try {
    await seed(app.database, [
      {
        course: open,
        chapters: [chapter],
        lessons: [text],
        rules: [rule(open, "course", "allow")],
      },
    ]);
    await test(app);
  } finally {
    await app.database.drop();
  }
}

const exportPdf = (app: TestApp) =>
  app.request("GET", `/v1/lessons/${text.id}/export?format=pdf`, { as: "staff" });

describe("export configuration and limits", () => {
  it("answers 409 export_not_configured without an exporter, and lists no format", async () => {
    await withApp({}, async (app) => {
      const response = await exportPdf(app);
      const course = await readJson(
        await app.request("GET", "/v1/courses/exportable", { as: "staff" }),
      );

      expect(response.status).toBe(409);
      expect((await readJson(response)).error).toMatchObject({ code: "export_not_configured" });
      expect(course.export_formats).toEqual([]);
      const lesson = await readJson(
        await app.request("GET", `/v1/lessons/${text.id}`, { as: "admin" }),
      );
      expect(lesson.export_formats).toEqual([]);
    });
  });

  it("lists only the formats the exporter has", async () => {
    await withApp({ exporter: recordingExporter(["docx"]).exporter }, async (app) => {
      const lesson = await readJson(
        await app.request("GET", `/v1/lessons/${text.id}`, { as: "staff" }),
      );
      expect(lesson.export_formats).toEqual(["docx"]);
    });
  });

  it("answers 400 export_format_unavailable for a format the exporter lacks", async () => {
    await withApp({ exporter: recordingExporter(["docx"]).exporter }, async (app) => {
      expect((await readJson(await exportPdf(app))).error).toMatchObject({
        code: "export_format_unavailable",
      });
    });
  });

  it("refuses a second export of the same tenant while one runs, with 429", async () => {
    const slow = recordingExporter();
    await withApp({ exporter: slow.exporter, exportsPerTenant: 1 }, async (app) => {
      let release: () => void = () => undefined;
      slow.holdUntil(
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      const first = exportPdf(app);
      await slow.firstStarted;

      const second = await exportPdf(app);
      release();

      expect(second.status).toBe(429);
      expect((await first).status).toBe(200);
    });
  });

  it("produces a real Word file with elearningExport", async () => {
    await withApp({ exporter: elearningExport() }, async (app) => {
      const response = await app.request("GET", `/v1/lessons/${text.id}/export?format=docx`, {
        as: "staff",
      });

      expect(response.headers.get("content-type")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 2)]).toEqual([0x50, 0x4b]);
    });
  });
});
