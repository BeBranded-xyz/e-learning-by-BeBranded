import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildLessonExport, validateLessonDocument } from "@bebranded/elearning-core";

import { IMAGE_ID } from "../../tests/fixtures/documents.js";
import { pngHeader } from "../../tests/fixtures/images.js";
import { imageInfo } from "../assets/image-info.js";
import { renderDocx } from "./render-docx.js";

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const paragraph = (id: string, text: string) => ({
  id,
  type: "paragraph",
  props,
  content: [{ type: "text", text, styles: {} }],
  children: [],
});
const table = {
  id: "t",
  type: "table",
  props: { textColor: "default" },
  content: {
    type: "tableContent",
    columnWidths: [null],
    headerRows: 0,
    rows: [
      {
        cells: [
          {
            type: "tableCell",
            content: [],
            props: {
              backgroundColor: "default",
              textColor: "default",
              textAlignment: "left",
              colspan: 1,
              rowspan: 1,
            },
          },
        ],
      },
    ],
  },
  children: [],
};
const image = {
  id: "i",
  type: "image",
  props: {
    textAlignment: "left",
    backgroundColor: "default",
    name: "wide.png",
    url: `elearning-file:${IMAGE_ID}`,
    caption: "",
    showPreview: true,
  },
  children: [],
};

async function documentXml(source: unknown[]) {
  const content = validateLessonDocument(source);
  if (!content.ok) throw new Error(JSON.stringify(content.error));
  const exported = buildLessonExport({
    lesson: { title: "L", type: "text", content: content.value, url: "https://host.example.com/l" },
    courseTitle: "C",
    locale: "en",
    exportedAt: new Date("2026-10-24T00:00:00Z"),
  });
  const bytes = pngHeader(4000, 1000);
  const info = imageInfo(bytes);
  if (info === null) throw new Error("not an image");
  const images = new Map([[IMAGE_ID, { ...info, bytes, dataUri: "data:" }]]);
  const zip = await JSZip.loadAsync(await renderDocx(exported, { images, pageSize: "A4" }));
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

const columns = (...children: unknown[]) => [{ id: "l", type: "columnList", props: {}, children }];
const column = (id: string, width: number, blocks: unknown[]) => ({
  id,
  type: "column",
  props: { width },
  children: blocks,
});

describe("columns in Word", () => {
  it("become a borderless one-row table whose cells take each column's share", async () => {
    const xml = await documentXml(
      columns(column("a", 3, [paragraph("p", "Wide")]), column("b", 1, [paragraph("q", "Narrow")])),
    );

    expect(xml.match(/<w:tc>/g)).toHaveLength(2);
    expect(xml).toContain('<w:tcW w:type="pct" w:w="75%"/>');
    expect(xml).toContain('<w:tcW w:type="pct" w:w="25%"/>');
    expect(xml).toMatch(/<w:tblBorders>.*<w:insideV w:val="none"/s);
    expect(xml.indexOf("Wide")).toBeLessThan(xml.indexOf("Narrow"));
  });

  it("end every cell with a paragraph, as Word requires, even after a table", async () => {
    const xml = await documentXml(
      columns(column("a", 1, [table]), column("b", 1, [paragraph("q", "x")])),
    );

    expect(xml).toMatch(/<\/w:tbl><w:p\/?>(<w:pPr>.*?<\/w:pPr>)?(<\/w:p>)?<\/w:tc>/s);
  });

  it("scale pictures to the column, not the page", async () => {
    const xml = await documentXml(
      columns(column("a", 1, [image]), column("b", 1, [paragraph("q", "x")])),
    );
    const full = await documentXml([image]);
    const extent = (source: string) => Number(/<wp:extent cx="(\d+)"/.exec(source)?.[1]);

    expect(extent(xml)).toBeGreaterThan(0);
    expect(extent(xml)).toBeLessThanOrEqual(Math.ceil(extent(full) / 2));
  });
});
