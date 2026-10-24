import { describe, expect, it } from "vitest";

import { fileIdSchema } from "@bebranded/elearning-core";
import type { FileId, LessonBlock, LessonDocument } from "@bebranded/elearning-core";

import { renderLessonHtml } from "../server/render-lesson-html.js";
import { renderBlocks } from "./render-blocks.js";

const FILE = fileIdSchema.parse("6f1c2a4e-1b7d-4c3a-9f2e-0a1b2c3d4e5f");
const url = `elearning-file:${FILE}`;
const signed = "https://files.example.com/k?sig=a&exp=1";

const image = (props: Partial<Extract<LessonBlock, { type: "image" }>["props"]> = {}) =>
  ({
    id: "i",
    type: "image",
    props: {
      textAlignment: "left",
      backgroundColor: "default",
      name: "chart.png",
      url,
      caption: "",
      showPreview: true,
      ...props,
    },
    children: [],
  }) satisfies LessonBlock;

const file = (props: Partial<Extract<LessonBlock, { type: "file" }>["props"]> = {}) =>
  ({
    id: "f",
    type: "file",
    props: { backgroundColor: "default", name: "handbook.pdf", url, caption: "", ...props },
    children: [],
  }) satisfies LessonBlock;

const resolver =
  (value: string) =>
  (id: FileId): string | undefined =>
    id === FILE ? value : undefined;

describe("media blocks", () => {
  it("renders an image with its signed url, alt text from the caption and its width", () => {
    const html = renderBlocks([image({ caption: "Q3 <chart>", previewWidth: 480 })], {
      fileUrl: resolver(signed),
    });

    expect(html).toBe(
      '<figure class="el-figure"><img src="https://files.example.com/k?sig=a&amp;exp=1" alt="Q3 &lt;chart&gt;" loading="lazy" width="480"><figcaption class="el-media-caption">Q3 &lt;chart&gt;</figcaption></figure>',
    );
  });

  it("uses the file name as alt text without a caption, and keeps alignment and color", () => {
    const html = renderBlocks([image({ textAlignment: "center", backgroundColor: "blue" })], {
      fileUrl: resolver(signed),
    });

    expect(html).toContain('data-background-color="blue" data-text-alignment="center"');
    expect(html).toContain('alt="chart.png"');
    expect(html).not.toContain("figcaption");
  });

  it("renders an image without preview as a link", () => {
    const html = renderBlocks([image({ showPreview: false })], { fileUrl: resolver(signed) });

    expect(html).not.toContain("<img");
    expect(html).toContain('<div class="el-file"><a href="https://files.example.com');
  });

  it("renders a file as a download link with its caption", () => {
    const html = renderBlocks([file({ caption: "Read before day one" })], {
      fileUrl: resolver(signed),
    });

    expect(html).toBe(
      '<div class="el-file"><a href="https://files.example.com/k?sig=a&amp;exp=1" target="_blank" rel="noopener noreferrer">handbook.pdf</a><p class="el-media-caption">Read before day one</p></div>',
    );
  });

  it("names an unnamed file", () => {
    expect(renderBlocks([file({ name: "" })], { fileUrl: resolver(signed) })).toContain(
      ">Attachment</a>",
    );
  });

  it.each([
    ["no resolver", {}],
    ["a file the resolver does not know", { fileUrl: () => undefined }],
  ])("renders nothing for media with %s", (_label, options) => {
    expect(renderBlocks([image(), file()], options)).toBe("");
  });

  it("renders nothing for media whose upload never finished", () => {
    expect(
      renderBlocks([image({ url: "" }), file({ url: "" })], { fileUrl: resolver(signed) }),
    ).toBe("");
  });

  it("resolves media nested in another block", () => {
    const document: LessonDocument = [
      {
        id: "p",
        type: "paragraph",
        props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
        content: [],
        children: [file()],
      },
    ];

    expect(renderBlocks(document, { fileUrl: resolver(signed) })).toContain("handbook.pdf");
  });
});

describe("media blocks through the sanitizer", () => {
  it("keeps images and file links", () => {
    const html = renderLessonHtml([image({ caption: "A" }), file()], { fileUrl: resolver(signed) });

    expect(html).toContain(
      '<img src="https://files.example.com/k?sig=a&amp;exp=1" alt="A" loading="lazy" />',
    );
    expect(html).toContain('<figcaption class="el-media-caption">A</figcaption>');
    expect(html).toContain('<a href="https://files.example.com/k?sig=a&amp;exp=1"');
  });

  it("keeps a relative url served by the host", () => {
    const html = renderLessonHtml([image()], { fileUrl: resolver("/files/abc?sig=1") });

    expect(html).toContain('src="/files/abc?sig=1"');
  });

  it.each(["javascript:alert(1)", "data:image/svg+xml,<svg onload=alert(1)>", "//evil.example"])(
    "drops a hostile url %s returned by the host",
    (value) => {
      const html = renderLessonHtml([image(), file()], { fileUrl: resolver(value) });

      expect(html).not.toMatch(/javascript:|data:|\/\/evil/);
    },
  );

  it("cannot break out of the alt attribute", () => {
    const html = renderLessonHtml([image({ caption: '" onerror="alert(1)' })], {
      fileUrl: resolver(signed),
    });

    expect(html).toContain('alt="&quot; onerror=&quot;alert(1)"');
  });
});
