import type { LessonBlock } from "@bebranded/elearning-core";

import { element, escapeHtml } from "./html.js";
import { renderInline } from "./render-inline.js";
import { renderFile, renderImage } from "./render-media.js";
import type { RenderOptions } from "./render-media.js";
import { renderTable } from "./render-table.js";

type ListType = "bulletListItem" | "numberedListItem" | "checkListItem";
type ListBlock = Extract<LessonBlock, { type: ListType }>;

const LIST_TAGS: Record<ListType, { tag: "ul" | "ol"; className: string }> = {
  bulletListItem: { tag: "ul", className: "el-list" },
  numberedListItem: { tag: "ol", className: "el-list" },
  checkListItem: { tag: "ul", className: "el-list el-checklist" },
};

function isListBlock(block: LessonBlock): block is ListBlock {
  return block.type in LIST_TAGS;
}

/** Block colors and alignment as data attributes; values come from validated enums. */
function blockAttributes(props: object): Record<string, string | undefined> {
  const value = (key: string): string | undefined => {
    const raw: unknown = (props as Record<string, unknown>)[key];
    return typeof raw === "string" ? raw : undefined;
  };
  const textColor = value("textColor");
  const backgroundColor = value("backgroundColor");
  const alignment = value("textAlignment");
  return {
    "data-text-color": textColor === "default" ? undefined : textColor,
    "data-background-color": backgroundColor === "default" ? undefined : backgroundColor,
    "data-text-alignment": alignment === "left" ? undefined : alignment,
  };
}

function childrenHtml(children: LessonBlock[], options: RenderOptions): string {
  return children.length === 0
    ? ""
    : element("div", { class: "el-block-children" }, renderBlocks(children, options));
}

function renderListItem(block: ListBlock, options: RenderOptions): string {
  const inner =
    renderInline(block.content) +
    (block.children.length > 0 ? renderBlocks(block.children, options) : "");
  if (block.type !== "checkListItem") return element("li", blockAttributes(block.props), inner);
  const box = `<input type="checkbox" disabled${block.props.checked ? " checked" : ""}>`;
  return element(
    "li",
    { ...blockAttributes(block.props), "data-checked": block.props.checked },
    box + element("span", {}, inner),
  );
}

function renderList(items: ListBlock[], options: RenderOptions): string {
  const [first] = items;
  if (first === undefined) return "";
  const { tag, className } = LIST_TAGS[first.type];
  const start = first.type === "numberedListItem" ? first.props.start : undefined;
  return element(
    tag,
    { class: className, start },
    items.map((item) => renderListItem(item, options)).join(""),
  );
}

function renderHeading(
  block: Extract<LessonBlock, { type: "heading" }>,
  options: RenderOptions,
): string {
  const heading = element(
    `h${block.props.level}`,
    blockAttributes(block.props),
    renderInline(block.content),
  );
  if (block.props.isToggleable !== true) return heading + childrenHtml(block.children, options);
  return element(
    "details",
    { class: "el-toggle" },
    element("summary", {}, heading) + renderBlocks(block.children, options),
  );
}

type LeafBlock = Extract<
  LessonBlock,
  { type: "codeBlock" | "table" | "divider" | "image" | "file" }
>;

const LEAF_TYPES: ReadonlySet<string> = new Set(["codeBlock", "table", "divider", "image", "file"]);

function isLeafBlock(block: LessonBlock): block is LeafBlock {
  return LEAF_TYPES.has(block.type);
}

/** Blocks without children of their own to render. */
function renderLeafBlock(block: LeafBlock, options: RenderOptions): string {
  switch (block.type) {
    case "codeBlock": {
      const code = escapeHtml(block.content.map((item) => item.text).join(""));
      return element(
        "pre",
        { "data-language": block.props.language || undefined },
        element("code", {}, code),
      );
    }
    case "table":
      return renderTable(block.content);
    case "divider":
      return "<hr>";
    case "image":
      return renderImage(block, options);
    case "file":
      return renderFile(block, options);
  }
}

function renderBlock(
  block: Exclude<LessonBlock, ListBlock | LeafBlock>,
  options: RenderOptions,
): string {
  switch (block.type) {
    case "paragraph":
      return (
        element("p", blockAttributes(block.props), renderInline(block.content)) +
        childrenHtml(block.children, options)
      );
    case "heading":
      return renderHeading(block, options);
    case "toggleListItem":
      return element(
        "details",
        { class: "el-toggle", ...blockAttributes(block.props) },
        element("summary", {}, renderInline(block.content)) + renderBlocks(block.children, options),
      );
    case "quote":
      return (
        element("blockquote", blockAttributes(block.props), renderInline(block.content)) +
        childrenHtml(block.children, options)
      );
    case "callout":
      return element(
        "div",
        {
          class: "el-callout",
          role: "note",
          "data-variant": block.props.variant,
          ...blockAttributes(block.props),
        },
        element("div", { class: "el-callout-content" }, renderInline(block.content)) +
          childrenHtml(block.children, options),
      );
  }
}

/** Consecutive list items of the same type form one list, as in BlockNote. */
export function renderBlocks(blocks: LessonBlock[], options: RenderOptions = {}): string {
  let html = "";
  let pending: ListBlock[] = [];
  for (const block of blocks) {
    if (isListBlock(block) && (pending[0] === undefined || pending[0].type === block.type)) {
      pending.push(block);
      continue;
    }
    html += renderList(pending, options);
    pending = [];
    if (isListBlock(block)) pending.push(block);
    else html += isLeafBlock(block) ? renderLeafBlock(block, options) : renderBlock(block, options);
  }
  return html + renderList(pending, options);
}
