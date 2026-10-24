import type {
  ExportBlock,
  ExportListItem,
  ExportTableCell,
  ExportText,
} from "@bebranded/elearning-core";

import { element, escapeHtml } from "../render/html.js";
import { renderInline } from "../render/render-inline.js";

export type ExportRenderContext = {
  /** Data URI of an inlined image; images without one are left out (never fetched). */
  readonly imageSrc: (fileId: string) => string | undefined;
  /** Content heading levels are shifted under the document and section titles. */
  readonly headingOffset: number;
  /** The lesson page attachments link to. */
  readonly lessonUrl: string | null;
  readonly labels: { readonly video: string; readonly attachment: string };
};

const unset = (value: string) => (value === "default" ? undefined : value);

function textAttributes(text: ExportText) {
  return {
    "data-text-color": unset(text.textColor),
    "data-background-color": unset(text.backgroundColor),
    "data-text-alignment": text.alignment === "left" ? undefined : text.alignment,
  };
}

function renderItem(item: ExportListItem, context: ExportRenderContext): string {
  const box =
    item.checked === null ? "" : `<span class="el-check">${item.checked ? "☑" : "☐"}</span> `;
  return element(
    "li",
    textAttributes(item.text),
    box + renderInline(item.text.content) + renderExportBlocks(item.children, context),
  );
}

function renderCell(cell: ExportTableCell): string {
  const spans = {
    colspan: cell.colspan > 1 ? cell.colspan : undefined,
    rowspan: cell.rowspan > 1 ? cell.rowspan : undefined,
  };
  return element(cell.header ? "th" : "td", spans, renderInline(cell.content));
}

function renderTable(block: Extract<ExportBlock, { type: "table" }>): string {
  const rows = block.rows.map((row) => element("tr", {}, row.map(renderCell).join("")));
  const head = rows.slice(0, block.headerRows).join("");
  const body = rows.slice(block.headerRows).join("");
  // thead rows repeat on every printed page.
  return element(
    "table",
    {},
    (head === "" ? "" : element("thead", {}, head)) + element("tbody", {}, body),
  );
}

function linkTo(url: string | null, text: string): string {
  return url === null ? escapeHtml(text) : element("a", { href: url }, escapeHtml(text));
}

function renderMedia(
  block: Extract<ExportBlock, { type: "image" | "file" }>,
  context: ExportRenderContext,
): string {
  const caption = block.caption === "" ? "" : element("figcaption", {}, escapeHtml(block.caption));
  const src = block.type === "image" ? context.imageSrc(block.fileId) : undefined;
  if (block.type === "image" && src !== undefined) {
    const width = block.width === null ? "" : ` width="${block.width}"`;
    const alt = escapeHtml(block.caption === "" ? block.name : block.caption);
    return element(
      "figure",
      { "data-text-alignment": block.alignment === "left" ? undefined : block.alignment },
      `<img src="${escapeHtml(src)}" alt="${alt}"${width}>` + caption,
    );
  }
  const label = `${context.labels.attachment}: ${block.name === "" ? "file" : block.name}`;
  return element("p", { class: "el-file" }, linkTo(context.lessonUrl, label)) + caption;
}

function renderText(
  block: Extract<ExportBlock, { type: "heading" | "paragraph" | "quote" }>,
  context: ExportRenderContext,
): string {
  const inline = renderInline(block.text.content);
  if (block.type === "paragraph") return element("p", textAttributes(block.text), inline);
  if (block.type === "quote") return element("blockquote", textAttributes(block.text), inline);
  return element(
    `h${Math.min(6, block.level + context.headingOffset)}`,
    textAttributes(block.text),
    inline,
  );
}

type TextBlock = Extract<ExportBlock, { type: "heading" | "paragraph" | "quote" }>;
type MediaBlock = Extract<ExportBlock, { type: "image" | "file" }>;
type StructureBlock = Exclude<ExportBlock, TextBlock | MediaBlock>;

const isText = (block: ExportBlock): block is TextBlock =>
  block.type === "heading" || block.type === "paragraph" || block.type === "quote";
const isMedia = (block: ExportBlock): block is MediaBlock =>
  block.type === "image" || block.type === "file";

function renderList(block: Extract<ExportBlock, { type: "list" }>, context: ExportRenderContext) {
  const tag = block.style === "numbered" ? "ol" : "ul";
  const start = block.style === "numbered" && block.start !== 1 ? block.start : undefined;
  const items = block.items.map((item) => renderItem(item, context)).join("");
  return element(tag, { class: `el-list el-list-${block.style}`, start }, items);
}

function renderStructure(block: StructureBlock, context: ExportRenderContext): string {
  switch (block.type) {
    case "list":
      return renderList(block, context);
    case "callout":
      return element(
        "div",
        { class: "el-callout", "data-variant": block.variant },
        element("p", {}, renderInline(block.text.content)) +
          renderExportBlocks(block.children, context),
      );
    case "code":
      return element("pre", {}, element("code", {}, escapeHtml(block.code)));
    case "table":
      return renderTable(block);
    case "divider":
      return "<hr>";
    case "video":
      return element(
        "p",
        { class: "el-video" },
        `${escapeHtml(context.labels.video)}: ` +
          element("a", { href: block.url }, escapeHtml(block.title)),
      );
    case "group":
      return element("div", { class: "el-group" }, renderExportBlocks(block.blocks, context));
  }
}

function renderBlock(block: ExportBlock, context: ExportRenderContext): string {
  if (isText(block)) return renderText(block, context);
  return isMedia(block) ? renderMedia(block, context) : renderStructure(block, context);
}

export function renderExportBlocks(
  blocks: readonly ExportBlock[],
  context: ExportRenderContext,
): string {
  return blocks.map((block) => renderBlock(block, context)).join("");
}
