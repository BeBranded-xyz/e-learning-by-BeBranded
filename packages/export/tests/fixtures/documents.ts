import {
  buildCourseExport,
  buildLessonExport,
  fileIdSchema,
  validateLessonDocument,
} from "@bebranded/elearning-core";
import type { ExportDocument, LessonDocument } from "@bebranded/elearning-core";

// Synthetic export documents: every block type, fake titles and links only.

export const IMAGE_ID = fileIdSchema.parse("6f1c2a4e-1b7d-4c3a-9f2e-0a1b2c3d4e5f");
export const WEBP_ID = fileIdSchema.parse("0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70");
const NOW = new Date("2026-10-24T12:00:00.000Z");

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const text = (value: string, styles: Record<string, unknown> = {}) => ({
  type: "text",
  text: value,
  styles,
});
const block = (
  id: string,
  type: string,
  content: unknown,
  extra: Record<string, unknown> = {},
) => ({
  id,
  type,
  props: { ...props, ...extra },
  content,
  children: [],
});

const source: unknown[] = [
  block("h1", "heading", [text("Before you start")], { level: 1 }),
  block("p1", "paragraph", [
    text("Read the "),
    text("procedure", { bold: true }),
    text(" <w:t>not xml</w:t> and "),
    { type: "link", href: "https://example.com/guide", content: [text("the guide")] },
  ]),
  block("b1", "bulletListItem", [text("Exit route")]),
  block("b2", "bulletListItem", [text("Meeting point")]),
  block("n1", "numberedListItem", [text("Raise the alarm")], { start: 3 }),
  block("c1", "checkListItem", [text("Badge returned")], { checked: true }),
  {
    id: "q1",
    type: "quote",
    props: { backgroundColor: "default", textColor: "default" },
    content: [text("Safety first")],
    children: [],
  },
  {
    id: "k1",
    type: "codeBlock",
    props: { language: "sh" },
    content: [text("echo one\necho two")],
    children: [],
  },
  {
    id: "t1",
    type: "table",
    props: { textColor: "default" },
    content: {
      type: "tableContent",
      columnWidths: [null, null],
      headerRows: 1,
      rows: [
        { cells: [[text("Name")], [text("Floor")]] },
        { cells: [[text("Exit A")], [text("1")]] },
      ],
    },
    children: [],
  },
  { id: "d1", type: "divider", props: {}, children: [] },
  {
    id: "co",
    type: "callout",
    props: { backgroundColor: "default", textColor: "default", variant: "warning" },
    content: [text("Never use lifts")],
    children: [],
  },
  {
    id: "i1",
    type: "image",
    props: {
      textAlignment: "center",
      backgroundColor: "default",
      name: "map.png",
      url: `elearning-file:${IMAGE_ID}`,
      caption: "Floor map",
      showPreview: true,
    },
    children: [],
  },
  {
    id: "i2",
    type: "image",
    props: {
      textAlignment: "left",
      backgroundColor: "default",
      name: "photo.webp",
      url: `elearning-file:${WEBP_ID}`,
      caption: "",
      showPreview: true,
    },
    children: [],
  },
  {
    id: "f1",
    type: "file",
    props: {
      backgroundColor: "default",
      name: "plan.pdf",
      url: `elearning-file:${IMAGE_ID}`,
      caption: "",
    },
    children: [],
  },
];

function goldenContent(): LessonDocument {
  const result = validateLessonDocument(source);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

export function lessonExport(locale = "en"): ExportDocument {
  return buildLessonExport({
    lesson: {
      title: "Fire safety",
      type: "text",
      content: goldenContent(),
      url: "https://host.example.com/training/safety/fire",
    },
    courseTitle: "Workplace safety",
    locale,
    exportedAt: NOW,
  });
}

export function courseExport(): ExportDocument {
  return buildCourseExport({
    course: { title: "Workplace safety", summary: "Everything on day one" },
    chapters: [
      {
        title: "Basics",
        lessons: [
          {
            title: "Fire safety",
            type: "text",
            content: goldenContent(),
            url: "https://host.example.com/l/1",
          },
          {
            title: "Evacuation video",
            type: "video",
            content: null,
            url: "https://host.example.com/l/2",
          },
        ],
      },
    ],
    locale: "fr",
    exportedAt: NOW,
  });
}
