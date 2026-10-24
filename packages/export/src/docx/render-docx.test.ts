import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type { ExportDocument } from "@bebranded/elearning-core";

import { IMAGE_ID, WEBP_ID, courseExport, lessonExport } from "../../tests/fixtures/documents.js";
import { PNG_1X1, webpHeader } from "../../tests/fixtures/images.js";
import { imageInfo } from "../assets/image-info.js";
import type { InlinedImage } from "../assets/inline-images.js";
import { renderDocx } from "./render-docx.js";

function inlined(bytes: Uint8Array): InlinedImage {
  const info = imageInfo(bytes);
  if (info === null) throw new Error("not an image");
  return { ...info, bytes, dataUri: "data:" };
}

const images = new Map([
  [IMAGE_ID, inlined(PNG_1X1)],
  [WEBP_ID, inlined(webpHeader(10, 10))],
]);

async function unzip(document: ExportDocument, pageSize: "A4" | "Letter" = "A4") {
  const zip = await JSZip.loadAsync(await renderDocx(document, { images, pageSize }));
  const read = (name: string) => zip.file(name)?.async("string") ?? Promise.resolve("");
  return {
    zip,
    document: await read("word/document.xml"),
    numbering: await read("word/numbering.xml"),
    styles: await read("word/styles.xml"),
  };
}

describe("renderDocx", () => {
  it("produces a Word package with a document, styles and numbering", async () => {
    const { zip } = await unzip(lessonExport());

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "word/document.xml",
        "word/styles.xml",
        "word/numbering.xml",
      ]),
    );
  });

  it("uses Word's title and heading styles", async () => {
    const { document } = await unzip(lessonExport());

    expect(document).toContain('<w:pStyle w:val="Title"/>');
    expect(document).toContain('<w:pStyle w:val="Heading1"/>');
  });

  it("keeps inline styles, links and text that looks like XML as plain text", async () => {
    const { document, zip } = await unzip(lessonExport());

    expect(document).toMatch(/<w:b\/>[\s\S]*procedure/);
    expect(document).toContain("&lt;w:t&gt;not xml&lt;/w:t&gt;");
    expect(await zip.file("word/_rels/document.xml.rels")?.async("string")).toContain(
      'Target="https://example.com/guide"',
    );
  });

  it("defines bullet and numbered lists, the numbered one starting at its start", async () => {
    const { document, numbering } = await unzip(lessonExport());

    expect(document).toContain("<w:numPr>");
    expect(numbering).toContain('w:val="bullet"');
    expect(numbering).toMatch(/<w:start w:val="3"\/>/);
    expect(document).toContain("☑ ");
  });

  it("repeats header rows of tables and shades callouts", async () => {
    const { document } = await unzip(lessonExport());

    expect(document).toContain("<w:tblHeader/>");
    expect(document).toContain('w:fill="F7F7F9"');
  });

  it("embeds PNG images and turns WebP images and files into links to the lesson", async () => {
    const { zip, document } = await unzip(lessonExport());

    expect(Object.keys(zip.files).filter((name) => /^word\/media\/.+/.test(name))).toHaveLength(1);
    expect(document).toContain("Floor map");
    expect(document).toContain("photo.webp");
    expect(await zip.file("word/_rels/document.xml.rels")?.async("string")).toContain(
      'Target="https://host.example.com/training/safety/fire"',
    );
  });

  it("styles quotes and code with the module's own styles", async () => {
    const { document, styles } = await unzip(lessonExport());

    expect(styles).toContain('w:styleId="Quote"');
    expect(styles).toContain('w:styleId="Code"');
    expect(document).toContain('<w:pStyle w:val="Code"/>');
    expect(document).toContain("echo two");
  });

  it("builds a course with a table of contents, chapters on new pages and French words", async () => {
    const { document } = await unzip(courseExport());

    expect(document).toContain("TOC \\h");
    expect(document).toContain("Sommaire");
    expect(document).toContain("<w:pageBreakBefore/>");
    expect(document).toContain("Vidéo");
    expect(document).toContain("Exporté le 24 octobre 2026");
  });

  it("sets the page size", async () => {
    expect((await unzip(lessonExport(), "Letter")).document).toContain('w:w="12240"');
    expect((await unzip(lessonExport(), "A4")).document).toContain('w:w="11906"');
  });
});
