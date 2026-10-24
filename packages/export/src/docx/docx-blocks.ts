import { HeadingLevel, Paragraph, ShadingType, TextRun } from "docx";
import type { FileChild, IParagraphOptions } from "docx";

import type { ExportBlock, ExportText } from "@bebranded/elearning-core";

import { backgroundColor } from "./docx-colors.js";
import { alignmentOf, indentOf, nestedIn } from "./docx-context.js";
import type { DocxContext } from "./docx-context.js";
import { inlineRuns } from "./docx-inline.js";
import { mediaChildren } from "./docx-media.js";
import { calloutTable, columnsTable, wordTable } from "./docx-tables.js";

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

function textParagraph(
  text: ExportText,
  context: DocxContext,
  extra: Pick<IParagraphOptions, "style" | "heading"> = {},
): Paragraph {
  const fill = backgroundColor(text.backgroundColor);
  return new Paragraph({
    ...indentOf(context),
    alignment: alignmentOf(text.alignment),
    children: inlineRuns(text.content),
    ...(fill === undefined ? {} : { shading: { type: ShadingType.CLEAR, fill, color: "auto" } }),
    ...extra,
  });
}

function list(block: Extract<ExportBlock, { type: "list" }>, context: DocxContext): FileChild[] {
  const level = context.depth;
  return block.items.flatMap((item) => {
    const box = item.checked === null ? [] : [new TextRun(item.checked ? "☑ " : "☐ ")];
    const numbering =
      block.style === "numbered"
        ? { numbering: context.numbering.numbered(block.start, level) }
        : block.style === "bullet"
          ? { numbering: context.numbering.bullet(level) }
          : { indent: { left: 720 * (level + 1) } };
    const paragraph = new Paragraph({
      ...numbering,
      children: [...box, ...inlineRuns(item.text.content)],
    });
    return [paragraph, ...docxBlocks(item.children, nestedIn(context))];
  });
}

function code(block: Extract<ExportBlock, { type: "code" }>, context: DocxContext): FileChild[] {
  return block.code
    .split("\n")
    .map(
      (line) =>
        new Paragraph({ ...indentOf(context), style: "Code", children: [new TextRun(line)] }),
    );
}

function textBlock(
  block: Extract<ExportBlock, { type: "heading" | "paragraph" | "quote" }>,
  context: DocxContext,
): FileChild[] {
  if (block.type === "paragraph") return [textParagraph(block.text, context)];
  if (block.type === "quote") return [textParagraph(block.text, context, { style: "Quote" })];
  const heading =
    HEADINGS[Math.min(5, block.level - 1 + context.headingOffset)] ?? HeadingLevel.HEADING_6;
  return [textParagraph(block.text, context, { heading })];
}

type TextBlock = Extract<ExportBlock, { type: "heading" | "paragraph" | "quote" }>;
type MediaBlock = Extract<ExportBlock, { type: "image" | "file" | "video" }>;
type StructureBlock = Exclude<ExportBlock, TextBlock | MediaBlock>;

const TEXT: ReadonlySet<string> = new Set(["heading", "paragraph", "quote"]);
const MEDIA: ReadonlySet<string> = new Set(["image", "file", "video"]);
const isText = (block: ExportBlock): block is TextBlock => TEXT.has(block.type);
const isMedia = (block: ExportBlock): block is MediaBlock => MEDIA.has(block.type);

function structureChildren(block: StructureBlock, context: DocxContext): FileChild[] {
  switch (block.type) {
    case "list":
      return list(block, context);
    case "callout": {
      const inside = { ...context, depth: 0 };
      return [
        calloutTable(block.variant, [
          textParagraph(block.text, inside),
          ...docxBlocks(block.children, inside),
        ]),
      ];
    }
    case "code":
      return code(block, context);
    case "table":
      return [wordTable(block)];
    case "divider":
      return [new Paragraph({ thematicBreak: true, children: [] })];
    case "columns":
      return [
        columnsTable(
          block.columns.map((column) => ({
            width: column.width,
            children: docxBlocks(column.blocks, {
              ...context,
              depth: 0,
              contentWidth: context.contentWidth * column.width,
            }),
          })),
        ),
      ];
    case "group":
      return docxBlocks(block.blocks, nestedIn(context));
  }
}

function blockChildren(block: ExportBlock, context: DocxContext): FileChild[] {
  if (isText(block)) return textBlock(block, context);
  return isMedia(block) ? mediaChildren(block, context) : structureChildren(block, context);
}

/** Export blocks as Word paragraphs and tables (spec 10, "Block mapping"). */
export function docxBlocks(blocks: readonly ExportBlock[], context: DocxContext): FileChild[] {
  return blocks.flatMap((block) => blockChildren(block, context));
}
