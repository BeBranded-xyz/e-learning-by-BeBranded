import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  buildCourseExport,
  buildLessonExport,
  validateLessonDocument,
} from "@bebranded/elearning-core";

import { IMAGE_ID } from "../../tests/fixtures/documents.js";
import { pngHeader } from "../../tests/fixtures/images.js";
import { imageInfo } from "../assets/image-info.js";
import { renderDocx } from "./render-docx.js";

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const text = (value: string, styles: Record<string, unknown> = {}) => ({
  type: "text",
  text: value,
  styles,
});

const source = [
  {
    id: "p",
    type: "paragraph",
    props: { backgroundColor: "yellow", textColor: "default", textAlignment: "justify" },
    content: [
      text("red", { textColor: "red" }),
      text("marked", { backgroundColor: "green", underline: true, code: true }),
      text("one\ntwo", { italic: true, strike: true }),
    ],
    children: [
      {
        id: "n",
        type: "bulletListItem",
        props,
        content: [text("nested item")],
        children: [
          { id: "d", type: "bulletListItem", props, content: [text("deeper")], children: [] },
        ],
      },
    ],
  },
  {
    id: "i",
    type: "image",
    props: {
      textAlignment: "right",
      backgroundColor: "default",
      name: "wide.png",
      url: `elearning-file:${IMAGE_ID}`,
      caption: "",
      showPreview: true,
      previewWidth: 300,
    },
    children: [],
  },
  {
    id: "j",
    type: "image",
    props: {
      textAlignment: "left",
      backgroundColor: "default",
      name: "",
      url: "elearning-file:0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70",
      caption: "Gone",
      showPreview: true,
    },
    children: [],
  },
  {
    id: "t",
    type: "toggleListItem",
    props,
    content: [text("Details")],
    children: [
      { id: "tp", type: "paragraph", props, content: [text("indented line")], children: [] },
    ],
  },
  {
    id: "co",
    type: "callout",
    props: { backgroundColor: "default", textColor: "default", variant: "info" },
    content: [text("Table inside")],
    children: [
      {
        id: "tb",
        type: "table",
        props: { textColor: "default" },
        content: {
          type: "tableContent",
          columnWidths: [null],
          rows: [{ cells: [[text("cell in callout")]] }],
        },
        children: [],
      },
    ],
  },
  {
    id: "f",
    type: "file",
    props: {
      backgroundColor: "default",
      name: "",
      url: `elearning-file:${IMAGE_ID}`,
      caption: "Read me",
    },
    children: [],
  },
];

async function documentXml(lessonUrl: string) {
  const content = validateLessonDocument(source);
  if (!content.ok) throw new Error(JSON.stringify(content.error));
  const document = buildLessonExport({
    lesson: { title: "Styles", type: "text", content: content.value, url: lessonUrl },
    courseTitle: "C",
    locale: "en",
    exportedAt: new Date("2026-10-24T00:00:00Z"),
  });
  const wide = pngHeader(1200, 600);
  const info = imageInfo(wide);
  if (info === null) throw new Error("not an image");
  const images = new Map([[IMAGE_ID, { ...info, bytes: wide, dataUri: "" }]]);
  const zip = await JSZip.loadAsync(await renderDocx(document, { images, pageSize: "A4" }));
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

describe("renderDocx structure", () => {
  it("indents a toggle's children and keeps a table inside a callout", async () => {
    const xml = await documentXml("https://host.example.com/l");

    expect(xml).toMatch(/<w:ind w:left="720"\/>[\s\S]*indented line/);
    expect(xml).toContain("cell in callout");
  });

  it("writes a course cover without subtitle when the course has no summary", async () => {
    const document = buildCourseExport({
      course: { title: "No summary", summary: null },
      chapters: [],
      locale: "en",
      exportedAt: new Date("2026-10-24T00:00:00Z"),
    });
    const zip = await JSZip.loadAsync(
      await renderDocx(document, { images: new Map(), pageSize: "Letter" }),
    );

    expect(await zip.file("word/document.xml")?.async("string")).toContain("No summary");
  });
});

describe("renderDocx styling", () => {
  it("maps colors, highlights, underline, code, italics, strike and line breaks to runs", async () => {
    const xml = await documentXml("https://host.example.com/l");

    expect(xml).toContain('w:color w:val="B91C1C"');
    expect(xml).toContain('w:fill="DCFCE7"');
    expect(xml).toContain('w:fill="FEF9C3"');
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('w:ascii="Consolas"');
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:strike/>");
    expect(xml).toContain("<w:br/>");
    expect(xml).toContain('<w:jc w:val="both"/>');
  });

  it("indents nested blocks and nests lists one level deeper", async () => {
    const xml = await documentXml("https://host.example.com/l");

    expect(xml).toMatch(/<w:ilvl w:val="1"\/>[\s\S]*nested item/);
    expect(xml).toMatch(/<w:ilvl w:val="2"\/>[\s\S]*deeper/);
  });

  it("scales an image to its preview width and keeps its ratio", async () => {
    const xml = await documentXml("https://host.example.com/l");

    // 300 px wide, 150 px high, in EMU (9525 per pixel).
    expect(xml).toContain('cx="2857500" cy="1428750"');
    expect(xml).toContain('<w:jc w:val="right"/>');
  });

  it("names a missing image and an unnamed file, with their captions", async () => {
    const xml = await documentXml("https://host.example.com/l");

    expect(xml).toContain("Attachment: ");
    expect(xml).toContain(">image<");
    expect(xml).toContain(">file<");
    expect(xml).toContain("Read me");
    expect(xml).toContain("Gone");
  });
});
