import { BorderStyle, Paragraph, ShadingType, Table, TableCell, TableRow, WidthType } from "docx";
import type { FileChild } from "docx";

import type { ExportBlock } from "@bebranded/elearning-core";

import { inlineRuns } from "./docx-inline.js";

type TableBlock = Extract<ExportBlock, { type: "table" }>;

/** A Word table; header rows repeat on every page, spans are kept. */
export function wordTable(block: TableBlock): Table {
  const rows = block.rows.map(
    (cells, index) =>
      new TableRow({
        tableHeader: index < block.headerRows,
        children: cells.map(
          (cell) =>
            new TableCell({
              columnSpan: cell.colspan,
              rowSpan: cell.rowspan,
              ...(cell.header
                ? { shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" } }
                : {}),
              children: [
                new Paragraph({
                  children: inlineRuns(cell.content),
                  ...(cell.header ? { run: { bold: true } } : {}),
                }),
              ],
            }),
        ),
      }),
  );
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: none, bottom: none, left: none, right: none };

/** What a Word cell may hold; it must end with a paragraph, so one is added after a table. */
function cellContent(children: readonly FileChild[]): (Paragraph | Table)[] {
  const content = children.filter(
    (child): child is Paragraph | Table => child instanceof Paragraph || child instanceof Table,
  );
  return content.at(-1) instanceof Paragraph
    ? content
    : [...content, new Paragraph({ children: [] })];
}

/** Columns: a borderless one-row table whose cells take each column's share of the width. */
export function columnsTable(
  columns: readonly { readonly width: number; readonly children: readonly FileChild[] }[],
): Table {
  const cells = columns.map(
    (column) =>
      new TableCell({
        width: { size: Math.round(column.width * 100), type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        margins: { left: 80, right: 80 },
        children: cellContent(column.children),
      }),
  );
  return new Table({
    rows: [new TableRow({ children: cells })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...NO_BORDERS, insideHorizontal: none, insideVertical: none },
  });
}

const VARIANT_COLORS = {
  info: "4338CA",
  success: "15803D",
  warning: "B45309",
  danger: "B91C1C",
} as const;

/** A callout: a single shaded cell with a colored left border (spec 10, "Block mapping"). */
export function calloutTable(
  variant: keyof typeof VARIANT_COLORS,
  children: readonly FileChild[],
): Table {
  const cell = new TableCell({
    shading: { type: ShadingType.CLEAR, fill: "F7F7F9", color: "auto" },
    borders: {
      top: none,
      bottom: none,
      right: none,
      left: { style: BorderStyle.SINGLE, size: 24, color: VARIANT_COLORS[variant] },
    },
    children: cellContent(children),
  });
  return new Table({
    rows: [new TableRow({ children: [cell] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
