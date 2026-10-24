import { describe, expect, it } from "vitest";

import {
  buildCourseExport,
  buildLessonExport,
  fileIdSchema,
  toExportBlocks,
  validateLessonDocument,
} from "@bebranded/elearning-core";
import type { ExportDocument, LessonDocument } from "@bebranded/elearning-core";

import { everyBlock } from "../../tests/fixtures/documents.js";
import { renderExportHtml } from "./render-export-html.js";
import type { ExportHtmlOptions } from "./render-export-html.js";

const FILE = fileIdSchema.parse("6f1c2a4e-1b7d-4c3a-9f2e-0a1b2c3d4e5f");
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const NOW = new Date("2026-10-24T12:00:00.000Z");
const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" } as const;

const options = (overrides: Partial<ExportHtmlOptions> = {}): ExportHtmlOptions => ({
  imageSrc: (id) => (id === FILE ? PNG : undefined),
  pageSize: "A4",
  labels: {
    tableOfContents: "Contents",
    video: "Video",
    attachment: "Attachment",
    exportedOn: "Exported on Oct 24, 2026",
  },
  ...overrides,
});

function lessonDoc(document: LessonDocument, type: "text" | "video" = "text"): ExportDocument {
  return buildLessonExport({
    lesson: { title: "Fire <exits>", type, content: document, url: "https://host.example.com/l/1" },
    courseTitle: "Safety",
    locale: "en",
    exportedAt: NOW,
  });
}

