import { describe, expect, it } from "vitest";

import { buildLessonExport, validateLessonDocument } from "@bebranded/elearning-core";

import { renderExportHtml } from "./render-export-html.js";

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const paragraph = (id: string, text: string) => ({
  id,
  type: "paragraph",
  props,
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

describe("columns in the printed document", () => {
  it("keep their widths as 5% steps that the print CSS lays out", () => {
    const content = validateLessonDocument([
      {
        id: "l",
        type: "columnList",
        props: {},
        children: [
          { id: "a", type: "column", props: { width: 0.7 }, children: [paragraph("p", "Wide")] },
          { id: "b", type: "column", props: { width: 0.3 }, children: [paragraph("q", "Narrow")] },
        ],
      },
    ]);
    if (!content.ok) throw new Error("invalid fixture");
    const html = renderExportHtml(
      buildLessonExport({
        lesson: {
          title: "L",
          type: "text",
          content: content.value,
          url: "https://host.example.com/l",
        },
        courseTitle: "C",
        locale: "en",
        exportedAt: new Date("2026-10-24T00:00:00Z"),
      }),
      {
        imageSrc: () => undefined,
        pageSize: "A4",
        labels: {
          tableOfContents: "Contents",
          video: "Video",
          attachment: "Attachment",
          exportedOn: "Today",
        },
      },
    );

    expect(html).toContain(
      '<div class="el-columns"><div class="el-column" data-width="70"><p>Wide</p></div>' +
        '<div class="el-column" data-width="30"><p>Narrow</p></div></div>',
    );
    expect(html).toContain('.el-column[data-width="70"] { flex-grow: 70; }');
    expect(html).toContain('.el-column[data-width="15"] { flex-grow: 15; }');
    expect(html).toContain('.el-column[data-width="100"] { flex-grow: 100; }');
  });
});
