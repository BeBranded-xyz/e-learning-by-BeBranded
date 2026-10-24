import { describe, expect, it } from "vitest";

import {
  FILE_ID,
  OTHER_FILE_ID,
  imageBlock,
  paragraph,
  textProps,
} from "../../tests/fixtures/lesson-documents.js";
import { validateLessonDocument } from "../content/lesson-document.js";
import type { LessonDocument } from "../content/lesson-document.types.js";
import {
  buildCourseExport,
  buildLessonExport,
  countExportBlocks,
  exportImageIds,
  lessonSection,
} from "./export-document.js";
import type { ExportLesson } from "./export-document.js";

const NOW = new Date("2026-10-24T12:00:00.000Z");

function parsed(input: unknown[]): LessonDocument {
  const result = validateLessonDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const lesson = (overrides: Partial<ExportLesson> = {}): ExportLesson => ({
  title: "Fire exits",
  type: "text",
  content: parsed([paragraph("p")]),
  url: "https://host.example.com/training/safety/l1",
  ...overrides,
});

describe("lessonSection", () => {
  it("exports a text lesson's content", () => {
    expect(lessonSection(lesson(), 1)).toMatchObject({
      title: "Fire exits",
      depth: 1,
      blocks: [{ type: "paragraph" }],
    });
  });

  it("starts a video lesson with its title and a link to the lesson, then its notes", () => {
    const section = lessonSection(lesson({ type: "video" }), 2);

    expect(section.blocks.map((block) => block.type)).toEqual(["video", "paragraph"]);
    expect(section.blocks[0]).toEqual({
      type: "video",
      title: "Fire exits",
      url: "https://host.example.com/training/safety/l1",
    });
  });

  it("never exports quiz questions, only notes", () => {
    expect(lessonSection(lesson({ type: "quiz", content: null }), 2).blocks).toEqual([]);
  });
});

describe("buildLessonExport and buildCourseExport", () => {
  it("builds a lesson document with its course as subtitle", () => {
    expect(
      buildLessonExport({ lesson: lesson(), courseTitle: "Safety", locale: "fr", exportedAt: NOW }),
    ).toMatchObject({
      title: "Fire exits",
      subtitle: "Safety",
      locale: "fr",
      exportedAt: "2026-10-24T12:00:00.000Z",
      isCourse: false,
      sections: [{ depth: 1 }],
    });
  });

  it("builds a course: each chapter, then its lessons one level deeper", () => {
    const document = buildCourseExport({
      course: { title: "Safety", summary: "Basics" },
      chapters: [
        { title: "One", lessons: [lesson({ title: "A" }), lesson({ title: "B" })] },
        { title: "Two", lessons: [] },
      ],
      locale: "en",
      exportedAt: NOW,
    });

    expect(document.isCourse).toBe(true);
    expect(document.subtitle).toBe("Basics");
    expect(
      document.sections.map((section) => [section.depth, section.title, section.url !== null]),
    ).toEqual([
      [1, "One", false],
      [2, "A", true],
      [2, "B", true],
      [1, "Two", false],
    ]);
  });
});

describe("walking an export", () => {
  const nestedDocument = buildLessonExport({
    lesson: lesson({
      content: parsed([
        imageBlock("i1", `elearning-file:${OTHER_FILE_ID}`),
        {
          id: "b",
          type: "bulletListItem",
          props: textProps,
          content: [],
          children: [imageBlock("i2", `elearning-file:${FILE_ID}`)],
        },
        {
          id: "c",
          type: "callout",
          props: { backgroundColor: "default", textColor: "default", variant: "info" },
          content: [],
          children: [imageBlock("i3", `elearning-file:${OTHER_FILE_ID}`)],
        },
        paragraph("p", undefined, [imageBlock("i4", `elearning-file:${FILE_ID}`)]),
      ]),
    }),
    courseTitle: "C",
    locale: "en",
    exportedAt: NOW,
  });

  it("finds images nested in lists, callouts and groups, once each, in reading order", () => {
    expect(exportImageIds(nestedDocument)).toEqual([OTHER_FILE_ID, FILE_ID]);
  });

  it("counts every block, list items included", () => {
    // image; list (one item) and its image; callout and its image; paragraph, group and its image
    expect(countExportBlocks(nestedDocument)).toBe(8);
  });
});
