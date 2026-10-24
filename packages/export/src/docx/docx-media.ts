import { ExternalHyperlink, ImageRun, Paragraph, TextRun } from "docx";
import type { FileChild, IRunOptions } from "docx";

import type { ExportBlock } from "@bebranded/elearning-core";

import { alignmentOf, indentOf } from "./docx-context.js";
import type { DocxContext } from "./docx-context.js";

type MediaBlock = Extract<ExportBlock, { type: "image" | "file" | "video" }>;

/** A labelled link back to the lesson (attachments and videos live there). */
function linkLine(
  label: string,
  text: string,
  url: string | null,
  context: DocxContext,
): Paragraph {
  const target =
    url === null
      ? [new TextRun(text)]
      : [
          new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text, underline: {}, color: context.linkColor })],
          }),
        ];
  return new Paragraph({ ...indentOf(context), children: [new TextRun(`${label}: `), ...target] });
}

const captionRun = (text: string): IRunOptions => ({ text, italics: true, size: 18 });

const caption = (text: string, context: DocxContext) =>
  text === ""
    ? []
    : [
        new Paragraph({
          ...indentOf(context),
          children: [new TextRun(captionRun(text))],
        }),
      ];

/** Word embeds PNG, JPEG and GIF; WebP images fall back to an attachment line. */
const WORD_TYPES = { png: "png", jpeg: "jpg", gif: "gif" } as const;

function image(block: Extract<ExportBlock, { type: "image" }>, context: DocxContext): FileChild[] {
  const picture = context.images.get(block.fileId);
  const type =
    picture === undefined || picture.kind === "webp" ? undefined : WORD_TYPES[picture.kind];
  if (picture === undefined || type === undefined) {
    return [
      linkLine(
        context.labels.attachment,
        block.name === "" ? "image" : block.name,
        context.lessonUrl,
        context,
      ),
      ...caption(block.caption, context),
    ];
  }
  const width = Math.min(block.width ?? picture.width, picture.width, context.contentWidth);
  const height = Math.round((picture.height * width) / picture.width);
  const run = new ImageRun({
    type,
    data: picture.bytes,
    transformation: { width, height },
    altText: {
      name: block.name,
      description: block.caption === "" ? block.name : block.caption,
      title: block.name,
    },
  });
  return [
    new Paragraph({
      ...indentOf(context),
      alignment: alignmentOf(block.alignment),
      children: [run],
    }),
    ...caption(block.caption, context),
  ];
}

export function mediaChildren(block: MediaBlock, context: DocxContext): FileChild[] {
  switch (block.type) {
    case "image":
      return image(block, context);
    case "file":
      return [
        linkLine(
          context.labels.attachment,
          block.name === "" ? "file" : block.name,
          context.lessonUrl,
          context,
        ),
        ...caption(block.caption, context),
      ];
    case "video":
      return [linkLine(context.labels.video, block.title, block.url, context)];
  }
}
