import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { validateLessonDocument } from "@bebranded/elearning-core";
import type { LessonBlock, LessonDocument, StyledText } from "@bebranded/elearning-core";

import { everyBlock } from "../../tests/fixtures/documents.js";
import { renderLessonHtml } from "./render-lesson-html.js";

const text = (value: string): StyledText => ({ type: "text", text: value, styles: {} });
const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" } as const;
const paragraph = (content: LessonBlock["content"]): LessonDocument => [
  { id: "p", type: "paragraph", props, content: content as StyledText[], children: [] },
];

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  '"><svg onload=alert(1)>',
  "</p><iframe src=javascript:alert(1)>",
  "<a href=javascript:alert(1)>x</a>",
];

describe("renderLessonHtml", () => {
  it("renders the fixture with every block type and it is a valid document", () => {
    expect(validateLessonDocument(JSON.parse(JSON.stringify(everyBlock))).ok).toBe(true);

    const html = renderLessonHtml(everyBlock);

    expect(html).toContain("<h1>Safety basics</h1>");
    expect(html).toContain('<div class="el-callout" role="note" data-variant="warning">');
    expect(html).toContain("<code>echo &lt;hello&gt;</code>");
    expect(html).toContain('<input type="checkbox" disabled checked />');
  });

  it.each(XSS_PAYLOADS)("escapes the payload %s in text", (payload) => {
    const html = renderLessonHtml(paragraph([text(payload)]));

    expect(html).not.toMatch(/<(script|img|svg|iframe)\b/i);
    expect(html).not.toMatch(/<[^>]+\son\w+\s*=/i);
    expect(html).toContain("&lt;");
  });

  it("keeps template syntax as inert text", () => {
    const payload = "{{constructor.constructor('alert(1)')()}}";

    expect(renderLessonHtml(paragraph([text(payload)]))).toBe(`<p>${payload}</p>`);
  });

  it("removes a javascript: link even when validation was bypassed (defense in depth)", () => {
    const html = renderLessonHtml(
      paragraph([{ type: "link", href: "javascript:alert(1)", content: [text("click")] }]),
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("never outputs an executable tag or event handler for any text (fuzz)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (value) => {
        const html = renderLessonHtml(paragraph([text(value)]));

        expect(html).not.toMatch(/<(script|img|svg|iframe|object|embed|style)\b/i);
        expect(html).not.toMatch(/<[^>]+\son\w+\s*=/i);
      }),
      { numRuns: 500 },
    );
  });
});
