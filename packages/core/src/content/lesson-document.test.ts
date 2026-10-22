import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  paragraph,
  text,
  textProps,
  validDocument,
} from "../../tests/fixtures/lesson-documents.js";
import { validateLessonDocument } from "./lesson-document.js";
import { LESSON_DOCUMENT_LIMITS } from "./lesson-document.schemas.js";

function issueCodes(input: unknown): string[] {
  const result = validateLessonDocument(input);
  return result.ok ? [] : result.error.map((issue) => issue.code);
}

function nested(depth: number): unknown[] {
  let children: unknown[] = [];
  for (let level = depth; level > 0; level -= 1)
    children = [paragraph(`d${level}`, [text("x")], children)];
  return children;
}

describe("validateLessonDocument", () => {
  it("accepts a document using every allowed block type", () => {
    const result = validateLessonDocument(validDocument);

    expect(result.ok).toBe(true);
  });

  it("accepts an empty document", () => {
    expect(validateLessonDocument([])).toEqual({ ok: true, value: [] });
  });

  it.each([
    ["a javascript: link", "javascript:alert(1)"],
    ["a data: link", "data:text/html,<script>alert(1)</script>"],
    ["a vbscript: link", "vbscript:msgbox(1)"],
    ["a relative link", "/admin"],
    ["a file: link", "file:///etc/passwd"],
    ["an uppercase JAVASCRIPT: link", "JAVASCRIPT:alert(1)"],
  ])("rejects %s", (_label, href) => {
    const document = [paragraph("p", [{ type: "link", href, content: [text("click")] }])];

    expect(issueCodes(document)).toEqual(["invalid_content"]);
  });

  it.each(["image", "video", "file", "audio", "html", "embed", "script"])(
    "rejects the %s block type",
    (type) => {
      const document = [{ id: "x", type, props: {}, content: [], children: [] }];

      expect(issueCodes(document)).toContain("invalid_content");
    },
  );

  it.each([
    [
      "a heading of level 4",
      { id: "h", type: "heading", props: { ...textProps, level: 4 }, content: [], children: [] },
    ],
    [
      "an unknown prop",
      {
        id: "p",
        type: "paragraph",
        props: { ...textProps, onclick: "x" },
        content: [],
        children: [],
      },
    ],
    [
      "a CSS color value",
      {
        id: "p",
        type: "paragraph",
        props: { ...textProps, textColor: "red;background:url(x)" },
        content: [],
        children: [],
      },
    ],
    ["a missing children array", { id: "p", type: "paragraph", props: textProps, content: [] }],
    ["an unknown inline type", paragraph("p", [{ type: "mention", user: "x" }])],
    ["an unknown text style", paragraph("p", [text("x", { fontSize: "40px" })])],
    ["a style set to false", paragraph("p", [text("x", { bold: false })])],
    ["an empty block id", paragraph("")],
    [
      "an unknown callout variant",
      {
        id: "c",
        type: "callout",
        props: { backgroundColor: "default", textColor: "default", variant: "html" },
        content: [],
        children: [],
      },
    ],
    [
      "a code language with spaces",
      { id: "k", type: "codeBlock", props: { language: "a b" }, content: [], children: [] },
    ],
    [
      "styled text in a code block",
      {
        id: "k",
        type: "codeBlock",
        props: { language: "" },
        content: [text("x", { bold: true })],
        children: [],
      },
    ],
  ])("rejects %s", (_label, block) => {
    expect(issueCodes([block])).toEqual(expect.arrayContaining(["invalid_content"]));
  });

  it("reports where the invalid value is", () => {
    const document = [
      paragraph(
        "p",
        [text("ok")],
        [
          {
            id: "h",
            type: "heading",
            props: { ...textProps, level: 9 },
            content: [],
            children: [],
          },
        ],
      ),
    ];

    const result = validateLessonDocument(document);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error[0]?.path.slice(0, 3)).toEqual([0, "children", 0]);
  });

  it("rejects a value that is not an array", () => {
    expect(issueCodes({ blocks: [] })).toEqual(["invalid_content"]);
    expect(issueCodes("<p>html</p>")).toEqual(["invalid_content"]);
    expect(issueCodes(undefined)).toEqual(["invalid_content"]);
  });

  it("rejects a document over the byte limit before parsing it", () => {
    const big = [paragraph("p", [text("x".repeat(LESSON_DOCUMENT_LIMITS.maxBytes))])];

    expect(issueCodes(big)).toEqual(["too_large"]);
  });

  it("accepts the maximum depth and rejects one level more", () => {
    expect(issueCodes(nested(LESSON_DOCUMENT_LIMITS.maxDepth))).toEqual([]);
    expect(issueCodes(nested(LESSON_DOCUMENT_LIMITS.maxDepth + 1))).toEqual(["too_deep"]);
  });

  it("rejects a hostile 10 000-level document without exhausting the stack", () => {
    expect(issueCodes(nested(10_000))).toEqual(["too_deep"]);
  });

  it("rejects deeply nested JSON hidden in props without exhausting the stack", () => {
    let props: unknown = {};
    for (let level = 0; level < 10_000; level += 1) props = { nested: props };

    expect(issueCodes([{ id: "p", type: "paragraph", props, content: [], children: [] }])).toEqual([
      "too_deep",
    ]);
  });

  it("rejects more blocks than the limit", () => {
    const blocks = Array.from({ length: LESSON_DOCUMENT_LIMITS.maxBlocks + 1 }, (_, index) =>
      paragraph(`b${index}`, []),
    );

    expect(issueCodes(blocks)).toEqual(["too_many_blocks"]);
  });

  it("rejects tables with too many cells in total", () => {
    const row = { cells: Array.from({ length: 50 }, () => [text("x")]) };
    const table = (id: string) => ({
      id,
      type: "table",
      props: { textColor: "default" },
      content: {
        type: "tableContent",
        columnWidths: [],
        rows: Array.from({ length: 11 }, () => row),
      },
      children: [],
    });

    expect(issueCodes([table("t1"), table("t2")])).toEqual(["too_many_table_cells"]);
  });

  it("rejects duplicate block ids, including in children", () => {
    expect(issueCodes([paragraph("same"), paragraph("other", [], [paragraph("same")])])).toEqual([
      "duplicate_block_id",
    ]);
  });

  it.each([
    [
      "children that are not an array",
      { id: "p", type: "paragraph", props: textProps, content: [], children: "none" },
    ],
    ["a block that is not an object", "paragraph"],
    ["a block without id", { type: "paragraph", props: textProps, content: [], children: [] }],
    [
      "table rows that are not an array",
      {
        id: "t",
        type: "table",
        props: { textColor: "default" },
        content: { type: "tableContent", columnWidths: [], rows: 3 },
        children: [],
      },
    ],
    [
      "table cells that are not an array",
      {
        id: "t",
        type: "table",
        props: { textColor: "default" },
        content: { type: "tableContent", columnWidths: [], rows: [{ cells: "x" }, 4] },
        children: [],
      },
    ],
    [
      "table content that is not an object",
      { id: "t", type: "table", props: { textColor: "default" }, content: "table", children: [] },
    ],
  ])("rejects malformed shapes without crashing: %s", (_label, block) => {
    expect(issueCodes([block])).toEqual(expect.arrayContaining(["invalid_content"]));
  });

  it("returns at most 20 issues for a document full of errors", () => {
    const blocks = Array.from({ length: 50 }, (_, index) => ({
      id: `x${index}`,
      type: "paragraph",
      props: {},
      content: 1,
      children: [],
    }));

    const result = validateLessonDocument(blocks);

    expect(result.ok ? 0 : result.error.length).toBe(20);
  });

  it("never throws, whatever JSON it receives (fuzz)", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 8 }), (value) => {
        const result = validateLessonDocument(value);

        expect(typeof result.ok).toBe("boolean");
      }),
      { numRuns: 500 },
    );
  });

  it("accepts any plain text in paragraphs and keeps it unchanged", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (value) => {
        const result = validateLessonDocument([paragraph("p", [text(value)])]);

        expect(result.ok && result.value[0]?.content).toEqual([text(value)]);
      }),
    );
  });
});
