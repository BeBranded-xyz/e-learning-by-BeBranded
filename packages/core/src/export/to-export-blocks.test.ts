import { describe, expect, it } from "vitest";

import {
  FILE_ID,
  fileBlock,
  imageBlock,
  paragraph,
  text,
  textProps,
  validDocument,
} from "../../tests/fixtures/lesson-documents.js";
import { validateLessonDocument } from "../content/lesson-document.js";
import type { LessonDocument } from "../content/lesson-document.types.js";
import { toExportBlocks } from "./to-export-blocks.js";

function parsed(input: unknown[]): LessonDocument {
  const result = validateLessonDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const plain = (value: string) => ({ type: "text", text: value, styles: {} });
const exported = (value: string, overrides = {}) => ({
  content: [plain(value)],
  alignment: "left",
  textColor: "default",
  backgroundColor: "default",
  ...overrides,
});

describe("toExportBlocks", () => {
  it("converts every block type of the golden document", () => {
    const blocks = toExportBlocks(parsed(validDocument));

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "group",
      "paragraph",
      "list",
      "list",
      "list",
      "paragraph",
      "group",
      "quote",
      "code",
      "table",
      "divider",
      "callout",
    ]);
  });

  it("expands a toggle heading: the heading, then its children indented", () => {
    const [heading, group] = toExportBlocks(parsed(validDocument));

    expect(heading).toEqual({ type: "heading", level: 2, text: exported("Title") });
    expect(group).toEqual({
      type: "group",
      blocks: [{ type: "paragraph", text: exported("Hello") }],
    });
  });

  it("keeps inline styles and links", () => {
    const [, , paragraphBlock] = toExportBlocks(parsed(validDocument));

    expect(paragraphBlock).toMatchObject({
      text: {
        content: [
          { type: "text", text: "Bold", styles: { bold: true, textColor: "red" } },
          { type: "link", href: "mailto:training@example.com" },
        ],
      },
    });
  });

  it("groups consecutive list items of one type, with the numbered start and check state", () => {
    const blocks = toExportBlocks(
      parsed([
        {
          id: "n1",
          type: "numberedListItem",
          props: { ...textProps, start: 3 },
          content: [text("One")],
          children: [],
        },
        {
          id: "n2",
          type: "numberedListItem",
          props: textProps,
          content: [text("Two")],
          children: [paragraph("x")],
        },
        {
          id: "c1",
          type: "checkListItem",
          props: { ...textProps, checked: true },
          content: [text("Done")],
          children: [],
        },
      ]),
    );

    expect(blocks).toEqual([
      {
        type: "list",
        style: "numbered",
        start: 3,
        items: [
          { text: exported("One"), checked: null, children: [] },
          {
            text: exported("Two"),
            checked: null,
            children: [{ type: "paragraph", text: exported("Hello") }],
          },
        ],
      },
      {
        type: "list",
        style: "check",
        start: 1,
        items: [{ text: exported("Done"), checked: true, children: [] }],
      },
    ]);
  });

  it("marks header cells by row and column and keeps spans", () => {
    const table = toExportBlocks(parsed(validDocument)).find((block) => block.type === "table");

    expect(table).toEqual({
      type: "table",
      headerRows: 1,
      rows: [
        [
          { content: [plain("A")], header: true, colspan: 1, rowspan: 1 },
          { content: [plain("B")], header: true, colspan: 1, rowspan: 1 },
        ],
        [
          { content: [plain("1")], header: false, colspan: 1, rowspan: 1 },
          { content: [plain("2")], header: false, colspan: 1, rowspan: 1 },
        ],
      ],
    });
  });

  it("keeps code text and the callout variant", () => {
    const blocks = toExportBlocks(parsed(validDocument));

    expect(blocks.find((block) => block.type === "code")).toEqual({
      type: "code",
      language: "typescript",
      code: "const a = 1;",
    });
    expect(blocks.find((block) => block.type === "callout")).toMatchObject({
      variant: "danger",
      children: [],
    });
  });

  it("exports uploaded images and files, and skips unfinished uploads", () => {
    const url = `elearning-file:${FILE_ID}`;
    const blocks = toExportBlocks(
      parsed([
        imageBlock("i", url, { caption: "Chart", previewWidth: 400, textAlignment: "center" }),
        imageBlock("j", url, { showPreview: false }),
        fileBlock("f", url),
        imageBlock("e", ""),
        fileBlock("g", ""),
      ]),
    );

    expect(blocks).toEqual([
      {
        type: "image",
        fileId: FILE_ID,
        name: "diagram.png",
        caption: "Chart",
        width: 400,
        alignment: "center",
      },
      { type: "file", fileId: FILE_ID, name: "diagram.png", caption: "" },
      { type: "file", fileId: FILE_ID, name: "handbook.pdf", caption: "" },
    ]);
  });

  it("leaves an image width to the page when the author did not set one", () => {
    const [image] = toExportBlocks(parsed([imageBlock("i", `elearning-file:${FILE_ID}`)]));

    expect(image).toMatchObject({ width: null, alignment: "left" });
  });

  it("converts an empty document to nothing", () => {
    expect(toExportBlocks([])).toEqual([]);
  });
});
