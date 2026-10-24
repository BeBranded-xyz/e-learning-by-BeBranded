import { describe, expect, it } from "vitest";

import {
  FILE_ID,
  OTHER_FILE_ID,
  fileBlock,
  imageBlock,
  paragraph,
} from "../../tests/fixtures/lesson-documents.js";
import { collectFileIds, fileIdFromUrl, fileUrl } from "./file-references.js";
import { validateLessonDocument } from "./lesson-document.js";
import type { LessonDocument } from "./lesson-document.types.js";

const uploaded = `elearning-file:${FILE_ID}`;

function parsed(input: unknown[]): LessonDocument {
  const result = validateLessonDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

/** The distinct issue codes; one bad value may fail several checks. */
function issueCodes(input: unknown[]): string[] {
  const result = validateLessonDocument(input);
  return result.ok ? [] : [...new Set(result.error.map((issue) => issue.code))];
}

describe("image and file blocks", () => {
  it("accepts an image pointing to an uploaded file", () => {
    expect(
      issueCodes([imageBlock("i", uploaded, { previewWidth: 480, caption: "A chart" })]),
    ).toEqual([]);
  });

  it("accepts a file block pointing to an uploaded file", () => {
    expect(issueCodes([fileBlock("f", uploaded)])).toEqual([]);
  });

  it("accepts an empty url, an upload that has not finished", () => {
    expect(issueCodes([imageBlock("i", ""), fileBlock("f", "")])).toEqual([]);
  });

  it.each([
    ["an external https image", "https://example.com/a.png"],
    ["a data: image", "data:image/png;base64,AAAA"],
    ["a javascript: url", "javascript:alert(1)"],
    ["a malformed file id", "elearning-file:not-a-uuid"],
    ["a file id with a suffix", `elearning-file:${FILE_ID}/../x`],
    ["an uppercase prefix", `ELEARNING-FILE:${FILE_ID}`],
  ])("rejects %s", (_label, url) => {
    expect(issueCodes([imageBlock("i", url)])).toEqual(["invalid_content"]);
    expect(issueCodes([fileBlock("f", url)])).toEqual(["invalid_content"]);
  });

  it.each([
    ["a zero preview width", { previewWidth: 0 }],
    ["a fractional preview width", { previewWidth: 10.5 }],
    ["a huge preview width", { previewWidth: 10_001 }],
    ["a CSS background color", { backgroundColor: "red;x:y" }],
    ["a long caption", { caption: "x".repeat(1_001) }],
    ["a long file name", { name: "x".repeat(256) }],
    ["an unknown prop", { onerror: "alert(1)" }],
  ])("rejects an image with %s", (_label, props) => {
    expect(issueCodes([imageBlock("i", uploaded, props)])).toEqual(["invalid_content"]);
  });

  it("rejects inline content on an image", () => {
    expect(issueCodes([{ ...imageBlock("i", uploaded), content: [] }])).toEqual([
      "invalid_content",
    ]);
  });
});

describe("file references", () => {
  it("reads the file id of a module url and nothing else", () => {
    expect(fileIdFromUrl(uploaded)).toBe(FILE_ID);
    expect(fileIdFromUrl("")).toBeNull();
    expect(fileIdFromUrl("https://example.com/a.png")).toBeNull();
    expect(fileIdFromUrl("elearning-file:nope")).toBeNull();
  });

  it("builds the url a document stores", () => {
    expect(fileUrl(fileIdFromUrl(uploaded) ?? fail())).toBe(uploaded);
  });

  it("collects every referenced file once, in reading order, including nested blocks", () => {
    const document = parsed([
      imageBlock("a", `elearning-file:${OTHER_FILE_ID}`),
      paragraph("p", undefined, [fileBlock("b", uploaded), imageBlock("c", "")]),
      imageBlock("d", `elearning-file:${OTHER_FILE_ID}`),
    ]);

    expect(collectFileIds(document)).toEqual([OTHER_FILE_ID, FILE_ID]);
  });

  it("collects nothing from a document without media", () => {
    expect(collectFileIds(parsed([paragraph("p")]))).toEqual([]);
  });
});

function fail(): never {
  throw new Error("expected a file id");
}
