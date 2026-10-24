import { describe, expect, it } from "vitest";

import { EXPORT_LIMITS, buildLessonExport, fileIdSchema } from "@bebranded/elearning-core";
import type { ExportBlock, ExportDocument, FileId } from "@bebranded/elearning-core";

import {
  PNG_1X1,
  gifHeader,
  jpegHeader,
  pngHeader,
  webpHeader,
  webpLosslessHeader,
  webpLossyHeader,
} from "../../tests/fixtures/images.js";
import { imageInfo } from "./image-info.js";
import { inlineImages } from "./inline-images.js";

const id = (n: number) =>
  fileIdSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);

function documentWith(count: number): ExportDocument {
  const base = buildLessonExport({
    lesson: { title: "L", type: "text", content: [], url: "https://host.example.com/l" },
    courseTitle: "C",
    locale: "en",
    exportedAt: new Date("2026-10-24T00:00:00Z"),
  });
  const blocks: ExportBlock[] = Array.from({ length: count }, (_, index) => ({
    type: "image",
    fileId: id(index),
    name: "x",
    caption: "",
    width: null,
    alignment: "left",
  }));
  return { ...base, sections: [{ title: "L", depth: 1, url: null, blocks }] };
}

describe("imageInfo", () => {
  it.each([
    ["a real PNG", PNG_1X1, { kind: "png", width: 1, height: 1 }],
    ["a PNG header", pngHeader(640, 480), { kind: "png", width: 640, height: 480 }],
    ["a GIF header", gifHeader(32, 16), { kind: "gif", width: 32, height: 16 }],
    ["a JPEG frame", jpegHeader(800, 600), { kind: "jpeg", width: 800, height: 600 }],
    ["a WebP header", webpHeader(300, 200), { kind: "webp", width: 300, height: 200 }],
    ["a lossy WebP header", webpLossyHeader(120, 80), { kind: "webp", width: 120, height: 80 }],
    ["a lossless WebP header", webpLosslessHeader(64, 48), { kind: "webp", width: 64, height: 48 }],
  ])("reads %s", (_label, bytes, expected) => {
    expect(imageInfo(bytes)).toEqual(expected);
  });

  it.each([
    ["an SVG", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["HTML", new TextEncoder().encode("<html><script>alert(1)</script>")],
    ["a PDF", new TextEncoder().encode("%PDF-1.7")],
    ["nothing", new Uint8Array()],
    ["a truncated PNG", pngHeader(1, 1).slice(0, 20)],
    ["a zero-sized PNG", pngHeader(0, 10)],
    ["a huge GIF", gifHeader(60_000, 10)],
    ["a JPEG without frame", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01])],
    [
      "a JPEG with a broken marker",
      new Uint8Array([0xff, 0xd8, 0x00, 0xe0, 0x00, 0x04, 0, 0, 0, 0]),
    ],
  ])("refuses %s", (_label, bytes) => {
    expect(imageInfo(bytes)).toBeNull();
  });
});

describe("inlineImages", () => {
  it("loads each image once and inlines it as a data URI", async () => {
    const loads: FileId[] = [];
    const images = await inlineImages(documentWith(1), (fileId) => {
      loads.push(fileId);
      return Promise.resolve(PNG_1X1);
    });

    expect(loads).toEqual([id(0)]);
    expect(images.get(id(0))).toMatchObject({
      kind: "png",
      width: 1,
      dataUri: expect.stringMatching(/^data:image\/png;base64,iVBOR/) as string,
    });
  });

  it("leaves out files that are gone or are not pictures", async () => {
    const svg = new TextEncoder().encode("<svg></svg>");
    const images = await inlineImages(documentWith(2), (fileId) =>
      Promise.resolve(fileId === id(0) ? null : svg),
    );

    expect(images.size).toBe(0);
  });

  it("refuses more images than the limit, before loading any", async () => {
    let loads = 0;
    const attempt = inlineImages(documentWith(EXPORT_LIMITS.maxImages + 1), () => {
      loads += 1;
      return Promise.resolve(PNG_1X1);
    });

    await expect(attempt).rejects.toMatchObject({ code: "export_too_large" });
    expect(loads).toBe(0);
  });

  it("refuses images heavier than the limit in total", async () => {
    const big = new Uint8Array(EXPORT_LIMITS.maxImageBytes / 2 + 1);
    big.set(PNG_1X1);

    await expect(inlineImages(documentWith(2), () => Promise.resolve(big))).rejects.toMatchObject({
      code: "export_too_large",
    });
  });
});
