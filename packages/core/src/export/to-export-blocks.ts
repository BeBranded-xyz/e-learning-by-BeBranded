import { fileIdFromUrl } from "../content/file-references.js";
import type { Color, InlineContent, LessonBlock } from "../content/lesson-document.types.js";
import type {
  ExportAlignment,
  ExportBlock,
  ExportListItem,
  ExportTableCell,
  ExportText,
} from "./export-document.types.js";

type ListType = "bulletListItem" | "numberedListItem" | "checkListItem";
type ListBlock = Extract<LessonBlock, { type: ListType }>;
type TableBlock = Extract<LessonBlock, { type: "table" }>;

const LIST_STYLES = {
  bulletListItem: "bullet",
  numberedListItem: "numbered",
  checkListItem: "check",
} as const;

function isListBlock(block: LessonBlock): block is ListBlock {
  return block.type in LIST_STYLES;
}

type TextLike = {
  readonly textColor: Color;
  readonly backgroundColor: Color;
  readonly textAlignment?: ExportAlignment;
};

function text(content: InlineContent, props: TextLike): ExportText {
  return {
    content,
    alignment: props.textAlignment ?? "left",
    textColor: props.textColor,
    backgroundColor: props.backgroundColor,
  };
}

/** Nested blocks, indented one level; nothing when there are none. */
function nested(children: readonly LessonBlock[]): ExportBlock[] {
  const blocks = toExportBlocks(children);
  return blocks.length === 0 ? [] : [{ type: "group", blocks }];
}

function toList(items: readonly ListBlock[]): ExportBlock {
  const [first] = items;
  const listItems: ExportListItem[] = items.map((item) => ({
    text: text(item.content, item.props),
    checked: item.type === "checkListItem" ? item.props.checked : null,
    children: toExportBlocks(item.children),
  }));
  return {
    type: "list",
    style: first === undefined ? "bullet" : LIST_STYLES[first.type],
    start: first?.type === "numberedListItem" ? (first.props.start ?? 1) : 1,
    items: listItems,
  };
}

function toTable(block: TableBlock): ExportBlock {
  const headerRows = block.content.headerRows ?? 0;
  const headerCols = block.content.headerCols ?? 0;
  const rows = block.content.rows.map((row, rowIndex) =>
    row.cells.map((cell, colIndex): ExportTableCell => {
      const header = rowIndex < headerRows || colIndex < headerCols;
      if (Array.isArray(cell)) return { content: cell, header, colspan: 1, rowspan: 1 };
      return {
        content: cell.content,
        header,
        colspan: cell.props.colspan ?? 1,
        rowspan: cell.props.rowspan ?? 1,
      };
    }),
  );
  return { type: "table", headerRows, rows };
}

/** Column widths as shares of the row, rounded to whole percents, summing to 1. */
function toColumns(block: Extract<LessonBlock, { type: "columnList" }>): ExportBlock {
  const total = block.children.reduce((sum, column) => sum + column.props.width, 0);
  return {
    type: "columns",
    columns: block.children.map((column) => ({
      width: Math.round((column.props.width / total) * 100) / 100,
      blocks: toExportBlocks(column.children),
    })),
  };
}

/** Media whose upload never finished export nothing, as they render nothing. */
function toMedia(block: Extract<LessonBlock, { type: "image" | "file" }>): ExportBlock[] {
  const fileId = fileIdFromUrl(block.props.url);
  if (fileId === null) return [];
  const { name, caption } = block.props;
  if (block.type === "file" || !block.props.showPreview)
    return [{ type: "file", fileId, name, caption }];
  return [
    {
      type: "image",
      fileId,
      name,
      caption,
      width: block.props.previewWidth ?? null,
      alignment: block.props.textAlignment,
    },
  ];
}

type TextBlock = Extract<
  LessonBlock,
  { type: "paragraph" | "heading" | "toggleListItem" | "quote" | "callout" }
>;
type OtherBlock = Exclude<LessonBlock, ListBlock | TextBlock>;

const TEXT_TYPES: ReadonlySet<string> = new Set([
  "paragraph",
  "heading",
  "toggleListItem",
  "quote",
  "callout",
]);

function isTextBlock(block: Exclude<LessonBlock, ListBlock>): block is TextBlock {
  return TEXT_TYPES.has(block.type);
}

function toTextBlock(block: TextBlock): ExportBlock[] {
  switch (block.type) {
    case "paragraph":
      return [
        { type: "paragraph", text: text(block.content, block.props) },
        ...nested(block.children),
      ];
    case "heading":
      // Toggles are expanded in exports (spec 10).
      return [
        { type: "heading", level: block.props.level, text: text(block.content, block.props) },
        ...nested(block.children),
      ];
    case "toggleListItem":
      return [
        { type: "paragraph", text: text(block.content, block.props) },
        ...nested(block.children),
      ];
    case "quote":
      return [{ type: "quote", text: text(block.content, block.props) }, ...nested(block.children)];
    case "callout":
      return [
        {
          type: "callout",
          variant: block.props.variant,
          text: text(block.content, block.props),
          children: toExportBlocks(block.children),
        },
      ];
  }
}

function toOtherBlock(block: OtherBlock): ExportBlock[] {
  switch (block.type) {
    case "codeBlock":
      return [
        {
          type: "code",
          language: block.props.language,
          code: block.content.map((item) => item.text).join(""),
        },
      ];
    case "table":
      return [toTable(block)];
    case "divider":
      return [{ type: "divider" }];
    case "image":
    case "file":
      return toMedia(block);
    case "columnList":
      return [toColumns(block)];
  }
}

/**
 * Converts a validated lesson document to export blocks (pure). Consecutive
 * list items of one type form one list, as when rendering a lesson.
 */
export function toExportBlocks(document: readonly LessonBlock[]): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  let pending: ListBlock[] = [];
  const flush = () => {
    if (pending.length > 0) blocks.push(toList(pending));
    pending = [];
  };
  for (const block of document) {
    if (isListBlock(block)) {
      if (pending[0] !== undefined && pending[0].type !== block.type) flush();
      pending.push(block);
      continue;
    }
    flush();
    blocks.push(...(isTextBlock(block) ? toTextBlock(block) : toOtherBlock(block)));
  }
  flush();
  return blocks;
}
