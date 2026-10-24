import { describe, expect, it } from "vitest";

import { FILE_ID, imageBlock, paragraph } from "../../tests/fixtures/lesson-documents.js";
import { buildLessonExport, exportImageIds } from "../export/export-document.js";
import { toExportBlocks } from "../export/to-export-blocks.js";
import { collectFileIds } from "./file-references.js";
import { validateLessonDocument } from "./lesson-document.js";
import type { LessonDocument } from "./lesson-document.types.js";

const column = (id: string, width: number, children: unknown[] = [paragraph(`${id}-p`)]) => ({
  id,
  type: "column",
  props: { width },
  children,
});
const columns = (id: string, ...list: unknown[]) => ({
  id,
  type: "columnList",
  props: {},
  children: list,
});

function codes(input: unknown[]): string[] {
  const result = validateLessonDocument(input);
  return result.ok ? [] : [...new Set(result.error.map((issue) => issue.code))];
}

function parsed(input: unknown[]): LessonDocument {
  const result = validateLessonDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe("column lists", () => {
  it.each([
    ["two columns", [column("a", 0.6), column("b", 0.4)]],
    ["three equal columns", [column("a", 1), column("b", 1), column("c", 1)]],
    [
      "four columns at the minimum share",
      [column("a", 0.15), column("b", 0.15), column("c", 0.35), column("d", 0.35)],
    ],
    ["unnormalized shares", [column("a", 3), column("b", 2)]],
    [
      "a column holding several blocks",
      [column("a", 1, [paragraph("x"), imageBlock("i", "")]), column("b", 1)],
    ],
  ])("accepts %s", (_label, list) => {
    expect(codes([columns("l", ...list)])).toEqual([]);
  });

  it.each([
    ["one column", [column("a", 1)]],
    ["five columns", ["a", "b", "c", "d", "e"].map((id) => column(id, 1))],
    ["a column under 15% of the row", [column("a", 0.1), column("b", 0.9)]],
    ["a zero width", [column("a", 0), column("b", 1)]],
    ["a paragraph instead of a column", [column("a", 1), paragraph("p")]],
  ])("refuses %s", (_label, list) => {
    expect(codes([columns("l", ...list)])).toEqual(["invalid_content"]);
  });

  it("refuses a column outside a column list", () => {
    expect(codes([column("a", 1)])).toEqual(["invalid_content"]);
  });

  it("refuses a column list inside a column, at any depth", () => {
    const inner = columns("inner", column("x", 1), column("y", 1));

    expect(codes([columns("l", column("a", 1, [inner]), column("b", 1))])).toEqual([
      "nested_columns",
    ]);
    expect(
      codes([columns("l", column("a", 1, [paragraph("p", undefined, [inner])]), column("b", 1))]),
    ).toEqual(["nested_columns"]);
  });

  it("refuses props a column list does not have", () => {
    expect(codes([{ ...columns("l", column("a", 1), column("b", 1)), props: { gap: 4 } }])).toEqual(
      ["invalid_content"],
    );
  });
});

describe("columns in exports and file references", () => {
  const document = parsed([
    columns("l", column("a", 3, [imageBlock("i", `elearning-file:${FILE_ID}`)]), column("b", 1)),
  ]);

  it("exports columns with their shares of the row and their blocks", () => {
    expect(toExportBlocks(document)).toEqual([
      {
        type: "columns",
        columns: [
          { width: 0.75, blocks: [expect.objectContaining({ type: "image", fileId: FILE_ID })] },
          { width: 0.25, blocks: [expect.objectContaining({ type: "paragraph" })] },
        ],
      },
    ]);
  });

  it("finds files and images inside columns", () => {
    const exported = buildLessonExport({
      lesson: { title: "L", type: "text", content: document, url: "https://host.example.com/l" },
      courseTitle: "C",
      locale: "en",
      exportedAt: new Date("2026-10-24T00:00:00Z"),
    });

    expect(collectFileIds(document)).toEqual([FILE_ID]);
    expect(exportImageIds(exported)).toEqual([FILE_ID]);
  });
});