const paragraph = (text: string): LessonDocument[number] => ({
  id: "p",
  type: "paragraph",
  props,
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

describe("renderExportHtml", () => {
  it("renders every block type as a complete document with print CSS", () => {
    const html = renderExportHtml(lessonDoc(everyBlock), options());

    expect(
      html.startsWith(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fire &lt;exits&gt;</title>',
      ),
    ).toBe(true);
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain(
      '<header><h1>Fire &lt;exits&gt;</h1><p class="el-meta">Safety</p></header>',
    );
    expect(html).toContain("<h2>Safety basics</h2>");
    expect(html).toContain('<div class="el-callout" data-variant="warning">');
    expect(html).toContain("<pre><code>echo &lt;hello&gt;</code></pre>");
    expect(html).not.toMatch(/<script|<details|<input/);
  });

  it("puts header rows in thead, so they repeat on every page, and keeps spans", () => {
    const cell = (text: string, colspan?: number) => ({
      type: "tableCell" as const,
      props: { ...props, ...(colspan === undefined ? {} : { colspan }) },
      content: [{ type: "text" as const, text, styles: {} }],
    });
    const table: LessonDocument[number] = {
      id: "t",
      type: "table",
      props: { textColor: "default" },
      content: {
        type: "tableContent",
        columnWidths: [null, null],
        headerRows: 1,
        rows: [{ cells: [cell("Name", 2)] }, { cells: [cell("A"), cell("1")] }],
      },
      children: [],
    };

    expect(renderExportHtml(lessonDoc([table]), options())).toContain(
      '<table><thead><tr><th colspan="2">Name</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>',
    );
  });

  it("renders a table without header rows as a body only", () => {
    expect(renderExportHtml(lessonDoc(everyBlock), options())).toMatch(
      /<table><tbody><tr><td>Name<\/td>/,
    );
  });

  it("inlines uploaded images and turns images that could not be inlined into attachment lines", () => {
    const image = (id: string) => ({
      id,
      type: "image" as const,
      props: {
        textAlignment: "center" as const,
        backgroundColor: "default" as const,
        name: "chart.png",
        url: `elearning-file:${id === "a" ? FILE : "0d9e8f7a-6b5c-4d3e-8f1a-2b3c4d5e6f70"}`,
        caption: "Q3",
        showPreview: true,
        previewWidth: 300,
      },
      children: [],
    });
    const html = renderExportHtml(lessonDoc([image("a"), image("b")]), options());

    expect(html).toContain(
      `<figure data-text-alignment="center"><img src="${PNG}" alt="Q3" width="300" /><figcaption>Q3</figcaption></figure>`,
    );
    expect(html).toContain(
      '<p class="el-file"><a href="https://host.example.com/l/1">Attachment: chart.png</a></p>',
    );
  });

  it("drops an image whose source is not an inlined picture, so the browser fetches nothing", () => {
    const document = lessonDoc([
      {
        id: "i",
        type: "image",
        props: {
          textAlignment: "left",
          backgroundColor: "default",
          name: "x",
          url: `elearning-file:${FILE}`,
          caption: "",
          showPreview: true,
        },
        children: [],
      },
    ]);

    for (const source of [
      "https://internal.example.com/a.png",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "javascript:alert(1)",
    ]) {
      expect(renderExportHtml(document, options({ imageSrc: () => source }))).not.toContain("<img");
    }
  });

  it("links a video lesson to its page", () => {
    expect(renderExportHtml(lessonDoc([], "video"), options())).toContain(
      '<p class="el-video">Video: <a href="https://host.example.com/l/1">Fire &lt;exits&gt;</a></p>',
    );
  });

  it("builds a course with a cover, a table of contents and shifted headings", () => {
    const content = validateLessonDocument([
      {
        id: "h",
        type: "heading",
        props: { ...props, level: 1 },
        content: [{ type: "text", text: "Inside", styles: {} }],
        children: [],
      },
    ]);
    if (!content.ok) throw new Error("invalid");
    const course = buildCourseExport({
      course: { title: "Safety", summary: "All the basics" },
      chapters: [
        {
          title: "One",
          lessons: [
            {
              title: "A",
              type: "text",
              content: content.value,
              url: "https://host.example.com/l/a",
            },
          ],
        },
      ],
      locale: "fr-FR",
      exportedAt: NOW,
    });

    const html = renderExportHtml(course, options({ logo: PNG }));

    expect(html).toContain('<html lang="fr-FR">');
    expect(html).toContain(
      `<section class="el-cover"><img src="${PNG}" alt="" /><h1>Safety</h1><p class="el-meta">All the basics</p><p class="el-meta">Exported on Oct 24, 2026</p></section>`,
    );
    expect(html).toContain(
      '<nav class="el-toc"><h2>Contents</h2><ol><li class="el-toc-1"><a href="#section-1">One</a></li><li class="el-toc-2"><a href="#section-2">A</a></li></ol></nav>',
    );
    expect(html).toContain(
      '<section class="el-section" id="section-2" data-depth="2"><h3>A</h3><h4>Inside</h4>',
    );
  });

  it.each([
    [
      "a CSS injection in the color",
      { primaryColor: "red;} body{display:none" },
      "--el-primary: #4338ca;",
    ],
    [
      "a closing brace in the font",
      { fontFamily: "x} @import url(https://evil.example)" },
      "font-family: system-ui, sans-serif;",
    ],
    [
      "valid values",
      { primaryColor: "#112233", fontFamily: "'Inter', sans-serif" },
      "--el-primary: #112233;",
    ],
  ])("handles %s in the theme", (_label, theme, expected) => {
    const html = renderExportHtml(lessonDoc([]), options({ theme }));

    expect(html).toContain(expected);
    expect(html).not.toContain("evil.example");
  });

  it("ignores a logo that is not an inlined picture and an invalid locale", () => {
    const course = buildCourseExport({
      course: { title: "C", summary: null },
      chapters: [],
      locale: 'en"><script>',
      exportedAt: NOW,
    });

    const html = renderExportHtml(
      course,
      options({ logo: "https://internal.example.com/logo.png" }),
    );

    expect(html).toContain('<html lang="en">');
    expect(html).not.toContain("internal.example.com");
  });

  it("escapes hostile text and drops javascript: links", () => {
    const document = lessonDoc([paragraph('<img src=x onerror=alert(1)> "quoted"')]);
    const html = renderExportHtml(document, options());

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toMatch(/<img src=x/);
  });

  it("uses Letter pages when asked", () => {
    expect(renderExportHtml(lessonDoc([]), options({ pageSize: "Letter" }))).toContain(
      "@page { size: Letter;",
    );
  });

  it("renders the golden document's lists, checks and nested groups", () => {
    const html = renderExportHtml(lessonDoc(everyBlock), options());

    expect(html).toMatch(/<ul class="el-list el-list-check"><li><span class="el-check">☑<\/span>/);
    expect(toExportBlocks(everyBlock).length).toBeGreaterThan(5);
  });
});
