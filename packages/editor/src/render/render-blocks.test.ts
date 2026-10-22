import { describe, expect, it } from "vitest";

import type { LessonBlock, StyledText, TextStyles } from "@bebranded/elearning-core";

import { renderBlocks } from "./render-blocks.js";

const text = (value: string, styles: TextStyles = {}): StyledText => ({
  type: "text",
  text: value,
  styles,
});
const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" } as const;
const p = (id: string, value: string, children: LessonBlock[] = []): LessonBlock => ({
  id,
  type: "paragraph",
  props,
  content: [text(value)],
  children,
});
const item = (
  type: "bulletListItem" | "numberedListItem",
  id: string,
  value: string,
): LessonBlock => ({
  id,
  type,
  props,
  content: [text(value)],
  children: [],
});

describe("renderBlocks", () => {
  it("renders paragraphs and headings", () => {
    const heading: LessonBlock = {
      id: "h",
      type: "heading",
      props: { ...props, level: 2 },
      content: [text("Title")],
      children: [],
    };

    expect(renderBlocks([heading, p("p", "Body")])).toBe("<h2>Title</h2><p>Body</p>");
  });

  it("groups consecutive list items of the same type into one list", () => {
    const blocks = [
      item("bulletListItem", "a", "A"),
      item("bulletListItem", "b", "B"),
      item("numberedListItem", "c", "C"),
      p("p", "End"),
    ];

    expect(renderBlocks(blocks)).toBe(
      '<ul class="el-list"><li>A</li><li>B</li></ul><ol class="el-list"><li>C</li></ol><p>End</p>',
    );
  });

  it("keeps the start number of a numbered list", () => {
    const first: LessonBlock = {
      id: "n",
      type: "numberedListItem",
      props: { ...props, start: 4 },
      content: [text("Four")],
      children: [],
    };

    expect(renderBlocks([first])).toBe('<ol class="el-list" start="4"><li>Four</li></ol>');
  });

  it("nests the children of a list item inside it", () => {
    const parent: LessonBlock = {
      ...item("bulletListItem", "a", "Parent"),
      children: [item("bulletListItem", "b", "Child")],
    };

    expect(renderBlocks([parent])).toBe(
      '<ul class="el-list"><li>Parent<ul class="el-list"><li>Child</li></ul></li></ul>',
    );
  });

  it("indents the children of other blocks", () => {
    expect(renderBlocks([p("p", "Parent", [p("c", "Child")])])).toBe(
      '<p>Parent</p><div class="el-block-children"><p>Child</p></div>',
    );
  });

  it("renders check list items as disabled checkboxes", () => {
    const checked: LessonBlock = {
      id: "c",
      type: "checkListItem",
      props: { ...props, checked: true },
      content: [text("Done")],
      children: [],
    };
    const open: LessonBlock = {
      id: "o",
      type: "checkListItem",
      props: { ...props, checked: false },
      content: [text("Todo")],
      children: [],
    };

    expect(renderBlocks([checked, open])).toBe(
      '<ul class="el-list el-checklist"><li data-checked><input type="checkbox" disabled checked><span>Done</span></li>' +
        '<li><input type="checkbox" disabled><span>Todo</span></li></ul>',
    );
  });

  it("renders toggles and toggleable headings as details, collapsed by default", () => {
    const toggle: LessonBlock = {
      id: "t",
      type: "toggleListItem",
      props,
      content: [text("More")],
      children: [p("c", "Hidden")],
    };
    const heading: LessonBlock = {
      id: "h",
      type: "heading",
      props: { ...props, level: 3, isToggleable: true },
      content: [text("FAQ")],
      children: [p("a", "Answer")],
    };

    expect(renderBlocks([toggle])).toBe(
      '<details class="el-toggle"><summary>More</summary><p>Hidden</p></details>',
    );
    expect(renderBlocks([heading])).toBe(
      '<details class="el-toggle"><summary><h3>FAQ</h3></summary><p>Answer</p></details>',
    );
  });

  it("renders quotes, dividers, callouts and code", () => {
    const blocks: LessonBlock[] = [
      {
        id: "q",
        type: "quote",
        props: { backgroundColor: "default", textColor: "default" },
        content: [text("Q")],
        children: [],
      },
      { id: "d", type: "divider", props: {}, children: [] },
      {
        id: "c",
        type: "callout",
        props: { backgroundColor: "default", textColor: "default", variant: "info" },
        content: [text("Tip")],
        children: [],
      },
      {
        id: "k",
        type: "codeBlock",
        props: { language: "" },
        content: [{ type: "text", text: "a < b", styles: {} }],
        children: [],
      },
    ];

    expect(renderBlocks(blocks)).toBe(
      "<blockquote>Q</blockquote><hr>" +
        '<div class="el-callout" role="note" data-variant="info"><div class="el-callout-content">Tip</div></div>' +
        "<pre><code>a &lt; b</code></pre>",
    );
  });

  it("renders inline styles, colors and line breaks", () => {
    const styled = p("p", "");
    const block: LessonBlock = {
      ...styled,
      type: "paragraph",
      props,
      content: [
        text("a\nb", {
          bold: true,
          italic: true,
          underline: true,
          strike: true,
          code: true,
          textColor: "blue",
          backgroundColor: "yellow",
        }),
      ],
    };

    expect(renderBlocks([block])).toBe(
      '<p><span data-text-color="blue" data-background-color="yellow"><s><u><em><strong><code>a<br>b</code></strong></em></u></s></span></p>',
    );
  });

  it("renders block colors and alignment as data attributes, never as styles", () => {
    const block: LessonBlock = {
      ...p("p", "x"),
      type: "paragraph",
      props: { backgroundColor: "red", textColor: "gray", textAlignment: "center" },
      content: [text("x")],
    };

    expect(renderBlocks([block])).toBe(
      '<p data-text-color="gray" data-background-color="red" data-text-alignment="center">x</p>',
    );
  });

  it("renders tables with header rows and spans", () => {
    const table: LessonBlock = {
      id: "t",
      type: "table",
      props: { textColor: "default" },
      content: {
        type: "tableContent",
        columnWidths: [null, null],
        headerRows: 1,
        rows: [
          {
            cells: [
              { type: "tableCell", props: { ...props, colspan: 2 }, content: [text("Head")] },
            ],
          },
          { cells: [[text("1")], [text("2")]] },
        ],
      },
      children: [],
    };

    expect(renderBlocks([table])).toBe(
      '<div class="el-table-wrapper"><table><thead><tr><th colspan="2" scope="col">Head</th></tr></thead>' +
        "<tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>",
    );
  });

  it("renders links that open in a new tab without referrer", () => {
    const block: LessonBlock = {
      ...p("p", ""),
      type: "paragraph",
      props,
      content: [{ type: "link", href: "https://example.com/?a=1&b=2", content: [text("Guide")] }],
    };

    expect(renderBlocks([block])).toBe(
      '<p><a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow">Guide</a></p>',
    );
  });

  it("adds no color wrapper for default colors", () => {
    const block: LessonBlock = {
      ...p("p", ""),
      type: "paragraph",
      props,
      content: [text("x", { textColor: "default", backgroundColor: "default" })],
    };

    expect(renderBlocks([block])).toBe("<p>x</p>");
  });

  it("wraps text with only a background color", () => {
    const block: LessonBlock = {
      ...p("p", ""),
      type: "paragraph",
      props,
      content: [text("x", { backgroundColor: "green" })],
    };

    expect(renderBlocks([block])).toBe('<p><span data-background-color="green">x</span></p>');
  });

  it("renders nothing for an empty document", () => {
    expect(renderBlocks([])).toBe("");
  });
});
