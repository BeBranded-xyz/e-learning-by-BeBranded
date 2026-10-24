import { describe, expect, it } from "vitest";

import { validateLessonDocument } from "@bebranded/elearning-core";
import type { LessonDocument } from "@bebranded/elearning-core";

import { renderLessonHtml } from "../server/render-lesson-html.js";

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" };
const paragraph = (id: string, text: string) => ({
  id,
  type: "paragraph",
  props,
  content: [{ type: "text", text, styles: {} }],
  children: [],
});
const column = (id: string, width: number, children: unknown[]) => ({
  id,
  type: "column",
  props: { width },
  children,
});

function lesson(input: unknown[]): LessonDocument {
  const result = validateLessonDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe("columns on the learner page", () => {
  it("render side by side with their width as a 5% step, no inline style", () => {
    const html = renderLessonHtml(
      lesson([
        {
          id: "l",
          type: "columnList",
          props: {},
          children: [
            column("a", 2, [paragraph("p", "Left")]),
            column("b", 1, [paragraph("q", "Right")]),
          ],
        },
      ]),
    );

    expect(html).toBe(
      '<div class="el-columns">' +
        '<div class="el-column" data-width="65"><p>Left</p></div>' +
        '<div class="el-column" data-width="35"><p>Right</p></div>' +
        "</div>",
    );
    expect(html).not.toContain("style=");
  });

  it("render lists and nested blocks inside a column", () => {
    const item = {
      id: "i",
      type: "bulletListItem",
      props,
      content: [{ type: "text", text: "One", styles: {} }],
      children: [],
    };
    const html = renderLessonHtml(
      lesson([
        {
          id: "l",
          type: "columnList",
          props: {},
          children: [column("a", 1, [item]), column("b", 1, [paragraph("q", "x")])],
        },
      ]),
    );

    expect(html).toContain(
      '<div class="el-column" data-width="50"><ul class="el-list"><li>One</li></ul></div>',
    );
  });
});
